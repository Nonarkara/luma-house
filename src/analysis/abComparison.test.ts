import { describe, expect, it } from 'vitest'
import { comparePlans } from './abComparison'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import type { PlanState } from '../types'
import { heatFlowSnapshot } from './heatFlow'
import { windFlowPotential } from './windFlow'

describe('A/B Comparison Module', () => {
  it('uses the same supplied sun and weather context for both plans, including night and still air', () => {
    const context = { label: 'Bangkok · selected civil time', sunAzimuth: 90, sunAltitude: -15, outsideC: 20, windFrom: 270, windSpeed: 0 }
    const proposed = { ...chinaApartmentPlan, systems: { ...chinaApartmentPlan.systems, insulation: false } }
    const result = comparePlans(chinaApartmentPlan, proposed, context)
    expect(result.context).toEqual(context)
    expect(result.context).not.toBe(context)
    expect(result.baseline.netHeatWatts).toBeCloseTo(heatFlowSnapshot({ plan: chinaApartmentPlan, ...context }).netW)
    expect(result.proposed.netHeatWatts).toBeCloseTo(heatFlowSnapshot({ plan: proposed, ...context }).netW)
    expect(result.baseline.avgAch).toBeCloseTo(windFlowPotential(chinaApartmentPlan, 270, 0).reduce((sum, v) => sum + (v.ach ?? 0), 0) / chinaApartmentPlan.rooms.length)
    expect(result.baseline.netHeatWatts).not.toBeCloseTo(comparePlans(chinaApartmentPlan, proposed).baseline.netHeatWatts)
  })

  it('names reference assumptions when no project conditions are supplied', () => {
    expect(comparePlans(chinaApartmentPlan, chinaApartmentPlan).context.label).toMatch(/Reference conditions/)
  })
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
