import { boundarySpans, roomsForOpening } from '../analysis/walls'
import { openingDimensions } from '../openingGeometry'
import {
  furnitureRectFor,
  MODEL_WALL_THICKNESS_M,
  roomAreaFor,
  siteOf,
  TERRACE_SLAB_M,
  totalAreaFor,
  roomHeight,
} from '../plan'
import type { Compass } from '../analysis/types'
import type { Opening, PlanState, Room, RoomKind, SiteSpec } from '../types'

export interface SheetRoom {
  id: string
  name: string
  kind: RoomKind
  x: number
  y: number
  w: number
  d: number
  height: number
  area: number
}

export interface SheetWall {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  exterior: boolean
  thickness: number
}

export interface SheetSwing {
  hingeX: number
  hingeY: number
  closedX: number
  closedY: number
  openX: number
  openY: number
  radius: number
  /** SVG arc sweep-flag for a 90° leaf into the room. */
  sweep: 0 | 1
}

export interface SheetOpening {
  id: string
  type: Opening['type']
  roomId: string
  compass: Compass
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  sill: number
  head: number
  swing: SheetSwing | null
}

export interface SectionVoid {
  openingId: string
  type: Opening['type']
  /** Center along the section's horizontal axis, in meters. */
  u: number
  width: number
  sill: number
  head: number
  /** `cut` intersects this plane. `beyond` is on the far wall. */
  kind: 'cut' | 'beyond'
}

export interface SectionSlice {
  roomId: string
  name: string
  u0: number
  u1: number
  height: number
  voids: SectionVoid[]
}

export interface SectionCut {
  id: 'A'
  axis: 'ew' | 'ns'
  at: number
  looking: 'north' | 'west'
  x1: number
  y1: number
  x2: number
  y2: number
  slices: SectionSlice[]
}

export interface ElevationOpening {
  openingId: string
  type: Opening['type']
  u: number
  width: number
  sill: number
  head: number
}

export interface ElevationBay {
  roomId: string
  name: string
  u0: number
  u1: number
  height: number
  openings: ElevationOpening[]
}

export interface ElevationFace {
  compass: Compass
  face: 'North' | 'South' | 'East' | 'West'
  bays: ElevationBay[]
}

export interface SheetFurniture {
  id: string
  kind: string
  x: number
  y: number
  w: number
  d: number
}

export interface DrawingSheet {
  site: SiteSpec
  rooms: SheetRoom[]
  walls: SheetWall[]
  openings: SheetOpening[]
  furniture: SheetFurniture[]
  section: SectionCut | null
  elevation: ElevationFace | null
  extents: { width: number; depth: number }
  totals: { area: number; roomCount: number; openingCount: number }
  scaleBarM: number
  wallThickness: number
}

const FACE_NAME: Record<Compass, ElevationFace['face']> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
}

