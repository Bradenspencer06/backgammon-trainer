import Board from './components/Board'
import OpeningRoll from './components/OpeningRoll'
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
    openingRoll,
    rollOpeningDie,
    rollDice,
    touchPoint,
    touchPass,
    submitTurn,
    resetGame,
  } = useGameState()

  // Show the opening roll screen until both players have rolled and a winner is determined
  if (!openingRoll.complete) {
    return (
      <OpeningRoll
        blackDie={openingRoll.blackDie}
        whiteDie={openingRoll.whiteDie}
        tie={openingRoll.tie}
        onRoll={rollOpeningDie}
      />
    )
  }

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
      onPointClick={touchPoint}
      onRoll={rollDice}
      onPass={touchPass}
      onSubmit={submitTurn}
      onReset={resetGame}
    />
    </>
  )
}
