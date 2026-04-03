/**
 * MoveHint — the 💡 trigger button that opens the CoachPopup.
 * Rendered below the board when the player made a suboptimal move.
 */
import { useState } from 'react'
import CoachPopup from './CoachPopup'

export default function MoveHint({
  bestMoves,
  playerWinPct,
  bestWinPct,
  explanation,
  playerWhoMoved,
  beforeGameState,
  afterGameState,
}) {
  const [open, setOpen] = useState(false)

  if (!bestMoves || bestMoves.length === 0) return null

  return (
    <>
      {/* Trigger button */}
      <div className="flex flex-col items-center" style={{ maxWidth: '56rem', width: '100%' }}>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl font-mono font-bold uppercase tracking-wide"
          style={{
            padding:         '0.6rem 1.25rem',
            backgroundColor: '#451a03',
            color:           '#fbbf24',
            border:          '1px solid #92400e',
            boxShadow:       '0 0 16px rgba(251,191,36,0.25), 0 2px 8px rgba(0,0,0,0.4)',
            fontSize:        '0.75rem',
            letterSpacing:   '0.12em',
            animation:       'hintPulse 2s ease-in-out infinite',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>💡</span>
          Coach tip available — tap to see
        </button>
      </div>

      {/* Full-screen coaching popup */}
      <CoachPopup
        open={open}
        onClose={() => setOpen(false)}
        bestMoves={bestMoves}
        playerWinPct={playerWinPct}
        bestWinPct={bestWinPct}
        explanation={explanation}
        playerWhoMoved={playerWhoMoved}
        beforeGameState={beforeGameState}
        afterGameState={afterGameState}
      />

      <style>{`
        @keyframes hintPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(251,191,36,0.25), 0 2px 8px rgba(0,0,0,0.4); }
          50%       { box-shadow: 0 0 28px rgba(251,191,36,0.55), 0 2px 8px rgba(0,0,0,0.4); }
        }
      `}</style>
    </>
  )
}
