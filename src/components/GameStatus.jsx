/**
 * GameStatus — banner shown below the board.
 * Displays whose turn it is, the current phase, any notification from
 * the library, and a Pass button when the player has no legal moves.
 */
export default function GameStatus({ currentPlayer, phase, notification, passable, winner, onPass }) {
  const playerName  = currentPlayer === 1 ? 'Black' : 'White'
  const playerColor = currentPlayer === 1 ? '#1c1c1c' : '#f0ebe0'
  const playerBg    = currentPlayer === 1 ? '#f0ebe0' : '#1c1c1c'

  if (winner) {
    const winnerName = winner === 1 ? 'Black' : 'White'
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-2xl font-bold" style={{ color: '#d1c5b0', fontFamily: 'Georgia, serif' }}>
          🏆 {winnerName} wins!
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Current player pill */}
      <div
        className="flex items-center gap-2 px-4 py-1 rounded-full"
        style={{ backgroundColor: playerBg, border: '1px solid #555' }}
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
          {playerName} — {phase === 'roll' ? 'Roll dice' : 'Move'}
        </span>
      </div>

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
