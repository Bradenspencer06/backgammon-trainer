import { useState, useRef } from 'react'
import jbackgammon from '@mrlhumphreys/jbackgammon'
import { INITIAL_MATCH_STATE } from '../constants/gameConstants'
import { evaluatePosition, explainDifference } from '../utils/evaluator'
import { mapWithConcurrency } from '../utils/asyncPool'
import { enumerateAllMoves, coachingPositionKey } from '../utils/moveEnumerator'
import { selectAiMove } from '../utils/aiPlayer'

const { Match } = jbackgammon

const OPENING_ROLL_INIT = { blackDie: null, whiteDie: null, tie: false, complete: false }
const AI_PLAYER = 2   // AI always plays White

/** How many legal plays we score in parallel (AI: sampled roll equity; human coaching: two-phase below). */
const EVAL_CANDIDATE_CONCURRENCY = 8
/** After fast screening, full GNU roll equity on this many top lines (`VITE_COACHING_REFINE_TOP`, default 12). */
const _refineRaw = Number(import.meta.env.VITE_COACHING_REFINE_TOP)
const COACHING_REFINE_TOP = Math.min(
  36,
  Math.max(1, Number.isFinite(_refineRaw) && _refineRaw > 0 ? Math.floor(_refineRaw) : 12)
)
const COACHING_REFINE_CONCURRENCY = 3

const delay = ms => new Promise(r => setTimeout(r, ms))

function pickBestByEval(scored, movingPlayer) {
  return scored.reduce((a, b) =>
    movingPlayer === 1 ? (b.evalProb > a.evalProb ? b : a) : (b.evalProb < a.evalProb ? b : a)
  )
}

