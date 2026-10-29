import type { Compass } from '../analysis/types'
import { roomsForOpening } from '../analysis/walls'
import { openingDimensions } from '../openingGeometry'
import { furnitureLabelFor, furnitureRectFor, siteOf } from '../plan'
import type { PlanState, Room } from '../types'
import { MIN_ROOM } from './geometry'

/**
 * Cutting a drawing: the eraser and the trim.
 *
 * Both are geometry, so both live here rather than in a component — the plan
 * is a sheet of rectangles, and every question either one asks ("what is under
 * the cursor?", "where does this room cross that wall?") is a question about
 * rectangles, not about the screen.
 */

const EPS = 0.01

export interface SheetPoint {
  /** Percent across the sheet. */
  x: number
  /** Percent down the sheet. */
  y: number
}

type Rect = { x: number; y: number; w: number; h: number }

/** Distance between two sheet points, in metres on the real site. */
export function distanceMeters(a: SheetPoint, b: SheetPoint, site: { w: number; h: number }): number {
  return Math.hypot(((a.x - b.x) / 100) * site.w, ((a.y - b.y) / 100) * site.h)
}

/** Distance from a point to a segment, in metres on the real site. */
export function distanceToSegmentMeters(
  point: SheetPoint,
  start: SheetPoint,
  end: SheetPoint,
  site: { w: number; h: number },
): number {
  const toM = (p: SheetPoint) => ({ x: (p.x / 100) * site.w, y: (p.y / 100) * site.h })
  const p = toM(point)
  const a = toM(start)
  const b = toM(end)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function area(rect: Rect): number {
  return Math.max(0, rect.w) * Math.max(0, rect.h)
}

function contains(rect: Rect, point: SheetPoint, slackX = 0, slackY = 0): boolean {
  return (
    point.x >= rect.x - slackX &&
    point.x <= rect.x + rect.w + slackX &&
    point.y >= rect.y - slackY &&
    point.y <= rect.y + rect.h + slackY
  )
}

// ---------------------------------------------------------------------------
// The eraser
// ---------------------------------------------------------------------------

export type EraseKind = 'furniture' | 'opening' | 'wall' | 'room'

export interface EraseTarget {
  kind: EraseKind
  id: string
  label: string
}

/**
 * What the eraser would remove under the cursor.
 *
 * The order is the order of the drawing: the smallest thing drawn last is the
 * thing the hand meant. Furniture sits on an opening, an opening sits on a
 * wall, and a wall sits on a room. A click takes the topmost of them.
 */
export function eraseTargetAt(plan: PlanState, point: SheetPoint, toleranceM = 0.4): EraseTarget | null {
  const site = siteOf(plan)
  const tolX = (toleranceM / site.w) * 100
  const tolY = (toleranceM / site.h) * 100

  const furniture = plan.furniture
    .map((item) => ({ item, rect: furnitureRectFor(item, site) }))
    .filter(({ rect }) => contains(rect, point, tolX * 0.5, tolY * 0.5))
    .sort((a, b) => area(a.rect) - area(b.rect))
  if (furniture.length > 0) {
    return { kind: 'furniture', id: furniture[0].item.id, label: furnitureLabelFor(furniture[0].item) }
  }

  const openings = plan.openings
    .map((opening) => {
      const width = openingDimensions(opening).width
      const axisMeters = opening.rotation === 0 ? site.w : site.h
      const halfPct = (width / 2 / axisMeters) * 100
      const start = opening.rotation === 0
        ? { x: opening.x - halfPct, y: opening.y }
        : { x: opening.x, y: opening.y - halfPct }
      const end = opening.rotation === 0
        ? { x: opening.x + halfPct, y: opening.y }
        : { x: opening.x, y: opening.y + halfPct }
      return { opening, start, end, distance: distanceToSegmentMeters(point, start, end, site) }
    })
    .filter((candidate) => candidate.distance <= toleranceM)
    .sort((a, b) => a.distance - b.distance)
  if (openings.length > 0) {
    const label = openings[0].opening.type === 'door' ? 'Door' : 'Window'
    return { kind: 'opening', id: openings[0].opening.id, label }
  }

  const walls = (plan.walls ?? [])
    .map((wall) => ({
      wall,
      distance: distanceToSegmentMeters(
        point,
        { x: wall.x1, y: wall.y1 },
        { x: wall.x2, y: wall.y2 },
        site,
      ),
    }))
    .filter((candidate) => candidate.distance <= toleranceM)
    .sort((a, b) => a.distance - b.distance)
  if (walls.length > 0) {
    return { kind: 'wall', id: walls[0].wall.id, label: 'Wall' }
  }

  const rooms = plan.rooms
    .filter((room) => contains(room, point))
    .sort((a, b) => area(a) - area(b))
  if (rooms.length > 0) {
    return { kind: 'room', id: rooms[0].id, label: rooms[0].name }
  }

  return null
}

/**
 * Remove a room and everything that only that room carried: the furniture
 * standing in it, and the openings whose wall went with it. An opening on a
 * wall shared with a neighbour stays — the neighbour still has that wall.
 */
export function removeRoomFromPlan(plan: PlanState, roomId: string): PlanState {
  const room = plan.rooms.find((item) => item.id === roomId)
  if (!room) return plan
  const site = siteOf(plan)

  const furniture = plan.furniture.filter((item) => {
    const rect = furnitureRectFor(item, site)
    const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
    return !contains(room, centre)
  })

  const rooms = plan.rooms.filter((item) => item.id !== roomId)
  const next: PlanState = { ...plan, rooms, furniture }

  const openings = plan.openings.filter((opening) => {
    const wasHosted = roomsForOpening(plan, opening).some((match) => match.room.id === roomId)
    if (!wasHosted) return true
    return roomsForOpening(next, opening).length > 0
  })

  return { ...next, openings }
}

export interface EraseOutcome {
  plan: PlanState
  target: EraseTarget | null
  toast: string
  /** True when nothing was removed. */
  unchanged: boolean
}

/** The eraser: remove the thing under the cursor. */
export function eraseAt(plan: PlanState, point: SheetPoint, toleranceM = 0.4): EraseOutcome {
  const target = eraseTargetAt(plan, point, toleranceM)
  if (!target) {
    return { plan, target: null, toast: 'Nothing to erase here', unchanged: true }
  }
  if (target.kind === 'furniture') {
    return {
      plan: { ...plan, furniture: plan.furniture.filter((item) => item.id !== target.id) },
      target,
      toast: `${target.label} removed`,
      unchanged: false,
    }
  }
  if (target.kind === 'opening') {
    return {
      plan: { ...plan, openings: plan.openings.filter((item) => item.id !== target.id) },
      target,
      toast: `${target.label} removed`,
      unchanged: false,
    }
  }
  if (target.kind === 'wall') {
    return {
      plan: { ...plan, walls: (plan.walls ?? []).filter((item) => item.id !== target.id) },
      target,
      toast: 'Wall removed',
      unchanged: false,
    }
  }
  return {
    plan: removeRoomFromPlan(plan, target.id),
    target,
    toast: `${target.label} removed`,
    unchanged: false,
  }
}

// ---------------------------------------------------------------------------
// The trim
// ---------------------------------------------------------------------------

export type TrimOutcome = 'cut' | 'remove-room' | 'refused'

export interface TrimCut {
  outcome: TrimOutcome
  /** The room that is cut. */
  roomId: string
  roomName: string
  /** The room as it would be after the cut. */
  next: Room
  /** The band of the sheet the cut takes away. */
  removed: Rect
  /** The room the cut is made against. */
  againstRoomId: string
  againstRoomName: string
  /** Which of that room's four walls the cut follows. */
  againstCompass: Compass
  /** How much floor the cut takes, in square metres. */
  removedM2: number
  /** Why a cut was refused, when it was. */
  reason?: string
}

const COMPASS_WORD: Record<Compass, string> = { N: 'north', S: 'south', E: 'east', W: 'west' }

export function compassWord(compass: Compass): string {
  return COMPASS_WORD[compass]
}

function overlapRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.w, b.x + b.w)
  const bottom = Math.min(a.y + a.h, b.y + b.h)
  if (right - x <= EPS || bottom - y <= EPS) return null
  return { x, y, w: right - x, h: bottom - y }
}

