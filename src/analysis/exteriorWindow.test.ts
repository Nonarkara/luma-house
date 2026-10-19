import { describe, expect, it } from 'vitest'
import type { PlanState, Room } from '../types'
import { exteriorWindowAnchor } from './walls'

const systems = { solar: false, insulation: false, climate: false, lighting: false }
const room = (id: string, y: number): Room => ({ id, name: id, kind: 'living', x: 10, y, w: 30, h: 20 })

function plan(rooms: Room[]): PlanState {
  return { rooms, openings: [], furniture: [], systems, site: { w: 10, h: 10, unit: 1 } }
}

describe('exterior window placement', () => {
  it('uses the requested face when it is exterior', () => {
    const anchor = exteriorWindowAnchor(plan([room('only', 20)]), room('only', 20), 'N')
    expect(anchor?.compass).toBe('N')
    expect(anchor?.y).toBe(20)
  })

  it('refuses an interior face and picks an exterior one', () => {
    const north = room('north', 10)
    const south = room('south', 30)
    const anchor = exteriorWindowAnchor(plan([north, south]), north, 'S')
    expect(anchor).not.toBeNull()
    expect(anchor?.compass).not.toBe('S')
    expect(anchor?.y).not.toBe(30)
  })
})
