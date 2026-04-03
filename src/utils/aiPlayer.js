/**
 * aiPlayer.js — AI move selection for each difficulty level.
 *
 * All candidates are pre-scored by evaluatePosition before this function
 * is called. Sorted best-first for the AI player (White = player 2,
 * lower evalProb = better since evalProb is Black's win probability).
 */

/**
 * Select a move from scored candidates based on difficulty.
 *
 * @param {Array<{moves, gameState, evalProb}>} scored  — all legal moves with eval scores
 * @param {'beginner'|'medium'|'hard'|'expert'} difficulty
 * @param {number} playerNumber — 1 or 2
 * @returns {{moves, gameState, evalProb}}
 */
export function selectAiMove(scored, difficulty, playerNumber) {
  if (!scored || scored.length === 0) return null

  // Sort best-first for the AI player
  const sorted = [...scored].sort((a, b) =>
    playerNumber === 1
      ? b.evalProb - a.evalProb   // Black wants higher evalProb
      : a.evalProb - b.evalProb   // White wants lower evalProb (Black loses)
  )

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

  switch (difficulty) {
    case 'beginner':
      // Fully random — good for absolute beginners to learn against
      return pick(sorted)

    case 'medium':
      // 40% best move, 60% random from bottom half
      if (Math.random() < 0.4) return sorted[0]
      return pick(sorted.slice(Math.floor(sorted.length / 2)))

    case 'hard':
      // 80% best move, 20% random from top 3
      if (Math.random() < 0.8) return sorted[0]
      return pick(sorted.slice(0, Math.min(3, sorted.length)))

    case 'expert':
    default:
      return sorted[0]
  }
}