/**
 * The cut that takes the least of the room away.
 *
 * A room is a rectangle and a cut is a straight line, so the cut runs along
 * one of the other room's four walls and the room keeps the half that does
 * not cross it. Where more than one wall would do, the one that takes the
 * least floor is used — a trim should be the smallest change that clears the
 * crossing.
 */
export function trimCutAgainst(room: Room, other: Room, site: { w: number; h: number }): TrimCut | null {
  const overlap = overlapRect(room, other)
  if (!overlap) return null

  const roomRight = room.x + room.w
  const roomBottom = room.y + room.h
  const candidates: Array<{ axis: 'x' | 'y'; at: number; keep: 'before' | 'after'; removed: Rect; compass: Compass }> = []

  // Cut along the other room's west wall and keep what lies west of it.
  if (overlap.x > room.x + EPS) {
    candidates.push({
      axis: 'x',
      at: overlap.x,
      keep: 'before',
      removed: { x: overlap.x, y: room.y, w: roomRight - overlap.x, h: room.h },
      compass: 'W',
    })
  }
  // Cut along its east wall and keep what lies east of it.
  if (overlap.x + overlap.w < roomRight - EPS) {
    candidates.push({
      axis: 'x',
      at: overlap.x + overlap.w,
      keep: 'after',
      removed: { x: room.x, y: room.y, w: overlap.x + overlap.w - room.x, h: room.h },
      compass: 'E',
    })
  }
  // Cut along its north wall and keep what lies north of it.
  if (overlap.y > room.y + EPS) {
    candidates.push({
      axis: 'y',
      at: overlap.y,
      keep: 'before',
      removed: { x: room.x, y: overlap.y, w: room.w, h: roomBottom - overlap.y },
      compass: 'N',
    })
  }
  // Cut along its south wall and keep what lies south of it.
  if (overlap.y + overlap.h < roomBottom - EPS) {
    candidates.push({
      axis: 'y',
      at: overlap.y + overlap.h,
      keep: 'after',
      removed: { x: room.x, y: room.y, w: room.w, h: overlap.y + overlap.h - room.y },
      compass: 'S',
    })
  }

  if (candidates.length === 0) {
    // The room lies entirely inside the other one. There is no half to keep —
    // the room itself is the part that came out in another way.
    const inside =
      overlap.x <= room.x + EPS &&
      overlap.y <= room.y + EPS &&
      overlap.x + overlap.w >= roomRight - EPS &&
      overlap.y + overlap.h >= roomBottom - EPS
    if (!inside) return null
    return {
      outcome: 'remove-room',
      roomId: room.id,
      roomName: room.name,
      next: room,
      removed: { x: room.x, y: room.y, w: room.w, h: room.h },
      againstRoomId: other.id,
      againstRoomName: other.name,
      againstCompass: 'N',
      removedM2: (room.w / 100) * site.w * ((room.h / 100) * site.h),
      reason: 'It sits entirely inside another room.',
    }
  }

  const best = candidates.sort((a, b) => area(a.removed) - area(b.removed))[0]
  const next: Room = { ...room }
  if (best.axis === 'x') {
    if (best.keep === 'before') next.w = best.at - room.x
    else {
      next.x = best.at
      next.w = roomRight - best.at
    }
  } else if (best.keep === 'before') next.h = best.at - room.y
  else {
    next.y = best.at
    next.h = roomBottom - best.at
  }

  const removedM2 = (best.removed.w / 100) * site.w * ((best.removed.h / 100) * site.h)
  if (next.w < MIN_ROOM || next.h < MIN_ROOM) {
    return {
      outcome: 'refused',
      roomId: room.id,
      roomName: room.name,
      next: room,
      removed: best.removed,
      againstRoomId: other.id,
      againstRoomName: other.name,
      againstCompass: best.compass,
      removedM2,
      reason: 'Cutting there would leave a room too small to use.',
    }
  }

  return {
    outcome: 'cut',
    roomId: room.id,
    roomName: room.name,
    next,
    removed: best.removed,
    againstRoomId: other.id,
    againstRoomName: other.name,
    againstCompass: best.compass,
    removedM2,
  }
}

