import { describe, expect, it } from 'vitest'
import { createGuidedTour } from './guidedTour'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import type { PlanState } from '../types'

const context = { sunAzimuth: 180, sunAltitude: 35, outsideC: 34, windFrom: 180, windSpeed: 3 }

describe('createGuidedTour', () => {
  it('builds four evidence-based chapters from the current plan', () => {
    const chapters = createGuidedTour(chinaApartmentPlan, context)
    expect(chapters.map((chapter) => chapter.id)).toEqual(['scale', 'volume', 'sun', 'routes'])
    expect(chapters.map((chapter) => chapter.number)).toEqual([1, 2, 3, 4])
    expect(chapters.every((chapter) => chapter.metrics.length === 4)).toBe(true)
  })

  it('does not invent sample values for a blank plan', () => {
    const blank: PlanState = {
      site: { w: 8, h: 6, unit: 0.5 },
      rooms: [],
      openings: [],
      furniture: [],
      systems: { solar: false, insulation: false, climate: false, lighting: false },
    }
    const chapters = createGuidedTour(blank, context)
    expect(chapters[0].metrics.find((metric) => metric.label === 'Drawn floor area')?.value).toBe('0.0 m²')
    expect(chapters[1].metrics.find((metric) => metric.label === 'Wall height range')?.value).toBe('No rooms')
    expect(chapters[3].metrics.find((metric) => metric.label === 'Door paths outdoors')?.value).toBe('0 / 0 rooms')
  })

  it('uses the supplied environmental inputs', () => {
    const first = createGuidedTour(chinaApartmentPlan, context)
    const changed = createGuidedTour(chinaApartmentPlan, { ...context, windFrom: 90, windSpeed: 5 })
    expect(first[3].metrics[1].value).toBe('180° · 3.0 m/s')
    expect(changed[3].metrics[1].value).toBe('90° · 5.0 m/s')
  })
})
