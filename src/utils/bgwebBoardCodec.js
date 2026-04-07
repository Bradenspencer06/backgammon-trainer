/**
 * bgwebBoardCodec — single source of truth for app game_state → bgweb board JSON.
 * Keep in sync with bgweb-api MoveArgs `board` shape.
 *
 * bgweb keys: x = White (player 2), o = Black (player 1).
 * Point numbers 1–24 match jbackgammon; optional "bar" for checkers on the bar.
 */

export function gameStateToBgwebBoard(gs) {
  const layoutFor = (playerNumber) => {
    const layout = {}
    for (const pt of gs.points ?? []) {
      const c = pt.pieces.filter((p) => p.player_number === playerNumber).length
      if (c > 0) layout[String(pt.number)] = c
    }
    const bar = (gs.bar?.pieces ?? []).filter((p) => p.player_number === playerNumber).length
    if (bar > 0) layout.bar = bar
    return layout
  }
  return {
    x: layoutFor(2),
    o: layoutFor(1),
  }
}
