import { describe, expect, it } from 'vitest'
import { currencyForLocation } from './currency'
import { starterLocations } from '../location/locations'

const capeTown = {
  name: 'Cape Town',
  label: 'Cape Town, Western Cape, South Africa',
  latitude: -33.9249,
  longitude: 18.4241,
  timezone: 'Africa/Johannesburg',
}

describe('currencyForLocation', () => {
  it('follows every starter city and Cape Town', () => {
    const expected: Record<string, string> = {
      Shanghai: 'CNY',
      Bangkok: 'THB',
      'Chiang Mai': 'THB',
      Phuket: 'THB',
      Singapore: 'SGD',
      Quito: 'USD',
      Anchorage: 'USD',
    }
    for (const city of starterLocations) {
      expect(currencyForLocation(city), city.name).toBe(expected[city.name])
    }
    expect(currencyForLocation(capeTown)).toBe('ZAR')
    expect(currencyForLocation({ timezone: 'Europe/Oslo', label: 'Oslo, Norway' })).toBe('EUR')
    expect(currencyForLocation(undefined)).toBe('CNY')
  })
})
