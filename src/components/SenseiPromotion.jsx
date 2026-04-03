/**
 * SenseiPromotion — ceremonial full-screen promotion screen shown after
 * earning enough wins at a difficulty level to be recommended to move up.
 *
 * The player can accept the recommendation or stay and keep sharpening.
 */

const PROMOTIONS = {
  beginner: {
    from:    'Beginner',
    to:      'Medium',
    toId:    'medium',
    message: 'Your game has grown. The beginner level holds no more lessons for you.',
    sensei:  'Your sensei believes you are ready for Medium.',
    accept:  'Accept the challenge',
  },
  medium: {
    from:    'Medium',
    to:      'Hard',
    toId:    'hard',
    message: 'You have learned to think ahead. The middling opponent can no longer test you.',
    sensei:  'Your sensei believes you are ready for Hard.',
    accept:  'Accept the challenge',
  },
  hard: {
    from:    'Hard',
    to:      'Expert',
    toId:    'expert',
    message: 'You have beaten a strong opponent — that is no small thing. There is one level left.',
    sensei:  'Your sensei believes you are ready for Expert.',
    accept:  'Step into Expert',
  },
  expert: {
    from:    'Expert',
    to:      null,
    toId:    null,
    message: 'You have mastered every level this trainer has to offer. The AI can teach you nothing more.',
    sensei:  'The real challenge now is the game itself — and the human across the board.',
    accept:  null,
  },
}

export default function SenseiPromotion({ difficulty, wins, onAccept, onStay }) {
  const promo = PROMOTIONS[difficulty]
  if (!promo) return null

  const isApex = promo.toId === null

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          2000,
        backgroundColor: 'rgba(0,0,0,0.88)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '1.5rem',
        animation:       'senseiIn 0.5s ease',
      }}
    >
      <div
        style={{
          width:           '100%',
          maxWidth:        '26rem',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          gap:             '1.5rem',
          animation:       'senseiSlide 0.5s cubic-bezier(0.34,1.2,0.64,1)',
        }}
      >
        {/* Divider line — like a dojo ceremony */}
        <div style={{ width: '3rem', height: 1, backgroundColor: '#c9a227', boxShadow: '0 0 8px rgba(201,162,39,0.5)' }} />

        {/* Win count badge */}
        <div style={{
          fontFamily:    'monospace',
          fontSize:      '0.65rem',
          letterSpacing: '0.2em',
          color:         '#c9a227',
          textTransform: 'uppercase',
        }}>
          {wins} {wins === 1 ? 'Victory' : 'Victories'} at {promo.from}
        </div>

        {/* Main message */}
        <p style={{
          fontFamily:  'Georgia, serif',
          fontSize:    '1.1rem',
          color:       '#d1c5b0',
          textAlign:   'center',
          lineHeight:  1.7,
          fontStyle:   'italic',
        }}>
          "{promo.message}"
        </p>

        {/* Sensei recommendation */}
        <p style={{
          fontFamily:    'monospace',
          fontSize:      '0.75rem',
          color:         isApex ? '#4ade80' : '#93c5fd',
          textAlign:     'center',
          letterSpacing: '0.04em',
          lineHeight:    1.6,
        }}>
          {promo.sensei}
        </p>

        <div style={{ width: '3rem', height: 1, backgroundColor: '#c9a227', opacity: 0.4 }} />

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
          {!isApex && (
            <button
              onClick={() => onAccept(promo.toId)}
              style={{
                width:           '100%',
                padding:         '0.85rem',
                borderRadius:    12,
                backgroundColor: '#0f1a2e',
                color:           '#93c5fd',
                border:          '1px solid #3b82f6',
                fontFamily:      'monospace',
                fontSize:        '0.8rem',
                fontWeight:      700,
                letterSpacing:   '0.12em',
                textTransform:   'uppercase',
                cursor:          'pointer',
                boxShadow:       '0 0 16px rgba(59,130,246,0.2)',
              }}
            >
              {promo.accept}
            </button>
          )}

          <button
            onClick={onStay}
            style={{
              width:           '100%',
              padding:         '0.75rem',
              borderRadius:    12,
              backgroundColor: 'transparent',
              color:           '#4b5563',
              border:          '1px solid #1f2937',
              fontFamily:      'monospace',
              fontSize:        '0.75rem',
              letterSpacing:   '0.1em',
              textTransform:   'uppercase',
              cursor:          'pointer',
            }}
          >
            {isApex ? 'Play again' : `Stay at ${promo.from}`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes senseiIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes senseiSlide {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
