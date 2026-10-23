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
  const w = Math.min(100, Math.max(0, room.w))
  const h = Math.min(100, Math.max(0, room.h))
  // MIN_ROOM is a floor on how small a room may be *dragged*, so it stays a
  // grabbable shape on the sheet. A room the user has *stated* a real length
  // for may be smaller than that — 1.2 m is a closet, not an error — so a
  // room already below the floor is left alone rather than inflated.
  const wFloor = Math.min(MIN_ROOM, w)
  const hFloor = Math.min(MIN_ROOM, h)
  const x = Math.max(0, Math.min(100 - w, room.x))
  const y = Math.max(0, Math.min(100 - h, room.y))
  return { x, y, w: Math.max(wFloor, w), h: Math.max(hFloor, h) }
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
  // Pick the wall from the true pointer position, never a grid-rounded one: the
  // grid can round a door off its wall line and make a cross wall look closer.
  const raw = {
    ...opening,
    x: Math.max(1, Math.min(99, opening.x + dx)),
    y: Math.max(1, Math.min(99, opening.y + dy)),
  }
  // Prefer the wall it is sliding along, so a T-junction does not flip it.
  const sameAxis = rooms.length ? snapOpeningToWall(raw, rooms, opening.rotation) : raw
  const onWall = sameAxis !== raw ? sameAxis : snapOpeningToWall(raw, rooms)
  if (onWall === raw) return { ...raw, x: snap(raw.x, snapGrid), y: snap(raw.y, snapGrid) }
  // Grid-snap only the position along the wall.
  return onWall.rotation === 0 ? { ...onWall, x: snap(onWall.x, snapGrid) } : { ...onWall, y: snap(onWall.y, snapGrid) }
}

// An opening is only meaningful on a wall — sun patches, ventilation scores,
// and the rendered glyph all assume it. Snap to the nearest room edge within
// reach and derive the rotation from that wall (N/S walls → horizontal glyph).
const WALL_SNAP_PCT = 5

export function snapOpeningToWall(opening: Opening, rooms: Room[], onlyRotation?: 0 | 90): Opening {
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
      if (onlyRotation !== undefined && candidate.rotation !== onlyRotation) continue
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

// ---------------------------------------------------------------------------
// Magnetic alignment: edges within ALIGN_M of another room's edge snap onto it,
// so walls that should be one line are one line. Guides report what locked.
// ---------------------------------------------------------------------------

export const ALIGN_M = 0.3

export interface AlignGuides {
  /** Vertical guide lines, in sheet percent. */
  x: number[]
  /** Horizontal guide lines, in sheet percent. */
  y: number[]
}

type Rect = Pick<Room, 'x' | 'y' | 'w' | 'h'>
type Edge = 'left' | 'right' | 'top' | 'bottom'

function otherEdges(others: Rect[]): { xs: number[]; ys: number[] } {
  return {
    xs: others.flatMap((r) => [r.x, r.x + r.w]),
    ys: others.flatMap((r) => [r.y, r.y + r.h]),
  }
}

function nearest(value: number, targets: number[], tolerance: number): number | null {
  let best: number | null = null
  for (const t of targets) {
    const d = Math.abs(t - value)
    if (d <= tolerance && (best === null || d < Math.abs(best - value))) best = t
  }
  return best
}

/** Tolerance in sheet percent for each axis, from a distance in metres. */
export function alignTolerance(site: { w: number; h: number }, metres = ALIGN_M): { x: number; y: number } {
  return { x: (metres / site.w) * 100, y: (metres / site.h) * 100 }
}

/** A moved room keeps its size; the closest edge on each axis pulls it into line. */
export function alignMovedRect(rect: Rect, others: Rect[], tol: { x: number; y: number }): { rect: Rect; guides: AlignGuides } {
  const { xs, ys } = otherEdges(others)
  const guides: AlignGuides = { x: [], y: [] }
  let { x, y } = rect
  let bestX: { shift: number; line: number } | null = null
  for (const edge of [rect.x, rect.x + rect.w]) {
    const line = nearest(edge, xs, tol.x)
    if (line !== null && (!bestX || Math.abs(line - edge) < Math.abs(bestX.shift))) bestX = { shift: line - edge, line }
  }
  let bestY: { shift: number; line: number } | null = null
  for (const edge of [rect.y, rect.y + rect.h]) {
    const line = nearest(edge, ys, tol.y)
    if (line !== null && (!bestY || Math.abs(line - edge) < Math.abs(bestY.shift))) bestY = { shift: line - edge, line }
  }
  if (bestX) { x += bestX.shift; guides.x.push(bestX.line) }
  if (bestY) { y += bestY.shift; guides.y.push(bestY.line) }
  return { rect: { x, y, w: rect.w, h: rect.h }, guides }
}

/** Only the given edges move; each snaps on its own. Used for resize and new rooms. */
export function alignEdges(rect: Rect, edges: Edge[], others: Rect[], tol: { x: number; y: number }): { rect: Rect; guides: AlignGuides } {
  const { xs, ys } = otherEdges(others)
  const guides: AlignGuides = { x: [], y: [] }
  let left = rect.x, right = rect.x + rect.w, top = rect.y, bottom = rect.y + rect.h
  const snapTo = (value: number, targets: number[], t: number, axis: 'x' | 'y') => {
    const line = nearest(value, targets, t)
    if (line === null) return value
    guides[axis].push(line)
    return line
  }
  if (edges.includes('left')) left = snapTo(left, xs, tol.x, 'x')
  if (edges.includes('right')) right = snapTo(right, xs, tol.x, 'x')
  if (edges.includes('top')) top = snapTo(top, ys, tol.y, 'y')
  if (edges.includes('bottom')) bottom = snapTo(bottom, ys, tol.y, 'y')
  // Never let alignment collapse a room below the minimum size.
  if (right - left < MIN_ROOM || bottom - top < MIN_ROOM) return { rect, guides: { x: [], y: [] } }
  return { rect: { x: left, y: top, w: right - left, h: bottom - top }, guides }
}

export function edgesForHandle(handle: ResizeHandle): Edge[] {
  const edges: Edge[] = []
  if (handle.includes('w')) edges.push('left')
  if (handle.includes('e')) edges.push('right')
  if (handle.includes('n')) edges.push('top')
  if (handle.includes('s')) edges.push('bottom')
  return edges
}

// ---------------------------------------------------------------------------
// Door and window width by dragging an end. The opposite end stays put.
// ---------------------------------------------------------------------------

export const OPENING_STEP_M = 0.05
export const OPENING_MIN_M = { door: 0.6, window: 0.4 } as const
// ponytail: fixed cap; clamp to the host wall's span when openings learn their wall.
export const OPENING_MAX_M = 4

export function resizeOpening(
  opening: Opening,
  end: 'start' | 'end',
  deltaAlongPct: number,
  site: { w: number; h: number },
  startWidthM: number,
): Opening {
  const axisM = opening.rotation === 0 ? site.w : site.h
  const deltaM = (deltaAlongPct / 100) * axisM
  const wanted = end === 'end' ? startWidthM + deltaM : startWidthM - deltaM
  const stepped = Math.round(wanted / OPENING_STEP_M) * OPENING_STEP_M
  const width = Math.round(Math.max(OPENING_MIN_M[opening.type], Math.min(OPENING_MAX_M, stepped)) * 100) / 100
  const applied = width - startWidthM
  const shiftPct = ((end === 'end' ? applied : -applied) / 2 / axisM) * 100
  return opening.rotation === 0
    ? { ...opening, widthM: width, x: opening.x + shiftPct }
    : { ...opening, widthM: width, y: opening.y + shiftPct }
}
