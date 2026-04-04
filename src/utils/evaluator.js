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

  const pipDelta    = sign * (totalPips(betterGs, 2) - totalPips(worseGs, 2)
                            - totalPips(betterGs, 1) + totalPips(worseGs, 1))
  const blotDelta   = sign * (countBlots(worseGs, playerNumber) - countBlots(betterGs, playerNumber))
  const shotDelta   = sign * (countDirectShots(worseGs, playerNumber) - countDirectShots(betterGs, playerNumber))
  const homeDelta   = sign * (countHomePoints(betterGs, playerNumber) - countHomePoints(worseGs, playerNumber))
  const primeDelta  = sign * (longestPrime(betterGs, playerNumber) - longestPrime(worseGs, playerNumber))
  const anchorDelta = sign * (countAnchors(betterGs, playerNumber) - countAnchors(worseGs, playerNumber))

  // In a race/bear-off, structural concepts don't apply — just talk pip count
  if (isRacePosition(worseGs) || isBearOffPosition(worseGs)) {
    if (pipDelta > 0) return `Moves your pieces further along — in a pure race, every pip counts`
    return `Gets your pieces home faster — efficiency is everything in the bear-off`
  }

  // Return the most significant reason — written for beginners, no jargon
  const reasons = [
    [Math.abs(shotDelta)*5,  shotDelta > 0  && `Your piece was left wide open — your opponent had an easy shot to knock it off the board`],
    [Math.abs(blotDelta)*3,  blotDelta > 0  && `Keeps your pieces safer — fewer lone pieces that your opponent can knock off`],
    [Math.abs(pipDelta),     pipDelta > 0   && `Moves your pieces further ahead — every step closer to home counts`],
    [Math.abs(homeDelta)*2,  homeDelta > 0  && `Locks down a point in your home board, making it harder for your opponent to come back in`],
    [Math.abs(primeDelta)*4, primeDelta > 0 && `Builds a longer wall of points, making it very hard for your opponent's pieces to get past`],
    [Math.abs(anchorDelta)*3,anchorDelta > 0 && `Holds a strong defensive position deep in your opponent's home board`],
  ]
    .filter(([, msg]) => msg)
    .sort(([a], [b]) => b - a)

  return reasons.length > 0
    ? reasons[0][1]
    : 'Builds a slightly stronger overall position'
}

// ─── Heuristic Implementation (private) ──────────────────────────────────────

function heuristicEval(gs) {
  const blackPips  = totalPips(gs, 1)
  const whitePips  = totalPips(gs, 2)
  const total      = blackPips + whitePips

  // ── 1. Pip advantage (primary driver) ─────────────────────────────────────
  // Normalised to [-1, +1]; positive = Black is ahead
  const pipScore = total > 0 ? (whitePips - blackPips) / total : 0

  // ── Detect race / contact situation ───────────────────────────────────────
  const isRace    = isRacePosition(gs)
  const isBearOff = isBearOffPosition(gs)

  // In pure race / late bear-off, only pip count matters — no structural play
  if (isBearOff) {
    // Scale aggressively so a 2:1 pip advantage reaches ~99%
    return sigmoid(pipScore * 7.0)
  }
  if (isRace) {
    return sigmoid(pipScore * 5.0)
  }

  // ── 2. Direct shots — most critical danger signal ─────────────────────────
  const shotScore = (countDirectShots(gs, 2) - countDirectShots(gs, 1)) * 0.055

  // ── 3. Raw blot count (secondary — proximity-unaware) ─────────────────────
  const blotScore = (countBlots(gs, 2) - countBlots(gs, 1)) * 0.025

  // ── 4. Home-board structure ───────────────────────────────────────────────
  const homeScore = (countHomePoints(gs, 1) - countHomePoints(gs, 2)) * 0.018

  // ── 5. Priming ────────────────────────────────────────────────────────────
  const primeScore = (longestPrime(gs, 1) - longestPrime(gs, 2)) * 0.016

  // ── 6. Anchors ────────────────────────────────────────────────────────────
  const anchorScore = (countAnchors(gs, 1) - countAnchors(gs, 2)) * 0.018

  // ── 7. Bar penalty ────────────────────────────────────────────────────────
  const barBlack = barCount(gs, 1)
  const barWhite = barCount(gs, 2)
  const blackHomeClosed = countHomePoints(gs, 2)
  const whiteHomeClosed = countHomePoints(gs, 1)
  const barScore = (barWhite * (1 + blackHomeClosed * 0.1) - barBlack * (1 + whiteHomeClosed * 0.1)) * 0.04

  const raw = pipScore * 3.2 + shotScore + blotScore + homeScore + primeScore + anchorScore + barScore
  return sigmoid(raw)
}