/** The room under the cursor: the one drawn last wins, so a click in an overlap
 * takes the room on top. */
export function topmostRoomAt(plan: PlanState, point: SheetPoint): Room | null {
  for (let index = plan.rooms.length - 1; index >= 0; index -= 1) {
    const room = plan.rooms[index]
    if (contains(room, point)) return room
  }
  return null
}

/** The next cut this room needs, against whichever room it crosses. */
export function nextTrimCut(plan: PlanState, roomId: string): TrimCut | null {
  const room = plan.rooms.find((item) => item.id === roomId)
  if (!room) return null
  const site = siteOf(plan)
  let best: TrimCut | null = null
  for (const other of plan.rooms) {
    if (other.id === roomId) continue
    const cut = trimCutAgainst(room, other, site)
    if (!cut) continue
    // A refusal is worse than a cut that works, so a workable cut wins.
    if (cut.outcome === 'refused' && best && best.outcome !== 'refused') continue
    if (!best) {
      best = cut
      continue
    }
    if (best.outcome === 'refused' && cut.outcome !== 'refused') {
      best = cut
      continue
    }
    if (cut.outcome !== 'refused' && best.outcome !== 'refused' && cut.removedM2 < best.removedM2) {
      best = cut
    }
  }
  return best
}

/** What the trim would do under the cursor, without doing it. */
export function trimPreviewAt(plan: PlanState, point: SheetPoint): TrimCut | null {
  const room = topmostRoomAt(plan, point)
  if (!room) return null
  return nextTrimCut(plan, room.id)
}

