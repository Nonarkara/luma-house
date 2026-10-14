/** Coordinates and stroke widths are paper millimetres, independent of scale. */
export function DimensionChain({ stops, k, offset, vertical = false, overall = false }: {
  stops: number[]; k: number; offset: number; vertical?: boolean; overall?: boolean
}) {
  if (stops.length < 2) return null
  const points = overall ? [stops[0], stops[stops.length - 1]] : stops
  return <g className="study-dimensions" transform={vertical ? `translate(${offset} 0) rotate(90)` : `translate(0 ${offset})`} stroke="#68717a" strokeWidth="0.18" fill="#15202b">
    <line x1={points[0] * k} x2={points[points.length - 1] * k} y1="0" y2="0" />
    {points.map(p => <g key={p}><line x1={p * k} x2={p * k} y1="-2" y2="2" /><line x1={p * k - .7} x2={p * k + .7} y1=".7" y2="-.7" strokeWidth="0.35" /></g>)}
    {points.slice(1).map((p, i) => {
      const span = p - points[i], label = `${span.toFixed(2)} m`
      // Keep every measured tick. Short intervals carry an accessible exact
      // measurement but no colliding printed number; the room schedule lists them.
      return <g key={p}><title>{label}</title>{span * k >= 10 && <text x={(p + points[i]) / 2 * k} y="-1.5" textAnchor="middle" fontSize="2.3" stroke="none">{label}</text>}</g>
    })}
  </g>
}
export function GraphicScale({ k, x, y, available }: { k: number; x: number; y: number; available: number }) {
  const length = [10, 5, 2, 1, .5, .2, .1].find(n => n * k <= available) ?? .1
  return <g transform={`translate(${x} ${y})`} aria-label={`Graphic scale, ${length} metres`}>
    {[0, 1, 2, 3].map(i => <rect key={i} x={i * length * k / 4} y="0" width={length * k / 4} height="1.2" stroke="#15202b" strokeWidth="0.18" fill={i % 2 ? 'white' : '#15202b'} />)}
    <text y="4" fontSize="2.3" fill="#15202b">0</text><text x={length * k} y="4" fontSize="2.3" textAnchor="end" fill="#15202b">{length} m</text>
  </g>
}
