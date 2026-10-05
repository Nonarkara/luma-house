import { describe, expect, it } from 'vitest'
import { citySunPosition, citySunTimes, clockLabel, localDate, normalizedCivilHour } from './solar'
import { sanitizeLocation, starterLocations } from './locations'
import { decodePlanFromHash, encodePlanToHash } from '../sharePlan'
import { initialPlan } from '../plan'
import type { ProjectLocation } from '../types'
const ny: ProjectLocation = { name: 'New York', label: 'New York, US', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' }
const tromso: ProjectLocation = { name: 'Tromsø', label: 'Tromsø, Norway', latitude: 69.6492, longitude: 18.9553, timezone: 'Europe/Oslo' }

describe('city civil time and sun geometry', () => {
  it('uses the city time zone, including seasonal daylight saving', () => {
    expect(localDate(ny, 1, 10, 2026).toISOString()).toBe('2026-01-01T15:00:00.000Z')
    expect(localDate(ny, 172, 10.25, 2026).toISOString()).toBe('2026-06-21T14:15:00.000Z')
    expect(localDate(starterLocations[0], 355, 10, 2026).toISOString()).toBe('2026-12-21T02:00:00.000Z')
  })
  it('reports skipped DST times and chooses the first repeated hour', () => {
    expect(localDate(ny, 67, 2.5, 2026).toISOString()).toBe('2026-03-08T07:30:00.000Z')
    expect(normalizedCivilHour(ny, 67, 2.5, 2026)).toBe(3.5)
    expect(localDate(ny, 305, 1.5, 2026).toISOString()).toBe('2026-11-01T05:30:00.000Z')
    expect(normalizedCivilHour(ny, 305, 1.5, 2026)).toBe(1.5)
    expect(normalizedCivilHour(ny, 172, 24, 2026)).toBe(24)
  })
  it('longitude changes the actual sun at the same local clock time', () => {
    const west = citySunPosition({ ...ny, longitude: -100 }, 172, 10, 2026)
    const east = citySunPosition({ ...ny, longitude: -60 }, 172, 10, 2026)
    expect(Math.abs(west.altitude - east.altitude)).toBeGreaterThan(15)
  })
  it('handles midnight sun and polar night without invented rise/set times', () => {
    const summer = citySunTimes(tromso, 172, 2026)
    const winter = citySunTimes(tromso, 355, 2026)
    expect(summer.alwaysUp).toBe(true)
    expect(summer.sunset).toBeNull()
    expect(winter.alwaysDown).toBe(true)
    expect(winter.sunrise).toBeNull()
    expect(citySunPosition(tromso, 172, 0, 2026).altitude).toBeGreaterThan(0)
    expect(citySunPosition(tromso, 355, 12, 2026).altitude).toBeLessThan(0)
  })
  it('formats fractional slider hours as minutes', () => {
    expect(clockLabel(10.25)).toBe('10:15')
    expect(clockLabel(24)).toBe('24:00')
  })
  it('preserves a worldwide city in a shared drawing and rejects invalid coordinates/zones', () => {
    const plan = { ...initialPlan, location: ny }
    expect(decodePlanFromHash('#plan=' + encodePlanToHash(plan))?.location).toEqual(ny)
    expect(sanitizeLocation({ ...ny, latitude: 91 })).toBeUndefined()
    expect(sanitizeLocation({ ...ny, longitude: NaN })).toBeUndefined()
    expect(sanitizeLocation({ ...ny, timezone: 'Mars/Olympus' })).toBeUndefined()
  })
})
