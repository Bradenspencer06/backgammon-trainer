/**
 * WinBar — horizontal probability bar showing Black% vs White%.
 *
 * Props:
 *   winProb      — Black's win probability, 0.0–1.0 (from evaluator)
 *   delta        — change since last move: positive = improved for current player, null = no delta yet
 *   currentPlayer — 1 (Black) or 2 (White), used to orient the delta sign
 */
export default function WinBar({ winProb, delta, currentPlayer }) {
  const blackPct = Math.round((winProb ?? 0.5) * 100)
  const whitePct = 100 - blackPct

  // Format delta from current player's perspective
  let deltaText = null
  let deltaColor = '#9ca3af'
  if (delta !== null && delta !== undefined) {
    // delta > 0 means the current player improved their position
    const sign = delta > 0 ? '↑ +' : '↓ '
    deltaText = `${sign}${Math.abs(delta).toFixed(1)}%`
    deltaColor = delta > 0 ? '#4ade80' : '#f87171'
  }

  return (
    <div className="w-full flex flex-col gap-1" style={{ maxWidth: '56rem' }}>
      {/* Labels */}
      <div className="flex justify-between items-center px-1">
        <span className="font-mono text-xs font-bold" style={{ color: '#e2e8f0' }}>
          BLACK {blackPct}%
        </span>
        {deltaText && (
          <span className="font-mono text-xs font-bold" style={{ color: deltaColor }}>
            {deltaText}
          </span>
        )}
        <span className="font-mono text-xs font-bold" style={{ color: '#e2e8f0' }}>
          WHITE {whitePct}%
        </span>
      </div>

      {/* Bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: '0.5rem', backgroundColor: '#374151' }}
      >
        <div
          style={{
            height: '100%',
            width: `${blackPct}%`,
            backgroundColor: '#1c1c1c',
            borderRight: blackPct > 0 && blackPct < 100 ? '2px solid #6b7280' : 'none',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
