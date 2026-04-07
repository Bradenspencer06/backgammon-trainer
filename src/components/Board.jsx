import Point from './Point'
import Checker from './Checker'
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

function BarChecker({ color }) {
  return (
    <div style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0 }}>
      <Checker color={color} />
    </div>
  )
}

function Bar({ bar, onBarClick }) {
  const pieces = bar?.pieces ?? []
  const blackCount = pieces.filter(p => p.player_number === 1).length
  const whiteCount = pieces.filter(p => p.player_number === 2).length
  const empty = !blackCount && !whiteCount

  return (
    <div
      className="flex flex-col flex-shrink-0"
      onClick={onBarClick}
      style={{
        backgroundColor: RAIL,
        width: '2rem',
        cursor: (!empty) ? 'pointer' : 'default',
      }}
    >
      {/* Top section — White pieces stack downward from center */}
      <div className="flex-1 flex flex-col items-center justify-end pb-1" style={{ gap: '2px' }}>
        {Array.from({ length: whiteCount }, (_, i) => (
          <BarChecker key={i} color="white" />
        ))}
      </div>

      {/* Center label — only when bar is empty */}
      <div className="flex items-center justify-center flex-shrink-0" style={{ height: '2rem' }}>
        {empty && (
          <span
            className="font-mono text-stone-500 select-none"
            style={{ fontSize: '0.6rem', writingMode: 'vertical-rl', letterSpacing: '0.15em' }}
          >
            BAR
          </span>
        )}
      </div>

      {/* Bottom section — Black pieces stack upward from center */}
      <div className="flex-1 flex flex-col items-center justify-start pt-1" style={{ gap: '2px' }}>
        {Array.from({ length: blackCount }, (_, i) => (
          <BarChecker key={i} color="black" />
        ))}
      </div>
    </div>
  )
}

function HomeColumn({ offBoard, vsAi, onPointClick }) {
  const pieces     = offBoard?.pieces ?? []
  const blackCount = pieces.filter(p => p.player_number === 1).length
  const whiteCount = pieces.filter(p => p.player_number === 2).length

  // Labels: in vsAi mode show YOU / CPU, otherwise BLK / WHT
  const blackLabel = vsAi ? 'YOU'  : 'BLK'
  const whiteLabel = vsAi ? 'CPU'  : 'WHT'
  const blackColor = vsAi ? '#4ade80' : '#6b7280'
  const whiteColor = vsAi ? '#93c5fd' : '#6b7280'

  return (
    <div
      className="flex flex-col flex-shrink-0"
      onClick={() => onPointClick('off_board')}
      style={{ backgroundColor: HOME_BG, width: '3.5rem', cursor: 'pointer' }}
    >
      {/* Top half — Black borne off (stacks downward from center) */}
      <div
        className="flex-1 flex flex-col items-center justify-end pb-1 border-b border-stone-700"
        style={{ gap: '1px', overflow: 'hidden' }}
      >
        {blackCount === 0 ? (
          <span className="font-mono select-none" style={{ fontSize: '0.6rem', color: blackColor, fontWeight: 700, letterSpacing: '0.05em' }}>
            {blackLabel}
          </span>
        ) : (
          <>
            {Array.from({ length: blackCount }, (_, i) => (
              <div key={i} style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0 }}>
                <Checker color="black" />
              </div>
            ))}
            <span className="font-mono select-none" style={{ fontSize: '0.55rem', color: '#c9a227' }}>
              {blackCount}/15
            </span>
          </>
        )}
      </div>

      {/* Bottom half — White borne off (stacks upward from center) */}
      <div
        className="flex-1 flex flex-col items-center justify-start pt-1"
        style={{ gap: '1px', overflow: 'hidden' }}
      >
        {whiteCount === 0 ? (
          <span className="font-mono select-none" style={{ fontSize: '0.6rem', color: whiteColor, fontWeight: 700, letterSpacing: '0.05em' }}>
            {whiteLabel}
          </span>
        ) : (
          <>
            <span className="font-mono select-none" style={{ fontSize: '0.55rem', color: '#c9a227' }}>
              {whiteCount}/15
            </span>
            {Array.from({ length: whiteCount }, (_, i) => (
              <div key={i} style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0 }}>
                <Checker color="white" />
              </div>
            ))}
          </>
        )}
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
  vsAi,
  lastAiDice,
  passable,
  winner,
  winProb,
  delta,
  hint,
  pendingSubmit,
  canUndo,
  aiThinking,
  onPointClick,
  onRoll,
  onPass,
  onUndo,
  onSubmit,
  onReset,
  onHintClose,
}) {
  // Translate jbackgammon points array → { [1..24]: { color, count } }
  const position = pointsToPosition(gameState.game_state.points)
  const bar      = gameState.game_state.bar
  const offBoard = gameState.game_state.off_board

  const ROW_H = '10rem'

  const quadrantProps = { position, selectedPointNum, onPointClick }

  return (
    <div
      className="flex flex-col items-center gap-6 p-4 sm:p-6 min-h-screen"
      style={{ backgroundColor: '#111827' }}
    >
      <div className="flex items-center gap-4">
        <h1
          className="text-xl sm:text-2xl font-bold tracking-widest uppercase select-none"
          style={{ color: '#d1c5b0', fontFamily: 'Georgia, serif' }}
        >
          Backgammon Trainer
        </h1>
        <button
          onClick={onReset}
          className="px-3 py-1 rounded text-xs font-mono font-bold uppercase tracking-widest"
          style={{
            backgroundColor: '#1f2937',
            color: '#9ca3af',
            border: '1px solid #374151',
          }}
        >
          New Game
        </button>
      </div>

      {/* ── Win probability bar ── */}
      <WinBar winProb={winProb} delta={delta} currentPlayer={currentPlayer} vsAi={vsAi} />

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
            <div style={{ height: '2rem', backgroundColor: RAIL }} />
            <div style={{ height: ROW_H }}>
              <Quadrant points={BOT_LEFT} isTop={false} {...quadrantProps} />
            </div>
          </div>

          {/* Bar */}
          <Bar bar={bar} onBarClick={() => onPointClick('bar')} />

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

          <HomeColumn offBoard={offBoard} vsAi={vsAi} onPointClick={onPointClick} />
        </div>
      </div>

      {/* ── Coach tip — between board and dice so it's central ── */}
      {hint && (
        <MoveHint
          bestMoves={hint.bestMoves}
          playerWinPct={hint.playerWinPct}
          bestWinPct={hint.bestWinPct}
          explanation={hint.explanation}
          playerWhoMoved={hint.playerWhoMoved}
          beforeGameState={hint.beforeGameState}
          afterGameState={hint.afterGameState}
          dice={hint.dice}
          onClose={onHintClose}
        />
      )}

      {/* ── Dice + Roll button ── */}
      {/* When it's the human's roll phase, show the AI's last dice until they roll */}
      <Dice
        dice={lastAiDice && phase === 'roll' ? lastAiDice : dice}
        ghostDice={!!(lastAiDice && phase === 'roll')}
        phase={phase}
        pendingSubmit={pendingSubmit}
        canUndo={canUndo && !aiThinking}
        onRoll={aiThinking ? null : onRoll}
        onUndo={aiThinking ? null : onUndo}
        onSubmit={aiThinking ? null : onSubmit}
      />

      {/* ── Status bar ── */}
      <GameStatus
        currentPlayer={currentPlayer}
        phase={phase}
        notification={notification}
        vsAi={vsAi}
        passable={passable}
        winner={winner}
        aiThinking={aiThinking}
        onPass={onPass}
      />
    </div>
  )
}
