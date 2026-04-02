import Point from './Point'
import Dice from './Dice'
import GameStatus from './GameStatus'
import WinBar from './WinBar'
import MoveHint from './MoveHint'
import { TOP_LEFT, TOP_RIGHT, BOT_LEFT, BOT_RIGHT, pointsToPosition } from '../constants/gameConstants'

const FELT   = '#1a5c38'
const RAIL   = '#2d1400'
const FRAME  = '#3d1c00'
const HOME_BG = '#162e1a'

function Quadrant({ points, isTop, position, selectedPointNum, onPointClick }) {
  return (
    <div className="flex h-full">
      {points.map(n => (
        <Point
          key={n}
          pointNumber={n}
          isTop={isTop}
          pointData={position[n]}
          isSelected={selectedPointNum === n}
          onClick={() => onPointClick(n)}
        />
      ))}
    </div>
  )
}

function Bar() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: RAIL, width: '2rem' }}
    >
      <span
        className="font-mono text-stone-500 select-none"
        style={{ fontSize: '0.6rem', writingMode: 'vertical-rl', letterSpacing: '0.15em' }}
      >
        BAR
      </span>
    </div>
  )
}

function HomeColumn() {
  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ backgroundColor: HOME_BG, width: '3.5rem' }}
    >
      <div className="flex-1 flex flex-col items-center justify-end pb-1 border-b border-stone-700">
        <span className="font-mono text-stone-500 select-none" style={{ fontSize: '0.6rem' }}>BLK</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-start pt-1">
        <span className="font-mono text-stone-500 select-none" style={{ fontSize: '0.6rem' }}>WHT</span>
      </div>
    </div>
  )
}

/**
 * Board — the full interactive backgammon board.
 *
 * All game state comes from the parent via props (driven by useGameState).
 * Board's only job is layout + forwarding clicks to onPointClick.
 */
export default function Board({
  gameState,
  selectedPointNum,
  currentPlayer,
  phase,
  dice,
  notification,
  passable,
  winner,
  winProb,
  delta,
  hint,
  onPointClick,
  onRoll,
  onPass,
}) {
  // Translate jbackgammon points array → { [1..24]: { color, count } }
  const position = pointsToPosition(gameState.game_state.points)

  const ROW_H = '10rem'

  const quadrantProps = { position, selectedPointNum, onPointClick }

  return (
    <div
      className="flex flex-col items-center gap-6 p-4 sm:p-6 min-h-screen"
      style={{ backgroundColor: '#111827' }}
    >
      <h1
        className="text-xl sm:text-2xl font-bold tracking-widest uppercase select-none"
        style={{ color: '#d1c5b0', fontFamily: 'Georgia, serif' }}
      >
        Backgammon Trainer
      </h1>

      {/* ── Win probability bar ── */}
      <WinBar winProb={winProb} delta={delta} currentPlayer={currentPlayer} />

      {/* ── Outer wood frame ── */}
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{
          maxWidth: '56rem',
          border: `10px solid ${FRAME}`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}
      >
        <div className="flex" style={{ backgroundColor: FELT }}>

          {/* Left half */}
          <div className="flex-1 flex flex-col min-w-0">
            <div style={{ height: ROW_H }}>
              <Quadrant points={TOP_LEFT} isTop {...quadrantProps} />
            </div>
            <div className="flex items-center justify-center" style={{ height: '2rem', backgroundColor: RAIL }}>
              <div
                className="w-6 h-6 rounded flex items-center justify-center select-none"
                style={{ backgroundColor: '#f5f0e8', fontSize: '0.6rem', fontWeight: 700, color: '#222', boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}
              >
                64
              </div>
            </div>
            <div style={{ height: ROW_H }}>
              <Quadrant points={BOT_LEFT} isTop={false} {...quadrantProps} />
            </div>
          </div>

          {/* Bar */}
          <Bar />

          {/* Right half */}
          <div className="flex-1 flex flex-col min-w-0">
            <div style={{ height: ROW_H }}>
              <Quadrant points={TOP_RIGHT} isTop {...quadrantProps} />
            </div>
            <div style={{ height: '2rem', backgroundColor: RAIL }} />
            <div style={{ height: ROW_H }}>
              <Quadrant points={BOT_RIGHT} isTop={false} {...quadrantProps} />
            </div>
          </div>

          <HomeColumn />
        </div>
      </div>

      {/* ── Dice + Roll button ── */}
      <Dice dice={dice} phase={phase} onRoll={onRoll} />

      {/* ── Status bar ── */}
      <GameStatus
        currentPlayer={currentPlayer}
        phase={phase}
        notification={notification}
        passable={passable}
        winner={winner}
        onPass={onPass}
      />

      {/* ── Move hint (only shown when player played suboptimally) ── */}
      {hint && (
        <MoveHint
          bestMoves={hint.bestMoves}
          playerWinPct={hint.playerWinPct}
          bestWinPct={hint.bestWinPct}
          explanation={hint.explanation}
          currentPlayer={currentPlayer}
        />
      )}
    </div>
  )
}
