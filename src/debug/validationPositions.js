/**
 * Fixed positions for engine / bgweb validation (jbackgammon coordinates).
 * Every position keeps 15 checkers per side (board + bar + off_board).
 */
import { INITIAL_MATCH_STATE } from '../constants/gameConstants.js'

const PLAYERS = INITIAL_MATCH_STATE.players

function emptyPoints() {
  return Array.from({ length: 24 }, (_, i) => ({ number: i + 1, pieces: [] }))
}

/** spec[n] = { b: black count, w: white count } */
function pointsFromSpec(spec) {
  const points = emptyPoints()
  for (let n = 1; n <= 24; n++) {
    const s = spec[n]
    if (!s) continue
    const b = s.b ?? 0
    const w = s.w ?? 0
    const ps = []
    for (let i = 0; i < b; i++) ps.push({ player_number: 1 })
    for (let i = 0; i < w; i++) ps.push({ player_number: 2 })
    points[n - 1].pieces = ps
  }
  return points
}

function off(count, playerNumber) {
  return { pieces: Array.from({ length: count }, () => ({ player_number: playerNumber })) }
}

function bar(blacks, whites) {
  const pieces = []
  for (let i = 0; i < blacks; i++) pieces.push({ player_number: 1 })
  for (let i = 0; i < whites; i++) pieces.push({ player_number: 2 })
  return { pieces }
}

function snapshot(game_state) {
  return {
    id:           1,
    game_state,
    players:      PLAYERS,
    move_list:    [],
    last_action:  null,
    notification: '',
  }
}

function dicePair(a, b) {
  return [
    { number: Math.max(a, b), used: false },
    { number: Math.min(a, b), used: false },
  ]
}

/**
 * Ten qualitative scenarios. Last entry uses `snapshots: [...]` for anchor A/B.
 */
