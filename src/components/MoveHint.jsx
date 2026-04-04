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
  onClose,
}) {
  const [open, setOpen]           = useState(false)
  const [gateReleased, setGateReleased] = useState(false)

  if (!bestMoves || bestMoves.length === 0) return null

  // Called when the user dismisses the popup (read it) or skips (X on button)
  function releaseGate() {
    if (!gateReleased) {
      setGateReleased(true)
      onClose?.()
    }
  }

  function handlePopupClose() {
    setOpen(false)
    releaseGate()
  }

  function handleSkip() {
    releaseGate()
  }

  return (
    <>
      {/* ── Coach tip button row ── */}
      <div className="flex items-center justify-center gap-2" style={{ maxWidth: '56rem', width: '100%' }}>
        {/* Main tap-to-open button */}
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
            animation:       gateReleased ? 'none' : 'hintPulse 2s ease-in-out infinite',
            opacity:         gateReleased ? 0.6 : 1,
            cursor:          'pointer',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>💡</span>
          {gateReleased ? 'Review coach tip' : 'Coach tip — tap to see'}
        </button>

        {/* ✕ skip button — only shown while game is paused (gate not yet released) */}
        {!gateReleased && (
          <button
            onClick={handleSkip}
            aria-label="Skip coach tip"
            style={{
              width:           '2rem',
              height:          '2rem',
              borderRadius:    '50%',
              backgroundColor: '#1f2937',
              border:          '1px solid #374151',
              color:           '#6b7280',
              fontSize:        '0.9rem',
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Full-screen coaching popup ── */}
      <CoachPopup
        open={open}
        onClose={handlePopupClose}
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
