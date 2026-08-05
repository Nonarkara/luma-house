import { describe, expect, it } from 'vitest'
import { synthesizeLayout } from './layoutSynthesizer'

describe('synthesizeLayout', () => {
  it('generates a valid, non-empty PlanState for default courtyard style', () => {
    const plan = synthesizeLayout({ style: 'courtyard' })

    expect(plan.rooms.length).toBeGreaterThanOrEqual(4)
    expect(plan.openings.length).toBeGreaterThan(0)
    expect(plan.furniture.length).toBeGreaterThan(0)
    expect(plan.rooms.some((r) => r.kind === 'living')).toBe(true)
  })

  it('generates L-shaped and linear layout styles correctly', () => {
    const lShaped = synthesizeLayout({ style: 'l-shaped', includeStudy: true })
    const linear = synthesizeLayout({ style: 'linear' })

    expect(lShaped.rooms.some((r) => r.kind === 'studio')).toBe(true)
    expect(linear.rooms.length).toBe(4)
  })
})