// ─── Race / contact detection ─────────────────────────────────────────────────

/**
 * A "pure race" means the two sides have passed each other — no further hitting
 * is possible. Neither player has pieces in the other's home board, and neither
 * has pieces on the bar.
 *
 * Black home: 19–24   White home: 1–6
 */
function isRacePosition(gs) {
  if (barCount(gs, 1) > 0 || barCount(gs, 2) > 0) return false
  const blackInWhiteHome = gs.points
    .filter(pt => pt.number >= 1 && pt.number <= 6)
    .some(pt => pt.pieces.some(p => p.player_number === 1))
  const whiteInBlackHome = gs.points
    .filter(pt => pt.number >= 19 && pt.number <= 24)
    .some(pt => pt.pieces.some(p => p.player_number === 2))
  return !blackInWhiteHome && !whiteInBlackHome
}

/**
 * A "bear-off position" means both players have all remaining pieces in their
 * own home board (or already borne off). Pure pip race with no crossover risk.
 *
 * Black home: 19–24   White home: 1–6
 */
function isBearOffPosition(gs) {
  if (!isRacePosition(gs)) return false
  const blackOutsideHome = gs.points
    .filter(pt => pt.number < 19)
    .some(pt => pt.pieces.some(p => p.player_number === 1))
  const whiteOutsideHome = gs.points
    .filter(pt => pt.number > 6)
    .some(pt => pt.pieces.some(p => p.player_number === 2))
  return !blackOutsideHome && !whiteOutsideHome
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
 * Count how many opponent pieces have a direct shot on any of the player's blots.
 *
 * A "direct shot" means the opponent piece is exactly 1–6 pips away IN THE
 * DIRECTION IT MOVES and can land on an unprotected blot in one move.
 *
 * White (2) moves 24→1, so a white piece at point W threatens a black blot at
 * point B when W > B and (W - B) is 1–6.
 *
 * Black (1) moves 1→24, so a black piece at point B threatens a white blot at
 * point W when B < W and (W - B) is 1–6.
 *
 * Each piece on a threatening point counts individually (2 pieces = 2 shots).
 * Bar pieces are ignored (they must enter in the home board first).
 */
function countDirectShots(gs, playerNumber) {
  const opponent = playerNumber === 1 ? 2 : 1

  // Blots belonging to playerNumber
  const blots = gs.points
    .filter(pt => pt.pieces.filter(p => p.player_number === playerNumber).length === 1)
    .map(pt => pt.number)

  if (blots.length === 0) return 0

  // Opponent pieces on the board (not bar)
  const oppPieces = gs.points.map(pt => ({
    number: pt.number,
    count:  pt.pieces.filter(p => p.player_number === opponent).length,
  })).filter(p => p.count > 0)

  let shots = 0
  for (const blot of blots) {
    for (const opp of oppPieces) {
      // Distance in the direction the opponent moves
      const dist = opponent === 2
        ? opp.number - blot   // White moves downward: must be above the blot
        : blot - opp.number   // Black moves upward:   must be below the blot
      if (dist >= 1 && dist <= 6) {
        shots += opp.count
      }
    }
  }
  return shots
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
