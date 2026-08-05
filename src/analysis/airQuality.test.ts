import { describe, expect, it } from 'vitest'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { analyzeAirQuality } from './airQuality'

describe('analyzeAirQuality', () => {
  it('evaluates indoor air quality and CO2 accumulation for sample plan', () => {
    const report = analyzeAirQuality(chinaApartmentPlan)

    expect(report.rooms.length).toBeGreaterThan(0)
    expect(report.averageCo2Ppm).toBeGreaterThan(400)
    expect(['EXCELLENT', 'GOOD', 'MODERATE', 'POOR']).toContain(report.overallIaq)
  })

  it('improves CO2 ppm when climate HRV system is enabled', () => {
    const baseline = analyzeAirQuality(chinaApartmentPlan)

    const hrvPlan = {
      ...chinaApartmentPlan,
      systems: { ...chinaApartmentPlan.systems, climate: true },
    }

    const upgraded = analyzeAirQuality(hrvPlan)
    expect(upgraded.averageCo2Ppm).toBeLessThanOrEqual(baseline.averageCo2Ppm)
  })
})
