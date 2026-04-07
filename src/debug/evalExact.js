/**
 * Exact GNU (or fallback) probe for validation — no Monte Carlo shortcuts.
 */
import { evaluatePositionBgweb, resetBgwebEvalModuleState } from '../utils/bgwebEval.js'
import { evaluatePositionHeuristic } from '../utils/evaluator.js'

export { resetBgwebEvalModuleState }

/** Full bgweb roll average in roll phase; single rollout in move phase (options {}). */
export async function evalBlackWinExactWithSource(gs) {
  const gnu = await evaluatePositionBgweb(gs, {})
  if (gnu != null) return { blackWinProb: gnu, source: 'gnu-bgweb' }
  return { blackWinProb: evaluatePositionHeuristic(gs), source: 'heuristic-fallback' }
}
