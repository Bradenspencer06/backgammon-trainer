/**
 * Checker — a single game piece rendered as a styled circle.
 * Sizing is driven by the parent container (w-full + aspect-square),
 * so the Point component controls how big each checker appears.
 */
export default function Checker({ color }) {
  const isWhite = color === 'white'

  return (
    <div
      className="w-full aspect-square rounded-full flex-shrink-0"
      style={{
        backgroundColor: isWhite ? '#f0ebe0' : '#1c1c1c',
        border: isWhite ? '2px solid #c8b89a' : '2px solid #444',
        boxShadow: isWhite
          ? 'inset 0 -2px 4px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.4)'
          : 'inset 0 -2px 4px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.5)',
      }}
    />
  )
}
