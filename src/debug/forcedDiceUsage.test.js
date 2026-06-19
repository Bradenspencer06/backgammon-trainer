import { enumerateAllMoves } from '../utils/moveEnumerator.js'

function pieces(count, playerNumber) {
  return Array.from({ length: count }, () => ({ player_number: playerNumber }))
}

function point(number, black = 0, white = 0) {
  return {
    number,
    pieces: [...pieces(black, 1), ...pieces(white, 2)],
  }
}

describe('forced dice usage', () => {
  it('requires the higher die when only one die can be played from a 4-2 roll', () => {
    const snapshot = {
      id: 1,
      game_state: {
        current_player_number: 1,
        current_phase: 'move',
        first_turn: false,
        dice: [
          { number: 4, used: false },
          { number: 2, used: false },
        ],
        bar: { pieces: [] },
        off_board: { pieces: pieces(14, 1) },
        points: Array.from({ length: 24 }, (_, i) => {
          const number = i + 1
          if (number === 1) return point(number, 1)
          if (number === 7) return point(number, 0, 2)
          if (number === 24) return point(number, 0, 13)
          return point(number)
        }),
      },
      players: [
        { player_number: 1, name: 'Black' },
        { player_number: 2, name: 'White' },
      ],
      move_list: [],
      last_action: null,
      notification: '',
    }

    const moveKeys = enumerateAllMoves(snapshot)
      .map(({ moves }) => moves.map((m) => `${m.from}->${m.to}`).join(','))
      .sort()

    expect(moveKeys).toEqual(['1->5'])
  })
})
