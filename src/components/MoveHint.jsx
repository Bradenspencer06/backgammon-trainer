import { useState } from 'react'
import MiniBoardDemo from './MiniBoardDemo'

/**
 * MoveHint — lightbulb icon that appears only when the player made a suboptimal move.
 * Clicking it expands a panel showing:
 *   - Best move notation (e.g. "13→7, 8→5")
 *   - Win% comparison (Your move: 52% → Best move: 56%)
 *   - One-sentence explanation
 *
 * Props:
 *   bestMoves    — array of {from, to} for the best move sequence
 *   playerWinPct — win% after the player's actual move (0–100)
 *   bestWinPct   — win% for the best available move (0–100)
 *   explanation  — string from explainDifference()
 *   currentPlayer — 1 or 2 (to orient win% labeling)
 */
export default function MoveHint({ bestMoves, playerWinPct, bestWinPct, explanation, playerWhoMoved, beforeGameState, afterGameState }) {
  const [open, setOpen] = useState(false)

  if (!bestMoves || bestMoves.length === 0) return null

  const moveStr = bestMoves
    .map(({ from, to }) => {
      const f = from === 0 ? 'Bar' : String(from)
      const t = to === 25 ? 'Off' : String(to)
      return `${f}→${t}`
    })
    .join(', ')

  // Label win% from the perspective of the player who just moved
  const label = playerWhoMoved === 1 ? 'Black' : 'White'
  const playerPct = playerWhoMoved === 1 ? playerWinPct : 100 - playerWinPct
  const bestPct   = playerWhoMoved === 1 ? bestWinPct   : 100 - bestWinPct

  return (
    <div className="flex flex-col items-end" style={{ maxWidth: '56rem', width: '100%' }}>
      {/* Lightbulb trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        title="A better move was available"
        className="flex items-center gap-1 rounded-lg px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide"
        style={{
          backgroundColor: open ? '#78350f' : '#451a03',
          color: '#fbbf24',
          border: '1px solid #92400e',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'background-color 0.15s',
        }}
      >
        <span style={{ fontSize: '1rem' }}>💡</span>
        Better move available
      </button>

      {/* Expandable panel */}
      {open && (
        <div
          className="mt-2 rounded-xl p-4 font-mono text-xs flex flex-col gap-2 w-full"
          style={{
            backgroundColor: '#1c1917',
            border: '1px solid #44403c',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {/* Win% comparison */}
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ color: '#9ca3af' }}>Your move:</span>
            <span style={{ color: '#f87171', fontWeight: 700 }}>{label} {playerPct.toFixed(1)}%</span>
            <span style={{ color: '#6b7280' }}>→</span>
            <span style={{ color: '#9ca3af' }}>Best move:</span>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>{label} {bestPct.toFixed(1)}%</span>
          </div>

          {/* Plain English explanation */}
          {explanation && (
            <div style={{ color: '#d1d5db', lineHeight: '1.5', borderTop: '1px solid #292524', paddingTop: '0.5rem' }}>
              {explanation}
            </div>
          )}

          {/* Animated mini board showing the best move */}
          {beforeGameState && afterGameState && (
            <div style={{ borderTop: '1px solid #292524', paddingTop: '0.75rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.65rem', marginBottom: '0.5rem', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                WHAT YOU SHOULD HAVE DONE:
              </p>
              <MiniBoardDemo
                beforeState={beforeGameState}
                afterState={afterGameState}
                bestMoves={bestMoves}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