export function drawingHeight(room: Room): number {
  if (room.kind === 'terrace') {
    if (room.wallHeight !== undefined && room.wallHeight > 0) return room.wallHeight
    return TERRACE_SLAB_M
  }
  return roomHeight(room)
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function wallKey(x1: number, y1: number, x2: number, y2: number): string {
  const a = `${round3(x1)},${round3(y1)}`
  const b = `${round3(x2)},${round3(y2)}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function toRoom(room: Room, site: SiteSpec): SheetRoom {
  const x = (room.x / 100) * site.w
  const y = (room.y / 100) * site.h
  const w = (room.w / 100) * site.w
  const d = (room.h / 100) * site.h
  return {
    id: room.id,
    name: room.name,
    kind: room.kind,
    x,
    y,
    w,
    d,
    height: drawingHeight(room),
    area: roomAreaFor(room, site),
  }
}

function hostFor(plan: PlanState, opening: Opening, site: SiteSpec) {
  const matches = roomsForOpening(plan, opening)
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => {
    const area = roomAreaFor(b.room, site) - roomAreaFor(a.room, site)
    return area !== 0 ? area : a.room.id.localeCompare(b.room.id)
  })[0]
}

function swingFor(compass: Compass, x1: number, y1: number, x2: number, y2: number, width: number): SheetSwing {
  if (compass === 'N') {
    return { hingeX: x1, hingeY: y1, closedX: x2, closedY: y2, openX: x1, openY: y1 + width, radius: width, sweep: 1 }
  }
  if (compass === 'S') {
    return { hingeX: x1, hingeY: y1, closedX: x2, closedY: y2, openX: x1, openY: y1 - width, radius: width, sweep: 0 }
  }
  if (compass === 'W') {
    return { hingeX: x1, hingeY: y1, closedX: x2, closedY: y2, openX: x1 + width, openY: y1, radius: width, sweep: 0 }
  }
  return { hingeX: x1, hingeY: y1, closedX: x2, closedY: y2, openX: x1 - width, openY: y1, radius: width, sweep: 1 }
}

function openingSegment(opening: Opening, compass: Compass, site: SiteSpec) {
  const cx = (opening.x / 100) * site.w
  const cy = (opening.y / 100) * site.h
  const { width, sill, head } = openingDimensions(opening)
  const half = width / 2
  const horizontal = compass === 'N' || compass === 'S'
  return {
    x1: horizontal ? cx - half : cx,
    y1: horizontal ? cy : cy - half,
    x2: horizontal ? cx + half : cx,
    y2: horizontal ? cy : cy + half,
    width,
    sill,
    head,
    cx,
    cy,
  }
}

function chooseSection(rooms: SheetRoom[]): { axis: 'ew' | 'ns'; at: number } | null {
  if (rooms.length === 0) return null
  let best: { axis: 'ew' | 'ns'; at: number; score: number } | null = null
  for (const room of rooms) {
    for (const axis of ['ew', 'ns'] as const) {
      const at = axis === 'ew' ? room.y + room.d / 2 : room.x + room.w / 2
      let score = 0
      for (const other of rooms) {
        const crosses = axis === 'ew'
          ? at > other.y + 0.02 && at < other.y + other.d - 0.02
          : at > other.x + 0.02 && at < other.x + other.w - 0.02
        if (crosses) score += other.area
      }
      const better = !best
        || score > best.score + 1e-6
        || (Math.abs(score - best.score) <= 1e-6 && axis === 'ew' && best.axis === 'ns')
      if (better) best = { axis, at, score }
    }
  }
  return best ? { axis: best.axis, at: best.at } : null
}

function clipHead(head: number, height: number): number {
  return Math.min(head, height)
}

function sectionSlices(plan: PlanState, rooms: SheetRoom[], site: SiteSpec, axis: 'ew' | 'ns', at: number): SectionSlice[] {
  const slices: SectionSlice[] = []
  for (const room of rooms) {
    const cut = axis === 'ew'
      ? at > room.y + 0.02 && at < room.y + room.d - 0.02
      : at > room.x + 0.02 && at < room.x + room.w - 0.02
    if (!cut) continue
    const source = plan.rooms.find((item) => item.id === room.id)
    if (!source) continue
    const u0 = axis === 'ew' ? room.x : room.y
    const u1 = axis === 'ew' ? room.x + room.w : room.y + room.d
    const far: Compass = axis === 'ew' ? 'N' : 'W'
    const sides: Compass[] = axis === 'ew' ? ['E', 'W'] : ['N', 'S']
    const voids: SectionVoid[] = []
    for (const opening of plan.openings) {
      const match = roomsForOpening(plan, opening).find((item) => item.room.id === source.id)
      if (!match) continue
      const segment = openingSegment(opening, match.compass, site)
      const head = clipHead(segment.head, room.height)
      if (match.compass === far) {
        voids.push({
          openingId: opening.id,
          type: opening.type,
          u: axis === 'ew' ? segment.cx : segment.cy,
          width: segment.width,
          sill: Math.min(segment.sill, head),
          head,
          kind: 'beyond',
        })
      } else if (sides.includes(match.compass)) {
        const along = axis === 'ew' ? segment.cy : segment.cx
        if (at >= along - segment.width / 2 && at <= along + segment.width / 2) {
          const u = axis === 'ew'
            ? (match.compass === 'W' ? room.x : room.x + room.w)
            : (match.compass === 'N' ? room.y : room.y + room.d)
          voids.push({
            openingId: opening.id,
            type: opening.type,
            u,
            width: segment.width,
            sill: Math.min(segment.sill, head),
            head,
            kind: 'cut',
          })
        }
      }
    }
    voids.sort((a, b) => a.openingId.localeCompare(b.openingId))
    slices.push({ roomId: room.id, name: room.name, u0, u1, height: room.height, voids })
  }
  return slices.sort((a, b) => a.u0 - b.u0 || a.roomId.localeCompare(b.roomId))
}

function chooseFace(plan: PlanState, site: SiteSpec): Compass {
  const length: Record<Compass, number> = { N: 0, S: 0, E: 0, W: 0 }
  const openings: Record<Compass, number> = { N: 0, S: 0, E: 0, W: 0 }
  for (const room of plan.rooms) {
    for (const span of boundarySpans(plan, room)) {
      if (span.neighborIds.length > 0) continue
      const meters = span.compass === 'N' || span.compass === 'S' ? site.w : site.h
      length[span.compass] += ((span.end - span.start) / 100) * meters
    }
  }
  for (const opening of plan.openings) {
    const matches = roomsForOpening(plan, opening)
    if (matches.length !== 1) continue
    openings[matches[0].compass] += 1
  }
  let best: Compass = 'S'
  for (const compass of ['S', 'N', 'E', 'W'] as const) {
    const longer = length[compass] > length[best] + 1e-6
    const same = Math.abs(length[compass] - length[best]) <= 1e-6
    if (longer || (same && openings[compass] > openings[best])) best = compass
  }
  return best
}

function elevationOf(plan: PlanState, rooms: SheetRoom[], site: SiteSpec): ElevationFace | null {
  if (rooms.length === 0) return null
  const compass = chooseFace(plan, site)
  const horizontal = compass === 'N' || compass === 'S'
  const bays: ElevationBay[] = []
  for (const room of plan.rooms) {
    const sheetRoom = rooms.find((item) => item.id === room.id)
    if (!sheetRoom) continue
    for (const span of boundarySpans(plan, room)) {
      if (span.compass !== compass || span.neighborIds.length > 0) continue
      const meters = horizontal ? site.w : site.h
      const u0 = (span.start / 100) * meters
      const u1 = (span.end / 100) * meters
      if (u1 - u0 <= 0.02) continue
      const openings: ElevationOpening[] = []
      for (const opening of plan.openings) {
        const match = roomsForOpening(plan, opening).find((item) => item.room.id === room.id && item.compass === compass)
        if (!match) continue
        const segment = openingSegment(opening, compass, site)
        const u = horizontal ? segment.cx : segment.cy
        if (u < u0 - 1e-6 || u > u1 + 1e-6) continue
        const head = clipHead(segment.head, sheetRoom.height)
        openings.push({
          openingId: opening.id,
          type: opening.type,
          u,
          width: segment.width,
          sill: Math.min(segment.sill, head),
          head,
        })
      }
      openings.sort((a, b) => a.u - b.u || a.openingId.localeCompare(b.openingId))
      bays.push({ roomId: room.id, name: room.name, u0, u1, height: sheetRoom.height, openings })
    }
  }
  bays.sort((a, b) => a.u0 - b.u0 || a.roomId.localeCompare(b.roomId))
  return { compass, face: FACE_NAME[compass], bays }
}

export function buildDrawingSheet(plan: PlanState): DrawingSheet {
  const site = siteOf(plan)
  const rooms = plan.rooms.map((room) => toRoom(room, site))
  const area = totalAreaFor(plan.rooms, site)
  const empty: DrawingSheet = {
    site,
    rooms,
    walls: [],
    openings: [],
    furniture: [],
    section: null,
    elevation: null,
    extents: { width: 0, depth: 0 },
    totals: { area, roomCount: rooms.length, openingCount: 0 },
    scaleBarM: 1,
    wallThickness: MODEL_WALL_THICKNESS_M,
  }
  if (rooms.length === 0) return empty

  const walls = new Map<string, SheetWall>()
  for (const room of plan.rooms) {
    for (const span of boundarySpans(plan, room)) {
      const horizontal = span.compass === 'N' || span.compass === 'S'
      const x1 = ((horizontal ? span.start : span.fixed) / 100) * site.w
      const y1 = ((horizontal ? span.fixed : span.start) / 100) * site.h
      const x2 = ((horizontal ? span.end : span.fixed) / 100) * site.w
      const y2 = ((horizontal ? span.fixed : span.end) / 100) * site.h
      const key = wallKey(x1, y1, x2, y2)
      const run: SheetWall = {
        key,
        x1, y1, x2, y2,
        exterior: span.neighborIds.length === 0,
        thickness: MODEL_WALL_THICKNESS_M,
      }
      const existing = walls.get(key)
      if (!existing) walls.set(key, run)
      else if (run.exterior) existing.exterior = true
    }
  }

  const openings: SheetOpening[] = []
  for (const opening of plan.openings) {
    const host = hostFor(plan, opening, site)
    if (!host) continue
    const segment = openingSegment(opening, host.compass, site)
    openings.push({
      id: opening.id,
      type: opening.type,
      roomId: host.room.id,
      compass: host.compass,
      x1: segment.x1,
      y1: segment.y1,
      x2: segment.x2,
      y2: segment.y2,
      width: segment.width,
      sill: segment.sill,
      head: segment.head,
      swing: opening.type === 'door'
        ? swingFor(host.compass, segment.x1, segment.y1, segment.x2, segment.y2, segment.width)
        : null,
    })
  }
  openings.sort((a, b) => a.id.localeCompare(b.id))

  const furniture: SheetFurniture[] = plan.furniture.map((item) => {
    const rect = furnitureRectFor(item, site)
    return {
      id: item.id,
      kind: item.kind,
      x: (rect.x / 100) * site.w,
      y: (rect.y / 100) * site.h,
      w: (rect.w / 100) * site.w,
      d: (rect.h / 100) * site.h,
    }
  })

  const chosen = chooseSection(rooms)
  let section: SectionCut | null = null
  if (chosen) {
    const slices = sectionSlices(plan, rooms, site, chosen.axis, chosen.at)
    const minX = Math.min(...rooms.map((room) => room.x))
    const maxX = Math.max(...rooms.map((room) => room.x + room.w))
    const minY = Math.min(...rooms.map((room) => room.y))
    const maxY = Math.max(...rooms.map((room) => room.y + room.d))
    const pad = 0.8
    section = {
      id: 'A',
      axis: chosen.axis,
      at: chosen.at,
      looking: chosen.axis === 'ew' ? 'north' : 'west',
      x1: chosen.axis === 'ew' ? minX - pad : chosen.at,
      y1: chosen.axis === 'ew' ? chosen.at : minY - pad,
      x2: chosen.axis === 'ew' ? maxX + pad : chosen.at,
      y2: chosen.axis === 'ew' ? chosen.at : maxY + pad,
      slices,
    }
  }

  const minX = Math.min(...rooms.map((room) => room.x))
  const maxX = Math.max(...rooms.map((room) => room.x + room.w))
  const minY = Math.min(...rooms.map((room) => room.y))
  const maxY = Math.max(...rooms.map((room) => room.y + room.d))
  const width = maxX - minX
  const depth = maxY - minY

  return {
    site,
    rooms,
    walls: [...walls.values()].sort((a, b) => a.key.localeCompare(b.key)),
    openings,
    furniture,
    section,
    elevation: elevationOf(plan, rooms, site),
    extents: { width, depth },
    totals: { area, roomCount: rooms.length, openingCount: openings.length },
    scaleBarM: Math.max(width, depth) < 12 ? 1 : 5,
    wallThickness: MODEL_WALL_THICKNESS_M,
  }
}
