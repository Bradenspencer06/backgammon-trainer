import { useState } from 'react'
import Board from './components/Board'
import OpeningRoll from './components/OpeningRoll'
import DifficultySelect from './components/DifficultySelect'
import GoodMoveToast from './components/GoodMoveToast'
import SenseiPromotion from './components/SenseiPromotion'
import { useGameState } from './hooks/useGameState'
import { useWins, WINS_TO_PROMOTE } from './hooks/useWins'

export default function App() {
  const {
    gameState,
    selectedPointNum,
    notification,
    currentPlayer,
    phase,
    dice,
    lastAiDice,
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
    onHintClose,
  } = useGameState()

  const { wins, recordWin } = useWins()

  // promotion: null | difficulty string (shown after hitting WINS_TO_PROMOTE)
  const [promotion, setPromotion] = useState(null)
  // Track which games we've already awarded (avoid double-counting)
  const [awardedThisGame, setAwardedThisGame] = useState(false)

  // Detect human win vs AI and record it
  const humanWon = vsAi && winner === 1   // human is always Black (1)
  if (humanWon && !awardedThisGame && difficulty) {
    setAwardedThisGame(true)
    const newTotal = recordWin(difficulty)
    if (newTotal === WINS_TO_PROMOTE) {
      // Small delay so the win screen shows first
      setTimeout(() => setPromotion(difficulty), 1800)
    }
  }

  function handlePromotionAccept(nextDifficulty) {
    setPromotion(null)
    setAwardedThisGame(false)
    resetGame()
    // resetGame sets difficulty → null (shows DifficultySelect)
    // Then we immediately pre-select the next level after one tick
    setTimeout(() => chooseDifficulty(nextDifficulty), 0)
  }

  function handlePromotionStay() {
    setPromotion(null)
    setAwardedThisGame(false)
    resetGame()
  }

  function handleReset() {
    setAwardedThisGame(false)
    setPromotion(null)
    resetGame()
  }

  // ── 1. Difficulty selection ──────────────────────────────────────────────────
  if (difficulty === null) {
    return (
      <DifficultySelect
        onSelect={d => { setAwardedThisGame(false); chooseDifficulty(d) }}
        wins={wins}
      />
    )
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

      {promotion && (
        <SenseiPromotion
          difficulty={promotion}
          wins={wins[promotion]}
          onAccept={handlePromotionAccept}
          onStay={handlePromotionStay}
        />
      )}

      <Board
        gameState={gameState}
        selectedPointNum={selectedPointNum}
        currentPlayer={currentPlayer}
        phase={phase}
        dice={dice}
        lastAiDice={lastAiDice}
        notification={notification}
        vsAi={vsAi}
        passable={vsAi ? (currentPlayer === 1 && passable) : passable}
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
        onReset={handleReset}
        onHintClose={onHintClose}
      />
    </>
  )
}
