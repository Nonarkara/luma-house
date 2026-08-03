import { siteOf } from '../plan'
import type { Opening, PlanState, Room } from '../types'
import type { Compass, WallSegment } from './types'

const EPS = 0.5 // percentage tolerance for "touching" / "shared wall"

function coveredLength(intervals: Array<[number, number]>): number {
  const sorted = intervals.filter(([start, end]) => end > start + EPS).sort((a, b) => a[0] - b[0])
  if (sorted.length === 0) return 0
  let total = 0
  let [start, end] = sorted[0]
  for (let i = 1; i < sorted.length; i += 1) {
    const [nextStart, nextEnd] = sorted[i]
    if (nextStart <= end + EPS) {
      end = Math.max(end, nextEnd)
    } else {
      total += end - start
      ;[start, end] = [nextStart, nextEnd]
    }
  }
  return total + end - start
}

/**
 * For each room, find which of its four walls are exterior (not shared with
 * another room) and return their compass direction + length.
 *
 * Convention: top of canvas = North, bottom = South, left = West, right = East.
 */
export function exteriorWalls(plan: PlanState): WallSegment[] {
  const walls: WallSegment[] = []
  const site = siteOf(plan)

  for (const room of plan.rooms) {
    const left = room.x
    const right = room.x + room.w
    const top = room.y
    const bottom = room.y + room.h

    const others = plan.rooms.filter((other) => other.id !== room.id)
    const horizontalOverlap = (other: Room): [number, number] => [Math.max(left, other.x), Math.min(right, other.x + other.w)]
    const verticalOverlap = (other: Room): [number, number] => [Math.max(top, other.y), Math.min(bottom, other.y + other.h)]
    const topCovered = coveredLength(others.filter((other) => Math.abs(other.y + other.h - top) <= EPS).map(horizontalOverlap))
    const bottomCovered = coveredLength(others.filter((other) => Math.abs(other.y - bottom) <= EPS).map(horizontalOverlap))
    const leftCovered = coveredLength(others.filter((other) => Math.abs(other.x + other.w - left) <= EPS).map(verticalOverlap))
    const rightCovered = coveredLength(others.filter((other) => Math.abs(other.x - right) <= EPS).map(verticalOverlap))

    const addWall = (compass: Compass, lengthPct: number, siteMeters: number) => {
      if (lengthPct <= EPS) return
      walls.push({ roomId: room.id, compass, lengthPct, lengthMeters: (lengthPct / 100) * siteMeters })
    }
    addWall('N', room.w - topCovered, site.w)
    addWall('S', room.w - bottomCovered, site.w)
    addWall('W', room.h - leftCovered, site.h)
    addWall('E', room.h - rightCovered, site.h)
  }

  return walls
}

/**
 * Classify an opening as belonging to a room + compass direction.
 * Returns null if the opening is not touching any of this room's walls.
 */
export function openingCompassForRoom(
  room: Room,
  opening: { x: number; y: number; rotation: 0 | 90 },
): Compass | null {
  const onTop = Math.abs(opening.y - room.y) < 1.5
  const onBottom = Math.abs(opening.y - (room.y + room.h)) < 1.5
  const onLeft = Math.abs(opening.x - room.x) < 1.5
  const onRight = Math.abs(opening.x - (room.x + room.w)) < 1.5
  const inSpanX = opening.x >= room.x - 1.5 && opening.x <= room.x + room.w + 1.5
  const inSpanY = opening.y >= room.y - 1.5 && opening.y <= room.y + room.h + 1.5
  if (onTop && inSpanX) return 'N'
  if (onBottom && inSpanX) return 'S'
  if (onLeft && inSpanY) return 'W'
  if (onRight && inSpanY) return 'E'
  return null
}

export interface OpeningRoomMatch {
  room: Room
  compass: Compass
}

/** Rooms and wall faces physically touched by an opening marker. */
export function roomsForOpening(plan: PlanState, opening: Pick<Opening, 'x' | 'y' | 'rotation'>): OpeningRoomMatch[] {
  return plan.rooms.flatMap((room) => {
    const compass = openingCompassForRoom(room, opening)
    return compass ? [{ room, compass }] : []
  })
}

/** An opening is exterior only when it touches exactly one modeled room. */
export function isOpeningExterior(plan: PlanState, roomId: string, opening: Opening): boolean {
  const matches = roomsForOpening(plan, opening)
  return matches.length === 1 && matches[0].room.id === roomId
}

export function openingsForRoomWall(plan: PlanState, roomId: string, compass: Compass) {
  const room = plan.rooms.find((r) => r.id === roomId)
  if (!room) return [] as typeof plan.openings
  return plan.openings.filter((o) => openingCompassForRoom(room, o) === compass)
}
