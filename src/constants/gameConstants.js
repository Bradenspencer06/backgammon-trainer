/**
 * INITIAL_MATCH_STATE — seed object for @mrlhumphreys/jbackgammon's Match constructor.
 *
 * Player convention used by the library (confirmed from test fixtures):
 *   player_number: 1  →  Black  (moves from point 1 → 24)
 *   player_number: 2  →  White  (moves from point 24 → 1)
 *
 * Standard starting position:
 *   Black (1): 2 on pt 1, 5 on pt 12, 3 on pt 17, 5 on pt 19
 *   White (2): 5 on pt 6, 3 on pt 8, 5 on pt 13, 2 on pt 24
 */
const b = (n) => Array(n).fill({ player_number: 1 }) // Black pieces
const w = (n) => Array(n).fill({ player_number: 2 }) // White pieces

export const INITIAL_MATCH_STATE = {
  id: 1,
  game_state: {
    current_player_number: 1,
    current_phase: 'roll',
    first_turn: false,
    dice: [{ number: null }, { number: null }],
    bar: { pieces: [] },
    off_board: { pieces: [] },
    points: [
      { number:  1, pieces: b(2) },
      { number:  2, pieces: [] },
      { number:  3, pieces: [] },
      { number:  4, pieces: [] },
      { number:  5, pieces: [] },
      { number:  6, pieces: w(5) },
      { number:  7, pieces: [] },
      { number:  8, pieces: w(3) },
      { number:  9, pieces: [] },
      { number: 10, pieces: [] },
      { number: 11, pieces: [] },
      { number: 12, pieces: b(5) },
      { number: 13, pieces: w(5) },
      { number: 14, pieces: [] },
      { number: 15, pieces: [] },
      { number: 16, pieces: [] },
      { number: 17, pieces: b(3) },
      { number: 18, pieces: [] },
      { number: 19, pieces: b(5) },
      { number: 20, pieces: [] },
      { number: 21, pieces: [] },
      { number: 22, pieces: [] },
      { number: 23, pieces: [] },
      { number: 24, pieces: w(2) },
    ],
  },
  players: [
    { player_number: 1, name: 'Black' },
    { player_number: 2, name: 'White' },
  ],
  move_list: [],
  last_action: null,
  notification: '',
}

// Board layout — point numbers in visual left-to-right order for each row.
// Top row:    13 14 15 16 17 18 | BAR | 19 20 21 22 23 24
// Bottom row: 12 11 10  9  8  7 | BAR |  6  5  4  3  2  1
export const TOP_LEFT    = [13, 14, 15, 16, 17, 18]
export const TOP_RIGHT   = [19, 20, 21, 22, 23, 24]
export const BOT_LEFT    = [12, 11, 10,  9,  8,  7]
export const BOT_RIGHT   = [ 6,  5,  4,  3,  2,  1]

/** Translate jbackgammon point array → { [1..24]: { color, count } } */
export function pointsToPosition(points) {
  const pos = Array(25).fill(null).map(() => ({ color: null, count: 0 }))
  points.forEach(p => {
    if (p.pieces.length > 0) {
      pos[p.number] = {
        color: p.pieces[0].player_number === 1 ? 'black' : 'white',
        count: p.pieces.length,
      }
    }
  })
  return pos
}
