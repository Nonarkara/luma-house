import { describe, expect, it } from 'vitest'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { simulateEnergy } from './energySimulation'

describe('simulateEnergy', () => {
  it('calculates EUI and energy rating for sample plan', () => {
    const result = simulateEnergy(chinaApartmentPlan)

    expect(result.grossEuiKwhPerM2Yr).toBeGreaterThan(0)
    expect(['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(result.energyRating)
    expect(result.breakdown.wallLossKwh).toBeGreaterThan(0)
  })

  it('improves energy rating and solar PV yield when solar systems are enabled', () => {
    const baselinePlan = {
      ...chinaApartmentPlan,
      systems: { ...chinaApartmentPlan.systems, solar: false, insulation: false },
    }
    const upgradedPlan = {
      ...chinaApartmentPlan,
      systems: { ...chinaApartmentPlan.systems, solar: true, insulation: true },
    }

    const baseline = simulateEnergy(baselinePlan)
    const upgraded = simulateEnergy(upgradedPlan)

    expect(upgraded.solarPvGenerationKwhPerM2Yr).toBeGreaterThan(0)
    expect(upgraded.netEuiKwhPerM2Yr).toBeLessThan(baseline.netEuiKwhPerM2Yr)
  })
})
