/**
 * GoodMoveToast — celebratory center-screen toast shown when the player
 * makes the optimal (or near-optimal) move. Auto-dismisses after 2.5s.
 */
import { useEffect, useState, useRef } from 'react'

const MESSAGES = [
  { emoji: '🎯', text: 'Perfect move!' },
  { emoji: '🔥', text: 'On fire!'      },
  { emoji: '⚡', text: 'Nailed it!'    },
  { emoji: '💪', text: 'Great play!'  },
  { emoji: '✨', text: 'Spot on!'      },
  { emoji: '🏆', text: 'Best move!'   },
]

export default function GoodMoveToast({ goodMove, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const msgRef = useRef(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
  const timerRef = useRef(null)

  useEffect(() => {
    if (!goodMove) {
      setVisible(false)
      setLeaving(false)
      return
    }
    // Pick a fresh message each time
    msgRef.current = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
    setLeaving(false)
    setVisible(true)

    // Start fade-out 400ms before dismissing
    timerRef.current = setTimeout(() => {
      setLeaving(true)
      setTimeout(onDismiss, 400)
    }, 2200)

    return () => clearTimeout(timerRef.current)
  }, [goodMove])

  if (!visible || !goodMove) return null

  const { emoji, text } = msgRef.current

  return (
    <div
      onClick={() => { setLeaving(true); setTimeout(onDismiss, 400) }}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          900,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        pointerEvents:   'none',   // don't block clicks through the bg
      }}
    >
      <div
        style={{
          pointerEvents:   'auto',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          gap:             '0.4rem',
          backgroundColor: '#052e16',
          border:          '2px solid #16a34a',
          borderRadius:    20,
          padding:         '1.5rem 2.5rem',
          boxShadow:       '0 0 40px rgba(34,197,94,0.45), 0 8px 32px rgba(0,0,0,0.6)',
          animation:       leaving
            ? 'toastOut 0.4s ease forwards'
            : 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <span style={{ fontSize: '3rem', lineHeight: 1 }}>{emoji}</span>

        <p style={{
          fontFamily:    'Georgia, serif',
          fontSize:      '1.5rem',
          fontWeight:    700,
          color:         '#4ade80',
          letterSpacing: '0.02em',
          margin:        0,
        }}>
          {text}
        </p>

        <p style={{
          fontFamily:    'monospace',
          fontSize:      '0.7rem',
          color:         '#86efac',
          letterSpacing: '0.1em',
          margin:        0,
        }}>
          {goodMove.label} · {goodMove.winPct.toFixed(1)}% win chance
        </p>
      </div>

      <style>{`
        @keyframes toastIn {
          from { transform: scale(0.6) translateY(20px); opacity: 0; }
          to   { transform: scale(1)   translateY(0);    opacity: 1; }
        }
        @keyframes toastOut {
          from { transform: scale(1);   opacity: 1; }
          to   { transform: scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