/**
 * A cut takes floor away, and what stood on that floor goes with it: the
 * furniture whose centre was in the cut band and is now in no room, and the
 * openings whose wall was cut off. Silent orphans would float in the 3D with
 * nothing under them and count in the bill of quantities.
 */
function settleAfterCut(before: PlanState, after: PlanState): { plan: PlanState; furniture: number; openings: number } {
  const site = siteOf(after)
  const keptFurniture = after.furniture.filter((item) => {
    const rect = furnitureRectFor(item, site)
    const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
    const wasIn = before.rooms.some((room) => contains(room, centre))
    return !wasIn || after.rooms.some((room) => contains(room, centre))
  })
  const keptOpenings = after.openings.filter((opening) =>
    roomsForOpening(before, opening).length === 0 || roomsForOpening(after, opening).length > 0)
  return {
    plan: { ...after, furniture: keptFurniture, openings: keptOpenings },
    furniture: after.furniture.length - keptFurniture.length,
    openings: after.openings.length - keptOpenings.length,
  }
}

export interface TrimOutcomeResult {
  plan: PlanState
  toast: string
  cuts: TrimCut[]
  /** True when nothing changed. */
  unchanged: boolean
}

/**
 * The trim: cut a room back until it no longer crosses another room.
 *
 * Each cut follows one of the other room's walls. A room that lies entirely
 * inside another is removed instead — that is the wall that came out in
 * another way. A cut that would leave a sliver is refused, not forced.
 */
export function trimAt(plan: PlanState, point: SheetPoint): TrimOutcomeResult {
  const room = topmostRoomAt(plan, point)
  if (!room) {
    return { plan, toast: 'Click a room to trim it', cuts: [], unchanged: true }
  }
  return trimRoom(plan, room.id)
}

/** Two rooms share floor when their rectangles cross by more than a hair. */
export function roomsCross(a: Room, b: Room): boolean {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return overlapX > 0.1 && overlapY > 0.1
}

