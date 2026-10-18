import { useMemo } from 'react'
import { projectIso } from './isometric'
import { buildDrawingSheet, type DrawingSheet, type ElevationBay, type SectionSlice, type SheetRoom } from '../drawing/sheet'
import { drawingStyleById, type DrawingStyle, type DrawingStyleId } from '../drawing/styles'
import type { PlanState } from '../types'

interface Box { x: number; y: number; w: number; h: number }
interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
interface Mapped { x: number; y: number }

const PLAN: Box = { x: 28, y: 52, w: 500, h: 400 }
const PLAN_DRAW: Box = { x: 64, y: 52, w: 456, h: 372 }
const SECTION: Box = { x: 548, y: 52, w: 464, h: 190 }
const ELEVATION: Box = { x: 548, y: 262, w: 464, h: 190 }
const AXON: Box = { x: 28, y: 468, w: 984, h: 188 }

function fit(bounds: Bounds, panel: Box, flipY: boolean) {
  const padX = 22
  const padTop = 10
  const padBottom = 18
  const bw = Math.max(0.001, bounds.maxX - bounds.minX)
  const bh = Math.max(0.001, bounds.maxY - bounds.minY)
  const scale = Math.min((panel.w - padX * 2) / bw, (panel.h - padTop - padBottom) / bh)
  const usedW = bw * scale
  const usedH = bh * scale
  const ox = panel.x + (panel.w - usedW) / 2
  const oy = panel.y + padTop + (panel.h - padTop - padBottom - usedH) / 2
  return {
    scale,
    p(x: number, y: number): Mapped {
      return {
        x: ox + (x - bounds.minX) * scale,
        y: flipY ? oy + (bounds.maxY - y) * scale : oy + (y - bounds.minY) * scale,
      }
    },
  }
}

function poly(points: Array<[number, number]>, map: (x: number, y: number) => Mapped): string {
  return points.map(([x, y]) => {
    const point = map(x, y)
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
  }).join(' ')
}

function wallQuad(x1: number, y1: number, x2: number, y2: number, thickness: number): Array<[number, number]> {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * (thickness / 2)
  const ny = (dx / len) * (thickness / 2)
  return [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ]
}

function boundsOf(points: Array<[number, number]>, pad = 0): Bounds {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return {
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
  }
}

function diamondLines(room: SheetRoom): Array<[[number, number], [number, number]]> {
  const step = Math.max(0.4, Math.min(room.w, room.d) / 5)
  const x0 = room.x
  const x1 = room.x + room.w
  const y0 = room.y
  const y1 = room.y + room.d
  const lines: Array<[[number, number], [number, number]]> = []
  for (let sum = x0 + y0; sum <= x1 + y1 + 1e-6; sum += step) {
    const lo = Math.max(x0, sum - y1)
    const hi = Math.min(x1, sum - y0)
    if (hi - lo > 0.05) lines.push([[lo, sum - lo], [hi, sum - hi]])
  }
  for (let diff = x0 - y1; diff <= x1 - y0 + 1e-6; diff += step) {
    const lo = Math.max(x0, y0 + diff)
    const hi = Math.min(x1, y1 + diff)
    if (hi - lo > 0.05) lines.push([[lo, lo - diff], [hi, hi - diff]])
  }
  return lines
}

function inkOn(fill: string, ink: string): string {
  const hex = fill.replace('#', '')
  if (hex.length < 6) return ink
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16)
  const luminance = (0.299 * channel(0) + 0.587 * channel(2) + 0.114 * channel(4)) / 255
  return luminance < 0.55 ? '#f7f6f3' : ink
}

function Caption({ panel, title, style }: { panel: Box; title: string; style: DrawingStyle }) {
  return (
    <text x={panel.x} y={panel.y - 8} fill={style.muted} fontFamily={style.font} fontSize={11} letterSpacing="1.4">
      {title.toUpperCase()}
    </text>
  )
}

