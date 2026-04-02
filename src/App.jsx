import Board from './components/Board'
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
    rollDice,
    touchPoint,
    touchPass,
  } = useGameState()

  return (
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
      onPointClick={touchPoint}
      onRoll={rollDice}
      onPass={touchPass}
    />
  )
}
