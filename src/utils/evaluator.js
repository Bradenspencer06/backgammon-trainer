/**
 * evaluator.js — ISOLATED position evaluation module.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PUBLIC API — this is the ONLY contract that matters for the app.   ║
 * ║  Replace this entire file with a GNU Backgammon WASM / API adapter  ║
 * ║  and nothing else in the codebase needs to change.                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * All functions accept the `game_state` slice from match.asJson:
 *   { current_player_number, current_phase, dice, bar, points, off_board }
 *
 * All win-probability values are from BLACK's perspective (0 = Black loses, 1 = Black wins).
 * The UI layer converts to the current player's perspective as needed.
 *
 * CURRENT IMPLEMENTATION: heuristic evaluator (pip count + position quality).
 * Accurate enough to teach directional decision-making; not world-class.
 * Swap the file for production-grade analysis (e.g. gnubg equity tables).
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate a position and return Black's win probability.
 * Async so the interface is compatible with a future network/WASM engine
 * without requiring callers to change.
 *
 * @param {Object} gameStateJson
 * @returns {Promise<number>} Black's win probability, 0.0–1.0
 */
export async function evaluatePosition(gameStateJson) {
  return heuristicEval(gameStateJson)
}

/**
 * Generate a one-sentence explanation of why `betterGs` is a stronger
 * position than `worseGs` for `playerNumber`.
 *
 * @param {Object} worseGs    — game_state of the position the player chose
 * @param {Object} betterGs   — game_state of the best available position
 * @param {number} playerNumber — 1 (Black) or 2 (White)
 * @returns {string}
 */
export function explainDifference(worseGs, betterGs, playerNumber) {
  const sign = playerNumber === 1 ? 1 : -1

  const pipDelta     = sign * (totalPips(betterGs, 2) - totalPips(worseGs, 2)
                             - totalPips(betterGs, 1) + totalPips(worseGs, 1))
  const blotDelta    = sign * (countBlots(worseGs, playerNumber) - countBlots(betterGs, playerNumber))
  const homeDelta    = sign * (countHomePoints(betterGs, playerNumber) - countHomePoints(worseGs, playerNumber))
  const primeDelta   = sign * (longestPrime(betterGs, playerNumber) - longestPrime(worseGs, playerNumber))
  const anchorDelta  = sign * (countAnchors(betterGs, playerNumber) - countAnchors(worseGs, playerNumber))

  // Return the most significant reason
  const reasons = [
    [Math.abs(pipDelta),    pipDelta > 0    && `Gains ${Math.round(pipDelta)} pip${Math.abs(pipDelta) !== 1 ? 's' : ''} on the pip count`],
    [Math.abs(blotDelta)*3, blotDelta > 0   && `Leaves ${blotDelta} fewer blot${blotDelta !== 1 ? 's' : ''} exposed`],
    [Math.abs(homeDelta)*2, homeDelta > 0   && `Closes an additional home-board point`],
    [Math.abs(primeDelta)*4,primeDelta > 0  && `Extends the prime to ${longestPrime(betterGs, playerNumber)} consecutive points`],
    [Math.abs(anchorDelta)*3,anchorDelta > 0 && `Establishes a stronger anchor`],
  ]
    .filter(([, msg]) => msg)
    .sort(([a], [b]) => b - a)

  return reasons.length > 0
    ? reasons[0][1]
    : 'Maintains a marginally better overall structure'
}

// ─── Heuristic Implementation (private) ──────────────────────────────────────

