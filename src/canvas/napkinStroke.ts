import { boundarySpans, roomsForOpening } from '../analysis/walls'
import { roomAreaFor, siteOf } from '../plan'
import type { DrawnWall, Furniture, FurnitureKind, Opening, PlanState, Room, RoomKind, SiteSpec } from '../types'
import { MIN_ROOM, clampRoom, snapOpeningToWall, strokeToRoomRect, type StrokePoint } from './geometry'

const SHORT_MAX = 8
const LINE_ASPECT = 3.2
const MIN_WALL = 8
/** Metre-grid snap. Kept tighter than corner join so 4.4 m and 4.6 m do not leap to different metres. */
const GRID_SNAP_M = 0.3
/** Endpoint join for a hand-drawn box. About 0.5 m of miss still closes. */
const CORNER_SNAP_M = 0.6
/** A loop this close, but still open, is a missed corner rather than a new wall. */
const CORNER_NOTE_M = 1.5
const OPENING_MAX_M = 2.2

export type NapkinResult = {
  plan: PlanState
  toast: string
  label: string
  selectRoom?: string
  selectOpening?: string
  selectFurniture?: string
  /** Percent point of a gap that did not close, for the on-canvas note. */
  cornerNote?: { x: number; y: number }
}

function nid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function bbox(points: StrokePoint[]): { x: number; y: number; w: number; h: number } | null {
  const rect = strokeToRoomRect(points)
  if (rect) return rect
  if (points.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) }
}

function centroid(points: StrokePoint[]): StrokePoint | null {
  const box = bbox(points)
  if (!box) return null
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
}

function roomAt(rooms: Room[], x: number, y: number): Room | undefined {
  return rooms.find((room) => x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h)
}

function orthogonalLine(a: StrokePoint, b: StrokePoint): DrawnWall {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const y = (a.y + b.y) / 2
    return { id: nid('wall'), x1: Math.min(a.x, b.x), y1: y, x2: Math.max(a.x, b.x), y2: y }
  }
  const x = (a.x + b.x) / 2
  return { id: nid('wall'), x1: x, y1: Math.min(a.y, b.y), x2: x, y2: Math.max(a.y, b.y) }
}

function wallLength(wall: DrawnWall): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
}

function metresBetween(a: StrokePoint, b: StrokePoint, site: SiteSpec): number {
  return Math.hypot(((a.x - b.x) / 100) * site.w, ((a.y - b.y) / 100) * site.h)
}

function snapPointToGrid(point: StrokePoint, site: SiteSpec): StrokePoint {
  const unit = site.unit > 0 ? site.unit : 1
  const mx = (point.x / 100) * site.w
  const my = (point.y / 100) * site.h
  const gx = Math.round(mx / unit) * unit
  const gy = Math.round(my / unit) * unit
  return {
    x: ((Math.abs(mx - gx) <= GRID_SNAP_M ? gx : mx) / site.w) * 100,
    y: ((Math.abs(my - gy) <= GRID_SNAP_M ? gy : my) / site.h) * 100,
  }
}

/**
 * Join a new wall to existing endpoints within 0.6 m, then to the metre grid
 * within 0.3 m. Endpoint joins win so a corner that is already drawn is not
 * pulled onto a different grid line. IngeTrazo's wall snap is the reference
 * idea; this implementation is independent (docs/INGETRAZO-REUSE-REVIEW.md).
 */
