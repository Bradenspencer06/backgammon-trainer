/**
 * GameStatus — banner shown below the board.
 * Displays whose turn it is, the current phase, any notification from
 * the library, and a Pass button when the player has no legal moves.
 */
export default function GameStatus({ currentPlayer, phase, notification, vsAi, passable, winner, aiThinking, onPass }) {
  // In vsAi mode: human is always Black (1), AI is always White (2)
  const isHuman    = !vsAi || currentPlayer === 1
  const playerName = vsAi
    ? (currentPlayer === 1 ? 'You' : 'Computer')
    : (currentPlayer === 1 ? 'Black' : 'White')
  const playerColor = currentPlayer === 1 ? '#1c1c1c' : '#f0ebe0'
  const playerBg    = currentPlayer === 1 ? '#f0ebe0' : '#1c1c1c'

  if (winner) {
    const winnerName = vsAi
      ? (winner === 1 ? 'You win!' : 'Computer wins')
      : (winner === 1 ? 'Black wins!' : 'White wins!')
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-2xl font-bold" style={{ color: '#d1c5b0', fontFamily: 'Georgia, serif' }}>
          {winnerName}
        </div>
      </div>
    )
  }

  // Build the turn label
  let turnLabel
  if (aiThinking) {
    turnLabel = 'Computer thinking…'
  } else if (vsAi && !isHuman) {
    turnLabel = 'Computer'
  } else {
    turnLabel = `${playerName} — ${phase === 'roll' ? 'Roll dice' : 'Move'}`
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Current player pill */}
      <div
        className="flex items-center gap-2 px-4 py-1 rounded-full"
        style={{
          backgroundColor: playerBg,
          border: `1px solid ${aiThinking ? '#3b82f6' : '#555'}`,
          transition: 'border-color 0.3s',
        }}
      >
        <div
          className="w-3 h-3 rounded-full border"
          style={{
            backgroundColor: playerColor,
            borderColor: currentPlayer === 1 ? '#999' : '#888',
          }}
        />
        <span
          className="text-sm font-mono font-bold tracking-widest uppercase"
          style={{ color: playerColor }}
        >
          {turnLabel}
        </span>
        {aiThinking && (
          <span style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(i => (
              <span
                key={i}
                style={{
                  width: 4, height: 4, borderRadius: '50%',
                  backgroundColor: playerColor,
                  animation: `aiDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  display: 'inline-block',
                }}
              />
            ))}
          </span>
        )}
      </div>
      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>

      {/* Library notification */}
      {notification && (
        <p className="text-xs font-mono" style={{ color: '#9ca3af' }}>
          {notification}
        </p>
      )}

      {/* Pass button — only shown when no legal moves exist after rolling */}
      {passable && phase === 'move' && (
        <button
          onClick={onPass}
          className="px-4 py-1 rounded text-sm font-mono font-bold uppercase tracking-widest"
          style={{
            backgroundColor: '#7c3200',
            color: '#f0ebe0',
            border: '1px solid #a04000',
          }}
        >
          Pass Turn
        </button>
      )}
    </div>
  )
}
