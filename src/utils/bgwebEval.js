/**
 * Strong cubeless evaluations via GNU Backgammon (same engine as bgweb-api).
 *
 * How to turn this on (plain English):
 * 1. Install Docker if you don’t have it.
 * 2. In a terminal, run:
 *      docker run --rm -p 8080:8080 foochu/bgweb-api:latest
 *    Leave that running. It is a small local server that answers “what’s the
 *    best play and exact win chances?” using GNU BG.
 * 3. Run this app with `npm run dev` (or `vite preview` on localhost). Vite
 *    forwards `/bgweb-api` to that server.
 *
 * Optional env: `VITE_BGWEB_CONCURRENCY` — max parallel requests (default 12).
 * AI: `VITE_AI_ROLL_SAMPLES`. Coaching / post-turn display: `VITE_POST_TURN_ROLL_SAMPLES` (default 6, or `full`).
 * Coaching then re-ranks the top `VITE_COACHING_REFINE_TOP` lines (default 12) with exact roll equity.
 * `VITE_AI_RANKING_HEURISTIC=true` = instant weak AI.
 *
 * If that server is not running, the app quietly falls back to the old
 * rough guesser so it still works — it just won’t be tournament-accurate.
 *
 * Temporary correctness debugging: set `VITE_ENGINE_DEBUG=true` to log unambiguous
 * semantics plus every getmoves request/response body (very noisy).
 */

import { gameStateToBgwebBoard } from './bgwebBoardCodec.js'

export { gameStateToBgwebBoard }

const ENGINE_DEBUG = import.meta.env.VITE_ENGINE_DEBUG === 'true'

/** All 36 equally likely rolls: 6 doubles @ weight 1/36, 15 pairs @ weight 2/36 */
function allDiceWeights() {
  const out = []
  for (let d = 1; d <= 6; d++) out.push({ dice: [d, d], w: 1 / 36 })
  for (let a = 1; a <= 6; a++) {
    for (let b = a + 1; b <= 6; b++) {
      out.push({ dice: [b, a], w: 2 / 36 })
    }
  }
  return out
}

const DICE_WEIGHTS = allDiceWeights()

let warnedNoBgweb = false
/** Set after the first successful bgweb response (used for dev confirmation logs). */
let confirmedBgweb = false

/** Cap parallel HTTP calls so the AI turn does not open hundreds at once (browser + Docker stall). */
const MAX_CONCURRENT_REQUESTS = Number(import.meta.env.VITE_BGWEB_CONCURRENCY) || 12
let activeRequests = 0
const requestWaitQueue = []

function acquireRequestSlot() {
  return new Promise((resolve) => {
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      activeRequests++
      resolve()
    } else {
      requestWaitQueue.push(resolve)
    }
  })
}

function releaseRequestSlot() {
  if (requestWaitQueue.length > 0) {
    const next = requestWaitQueue.shift()
    next()
  } else {
    activeRequests--
  }
}

function endpointUrl() {
  const configured = import.meta.env.VITE_BGWEB_URL
  if (configured)
    return `${String(configured).replace(/\/$/, '')}/api/v1/getmoves`
  if (import.meta.env.DEV) return '/bgweb-api/api/v1/getmoves'
  // `vite preview` is "production" but still proxies /bgweb-api on localhost
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') return '/bgweb-api/api/v1/getmoves'
  }
  return null
}

function moverWinProbFromResponse(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  const win = data[0]?.evaluation?.probability?.win
  return typeof win === 'number' && !Number.isNaN(win) ? win : null
}

/**
 * @param {object} body — MoveArgs JSON for bgweb-api
 * @returns {Promise<number|null>} mover’s win probability after best play, or null on failure
 */
