import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { furnitureLabelFor, furnitureRectFor, siteOf } from '../plan'
import { openingCompassForRoom } from '../analysis/walls'
import { generateRoomOptions, type RoomMeasures, type RoomOption } from '../options/roomOptions'
import type { Furniture, PlanState, Room } from '../types'
import type { StudioTheme } from '../design/themes'
import { VisualComparison } from '../comparison/VisualComparison'

function RoomDrawing({ plan, room, furniture, label }: { plan: PlanState; room: Room; furniture: Furniture[]; label: string }) {
  const site = siteOf(plan), width = room.w / 100 * site.w, depth = room.h / 100 * site.h
  const margin = Math.max(width, depth) * .1
  return <svg viewBox={`${-margin} ${-margin} ${width + margin * 2} ${depth + margin * 2}`} role="img" aria-label={`${label}: ${room.name}, ${width.toFixed(2)} by ${depth.toFixed(2)} metres`}>
    <rect className="option-room-outline" x="0" y="0" width={width} height={depth} />
    {furniture.map((f, index) => {
      const r = furnitureRectFor(f, site), x = (r.x - room.x) / 100 * site.w, y = (r.y - room.y) / 100 * site.h
      if (x >= width || y >= depth || x + r.w / 100 * site.w <= 0 || y + r.h / 100 * site.h <= 0) return null
      const w = r.w / 100 * site.w, h = r.h / 100 * site.h
      return <g key={f.id}><title>{furnitureLabelFor(f)} · {w.toFixed(2)} × {h.toFixed(2)} m{f.kind === 'wc' ? ' · fixed' : ''}</title>
        <rect className="option-furniture-outline" x={x} y={y} width={w} height={h} />
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(Math.max(width, depth) / 10, w / 2, h / 2)}>{index + 1}</text>
      </g>
    })}
    {plan.openings.filter(o => openingCompassForRoom(room, o, site) !== null).map(o => {
      const x = (o.x - room.x) / 100 * site.w, y = (o.y - room.y) / 100 * site.h
      const a = o.rotation === 0 ? (o.widthM ?? (o.type === 'door' ? .9 : 1.6)) / 2 : 0
      const b = o.rotation === 90 ? (o.widthM ?? (o.type === 'door' ? .9 : 1.6)) / 2 : 0
      return <g key={o.id}><title>{o.type} · {((a + b) * 2).toFixed(2)} m</title>
        {o.type === 'door' && <circle className="option-door-buffer" cx={x} cy={y} r={Math.max(.9, o.widthM ?? .9)} />}
        <line className={`option-opening option-opening-${o.type}`} x1={x - a} x2={x + a} y1={y - b} y2={y + b} />
      </g>
    })}
    <circle className="option-centre" cx={width / 2} cy={depth / 2} r={width / 100} />
    <text x={width / 2} y={-margin / 3} fontSize={margin / 3} textAnchor="middle">{width.toFixed(2)} m · N ↑</text>
    <text transform={`translate(${-margin / 3} ${depth / 2}) rotate(-90)`} fontSize={margin / 3} textAnchor="middle">{depth.toFixed(2)} m</text>
  </svg>
}

function MetricRows({ current, preview }: { current: RoomMeasures; preview?: RoomMeasures }) {
  const metres = (v: number | null) => v === null ? 'No desk/seat or window' : `${v.toFixed(2)} m`
  const rows = [
    ['Clearance at room centre', current.centreClearanceM, preview?.centreClearanceM],
    ['Desk/seat to window centre', current.nearestWindowM, preview?.nearestWindowM],
    ['Average furniture gap to wall', current.meanWallGapM, preview?.meanWallGapM],
  ] as const
  return <table className="room-option-metrics"><caption>Measured distances · same room and furniture sizes</caption><thead><tr><th scope="col">Geometry</th><th scope="col">Current</th><th scope="col">Preview</th></tr></thead><tbody>
    {rows.map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td>{metres(a)}</td><td>{b === undefined ? '—' : metres(b)}</td></tr>)}
  </tbody></table>
}

