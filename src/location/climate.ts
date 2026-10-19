/**
 * A coarse outdoor temperature for a latitude and day of year.
 *
 * This is a seasonal swing around a latitude mean, not a forecast and not the
 * worst-month peak used by the overheating check. Northern winter is coldest
 * near day 15; the southern hemisphere flips that phase.
 */
export function assumedOutsideC(latitude: number, dayOfYear: number): number {
  const abs = Math.abs(latitude)
  let mean: number
  let amplitude: number
  if (abs < 15) { mean = 27; amplitude = 2.5 }
  else if (abs < 25) { mean = 24; amplitude = 6 }
  else if (abs < 35) { mean = 16; amplitude = 12 }
  else if (abs < 50) { mean = 11; amplitude = 14 }
  else if (abs < 66) { mean = 2; amplitude = 18 }
  else { mean = -10; amplitude = 20 }
  const day = Math.min(365, Math.max(1, dayOfYear))
  const winter = Math.cos(((day - 15) / 365) * 2 * Math.PI)
  const seasonal = (latitude >= 0 ? -1 : 1) * amplitude * winter
  return Math.round((mean + seasonal) * 10) / 10
}

export const OUTSIDE_ASSUMPTION = 'Assumed for this latitude and month. Not a forecast.'
