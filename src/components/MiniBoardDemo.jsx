/**
 * MiniBoardDemo — a looping SVG mini board that illustrates the best move.
 *
 * Phase loop:
 *   "before"  (1.6s) — board in pre-move state; gold rings glow around pieces that should move
 *   "after"   (2.0s) — board after best move; gold arrows show the path taken; green rings on destination pieces
 */
import { useState, useEffect } from 'react'

// ─── Board geometry ───────────────────────────────────────────────────────────
const W       = 360
const H       = 200
const FRAME   = 5
const RAIL_Y1 = 92
const RAIL_Y2 = 108
const BAR_X1  = 171
const BAR_X2  = 189

const LQ_X1 = FRAME          // left-quadrant start x
const RQ_X1 = BAR_X2         // right-quadrant start x
const PT_W  = (BAR_X1 - FRAME) / 6   // ≈ 27.7 px per point column

const TOP_Y1 = FRAME          // top of top-row triangles
const TOP_Y2 = RAIL_Y1        // tip of top-row triangles
const BOT_Y1 = RAIL_Y2        // tip of bottom-row triangles
const BOT_Y2 = H - FRAME      // base of bottom-row triangles

const CHK_R  = 9   // checker radius (px)

// Visual column order — left-to-right on screen, matching the full board
const TOP_LEFT  = [13, 14, 15, 16, 17, 18]
const TOP_RIGHT = [19, 20, 21, 22, 23, 24]
const BOT_LEFT  = [12, 11, 10,  9,  8,  7]
const BOT_RIGHT = [ 6,  5,  4,  3,  2,  1]

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function getPointMeta(n) {
  let colIdx, isTop, isLeft
  const tl = TOP_LEFT.indexOf(n)
  const tr = TOP_RIGHT.indexOf(n)
  const bl = BOT_LEFT.indexOf(n)
  const br = BOT_RIGHT.indexOf(n)

  if      (tl >= 0) { colIdx = tl; isTop = true;  isLeft = true  }
  else if (tr >= 0) { colIdx = tr; isTop = true;  isLeft = false }
  else if (bl >= 0) { colIdx = bl; isTop = false; isLeft = true  }
  else if (br >= 0) { colIdx = br; isTop = false; isLeft = false }
  else return null

  const qx = isLeft ? LQ_X1 : RQ_X1
  const cx = qx + (colIdx + 0.5) * PT_W
  return { cx, isTop, colIdx, isLeft }
}

function triPath(n) {
  const m = getPointMeta(n)
  if (!m) return ''
  const qx = m.isLeft ? LQ_X1 : RQ_X1
  const x0 = qx + m.colIdx * PT_W
  const x1 = x0 + PT_W
  const mx = (x0 + x1) / 2
  const baseY = m.isTop ? TOP_Y1 : BOT_Y2
  const tipY  = m.isTop ? TOP_Y2 : BOT_Y1
  return `M${x0},${baseY} L${x1},${baseY} L${mx},${tipY} Z`
}

function checkerPos(n, stackIdx) {
  const m = getPointMeta(n)
  if (!m) return null
  const offset = (stackIdx + 0.5) * (CHK_R * 2 + 1)
  const y = m.isTop ? TOP_Y1 + offset : BOT_Y2 - offset
  return { x: m.cx, y }
}

/** SVG quadratic-bezier path for an arrow from point `fromN` to point `toN` */
function arrowPath(fromN, toN) {
  const fm = getPointMeta(fromN)
  const tm = getPointMeta(toN)
  if (!fm || !tm) return ''

  // Start / end at the "base" of each column (where the first checker sits)
  const x1 = fm.cx
  const y1 = fm.isTop ? TOP_Y1 + CHK_R + 2 : BOT_Y2 - CHK_R - 2
  const x2 = tm.cx
  const y2 = tm.isTop ? TOP_Y1 + CHK_R + 2 : BOT_Y2 - CHK_R - 2

  // Control point curves the arrow so it doesn't pass through the board
  const mx = (x1 + x2) / 2
  let cy
  if (fm.isTop && tm.isTop) {
    cy = TOP_Y1 - 22          // arc above the board
  } else if (!fm.isTop && !tm.isTop) {
    cy = BOT_Y2 + 22          // arc below the board
  } else {
    cy = (RAIL_Y1 + RAIL_Y2) / 2   // arc through the centre rail
  }

  return `M ${x1},${y1} Q ${mx},${cy} ${x2},${y2}`
}

// ─── Main component ───────────────────────────────────────────────────────────

const DURATION = { before: 1800, after: 2200 }

const ALL_POINTS = Array.from({ length: 24 }, (_, i) => i + 1)