async function postGetMoves(body) {
  const url = endpointUrl()
  if (!url) return null

  const reqJson = JSON.stringify(body)

  await acquireRequestSlot()
  try {
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: reqJson,
      })
    } catch (err) {
      if (ENGINE_DEBUG) console.warn('[ENGINE_DEBUG] postGetMoves network error:', err)
      return null
    }

    const responseText = await res.text()
    if (ENGINE_DEBUG) {
      console.warn('[ENGINE_DEBUG] ─── bgweb getmoves ───')
      console.warn('[ENGINE_DEBUG] request URL:', url)
      console.warn('[ENGINE_DEBUG] raw request JSON:', reqJson)
      console.warn('[ENGINE_DEBUG] HTTP status:', res.status, res.statusText)
      console.warn('[ENGINE_DEBUG] raw response body:', responseText)
    }

    if (!res.ok) return null
    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      return null
    }
    return moverWinProbFromResponse(data)
  } finally {
    releaseRequestSlot()
  }
}

function playerArg(gs) {
  return gs.current_player_number === 1 ? 'o' : 'x'
}

export function resetBgwebEvalModuleState() {
  warnedNoBgweb = false
  confirmedBgweb = false
}

/**
 * Human-readable semantics for a game_state (not secrets — safe for logs).
 * Win % elsewhere in the app is always BLACK’s cubeless probability unless noted.
 */
export function formatEngineSemantics(gs, label = 'game_state') {
  const p = gs.current_player_number
  const phase = gs.current_phase
  const rawDice = (gs.dice ?? []).map((d, i) => ({ slot: i, number: d.number, used: !!d.used }))
  const pair = activeDicePair(gs)
  const board = gameStateToBgwebBoard(gs)
  const barB = (gs.bar?.pieces ?? []).filter(x => x.player_number === 1).length
  const barW = (gs.bar?.pieces ?? []).filter(x => x.player_number === 2).length
  const offB = (gs.off_board?.pieces ?? []).filter(x => x.player_number === 1).length
  const offW = (gs.off_board?.pieces ?? []).filter(x => x.player_number === 2).length

  return [
    `[ENGINE_SEM] ═══ ${label} ═══`,
    `  Side to move: player_number=${p} (${p === 1 ? 'Black' : 'White'}) — Black moves 1 → 24 and bears off; White moves 24 → 1.`,
    `  GNU/bgweb player arg will be: "${p === 1 ? 'o' : 'x'}"  (o=black, x=white).`,
    `  Phase: ${phase}`,
    `    • MOVE phase: equity = GNU evaluation of THIS dice position (one getmoves with fixed dice, best play).`,
    `    • ROLL phase: equity = weighted average of getmoves over all 21 unique dice outcomes (no MC unless rollMonteCarloSamples>0).`,
    `  Dice in JSON (order as stored): ${JSON.stringify(rawDice)}`,
    pair
      ? `  Dice sent to bgweb for move phase: [high, low] = [${pair[0]}, ${pair[1]}] (doubles: two equal values).`
      : `  (No active unused dice pair — roll phase or dice not set.)`,
    `  Bar checkers: Black=${barB} White=${barW} — legal source for a move is point "bar" (from=0 in our enumerator).`,
    `  Borne off: Black=${offB} White=${offW} — bear-off destination is point "off_board" (to string in enumerator).`,
    `  bgweb board payload (points 1–24 as strings, bar key if needed):`,
    `    x (White): ${JSON.stringify(board.x)}`,
    `    o (Black): ${JSON.stringify(board.o)}`,
  ]
}

/** When `VITE_ENGINE_DEBUG=true`, also logs this before every evaluatePositionBgweb call. */
export function logEngineDebugSemantics(gs, label = 'game_state') {
  if (!ENGINE_DEBUG) return
  console.warn(formatEngineSemantics(gs, label).join('\n'))
}

/** Active dice as [high, low] for the bgweb API (matches their examples). */
function activeDicePair(gs) {
  const nums = (gs.dice ?? []).filter((d) => d.number != null && !d.used).map((d) => d.number)
  if (nums.length < 2) return null
  const [a, b] = nums.length === 2 ? nums : [nums[0], nums[1]]
  return a >= b ? [a, b] : [b, a]
}

function moverToBlackWinProb(gs, moverWin) {
  return gs.current_player_number === 1 ? moverWin : 1 - moverWin
}

