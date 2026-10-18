import { describe, expect, it } from 'vitest'
import { planToDxf } from './planExchange'
import type { PlanState } from '../types'

const plan: PlanState = {
  site: { w: 10, h: 8, unit: 1 },
  rooms: [{ id: 'room', name: 'Living', kind: 'living', x: 10, y: 20, w: 40, h: 30 }],
  openings: [],
  furniture: [],
  walls: [{ id: 'w', x1: 0, y1: 0, x2: 50, y2: 0 }],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}

describe('planToDxf', () => {
  it('writes room edges in metres with north as +Y', () => {
    const dxf = planToDxf(plan)
    expect(dxf).toContain('ENTITIES')
    expect(dxf).toContain('EOF')
    expect(dxf).toContain('ROOMS')
    expect(dxf).toContain('WALLS')
    expect(dxf).toContain('1.0000')
    expect(dxf).toContain('6.4000')
  })
})
