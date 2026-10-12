import type { Room } from '../types'

/**
 * An opening is hosted by a wall segment and takes that segment's direction.
 * The hosting idea is the one used by IngeTrazo (Marco Sumari Tellez and
 * contributors): the nearest wall owns the opening. This is an independent
 * implementation; no IngeTrazo source is included.
 * See docs/INGETRAZO-REUSE-REVIEW.md.
 */
export const OPENING_SNAP_PX = 24

export interface WallHit {
  x: number
  y: number
  rotation: 0 | 90
  roomId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface StagePx {
  width: number
  height: number
}

/**
 * Nearest room wall to a plan-percent point, within `maxPx` screen pixels.
 * Horizontal walls (north/south) report rotation 0; vertical walls report 90.
 */
export function nearestWallHit(
  point: { x: number; y: number },
  rooms: Room[],
  stagePx: StagePx,
  maxPx = OPENING_SNAP_PX,
): WallHit | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  if (!(stagePx.width > 0) || !(stagePx.height > 0)) return null
  let best: { hit: WallHit; px: number } | null = null
  for (const room of rooms) {
    const right = room.x + room.w
    const bottom = room.y + room.h
    const edges: WallHit[] = [
      { x: point.x, y: room.y, rotation: 0, roomId: room.id, x1: room.x, y1: room.y, x2: right, y2: room.y },
      { x: point.x, y: bottom, rotation: 0, roomId: room.id, x1: room.x, y1: bottom, x2: right, y2: bottom },
      { x: room.x, y: point.y, rotation: 90, roomId: room.id, x1: room.x, y1: room.y, x2: room.x, y2: bottom },
      { x: right, y: point.y, rotation: 90, roomId: room.id, x1: right, y1: room.y, x2: right, y2: bottom },
    ]
    for (const edge of edges) {
      const horizontal = edge.rotation === 0
      const along = horizontal ? edge.x : edge.y
      const start = horizontal ? edge.x1 : edge.y1
      const end = horizontal ? edge.x2 : edge.y2
      const clamped = Math.max(start, Math.min(end, along))
      if (horizontal) edge.x = clamped
      else edge.y = clamped
      const px = Math.hypot(
        ((point.x - edge.x) / 100) * stagePx.width,
        ((point.y - edge.y) / 100) * stagePx.height,
      )
      if (px <= maxPx && (!best || px < best.px)) best = { hit: { ...edge }, px }
    }
  }
  return best?.hit ?? null
}

/**
 * The Window · Door chip sits on the opening it belongs to. A hit on that
 * same wall, within the chip's reach, is a type toggle. Any other wall is a
 * request to place the next opening.
 */
export function hitIsSelectedOpening(
  hit: WallHit,
  opening: { x: number; y: number; rotation: number },
  site: { w: number; h: number },
  stagePx: StagePx,
): boolean {
  if (hit.rotation !== opening.rotation) return false
  const across = hit.rotation === 0
    ? (Math.abs(hit.y - opening.y) / 100) * site.h
    : (Math.abs(hit.x - opening.x) / 100) * site.w
  if (across > 0.35) return false
  const along = hit.rotation === 0
    ? (Math.abs(hit.x - opening.x) / 100) * site.w
    : (Math.abs(hit.y - opening.y) / 100) * site.h
  const pxPerM = hit.rotation === 0 ? stagePx.width / site.w : stagePx.height / site.h
  const chipReachM = 200 / Math.max(pxPerM, 1)
  return along <= chipReachM
}
