import { describe, expect, it } from 'vitest'
import { openingDimensions, updateOpeningDimensions } from './openingGeometry'
import type { Opening } from './types'
const window: Opening = { id: 'w', type: 'window', x: 20, y: 0, rotation: 0 }

describe('shared aperture dimensions', () => {
  it('keeps sill, height and head consistent after editing', () => {
    const tall = updateOpeningDimensions(window, { heightM: 1.8 })
    expect(openingDimensions(tall).head).toBeCloseTo(2.7)
    const raised = updateOpeningDimensions(tall, { sillHeightM: 1.1 })
    expect(openingDimensions(raised).head).toBeCloseTo(2.9)
    const loweredHead = updateOpeningDimensions(raised, { headHeightM: 2.5 })
    expect(openingDimensions(loweredHead).height).toBeCloseTo(1.4)
  })
  it('supports a legacy head-only opening and explicit width', () => {
    expect(openingDimensions({ ...window, widthM: 2, headHeightM: 2.4 })).toEqual({ width: 2, sill: 0.9, height: 1.5, head: 2.4 })
  })
})

import { heatFlowSnapshot } from './analysis/heatFlow'
import { simulateEnergy } from './analysis/energySimulation'
import { synthesizeLayout } from './concept/layoutSynthesizer'
it('uses the same head-only aperture in heat and energy calculations', () => {
  const plan = synthesizeLayout()
  const implicit = { ...plan, openings: plan.openings.map(o => o.type === 'window' ? { ...o, heightM: undefined, sillHeightM: 0.5, headHeightM: 2.5 } : o) }
  const explicit = { ...implicit, openings: implicit.openings.map(o => o.type === 'window' ? { ...o, heightM: 2 } : o) }
  expect(simulateEnergy(implicit)).toEqual(simulateEnergy(explicit))
  expect(heatFlowSnapshot({ plan: implicit, sunAltitude: 45, sunAzimuth: 180, outsideC: 34 })).toEqual(heatFlowSnapshot({ plan: explicit, sunAltitude: 45, sunAzimuth: 180, outsideC: 34 }))
})
