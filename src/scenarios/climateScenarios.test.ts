import { describe, expect, it } from 'vitest'
import { CLIMATE_SCENARIOS, evaluateScenario } from './climateScenarios'
import { chinaApartmentPlan } from '../mockups/chinaApartment'

describe('climate what-if scenarios', () => {
  it('defines four explicit input sets without claiming historical weather', () => {
    expect(CLIMATE_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'hot_afternoon',
      'winter_noon',
      'cross_breeze',
      'still_evening',
    ])
    expect(CLIMATE_SCENARIOS.every((scenario) => scenario.params.windSpeed > 0)).toBe(true)
  })

  it('evaluates every scenario from plan geometry and latitude', () => {
    for (const scenario of CLIMATE_SCENARIOS) {
      const result = evaluateScenario(scenario, chinaApartmentPlan, 31.2304)
      expect(result.status).toMatch(/Watch|Opportunity|Compare/)
      expect(result.headline).toBeTruthy()
      expect(result.keyInsight).toBeTruthy()
      expect(result.recommendation).toBeTruthy()
      expect(result.metrics).toHaveLength(4)
    }
  })

  it('uses latitude to calculate scenario sun position', () => {
    const winter = CLIMATE_SCENARIOS.find((scenario) => scenario.id === 'winter_noon')!
    const shanghai = evaluateScenario(winter, chinaApartmentPlan, 31.2304)
    const singapore = evaluateScenario(winter, chinaApartmentPlan, 1.3521)
    expect(shanghai.metrics[0].value).not.toBe(singapore.metrics[0].value)
  })

  it('does not claim strong ventilation when wind is nearly still', () => {
    const still = CLIMATE_SCENARIOS.find((scenario) => scenario.id === 'still_evening')!
    const result = evaluateScenario(still, chinaApartmentPlan, 31.2304)
    expect(result.status).toBe('Watch')
    expect(result.headline).toContain('cannot rely on wind')
  })
})
