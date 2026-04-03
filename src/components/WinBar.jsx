/**
 * WinBar — casino-style win probability display.
 *
 * - Percentage numbers animate like a scoreboard rolling to a new value
 * - Bar transitions slowly (1.2s ease-out) like a balance scale settling
 * - Delta slides in prominently on Submit, holds, then fades
 * - Subtle gold divider at the split point
 * - Faint glow on the leading side when significantly ahead
 */
import { useState, useEffect, useRef } from 'react'

// ─── Animated integer counter ─────────────────────────────────────────────────
function useAnimatedNumber(target, duration = 900) {
  const [display, setDisplay] = useState(target)
  const prevRef    = useRef(target)
  const rafRef     = useRef(null)

  useEffect(() => {
    const start = prevRef.current
    const end   = target
    if (start === end) return

    const startTime = performance.now()
    cancelAnimationFrame(rafRef.current)

    function tick(now) {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic — decelerates like a slot machine stopping
      const eased    = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = end
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}

// ─── Delta pill — slides in, holds, fades ────────────────────────────────────
function DeltaPill({ delta }) {
  const [key, setKey]         = useState(0)
  const [visible, setVisible] = useState(false)
  const [fading, setFading]   = useState(false)
  const timerRef              = useRef(null)

  useEffect(() => {
    if (delta === null || delta === undefined) return

    // Reset animation each time delta changes
    clearTimeout(timerRef.current)
    setKey(k => k + 1)
    setFading(false)
    setVisible(true)

    // Hold for 5s then fade
    timerRef.current = setTimeout(() => {
      setFading(true)
      setTimeout(() => setVisible(false), 600)
    }, 4500)

    return () => clearTimeout(timerRef.current)
  }, [delta])

  if (!visible || delta === null || delta === undefined) return null

  const positive   = delta > 0
  const sign       = positive ? '+' : ''
  const color      = positive ? '#4ade80' : '#f87171'
  const glowColor  = positive ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'

  return (
    <div
      key={key}
      style={{
        display:       'flex',
        alignItems:    'center',
        justifyContent:'center',
        padding:       '0.2rem 0.75rem',
        borderRadius:  999,
        backgroundColor: positive ? 'rgba(5,46,22,0.9)' : 'rgba(69,10,10,0.9)',
        border:        `1px solid ${color}`,
        boxShadow:     `0 0 12px ${glowColor}`,
        opacity:       fading ? 0 : 1,
        transition:    fading ? 'opacity 0.6s ease' : 'none',
        animation:     'deltaSlide 0.4s cubic-bezier(0.34,1.2,0.64,1) forwards',
      }}
    >
      <span style={{
        fontFamily:    'monospace',
        fontSize:      '0.8rem',
        fontWeight:    700,
        letterSpacing: '0.05em',
        color,
      }}>
        {positive ? '▲' : '▼'} {sign}{Math.abs(delta).toFixed(1)}%
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WinBar({ winProb, delta, currentPlayer }) {
  const blackPct = Math.round((winProb ?? 0.5) * 100)
  const whitePct = 100 - blackPct

  const animatedBlack = useAnimatedNumber(blackPct)
  const animatedWhite = 100 - animatedBlack

  // Glow when significantly ahead (>62%)
  const blackLeading = blackPct > 62
  const whiteLeading = whitePct > 62

  return (
    <div className="w-full flex flex-col gap-2" style={{ maxWidth: '56rem' }}>

      {/* ── Score labels ── */}
      <div className="flex justify-between items-center px-0.5">
        {/* Black label */}
        <div className="flex items-center gap-2">
          <div style={{
            width:           8,
            height:          8,
            borderRadius:    '50%',
            backgroundColor: '#1c1c1c',
            border:          '1px solid #555',
            boxShadow:       blackLeading ? '0 0 6px rgba(255,255,255,0.2)' : 'none',
          }} />
          <span style={{
            fontFamily:    'monospace',
            fontSize:      '0.95rem',
            fontWeight:    700,
            letterSpacing: '0.04em',
            color:         blackLeading ? '#f1f5f9' : '#94a3b8',
            transition:    'color 0.6s ease',
          }}>
            BLACK&nbsp;
            <span style={{ color: blackLeading ? '#f1f5f9' : '#e2e8f0', fontSize: '1.1rem' }}>
              {animatedBlack}%
            </span>
          </span>
        </div>

        {/* Delta pill — centered */}
        <DeltaPill delta={delta} />

        {/* White label */}
        <div className="flex items-center gap-2">
          <span style={{
            fontFamily:    'monospace',
            fontSize:      '0.95rem',
            fontWeight:    700,
            letterSpacing: '0.04em',
            color:         whiteLeading ? '#f1f5f9' : '#94a3b8',
            transition:    'color 0.6s ease',
            textAlign:     'right',
          }}>
            <span style={{ color: whiteLeading ? '#f1f5f9' : '#e2e8f0', fontSize: '1.1rem' }}>
              {animatedWhite}%
            </span>
            &nbsp;WHITE
          </span>
          <div style={{
            width:           8,
            height:          8,
            borderRadius:    '50%',
            backgroundColor: '#f0ebe0',
            border:          '1px solid #aaa',
            boxShadow:       whiteLeading ? '0 0 6px rgba(255,255,255,0.4)' : 'none',
          }} />
        </div>
      </div>

      {/* ── Bar ── */}
      <div
        style={{
          position:        'relative',
          width:           '100%',
          height:          '0.55rem',
          borderRadius:    999,
          overflow:        'hidden',
          backgroundColor: '#f0ebe0',   // white side base
          boxShadow:       whiteLeading
            ? 'inset 0 0 8px rgba(255,255,255,0.15)'
            : 'none',
        }}
      >
        {/* Black fill */}
        <div
          style={{
            position:        'absolute',
            left:            0,
            top:             0,
            height:          '100%',
            width:           `${blackPct}%`,
            background:      blackLeading
              ? 'linear-gradient(90deg, #111 60%, #2a2a2a)'
              : '#1c1c1c',
            boxShadow:       blackLeading
              ? 'inset 0 0 8px rgba(255,255,255,0.05)'
              : 'none',
            transition:      'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        {/* Gold divider at the split — the "felt table edge" */}
        {blackPct > 1 && blackPct < 99 && (
          <div
            style={{
              position:        'absolute',
              top:             0,
              bottom:          0,
              left:            `${blackPct}%`,
              width:           2,
              backgroundColor: '#c9a227',
              transform:       'translateX(-50%)',
              boxShadow:       '0 0 4px rgba(201,162,39,0.6)',
              transition:      'left 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes deltaSlide {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
