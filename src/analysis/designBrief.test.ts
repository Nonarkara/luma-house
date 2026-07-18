import { describe, expect, it } from 'vitest'
import { analyze } from './index'
import { buildDesignBrief } from './designBrief'
import { completeHousePlan } from '../mockups/completeHouse'
import { locations } from '../plan'
import type { PlanState } from '../types'

describe('buildDesignBrief', () => {
  it('recommends insulation in tropical overheating conditions when shell is off', () => {
    const plan: PlanState = {
      ...completeHousePlan,
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    }
    const climate = analyze({ plan, location: locations.Bangkok })
    const brief = buildDesignBrief(plan, climate)
    const insulation = brief.items.find((item) => item.id === 'insulation')
    expect(insulation?.recommended).toBe(true)
    expect(brief.projectedTotalTHB).toBeGreaterThan(0)
    expect(brief.topActions.length).toBeGreaterThan(0)
  })

  it('prioritizes shell language for Anchorage', () => {
    const plan: PlanState = {
      ...completeHousePlan,
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    }
    const climate = analyze({ plan, location: locations.Anchorage })
    const brief = buildDesignBrief(plan, climate)
    expect(brief.summary.toLowerCase()).toContain('insulated')
    expect(brief.items.find((item) => item.id === 'insulation')?.recommended).toBe(true)
  })
})
