import { describe, expect, it } from 'vitest'
import { comparePlans } from './abComparison'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import type { PlanState } from '../types'

describe('A/B Comparison Module', () => {
  it('calculates zero delta when baseline and proposed are identical', () => {
    const result = comparePlans(chinaApartmentPlan, chinaApartmentPlan)
    expect(result.delta.areaM2).toBeCloseTo(0)
    expect(result.delta.totalCost).toBeCloseTo(0)
    expect(result.delta.carbonKg).toBeCloseTo(0)
    expect(result.delta.netHeatWatts).toBeCloseTo(0)
  })

  it('detects cost and thermal reduction when thermal envelope is upgraded', () => {
    const uninsulatedPlan: PlanState = {
      ...chinaApartmentPlan,
      systems: { ...chinaApartmentPlan.systems, insulation: false },
    }
    const insulatedPlan: PlanState = {
      ...chinaApartmentPlan,
      systems: { ...chinaApartmentPlan.systems, insulation: true },
    }

    const result = comparePlans(uninsulatedPlan, insulatedPlan)
    expect(result.proposed.totalCost).toBeGreaterThan(result.baseline.totalCost)
    expect(result.proposed.netHeatWatts).toBeLessThan(result.baseline.netHeatWatts)
  })
})