function OpeningDressing({
  style,
  x,
  y,
  w,
  h,
  sill,
  head,
  widthM,
}: {
  style: DrawingStyle
  x: number
  y: number
  w: number
  h: number
  sill: number
  head: number
  widthM: number
}) {
  if (w < 1 || h < 1) return null
  const midX = x + w / 2
  const midY = y + h / 2
  if (style.louvers) {
    const bands = Math.max(2, Math.round((head - sill) / 0.18))
    return (
      <g>
        {Array.from({ length: bands - 1 }, (_, index) => {
          const t = (index + 1) / bands
          const yy = y + h * (1 - t)
          return <line key={index} x1={x + 1.5} y1={yy} x2={x + w - 1.5} y2={yy} stroke={style.ink} strokeWidth={style.thinWidth} />
        })}
      </g>
    )
  }
  if (!style.muntins) return null
  if (style.id === 'high-tech') {
    const panes = Math.max(1, Math.round(widthM / 0.6))
    return (
      <g>
        {Array.from({ length: panes - 1 }, (_, index) => {
          const xx = x + (w * (index + 1)) / panes
          return <line key={index} x1={xx} y1={y} x2={xx} y2={y + h} stroke={style.accent} strokeWidth={style.thinWidth} />
        })}
      </g>
    )
  }
  return (
    <g stroke={style.accent} strokeWidth={style.thinWidth}>
      <line x1={midX} y1={y} x2={midX} y2={y + h} />
      <line x1={x} y1={midY} x2={x + w} y2={midY} />
    </g>
  )
}

function SectionDrawing({ sheet, style }: { sheet: DrawingSheet; style: DrawingStyle }) {
  const section = sheet.section
  if (!section || section.slices.length === 0) {
    return <Caption panel={SECTION} title="Section A" style={style} />
  }
  const slices = section.slices
  const minU = Math.min(...slices.map((slice) => slice.u0)) - style.eaveM - 0.35
  const maxU = Math.max(...slices.map((slice) => slice.u1)) + style.eaveM + 0.35
  const maxH = Math.max(...slices.map((slice) => slice.height)) + (style.eaveM > 0 ? 0.55 : 0.25)
  const map = fit({ minX: minU, minY: -0.2, maxX: maxU, maxY: maxH }, SECTION, true)
  const thickness = sheet.wallThickness

  return (
    <g>
      <Caption panel={SECTION} title={`Section A · looking ${section.looking}`} style={style} />
      {slices.map((slice) => {
        const room = sheet.rooms.find((item) => item.id === slice.roomId)
        const origin = map.p(slice.u0, 0)
        const far = map.p(slice.u1, slice.height)
        const x = Math.min(origin.x, far.x)
        const y = Math.min(origin.y, far.y)
        const w = Math.abs(far.x - origin.x)
        const h = Math.abs(far.y - origin.y)
        return (
          <g key={slice.roomId}>
            <rect x={x} y={y} width={w} height={h} fill={room ? style.roomFill[room.kind] : style.paper} />
            <SliceWalls slice={slice} slices={slices} map={map.p} style={style} thickness={thickness} />
            {slice.voids.filter((item) => item.kind === 'beyond').map((item) => {
              const left = map.p(item.u - item.width / 2, item.head)
              const right = map.p(item.u + item.width / 2, item.sill)
              const ox = Math.min(left.x, right.x)
              const oy = Math.min(left.y, right.y)
              const ow = Math.abs(right.x - left.x)
              const oh = Math.abs(right.y - left.y)
              return (
                <g key={item.openingId}>
                  <rect x={ox} y={oy} width={ow} height={oh} fill={style.paper} stroke={style.ink} strokeWidth={style.thinWidth} />
                  <OpeningDressing style={style} x={ox} y={oy} w={ow} h={oh} sill={item.sill} head={item.head} widthM={item.width} />
                </g>
              )
            })}
            {style.cornice && (
              <rect
                x={x}
                y={y}
                width={w}
                height={Math.max(2, h * 0.045)}
                fill={style.poche}
              />
            )}
            <text x={x + w / 2} y={y + h / 2} textAnchor="middle" fill={inkOn(room ? style.roomFill[room.kind] : style.paper, style.ink)} fontFamily={style.font} fontSize={10}>
              {slice.height.toFixed(2)} m
            </text>
          </g>
        )
      })}
      {style.eaveM > 0 && (
        <Eave
          map={map.p}
          u0={Math.min(...slices.map((slice) => slice.u0))}
          u1={Math.max(...slices.map((slice) => slice.u1))}
          height={Math.max(...slices.map((slice) => slice.height))}
          eave={style.eaveM}
          stroke={style.poche}
        />
      )}
    </g>
  )
}

