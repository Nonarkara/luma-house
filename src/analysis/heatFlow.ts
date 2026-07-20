import { roomHeight } from '../plan'
import type { PlanState } from '../types'
import { wallIntensity } from './sunHours'
import type { Compass } from './types'
import { exteriorWalls, openingsForRoomWall } from './walls'

// Transparent, concept-stage defaults. These are deliberately ordinary values
// rather than a claim about a specific product or construction assembly.
export const ENVELOPE_ASSUMPTIONS = {
  wallUUninsulated: 2.1,
  wallUInsulated: 0.45,
  windowU: 2.7,
  doorU: 2.0,
  windowShgcClear: 0.65,
  windowShgcLowE: 0.35,
  windowAreaM2: 1.6 * 1.2,
  doorAreaM2: 0.9 * 2.1,
  clearSkyDirectWm2: 800,
} as const

export interface HeatFlowSnapshot {
  /** Signed heat flow through opaque wall surfaces. Positive = into the rooms. */
  wallW: number
  /** Signed conductive heat flow through windows and doors. */
  openingW: number
  /** Solar radiation transmitted through windows. Always non-negative. */
  solarW: number
  /** wallW + openingW + solarW. Positive = heat entering; negative = heat leaving. */
  netW: number
  exteriorWallM2: number
  windowM2: number
  doorM2: number
  outsideC: number
  insideC: number
  mode: 'heat-in' | 'heat-out' | 'balanced'
}

/**
 * A legible envelope snapshot using Q = U × A × ΔT and
 * solar gain = irradiance × area × SHGC × incidence.
 *
 * It intentionally covers only walls, windows, and doors. Roof, floor,
 * infiltration, thermal bridges, clouds, shade, and internal loads require a
 * proper hourly model and are disclosed in the UI rather than hidden in fudge factors.
 */
export function heatFlowSnapshot({
  plan,
  sunAzimuth,
  sunAltitude,
  outsideC,
  insideC = 26,
}: {
  plan: PlanState
  sunAzimuth: number
  sunAltitude: number
  outsideC: number
  insideC?: number
}): HeatFlowSnapshot {
  const assumptions = ENVELOPE_ASSUMPTIONS
  const deltaC = outsideC - insideC
  const walls = exteriorWalls(plan)
  const wallU = plan.systems.insulation ? assumptions.wallUInsulated : assumptions.wallUUninsulated
  const shgc = plan.systems.insulation ? assumptions.windowShgcLowE : assumptions.windowShgcClear

  let exteriorWallM2 = 0
  let windowM2 = 0
  let doorM2 = 0
  let solarW = 0

  for (const wall of walls) {
    const room = plan.rooms.find((item) => item.id === wall.roomId)
    if (!room) continue
    const openings = openingsForRoomWall(plan, room.id, wall.compass)
    const windows = openings.filter((opening) => opening.type === 'window').length
    const doors = openings.length - windows
    const grossM2 = wall.lengthMeters * roomHeight(room)
    const thisWindowM2 = windows * assumptions.windowAreaM2
    const thisDoorM2 = doors * assumptions.doorAreaM2

    exteriorWallM2 += Math.max(0, grossM2 - thisWindowM2 - thisDoorM2)
    windowM2 += thisWindowM2
    doorM2 += thisDoorM2

    if (windows > 0 && sunAltitude > 0) {
      const incidence = wallIntensity(sunAzimuth, sunAltitude, wall.compass as Compass)
      solarW += assumptions.clearSkyDirectWm2 * thisWindowM2 * shgc * incidence
    }
  }

  const wallW = wallU * exteriorWallM2 * deltaC
  const openingW =
    assumptions.windowU * windowM2 * deltaC +
    assumptions.doorU * doorM2 * deltaC
  const netW = wallW + openingW + solarW
  const mode = netW > 50 ? 'heat-in' : netW < -50 ? 'heat-out' : 'balanced'

  return {
    wallW,
    openingW,
    solarW,
    netW,
    exteriorWallM2,
    windowM2,
    doorM2,
    outsideC,
    insideC,
    mode,
  }
}
