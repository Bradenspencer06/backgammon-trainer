import Board from './components/Board'
import OpeningRoll from './components/OpeningRoll'
import DifficultySelect from './components/DifficultySelect'
import GoodMoveToast from './components/GoodMoveToast'
import { useGameState } from './hooks/useGameState'

export default function App() {
  const {
    gameState,
    selectedPointNum,
    notification,
    currentPlayer,
    phase,
    dice,
    passable,
    winner,
    winProb,
    delta,
    hint,
    goodMove,
    clearGoodMove,
    pendingSubmit,
    canUndo,
    undoMove,
    difficulty,
    chooseDifficulty,
    aiThinking,
    vsAi,
    openingRoll,
    rollOpeningDie,
    rollDice,
    touchPoint,
    touchPass,
    submitTurn,
    resetGame,
  } = useGameState()

  // ── 1. Difficulty selection ──────────────────────────────────────────────────
  if (difficulty === null) {
    return <DifficultySelect onSelect={chooseDifficulty} />
  }

  // ── 2. Opening roll ──────────────────────────────────────────────────────────
  if (!openingRoll.complete) {
    return (
      <OpeningRoll
        blackDie={openingRoll.blackDie}
        whiteDie={openingRoll.whiteDie}
        tie={openingRoll.tie}
        vsAi={vsAi}
        onRoll={rollOpeningDie}
      />
    )
  }

  // ── 3. Main game board ───────────────────────────────────────────────────────
  return (
    <>
      <GoodMoveToast goodMove={goodMove} onDismiss={clearGoodMove} />
      <Board
        gameState={gameState}
        selectedPointNum={selectedPointNum}
        currentPlayer={currentPlayer}
        phase={phase}
        dice={dice}
        notification={notification}
        passable={passable}
        winner={winner}
        winProb={winProb}
        delta={delta}
        hint={hint}
        pendingSubmit={pendingSubmit}
        canUndo={canUndo}
        aiThinking={aiThinking}
        onPointClick={aiThinking ? () => {} : touchPoint}
        onRoll={rollDice}
        onPass={touchPass}
        onUndo={undoMove}
        onSubmit={submitTurn}
        onReset={resetGame}
      />
    </>
  )
}
