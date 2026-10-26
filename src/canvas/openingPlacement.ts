import type { Opening, Room, SiteSpec } from '../types'
import { openingDimensions } from '../openingGeometry'

/** Pixel-distance wall hosting, inspired by Cursor PR #6's wallHost helper.
 * Independent bounded adaptation: reject walls shorter than the aperture;
 * never shrink the opening or leave it floating on the drawing field. */
export function placeOpeningOnWall(
  opening: Opening,
  rooms: Room[],
  site: SiteSpec,
  stage: { width: number; height: number },
): Opening | null {
  if (![opening.x, opening.y, stage.width, stage.height, site.w, site.h].every(Number.isFinite) ||
      stage.width <= 0 || stage.height <= 0 || site.w <= 0 || site.h <= 0) return null
  const width = openingDimensions(opening).width
  if (!Number.isFinite(width) || width <= 0) return null
  let best: { distance: number; opening: Opening } | null = null
  for (const room of rooms) {
    for (const rotation of [0, 90] as const) {
      const horizontal = rotation === 0
      const start = horizontal ? room.x : room.y
      const length = horizontal ? room.w : room.h
      const half = width / (horizontal ? site.w : site.h) * 50
      if (length + 1e-9 < half * 2) continue
      const along = horizontal ? opening.x : opening.y
      const closest = Math.max(start, Math.min(start + length, along))
      const center = Math.max(start + half, Math.min(start + length - half, along))
      const faces = horizontal ? [room.y, room.y + room.h] : [room.x, room.x + room.w]
      for (const face of faces) {
        const x = horizontal ? closest : face
        const y = horizontal ? face : closest
        const distance = Math.hypot((opening.x - x) * stage.width / 100, (opening.y - y) * stage.height / 100)
        if (distance <= 24 && (!best || distance < best.distance)) {
          best = { distance, opening: { ...opening, x: horizontal ? center : face, y: horizontal ? face : center, rotation } }
        }
      }
    }
  }
  return best?.opening ?? null
}