function snapWallToSketch(wall: DrawnWall, plan: PlanState, site: SiteSpec): DrawnWall {
  const anchors: StrokePoint[] = []
  for (const other of plan.walls ?? []) {
    anchors.push({ x: other.x1, y: other.y1 }, { x: other.x2, y: other.y2 })
  }
  for (const room of plan.rooms) {
    anchors.push(
      { x: room.x, y: room.y },
      { x: room.x + room.w, y: room.y },
      { x: room.x, y: room.y + room.h },
      { x: room.x + room.w, y: room.y + room.h },
    )
  }
  const snapEnd = (x: number, y: number): StrokePoint => {
    const point = { x, y }
    let best = point
    let bestDist = CORNER_SNAP_M
    for (const anchor of anchors) {
      const dist = metresBetween(point, anchor, site)
      if (dist <= bestDist) {
        best = anchor
        bestDist = dist
      }
    }
    return best === point ? snapPointToGrid(point, site) : best
  }
  const a = snapEnd(wall.x1, wall.y1)
  const b = snapEnd(wall.x2, wall.y2)
  const horizontal = Math.abs(wall.x1 - wall.x2) >= Math.abs(wall.y1 - wall.y2)
  if (horizontal) {
    const locked = [a, b].filter((point) => anchors.includes(point))
    const y = locked[0]?.y ?? (a.y + b.y) / 2
    return { ...wall, x1: Math.min(a.x, b.x), y1: y, x2: Math.max(a.x, b.x), y2: y }
  }
  const locked = [a, b].filter((point) => anchors.includes(point))
  const x = locked[0]?.x ?? (a.x + b.x) / 2
  return { ...wall, x1: x, y1: Math.min(a.y, b.y), x2: x, y2: Math.max(a.y, b.y) }
}

function covers(intervals: Array<[number, number]>, start: number, end: number, tol: number): boolean {
  const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  let cursor = start
  for (const [a, b] of sorted) {
    if (b < cursor - tol) continue
    if (a > cursor + tol) return false
    cursor = Math.max(cursor, b)
    if (cursor >= end - tol) return true
  }
  return cursor >= end - tol
}

function closedRoomsFromWalls(walls: DrawnWall[], site: SiteSpec, snapM = CORNER_SNAP_M): Array<Pick<Room, 'x' | 'y' | 'w' | 'h'>> {
  const tolX = (snapM / site.w) * 100
  const tolY = (snapM / site.h) * 100
  const xs = [...new Set(walls.flatMap((wall) => [wall.x1, wall.x2]))].sort((a, b) => a - b)
  const ys = [...new Set(walls.flatMap((wall) => [wall.y1, wall.y2]))].sort((a, b) => a - b)
  const rooms: Array<Pick<Room, 'x' | 'y' | 'w' | 'h'>> = []
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      for (let k = 0; k < ys.length; k += 1) {
        for (let l = k + 1; l < ys.length; l += 1) {
          const x = xs[i]
          const right = xs[j]
          const y = ys[k]
          const bottom = ys[l]
          const w = right - x
          const h = bottom - y
          if (w < MIN_ROOM || h < MIN_ROOM) continue
          const horizontal = (yy: number) =>
            walls
              .filter((wall) => Math.abs(wall.y1 - yy) <= tolY && Math.abs(wall.y2 - yy) <= tolY)
              .map((wall) => [Math.min(wall.x1, wall.x2), Math.max(wall.x1, wall.x2)] as [number, number])
          const vertical = (xx: number) =>
            walls
              .filter((wall) => Math.abs(wall.x1 - xx) <= tolX && Math.abs(wall.x2 - xx) <= tolX)
              .map((wall) => [Math.min(wall.y1, wall.y2), Math.max(wall.y1, wall.y2)] as [number, number])
          if (
            covers(horizontal(y), x, right, tolX) &&
            covers(horizontal(bottom), x, right, tolX) &&
            covers(vertical(x), y, bottom, tolY) &&
            covers(vertical(right), y, bottom, tolY)
          ) {
            rooms.push(clampRoom({ x, y, w, h }))
          }
        }
      }
    }
  }
  return rooms
}

