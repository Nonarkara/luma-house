import { describe, expect, it } from 'vitest'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import type { PlanState } from '../types'
import { analyzeBuildingCode } from './buildingCode'

describe('analyzeBuildingCode', () => {
  it('evaluates sample chinaApartmentPlan for building code compliance', () => {
    const report = analyzeBuildingCode(chinaApartmentPlan)

    expect(report.summary.averageCeilingM).toBeGreaterThanOrEqual(2.5)
    expect(report.summary.acousticSTCRating).toBeGreaterThan(30)
    expect(report.summary.totalSleepingRooms).toBeGreaterThanOrEqual(1)
  })

  it('detects low ceiling height violation (IRC R305.1)', () => {
    const lowCeilingPlan: PlanState = {
      ...chinaApartmentPlan,
      rooms: [
        {
          id: 'bedroom-low',
          name: 'Low Bedroom',
          kind: 'bedroom',
          x: 10,
          y: 10,
          w: 30,
          h: 30,
          wallHeight: 2.1, // Below legal 2.5m clearance
        },
      ],
    }

    const report = analyzeBuildingCode(lowCeilingPlan)
    expect(report.summary.ceilingHeightStatus).toBe('WARN')
    expect(report.issues.some((i) => i.codeReference === 'IRC R305.1')).toBe(true)
  })

  it('detects structural lintel header warning for wide openings (>2.0m)', () => {
    const wideOpeningPlan: PlanState = {
      ...chinaApartmentPlan,
      openings: [
        {
          id: 'wide-window',
          type: 'window',
          x: 20,
          y: 10,
          rotation: 0,
          widthM: 3.2, // Exceeds 2.0m threshold
          heightM: 1.8,
        },
      ],
    }

    const report = analyzeBuildingCode(wideOpeningPlan)
    expect(report.issues.some((i) => i.category === 'structure' && i.codeReference === 'IBC 2308.5')).toBe(true)
  })
})