function heuristicEval(gs) {
  const blackPips  = totalPips(gs, 1)
  const whitePips  = totalPips(gs, 2)
  const total      = blackPips + whitePips

  // ── 1. Pip advantage (primary driver) ─────────────────────────────────────
  // Normalised to [-1, +1]; positive = Black is ahead
  const pipScore = total > 0 ? (whitePips - blackPips) / total : 0

  // ── 2. Blot exposure ──────────────────────────────────────────────────────
  const blotScore = (countBlots(gs, 2) - countBlots(gs, 1)) * 0.018

  // ── 3. Home-board structure ───────────────────────────────────────────────
  const homeScore = (countHomePoints(gs, 1) - countHomePoints(gs, 2)) * 0.014

  // ── 4. Priming ────────────────────────────────────────────────────────────
  const primeScore = (longestPrime(gs, 1) - longestPrime(gs, 2)) * 0.012

  // ── 5. Anchors ────────────────────────────────────────────────────────────
  const anchorScore = (countAnchors(gs, 1) - countAnchors(gs, 2)) * 0.014

  // ── 6. Bar penalty ────────────────────────────────────────────────────────
  const barBlack = barCount(gs, 1)
  const barWhite = barCount(gs, 2)
  // Being on the bar with opponent's home board closed is very bad
  const blackHomeClosed = countHomePoints(gs, 2)  // White's home points = Black's re-entry obstacles
  const whiteHomeClosed = countHomePoints(gs, 1)
  const barScore = (barWhite * (1 + blackHomeClosed * 0.1) - barBlack * (1 + whiteHomeClosed * 0.1)) * 0.03

  const raw = pipScore * 3.2 + blotScore + homeScore + primeScore + anchorScore + barScore
  return sigmoid(raw)
}

// ─── Position metrics ─────────────────────────────────────────────────────────

/**
 * Total pip count for a player.
 * Black (1) moves toward 24: pip = 25 - pointNumber  (closer to 24 = fewer pips)
 * White (2) moves toward  1: pip = pointNumber        (closer to 1  = fewer pips)
 */
export function totalPips(gs, playerNumber) {
  let pips = 0
  for (const pt of gs.points) {
    const count = pt.pieces.filter(p => p.player_number === playerNumber).length
    if (count === 0) continue
    pips += playerNumber === 1
      ? count * (25 - pt.number)
      : count * pt.number
  }
  // Bar pieces are furthest from home
  pips += barCount(gs, playerNumber) * 25
  return pips
}

/** Checkers currently on the bar for a player */
function barCount(gs, playerNumber) {
  return (gs.bar?.pieces ?? []).filter(p => p.player_number === playerNumber).length
}

/** Points with exactly one piece (vulnerable blots) */
function countBlots(gs, playerNumber) {
  return gs.points.filter(pt => {
    const mine = pt.pieces.filter(p => p.player_number === playerNumber).length
    return mine === 1
  }).length
}

/**
 * Points "made" (owned, i.e. 2+ pieces) in the player's home board.
 * Black home: 19–24   White home: 1–6
 */
function countHomePoints(gs, playerNumber) {
  const [lo, hi] = playerNumber === 1 ? [19, 24] : [1, 6]
  return gs.points.filter(pt => {
    if (pt.number < lo || pt.number > hi) return false
    return pt.pieces.filter(p => p.player_number === playerNumber).length >= 2
  }).length
}

/** Longest run of consecutive points owned by the player (2+ pieces each) */
function longestPrime(gs, playerNumber) {
  const owned = new Set(
    gs.points
      .filter(pt => pt.pieces.filter(p => p.player_number === playerNumber).length >= 2)
      .map(pt => pt.number)
  )
  let best = 0, run = 0
  for (let n = 1; n <= 24; n++) {
    if (owned.has(n)) { run++; best = Math.max(best, run) }
    else run = 0
  }
  return best
}

/**
 * Anchors: points owned (2+ pieces) in the OPPONENT's home board.
 * Black anchors: owned points in 1–6   White anchors: owned points in 19–24
 */
function countAnchors(gs, playerNumber) {
  const [lo, hi] = playerNumber === 1 ? [1, 6] : [19, 24]
  return gs.points.filter(pt => {
    if (pt.number < lo || pt.number > hi) return false
    return pt.pieces.filter(p => p.player_number === playerNumber).length >= 2
  }).length
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function sigmoid(x) {
  // Clamp to avoid floating-point extremes
  const clamped = Math.max(-6, Math.min(6, x))
  return 1 / (1 + Math.exp(-clamped))
}
