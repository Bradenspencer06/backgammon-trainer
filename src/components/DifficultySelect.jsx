/**
 * DifficultySelect — pre-game screen where the player chooses their opponent.
 * Shows win progress pips for each AI level.
 */
import { WINS_TO_PROMOTE } from '../hooks/useWins'

const OPTIONS = [
  { id: '2player',  label: '2 Player', ai: false },
  { id: 'beginner', label: 'Beginner', ai: true  },
  { id: 'medium',   label: 'Medium',   ai: true  },
  { id: 'hard',     label: 'Hard',     ai: true  },
  { id: 'expert',   label: 'Expert',   ai: true  },
]

const NEXT = { beginner: 'medium', medium: 'hard', hard: 'expert' }

export default function DifficultySelect({ onSelect, wins = {} }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-8 min-h-screen p-6"
      style={{ backgroundColor: '#111827' }}
    >
      <div className="flex flex-col items-center gap-1">
        <h1
          className="text-2xl font-bold tracking-widest uppercase select-none"
          style={{ color: '#d1c5b0', fontFamily: 'Georgia, serif' }}
        >
          Backgammon Trainer
        </h1>
        <p className="text-xs font-mono tracking-widest uppercase" style={{ color: '#4b5563' }}>
          Choose your opponent
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: '24rem' }}>
        {OPTIONS.map((opt, i) => {
          const w          = wins[opt.id] ?? 0
          const promoted   = w >= WINS_TO_PROMOTE
          const recommended = opt.ai && NEXT[opt.id] === undefined
            ? false
            : opt.ai && (wins[NEXT[opt.id] === undefined ? opt.id : Object.keys(NEXT).find(k => NEXT[k] === opt.id)] ?? 0) >= WINS_TO_PROMOTE

          // Show "COACH RECOMMENDS" badge if previous tier is complete
          const prevTier   = Object.keys(NEXT).find(k => NEXT[k] === opt.id)
          const coachBadge = prevTier && (wins[prevTier] ?? 0) >= WINS_TO_PROMOTE

          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              style={{
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'flex-start',
                gap:             '0.5rem',
                padding:         '1rem 1.25rem',
                borderRadius:    12,
                backgroundColor: opt.ai ? '#0f1a2e' : '#0d1f0d',
                border:          `1px solid ${coachBadge ? '#c9a227' : opt.ai ? '#1e3a5f' : '#1a3a1a'}`,
                cursor:          'pointer',
                textAlign:       'left',
                transition:      'border-color 0.15s, background-color 0.15s',
                boxShadow:       coachBadge
                  ? '0 0 16px rgba(201,162,39,0.2), 0 2px 12px rgba(0,0,0,0.4)'
                  : '0 2px 12px rgba(0,0,0,0.4)',
                animation:       `fadeUp 0.3s ease ${i * 0.06}s both`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = coachBadge ? '#e0b830' : opt.ai ? '#3b82f6' : '#22c55e'
                e.currentTarget.style.backgroundColor = opt.ai ? '#162032' : '#122312'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = coachBadge ? '#c9a227' : opt.ai ? '#1e3a5f' : '#1a3a1a'
                e.currentTarget.style.backgroundColor = opt.ai ? '#0f1a2e' : '#0d1f0d'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{
                  fontFamily:    'monospace',
                  fontSize:      '0.9rem',
                  fontWeight:    700,
                  letterSpacing: '0.08em',
                  color:         opt.ai ? '#93c5fd' : '#86efac',
                  textTransform: 'uppercase',
                }}>
                  {opt.label}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Coach recommends badge */}
                  {coachBadge && (
                    <span style={{
                      fontFamily:    'monospace',
                      fontSize:      '0.55rem',
                      color:         '#c9a227',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}>
                      ★ Coach pick
                    </span>
                  )}
                  {opt.ai && !coachBadge && (
                    <span style={{
                      fontFamily:    'monospace',
                      fontSize:      '0.55rem',
                      color:         '#374151',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}>
                      vs AI
                    </span>
                  )}
                </div>
              </div>

              {/* Win progress pips */}
              {opt.ai && opt.id !== 'expert' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {Array.from({ length: WINS_TO_PROMOTE }).map((_, j) => (
                    <div
                      key={j}
                      style={{
                        width:           8,
                        height:          8,
                        borderRadius:    '50%',
                        backgroundColor: j < w ? '#c9a227' : '#1f2937',
                        border:          `1px solid ${j < w ? '#c9a227' : '#374151'}`,
                        boxShadow:       j < w ? '0 0 4px rgba(201,162,39,0.5)' : 'none',
                        transition:      'background-color 0.3s',
                      }}
                    />
                  ))}
                  <span style={{
                    fontFamily:    'monospace',
                    fontSize:      '0.6rem',
                    color:         '#4b5563',
                    letterSpacing: '0.05em',
                  }}>
                    {Math.min(w, WINS_TO_PROMOTE)}/{WINS_TO_PROMOTE} wins
                  </span>
                </div>
              )}

              {/* Expert — show total wins instead of pips */}
              {opt.id === 'expert' && (wins.expert ?? 0) > 0 && (
                <span style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#4b5563' }}>
                  {wins.expert} {wins.expert === 1 ? 'win' : 'wins'} at Expert
                </span>
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
