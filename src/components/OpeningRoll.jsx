/**
 * OpeningRoll — pre-game screen where each player rolls one die to determine
 * who goes first. High roll wins and uses both dice as their opening move.
 */

const PIP_LAYOUTS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
}

function OpeningDie({ value }) {
  const pips = PIP_LAYOUTS[value] || []
  const rolled = value !== null

  return (
    <div
      className="relative rounded-2xl select-none"
      style={{
        width: '5.5rem',
        height: '5.5rem',
        backgroundColor: rolled ? '#f5f0e8' : '#2d2d2d',
        border: `2px solid ${rolled ? '#d1c5b0' : '#444'}`,
        boxShadow: rolled
          ? '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 3px rgba(255,255,255,0.8)'
          : '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'all 0.25s ease',
      }}
    >
      {rolled ? (
        pips.map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: '19%',
              height: '19%',
              left: `${x}%`,
              top:  `${y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#1c1c1c',
            }}
          />
        ))
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ color: '#555', fontSize: '1.6rem', fontWeight: 'bold' }}>?</span>
        </div>
      )}
    </div>
  )
}

function PlayerPanel({ label, isBlack, die, canRoll, onRoll }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Checker avatar */}
      <div
        className="rounded-full border-2 flex-shrink-0"
        style={{
          width: '3rem',
          height: '3rem',
          backgroundColor: isBlack ? '#1c1c1c' : '#f5f0e8',
          borderColor: isBlack ? '#666' : '#bbb',
          boxShadow: isBlack
            ? '0 2px 8px rgba(0,0,0,0.6)'
            : '0 2px 8px rgba(0,0,0,0.3)',
        }}
      />

      <p
        className="text-xs font-mono font-bold tracking-widest uppercase"
        style={{ color: '#9ca3af' }}
      >
        {label}
      </p>

      <OpeningDie value={die} />

      <button
        onClick={onRoll}
        disabled={!canRoll}
        className="px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-widest"
        style={{
          backgroundColor: canRoll ? '#1a5c38' : '#1a1a1a',
          color: canRoll ? '#f0ebe0' : '#4b5563',
          border: `1px solid ${canRoll ? '#2d8a55' : '#2a2a2a'}`,
          boxShadow: canRoll ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
          cursor: canRoll ? 'pointer' : 'default',
          transition: 'background-color 0.2s, color 0.2s, border-color 0.2s',
        }}
      >
        Roll
      </button>
    </div>
  )
}

export default function OpeningRoll({ blackDie, whiteDie, tie, onRoll, onReset }) {
  const bothRolled = blackDie !== null && whiteDie !== null

  let statusText  = 'Each player rolls — highest die goes first'
  let statusColor = '#6b7280'

  if (tie) {
    statusText  = "It's a tie! Rolling again…"
    statusColor = '#f59e0b'
  } else if (bothRolled) {
    const winner = blackDie > whiteDie ? 'Black' : 'White'
    statusText  = `${winner} goes first!`
    statusColor = '#34d399'
  } else if (blackDie !== null || whiteDie !== null) {
    statusText  = 'Waiting for the other player…'
    statusColor = '#60a5fa'
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-8 min-h-screen p-6"
      style={{ backgroundColor: '#111827' }}
    >
      <h1
        className="text-2xl font-bold tracking-widest uppercase select-none"
        style={{ color: '#d1c5b0', fontFamily: 'Georgia, serif' }}
      >
        Backgammon Trainer
      </h1>

      <div
        className="flex flex-col items-center gap-8 p-10 rounded-2xl"
        style={{
          backgroundColor: '#1a2230',
          border: '1px solid #2d3748',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          minWidth: '22rem',
        }}
      >
        <div>
          <p
            className="text-center text-xs font-mono font-bold tracking-widest uppercase"
            style={{ color: '#4b5563', letterSpacing: '0.2em' }}
          >
            Opening Roll
          </p>
        </div>

        {/* Two player panels */}
        <div className="flex items-center gap-12">
          <PlayerPanel
            label="Black"
            isBlack={true}
            die={blackDie}
            canRoll={blackDie === null}
            onRoll={() => onRoll(1)}
          />

          <div
            className="font-mono font-bold select-none"
            style={{ color: '#374151', fontSize: '1.1rem' }}
          >
            VS
          </div>

          <PlayerPanel
            label="White"
            isBlack={false}
            die={whiteDie}
            canRoll={whiteDie === null}
            onRoll={() => onRoll(2)}
          />
        </div>

        {/* Status message */}
        <p
          className="text-sm font-mono text-center"
          style={{
            color: statusColor,
            minHeight: '1.4em',
            transition: 'color 0.3s ease',
          }}
        >
          {statusText}
        </p>
      </div>
    </div>
  )
}