/** Midpoint of the widest missed corner, between the join distance and 1.5 m. */
function cornerGapPoint(walls: DrawnWall[], site: SiteSpec): { x: number; y: number } | null {
  const ends = walls.flatMap((wall, index) => [
    { x: wall.x1, y: wall.y1, wall: index },
    { x: wall.x2, y: wall.y2, wall: index },
  ])
  let best: { x: number; y: number; dist: number } | null = null
  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      if (ends[i].wall === ends[j].wall) continue
      const dist = metresBetween(ends[i], ends[j], site)
      if (dist <= CORNER_SNAP_M || dist > CORNER_NOTE_M) continue
      if (!best || dist > best.dist) best = { dist, x: (ends[i].x + ends[j].x) / 2, y: (ends[i].y + ends[j].y) / 2 }
    }
  }
  return best ? { x: best.x, y: best.y } : null
}

function wallConsumedByRoom(wall: DrawnWall, room: Pick<Room, 'x' | 'y' | 'w' | 'h'>): boolean {
  const onTop = Math.abs(wall.y1 - room.y) <= 1.5 && Math.abs(wall.y2 - room.y) <= 1.5
  const onBottom = Math.abs(wall.y1 - (room.y + room.h)) <= 1.5 && Math.abs(wall.y2 - (room.y + room.h)) <= 1.5
  const onLeft = Math.abs(wall.x1 - room.x) <= 1.5 && Math.abs(wall.x2 - room.x) <= 1.5
  const onRight = Math.abs(wall.x1 - (room.x + room.w)) <= 1.5 && Math.abs(wall.x2 - (room.x + room.w)) <= 1.5
  if (onTop || onBottom) {
    return Math.min(wall.x1, wall.x2) >= room.x - 1.5 && Math.max(wall.x1, wall.x2) <= room.x + room.w + 1.5
  }
  if (onLeft || onRight) {
    return Math.min(wall.y1, wall.y2) >= room.y - 1.5 && Math.max(wall.y1, wall.y2) <= room.y + room.h + 1.5
  }
  return false
}

function inferRoomKind(areaM2: number, existing: Room[]): RoomKind {
  if (areaM2 < 5) return 'bathroom'
  if (areaM2 < 16) return existing.some((room) => room.kind === 'living') ? 'bedroom' : 'living'
  return existing.some((room) => room.kind === 'living') ? 'studio' : 'living'
}

function roomName(kind: RoomKind, existing: Room[]): string {
  const count = existing.filter((room) => room.kind === kind).length + 1
  const labels: Record<RoomKind, string> = {
    living: 'Living',
    kitchen: 'Kitchen',
    bedroom: 'Bedroom',
    bathroom: 'Bathroom',
    studio: 'Room',
    terrace: 'Terrace',
  }
  return count === 1 ? labels[kind] : `${labels[kind]} ${count}`
}

function classifyFurniture(wM: number, dM: number, host: Room): FurnitureKind {
  const min = Math.min(wM, dM)
  const max = Math.max(wM, dM)
  if (host.kind === 'bathroom' || (max < 0.95 && min < 0.8)) return 'wc'
  if (min < 0.75 && max >= 1.2) return 'wardrobe'
  if (min >= 0.55 && min <= 1.15 && max >= 1.5) return 'sofa'
  if (min >= 0.7 && max >= 1.4) return 'bed'
  if (min < 0.95 && max < 1.8) return 'desk'
  return 'bed'
}

function splitRoom(room: Room, wall: DrawnWall): [Room, Room] | null {
  const vertical = Math.abs(wall.x1 - wall.x2) <= 1.5
  const horizontal = Math.abs(wall.y1 - wall.y2) <= 1.5
  if (vertical) {
    const x = wall.x1
    if (x < room.x + MIN_ROOM || x > room.x + room.w - MIN_ROOM) return null
    const spans = Math.min(wall.y1, wall.y2) <= room.y + 2 && Math.max(wall.y1, wall.y2) >= room.y + room.h - 2
    if (!spans) return null
    const left = { ...room, id: nid('room'), w: x - room.x }
    const right = { ...room, id: nid('room'), x, w: room.x + room.w - x, name: `${room.name} b` }
    return [left, right]
  }
  if (horizontal) {
    const y = wall.y1
    if (y < room.y + MIN_ROOM || y > room.y + room.h - MIN_ROOM) return null
    const spans = Math.min(wall.x1, wall.x2) <= room.x + 2 && Math.max(wall.x1, wall.x2) >= room.x + room.w - 2
    if (!spans) return null
    const top = { ...room, id: nid('room'), h: y - room.y }
    const bottom = { ...room, id: nid('room'), y, h: room.y + room.h - y, name: `${room.name} b` }
    return [top, bottom]
  }
  return null
}

