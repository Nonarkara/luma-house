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

export function moveOpening(opening: Opening, dx: number, dy: number, snapGrid: boolean): Opening {
  return {
    ...opening,
    x: Math.max(1, Math.min(99, snap(opening.x + dx, snapGrid))),
    y: Math.max(1, Math.min(99, snap(opening.y + dy, snapGrid))),
  }
}

export interface StrokePoint {
  x: number
  y: number
}

// ponytail: the stroke's bounding box — an L-shaped stroke becomes its enclosing
// rectangle. Polygon rooms come when the model grows non-rectangular walls.
export function strokeToRoomRect(points: StrokePoint[]): Pick<Room, 'x' | 'y' | 'w' | 'h'> | null {
  if (points.length < 2) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX
  const h = Math.max(...ys) - minY
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
): { x: number; y: number } {
  return {
    x: ((clientX - bounds.left) / bounds.width) * 100,
    y: ((clientY - bounds.top) / bounds.height) * 100,
  }
}
