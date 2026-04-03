/**
 * CoachPopup — full-screen coaching overlay shown after a suboptimal move.
 *
 * Slides up from the bottom, covers the full screen.
 * Tap the X or anywhere outside the card to dismiss.
 */
import { useEffect } from 'react'
import MiniBoardDemo from './MiniBoardDemo'

export default function CoachPopup({
  open,
  onClose,
  bestMoves,
  playerWinPct,
  bestWinPct,
  explanation,
  playerWhoMoved,
  beforeGameState,
  afterGameState,
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !bestMoves?.length) return null

  const label     = playerWhoMoved === 1 ? 'Black' : 'White'
  const playerPct = playerWhoMoved === 1 ? playerWinPct       : 100 - playerWinPct
  const bestPct   = playerWhoMoved === 1 ? bestWinPct         : 100 - bestWinPct
  const pctGap    = (bestPct - playerPct).toFixed(1)

  const moveStr = bestMoves
    .map(({ from, to }) => {
      const f = from === 0 ? 'Bar' : String(from)
      const t = to === 25  ? 'Off' : String(to)
      return `${f} → ${t}`
    })
    .join('   ·   ')

  return (
    /* Backdrop — tap outside card to close */
    <div
      onClick={onClose}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          1000,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display:         'flex',
        alignItems:      'flex-end',       // card slides up from bottom
        justifyContent:  'center',
        padding:         '0',
        // Slide-up animation via CSS
        animation:       'coachFadeIn 0.25s ease',
      }}
    >
      <style>{`
        @keyframes coachFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes coachSlideUp {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Card — stops click propagation so tapping inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:           '100%',
          maxWidth:        '520px',
          maxHeight:       '92vh',
          overflowY:       'auto',
          backgroundColor: '#111827',
          borderRadius:    '20px 20px 0 0',
          padding:         '1.5rem 1.25rem 2rem',
          display:         'flex',
          flexDirection:   'column',
          gap:             '1rem',
          animation:       'coachSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow:       '0 -8px 40px rgba(0,0,0,0.6)',
          border:          '1px solid #1f2937',
          borderBottom:    'none',
        }}
      >
        {/* ── Header row ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>💡</span>
            <div>
              <p style={{
                fontFamily:    'monospace',
                fontSize:      '0.7rem',
                fontWeight:    700,
                letterSpacing: '0.15em',
                color:         '#fbbf24',
                textTransform: 'uppercase',
              }}>
                Coach Tip
              </p>
              <p style={{
                fontFamily: 'monospace',
                fontSize:   '0.65rem',
                color:      '#6b7280',
                marginTop:  '0.1rem',
              }}>
                A better move was available
              </p>
            </div>
          </div>

          {/* X close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width:           '2rem',
              height:          '2rem',
              borderRadius:    '50%',
              backgroundColor: '#1f2937',
              border:          '1px solid #374151',
              color:           '#9ca3af',
              fontSize:        '1rem',
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Win% comparison ── */}
        <div
          style={{
            backgroundColor: '#1f2937',
            borderRadius:    12,
            padding:         '0.85rem 1rem',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            gap:             '0.5rem',
            flexWrap:        'wrap',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
              YOUR MOVE
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#f87171' }}>
              {playerPct.toFixed(1)}%
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#6b7280' }}>{label} win chance</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ color: '#374151', fontSize: '1.2rem' }}>→</span>
            <span style={{
              fontFamily:    'monospace',
              fontSize:      '0.6rem',
              fontWeight:    700,
              color:         '#ef4444',
              letterSpacing: '0.05em',
            }}>
              -{pctGap}%
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
              BEST MOVE
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>
              {bestPct.toFixed(1)}%
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#6b7280' }}>{label} win chance</p>
          </div>
        </div>

        {/* ── Best move notation ── */}
        <div style={{
          backgroundColor: '#1a1a2e',
          borderRadius:    10,
          padding:         '0.65rem 1rem',
          border:          '1px solid #2d2d4e',
        }}>
          <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
            BEST MOVE
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa' }}>
            {moveStr}
          </p>
        </div>

        {/* ── Plain-English explanation ── */}
        {explanation && (
          <p style={{
            fontFamily:  'Georgia, serif',
            fontSize:    '0.9rem',
            color:       '#d1d5db',
            lineHeight:  1.6,
            fontStyle:   'italic',
          }}>
            "{explanation}"
          </p>
        )}

        {/* ── Animated mini board ── */}
        {beforeGameState && afterGameState && (
          <div>
            <p style={{
              fontFamily:    'monospace',
              fontSize:      '0.6rem',
              color:         '#6b7280',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom:  '0.5rem',
            }}>
              Watch the best move:
            </p>
            <MiniBoardDemo
              beforeState={beforeGameState}
              afterState={afterGameState}
              bestMoves={bestMoves}
            />
          </div>
        )}

        {/* ── Got it button ── */}
        <button
          onClick={onClose}
          style={{
            marginTop:     '0.25rem',
            width:         '100%',
            padding:       '0.75rem',
            borderRadius:  12,
            backgroundColor: '#1a5c38',
            color:         '#f0ebe0',
            border:        '1px solid #2d8a55',
            fontFamily:    'monospace',
            fontSize:      '0.8rem',
            fontWeight:    700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor:        'pointer',
            boxShadow:     '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          Got it — keep playing
        </button>
      </div>
    </div>
  )
}