function SliceWalls({
  slice,
  slices,
  map,
  style,
  thickness,
}: {
  slice: SectionSlice
  slices: SectionSlice[]
  map: (x: number, y: number) => Mapped
  style: DrawingStyle
  thickness: number
}) {
  const sharedLeft = slices.some((other) => other !== slice && Math.abs(other.u1 - slice.u0) < 0.02)
  const edges = [
    sharedLeft ? null : slice.u0,
    slice.u1,
  ].filter((value): value is number => value !== null)
  const fill = style.hatch ? 'url(#sheet-hatch)' : style.wallMode === 'outline' ? 'none' : style.poche
  return (
    <g>
      {edges.map((u) => {
        const a = map(u - thickness / 2, 0)
        const b = map(u + thickness / 2, slice.height)
        return (
          <rect
            key={u}
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill={fill === 'none' ? style.paper : fill}
            stroke={style.ink}
            strokeWidth={style.thinWidth}
          />
        )
      })}
      {slice.voids.filter((item) => item.kind === 'cut').map((item) => {
        const a = map(item.u - thickness / 2, item.head)
        const b = map(item.u + thickness / 2, item.sill)
        return (
          <rect
            key={item.openingId}
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill={style.paper}
          />
        )
      })}
      <line
        x1={map(slice.u0, 0).x}
        y1={map(slice.u0, 0).y}
        x2={map(slice.u1, 0).x}
        y2={map(slice.u1, 0).y}
        stroke={style.ink}
        strokeWidth={style.profileWidth}
      />
    </g>
  )
}

function Eave({
  map,
  u0,
  u1,
  height,
  eave,
  stroke,
}: {
  map: (x: number, y: number) => Mapped
  u0: number
  u1: number
  height: number
  eave: number
  stroke: string
}) {
  const roof = height + 0.22
  const a = map(u0 - eave, roof)
  const b = map(u1 + eave, roof)
  const c = map(u0 - eave, roof + 0.08)
  const d = map(u1 + eave, roof + 0.08)
  return (
    <g stroke={stroke} strokeWidth={1.4} fill="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
    </g>
  )
}

function ElevationDrawing({ sheet, style }: { sheet: DrawingSheet; style: DrawingStyle }) {
  const elevation = sheet.elevation
  if (!elevation || elevation.bays.length === 0) {
    return <Caption panel={ELEVATION} title="Elevation" style={style} />
  }
  const minU = Math.min(...elevation.bays.map((bay) => bay.u0)) - style.eaveM - 0.35
  const maxU = Math.max(...elevation.bays.map((bay) => bay.u1)) + style.eaveM + 0.35
  const maxH = Math.max(...elevation.bays.map((bay) => bay.height)) + (style.eaveM > 0 ? 0.55 : 0.25)
  const map = fit({ minX: minU, minY: -0.2, maxX: maxU, maxY: maxH }, ELEVATION, true)

  return (
    <g>
      <Caption panel={ELEVATION} title={`${elevation.face} elevation`} style={style} />
      {elevation.bays.map((bay) => (
        <ElevationBayShape key={`${bay.roomId}-${bay.u0}`} bay={bay} map={map.p} style={style} />
      ))}
      {style.eaveM > 0 && (
        <Eave
          map={map.p}
          u0={Math.min(...elevation.bays.map((bay) => bay.u0))}
          u1={Math.max(...elevation.bays.map((bay) => bay.u1))}
          height={Math.max(...elevation.bays.map((bay) => bay.height))}
          eave={style.eaveM}
          stroke={style.poche}
        />
      )}
    </g>
  )
}

