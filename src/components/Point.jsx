import Checker from './Checker'

const DARK_TRI  = '#7c3200'
const LIGHT_TRI = '#d4a96a'

/**
 * Point — one triangular point on the board.
 *
 * isTop:       triangle tip points DOWN; number label sits above; checkers stack down
 * isSelected:  this point is the currently selected source — shown with a glow ring
 * onClick:     called when the user taps this point (Board decides if it's valid)
 */
export default function Point({ pointNumber, isTop, pointData, isSelected, onClick }) {
  const count  = pointData?.count || 0
  const color  = pointData?.color || null
  const isDark = pointNumber % 2 === 1

  const clipPath = isTop
    ? 'polygon(0% 0%, 100% 0%, 50% 100%)'
    : 'polygon(50% 0%, 0% 100%, 100% 100%)'

  const numberLabel = (
    <div className="flex items-center justify-center flex-shrink-0" style={{ height: '1.25rem' }}>
      <span className="text-xs font-mono leading-none" style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
        {pointNumber}
      </span>
    </div>
  )

  return (
    <div
      className="flex-1 flex flex-col min-w-0 cursor-pointer"
      onClick={onClick}
    >
      {isTop && numberLabel}

      <div className="flex-1 relative">
        {/* Triangle fill */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: isDark ? DARK_TRI : LIGHT_TRI,
            clipPath,
          }}
        />

        {/* Selection highlight — semi-transparent overlay matching the triangle shape */}
        {isSelected && (
          <div
            className="absolute inset-0"
            style={{
              clipPath,
              backgroundColor: 'rgba(250, 204, 21, 0.45)',
              zIndex: 5,
            }}
          />
        )}

        {/* Checker stack anchored to the base (wide end) of the triangle */}
        {count > 0 && (
          <div
            className={`absolute left-[8%] right-[8%] flex items-center gap-0.5 ${
              isTop ? 'top-0 flex-col' : 'bottom-0 flex-col-reverse'
            }`}
            style={{ zIndex: 10 }}
          >
            {Array.from({ length: count }, (_, i) => (
              <Checker key={i} color={color} />
            ))}
          </div>
        )}
      </div>

      {!isTop && numberLabel}
    </div>
  )
}
