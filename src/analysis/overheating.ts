import { solarPosition, roomArea } from '../plan'
import { wallIntensity } from './sunHours'
import { peakOutdoorC } from './thermal'
import { openingsForRoomWall } from './walls'
import type { Compass, WallSun } from './types'
import type { PlanState, Room } from '../types'

// ---------------------------------------------------------------------------
// Annual overheating-hours estimate.
//
// Same directional envelope model as thermal.ts, sampled across the year:
// 12 representative days (one per month) × hours 07:00–19:00. Each sampled
// hour stands for one hour per day across that month, so the count × ~30.4
// gives occupied-hours per year above the comfort threshold. Directional —
// it ranks rooms and shows whether shading/ventilation moves the number,
// it does not replace a hourly simulation like EnergyPlus.
// ---------------------------------------------------------------------------

export const OVERHEAT_THRESHOLD_C = 30

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface OverheatingProfile {
  /** Estimated occupied-hours per year above the comfort threshold */
  hoursPerYear: number
  /** Calendar month (1–12) with the most overheating; 0 when none */
  worstMonth: number
  worstMonthLabel: string | null
  thresholdC: number
}

interface OverheatingInputs {
  latitude: number
  plan: PlanState
  room: Room
  /** Exterior walls of this room (compass + length) from the wall pass */
  walls: Array<Pick<WallSun, 'compass' | 'lengthMeters'>>
  ventilationScore: number
  insulationOn: boolean
}

/** Day-of-year for the middle of each month. */
function monthSampleDay(month: number): number {
  return Math.min(365, Math.round(15 + 30.4 * (month - 1)))
}

/**
 * Annual peak outdoor temperature by latitude. peakOutdoorC caps at 30 °C
 * above 40°, which would make cold climates "overheat" — taper it down to a
 * realistic ~24 °C at 65°+. The −3 °C converts the "worst-month absolute"
 * figure into a monthly average daily maximum.
 */
function annualPeakOutdoorC(latitude: number): number {
  const absLat = Math.abs(latitude)
  if (absLat <= 40) return peakOutdoorC(latitude) - 3
  return Math.max(21, 27 - ((absLat - 40) * 6) / 25)
}

/**
 * Seasonal offset below the annual peak outdoor temperature, in °C.
 * Peak month is July in the northern hemisphere, January in the southern.
 */
function seasonalOffset(latitude: number, month: number): number {
  const swing = Math.min(10, 2 + Math.abs(latitude) / 6)
  const peakMonth = latitude >= 0 ? 7 : 1
  const phase = ((month - peakMonth + 12 + 6) % 12) - 6 // 0 at peak month
  return (swing * Math.abs(phase)) / 6
}

/** Diurnal dip below the day's peak: 0 at 15:00, growing towards morning/evening. */
function diurnalDip(hour: number): number {
  const d = (hour - 15) / 4
  return 6 * Math.exp(-d * d)
}

export function overheatingProfile(input: OverheatingInputs): OverheatingProfile {
  const { latitude, plan, room, walls, ventilationScore, insulationOn } = input
  const area = roomArea(room)
  // Same heat-removal capacity model as thermalProfile.
  const netMass = 80 + area * 1.5 + 40 + ventilationScore * 220

  const windowsByCompass: Record<Compass, number> = { N: 0, E: 0, S: 0, W: 0 }
  for (const compass of ['N', 'E', 'S', 'W'] as Compass[]) {
    windowsByCompass[compass] = openingsForRoomWall(plan, room.id, compass).filter((o) => o.type === 'window').length
  }

  let overheatedSamples = 0
  const perMonth = new Array<number>(12).fill(0)

  for (let month = 1; month <= 12; month += 1) {
    const day = monthSampleDay(month)
    const outdoorPeak = annualPeakOutdoorC(latitude) - seasonalOffset(latitude, month)
    for (let hour = 7; hour <= 19; hour += 1) {
      const sun = solarPosition(latitude, day, hour)
      if (sun.altitude <= 0) continue

      let gain = 0
      // Opaque walls: ~600 W/m² peak irradiance × 0.35 absorptance, per hour.
      for (const wall of walls) {
        gain += wallIntensity(sun.azimuth, sun.altitude, wall.compass) * wall.lengthMeters * 210
      }
      // Glazing: ~700 W peak transmitted per window; orientation lives in the
      // intensity term, so no extra compass multiplier is needed.
      for (const compass of ['N', 'E', 'S', 'W'] as Compass[]) {
        const count = windowsByCompass[compass]
        if (count === 0) continue
        gain += count * 700 * wallIntensity(sun.azimuth, sun.altitude, compass)
      }
      if (insulationOn) gain *= 0.55

      const indoorC = outdoorPeak - diurnalDip(hour) + gain / netMass
      if (indoorC >= OVERHEAT_THRESHOLD_C) {
        overheatedSamples += 1
        perMonth[month - 1] += 1
      }
    }
  }

  const daysPerMonth = 365.25 / 12
  const hoursPerYear = Math.round(overheatedSamples * daysPerMonth)
  let worstMonth = 0
  let worstCount = 0
  perMonth.forEach((count, index) => {
    if (count > worstCount) {
      worstCount = count
      worstMonth = index + 1
    }
  })

  return {
    hoursPerYear,
    worstMonth,
    worstMonthLabel: worstMonth > 0 ? MONTH_NAMES[worstMonth - 1] : null,
    thresholdC: OVERHEAT_THRESHOLD_C,
  }
}
