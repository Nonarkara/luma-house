import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { furnitureRectFor, roomHeight, roomOverlaps, siteOf } from '../plan'
import { openingDimensions } from '../openingGeometry'
import { clockLabel } from '../location/solar'
import { SunChart } from '../canvas/SunChart'
import { roomsForOpening } from '../analysis/walls'
import { DimensionChain, GraphicScale } from './DrawingAnnotations'
import { dimensionStops, planWallCuts, studyHeight, studyWalls } from './graphics'
import { SeasonalSheet } from './SeasonalSheet'
import { DrawingSheet } from '../canvas/DrawingSheet'
import { DRAWING_STYLE_IDS, DRAWING_STYLES, type DrawingStyleId } from '../drawing/styles'
import type { PlanState, ProjectLocation } from '../types'
import { FLOOR_M, roomBounds, sheetScale } from './geometry'
import type { StudyCapture, StudySettings } from './types'

export function StudyDialog({ children, label, close, className = '' }: {
  children: React.ReactNode; label: string; close: () => void; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])
  return createPortal(<dialog ref={ref} className={`study-dialog ${className}`} aria-label={label} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); close() }}>
    {children}
  </dialog>, document.body)
}

/** Pure vector drawing of the calibrated site: SVG millimetres become paper millimetres. */
export function PlanDrawing({ plan, scale, sectionDepth }: { plan: PlanState; scale: number; sectionDepth: number }) {
  const site = siteOf(plan), k = 1000 / scale, width = site.w * k, height = site.h * k
  const xStops = dimensionStops(plan, 'x'), yStops = dimensionStops(plan, 'y')
  const keyed = width <= 75 && plan.rooms.length * 6.4 <= height + 22
  const paperWidth = keyed ? 144 : width + 32
  return <svg className="study-plan-drawing" viewBox={`-16 -14 ${paperWidth} ${height + 28}`} width={`${paperWidth}mm`} height={`${height + 28}mm`} role="img" aria-label={`Measured plan at 1:${scale}`}>
    <g fill="white" stroke="#68717a" strokeWidth="0.18">
      {plan.rooms.map(room => <rect key={room.id} x={room.x / 100 * width} y={room.y / 100 * height} width={room.w / 100 * width} height={room.h / 100 * height} stroke={room.kind === 'terrace' ? '#68717a' : 'none'} strokeDasharray={room.kind === 'terrace' ? '1 1' : undefined} />)}
    </g>
    <g fill="#15202b" data-wall-thickness-m="0.15">
      {planWallCuts(plan).map((p, i) => <rect key={i} x={(p.position[0] - p.size[0] / 2 + site.w / 2) * k} y={(p.position[2] - p.size[2] / 2 + site.h / 2) * k} width={p.size[0] * k} height={p.size[2] * k} />)}
    </g>
    <g fill="#f2f2ee" stroke="#68717a" strokeWidth="0.18">
      {plan.furniture.map(f => { const r = furnitureRectFor(f, site); return <rect key={f.id} x={r.x / 100 * width} y={r.y / 100 * height} width={r.w / 100 * width} height={r.h / 100 * height} /> })}
    </g>
    {plan.openings.map(o => {
      const matches = roomsForOpening(plan, o)
      if (matches.length === 0) return null // Never erase a solid wall for an orphan marker.
      const d = openingDimensions(o), a = o.rotation === 0 ? d.width * k / 2 : 0, b = o.rotation === 90 ? d.width * k / 2 : 0
      const x = o.x / 100 * width, y = o.y / 100 * height, glazingOffset = .15 * k / 4
      const c = matches[0].compass, inward = c === 'N' || c === 'W' ? 1 : -1, leaf = d.width * k
      return <g key={o.id} stroke="#68717a" strokeWidth="0.18" fill="none"><title>{o.type} · {d.width.toFixed(2)} m{ o.type === 'door' ? ' · indicative swing; hinge not specified' : ''}</title>
        {o.type === 'window' ? <><line x1={x - a} y1={y - b} x2={x + a} y2={y + b} /><line x1={x - a + (o.rotation === 90 ? glazingOffset : 0)} y1={y - b + (o.rotation === 0 ? glazingOffset : 0)} x2={x + a + (o.rotation === 90 ? glazingOffset : 0)} y2={y + b + (o.rotation === 0 ? glazingOffset : 0)} /></> :
          <g transform={`translate(${x - a} ${y - b}) ${o.rotation === 90 ? 'rotate(90)' : ''}`}>
            <line x1="0" y1="0" x2="0" y2={(o.rotation === 90 ? -inward : inward) * leaf} />
            <path d={`M ${leaf} 0 A ${leaf} ${leaf} 0 0 ${o.rotation === 90 ? (inward > 0 ? 0 : 1) : (inward > 0 ? 1 : 0)} 0 ${(o.rotation === 90 ? -inward : inward) * leaf}`} strokeDasharray="1 .6" />
          </g>}
      </g>
    })}
    {plan.rooms.map((room, index) => {
      const limit = Math.max(3, Math.floor(room.w / 100 * width / 1.25))
      const count = Math.max(1, Math.min(3, Math.floor(room.h / 100 * height / 2.7)))
      const lines: string[] = []
      for (const word of room.name.trim().split(/\s+/)) {
        const short = word.length > limit ? `${word.slice(0, limit - 1)}…` : word
        const last = lines.length - 1
        if (last >= 0 && lines[last].length + short.length + 1 <= limit) lines[last] += ` ${short}`
        else lines.push(short)
      }
      const shown = lines.slice(0, count)
      if (lines.length > count) shown[count - 1] = `${shown[count - 1].slice(0, limit - 1)}…`
      const x = (room.x + room.w / 2) / 100 * width, y = (room.y + room.h / 2) / 100 * height
      if (keyed) return <g key={room.id} fill="#15202b" fontSize="2.3">
        <text x={x} y={y + .8} textAnchor="middle">{String(index + 1).padStart(2, '0')}</text>
        <text x={width + 20} y={-8 + index * 6.4}><title>{room.name}</title>{String(index + 1).padStart(2, '0')} / {room.name.length > 21 ? `${room.name.slice(0, 20)}…` : room.name}</text>
        <text x={width + 20} y={-5 + index * 6.4}>{(room.w / 100 * site.w).toFixed(2)} × {(room.h / 100 * site.h).toFixed(2)} m · H {roomHeight(room).toFixed(2)}</text>
      </g>
      return <text key={room.id} x={x} y={y} fontSize="2.3" textAnchor="middle" fill="#15202b"><title>{room.name}</title>{shown.map((line, i) => <tspan key={i} x={x} y={y + (i - (shown.length - 1) / 2) * 2.7 + 0.8}>{line}</tspan>)}</text>
    })}
    <line x1="-4" x2={width + 4} y1={sectionDepth * k} y2={sectionDepth * k} stroke="#15202b" strokeWidth="0.18" strokeDasharray="2 1" />
    {[-4, width + 4].map(x => <g key={x} transform={`translate(${x} ${sectionDepth * k})`} fill="#15202b"><path d="M -1 2 L 0 4 L 1 2 Z" /><text x="0" y="-1.5" textAnchor="middle" fontSize="2.5">A</text></g>)}
    <DimensionChain stops={xStops} k={k} offset={-4} /><DimensionChain stops={xStops} k={k} offset={-10} overall />
    <DimensionChain stops={yStops} k={k} offset={width + 7} vertical /><DimensionChain stops={yStops} k={k} offset={width + 13} vertical overall />
    <g stroke="#68717a" strokeWidth="0.18"><line x1="0" y1={height + 3} x2={width} y2={height + 3} /><line x1="0" y1={height + 1} x2="0" y2={height + 5} /><line x1={width} y1={height + 1} x2={width} y2={height + 5} /></g>
    <text x={width} y={height + 7} textAnchor="end" fontSize="2.3" fill="#15202b">Field {site.w.toFixed(2)} × {site.h.toFixed(2)} m</text>
    <GraphicScale k={k} x={0} y={height + 9} available={Math.max(8, width / 2)} />
    <text x="-12" y="0" fontSize="2.5" fill="#15202b">N ↑</text>
  </svg>
}
export function SectionDrawing({ plan, scale, depth, sunVector }: { plan: PlanState; scale: number; depth: number; sunVector?: { x: number; y: number } }) {
  const site = siteOf(plan), k = 1000 / scale
  const max = studyHeight(plan)
  const z = depth - site.h / 2
  const parts = studyWalls(plan)
    .filter(p => z >= p.position[2] - p.size[2] / 2 && z <= p.position[2] + p.size[2] / 2)
  const roomsAtCut = plan.rooms.filter(r => { const b = roomBounds(r, site); return z >= b.minZ && z <= b.maxZ })
  const cutHeight = Math.max(0, ...roomsAtCut.filter(r => r.kind !== 'terrace').map(roomHeight))
  const top = sunVector ? -13 : -5, margin = sunVector ? 22 : 14
  return <svg className="study-section-drawing" viewBox={`-16 ${top} ${site.w * k + 32} ${max * k + margin}`} width={`${site.w * k + 32}mm`} height={`${max * k + margin}mm`} role="img" aria-label={`Section A–A at 1:${scale}`}>
    {roomsAtCut.map(r => {
      const b = roomBounds(r, site)
      return <rect key={r.id} x={(b.minX + site.w / 2) * k} y={(max - FLOOR_M) * k} width={b.width * k} height={FLOOR_M * k} fill="#15202b" />
    })}
    {parts.map((p, i) => <rect key={i} x={(p.position[0] - p.size[0] / 2 + site.w / 2) * k} y={(max - p.position[1] - p.size[1] / 2) * k} width={p.size[0] * k} height={p.size[1] * k} fill="#15202b" />)}
    {sunVector && sunVector.y > 0 && <g stroke="#68717a" strokeWidth="0.25" fill="#68717a" aria-label="Sun direction projected onto east-west section; arrows are outside the building">
      {[.25, .5, .75].map(f => {
        const norm = Math.hypot(sunVector.x, sunVector.y), dx = -sunVector.x / norm * 7, dy = sunVector.y / norm * 7
        const x = site.w * k * f, y = -2
        return <g key={f}><line x1={x - dx} y1={y - dy} x2={x} y2={y} /><path transform={`translate(${x} ${y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`} d="M 0 0 L -1.8 -.7 L -1.8 .7 Z" /></g>
      })}
    </g>}
    <line x1="0" y1={max * k} x2={site.w * k} y2={max * k} stroke="#15202b" strokeWidth="0.5" />
    <text x={site.w * k / 2} y={max * k + 6} fontSize="2.5" textAnchor="middle" fill="#15202b">A–A · looking south · {depth.toFixed(2)} m from north</text>
    <g fill="#15202b" fontSize="2.3" textAnchor="end"><text x="-2" y={(max - FLOOR_M) * k}>±0.00</text></g>
    {cutHeight > 0 && <g fill="#15202b" fontSize="2.3"><title>Highest wall cut by section A–A</title><line x1="-1" x2="4" y1={(max - FLOOR_M - cutHeight) * k} y2={(max - FLOOR_M - cutHeight) * k} stroke="#68717a" strokeWidth="0.18" /><text x="-2" y={(max - FLOOR_M - cutHeight) * k + .8} textAnchor="end">+{cutHeight.toFixed(2)} m</text></g>}
  </svg>
}
export function StudySheet({ plan, title, location, day, hour, year, settings, capture, close }: {
  plan: PlanState; title: string; location: ProjectLocation; day: number; hour: number; year: number
  settings: StudySettings; capture: StudyCapture; close: () => void
}) {
  const site = siteOf(plan), scale = sheetScale(site, Math.max(0, ...plan.rooms.map(roomHeight)))
  const [sheet, setSheet] = useState<'summary' | 'seasonal' | 'drawing'>('summary')
  const [styleId, setStyleId] = useState<DrawingStyleId>('minimalist')
  const [depth, setDepth] = useState(() => {
    const largest = [...plan.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0]
    return largest ? (largest.y + largest.h / 2) / 100 * site.h : site.h / 2
  })
  const date = new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10)
  return <StudyDialog label="Printable study sheet" close={close} className="study-sheet-dialog">
    <div className="study-dialog-controls"><strong>Study sheet</strong><span>A4 landscape · print at 100% · save as PDF</span><div className="study-sheet-selector"><button type="button" aria-pressed={sheet === 'summary'} onClick={() => setSheet('summary')}>Plan and section</button><button type="button" aria-pressed={sheet === 'seasonal'} onClick={() => setSheet('seasonal')}>Seasonal sun</button><button type="button" aria-pressed={sheet === 'drawing'} onClick={() => setSheet('drawing')}>Elevation sheet</button></div>{sheet === 'drawing' && <div className="study-sheet-selector" role="group" aria-label="Drawing style">{DRAWING_STYLE_IDS.map(id => <button type="button" key={id} aria-pressed={styleId === id} onClick={() => setStyleId(id)}>{DRAWING_STYLES.find(s => s.id === id)?.name ?? id}</button>)}</div>}<label>Section A–A<input type="range" aria-label="Sheet section depth" min={0} max={site.h} step={0.1} value={depth} onChange={e => setDepth(Number(e.target.value))} />{depth.toFixed(1)} m from north</label><button type="button" onClick={() => window.print()}>Print / Save PDF</button><button type="button" onClick={close}>Close study sheet</button></div>
    {sheet === 'drawing' ? <DrawingSheet plan={plan} styleId={styleId} /> : sheet === 'seasonal' ? <SeasonalSheet plan={plan} title={title} location={location} hour={hour} year={year} scale={scale} depth={depth} /> : <article className="study-paper" aria-label="Architectural and sun study sheet">
      <header><img src="./brand/designon-wordmark.png" alt="designon" /><div><h1>{title}</h1><p>{location.label} · {date} · {clockLabel(hour)} · {location.timezone}</p></div><strong>A-01 · Rev 00<br />Concept study · 1:{scale}</strong></header>
      <div className="study-sheet-grid">
        <section><h2>01 / Measured plan · 1:{scale}</h2><PlanDrawing plan={plan} scale={scale} sectionDepth={depth} /></section>
        <section><h2>02 / Current {capture.camera.projection === 'orthographic' ? 'parallel' : 'perspective'} view</h2><img className="study-captured-view" src={capture.image} alt="Captured view of this drawing with its current sun and section settings" /><p>{settings.style} · cut {settings.sectionHeight.toFixed(1)} m · {settings.shadows ? 'full building in shadow model' : 'shadows off'}</p></section>
        <section><h2>03 / Wall section A–A · 1:{scale}</h2><SectionDrawing plan={plan} scale={scale} depth={depth} /></section>
        <section><h2>04 / Sun path · local civil time</h2><SunChart latitude={location.latitude} location={location} day={day} hour={hour} year={year} locationLabel={location.name} /></section>
      </div>
      <footer>{roomOverlaps(plan.rooms).size > 0 && <strong>Rooms overlap: area and climate analysis need correction. </strong>}150 mm walls assumed. Dimensions to wall centrelines; short chain labels omitted. Door swings indicative; hinges unspecified. Levels relative to finished floor. SunCalc clear sky; terrain/neighbours absent. Print 100%; confirm before construction. Graphic conventions informed by AIA, Architectural Graphic Standards, Student Edition, 11th ed. (2008); original drawings.</footer>
    </article>}
  </StudyDialog>
}