/** Cut one room back until it no longer crosses another. */
export function trimRoom(plan: PlanState, roomId: string): TrimOutcomeResult {
  const room = plan.rooms.find((item) => item.id === roomId)
  if (!room) {
    return { plan, toast: 'That room is not on the drawing', cuts: [], unchanged: true }
  }

  let current = plan
  const cuts: TrimCut[] = []
  for (let step = 0; step < 8; step += 1) {
    const cut = nextTrimCut(current, room.id)
    if (!cut) break
    cuts.push(cut)
    if (cut.outcome === 'remove-room') {
      current = removeRoomFromPlan(current, room.id)
      break
    }
    if (cut.outcome === 'refused') {
      return {
        plan,
        toast: `${cut.roomName}: ${cut.reason ?? 'That cut is refused.'}`,
        cuts: [],
        unchanged: true,
      }
    }
    current = {
      ...current,
      rooms: current.rooms.map((item) => (item.id === room.id ? cut.next : item)),
    }
  }

  if (!cuts.length) {
    return { plan, toast: 'Nothing to trim — this room does not cross another', cuts: [], unchanged: true }
  }

  const cut = cuts[0]
  if (cut.outcome === 'remove-room') {
    return {
      plan: current,
      toast: `${cut.roomName} removed — it sits entirely inside the ${cut.againstRoomName}`,
      cuts,
      unchanged: false,
    }
  }

  const settled = settleAfterCut(plan, current)
  current = settled.plan
  const total = cuts.reduce((sum, item) => sum + item.removedM2, 0)
  const where = `${compassWord(cut.againstCompass)} wall`
  const more = cuts.length > 1 ? ` in ${cuts.length} cuts` : ''
  const lost = [
    settled.furniture ? `${settled.furniture} piece${settled.furniture > 1 ? 's' : ''} of furniture` : '',
    settled.openings ? `${settled.openings} opening${settled.openings > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' and ')
  return {
    plan: current,
    toast: `${cut.roomName} trimmed ${total.toFixed(1)} m² back to the ${cut.againstRoomName}'s ${where}${more}${lost ? `; ${lost} on that floor removed` : ''}`,
    cuts,
    unchanged: false,
  }
}

export interface OverlapTrimResult {
  plan: PlanState
  /** How many rooms were cut back. */
  trimmed: number
  toast: string
  unchanged: boolean
}

/**
 * Trim every overlap in the drawing.
 *
 * The app already says when two rooms overlap — the floor is counted twice and
 * the climate analysis cannot be trusted — and now it offers the tool that
 * fixes it. The room drawn last is the one that was drawn over another, so it
 * is the one that is cut back, exactly as the trim tool behaves when you click
 * the top of an overlap.
 */
export function trimOverlaps(plan: PlanState): OverlapTrimResult {
  let current = plan
  const trimmed: string[] = []
  const refused: string[] = []

  for (let index = current.rooms.length - 1; index >= 0; index -= 1) {
    const room = current.rooms[index]
    if (!room) continue
    const crosses = current.rooms.some((other) => other.id !== room.id && roomsCross(room, other))
    if (!crosses) continue
    const result = trimRoom(current, room.id)
    if (result.unchanged) {
      refused.push(room.name)
      continue
    }
    current = result.plan
    trimmed.push(room.name)
  }

  if (!trimmed.length) {
    return {
      plan,
      trimmed: 0,
      toast: refused.length
        ? `${refused[0]} cannot be trimmed without leaving a room too small to use`
        : 'Nothing to trim',
      unchanged: true,
    }
  }

  const names = trimmed.join(', ')
  const more = trimmed.length > 1 ? ` (${trimmed.length} rooms)` : ''
  const blocked = refused.length ? ` ${refused.join(', ')} could not be trimmed.` : ''
  return {
    plan: current,
    trimmed: trimmed.length,
    toast: `Trimmed ${names}${more} back to the wall it crossed.${blocked}`,
    unchanged: false,
  }
}
