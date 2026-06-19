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

  it('uses both dice when a complete 4-2 turn is possible', () => {
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
        off_board: { pieces: pieces(13, 1) },
        points: Array.from({ length: 24 }, (_, i) => {
          const number = i + 1
          if (number === 1) return point(number, 1)
          if (number === 2) return point(number, 1)
          if (number === 3) return point(number, 0, 2)
          if (number === 8) return point(number, 0, 2)
          if (number === 24) return point(number, 0, 11)
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

    expect(moveKeys).toEqual(['1->5,2->4', '1->5,5->7'])
  })

  it('uses the maximum four moves available from a double 3 roll', () => {
    const snapshot = {
      id: 1,
      game_state: {
        current_player_number: 1,
        current_phase: 'move',
        first_turn: false,
        dice: [
          { number: 3, used: false },
          { number: 3, used: false },
          { number: 3, used: false },
          { number: 3, used: false },
        ],
        bar: { pieces: [] },
        off_board: { pieces: pieces(11, 1) },
        points: Array.from({ length: 24 }, (_, i) => {
          const number = i + 1
          if (number === 1) return point(number, 4)
          if (number === 24) return point(number, 0, 15)
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

    expect(moveKeys).toEqual([
      '1->4,1->4,1->4,1->4',
      '1->4,1->4,1->4,4->7',
      '1->4,1->4,4->7,4->7',
      '1->4,1->4,4->7,7->10',
      '1->4,4->7,7->10,10->13',
    ])
  })

  it('enters from the bar before allowing normal board moves', () => {
    const snapshot = {
      id: 1,
      game_state: {
        current_player_number: 1,
        current_phase: 'move',
        first_turn: false,
        dice: [
          { number: 3, used: false },
          { number: 2, used: false },
        ],
        bar: { pieces: pieces(1, 1) },
        off_board: { pieces: pieces(13, 1) },
        points: Array.from({ length: 24 }, (_, i) => {
          const number = i + 1
          if (number === 6) return point(number, 1)
          if (number === 24) return point(number, 0, 15)
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

    const candidates = enumerateAllMoves(snapshot)

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every(({ moves }) => moves[0]?.from === 0)).toBe(true)
  })

  it('only allows higher-die bear off from the farthest checker', () => {
    const snapshot = {
      id: 1,
      game_state: {
        current_player_number: 1,
        current_phase: 'move',
        first_turn: false,
        dice: [
          { number: 6, used: false },
          { number: 4, used: false },
        ],
        bar: { pieces: [] },
        off_board: { pieces: pieces(12, 1) },
        points: Array.from({ length: 24 }, (_, i) => {
          const number = i + 1
          if (number === 20) return point(number, 1)
          if (number === 21) return point(number, 1)
          if (number === 23) return point(number, 1)
          if (number === 1) return point(number, 0, 15)
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

    const candidates = enumerateAllMoves(snapshot)
    const moveKeys = candidates
      .map(({ moves }) => moves.map((m) => `${m.from}->${m.to}`).join(','))
      .sort()

    expect(moveKeys).toEqual(['20->24,21->off_board', '20->off_board,21->off_board'])
    expect(candidates.some(({ moves }) =>
      moves.some((m) => m.from === 23 && m.to === 'off_board')
    )).toBe(false)
  })
})
