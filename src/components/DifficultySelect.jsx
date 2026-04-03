/**
 * DifficultySelect — pre-game screen where the player chooses their opponent.
 * Matches the casino aesthetic: dark, clean, premium.
 */

const OPTIONS = [
  {
    id:    '2player',
    label: '2 Player',
    sub:   'Pass the device and play a friend',
    ai:    false,
  },
  {
    id:    'beginner',
    label: 'Beginner',
    sub:   'AI plays randomly — perfect for learning the rules',
    ai:    true,
  },
  {
    id:    'medium',
    label: 'Medium',
    sub:   'AI makes decent moves but slips up often',
    ai:    true,
  },
  {
    id:    'hard',
    label: 'Hard',
    sub:   'AI plays strong — it will punish mistakes',
    ai:    true,
  },
  {
    id:    'expert',
    label: 'Expert',
    sub:   'AI plays optimally every move. Good luck.',
    ai:    true,
  },
]

export default function DifficultySelect({ onSelect }) {
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
        <p
          className="text-xs font-mono tracking-widest uppercase"
          style={{ color: '#4b5563' }}
        >
          Choose your opponent
        </p>
      </div>

      <div
        className="flex flex-col gap-3 w-full"
        style={{ maxWidth: '24rem' }}
      >
        {OPTIONS.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            style={{
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'flex-start',
              gap:             '0.2rem',
              padding:         '1rem 1.25rem',
              borderRadius:    12,
              backgroundColor: opt.ai ? '#0f1a2e' : '#0d1f0d',
              border:          `1px solid ${opt.ai ? '#1e3a5f' : '#1a3a1a'}`,
              cursor:          'pointer',
              textAlign:       'left',
              transition:      'border-color 0.15s, background-color 0.15s',
              boxShadow:       '0 2px 12px rgba(0,0,0,0.4)',
              // Stagger appearance
              animation:       `fadeUp 0.3s ease ${i * 0.06}s both`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = opt.ai ? '#3b82f6' : '#22c55e'
              e.currentTarget.style.backgroundColor = opt.ai ? '#162032' : '#122312'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = opt.ai ? '#1e3a5f' : '#1a3a1a'
              e.currentTarget.style.backgroundColor = opt.ai ? '#0f1a2e' : '#0d1f0d'
            }}
          >
            <div className="flex items-center justify-between w-full">
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
              {opt.ai && (
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
            <span style={{
              fontFamily: 'monospace',
              fontSize:   '0.7rem',
              color:      '#6b7280',
              lineHeight: 1.4,
            }}>
              {opt.sub}
            </span>
          </button>
        ))}
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