function mintRoom(rect: Pick<Room, 'x' | 'y' | 'w' | 'h'>, plan: PlanState, site: SiteSpec): Room {
  const area = roomAreaFor({ id: 'tmp', name: '', kind: 'studio', ...rect }, site)
  const kind = inferRoomKind(area, plan.rooms)
  return { id: nid('room'), name: roomName(kind, plan.rooms), kind, ...rect }
}

/**
 * A tick near a room corner is thrown away by roomsForOpening, because the
 * full opening width does not fit between the mark and the corner — on a small
 * room that silently kills the outer ~40% of every wall. The mark clearly means
 * "window here", so slide it along the wall to the nearest position where it
 * does fit rather than discarding it. Only the gesture moves; the resulting
 * opening is an ordinary one, so daylight, BOQ and the code check are unchanged.
 */
function slideOntoWallSpan(plan: PlanState, opening: Opening, site: SiteSpec): Opening {
  const horizontal = opening.rotation === 0
  const width = opening.widthM ?? (opening.type === 'door' ? 0.9 : 1.6)
  const half = width / (horizontal ? site.w : site.h) * 50
  for (const room of plan.rooms) {
    for (const span of boundarySpans(plan, room)) {
      if (span.rotation !== opening.rotation) continue
      if (Math.abs((horizontal ? opening.y : opening.x) - span.fixed) > 1.5) continue
      const along = horizontal ? opening.x : opening.y
      const clamped = Math.max(span.start + half, Math.min(span.end - half, along))
      if (clamped === along) continue
      const moved = horizontal ? { ...opening, x: clamped } : { ...opening, y: clamped }
      if (roomsForOpening(plan, moved).length > 0) return moved
    }
  }
  return opening
}

function segmentsCross(a: StrokePoint, b: StrokePoint, c: StrokePoint, d: StrokePoint): StrokePoint | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const ex = d.x - c.x
  const ey = d.y - c.y
  const denom = dx * ey - dy * ex
  if (Math.abs(denom) < 1e-8) return null
  const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denom
  const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denom
  if (t < -0.02 || t > 1.02 || u < -0.02 || u > 1.02) return null
  return { x: a.x + Math.max(0, Math.min(1, t)) * dx, y: a.y + Math.max(0, Math.min(1, t)) * dy }
}

function strokeMetres(points: StrokePoint[], site: SiteSpec): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) total += metresBetween(points[i - 1], points[i], site)
  return total
}

function crossWall(a: StrokePoint, b: StrokePoint, rooms: Room[]): { x: number; y: number; rotation: 0 | 90 } | null {
  let best: { x: number; y: number; rotation: 0 | 90; dist: number } | null = null
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  for (const room of rooms) {
    const edges: Array<{ rotation: 0 | 90; x1: number; y1: number; x2: number; y2: number }> = [
      { rotation: 0, x1: room.x, y1: room.y, x2: room.x + room.w, y2: room.y },
      { rotation: 0, x1: room.x, y1: room.y + room.h, x2: room.x + room.w, y2: room.y + room.h },
      { rotation: 90, x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.h },
      { rotation: 90, x1: room.x + room.w, y1: room.y, x2: room.x + room.w, y2: room.y + room.h },
    ]
    for (const edge of edges) {
      const hit = segmentsCross(a, b, { x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 })
      if (!hit) continue
      const dist = Math.hypot(hit.x - mid.x, hit.y - mid.y)
      if (!best || dist < best.dist) best = { ...hit, rotation: edge.rotation, dist }
    }
  }
  return best ? { x: best.x, y: best.y, rotation: best.rotation } : null
}

