import { describe, expect, it } from 'vitest'
import { interiorBoq, REGIONAL_RATE_CARDS } from './interiorBoq'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { siteOf } from '../plan'

describe('Regional BOQ Module', () => {
  it('supports regional rate cards (CNY, USD, EUR)', () => {
    const site = siteOf(chinaApartmentPlan)
    const boqCNY = interiorBoq(chinaApartmentPlan, site, 'CNY')
    const boqUSD = interiorBoq(chinaApartmentPlan, site, 'USD')

    expect(boqCNY.currency).toBe('CNY')
    expect(boqCNY.symbol).toBe('¥')
    expect(boqUSD.currency).toBe('USD')
    expect(boqUSD.symbol).toBe('$')
    expect(REGIONAL_RATE_CARDS.CNY).toBeDefined()
    expect(REGIONAL_RATE_CARDS.USD).toBeDefined()
    expect(REGIONAL_RATE_CARDS.EUR).toBeDefined()
  })

  it('calculates total floor area and room subtotals correctly', () => {
    const site = siteOf(chinaApartmentPlan)
    const result = interiorBoq(chinaApartmentPlan, site)
    expect(result.area).toBeGreaterThan(40)
    expect(result.total).toBeGreaterThan(0)
    expect(result.rooms.length).toBe(chinaApartmentPlan.rooms.length)
  })
})