function ElevationBayShape({
  bay,
  map,
  style,
}: {
  bay: ElevationBay
  map: (x: number, y: number) => Mapped
  style: DrawingStyle
}) {
  const origin = map(bay.u0, 0)
  const far = map(bay.u1, bay.height)
  const x = Math.min(origin.x, far.x)
  const y = Math.min(origin.y, far.y)
  const w = Math.abs(far.x - origin.x)
  const h = Math.abs(far.y - origin.y)
  const fill = style.wallMode === 'poche' ? style.paper : style.wallFill
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={style.ink} strokeWidth={style.profileWidth} />
      {bay.openings.map((opening) => {
        const a = map(opening.u - opening.width / 2, opening.head)
        const b = map(opening.u + opening.width / 2, opening.sill)
        const ox = Math.min(a.x, b.x)
        const oy = Math.min(a.y, b.y)
        const ow = Math.abs(b.x - a.x)
        const oh = Math.abs(b.y - a.y)
        return (
          <g key={opening.openingId}>
            <rect x={ox} y={oy} width={ow} height={oh} fill={style.paper} stroke={style.ink} strokeWidth={style.thinWidth} />
            {opening.type === 'window' && (
              <OpeningDressing style={style} x={ox} y={oy} w={ow} h={oh} sill={opening.sill} head={opening.head} widthM={opening.width} />
            )}
          </g>
        )
      })}
      {style.cornice && <rect x={x} y={y} width={w} height={Math.max(2, h * 0.045)} fill={style.poche} />}
    </g>
  )
}

