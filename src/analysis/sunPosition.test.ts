import { describe, expect, it } from 'vitest'
import { solarPosition } from '../plan'

/**
 * The product's claim is "design with light, not guesswork", so the sun has to
 * be where the sun is. These are the standard values for 31.23 N (Shanghai).
 *
 * The convention, stated in sunHours.ts, is clockwise from north:
 * 0 = N, 90 = E, 180 = S, 270 = W.
 */
const LAT = 31.23

describe('solar position is astronomically true', () => {
  it('puts the noon sun due south in the northern hemisphere', () => {
    // At solar noon the sun is on the meridian: due south at 31 N, 180 deg.
    for (const [label, day] of [['equinox', 80], ['summer solstice', 172], ['winter solstice', 355]] as const) {
      expect(Math.abs(solarPosition(LAT, day, 12).azimuth - 180), `${label} noon azimuth`).toBeLessThan(1)
    }
  })

  it('gives the correct noon altitude', () => {
    // altitude = 90 - latitude + declination
    expect(solarPosition(LAT, 172, 12).altitude).toBeCloseTo(82.22, 1) // 21 Jun
    expect(solarPosition(LAT, 355, 12).altitude).toBeCloseTo(35.32, 1) // 21 Dec
  })

  it('rises in the east and sets in the west on the equinox', () => {
    const equinoxSunrise = solarPosition(LAT, 80, 6)
    const equinoxSunset = solarPosition(LAT, 80, 18)
    expect(Math.abs(equinoxSunrise.azimuth - 90)).toBeLessThan(2) // due east
    expect(Math.abs(equinoxSunset.azimuth - 270)).toBeLessThan(2) // due west
  })

  it('sweeps east -> south -> west, monotonically, through the day', () => {
    const azimuths = [7, 9, 11, 13, 15, 17].map((hour) => solarPosition(LAT, 80, hour).azimuth)
    for (let i = 1; i < azimuths.length; i++) {
      expect(azimuths[i], `azimuth must increase from ${azimuths[i - 1].toFixed(1)}`).toBeGreaterThan(azimuths[i - 1])
    }
    expect(azimuths[0]).toBeLessThan(180) // morning: east of south
    expect(azimuths[azimuths.length - 1]).toBeGreaterThan(180) // afternoon: west of south
  })

  it('is symmetric about solar noon', () => {
    for (const day of [80, 172, 355]) {
      for (const hour of [7, 9, 11]) {
        const morning = solarPosition(LAT, day, hour)
        const afternoon = solarPosition(LAT, day, 24 - hour)
        expect(morning.altitude).toBeCloseTo(afternoon.altitude, 6)
        expect(afternoon.azimuth).toBeCloseTo(360 - morning.azimuth, 6)
      }
    }
  })

  it('gives Shanghai a ~14h summer day and a ~10h winter day', () => {
    const dayLength = (dayOfYear: number) => {
      let rise = -1
      let set = -1
      for (let h = 0; h <= 24; h += 0.05) {
        const { altitude } = solarPosition(LAT, dayOfYear, h)
        if (altitude > 0) { if (rise < 0) rise = h; set = h }
      }
      return set - rise
    }
    expect(dayLength(172)).toBeGreaterThan(13.5) // summer solstice
    expect(dayLength(355)).toBeLessThan(10.5) // winter solstice
    expect(dayLength(172)).toBeGreaterThan(dayLength(355))
  })

  it('is below the horizon at midnight, so nothing depends on a night azimuth', () => {
    expect(solarPosition(LAT, 172, 0).altitude).toBe(0)
    expect(solarPosition(LAT, 172, 0).azimuth).toBeGreaterThanOrEqual(0)
  })
})
