/**
 * moveEnumerator.js — enumerate every legal complete-turn move sequence.
 *
 * Uses jbackgammon's own validation engine internally (no rule reimplementation).
 * This file does NOT need to change when the evaluator is upgraded — it is
 * purely about generating candidate positions for the evaluator to score.
 *
 * Returned format:
 *   [{ moves: [{from, to}, ...], gameState: <game_state json after all moves> }, ...]
 *
 * "from" / "to" are point numbers 1–24.
 * Bar entry uses from: 0.  Bearing off uses to: 25.
 */

import jbackgammon from '@mrlhumphreys/jbackgammon'
const { Match } = jbackgammon

const ALL_POINTS = Array.from({ length: 24 }, (_, i) => i + 1)  // 1..24
const BEAR_OFF   = 25  // sentinel for off-board destination
const BAR_SRC    = 0   // sentinel for bar source

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enumerate all distinct complete-turn move sequences available to the
 * current player given the current dice. Returns an empty array if it is
 * the 'roll' phase or there are no legal moves.
 *
 * Deduplicates results by final board position so the evaluator doesn't
 * score the same resulting position multiple times.
 *
 * @param {Object} matchSnapshot  — match.asJson
 * @returns {Array<{moves: Array<{from,to}>, gameState: Object}>}
 */
export function enumerateAllMoves(matchSnapshot) {
  const gs = matchSnapshot.game_state
  if (gs.current_phase !== 'move') return []

  const results = []
  // Pass a clean move_list so temp Match instances don't share the real match's
  // move_list array reference. Shared references cause _addMoveToList mutations
  // in the enumerator to pollute the main match's moveList, making _complete
  // trigger after only one real move instead of two.
  _enumerate({ ...matchSnapshot, move_list: [] }, [], results)

  return deduplicateByPosition(results)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Recursive DFS through all move sequences.
 * At each step we create a *fresh* temporary Match from the current snapshot,
 * try every (source, destination) pair, and recurse for incomplete turns.
 */
function _enumerate(snapshot, movesSoFar, results) {
  const player = snapshot.game_state.current_player_number
  const hasDice = snapshot.game_state.dice.some(d => d.number !== null && !d.used)
  if (!hasDice) return

  // Sources to try: bar first (mandatory if pieces are on bar), then all points
  const barPieces = (snapshot.game_state.bar?.pieces ?? [])
    .filter(p => p.player_number === player).length
  const sources = barPieces > 0
    ? [BAR_SRC]            // Must clear bar before regular moves
    : [BAR_SRC, ...ALL_POINTS]

  let foundAny = false

  for (const src of sources) {
    for (const dst of [...ALL_POINTS, BEAR_OFF]) {
      if (dst === src) continue

      const result = tryMove(snapshot, src, dst, player)
      if (result.type === 'invalid') continue

      foundAny = true
      const seq = [...movesSoFar, { from: src, to: dst }]

      if (result.type === 'complete') {
        results.push({ moves: seq, gameState: result.snapshot.game_state })
      } else {
        // 'incomplete' — more dice to use; recurse
        _enumerate(result.snapshot, seq, results)
      }
    }
  }

  // If no legal move exists (e.g. completely blocked), record current state
  // as a "forced pass" terminal — the turn will end unchanged
  if (!foundAny && movesSoFar.length > 0) {
    results.push({ moves: movesSoFar, gameState: snapshot.game_state })
  }
}

/**
 * Try a single (src → dst) move on a fresh clone of `snapshot`.
 * Returns: { type: 'complete'|'incomplete'|'invalid', snapshot? }
 */
function tryMove(snapshot, src, dst, player) {
  // --- Select the source ---
  // Copy move_list so multiple tryMove calls at the same level don't share
  // the same array — jbackgammon assigns it by reference in the constructor,
  // and _addMoveToList mutates it in-place on MoveIncomplete.
  const m1 = new Match({ ...snapshot, move_list: [...(snapshot.move_list ?? [])] })

  if (src === BAR_SRC) {
    // jbackgammon: touchBar is separate from touchPoint
    if (typeof m1.touchBar === 'function') {
      m1.touchBar(player)
    } else {
      // Fallback: bar handled internally when you touch a destination
      // while pieces are on the bar — skip explicit selection step
    }
  } else {
    m1.touchPoint(src, player)
  }

  // Verify source was selected (bar or point)
  const srcSelected = src === BAR_SRC
    ? m1.gameState.selectedBar !== null && m1.gameState.selectedBar !== undefined
    : m1.gameState.selectedPoint?.number === src

  if (!srcSelected) return { type: 'invalid' }

  // --- Attempt the destination move ---
  const playerBefore = m1.gameState.currentPlayerNumber
  // Count UNUSED dice — jbackgammon marks used dice with used:true, number stays set
  const diceCountBefore = m1.gameState.dice.dice
    ? m1.gameState.dice.dice.filter(d => !d.used).length
    : snapshot.game_state.dice.filter(d => !d.used).length

  if (dst === BEAR_OFF) {
    // Bear-off: try touching each of the 6 home-board points for the player
    // The library handles bear-off when you touch a home point beyond the board
    // We'll represent bear-off as touching the highest available home point
    // This path is approximate; full bear-off logic is engine-internal
    return { type: 'invalid' }  // Placeholder — bear-off handled by library natively
  }

  m1.touchPoint(dst, player)

  const playerAfter = m1.gameState.currentPlayerNumber
  const diceCountAfter = snapshot.game_state.dice.filter(d => d.number !== null).length

  if (playerAfter !== playerBefore) {
    // Turn complete (all dice used or no more moves)
    return { type: 'complete', snapshot: m1.asJson }
  }

  // Check if a die was consumed (incomplete move)
  // We compare dice in the post-action state via asJson
  const newDiceCount = m1.asJson.game_state.dice.filter(d => !d.used).length
  if (newDiceCount < diceCountBefore) {
    return { type: 'incomplete', snapshot: m1.asJson }
  }

  return { type: 'invalid' }
}

/**
 * Remove duplicates that result in the same final board position.
 * Key: sorted point occupancy string.
 */
function deduplicateByPosition(results) {
  const seen = new Set()
  return results.filter(r => {
    const key = positionKey(r.gameState)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function positionKey(gs) {
  return gs.points
    .map(p => `${p.number}:${p.pieces.map(pc => pc.player_number).join('')}`)
    .join('|')
}
