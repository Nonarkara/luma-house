import { SITE_HEIGHT_METERS, SITE_WIDTH_METERS } from '../plan'
import type { PlanState, Room } from '../types'
import type { Compass, WallSegment } from './types'

const EPS = 0.5 // percentage tolerance for "touching" / "shared wall"

/** Whole-plan bounds — used to detect which walls are exterior. */
function planBounds(rooms: Room[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (rooms.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  return rooms.reduce(
    (b, r) => ({
      minX: Math.min(b.minX, r.x),
      minY: Math.min(b.minY, r.y),
      maxX: Math.max(b.maxX, r.x + r.w),
      maxY: Math.max(b.maxY, r.y + r.h),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

function pctToMetersX(pct: number): number {
  return (pct / 100) * SITE_WIDTH_METERS
}
function pctToMetersY(pct: number): number {
  return (pct / 100) * SITE_HEIGHT_METERS
}

/**
 * For each room, find which of its four walls are exterior (not shared with
 * another room) and return their compass direction + length.
 *
 * Convention: top of canvas = North, bottom = South, left = West, right = East.
 */
export function exteriorWalls(plan: PlanState): WallSegment[] {
  const walls: WallSegment[] = []
  const bounds = planBounds(plan.rooms)

  for (const room of plan.rooms) {
    const left = room.x
    const right = room.x + room.w
    const top = room.y
    const bottom = room.y + room.h

    const topShared = plan.rooms.some(
      (other) =>
        other.id !== room.id &&
        other.y + other.h >= top - EPS &&
        other.y + other.h <= top + EPS &&
        other.x < right - EPS &&
        other.x + other.w > left + EPS,
    )
    const bottomShared = plan.rooms.some(
      (other) =>
        other.id !== room.id &&
        other.y >= bottom - EPS &&
        other.y <= bottom + EPS &&
        other.x < right - EPS &&
        other.x + other.w > left + EPS,
    )
    const leftShared = plan.rooms.some(
      (other) =>
        other.id !== room.id &&
        other.x + other.w >= left - EPS &&
        other.x + other.w <= left + EPS &&
        other.y < bottom - EPS &&
        other.y + other.h > top + EPS,
    )
    const rightShared = plan.rooms.some(
      (other) =>
        other.id !== room.id &&
        other.x >= right - EPS &&
        other.x <= right + EPS &&
        other.y < bottom - EPS &&
        other.y + other.h > top + EPS,
    )

    const touchesTop = top <= bounds.minY + EPS
    const touchesBottom = bottom >= bounds.maxY - EPS
    const touchesLeft = left <= bounds.minX + EPS
    const touchesRight = right >= bounds.maxX - EPS

    if (!topShared || touchesTop) {
      walls.push({ roomId: room.id, compass: 'N', lengthPct: room.w, lengthMeters: pctToMetersX(room.w) })
    }
    if (!bottomShared || touchesBottom) {
      walls.push({ roomId: room.id, compass: 'S', lengthPct: room.w, lengthMeters: pctToMetersX(room.w) })
    }
    if (!leftShared || touchesLeft) {
      walls.push({ roomId: room.id, compass: 'W', lengthPct: room.h, lengthMeters: pctToMetersY(room.h) })
    }
    if (!rightShared || touchesRight) {
      walls.push({ roomId: room.id, compass: 'E', lengthPct: room.h, lengthMeters: pctToMetersY(room.h) })
    }
  }

  return walls
}

/**
 * Classify an opening as belonging to a room + compass direction.
 * Returns null if the opening is not touching any of this room's walls.
 */
function classifyOpening(
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

export function openingsForRoomWall(plan: PlanState, roomId: string, compass: Compass) {
  const room = plan.rooms.find((r) => r.id === roomId)
  if (!room) return [] as typeof plan.openings
  return plan.openings.filter((o) => classifyOpening(room, o) === compass)
}