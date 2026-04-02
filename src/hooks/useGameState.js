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
    matchRef.current = new Match(INITIAL_MATCH_STATE)
  }

  const [snapshot, setSnapshot] = useState(() => matchRef.current.asJson)

  // Training layer state
  const [winProb, setWinProb]   = useState(0.5)
  const [delta, setDelta]       = useState(null)
  const [hint, setHint]         = useState(null)

  // Persisted between dice roll and move completion
  const preMoveWinProbRef   = useRef(null)   // winProb just before the player starts moving
  const bestCandidateRef    = useRef(null)   // { winProb, moves } of the best available move

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

    const rolled = match.asJson

    // Capture the win probability *before* any move is made
    evaluatePosition(rolled.game_state).then(prob => {
      preMoveWinProbRef.current = prob
      setWinProb(prob)
      setDelta(null)   // clear last turn's delta
      setHint(null)    // clear last turn's hint

      // Enumerate all legal moves and score each one
      const candidates = enumerateAllMoves(rolled)
      if (candidates.length === 0) {
        bestCandidateRef.current = null
        return
      }

      Promise.all(
        candidates.map(c => evaluatePosition(c.gameState).then(p => ({ ...c, evalProb: p })))
      ).then(scored => {
        // Best = highest Black win prob if Black is moving, lowest if White is moving
        const best = scored.reduce((a, b) => {
          if (currentPlayer === 1) return b.evalProb > a.evalProb ? b : a
          else                     return b.evalProb < a.evalProb ? b : a
        })
        bestCandidateRef.current = best
      })
    })
  }

  // ─── Point touch ─────────────────────────────────────────────────────────────
  // After each touch we check whether the turn has ended (phase flipped back
  // to 'roll'). If it has, we compute the post-move training feedback.

  function touchPoint(pointNumber) {
    const phaseBefore = gs.currentPhase
    const playerBefore = gs.currentPlayerNumber

    match.touchPoint(pointNumber, currentPlayer)
    sync()

    const afterJson = match.asJson
    const phaseAfter = afterJson.game_state.current_phase

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

  // ─── Post-turn analysis ───────────────────────────────────────────────────────

  function _onTurnComplete(afterJson, playerWhoMoved) {
    evaluatePosition(afterJson.game_state).then(newProb => {
      setWinProb(newProb)

      const pre = preMoveWinProbRef.current
      if (pre !== null) {
        // Delta from the perspective of the player who just moved
        const rawDelta = playerWhoMoved === 1
          ? (newProb - pre) * 100
          : (pre - newProb) * 100
        setDelta(rawDelta)
      }

      // Compare to best available move
      const best = bestCandidateRef.current
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
            setHint({
              bestMoves:    best.moves,
              playerWinPct: newProb * 100,
              bestWinPct:   best.evalProb * 100,
              explanation,
            })
          })
        } else {
          setHint(null)
        }
      }

      preMoveWinProbRef.current = null
      bestCandidateRef.current  = null
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
    rollDice,
    touchPoint,
    touchPass,
  }
}