/** One equiprobable roll out of 36 (same weights as `DICE_WEIGHTS`). */
function sampleDiceRoll36() {
  const u = Math.random()
  let acc = 0
  for (const { dice, w } of DICE_WEIGHTS) {
    acc += w
    if (u <= acc) return dice
  }
  return DICE_WEIGHTS[DICE_WEIGHTS.length - 1].dice
}

/** Unbiased estimate of roll-phase equity; ~`samples` HTTP calls instead of 21. */
async function evaluateRollPhaseMonteCarlo(gs, samples) {
  const board = gameStateToBgwebBoard(gs)
  const player = playerArg(gs)
  const n = Math.max(1, Math.min(samples, 36))

  const moverWins = await Promise.all(
    Array.from({ length: n }, () => {
      const dice = sampleDiceRoll36()
      return postGetMoves({
        board,
        dice,
        player,
        'max-moves': 1,
        'score-moves': true,
        cubeful: false,
      })
    })
  )

  if (moverWins.some((m) => m == null)) return null
  let sum = 0
  for (const mw of moverWins) sum += moverToBlackWinProb(gs, mw)
  return sum / n
}

async function evaluateRollPhaseBlackWin(gs) {
  const board = gameStateToBgwebBoard(gs)
  const player = playerArg(gs)

  const parts = await Promise.all(
    DICE_WEIGHTS.map(async ({ dice, w }) => {
      const body = {
        board,
        dice,
        player,
        'max-moves': 1,
        'score-moves': true,
        cubeful: false,
      }
      const moverWin = await postGetMoves(body)
      if (moverWin == null) return null
      return w * moverToBlackWinProb(gs, moverWin)
    })
  )

  if (parts.some((p) => p === null)) return null
  return parts.reduce((a, b) => a + b, 0)
}

async function evaluateMovePhaseBlackWin(gs) {
  const pair = activeDicePair(gs)
  if (!pair) return null

  const body = {
    board: gameStateToBgwebBoard(gs),
    dice: pair,
    player: playerArg(gs),
    'max-moves': 1,
    'score-moves': true,
    cubeful: false,
  }
  const moverWin = await postGetMoves(body)
  if (moverWin == null) return null
  return moverToBlackWinProb(gs, moverWin)
}

/**
 * @param {object} gameStateJson
 * @param {object} [options]
 * @param {number} [options.rollMonteCarloSamples] — if >0 and phase is `roll`, estimate equity with this many random dice (faster, slightly noisy)
 * @returns {Promise<number|null>} Black’s cubeless win probability, or null if bgweb unavailable
 */
export async function evaluatePositionBgweb(gameStateJson, options = {}) {
  const url = endpointUrl()
  if (!url) return null

  if (ENGINE_DEBUG) {
    logEngineDebugSemantics(gameStateJson, 'evaluatePositionBgweb entry')
    const mc = options.rollMonteCarloSamples
    console.warn(
      `[ENGINE_DEBUG] rollMonteCarloSamples option: ${
        typeof mc === 'number' && mc > 0 ? `${mc} (MONTE CARLO roll phase — NOT exact 36-roll)` : 'unset/0 → exact 21-outcome roll average when phase is roll'
      }`
    )
  }

  const phase = gameStateJson.current_phase
  const mc = options.rollMonteCarloSamples
  let p = null
  if (phase === 'move') p = await evaluateMovePhaseBlackWin(gameStateJson)
  else if (phase === 'roll') {
    if (typeof mc === 'number' && mc > 0)
      p = await evaluateRollPhaseMonteCarlo(gameStateJson, mc)
    else p = await evaluateRollPhaseBlackWin(gameStateJson)
  }

  if (p != null && !confirmedBgweb) {
    confirmedBgweb = true
    console.info(
      '[backgammon-trainer] Evaluations use GNU Backgammon via bgweb-api (not the heuristic fallback).'
    )
  }

  if (p == null && !warnedNoBgweb) {
    warnedNoBgweb = true
    console.warn(
      '[backgammon-trainer] GNU evaluation server not reachable — using fallback heuristic. Run: docker run --rm -p 8080:8080 foochu/bgweb-api:latest'
    )
  }
  return p
}
