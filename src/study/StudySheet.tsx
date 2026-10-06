import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { furnitureRectFor, roomHeight, roomOverlaps, siteOf } from '../plan'
import { openingDimensions } from '../openingGeometry'
import { clockLabel } from '../location/solar'
import { SunChart } from '../canvas/SunChart'
import type { PlanState, ProjectLocation } from '../types'
import { FLOOR_M, roomBounds, sheetScale, wallParts } from './geometry'
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
  return <svg className="study-plan-drawing" viewBox={`-8 -8 ${width + 16} ${height + 16}`} width={`${width + 16}mm`} height={`${height + 16}mm`} role="img" aria-label={`Measured plan at 1:${scale}`}>
    <g fill="white" stroke="#15202b" strokeWidth="0.5">
      {plan.rooms.map(room => <rect key={room.id} x={room.x / 100 * width} y={room.y / 100 * height} width={room.w / 100 * width} height={room.h / 100 * height} />)}
    </g>
    <g fill="#f2f2ee" stroke="#68717a" strokeWidth="0.18">
      {plan.furniture.map(f => { const r = furnitureRectFor(f, site); return <rect key={f.id} x={r.x / 100 * width} y={r.y / 100 * height} width={r.w / 100 * width} height={r.h / 100 * height} /> })}
    </g>
    {plan.openings.map(o => {
      const d = openingDimensions(o), a = o.rotation === 0 ? d.width * k / 2 : 0, b = o.rotation === 90 ? d.width * k / 2 : 0
      const x = o.x / 100 * width, y = o.y / 100 * height
      return <g key={o.id}><line x1={x - a} y1={y - b} x2={x + a} y2={y + b} stroke="white" strokeWidth="1.2" />
        <line x1={x - a} y1={y - b} x2={x + a} y2={y + b} stroke="#68717a" strokeWidth={o.type === 'window' ? '0.25' : '0.18'} strokeDasharray={o.type === 'door' ? '1 0.6' : undefined} /></g>
    })}
    {plan.rooms.map(room => {
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
      return <text key={room.id} x={x} y={y} fontSize="2.3" textAnchor="middle" fill="#15202b"><title>{room.name}</title>{shown.map((line, i) => <tspan key={i} x={x} y={y + (i - (shown.length - 1) / 2) * 2.7 + 0.8}>{line}</tspan>)}</text>
    })}
    <line x1="0" x2={width} y1={sectionDepth * k} y2={sectionDepth * k} stroke="#15202b" strokeWidth="0.18" strokeDasharray="2 1" />
    <text x="-3" y={sectionDepth * k} fontSize="2.5" fill="#15202b">A</text><text x={width + 2} y={sectionDepth * k} fontSize="2.5" fill="#15202b">A</text>
    <g stroke="#68717a" strokeWidth="0.18"><line x1="0" y1={height + 3} x2={width} y2={height + 3} /><line x1="0" y1={height + 1} x2="0" y2={height + 5} /><line x1={width} y1={height + 1} x2={width} y2={height + 5} /></g>
    <text x={width / 2} y={height + 7} textAnchor="middle" fontSize="2.5" fill="#15202b">{site.w.toFixed(2)} m drawing field</text>
    <text x={width + 3} y="-3" fontSize="2.5" fill="#15202b">N ↑</text>
  </svg>
}
export function SectionDrawing({ plan, scale, depth }: { plan: PlanState; scale: number; depth: number }) {
  const site = siteOf(plan), k = 1000 / scale
  const max = Math.max(3, ...plan.rooms.map(roomHeight)) + FLOOR_M
  const z = depth - site.h / 2
  const parts = plan.rooms.filter(r => r.kind !== 'terrace').flatMap(r => (['N', 'S', 'E', 'W'] as const).flatMap(c => wallParts(r, c, plan)))
    .filter(p => z >= p.position[2] - p.size[2] / 2 && z <= p.position[2] + p.size[2] / 2)
  return <svg className="study-section-drawing" viewBox={`-8 -5 ${site.w * k + 16} ${max * k + 14}`} width={`${site.w * k + 16}mm`} height={`${max * k + 14}mm`} role="img" aria-label={`Section A–A at 1:${scale}`}>
    {plan.rooms.filter(r => { const b = roomBounds(r, site); return z >= b.minZ && z <= b.maxZ }).map(r => {
      const b = roomBounds(r, site)
      return <rect key={r.id} x={(b.minX + site.w / 2) * k} y={(max - FLOOR_M) * k} width={b.width * k} height={FLOOR_M * k} fill="#15202b" />
    })}
    {parts.map((p, i) => <rect key={i} x={(p.position[0] - p.size[0] / 2 + site.w / 2) * k} y={(max - p.position[1] - p.size[1] / 2) * k} width={p.size[0] * k} height={p.size[1] * k} fill="#15202b" />)}
    <line x1="0" y1={max * k} x2={site.w * k} y2={max * k} stroke="#15202b" strokeWidth="0.5" />
    <text x={site.w * k / 2} y={max * k + 6} fontSize="2.5" textAnchor="middle" fill="#15202b">A–A · {depth.toFixed(2)} m from north edge</text>
  </svg>
}
export function StudySheet({ plan, title, location, day, hour, year, settings, capture, close }: {
  plan: PlanState; title: string; location: ProjectLocation; day: number; hour: number; year: number
  settings: StudySettings; capture: StudyCapture; close: () => void
}) {
  const site = siteOf(plan), scale = sheetScale(site, Math.max(0, ...plan.rooms.map(roomHeight)))
  const [depth, setDepth] = useState(() => {
    const largest = [...plan.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0]
    return largest ? (largest.y + largest.h / 2) / 100 * site.h : site.h / 2
  })
  const date = new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10)
  return <StudyDialog label="Printable study sheet" close={close} className="study-sheet-dialog">
    <div className="study-dialog-controls"><strong>Study sheet</strong><span>A4 landscape · print at 100% · save as PDF</span><label>Section A–A<input type="range" aria-label="Sheet section depth" min={0} max={site.h} step={0.1} value={depth} onChange={e => setDepth(Number(e.target.value))} />{depth.toFixed(1)} m from north</label><button type="button" onClick={() => window.print()}>Print / Save PDF</button><button type="button" onClick={close}>Close study sheet</button></div>
    <article className="study-paper" aria-label="Architectural and sun study sheet">
      <header><img src="./brand/designon-wordmark.png" alt="designon" /><div><h1>{title}</h1><p>{location.label} · {date} · {clockLabel(hour)} · {location.timezone}</p></div><strong>Concept study<br />1:{scale}</strong></header>
      <div className="study-sheet-grid">
        <section><h2>01 / Measured plan · 1:{scale}</h2><PlanDrawing plan={plan} scale={scale} sectionDepth={depth} /></section>
        <section><h2>02 / Current {capture.camera.projection === 'orthographic' ? 'parallel' : 'perspective'} view</h2><img className="study-captured-view" src={capture.image} alt="Captured view of this drawing with its current sun and section settings" /><p>{settings.style} · cut {settings.sectionHeight.toFixed(1)} m · {settings.shadows ? 'full building in shadow model' : 'shadows off'}</p></section>
        <section><h2>03 / Wall section A–A · 1:{scale}</h2><SectionDrawing plan={plan} scale={scale} depth={depth} /></section>
        <section><h2>04 / Sun path · local civil time</h2><SunChart latitude={location.latitude} location={location} day={day} hour={hour} year={year} locationLabel={location.name} /></section>
      </div>
      <footer>{roomOverlaps(plan.rooms).size > 0 && <strong>Rooms overlap: area and climate analysis need correction. </strong>}Geometry from your drawing · assumed wall thickness 150 mm · clear-sky sun from SunCalc · terrain and neighbours not modeled. Confirm dimensions before construction. Scale applies to plan and section when printed at 100%.</footer>
    </article>
  </StudyDialog>
}
