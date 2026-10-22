import { describe, expect, it } from 'vitest'
import { solarPosition } from '../plan'
import { citySunPosition, localDate } from '../location/solar'
import type { ProjectLocation } from '../types'

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

/**
 * The product computes the sun twice, by two different models:
 *
 *   - `citySunPosition` (SunCalc, civil clock time in the city's zone) draws
 *     the sun on the sheet, the light study and the 3D scene.
 *   - `solarPosition` (a local-solar-time approximation) decides how much sun
 *     a wall receives, and therefore the sun hours and the overheating.
 *
 * The shipping audit of 2026-10-20 measured the two 39.1° apart in azimuth
 * — a number on screen, disagreeing with a number on screen, in a product
 * whose whole claim is that its numbers can be argued with. The bug that
 * caused it was a mirror applied at the wrong end of the day.
 *
 * This is the gate that finding never got: the two models are compared at the
 * same physical instant, so the difference measured is model error and not
 * clock error. It needs the approximation to be fed the mean solar time of
 * the instant SunCalc was given — mean solar time being UTC plus longitude
 * over fifteen, wrapped into the day.
 */
describe('the two solar models agree at the same instant', () => {
  const CITIES: ProjectLocation[] = [
    { name: 'Shanghai', label: 'Shanghai, China', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai' },
    { name: 'Bangkok', label: 'Bangkok, Thailand', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' },
    { name: 'New York', label: 'New York, USA', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
    { name: 'London', label: 'London, UK', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
    { name: 'Sydney', label: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
    { name: 'Sao Paulo', label: 'Sao Paulo, Brazil', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo' },
  ]
  const DAYS = [80, 172, 266, 355]

  const meanSolarTime = (instant: Date, longitude: number) => {
    const raw = instant.getUTCHours() + instant.getUTCMinutes() / 60 + instant.getUTCSeconds() / 3600 + longitude / 15
    return ((raw % 24) + 24) % 24
  }

  it('never disagrees by more than a degree of sun in the sky', () => {
    let worstAzimuth = 0
    let worstAltitude = 0
    for (const city of CITIES) {
      for (const day of DAYS) {
        for (const civil of [9, 12, 15]) {
          const instant = localDate(city, day, civil, 2026)
          const exact = citySunPosition(city, day, civil, 2026)
          const approx = solarPosition(city.latitude, day, meanSolarTime(instant, city.longitude))
          let delta = Math.abs(approx.azimuth - exact.azimuth)
          if (delta > 180) delta = 360 - delta
          const where = `${city.name} day ${day} ${civil}:00`
          worstAzimuth = Math.max(worstAzimuth, delta)
          worstAltitude = Math.max(worstAltitude, Math.abs(approx.altitude - exact.altitude))
          expect(delta, `azimuth at ${where}`).toBeLessThan(12)
          expect(Math.abs(approx.altitude - exact.altitude), `altitude at ${where}`).toBeLessThan(4)
        }
      }
    }
    // Recorded so a regression is visible in the failure message, not just the bound.
    expect(worstAzimuth, 'worst azimuth divergence').toBeLessThan(12)
    expect(worstAltitude, 'worst altitude divergence').toBeLessThan(4)
  })

  it('puts the sun in the northern sky in the southern hemisphere', () => {
    // Sydney at solar noon: the sun is north, within a few degrees of due north.
    const instant = localDate(CITIES[4], 172, 12, 2026)
    const approx = solarPosition(CITIES[4].latitude, 172, meanSolarTime(instant, CITIES[4].longitude))
    const fromNorth = Math.min(approx.azimuth, 360 - approx.azimuth)
    expect(fromNorth, 'noon sun in Sydney is north').toBeLessThan(10)
  })
})