export default function RoomOptionsDialog({ plan, initialRoomId, onApply, onClose, theme, sunAzimuth, sunAltitude, conditionsLabel }: {
  plan: PlanState; initialRoomId?: string | null; onApply: (room: Room, option: RoomOption) => void; onClose: () => void
  theme: StudioTheme; sunAzimuth: number; sunAltitude: number; conditionsLabel: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [roomId, setRoomId] = useState(plan.rooms.find(r => r.id === initialRoomId)?.id ?? plan.rooms[0]?.id)
  const [index, setIndex] = useState(0)
  const room = plan.rooms.find(r => r.id === roomId)
  const result = useMemo(() => room ? generateRoomOptions(plan, room) : null, [plan, room])
  const option = result?.options[index]
  const preview = useMemo(() => option ? { ...plan, furniture: option.furniture } : plan, [plan, option])
  const [showSpatial, setShowSpatial] = useState(false)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])
  return createPortal(<dialog ref={ref} className="room-options-dialog" aria-labelledby="room-options-title" onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); onClose() }}>
    <header><div><p className="room-options-kicker">Same room. Different possibilities.</p><h2 id="room-options-title">Room options</h2></div><button type="button" onClick={onClose}>Close room options</button></header>
    <div className="room-options-chooser"><label htmlFor="room-options-room">Room</label><select id="room-options-room" value={roomId} onChange={e => { setRoomId(e.target.value); setIndex(0) }}>{plan.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
    <p>Existing pieces, real footprints. Walls, windows, doors and WC fixtures stay in place. Previewing changes nothing in your drawing.</p>
    {room && result && <>
      {result.options.length > 0 && <div className="room-option-choices" role="group" aria-label="Arrangement previews">{result.options.map((o, i) => <button type="button" key={o.goal} aria-pressed={index === i} onClick={() => setIndex(i)}><span>0{i + 1}</span><strong>{o.title}</strong></button>)}</div>}
      <div className="room-option-drawings">
        <figure><figcaption>Current drawing</figcaption><RoomDrawing plan={plan} room={room} furniture={plan.furniture} label="Current arrangement" /></figure>
        <figure><figcaption>{option ? `${option.title} · preview` : 'Keep current drawing'}</figcaption><RoomDrawing plan={plan} room={room} furniture={option?.furniture ?? plan.furniture} label="Preview arrangement" /></figure>
      </div>
      <button type="button" className="room-option-spatial-toggle" aria-expanded={showSpatial} onClick={() => setShowSpatial(value => !value)}>{showSpatial ? 'Hide full-house comparison' : 'Preview in the full house'}</button>
      {showSpatial && <><p className="room-option-method">Shared sunlight: {conditionsLabel} · {sunAltitude.toFixed(1)}° altitude / {sunAzimuth.toFixed(1)}° bearing. Preview changes no saved geometry.</p><VisualComparison baseline={plan} proposed={preview} theme={theme} sunAzimuth={sunAzimuth} sunAltitude={sunAltitude} baselineLabel="Current drawing" proposedLabel="Arrangement preview" /></>}
      <p className="room-option-inventory">Inventory: {plan.furniture.filter(f => {
        const r = furnitureRectFor(f, siteOf(plan))
        return r.x + r.w / 2 >= room.x && r.x + r.w / 2 < room.x + room.w && r.y + r.h / 2 >= room.y && r.y + r.h / 2 < room.y + room.h
      }).map(f => {
        const r = furnitureRectFor({ ...f, rotated: false }, siteOf(plan)), site = siteOf(plan)
        return `${plan.furniture.indexOf(f) + 1}. ${furnitureLabelFor(f)} ${((r.w / 100) * site.w).toFixed(2)} × ${((r.h / 100) * site.h).toFixed(2)} m${f.kind === 'wc' ? ' (fixed)' : ''}`
      }).join(' · ') || 'None in this room'}</p>
      {result.issues.length > 0 && <p className="room-option-warning">Current drawing: {result.issues.join(' ')}</p>}
      {result.reason && <p className="room-option-warning" role="status">{result.reason}</p>}
      <MetricRows current={result.current} preview={option?.measures} />
      <p className="room-option-method">Centre clearance is the radius of empty floor around the centre dot. Window distance runs from the nearest desk footprint to a window centre, or uses a seat/bed if there is no desk. Dashed circles reserve a door-width buffer (minimum 0.9 m); they do not model hinges. Distances describe fit, not lux, walking routes or code compliance.</p>
      <p className="room-option-method">Local bounded search · up to eight movable pieces · no AI calls. Preview in the full house before Apply; its 3D comparison uses actual geometry and the selected city's sun. Options may trade one distance for another and are not guaranteed to improve every measure.</p>
      <footer><a href="https://spacefactor.cn" target="_blank" rel="noopener noreferrer">Workflow inspiration: SpaceFactor / HomeFactor</a><div><button type="button" onClick={onClose}>Keep current drawing</button><button type="button" className="room-option-apply" disabled={!option} onClick={() => option && onApply(room, option)}>Apply arrangement</button></div></footer>
    </>}
  </dialog>, document.body)
}
