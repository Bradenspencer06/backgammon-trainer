/**
 * Engine validation harness — run with Vitest or import for tooling.
 *
 * Usage:
 *   VITE_BGWEB_URL=http://127.0.0.1:8080 npm run validate-engine
 *   VITE_ENGINE_DEBUG=true npm run validate-engine   # raw HTTP I/O (very verbose)
 *
 * Uses exact GNU roll equity (no Monte Carlo) for all candidate scoring.
 */
import jbackgammon from '@mrlhumphreys/jbackgammon'
import { enumerateAllMoves } from '../utils/moveEnumerator.js'
import { selectAiMove } from '../utils/aiPlayer.js'
import { formatEngineSemantics, logEngineDebugSemantics, resetBgwebEvalModuleState } from '../utils/bgwebEval.js'
import { gameStateToBgwebBoard } from '../utils/bgwebBoardCodec.js'
import { VALIDATION_CASES, countCheckers } from './validationPositions.js'
import { evalBlackWinExactWithSource } from './evalExact.js'

const { Match } = jbackgammon

function formatMoves(moves) {
  if (!moves?.length) return '(none)'
  return moves.map(m => `${m.from}→${m.to}`).join(', ')
}

function summarizeBoard(gs) {
  const occ = []
  for (const pt of gs.points ?? []) {
    const b = pt.pieces.filter(p => p.player_number === 1).length
    const w = pt.pieces.filter(p => p.player_number === 2).length
    if (b > 0) occ.push(`${pt.number}: ${b}b`)
    if (w > 0) occ.push(`${pt.number}: ${w}w`)
  }
  const bb = (gs.bar?.pieces ?? []).filter(p => p.player_number === 1).length
  const bw = (gs.bar?.pieces ?? []).filter(p => p.player_number === 2).length
  const ob = (gs.off_board?.pieces ?? []).filter(p => p.player_number === 1).length
  const ow = (gs.off_board?.pieces ?? []).filter(p => p.player_number === 2).length
  if (bb || bw) occ.push(`bar: ${bb}b/${bw}w`)
  if (ob || ow) occ.push(`off: ${ob}b/${ow}w`)
  return occ.join(' | ')
}

/**
 * @param {object} [opts]
 * @param {(s:string)=>void} [opts.log]
 */
export async function runEngineValidation(opts = {}) {
  const log = opts.log ?? ((s) => { console.warn(s) })

  resetBgwebEvalModuleState()

  log('\n════════ Engine validation harness (exact GNU per candidate) ════════\n')
  log('All win rates: BLACK’s cubeless probability (0–1) unless noted.')
  log('If gnu-bgweb never appears, you are on heuristic fallback — fix URL/Docker first.\n')

  let caseIndex = 0

  for (const testcase of VALIDATION_CASES) {
    const snaps = testcase.snapshots ?? [testcase.snapshot]

    for (let si = 0; si < snaps.length; si++) {
      caseIndex++
      const snapBody = snaps[si]
      const variant = snaps.length > 1 ? ` [variant ${si + 1}/${snaps.length}]` : ''

      const label = `${caseIndex}. ${testcase.id}${variant}`
      log(`\n── ${label} ──`)
      log(`Qualitative: ${testcase.qualitative}`)

      let match
      try {
        match = new Match({ ...snapBody, move_list: [] })
      } catch (e) {
        log(`  ERROR: Match constructor failed: ${e}`)
        continue
      }

      const gs = match.asJson.game_state
      const { b, w } = countCheckers(gs)
      if (b !== 15 || w !== 15) {
        log(`  ERROR: Checker count Black=${b} White=${w} (expected 15/15)`)
        continue
      }

      log(`  Board: ${summarizeBoard(gs)}`)
      log(`  Side to move: ${gs.current_player_number} (${gs.current_player_number === 1 ? 'Black' : 'White'})`)
      log(`  Phase: ${gs.current_phase}`)
      log(`  Raw dice objects: ${JSON.stringify(gs.dice)}`)

      log(formatEngineSemantics(gs, label).join('\n'))
      logEngineDebugSemantics(gs, label)

      const { blackWinProb: posProb, source: posSrc } = await evalBlackWinExactWithSource(gs)
      log(`  Position Black win %: ${(posProb * 100).toFixed(2)}%  [${posSrc}]`)
      log(`  bgweb board: ${JSON.stringify(gameStateToBgwebBoard(gs))}`)

      if (gs.current_phase !== 'move') {
        log(`  Candidate moves: N/A (roll phase)`)
        continue
      }

      const candidates = enumerateAllMoves(match.asJson)
      log(`  Legal distinct outcomes: ${candidates.length}`)

      if (candidates.length === 0) {
        log('  WARNING: move phase but zero candidates — illegal or stuck state')
        continue
      }

      const scored = []
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i]
        const r = await evalBlackWinExactWithSource(c.gameState)
        scored.push({
          ...c,
          evalProb: r.blackWinProb,
          evalSource: r.source,
        })
      }

      const player = gs.current_player_number
      const sorted = [...scored].sort((a, b) =>
        player === 1 ? b.evalProb - a.evalProb : a.evalProb - b.evalProb
      )

      const heuristicUsed = scored.some(s => s.evalSource !== 'gnu-bgweb')
      const appChoice = selectAiMove(scored, 'expert', player)
      const top3 = sorted.slice(0, 3).map((c, i) => ({
        rank: i + 1,
        moves: formatMoves(c.moves),
        blackWinPct: (c.evalProb * 100).toFixed(2) + '%',
        source: c.evalSource,
      }))

      log(`  Uses heuristic for any candidate: ${heuristicUsed ? 'YES (investigate Docker/URL)' : 'no'}`)
      log(`  App expert pick: ${formatMoves(appChoice?.moves)}  Black win afterward: ${(appChoice.evalProb * 100).toFixed(2)}% [${appChoice.evalSource}]`)
      log(`  Top 3 candidates:\n${top3.map(t => `    #${t.rank}  ${t.moves}  equity=${t.blackWinPct}  ${t.source}`).join('\n')}`)
    }
  }

  log(`
═══ Interpretation (where wrong moves usually come from) ═══
• engine integration bug: gnubg reachable but impossible / illegal plays or status errors — check raw DEBUG bodies.
• board encoding bug: heuristic OK but GNU absurd, or x/o counts mirrored — compare bgweb board JSON to a known GNU position.
• perspective bug: numbers look sane but flipped when side to move is White — Black win % should drop when White improves.
• sampling shortcut: harness uses NO MC; if UI still differs, app paths still use VITE_* MC elsewhere.
• fallback heuristic: any candidate [heuristic-fallback] — not comparable to GNU; start bgweb-api.
• explanation layer only: coach text wrong but ranked moves match GNU — see explainDifference() heuristics, not bgweb.
`)
}