/**
 * A short stroke on a wall is a window, unless it is at most 1 m on an
 * interior wall or it sits in the lower quarter of the room (floor-level).
 */
function inferOpening(plan: PlanState, site: SiteSpec, seed: Opening, lengthM: number): NapkinResult | { plan: null; toast: string } {
  let opening = seed
  let matches = roomsForOpening(plan, opening)
  if (matches.length === 0) {
    opening = slideOntoWallSpan(plan, opening, site)
    matches = roomsForOpening(plan, opening)
  }
  if (matches.length === 0) return { plan: null, toast: 'Click a wall for a door or window' }
  const interior = matches.length >= 2
  const host = matches[0].room
  const floorLevel = opening.y >= host.y + host.h * 0.75
  const type: Opening['type'] = (interior && lengthM <= 1) || floorLevel ? 'door' : 'window'
  const along = (Math.max(lengthM, 0.2) / (opening.rotation === 0 ? site.w : site.h)) * 100
  const alongM = type === 'door'
    ? Math.max(0.8, Math.min(1.1, (along / 100) * (opening.rotation === 0 ? site.w : site.h)))
    : Math.max(0.9, Math.min(2.2, (along / 100) * (opening.rotation === 0 ? site.w : site.h)))
  const placed: Opening = { ...opening, type, widthM: alongM, heightM: type === 'door' ? 2.1 : 1.2, sillHeightM: type === 'door' ? 0 : 0.9 }
  return {
    plan: { ...plan, openings: [...plan.openings, placed] },
    toast: type === 'door' ? 'Door' : 'Window',
    label: type === 'door' ? 'Sketch door' : 'Sketch window',
    selectOpening: placed.id,
  }
}

/**
 * One pencil, many meanings. A line is a wall, a short stroke across a wall is
 * a window or a door, a box in empty space is a room, a box inside a room is furniture.
 */
