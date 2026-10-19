import { describe, expect, it } from 'vitest'
import { applyNapkinStroke } from './napkinStroke'
import { roomsForOpening } from '../analysis/walls'
import { defaultSite } from '../plan'
import type { PlanState, Room } from '../types'

const site = defaultSite()

function plan(rooms: Room[] = []): PlanState {
  return {
    rooms,
    openings: [],
    furniture: [],
    walls: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
    site,
  }
}

/** A 3.9m x 5.0m room sitting in the middle of a 14m x 10m site. */
const room: Room = { id: 'r1', name: 'Room', kind: 'studio', x: 20, y: 12, w: 28, h: 36 }

function tick(x1: number, y1: number, x2: number, y2: number) {
  return [{ x: x1, y: y1 }, { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, { x: x2, y: y2 }]
}

/** A 2%-of-site tick centred on (cx, cy). */
const horizontalTick = (cx: number, cy: number) => tick(cx - 1, cy, cx + 1, cy)
const verticalTick = (cx: number, cy: number) => tick(cx, cy - 1, cx, cy + 1)

function openingFrom(p: PlanState) {
  return p.openings[p.openings.length - 1]
}

describe('napkin tick placement', () => {
  it('places an opening anywhere along a horizontal wall, including the corners', () => {
    const dropped: number[] = []
    for (let cx = room.x + 1; cx <= room.x + room.w - 1; cx += 0.5) {
      const r = applyNapkinStroke(plan([room]), horizontalTick(cx, room.y + room.h), site)
      if (!r.plan || r.plan.openings.length === 0) dropped.push(Number(cx.toFixed(1)))
    }
    expect(dropped, `ticks dropped at x = ${dropped.join(', ')}`).toEqual([])
  })

  it('places an opening anywhere along a vertical wall, including the corners', () => {
    const dropped: number[] = []
    for (let cy = room.y + 1; cy <= room.y + room.h - 1; cy += 0.5) {
      const r = applyNapkinStroke(plan([room]), verticalTick(room.x + room.w, cy), site)
      if (!r.plan || r.plan.openings.length === 0) dropped.push(Number(cy.toFixed(1)))
    }
    expect(dropped, `ticks dropped at y = ${dropped.join(', ')}`).toEqual([])
  })

  it('keeps the slid opening on the room wall and inside the room', () => {
    const r = applyNapkinStroke(plan([room]), horizontalTick(room.x + 1, room.y + room.h), site)
    expect(r.plan).not.toBeNull()
    const opening = openingFrom(r.plan!)
    expect(roomsForOpening(r.plan!, opening).map((m) => m.room.id)).toContain('r1')
    expect(opening.x).toBeGreaterThanOrEqual(room.x)
    expect(opening.x).toBeLessThanOrEqual(room.x + room.w)
  })

  it('still declines a tick that is not on a wall at all', () => {
    const r = applyNapkinStroke(plan([room]), horizontalTick(70, 5), site)
    expect(r.plan).toBeNull()
    expect(r.toast).toMatch(/tick a wall/i)
  })
})