export function useGameState() {
  const matchRef = useRef(null)
  if (matchRef.current === null) {
    matchRef.current = new Match({ ...INITIAL_MATCH_STATE, move_list: [] })
  }

  const [snapshot, setSnapshot] = useState(() => matchRef.current.asJson)

  // ─── Difficulty / AI ──────────────────────────────────────────────────────────
  // null = no game started yet, '2player' = local, 'beginner'/'medium'/'hard'/'expert' = vs AI
  const difficultyRef = useRef(null)
  const [difficulty, _setDifficulty] = useState(null)
  function setDifficulty(d) { difficultyRef.current = d; _setDifficulty(d) }

  const [aiThinking, setAiThinking] = useState(false)
  // Incremented each time a new AI turn starts; used to abort stale async turns
  const aiTurnIdRef = useRef(0)

  // ─── Opening roll ─────────────────────────────────────────────────────────────
  const openingRollRef = useRef({ ...OPENING_ROLL_INIT })
  const [openingRoll, _setOpeningRoll] = useState(openingRollRef.current)
  function setOpeningRoll(next) { openingRollRef.current = next; _setOpeningRoll(next) }

  // ─── Training layer ───────────────────────────────────────────────────────────
  const [winProb, setWinProb]         = useState(0.5)
  const [delta, setDelta]             = useState(null)
  const [hint, setHint]               = useState(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const [goodMove, setGoodMove]       = useState(null)
  // AI's last rolled dice — kept visible until the human rolls their own
  const [lastAiDice, setLastAiDice]   = useState(null)

  const scoringPromiseRef  = useRef(null)
  const pendingWinProbRef  = useRef(null)
  const pendingDeltaRef    = useRef(null)
  const pendingHintRef     = useRef(null)
  const pendingGoodMoveRef = useRef(null)
  const moveHistoryRef     = useRef([])
  // Gate promise: AI waits here while the good-move toast is visible
  const toastGateRef       = useRef(null)
  // Submit can fire before GNU finishes — queue handoff until post-turn analysis populates refs
  const submitWantedRef     = useRef(false)
  const analysisReadyRef    = useRef(false)
  const turnAnalysisSeqRef  = useRef(0)

  function sync() { setSnapshot({ ...matchRef.current.asJson }) }

  const match         = matchRef.current
  const gs            = match.gameState
  const currentPlayer = gs.currentPlayerNumber

  // ─── Difficulty selection ─────────────────────────────────────────────────────

  function chooseDifficulty(d) {
    setDifficulty(d)
  }

  // ─── Opening roll ─────────────────────────────────────────────────────────────

  function rollOpeningDie(player) {
    const n        = Math.ceil(Math.random() * 6)
    const curr     = openingRollRef.current
    const blackDie = player === 1 ? n : curr.blackDie
    const whiteDie = player === 2 ? n : curr.whiteDie

    if (blackDie !== null && whiteDie !== null) {
      if (blackDie === whiteDie) {
        setOpeningRoll({ blackDie, whiteDie, tie: true, complete: false })
        setTimeout(() => setOpeningRoll({ ...OPENING_ROLL_INIT }), 1500)
      } else {
        const winner    = blackDie > whiteDie ? 1 : 2
        const winnerDie = winner === 1 ? blackDie : whiteDie
        const loserDie  = winner === 1 ? whiteDie : blackDie
        setOpeningRoll({ blackDie, whiteDie, tie: false, complete: false })
        setTimeout(() => {
          matchRef.current = new Match({
            ...INITIAL_MATCH_STATE,
            move_list: [],
            game_state: {
              ...INITIAL_MATCH_STATE.game_state,
              current_player_number: winner,
              current_phase: 'move',
              dice: [
                { number: winnerDie, used: false },
                { number: loserDie,  used: false },
              ],
            },
          })
          setSnapshot({ ...matchRef.current.asJson })
          setOpeningRoll({ blackDie, whiteDie, tie: false, complete: true })

          // If AI won the opening roll, start its turn immediately
          if (difficultyRef.current && difficultyRef.current !== '2player' && winner === AI_PLAYER) {
            // Small extra delay so the board renders before AI starts moving
            setTimeout(() => _runAiTurn(), 600)
          }
        }, 2200)
      }
    } else {
      setOpeningRoll({ blackDie, whiteDie, tie: false, complete: false })
    }
  }

  // ─── Human dice roll ──────────────────────────────────────────────────────────

  function rollDice() {
    setLastAiDice(null)        // human is rolling — clear the AI ghost dice
    match.touchDice(currentPlayer)
    sync()

    const rolled       = JSON.parse(JSON.stringify(match.asJson))
    const movingPlayer = currentPlayer

    pendingHintRef.current     = null
    pendingGoodMoveRef.current = null
    pendingWinProbRef.current  = null
    pendingDeltaRef.current    = null
    moveHistoryRef.current     = []
    setDelta(null)
    setHint(null)
    setGoodMove(null)
    setPendingSubmit(false)

    // Two-phase coaching: fast sampled equity on every legal play (keeps analysis responsive), then
    // full GNU roll average on the top-N from that sort so the "best move" matches the real engine.
    scoringPromiseRef.current = (async () => {
      const candidates = enumerateAllMoves(rolled)
      if (candidates.length === 0) {
        const pre = await evaluatePosition(rolled.game_state, { postTurnFast: true })
        return { pre, best: null }
      }
      const [pre, scoredFast] = await Promise.all([
        evaluatePosition(rolled.game_state, { postTurnFast: true }),
        mapWithConcurrency(candidates, EVAL_CANDIDATE_CONCURRENCY, async (c) => ({
          ...c,
          evalProb: await evaluatePosition(c.gameState, { postTurnFast: true }),
        })),
      ])
      const sorted = [...scoredFast].sort((a, b) =>
        movingPlayer === 1 ? b.evalProb - a.evalProb : a.evalProb - b.evalProb
      )
      const shortlistLen = Math.min(COACHING_REFINE_TOP, sorted.length)
      const shortlist = sorted.slice(0, shortlistLen)
      const refined = await mapWithConcurrency(shortlist, COACHING_REFINE_CONCURRENCY, async (c) => ({
        ...c,
        evalProb: await evaluatePosition(c.gameState),
      }))
      const best = pickBestByEval(refined, movingPlayer)
      return {
        pre,
        best,
        beforeGameState: rolled.game_state,
        dice: rolled.game_state.dice,
      }
    })()
  }

  // ─── Human point touch ───────────────────────────────────────────────────────

  function touchPoint(pointNumber) {
    const phaseBefore     = gs.currentPhase
    const playerBefore    = gs.currentPlayerNumber
    const diceCountBefore = match.asJson.game_state.dice.filter(d => !d.used).length
    const snapshotBefore  = JSON.parse(JSON.stringify(match.asJson))

    match.touchPoint(pointNumber, currentPlayer)

    const afterJson      = match.asJson
    const phaseAfter     = afterJson.game_state.current_phase
    const diceCountAfter = afterJson.game_state.dice.filter(d => !d.used).length
    sync()

    const dieConsumed = diceCountAfter < diceCountBefore
    const turnEnded   = phaseBefore === 'move' && phaseAfter === 'roll'

    if (dieConsumed || turnEnded) {
      moveHistoryRef.current = [...moveHistoryRef.current, snapshotBefore]
    }

    if (turnEnded) {
      _onTurnComplete(afterJson, playerBefore)
    }
  }

  // ─── Pass ─────────────────────────────────────────────────────────────────────

  function touchPass() {
    const playerBefore = gs.currentPlayerNumber
    match.touchPass(currentPlayer)
    sync()
    const afterJson = match.asJson
    _onTurnComplete(afterJson, playerBefore)
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────────

  function undoMove() {
    if (moveHistoryRef.current.length === 0) return
    const prev = moveHistoryRef.current[moveHistoryRef.current.length - 1]
    moveHistoryRef.current = moveHistoryRef.current.slice(0, -1)
    matchRef.current = new Match({ ...prev, move_list: [] })
    sync()
    if (pendingSubmit) {
      turnAnalysisSeqRef.current++
      analysisReadyRef.current   = false
      submitWantedRef.current    = false
      scoringPromiseRef.current  = null
      pendingWinProbRef.current  = null
      pendingDeltaRef.current    = null
      pendingHintRef.current     = null
      pendingGoodMoveRef.current = null
      setPendingSubmit(false)
      setHint(null)
      setGoodMove(null)
    }
  }

  // ─── Submit (human hand-off) ──────────────────────────────────────────────────

  function flushSubmitHandoff() {
    if (!submitWantedRef.current || !analysisReadyRef.current) return
    submitWantedRef.current = false
    analysisReadyRef.current  = false

    if (pendingWinProbRef.current  !== null) setWinProb(pendingWinProbRef.current)
    if (pendingDeltaRef.current    !== null) setDelta(pendingDeltaRef.current)

    if (pendingHintRef.current !== null) {
      let gateResolve
      const gatePromise = new Promise(r => { gateResolve = r })
      toastGateRef.current = { promise: gatePromise, resolve: gateResolve }
      setHint(pendingHintRef.current)
    } else if (pendingGoodMoveRef.current !== null) {
      let gateResolve
      const gatePromise = new Promise(r => { gateResolve = r })
      toastGateRef.current = { promise: gatePromise, resolve: gateResolve }
      setTimeout(gateResolve, 4900)
      setGoodMove(pendingGoodMoveRef.current)
    }

    pendingWinProbRef.current  = null
    pendingDeltaRef.current    = null
    pendingHintRef.current     = null
    pendingGoodMoveRef.current = null
    moveHistoryRef.current     = []

    const nextPlayer = matchRef.current.gameState.currentPlayerNumber
    if (difficultyRef.current && difficultyRef.current !== '2player' && nextPlayer === AI_PLAYER) {
      _runAiTurn()
    }
  }

  function submitTurn() {
    submitWantedRef.current = true
    moveHistoryRef.current  = []
    setPendingSubmit(false)

    flushSubmitHandoff()
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  function resetGame() {
    aiTurnIdRef.current++           // abort any in-flight AI turn
    matchRef.current       = new Match({ ...INITIAL_MATCH_STATE, move_list: [] })
    scoringPromiseRef.current  = null
    pendingWinProbRef.current  = null
    pendingDeltaRef.current    = null
    pendingHintRef.current     = null
    moveHistoryRef.current     = []
    if (toastGateRef.current) { toastGateRef.current.resolve(); toastGateRef.current = null }
    setSnapshot({ ...matchRef.current.asJson })
    setWinProb(0.5)
    setDelta(null)
    setHint(null)
    setGoodMove(null)
    setLastAiDice(null)
    setAiThinking(false)
    setPendingSubmit(false)
    analysisReadyRef.current  = false
    submitWantedRef.current   = false
    turnAnalysisSeqRef.current++
    setOpeningRoll({ ...OPENING_ROLL_INIT })
    setDifficulty(null)   // go back to difficulty select
  }

  // ─── AI turn ──────────────────────────────────────────────────────────────────

  async function _runAiTurn() {
    const turnId = ++aiTurnIdRef.current
    const vsAi   = difficultyRef.current

    setAiThinking(true)

    // Overlap coach / good-move time with roll + GNU scoring — only animate after the toast gate clears
    const gatePromise = toastGateRef.current?.promise ?? Promise.resolve()

    const prep = (async () => {
      await delay(280)
      if (aiTurnIdRef.current !== turnId) return null

      matchRef.current.touchDice(AI_PLAYER)
      sync()

      const rolled = JSON.parse(JSON.stringify(matchRef.current.asJson))

      await delay(380)
      if (aiTurnIdRef.current !== turnId) return null

      const candidates = enumerateAllMoves(rolled)

      if (candidates.length === 0 || matchRef.current.passable(AI_PLAYER)) {
        return { kind: 'pass', rolled }
      }

      const scored = await mapWithConcurrency(candidates, EVAL_CANDIDATE_CONCURRENCY, async (c) => ({
        ...c,
        evalProb: await evaluatePosition(c.gameState, {
          aiMoveChoice: true,
          aiExpertExact: vsAi === 'expert',
        }),
      }))
      if (aiTurnIdRef.current !== turnId) return null

      const chosen = selectAiMove(scored, vsAi, AI_PLAYER)
      if (!chosen) return { kind: 'abort' }
      return { kind: 'play', rolled, chosen }
    })()

    const [, prepResult] = await Promise.all([gatePromise, prep])
    if (toastGateRef.current) toastGateRef.current = null

    if (aiTurnIdRef.current !== turnId) return

    if (!prepResult || prepResult.kind === 'abort') {
      setAiThinking(false)
      return
    }

    if (prepResult.kind === 'pass') {
      const { rolled } = prepResult
      matchRef.current.touchPass(AI_PLAYER)
      sync()
      setLastAiDice(rolled.game_state.dice)
      setAiThinking(false)
      evaluatePosition(matchRef.current.asJson.game_state, { postTurnFast: true }).then(prob =>
        setWinProb(prob)
      )
      return
    }

    const { rolled, chosen } = prepResult

    for (const move of chosen.moves) {
      await delay(420)
      if (aiTurnIdRef.current !== turnId) return

      if (move.from === 0) {
        matchRef.current.touchPoint('bar', AI_PLAYER)
      } else {
        matchRef.current.touchPoint(move.from, AI_PLAYER)
      }
      sync()

      await delay(500)
      if (aiTurnIdRef.current !== turnId) return

      matchRef.current.touchPoint(move.to, AI_PLAYER)
      sync()
    }

    await delay(450)
    if (aiTurnIdRef.current !== turnId) return

    setLastAiDice(rolled.game_state.dice)

    evaluatePosition(matchRef.current.asJson.game_state, { postTurnFast: true }).then(prob => {
      if (aiTurnIdRef.current === turnId) setWinProb(prob)
    })

    setAiThinking(false)
  }

  // ─── Post-turn analysis (human turns only) ────────────────────────────────────

  function _onTurnComplete(afterJson, playerWhoMoved) {
    setPendingSubmit(true)
    analysisReadyRef.current = false
    submitWantedRef.current   = false
    const seq = ++turnAnalysisSeqRef.current

    const scoringPromise = scoringPromiseRef.current ?? Promise.resolve(null)
    scoringPromiseRef.current = null

    Promise.all([
      evaluatePosition(afterJson.game_state, { postTurnFast: true }),
      scoringPromise,
    ]).then(([newProb, scored]) => {
      if (seq !== turnAnalysisSeqRef.current) return

      const pre  = scored?.pre  ?? null
      const best = scored?.best ?? null

      pendingWinProbRef.current = newProb

      if (pre !== null) {
        const rawDelta = playerWhoMoved === 1
          ? (newProb - pre) * 100
          : (pre - newProb) * 100
        pendingDeltaRef.current = rawDelta
      }

      const beforeGameState = scored?.beforeGameState ?? null
      const rolledDice      = scored?.dice ?? null

      pendingHintRef.current = null
      pendingGoodMoveRef.current = null

      if (best !== null && best.moves?.length) {
        const playedKey = coachingPositionKey(afterJson.game_state)
        const bestKey   = coachingPositionKey(best.gameState)
        const playedBestBoard = playedKey === bestKey

        const margin = playerWhoMoved === 1
          ? (best.evalProb - newProb) * 100
          : (newProb - best.evalProb) * 100

        const SUBOPTIMAL_THRESHOLD = 0.75
        const isSuboptimal         = !playedBestBoard && margin > SUBOPTIMAL_THRESHOLD

        if (isSuboptimal) {
          const explanation = explainDifference(
            afterJson.game_state,
            best.gameState,
            playerWhoMoved
          )
          pendingHintRef.current = {
            bestMoves:      best.moves,
            playerWinPct:   newProb * 100,
            bestWinPct:     best.evalProb * 100,
            explanation,
            playerWhoMoved,
            beforeGameState,
            afterGameState: best.gameState,
            dice:           rolledDice,
          }
        } else {
          setHint(null)
          const playerPct = playerWhoMoved === 1 ? newProb * 100 : (1 - newProb) * 100
          pendingGoodMoveRef.current = {
            winPct: playerPct,
            label:  playerWhoMoved === 1 ? 'Black' : 'White',
          }
        }
      }

      analysisReadyRef.current = true
      flushSubmitHandoff()
    }).catch(() => {
      if (seq !== turnAnalysisSeqRef.current) return
      analysisReadyRef.current = true
      flushSubmitHandoff()
    })
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  return {
    // Core game state
    gameState:        snapshot,
    selectedPointNum: gs.selectedPoint?.number ?? null,
    notification:     match.notification,
    currentPlayer,
    phase:            gs.currentPhase,
    dice:             snapshot.game_state.dice,
    lastAiDice,
    passable:         match.passable(currentPlayer),
    winner:           match.winner,
    // Difficulty / AI
    difficulty,
    chooseDifficulty,
    aiThinking,
    vsAi: difficulty !== null && difficulty !== '2player',
    // Opening roll
    openingRoll,
    rollOpeningDie,
    // Undo
    canUndo: moveHistoryRef.current.length > 0,
    undoMove,
    // Training layer
    winProb,
    delta,
    hint,
    goodMove,
    clearGoodMove: () => {
      setGoodMove(null)
      if (toastGateRef.current) { toastGateRef.current.resolve(); toastGateRef.current = null }
    },
    onHintClose: () => {
      // Don't clear the hint — keep the button visible so user can re-open
      // Just release the gate so the AI can start
      if (toastGateRef.current) { toastGateRef.current.resolve(); toastGateRef.current = null }
    },
    pendingSubmit,
    rollDice,
    touchPoint,
    touchPass,
    submitTurn,
    resetGame,
  }
}