function AxonDrawing({ sheet, style }: { sheet: DrawingSheet; style: DrawingStyle }) {
  const blocks = [...sheet.rooms].sort((a, b) => (a.x + a.y) - (b.x + b.y))
  const faces = blocks.flatMap((room) => {
    const { x, y, w, d, height } = room
    return [
      [projectIso(x, y + d, 0), projectIso(x + w, y + d, 0), projectIso(x + w, y + d, height), projectIso(x, y + d, height)],
      [projectIso(x + w, y + d, 0), projectIso(x + w, y, 0), projectIso(x + w, y, height), projectIso(x + w, y + d, height)],
      [projectIso(x, y, height), projectIso(x + w, y, height), projectIso(x + w, y + d, height), projectIso(x, y + d, height)],
    ]
  })
  if (faces.length === 0) return <Caption panel={AXON} title="Axonometric" style={style} />
  const points = faces.flatMap((face) => face.map((point) => [point.x, point.y] as [number, number]))
  const map = fit(boundsOf(points, 4), AXON, false)
  return (
    <g>
      <Caption panel={AXON} title="Axonometric · same footprints and ceilings" style={style} />
      {blocks.map((room) => {
        const { x, y, w, d, height } = room
        const left = [projectIso(x, y + d, 0), projectIso(x + w, y + d, 0), projectIso(x + w, y + d, height), projectIso(x, y + d, height)]
        const right = [projectIso(x + w, y + d, 0), projectIso(x + w, y, 0), projectIso(x + w, y, height), projectIso(x + w, y + d, height)]
        const top = [projectIso(x, y, height), projectIso(x + w, y, height), projectIso(x + w, y + d, height), projectIso(x, y + d, height)]
        const label = projectIso(x + w / 2, y + d / 2, height)
        const mapped = map.p(label.x, label.y)
        return (
          <g key={room.id}>
            <polygon points={poly(left.map((point) => [point.x, point.y]), map.p)} fill={style.poche} fillOpacity={style.wallMode === 'outline' ? 0.18 : 0.78} stroke={style.ink} strokeWidth={style.thinWidth} />
            <polygon points={poly(right.map((point) => [point.x, point.y]), map.p)} fill={style.wallFill} stroke={style.ink} strokeWidth={style.thinWidth} />
            <polygon points={poly(top.map((point) => [point.x, point.y]), map.p)} fill={style.roomFill[room.kind]} stroke={style.ink} strokeWidth={style.profileWidth} />
            <text x={mapped.x} y={mapped.y} textAnchor="middle" fill={style.ink} fontFamily={style.font} fontSize={10}>
              {room.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function DrawingSheet({ plan, styleId }: { plan: PlanState; styleId: DrawingStyleId }) {
  const style = drawingStyleById(styleId)
  const sheet = useMemo(() => buildDrawingSheet(plan), [plan])
  const planFit = useMemo(() => {
    const points: Array<[number, number]> = []
    for (const room of sheet.rooms) {
      points.push([room.x, room.y], [room.x + room.w, room.y + room.d])
    }
    for (const wall of sheet.walls) points.push([wall.x1, wall.y1], [wall.x2, wall.y2])
    for (const opening of sheet.openings) {
      points.push([opening.x1, opening.y1], [opening.x2, opening.y2])
      if (opening.swing) points.push([opening.swing.openX, opening.swing.openY])
    }
    if (sheet.section) points.push([sheet.section.x1, sheet.section.y1], [sheet.section.x2, sheet.section.y2])
    if (points.length === 0) return null
    return fit(boundsOf(points, 0.4), PLAN_DRAW, false)
  }, [sheet])

  const area = sheet.totals.area
  const summary = sheet.rooms.length === 0
    ? 'Draw a room. This sheet is measured from that room.'
    : `${area.toFixed(1)} m²  ·  ${sheet.extents.width.toFixed(2)} × ${sheet.extents.depth.toFixed(2)} m  ·  ${sheet.totals.roomCount} rooms  ·  ${sheet.totals.openingCount} openings`
  const method = style.eaveM > 0
    ? `Walls ${sheet.wallThickness.toFixed(2)} m, the same thickness as the 3D model. Eaves extend ${style.eaveM.toFixed(1)} m past the walls as a graphic convention.`
    : `Walls ${sheet.wallThickness.toFixed(2)} m, the same thickness as the 3D model. Section A is the cut through the most floor area.`

  return (
    <svg className="drawing-sheet" viewBox="0 0 1040 760" role="img" aria-label={`${style.name} drawing of the current plan, ${area.toFixed(1)} square meters`}>
      <defs>
        <pattern id="sheet-hatch" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M-1,1 l2,-2 M0,7 l7,-7 M6,8 l2,-2" stroke={style.ink} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="1040" height="760" fill={style.paper} />
      {style.id === 'fancy' && (
        <g fill="none" stroke={style.accent}>
          <rect x="12" y="12" width="1016" height="736" strokeWidth="1.2" />
          <rect x="16" y="16" width="1008" height="728" strokeWidth="0.4" />
        </g>
      )}
      {style.id === 'postmodern' && <rect x="28" y="22" width="14" height="14" fill={style.accent} />}
      <text x={style.id === 'postmodern' ? 50 : 28} y={34} fill={style.ink} fontFamily={style.font} fontSize={20}>
        {style.name}
      </text>
      <text x={1012} y={34} textAnchor="end" fill={style.muted} fontFamily={style.font} fontSize={12}>
        {style.note}
      </text>

      {planFit && sheet.rooms.length > 0 ? (
        <g>
          <Caption panel={PLAN} title="Plan" style={style} />
          {style.grid && sheet.rooms.length > 0 && (
            <GridLines sheet={sheet} map={planFit.p} style={style} />
          )}
          {sheet.rooms.map((room) => {
            const origin = planFit.p(room.x, room.y)
            const far = planFit.p(room.x + room.w, room.y + room.d)
            const x = Math.min(origin.x, far.x)
            const y = Math.min(origin.y, far.y)
            const w = Math.abs(far.x - origin.x)
            const h = Math.abs(far.y - origin.y)
            return (
              <g key={room.id}>
                <rect x={x} y={y} width={w} height={h} fill={style.roomFill[room.kind]} />
                {style.diamond && diamondLines(room).map((line, index) => {
                  const a = planFit.p(line[0][0], line[0][1])
                  const b = planFit.p(line[1][0], line[1][1])
                  return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={style.accent} strokeWidth={style.thinWidth} opacity={0.55} />
                })}
              </g>
            )
          })}
          {sheet.walls.map((wall) => {
            const fill = style.wallMode === 'outline' ? 'none' : style.wallMode === 'poche' ? style.poche : style.wallFill
            return (
              <polygon
                key={wall.key}
                points={poly(wallQuad(wall.x1, wall.y1, wall.x2, wall.y2, wall.thickness), planFit.p)}
                fill={fill}
                stroke={style.ink}
                strokeWidth={style.wallMode === 'outline' ? style.profileWidth : style.thinWidth}
              />
            )
          })}
          {sheet.openings.map((opening) => (
            <polygon
              key={`${opening.id}-gap`}
              points={poly(wallQuad(opening.x1, opening.y1, opening.x2, opening.y2, sheet.wallThickness * 1.2), planFit.p)}
              fill={style.paper}
            />
          ))}
          {sheet.furniture.map((item) => (
            <polygon
              key={item.id}
              points={poly([[item.x, item.y], [item.x + item.w, item.y], [item.x + item.w, item.y + item.d], [item.x, item.y + item.d]], planFit.p)}
              fill={style.furniture}
              stroke={style.ink}
              strokeWidth={style.thinWidth}
            />
          ))}
          {sheet.openings.map((opening) => {
            const a = planFit.p(opening.x1, opening.y1)
            const b = planFit.p(opening.x2, opening.y2)
            return (
              <g key={opening.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={style.ink} strokeWidth={style.profileWidth} />
                {opening.swing && (
                  <path
                    d={`M ${planFit.p(opening.swing.closedX, opening.swing.closedY).x.toFixed(2)} ${planFit.p(opening.swing.closedX, opening.swing.closedY).y.toFixed(2)} A ${(opening.swing.radius * planFit.scale).toFixed(2)} ${(opening.swing.radius * planFit.scale).toFixed(2)} 0 0 ${opening.swing.sweep} ${planFit.p(opening.swing.openX, opening.swing.openY).x.toFixed(2)} ${planFit.p(opening.swing.openX, opening.swing.openY).y.toFixed(2)}`}
                    fill="none"
                    stroke={style.ink}
                    strokeWidth={style.thinWidth}
                  />
                )}
              </g>
            )
          })}
          {sheet.section && (
            <g>
              <line
                x1={planFit.p(sheet.section.x1, sheet.section.y1).x}
                y1={planFit.p(sheet.section.x1, sheet.section.y1).y}
                x2={planFit.p(sheet.section.x2, sheet.section.y2).x}
                y2={planFit.p(sheet.section.x2, sheet.section.y2).y}
                stroke={style.cut}
                strokeWidth={style.profileWidth}
                strokeDasharray="7 4"
              />
              {[planFit.p(sheet.section.x1, sheet.section.y1), planFit.p(sheet.section.x2, sheet.section.y2)].map((point, index) => (
                <g key={index}>
                  <circle cx={point.x} cy={point.y} r={8} fill={style.paper} stroke={style.cut} strokeWidth={style.profileWidth} />
                  <text x={point.x} y={point.y + 3} textAnchor="middle" fill={style.cut} fontFamily={style.font} fontSize={9}>A</text>
                </g>
              ))}
            </g>
          )}
          {sheet.rooms.map((room) => {
            const center = planFit.p(room.x + room.w / 2, room.y + room.d / 2)
            const width = room.w * planFit.scale
            if (width < 36) return null
            return (
              <g key={`${room.id}-label`}>
                <text x={center.x} y={center.y - 2} textAnchor="middle" fill={inkOn(style.roomFill[room.kind], style.ink)} fontFamily={style.font} fontSize={11}>
                  {room.name}
                </text>
                <text x={center.x} y={center.y + 12} textAnchor="middle" fill={inkOn(style.roomFill[room.kind], style.muted)} fontFamily={style.font} fontSize={10}>
                  {room.area.toFixed(1)} m²
                </text>
              </g>
            )
          })}
          <NorthArrow panel={PLAN} style={style} />
          <ScaleBar panel={PLAN} meters={sheet.scaleBarM} scale={planFit.scale} style={style} />
        </g>
      ) : (
        <text x={PLAN.x} y={PLAN.y + 28} fill={style.muted} fontFamily={style.font} fontSize={14}>
          Draw a room to measure the plan, section, elevation, and axonometric.
        </text>
      )}

      <SectionDrawing sheet={sheet} style={style} />
      <ElevationDrawing sheet={sheet} style={style} />
      <AxonDrawing sheet={sheet} style={style} />

      <line x1={28} y1={672} x2={1012} y2={672} stroke={style.muted} strokeWidth={0.6} />
      <text x={28} y={694} fill={style.ink} fontFamily={style.font} fontSize={13}>{summary}</text>
      <text x={28} y={714} fill={style.muted} fontFamily={style.font} fontSize={11}>{method}</text>
      <text x={1012} y={714} textAnchor="end" fill={style.muted} fontFamily={style.font} fontSize={11}>
        Graphic style only · quantities match the plan
      </text>
    </svg>
  )
}

function GridLines({ sheet, map, style }: { sheet: DrawingSheet; map: (x: number, y: number) => Mapped; style: DrawingStyle }) {
  if (sheet.rooms.length === 0) return null
  const minX = Math.min(...sheet.rooms.map((room) => room.x))
  const maxX = Math.max(...sheet.rooms.map((room) => room.x + room.w))
  const minY = Math.min(...sheet.rooms.map((room) => room.y))
  const maxY = Math.max(...sheet.rooms.map((room) => room.y + room.d))
  const step = sheet.site.unit > 0 ? sheet.site.unit : 1
  const lines: Array<[[number, number], [number, number]]> = []
  for (let x = Math.ceil(minX / step) * step; x <= maxX + 1e-6; x += step) lines.push([[x, minY], [x, maxY]])
  for (let y = Math.ceil(minY / step) * step; y <= maxY + 1e-6; y += step) lines.push([[minX, y], [maxX, y]])
  return (
    <g>
      {lines.map((line, index) => {
        const a = map(line[0][0], line[0][1])
        const b = map(line[1][0], line[1][1])
        return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={style.accent} strokeWidth={0.4} opacity={0.35} />
      })}
    </g>
  )
}

function NorthArrow({ panel, style }: { panel: Box; style: DrawingStyle }) {
  const x = panel.x + 16
  const y = panel.y + 28
  return (
    <g stroke={style.ink} fill={style.ink}>
      <line x1={x} y1={y + 22} x2={x} y2={y} strokeWidth={style.profileWidth} />
      <polygon points={`${x},${y - 4} ${x - 4},${y + 4} ${x + 4},${y + 4}`} />
      <text x={x + 8} y={y + 4} fontFamily={style.font} fontSize={11}>N</text>
    </g>
  )
}

function ScaleBar({ panel, meters, scale, style }: { panel: Box; meters: number; scale: number; style: DrawingStyle }) {
  const width = Math.max(12, meters * scale)
  const x = panel.x + 16
  const y = panel.y + panel.h - 8
  return (
    <g stroke={style.ink} fill={style.ink}>
      <line x1={x} y1={y} x2={x + width} y2={y} strokeWidth={style.profileWidth} />
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} strokeWidth={style.thinWidth} />
      <line x1={x + width} y1={y - 4} x2={x + width} y2={y + 4} strokeWidth={style.thinWidth} />
      <text x={x + width + 6} y={y + 3} fontFamily={style.font} fontSize={10}>{meters} m</text>
    </g>
  )
}
