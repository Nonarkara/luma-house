import type { Opening, Room } from '../types'

export const MIN_ROOM = 12
export const GRID_SNAP = 1

export type ResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

export function snap(value: number, enabled: boolean): number {
  if (!enabled) return value
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}

export function clampRoom(room: Pick<Room, 'x' | 'y' | 'w' | 'h'>): Pick<Room, 'x' | 'y' | 'w' | 'h'> {
  const w = Math.max(MIN_ROOM, Math.min(100, room.w))
  const h = Math.max(MIN_ROOM, Math.min(100, room.h))
  const x = Math.max(0, Math.min(100 - w, room.x))
  const y = Math.max(0, Math.min(100 - h, room.y))
  return { x, y, w, h }
}

export function moveRoom(room: Room, dx: number, dy: number, snapGrid: boolean): Room {
  return {
    ...room,
    ...clampRoom({
      x: snap(room.x + dx, snapGrid),
      y: snap(room.y + dy, snapGrid),
      w: room.w,
      h: room.h,
    }),
  }
}

export function resizeRoom(
  room: Room,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  snapGrid: boolean,
): Room {
  let { x, y, w, h } = room

  if (handle.includes('e')) w = room.w + dx
  if (handle.includes('w')) {
    w = room.w - dx
    x = room.x + dx
  }
  if (handle.includes('s')) h = room.h + dy
  if (handle.includes('n')) {
    h = room.h - dy
    y = room.y + dy
  }

  // Prevent flipping past min size by locking the opposite edge.
  if (w < MIN_ROOM) {
    if (handle.includes('w')) x = room.x + room.w - MIN_ROOM
    w = MIN_ROOM
  }
  if (h < MIN_ROOM) {
    if (handle.includes('n')) y = room.y + room.h - MIN_ROOM
    h = MIN_ROOM
  }

  return {
    ...room,
    ...clampRoom({
      x: snap(x, snapGrid),
      y: snap(y, snapGrid),
      w: snap(w, snapGrid),
      h: snap(h, snapGrid),
    }),
  }
}

export function scaleRoomFromCenter(room: Room, scale: number, snapGrid: boolean): Room {
  const cx = room.x + room.w / 2
  const cy = room.y + room.h / 2
  const w = Math.max(MIN_ROOM, room.w * scale)
  const h = Math.max(MIN_ROOM, room.h * scale)
  return {
    ...room,
    ...clampRoom({
      x: snap(cx - w / 2, snapGrid),
      y: snap(cy - h / 2, snapGrid),
      w: snap(w, snapGrid),
      h: snap(h, snapGrid),
    }),
  }
}

export function moveOpening(opening: Opening, dx: number, dy: number, snapGrid: boolean, rooms: Room[] = []): Opening {
  const moved = {
    ...opening,
    x: Math.max(1, Math.min(99, snap(opening.x + dx, snapGrid))),
    y: Math.max(1, Math.min(99, snap(opening.y + dy, snapGrid))),
  }
  return snapOpeningToWall(moved, rooms)
}

// An opening is only meaningful on a wall — sun patches, ventilation scores,
// and the rendered glyph all assume it. Snap to the nearest room edge within
// reach and derive the rotation from that wall (N/S walls → horizontal glyph).
const WALL_SNAP_PCT = 5

export function snapOpeningToWall(opening: Opening, rooms: Room[]): Opening {
  let best: { distance: number; x: number; y: number; rotation: 0 | 90 } | null = null
  for (const room of rooms) {
    const right = room.x + room.w
    const bottom = room.y + room.h
    // (distance off the edge, snapped position, rotation) per wall, only when
    // the opening falls within the wall's span (with a small margin).
    const margin = 2
    const inSpanX = opening.x >= room.x - margin && opening.x <= right + margin
    const inSpanY = opening.y >= room.y - margin && opening.y <= bottom + margin
    const candidates: Array<{ distance: number; x: number; y: number; rotation: 0 | 90 }> = []
    if (inSpanX) {
      candidates.push({ distance: Math.abs(opening.y - room.y), x: opening.x, y: room.y, rotation: 0 })
      candidates.push({ distance: Math.abs(opening.y - bottom), x: opening.x, y: bottom, rotation: 0 })
    }
    if (inSpanY) {
      candidates.push({ distance: Math.abs(opening.x - room.x), x: room.x, y: opening.y, rotation: 90 })
      candidates.push({ distance: Math.abs(opening.x - right), x: right, y: opening.y, rotation: 90 })
    }
    for (const candidate of candidates) {
      if (!best || candidate.distance < best.distance) best = candidate
    }
  }
  if (!best || best.distance > WALL_SNAP_PCT) return opening
  return { ...opening, x: best.x, y: best.y, rotation: best.rotation }
}

export interface StrokePoint {
  x: number
  y: number
}

const MAX_STROKE_POINTS = 512
const MIN_STROKE_STEP = 0.15

export function appendStrokePoint(points: StrokePoint[], point: StrokePoint): StrokePoint[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return points
  const last = points[points.length - 1]
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_STROKE_STEP) return points
  if (points.length < MAX_STROKE_POINTS) return [...points, point]

  // Keep the visible stroke responsive during long pen gestures. Every time the
  // cap is reached, retain alternating samples plus the latest point.
  return [...points.filter((_, index) => index % 2 === 0), point]
}

// ponytail: the stroke's bounding box — an L-shaped stroke becomes its enclosing
// rectangle. Polygon rooms come when the model grows non-rectangular walls.
export function strokeToRoomRect(points: StrokePoint[]): Pick<Room, 'x' | 'y' | 'w' | 'h'> | null {
  if (points.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let finitePoints = 0
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    finitePoints += 1
  }
  if (finitePoints < 2) return null
  const w = maxX - minX
  const h = maxY - minY
  // A tap or a single line is not a room.
  if (w < 6 || h < 6) return null
  return clampRoom({
    x: snap(minX, true),
    y: snap(minY, true),
    w: snap(w, true),
    h: snap(h, true),
  })
}

export function clientToPercent(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
): { x: number; y: number } | null {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null
  }
  return {
    x: Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - bounds.top) / bounds.height) * 100)),
  }
}
