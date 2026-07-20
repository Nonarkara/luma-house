import { describe, expect, it } from 'vitest'
import { heatFlowSnapshot } from './heatFlow'
import type { PlanState } from '../types'

const plan: PlanState = {
  site: { w: 10, h: 10, unit: 1 },
  rooms: [{ id: 'room', name: 'Room', kind: 'living', x: 10, y: 10, w: 40, h: 30, wallHeight: 3 }],
  openings: [{ id: 'south-window', type: 'window', x: 30, y: 40, rotation: 0 }],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}

describe('heatFlowSnapshot', () => {
  it('reports heat entering when outside is hotter and the south window is sunlit', () => {
    const result = heatFlowSnapshot({ plan, sunAzimuth: 180, sunAltitude: 30, outsideC: 35 })
    expect(result.wallW).toBeGreaterThan(0)
    expect(result.solarW).toBeGreaterThan(0)
    expect(result.netW).toBeGreaterThan(result.wallW)
    expect(result.mode).toBe('heat-in')
  })

  it('reports heat leaving through the envelope on a cold, sunless snapshot', () => {
    const result = heatFlowSnapshot({ plan, sunAzimuth: 180, sunAltitude: 0, outsideC: 5 })
    expect(result.wallW).toBeLessThan(0)
    expect(result.solarW).toBe(0)
    expect(result.netW).toBeLessThan(0)
    expect(result.mode).toBe('heat-out')
  })

  it('reduces transmission and solar gain when the envelope upgrade is on', () => {
    const upgraded = { ...plan, systems: { ...plan.systems, insulation: true } }
    const base = heatFlowSnapshot({ plan, sunAzimuth: 180, sunAltitude: 30, outsideC: 35 })
    const better = heatFlowSnapshot({ plan: upgraded, sunAzimuth: 180, sunAltitude: 30, outsideC: 35 })
    expect(better.wallW).toBeLessThan(base.wallW)
    expect(better.solarW).toBeLessThan(base.solarW)
    expect(better.netW).toBeLessThan(base.netW)
  })
})
