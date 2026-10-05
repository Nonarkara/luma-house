import { roomHeight, siteOf, sunVector } from '../plan'
import { openingDimensions } from '../openingGeometry'
import { roomsForOpening } from '../analysis/walls'
import type { Opening, PlanState, SiteSpec } from '../types'

/** Symmetric, non-degenerate shadow frustum sized to the user's calibrated site. */
export function solarShadowCamera(site: SiteSpec) {
  const extent = Math.max(site.w, site.h, 16) / 2 + 6
  return { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: extent * 6, distance: extent * 3 }
}

/** An illustrative center ray only for an exterior window facing the sun. */
export function windowSunRay(plan: PlanState, opening: Opening, azimuth: number, altitude: number) {
  if (opening.type !== 'window' || altitude <= 2) return null
  const matches = roomsForOpening(plan, opening)
  if (matches.length !== 1) return null
  const { room, compass } = matches[0]
  const sun = sunVector(azimuth, altitude)
  const facing = { N: -sun.z, S: sun.z, E: sun.x, W: -sun.x }[compass]
  if (facing <= 0.01) return null
  const site = siteOf(plan)
  const { sill, height } = openingDimensions(opening)
  if (sill >= roomHeight(room)) return null
  const windowY = 0.1 + sill + Math.min(height, roomHeight(room) - sill) / 2
  const center: [number, number, number] = [opening.x / 100 * site.w - site.w / 2, windowY, opening.y / 100 * site.h - site.h / 2]
  // Stop the guide at the first opposite room edge or floor. Shadow maps,
  // rather than this guide, decide which floor pixels receive direct sunlight.
  const east = (room.x + room.w) / 100 * site.w - site.w / 2
  const west = room.x / 100 * site.w - site.w / 2
  const south = (room.y + room.h) / 100 * site.h - site.h / 2
  const north = room.y / 100 * site.h - site.h / 2
  const hits = [(windowY - 0.1) / sun.y]
  if (sun.x > 0.001) hits.push((center[0] - west) / sun.x)
  if (sun.x < -0.001) hits.push((center[0] - east) / sun.x)
  if (sun.z > 0.001) hits.push((center[2] - north) / sun.z)
  if (sun.z < -0.001) hits.push((center[2] - south) / sun.z)
  const length = Math.min(...hits.filter(value => value > 0.001))
  return {
    start: [center[0] + sun.x * 3, center[1] + sun.y * 3, center[2] + sun.z * 3] as [number, number, number],
    end: [center[0] - sun.x * length, center[1] - sun.y * length, center[2] - sun.z * length] as [number, number, number],
  }
}
