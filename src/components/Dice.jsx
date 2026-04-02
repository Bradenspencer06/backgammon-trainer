const PIP_LAYOUTS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
}

function Die({ value }) {
  const pips = PIP_LAYOUTS[value] || []
  const rolled = value !== null

  return (
    <div
      className="relative rounded-xl select-none flex items-center justify-center"
      style={{
        width: '3.5rem',
        height: '3.5rem',
        backgroundColor: rolled ? '#f5f0e8' : '#c8b89a',
        border: `2px solid ${rolled ? '#d1c5b0' : '#a09080'}`,
        boxShadow: '0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.8)',
        opacity: rolled ? 1 : 0.5,
      }}
    >
      {rolled ? (
        pips.map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: '22%',
              height: '22%',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#1c1c1c',
            }}
          />
        ))
      ) : (
        <span style={{ color: '#888', fontSize: '1.2rem', fontWeight: 'bold' }}>?</span>
      )}
    </div>
  )
}

/**
 * Dice — shows the two dice and a Roll button when it's the roll phase.
 *
 * dice:      [{ number: null|1-6 }, { number: null|1-6 }]
 * phase:     'roll' | 'move'
 * onRoll:    called when the Roll button is clicked
 */
export default function Dice({ dice = [], phase, onRoll }) {
  const [d1, d2] = dice
  const showRoll = phase === 'roll'

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-mono" style={{ color: '#9ca3af' }}>DICE</p>
      <div className="flex items-center gap-4">
        <Die value={d1?.number ?? null} />
        <Die value={d2?.number ?? null} />
      </div>
      {showRoll && (
        <button
          onClick={onRoll}
          className="px-6 py-2 rounded-lg text-sm font-mono font-bold uppercase tracking-widest"
          style={{
            backgroundColor: '#1a5c38',
            color: '#f0ebe0',
            border: '1px solid #2d8a55',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          Roll Dice
        </button>
      )}
    </div>
  )
}