export default function MiniBoardDemo({ beforeState, afterState, bestMoves }) {
  const [phase, setPhase] = useState('before')

  useEffect(() => {
    const t = setTimeout(
      () => setPhase(p => p === 'before' ? 'after' : 'before'),
      DURATION[phase]
    )
    return () => clearTimeout(t)
  }, [phase])

  if (!beforeState || !afterState || !bestMoves?.length) return null

  const points     = phase === 'before' ? beforeState.points : afterState.points
  const fromSet    = new Set(bestMoves.map(m => m.from).filter(n => n >= 1 && n <= 24))
  const toSet      = new Set(bestMoves.map(m => m.to).filter(n => n >= 1 && n <= 24))
  const activeSet  = phase === 'before' ? fromSet : toSet
  const ringColor  = phase === 'before' ? '#fbbf24' : '#34d399'

  // Valid on-board arrows only
  const arrows = bestMoves.filter(m => m.from >= 1 && m.from <= 24 && m.to >= 1 && m.to <= 24)

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Phase indicator */}
      <div className="flex items-center gap-3 text-xs font-mono select-none">
        <span
          style={{
            color: phase === 'before' ? '#fbbf24' : '#4b5563',
            fontWeight: 700,
            transition: 'color 0.4s',
          }}
        >
          ● BEFORE YOUR MOVE
        </span>
        <span style={{ color: '#374151' }}>→</span>
        <span
          style={{
            color: phase === 'after' ? '#34d399' : '#4b5563',
            fontWeight: 700,
            transition: 'color 0.4s',
          }}
        >
          ● BEST MOVE
        </span>
      </div>

      {/* SVG board */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%',
          maxWidth: `${W}px`,
          borderRadius: 8,
          display: 'block',
        }}
      >
        <defs>
          {/* Arrowhead marker */}
          <marker id="mbArrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <polygon points="0,0 9,3.5 0,7" fill="#fbbf24" />
          </marker>
          {/* Glow filter for highlighted checkers */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wood frame */}
        <rect x={0} y={0} width={W} height={H} fill="#3d1c00" rx={7} />

        {/* Felt */}
        <rect x={FRAME} y={FRAME} width={W - FRAME * 2} height={H - FRAME * 2} fill="#1a5c38" />

        {/* Centre rail */}
        <rect x={FRAME} y={RAIL_Y1} width={W - FRAME * 2} height={RAIL_Y2 - RAIL_Y1} fill="#2d1400" />

        {/* Bar */}
        <rect x={BAR_X1} y={FRAME} width={BAR_X2 - BAR_X1} height={H - FRAME * 2} fill="#2d1400" />

        {/* Triangles */}
        {ALL_POINTS.map(n => {
          const isDark = n % 2 === 1
          let fill = isDark ? '#7c3200' : '#d4a96a'
          if (phase === 'before' && fromSet.has(n)) fill = 'rgba(251,146,60,0.65)'
          if (phase === 'after'  && toSet.has(n))   fill = 'rgba(52,211,153,0.55)'
          return <path key={n} d={triPath(n)} fill={fill} />
        })}

        {/* Checkers */}
        {points.map(pt => {
          if (!pt.pieces.length) return null
          const isBlack = pt.pieces[0].player_number === 1
          const fill    = isBlack ? '#1c1c1c' : '#f5f0e8'
          const stroke  = isBlack ? '#555'    : '#bbb'
          const glow    = activeSet.has(pt.number)

          return pt.pieces.map((_, i) => {
            const pos = checkerPos(pt.number, i)
            if (!pos) return null
            return (
              <g key={`${pt.number}-${i}`}>
                {/* Glow ring */}
                {glow && (
                  <circle
                    cx={pos.x} cy={pos.y} r={CHK_R + 4}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={2.5}
                    opacity={0.9}
                    filter="url(#glow)"
                  />
                )}
                {/* Checker body */}
                <circle
                  cx={pos.x} cy={pos.y} r={CHK_R}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                />
              </g>
            )
          })
        })}

        {/* Arrows — visible only in the "after" phase */}
        {phase === 'after' && arrows.map((mv, i) => {
          const d = arrowPath(mv.from, mv.to)
          if (!d) return null
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={3}
              strokeLinecap="round"
              markerEnd="url(#mbArrow)"
            />
          )
        })}

        {/* Phase label overlay (bottom-right corner) */}
        <text
          x={W - FRAME - 4}
          y={H - FRAME - 4}
          textAnchor="end"
          fontSize={8}
          fontFamily="monospace"
          fill={phase === 'before' ? '#fbbf24' : '#34d399'}
          opacity={0.7}
        >
          {phase === 'before' ? 'YOUR MOVE' : 'BEST MOVE'}
        </text>
      </svg>
    </div>
  )
}
