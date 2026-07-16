import { solarPosition } from '../plan'
import type { Compass } from './types'

/** Sun azimuth is measured clockwise from North (0° = N, 90° = E, 180° = S, 270° = W). */
const COMPASS_TO_AZIMUTH: Record<Compass, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
}

/** Sample interval in minutes for the daily direct-sun scan. */
const STEP_MIN = 15

/**
 * Direct-sun profile for a single wall over a single day at the given latitude.
 * Returns total minutes of direct sun on the wall (when the sun is above the
 * horizon AND the wall faces the sun within 90°), plus the peak intensity and
 * worst hour.
 */
export function wallSunForDay(
  latitude: number,
  day: number,
  compass: Compass,
): { directMinutes: number; peakIntensity: number; worstHour: number } {
  let directMinutes = 0
  let peakIntensity = 0
  let worstHour = 12

  for (let minutes = 6 * 60; minutes <= 18 * 60; minutes += STEP_MIN) {
    const hour = minutes / 60
    const sun = solarPosition(latitude, day, hour)
    if (sun.altitude <= 0) continue

    const intensity = wallIntensity(sun.azimuth, sun.altitude, compass)
    if (intensity > 0) directMinutes += STEP_MIN
    if (intensity > peakIntensity) {
      peakIntensity = intensity
      worstHour = Math.floor(hour)
    }
  }

  return { directMinutes, peakIntensity, worstHour }
}

/**
 * How directly the sun hits a wall. 0 = no sun (back side or below horizon).
 * 1 = perpendicular. Weighted by solar altitude (low sun = glancing = less gain).
 */
export function wallIntensity(
  sunAzimuthDeg: number,
  sunAltitudeDeg: number,
  compass: Compass,
): number {
  const wallAzimuth = COMPASS_TO_AZIMUTH[compass]
  let delta = Math.abs(sunAzimuthDeg - wallAzimuth)
  if (delta > 180) delta = 360 - delta
  if (delta >= 90) return 0
  const cosFace = Math.cos((delta * Math.PI) / 180)
  const altFactor = Math.max(0.15, Math.sin((sunAltitudeDeg * Math.PI) / 180))
  return cosFace * altFactor
}

/** Hours threshold above which a wall is considered "needs shading". Tuned for tropical houses. */
export const SHADE_THRESHOLD_MIN = 240 // 4 hours

export function wallNeedsShade(directMinutes: number): boolean {
  return directMinutes >= SHADE_THRESHOLD_MIN
}