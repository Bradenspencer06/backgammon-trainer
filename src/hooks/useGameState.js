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
export function useGameState() {
  const matchRef = useRef(null)
  if (matchRef.current === null) {
    // Always pass a fresh move_list so INITIAL_MATCH_STATE.move_list is never mutated
    // by jbackgammon's _addMoveToList (which pushes by reference).
    matchRef.current = new Match({ ...INITIAL_MATCH_STATE, move_list: [] })
  }

  const [snapshot, setSnapshot] = useState(() => matchRef.current.asJson)

  // Training layer state
  const [winProb, setWinProb]       = useState(0.5)
  const [delta, setDelta]           = useState(null)
  const [hint, setHint]             = useState(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  // Persisted between dice roll and move completion
  const scoringPromiseRef   = useRef(null)   // Promise<{pre,best}> from rollDice — awaited at turn end
  const pendingWinProbRef   = useRef(null)   // winProb computed at turn-end, revealed on Submit
  const pendingDeltaRef     = useRef(null)   // delta computed at turn-end, revealed on Submit
  const pendingHintRef      = useRef(null)   // hint computed at turn-end, revealed on Submit

  function sync() {
    setSnapshot({ ...matchRef.current.asJson })
  }

  const match = matchRef.current
  const gs = match.gameState
  const currentPlayer = gs.currentPlayerNumber

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
    pendingWinProbRef.current = null
    pendingDeltaRef.current = null
    setDelta(null)
    setHint(null)
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
      }))
    })
  }

  // ─── Point touch ─────────────────────────────────────────────────────────────
  // After each touch we check whether the turn has ended (phase flipped back
  // to 'roll'). If it has, we compute the post-move training feedback.

  function touchPoint(pointNumber) {
    const phaseBefore = gs.currentPhase
    const playerBefore = gs.currentPlayerNumber

    match.touchPoint(pointNumber, currentPlayer)

    const afterJson = match.asJson
    const phaseAfter = afterJson.game_state.current_phase
    sync()

    // Turn ended when phase returns to 'roll'
    const turnEnded = phaseBefore === 'move' && phaseAfter === 'roll'
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

  // ─── Submit (hand off to next player) ────────────────────────────────────────

  function submitTurn() {
    // Reveal win%, delta, and hint now that the player has committed their turn
    if (pendingWinProbRef.current !== null) setWinProb(pendingWinProbRef.current)
    if (pendingDeltaRef.current !== null) setDelta(pendingDeltaRef.current)
    if (pendingHintRef.current !== null) setHint(pendingHintRef.current)
    pendingWinProbRef.current = null
    pendingDeltaRef.current = null
    pendingHintRef.current = null
    setPendingSubmit(false)
  }

  // ─── Reset ───────────────────────────────────────────────────────────────────

  function resetGame() {
    matchRef.current = new Match({ ...INITIAL_MATCH_STATE, move_list: [] })
    scoringPromiseRef.current = null
    pendingWinProbRef.current = null
    pendingDeltaRef.current = null
    pendingHintRef.current = null
    setSnapshot({ ...matchRef.current.asJson })
    setWinProb(0.5)
    setDelta(null)
    setHint(null)
    setPendingSubmit(false)
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
            }
          })
        } else {
          pendingHintRef.current = null
          setHint(null)
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
    // Training layer
    winProb,
    delta,
    hint,
    pendingSubmit,
    rollDice,
    touchPoint,
    touchPass,
    submitTurn,
    resetGame,
  }
}
