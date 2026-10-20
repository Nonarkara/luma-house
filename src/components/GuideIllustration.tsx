import { projectIso } from '../canvas/isometric'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { furnitureRectFor, siteOf } from '../plan'
import { GUIDE_CALLOUT_TONES } from './guideSteps'

/** Number plates on the drawing, keyed to the step list below it. */
const CALLOUTS = [
  { n: '1', x: 63, y: 76 },
  { n: '2', x: 297, y: 334 },
  { n: '3', x: 800, y: 318 },
  { n: '4', x: 991, y: 44 },
]

const site = siteOf(chinaApartmentPlan)
const x0 = Math.min(...chinaApartmentPlan.rooms.map(room => room.x))
const y0 = Math.min(...chinaApartmentPlan.rooms.map(room => room.y))
const width = Math.max(...chinaApartmentPlan.rooms.map(room => room.x + room.w)) - x0
const depth = Math.max(...chinaApartmentPlan.rooms.map(room => room.y + room.h)) - y0
const w = width / 100 * site.w, d = depth / 100 * site.h
const p = (x: number, y: number, z = 0) => {
  const point = projectIso(x, y, z, 28)
  return `${(point.x + 570).toFixed(2)},${(point.y + 145).toFixed(2)}`
}
const polygon = (...points: number[][]) => points.map(([x, y, z]) => p(x, y, z)).join(' ')

function Block({ x, y, width, depth, height, base = 0, className = '' }: {
  x: number; y: number; width: number; depth: number; height: number; base?: number; className?: string
}) {
  const top = base + height
  return <g className={`guide-object ${className}`.trim()}>
    <polygon points={polygon([x, y + depth, base], [x + width, y + depth, base], [x + width, y + depth, top], [x, y + depth, top])} />
    <polygon points={polygon([x + width, y + depth, base], [x + width, y, base], [x + width, y, top], [x + width, y + depth, top])} />
    <polygon points={polygon([x, y, top], [x + width, y, top], [x + width, y + depth, top], [x, y + depth, top])} />
  </g>
}

/** Original instruction artwork. The plan and furniture use our 50m² sample;
 * the cutaway, detached window and beam explain tools, not simulated results. */
