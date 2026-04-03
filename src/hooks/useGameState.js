import { useState, useRef } from 'react'
import jbackgammon from '@mrlhumphreys/jbackgammon'
import { INITIAL_MATCH_STATE } from '../constants/gameConstants'
import { evaluatePosition } from '../utils/evaluator'
import { enumerateAllMoves } from '../utils/moveEnumerator'
import { selectAiMove } from '../utils/aiPlayer'

const { Match } = jbackgammon

const OPENING_ROLL_INIT = { blackDie: null, whiteDie: null, tie: false, complete: false }
const AI_PLAYER = 2   // AI always plays White

const delay = ms => new Promise(r => setTimeout(r, ms))

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

  const scoringPromiseRef  = useRef(null)
  const pendingWinProbRef  = useRef(null)
  const pendingDeltaRef    = useRef(null)
  const pendingHintRef     = useRef(null)
  const pendingGoodMoveRef = useRef(null)
  const moveHistoryRef     = useRef([])

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

    scoringPromiseRef.current = evaluatePosition(rolled.game_state).then(prob => {
      setWinProb(prob)
      const candidates = enumerateAllMoves(rolled)
      if (candidates.length === 0) return { pre: prob, best: null }

      return Promise.all(
        candidates.map(c => evaluatePosition(c.gameState).then(p => ({ ...c, evalProb: p })))
      ).then(scored => ({
        pre: prob,
        best: scored.reduce((a, b) =>
          movingPlayer === 1 ? (b.evalProb > a.evalProb ? b : a) : (b.evalProb < a.evalProb ? b : a)
        ),
        beforeGameState: rolled.game_state,
      }))
    })
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

  function submitTurn() {
    if (pendingWinProbRef.current  !== null) setWinProb(pendingWinProbRef.current)
    if (pendingDeltaRef.current    !== null) setDelta(pendingDeltaRef.current)
    if (pendingHintRef.current     !== null) setHint(pendingHintRef.current)
    if (pendingGoodMoveRef.current !== null) setGoodMove(pendingGoodMoveRef.current)
    pendingWinProbRef.current  = null
    pendingDeltaRef.current    = null
    pendingHintRef.current     = null
    pendingGoodMoveRef.current = null
    moveHistoryRef.current     = []
    setPendingSubmit(false)

    // If it's now the AI's turn, kick it off
    const nextPlayer = matchRef.current.gameState.currentPlayerNumber
    if (difficultyRef.current && difficultyRef.current !== '2player' && nextPlayer === AI_PLAYER) {
      _runAiTurn()
    }
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
    setSnapshot({ ...matchRef.current.asJson })
    setWinProb(0.5)
    setDelta(null)
    setHint(null)
    setGoodMove(null)
    setAiThinking(false)
    setPendingSubmit(false)
    setOpeningRoll({ ...OPENING_ROLL_INIT })
    setDifficulty(null)   // go back to difficulty select
  }

  // ─── AI turn ──────────────────────────────────────────────────────────────────

  async function _runAiTurn() {
    const turnId = ++aiTurnIdRef.current
    const vsAi   = difficultyRef.current

    setAiThinking(true)

    // Brief thinking pause before rolling
    await delay(950)
    if (aiTurnIdRef.current !== turnId) return

    // Roll dice
    matchRef.current.touchDice(AI_PLAYER)
    sync()

    const rolled = JSON.parse(JSON.stringify(matchRef.current.asJson))

    // Pause to show the dice
    await delay(750)
    if (aiTurnIdRef.current !== turnId) return

    // Enumerate and score all candidates
    const candidates = enumerateAllMoves(rolled)

    if (candidates.length === 0 || matchRef.current.passable(AI_PLAYER)) {
      matchRef.current.touchPass(AI_PLAYER)
      sync()
      setAiThinking(false)
      // Update win prob silently
      evaluatePosition(matchRef.current.asJson.game_state).then(prob => setWinProb(prob))
      return
    }

    const scored = await Promise.all(
      candidates.map(c => evaluatePosition(c.gameState).then(p => ({ ...c, evalProb: p })))
    )
    if (aiTurnIdRef.current !== turnId) return

    // Pick move based on difficulty
    const chosen = selectAiMove(scored, vsAi, AI_PLAYER)
    if (!chosen) {
      setAiThinking(false)
      return
    }

    // Execute moves one at a time so the human can watch
    for (const move of chosen.moves) {
      await delay(480)
      if (aiTurnIdRef.current !== turnId) return

      // Select source (bar or point)
      if (move.from === 0) {
        if (typeof matchRef.current.touchBar === 'function') {
          matchRef.current.touchBar(AI_PLAYER)
        }
      } else {
        matchRef.current.touchPoint(move.from, AI_PLAYER)
      }
      sync()

      await delay(380)
      if (aiTurnIdRef.current !== turnId) return

      matchRef.current.touchPoint(move.to, AI_PLAYER)
      sync()
    }

    await delay(300)
    if (aiTurnIdRef.current !== turnId) return

    // Update win prob silently (no training feedback for AI turns)
    evaluatePosition(matchRef.current.asJson.game_state).then(prob => {
      if (aiTurnIdRef.current === turnId) setWinProb(prob)
    })

    setAiThinking(false)
  }

  // ─── Post-turn analysis (human turns only) ────────────────────────────────────

  function _onTurnComplete(afterJson, playerWhoMoved) {
    setPendingSubmit(true)

    const scoringPromise = scoringPromiseRef.current ?? Promise.resolve(null)
    scoringPromiseRef.current = null

    Promise.all([
      evaluatePosition(afterJson.game_state),
      scoringPromise,
    ]).then(([newProb, scored]) => {
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

      if (best !== null) {
        const margin = playerWhoMoved === 1
          ? (best.evalProb - newProb) * 100
          : (newProb - best.evalProb) * 100

        if (margin > 1) {
          import('../utils/evaluator').then(({ explainDifference }) => {
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
            }
          })
        } else {
          pendingHintRef.current = null
          setHint(null)
          const playerPct = playerWhoMoved === 1 ? newProb * 100 : (1 - newProb) * 100
          pendingGoodMoveRef.current = {
            winPct: playerPct,
            label:  playerWhoMoved === 1 ? 'Black' : 'White',
          }
        }
      }
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
    clearGoodMove: () => setGoodMove(null),
    pendingSubmit,
    rollDice,
    touchPoint,
    touchPass,
    submitTurn,
    resetGame,
  }
}
