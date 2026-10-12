import { describe, expect, it } from 'vitest'
import { locationForTimeZone } from './timeZoneLocation'

describe('locationForTimeZone', () => {
  it('maps Asia/Bangkok to Bangkok rather than another city in that zone', () => {
    const city = locationForTimeZone('Asia/Bangkok')
    expect(city.name).toBe('Bangkok')
    expect(city.timezone).toBe('Asia/Bangkok')
  })

  it('maps Asia/Shanghai to Shanghai', () => {
    expect(locationForTimeZone('Asia/Shanghai').name).toBe('Shanghai')
  })

  it('falls back when the zone is not in the starter list', () => {
    expect(locationForTimeZone('UTC').name).toBe('Shanghai')
  })
})