export const VALIDATION_CASES = [
  {
    id: 'race-winning',
    qualitative: 'Clearly winning race / bear-off for Black.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(2, 1),
      bar: bar(0, 0),
      off_board: off(10, 1),
      points: pointsFromSpec({
        1: { w: 5 }, 2: { w: 5 }, 3: { w: 5 },
        24: { b: 5 },
      }),
    }),
  },
  {
    id: 'race-losing',
    qualitative: 'Clearly losing race for Black (White bearing).',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(2, 1),
      bar: bar(0, 0),
      off_board: off(10, 2),
      points: pointsFromSpec({
        19: { b: 5 }, 20: { b: 5 }, 21: { b: 5 },
        1: { w: 5 },
      }),
    }),
  },
  {
    id: 'point-making',
    qualitative: 'Point-making improvement vs leaving loose builders.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(6, 4),
      bar: bar(0, 0),
      off_board: off(0, 0),
      points: pointsFromSpec({
        12: { b: 2 }, 13: { b: 4 }, 8: { b: 3 }, 6: { b: 3 }, 17: { b: 3 },
        10: { w: 1 }, 14: { w: 1 },
        24: { w: 2 }, 19: { w: 3 }, 1: { w: 2 }, 7: { w: 1 }, 5: { w: 2 }, 4: { w: 2 }, 3: { w: 1 },
      }),
    }),
  },
  {
    id: 'blot-risk',
    qualitative: 'Obvious safe vs blot-leaving / vulnerable loose play among legal plays.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(5, 3),
      bar: bar(0, 0),
      off_board: off(0, 0),
      points: pointsFromSpec({
        8: { b: 2 }, 6: { b: 3 }, 13: { b: 3 }, 17: { b: 2 }, 19: { b: 2 }, 12: { b: 3 },
        10: { w: 1 },
        24: { w: 2 }, 14: { w: 2 }, 5: { w: 3 }, 4: { w: 2 }, 3: { w: 2 }, 1: { w: 2 }, 11: { w: 1 },
      }),
    }),
  },
  {
    id: 'bar-entry',
    qualitative: 'Bar entry urgency — must re-enter before other play.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(3, 2),
      bar: bar(2, 0),
      off_board: off(0, 0),
      points: pointsFromSpec({
        19: { w: 2 }, 20: { w: 2 }, 21: { w: 2 },
        22: { w: 1 }, 23: { w: 1 }, 24: { w: 1 },
        1: { w: 2 }, 12: { w: 4 },
        6: { b: 3 }, 13: { b: 3 }, 8: { b: 1 },
        18: { b: 3 }, 16: { b: 3 },
      }),
    }),
  },
  {
    id: 'bear-off',
    qualitative: 'Bear-off efficiency with no contact.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(6, 2),
      bar: bar(0, 0),
      off_board: off(8, 2),
      points: pointsFromSpec({
        19: { b: 2 }, 20: { b: 2 }, 23: { b: 1 }, 24: { b: 2 },
        1: { w: 2 }, 2: { w: 3 }, 3: { w: 4 }, 4: { w: 4 }, 5: { w: 2 },
      }),
    }),
  },
  {
    id: 'home-attack',
    qualitative: 'Hitting a blot in the outfield — Black can enter 18 with a six from 12.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(6, 1),
      bar: bar(0, 0),
      off_board: off(0, 0),
      points: pointsFromSpec({
        18: { w: 1 },
        12: { b: 5 }, 19: { b: 5 }, 17: { b: 5 },
        1: { w: 5 }, 2: { w: 5 }, 3: { w: 4 },
      }),
    }),
  },
  {
    id: 'prime-wall',
    qualitative: 'Six-point prime — side to move must respect the blockade.',
    snapshot: snapshot({
      current_player_number: 1,
      current_phase: 'move',
      first_turn: false,
      dice: dicePair(2, 1),
      bar: bar(0, 0),
      off_board: off(0, 0),
      points: pointsFromSpec({
        6: { b: 2 }, 7: { b: 2 }, 8: { b: 2 }, 9: { b: 2 }, 10: { b: 2 }, 11: { b: 2 },
        19: { b: 3 },
        24: { w: 2 }, 13: { w: 3 }, 1: { w: 2 }, 5: { w: 3 }, 4: { w: 2 }, 3: { w: 1 }, 2: { w: 1 }, 12: { w: 1 },
      }),
    }),
  },
  {
    id: 'opening-roll-phase',
    qualitative: 'ROLL phase only: 21-outcome next-roll average; no dice, no candidate moves.',
    snapshot: snapshot({
      ...JSON.parse(JSON.stringify(INITIAL_MATCH_STATE.game_state)),
      current_player_number: 1,
      current_phase: 'roll',
      first_turn: false,
      dice: [{ number: null }, { number: null }],
    }),
  },
  {
    id: 'anchor-vs-no-anchor',
    qualitative: 'Same workload except (A) 20-anchor vs (B) outfield stack — anchor should rate similarly or better.',
    snapshots: [
      snapshot({
        current_player_number: 1,
        current_phase: 'move',
        first_turn: false,
        dice: dicePair(3, 2),
        bar: bar(0, 0),
        off_board: off(0, 0),
        points: pointsFromSpec({
          20: { b: 2 },
          13: { b: 3 }, 8: { b: 2 }, 6: { b: 3 },
          19: { b: 3 }, 17: { b: 2 },
          24: { w: 2 }, 18: { w: 3 }, 5: { w: 4 }, 7: { w: 1 }, 1: { w: 3 }, 4: { w: 2 },
        }),
      }),
      snapshot({
        current_player_number: 1,
        current_phase: 'move',
        first_turn: false,
        dice: dicePair(3, 2),
        bar: bar(0, 0),
        off_board: off(0, 0),
        points: pointsFromSpec({
          12: { b: 2 },
          13: { b: 3 }, 8: { b: 2 }, 6: { b: 3 },
          19: { b: 3 }, 17: { b: 2 },
          24: { w: 2 }, 18: { w: 3 }, 11: { w: 2 }, 7: { w: 1 }, 1: { w: 3 }, 5: { w: 4 },
        }),
      }),
    ],
  },
]

export function countCheckers(gs) {
  let b = 0
  let w = 0
  const add = (p) => { if (p === 1) b++; else w++ }
  for (const pt of gs.points ?? []) {
    for (const p of pt.pieces ?? []) add(p.player_number)
  }
  for (const p of gs.bar?.pieces ?? []) add(p.player_number)
  for (const p of gs.off_board?.pieces ?? []) add(p.player_number)
  return { b, w }
}
