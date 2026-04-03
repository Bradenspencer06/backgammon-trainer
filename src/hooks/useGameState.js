import { useState, useRef } from 'react'
import jbackgammon from '@mrlhumphreys/jbackgammon'
import { INITIAL_MATCH_STATE } from '../constants/gameConstants'
import { evaluatePosition } from '../utils/evaluator'
import { enumerateAllMoves } from '../utils/moveEnumerator'

const { Match } = jbackgammon

/**
 * useGameState — thin React wrapper around jbackgammon's Match,
 * extended with a training layer that tracks win probability and
 * surfaces the best available move when the player plays suboptimally.
 *
 * Training state shape:
 *   winProb      — Black's win probability 0.0–1.0 (current position)
 *   delta        — change in current player's win% after last move (null until first move)
 *   hint         — { bestMoves, playerWinPct, bestWinPct, explanation } | null
 *                  Non-null only when the player's last move was suboptimal
 */
// ─── Opening roll state ───────────────────────────────────────────────────────

const OPENING_ROLL_INIT = { blackDie: null, whiteDie: null, tie: false, complete: false }

export function useGameState() {
  const matchRef = useRef(null)
  if (matchRef.current === null) {
    // Always pass a fresh move_list so INITIAL_MATCH_STATE.move_list is never mutated
    // by jbackgammon's _addMoveToList (which pushes by reference).
    matchRef.current = new Match({ ...INITIAL_MATCH_STATE, move_list: [] })
  }

  const [snapshot, setSnapshot] = useState(() => matchRef.current.asJson)

  // Opening roll — each player rolls one die before the game starts.
  // Stored in a ref so rollOpeningDie can read current values without stale closure.
  const openingRollRef = useRef({ ...OPENING_ROLL_INIT })
  const [openingRoll, _setOpeningRoll] = useState(openingRollRef.current)
  function setOpeningRoll(next) {
    openingRollRef.current = next
    _setOpeningRoll(next)
  }

  // Training layer state
  const [winProb, setWinProb]       = useState(0.5)
  const [delta, setDelta]           = useState(null)
  const [hint, setHint]             = useState(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const [goodMove, setGoodMove]           = useState(null)   // { winPct, label } | null

  // Persisted between dice roll and move completion
  const scoringPromiseRef   = useRef(null)   // Promise<{pre,best}> from rollDice — awaited at turn end
  const pendingWinProbRef   = useRef(null)   // winProb computed at turn-end, revealed on Submit
  const pendingDeltaRef     = useRef(null)   // delta computed at turn-end, revealed on Submit
  const pendingHintRef      = useRef(null)   // hint computed at turn-end, revealed on Submit
  const pendingGoodMoveRef  = useRef(null)   // good-move celebration, revealed on Submit
  const moveHistoryRef      = useRef([])     // stack of snapshots for undo (one per consumed die)

  function sync() {
    setSnapshot({ ...matchRef.current.asJson })
  }

  const match = matchRef.current
  const gs = match.gameState
  const currentPlayer = gs.currentPlayerNumber

  // ─── Opening roll ────────────────────────────────────────────────────────────
  // Each player rolls one die before the game starts. High roll goes first and
  // uses both dice as the opening move roll. Ties reset automatically.

  function rollOpeningDie(player) {
    const n = Math.ceil(Math.random() * 6)
    const curr = openingRollRef.current
    const blackDie = player === 1 ? n : curr.blackDie
    const whiteDie = player === 2 ? n : curr.whiteDie

    if (blackDie !== null && whiteDie !== null) {
      if (blackDie === whiteDie) {
        // Tie — show both dice, then auto-reset after 1.5s
        setOpeningRoll({ blackDie, whiteDie, tie: true, complete: false })
        setTimeout(() => setOpeningRoll({ ...OPENING_ROLL_INIT }), 1500)
      } else {
        // Winner determined — show both dice for 2s then start the game
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
        }, 2200)
      }
    } else {
      setOpeningRoll({ blackDie, whiteDie, tie: false, complete: false })
    }
  }

  // ─── Dice roll ───────────────────────────────────────────────────────────────
  // After rolling, enumerate all moves and find the best one. Store the
  // pre-move win probability so we can compute the delta after the turn.

  function rollDice() {
    match.touchDice(currentPlayer)
    sync()

    // Deep-clone so the snapshot is frozen — match.asJson shares object references
    // that mutate as the match progresses, breaking async candidate scoring.
    const rolled = JSON.parse(JSON.stringify(match.asJson))
    const movingPlayer = currentPlayer

    // Clear state from previous turn immediately
    pendingHintRef.current = null
    pendingGoodMoveRef.current = null
    pendingWinProbRef.current = null
    pendingDeltaRef.current = null
    moveHistoryRef.current = []
    setDelta(null)
    setHint(null)
    setGoodMove(null)
    setPendingSubmit(false)

    // Set scoringPromiseRef synchronously so _onTurnComplete can always await it,
    // even if the player moves before the async eval resolves.
    // Resolves to { pre, best } where pre = pre-move win prob, best = best candidate.
    scoringPromiseRef.current = evaluatePosition(rolled.game_state).then(prob => {
      setWinProb(prob)

      // Enumerate all legal moves and score each one
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

  // ─── Point touch ─────────────────────────────────────────────────────────────
  // After each touch we check whether the turn has ended (phase flipped back
  // to 'roll'). If it has, we compute the post-move training feedback.

  function touchPoint(pointNumber) {
    const phaseBefore    = gs.currentPhase
    const playerBefore   = gs.currentPlayerNumber
    const diceCountBefore = match.asJson.game_state.dice.filter(d => !d.used).length
    // Snapshot BEFORE this move — saved only if a die gets consumed
    const snapshotBefore = JSON.parse(JSON.stringify(match.asJson))

    match.touchPoint(pointNumber, currentPlayer)

    const afterJson      = match.asJson
    const phaseAfter     = afterJson.game_state.current_phase
    const diceCountAfter = afterJson.game_state.dice.filter(d => !d.used).length
    sync()

    // A die was consumed → a real move happened (not just source selection)
    const dieConsumed = diceCountAfter < diceCountBefore
    const turnEnded   = phaseBefore === 'move' && phaseAfter === 'roll'

    if (dieConsumed || turnEnded) {
      moveHistoryRef.current = [...moveHistoryRef.current, snapshotBefore]
    }

    if (turnEnded) {
      _onTurnComplete(afterJson, playerBefore)
    }
  }

  // ─── Pass ────────────────────────────────────────────────────────────────────

  function touchPass() {
    const playerBefore = gs.currentPlayerNumber
    match.touchPass(currentPlayer)
    sync()

    const afterJson = match.asJson
    _onTurnComplete(afterJson, playerBefore)
  }

  // ─── Undo ────────────────────────────────────────────────────────────────────

  function undoMove() {
    if (moveHistoryRef.current.length === 0) return
    const prev = moveHistoryRef.current[moveHistoryRef.current.length - 1]
    moveHistoryRef.current = moveHistoryRef.current.slice(0, -1)

    // Rebuild the match from the saved snapshot
    matchRef.current = new Match({ ...prev, move_list: [] })
    sync()

    // If the turn had ended, roll back the pending training state too
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

  // ─── Submit (hand off to next player) ────────────────────────────────────────

  function submitTurn() {
    // Reveal win%, delta, hint, and good-move celebration
    if (pendingWinProbRef.current !== null) setWinProb(pendingWinProbRef.current)
    if (pendingDeltaRef.current !== null) setDelta(pendingDeltaRef.current)
    if (pendingHintRef.current !== null) setHint(pendingHintRef.current)
    if (pendingGoodMoveRef.current !== null) setGoodMove(pendingGoodMoveRef.current)
    pendingWinProbRef.current = null
    pendingDeltaRef.current = null
    pendingHintRef.current = null
    pendingGoodMoveRef.current = null
    moveHistoryRef.current = []
    setPendingSubmit(false)
  }

  // ─── Reset ───────────────────────────────────────────────────────────────────

  function resetGame() {
    matchRef.current = new Match({ ...INITIAL_MATCH_STATE, move_list: [] })
    scoringPromiseRef.current = null
    pendingWinProbRef.current = null
    pendingDeltaRef.current = null
    pendingHintRef.current = null
    moveHistoryRef.current = []
    setSnapshot({ ...matchRef.current.asJson })
    setWinProb(0.5)
    setDelta(null)
    setHint(null)
    setGoodMove(null)
    setPendingSubmit(false)
    setOpeningRoll({ ...OPENING_ROLL_INIT })
  }

  // ─── Post-turn analysis ───────────────────────────────────────────────────────

  function _onTurnComplete(afterJson, playerWhoMoved) {
    setPendingSubmit(true)

    // Await both the post-move eval AND the candidate scoring (which may still be in-flight).
    // scoringPromise resolves to { pre, best } or null.
    const scoringPromise = scoringPromiseRef.current ?? Promise.resolve(null)
    scoringPromiseRef.current = null

    Promise.all([
      evaluatePosition(afterJson.game_state),
      scoringPromise,
    ]).then(([newProb, scored]) => {
      const pre  = scored?.pre  ?? null
      const best = scored?.best ?? null

      // Store win% and delta in refs — revealed only when player clicks Submit
      pendingWinProbRef.current = newProb

      if (pre !== null) {
        const rawDelta = playerWhoMoved === 1
          ? (newProb - pre) * 100
          : (pre - newProb) * 100
        pendingDeltaRef.current = rawDelta
      }

      // Compare to best available move
      const beforeGameState = scored?.beforeGameState ?? null

      if (best !== null) {
        const margin = playerWhoMoved === 1
          ? (best.evalProb - newProb) * 100
          : (newProb - best.evalProb) * 100

        // Only show hint if the player was meaningfully worse (>1%)
        if (margin > 1) {
          import('../utils/evaluator').then(({ explainDifference }) => {
            const explanation = explainDifference(
              afterJson.game_state,
              best.gameState,
              playerWhoMoved
            )
            // Store hint in ref — revealed when player clicks Submit
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
          // Player made the optimal (or near-optimal) move — queue celebration
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

  return {
    gameState:        snapshot,
    selectedPointNum: gs.selectedPoint?.number ?? null,
    notification:     match.notification,
    currentPlayer,
    phase:            gs.currentPhase,
    dice:             snapshot.game_state.dice,
    passable:         match.passable(currentPlayer),
    winner:           match.winner,
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