export function applyNapkinStroke(plan: PlanState, points: StrokePoint[], site: SiteSpec = siteOf(plan)): NapkinResult | { plan: null; toast: string } {
  const box = bbox(points)
  if (!box || points.length < 2) {
    return { plan: null, toast: 'Draw a line for a wall, or a box for a room' }
  }
  const maxSide = Math.max(box.w, box.h)
  const minSide = Math.min(box.w, box.h)
  const aspect = minSide <= 0.01 ? 99 : maxSide / Math.max(minSide, 0.01)
  const center = centroid(points) ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const host = roomAt(plan.rooms, center.x, center.y)
  const isLine = aspect >= LINE_ASPECT || minSide < 5
  const isTick = minSide < 3.2 && maxSide < SHORT_MAX + 1
  const lengthM = strokeMetres(points, site)
  const crossed = lengthM <= OPENING_MAX_M ? crossWall(points[0], points[points.length - 1], plan.rooms) : null

  if (crossed) {
    const inferred = inferOpening(plan, site, {
      id: nid('op'),
      type: 'window',
      x: crossed.x,
      y: crossed.y,
      rotation: crossed.rotation,
    }, lengthM)
    if (inferred.plan) return inferred
  }

  if (isTick) {
    const snapped = snapOpeningToWall(
      {
        id: nid('op'),
        type: 'window',
        x: center.x,
        y: center.y,
        rotation: box.w >= box.h ? 0 : 90,
      },
      plan.rooms,
    )
    return inferOpening(plan, site, snapped, lengthM)
  }

  if (host && minSide >= 3.2) {
    const wM = (box.w / 100) * site.w
    const dM = (box.h / 100) * site.h
    if (wM >= 0.35 && dM >= 0.35 && wM < 3.6 && dM < 3.6) {
      const kind = classifyFurniture(wM, dM, host)
      const item: Furniture = { id: nid('f'), kind, x: box.x, y: box.y, rotated: false, wM, dM }
      return {
        plan: { ...plan, furniture: [...plan.furniture, item] },
        toast: kind === 'wc' ? 'WC' : kind === 'bed' ? 'Bed' : kind === 'wardrobe' ? 'Wardrobe' : kind === 'sofa' ? 'Sofa' : 'Desk',
        label: `Sketch ${kind}`,
        selectFurniture: item.id,
      }
    }
  }

  if (isLine) {
    const raw = orthogonalLine(points[0], points[points.length - 1])
    const wall = snapWallToSketch(raw, plan, site)
    if (wallLength(wall) < MIN_WALL) {
      return { plan: null, toast: 'Draw a longer line — a wall needs a few meters' }
    }

    const splitHost = roomAt(plan.rooms, (wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2)
    if (splitHost) {
      const parts = splitRoom(splitHost, wall)
      if (parts) {
        const [a, b] = parts
        a.kind = inferRoomKind(roomAreaFor(a, site), plan.rooms.filter((room) => room.id !== splitHost.id))
        b.kind = inferRoomKind(roomAreaFor(b, site), [...plan.rooms.filter((room) => room.id !== splitHost.id), a])
        a.name = roomName(a.kind, plan.rooms.filter((room) => room.id !== splitHost.id))
        b.name = roomName(b.kind, [...plan.rooms.filter((room) => room.id !== splitHost.id), a])
        return {
          plan: {
            ...plan,
            rooms: plan.rooms.flatMap((room) => (room.id === splitHost.id ? [a, b] : [room])),
          },
          toast: `Split into ${a.name} and ${b.name}`,
          label: 'Split room',
          selectRoom: a.id,
        }
      }
    }

    const walls = [...(plan.walls ?? []), wall]
    const closed = closedRoomsFromWalls(walls, site)
    const fresh = closed.filter((rect) =>
      !plan.rooms.some((room) =>
        Math.abs(room.x - rect.x) < 2 && Math.abs(room.y - rect.y) < 2 && Math.abs(room.w - rect.w) < 2 && Math.abs(room.h - rect.h) < 2,
      ),
    )
    if (fresh.length > 0) {
      let next: PlanState = { ...plan, walls }
      const minted: Room[] = []
      for (const rect of fresh) {
        const room = mintRoom(rect, next, site)
        minted.push(room)
        next = {
          ...next,
          rooms: [...next.rooms, room],
          walls: (next.walls ?? []).filter((item) => !wallConsumedByRoom(item, room)),
        }
      }
      const last = minted[minted.length - 1]
      return {
        plan: next,
        toast: minted.length === 1 ? `${last.name} closed` : `${minted.length} rooms closed`,
        label: 'Close room from walls',
        selectRoom: last.id,
      }
    }

    const loose = closedRoomsFromWalls(walls, site, CORNER_NOTE_M)
    const almost = loose.some((rect) =>
      !plan.rooms.some((room) =>
        Math.abs(room.x - rect.x) < 2 && Math.abs(room.y - rect.y) < 2 && Math.abs(room.w - rect.w) < 2 && Math.abs(room.h - rect.h) < 2,
      ),
    )
    const cornerNote = cornerGapPoint(walls, site)
    if (cornerNote && (almost || walls.length >= 3)) {
      return {
        plan: { ...plan, walls },
        toast: "Corners don't meet",
        label: 'Sketch wall',
        cornerNote,
      }
    }

    return {
      plan: { ...plan, walls },
      toast: 'Wall. Draw the other three sides to close a room, or click this wall for a window.',
      label: 'Sketch wall',
    }
  }

  const rect = strokeToRoomRect(points)
  if (!rect) {
    return { plan: null, toast: 'Draw a box for a room, or a line for a wall' }
  }
  const room = mintRoom(rect, plan, site)
  return {
    plan: { ...plan, rooms: [...plan.rooms, room] },
    toast: `${room.name}`,
    label: 'Sketch room',
    selectRoom: room.id,
  }
}