export function GuideIllustration() {
  return <svg className="guide-illustration" viewBox="0 0 1040 390" role="img" aria-labelledby="guide-art-title guide-art-desc">
    <title id="guide-art-title">A plan becomes a furnished house with sunlight</title>
    <desc id="guide-art-desc">One: pencil a room on a plan. Two: give one known dimension. Three: place doors, windows and furniture in the cutaway house. Four: set the city and time to study the sun and shadows. Original explanatory drawing based on the 50 square metre sample.</desc>
    <defs>
      <marker id="guide-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1 6 4 1 7" fill="none" stroke="currentColor" strokeWidth="1.2" /></marker>
    </defs>

    {/* The plan is the same apartment shown in the cutaway, not a stock icon. */}
    <g className="guide-plan" transform="translate(40 124)">
      <path d="M-10 -12H252V196H-10Z" className="guide-paper-line" />
      {chinaApartmentPlan.rooms.map(room => <rect key={room.id}
        x={(room.x - x0) / width * 220} y={(room.y - y0) / depth * 144}
        width={room.w / width * 220} height={room.h / depth * 144} />)}
      {chinaApartmentPlan.openings.filter(opening => opening.type === 'window').map(opening => <path key={opening.id}
        d={`M${(opening.x - x0) / width * 220 - 8},${(opening.y - y0) / depth * 144}h16`} className="guide-plan-window" />)}
      <path d="M0 166H220M0 161V171M220 161V171" className="guide-detail" />
      <text x="110" y="187" textAnchor="middle">8.75 m</text>
    </g>
    <g className="guide-pencil" transform="translate(231 77) rotate(34)">
      <path d="M0 0H15V84L7.5 101 0 84Z" />
      <path d="M0 12H15M0 84H15M5 13V84M10 13V84M5 95H10" className="guide-detail" />
    </g>
    <path d="M306 228H372L410 206" className="guide-leader" markerEnd="url(#guide-arrow)" />

    {/* Floor, back walls and cut partitions. Three line weights explain depth.
        The measured ground is a blue plinth; volumes stand on it in paper. */}
    <polygon points={polygon([0, 0, -0.2], [w, 0, -0.2], [w, d, -0.2], [0, d, -0.2])} className="guide-floor" />
    <Block x={0} y={0} width={w} depth={d} height={0.16} base={-0.16} className="guide-slab" />
    <polygon points={polygon([0, 0, 0], [w, 0, 0], [w, 0, 2.75], [0, 0, 2.75])} className="guide-wall" />
    <polygon points={polygon([0, 0, 0], [0, d, 0], [0, d, 2.75], [0, 0, 2.75])} className="guide-wall" />
    <path d={`M${p(0, 0, 2.75)}L${p(w, 0, 2.75)}M${p(0, 0, 2.75)}L${p(0, d, 2.75)}`} className="guide-profile" />
    {chinaApartmentPlan.rooms.map(room => {
      const x = (room.x - x0) / 100 * site.w, y = (room.y - y0) / 100 * site.h
      const rw = room.w / 100 * site.w, rd = room.h / 100 * site.h
      return <polygon key={room.id} points={polygon([x, y, 0.01], [x + rw, y, 0.01], [x + rw, y + rd, 0.01], [x, y + rd, 0.01])} className="guide-room-line" />
    })}
    {/* Daylight lands on the floor, so it is drawn before the volumes stand in it. */}
    <polygon points={polygon([w - 2.1, d, 0.03], [w - 0.5, d, 0.03], [w - 2.2, d - 2.3, 0.03], [w - 3.8, d - 2.3, 0.03])} className="guide-light-patch" />
    <Block x={3.92} y={0} width={0.12} depth={2.5} height={1.15} />
    <Block x={0} y={2.5} width={3.92} depth={0.12} height={1.15} />
    <Block x={6.02} y={0} width={0.12} depth={2.5} height={1.15} />

    {/* Measured furniture, simplified into assembly-style line solids. */}
    {chinaApartmentPlan.furniture.map(item => {
      const rect = furnitureRectFor(item, site)
      const x = (rect.x - x0) / 100 * site.w, y = (rect.y - y0) / 100 * site.h
      const fw = rect.w / 100 * site.w, fd = rect.h / 100 * site.h
      if (item.kind === 'bed') return <g key={item.id}>
        <Block x={x} y={y} width={fw} depth={fd} height={0.42} />
        <Block x={x + 0.08} y={y + 0.08} width={fw - 0.16} depth={0.42} height={0.1} base={0.42} />
        <path d={`M${p(x, y + fd * 0.45, 0.43)}L${p(x + fw, y + fd * 0.45, 0.43)}`} className="guide-detail" />
      </g>
      if (item.kind === 'sofa') return <g key={item.id}>
        <Block x={x} y={y} width={fw} depth={fd} height={0.4} />
        <Block x={x} y={y} width={fw} depth={0.15} height={0.4} base={0.4} />
        <Block x={x} y={y + 0.15} width={0.15} depth={fd - 0.15} height={0.2} base={0.4} />
        <Block x={x + fw - 0.15} y={y + 0.15} width={0.15} depth={fd - 0.15} height={0.2} base={0.4} />
        <path d={`M${p(x + fw / 2, y + 0.15, 0.41)}L${p(x + fw / 2, y + fd, 0.41)}`} className="guide-detail" />
      </g>
      return <g key={item.id}>
        <Block x={x} y={y} width={fw} depth={fd} height={0.1} base={0.7} />
        {[[x + 0.08, y + 0.08], [x + fw - 0.08, y + 0.08], [x + fw - 0.08, y + fd - 0.08], [x + 0.08, y + fd - 0.08]].map(([a, b], i) => <path key={i} d={`M${p(a, b, 0)}L${p(a, b, 0.7)}`} className="guide-detail" />)}
      </g>
    })}

    {/* A detached window and alignment leaders explain placement. */}
    <g className="guide-window">
      <polygon points={polygon([w - 2.1, d + 0.6, 0.9], [w - 0.5, d + 0.6, 0.9], [w - 0.5, d + 0.6, 2.1], [w - 2.1, d + 0.6, 2.1])} />
      <path d={`M${p(w - 1.3, d + 0.6, 0.9)}L${p(w - 1.3, d + 0.6, 2.1)}`} />
      <path d={`M${p(w - 2.1, d + 0.6, 0.9)}L${p(w - 2.1, d, 0.9)}M${p(w - 0.5, d + 0.6, 0.9)}L${p(w - 0.5, d, 0.9)}`} className="guide-leader" />
    </g>
    <path d={`M908 86L${p(w - 1.8, d + 0.6, 1.8)}M923 97L${p(w - 0.7, d + 0.6, 1.3)}`} className="guide-sun-ray" />
    <g className="guide-sun" transform="translate(932 61)">
      <circle r="19" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} transform={`rotate(${i * 45})`} d="M0 -29V-38" />)}
    </g>
    <path d="M802 113Q873 -12 990 128" className="guide-orbit" markerEnd="url(#guide-arrow)" />

    {/* Numbered connections refer to the readable HTML instructions below. */}
    {CALLOUTS.map((mark, index) => (
      <g key={mark.n} className={`guide-callout guide-callout--${GUIDE_CALLOUT_TONES[index]}`} transform={`translate(${mark.x} ${mark.y})`}>
        <rect x="-23" y="-23" width="46" height="46" />
        <text textAnchor="middle" y="12">{mark.n}</text>
      </g>
    ))}
    <path d={`M63 100V116M273 334H240L224 309M777 318H700L${p(w - 0.5, d + 0.6, 1.4)}M991 68V94`} className="guide-leader" />
  </svg>
}
