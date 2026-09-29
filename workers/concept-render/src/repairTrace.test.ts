import { describe, expect, it } from 'vitest'
import { repairTrace, type TracePlan } from './repairTrace'

/** The exact room sets two live runs returned, still containing overlaps. */
const run5: TracePlan = {
  rooms: [
    { id: '1', name: 'Living room', kind: 'living', x: 0, y: 0, w: 50, h: 50 },
    { id: '2', name: 'Bedroom 1', kind: 'bedroom', x: 48, y: 0, w: 52, h: 50 },
    { id: '3', name: 'Bedroom 2', kind: 'bedroom', x: 0, y: 50, w: 48, h: 50 },
    { id: '4', name: 'Bathroom', kind: 'bathroom', x: 50, y: 50, w: 50, h: 50 },
    { id: '5', name: 'Kitchen', kind: 'kitchen', x: 50, y: 48, w: 50, h: 52 },
  ],
  openings: [
    { id: 'w1', type: 'window', x: 35, y: 0, rotation: 0 },
    { id: 'w2', type: 'window', x: 100, y: 20, rotation: 90 },
    { id: 'w3', type: 'window', x: 100, y: 40, rotation: 90 },
    { id: 'd1', type: 'door', x: 50, y: 67, rotation: 90 },
  ],
}

const run1: TracePlan = {
  rooms: [
    { id: '1', name: 'Living room', kind: 'living', x: 0, y: 0, w: 50, h: 52 },
    { id: '2', name: 'Bedroom 1', kind: 'bedroom', x: 50, y: 0, w: 50, h: 52 },
    { id: '3', name: 'Bedroom 2', kind: 'bedroom', x: 0, y: 52, w: 26, h: 48 },
    { id: '4', name: 'Kitchen', kind: 'kitchen', x: 26, y: 52, w: 50, h: 48 },
    { id: '5', name: 'Bathroom', kind: 'bathroom', x: 70, y: 52, w: 30, h: 48 },
  ],
  openings: [
    { id: 'w1', type: 'window', x: 30, y: 10, rotation: 0 },
    { id: 'w2', type: 'window', x: 90, y: 23.3, rotation: 90 },
    { id: 'w3', type: 'window', x: 90, y: 36.7, rotation: 90 },
    { id: 'd1', type: 'door', x: 23.3, y: 90, rotation: 0 },
    { id: 'd2', type: 'door', x: 62.5, y: 90, rotation: 0 },
    { id: 'd3', type: 'door', x: 50, y: 70, rotation: 90 },
    { id: 'd4', type: 'door', x: 75, y: 70, rotation: 90 },
  ],
}

function overlaps(a: TracePlan['rooms'][number], b: TracePlan['rooms'][number]) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01
      && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01
}

function outOfBounds(plan: TracePlan) {
  return plan.rooms.filter(r => r.x < -0.5 || r.y < -0.5 || r.x + r.w > 100.5 || r.y + r.h > 100.5)
}

/** Same acceptance test the app's roomsForOpening applies. */
function detached(plan: TracePlan) {
  return plan.openings.filter(o => !plan.rooms.some(room => {
    const hx = 1.6 / 14 * 50
    const hy = 1.6 / 10 * 50
    if (o.rotation === 0) {
      const onEdge = Math.abs(o.y - room.y) < 1.5 || Math.abs(o.y - (room.y + room.h)) < 1.5
      return onEdge && o.x - hx >= room.x - 1e-6 && o.x + hx <= room.x + room.w + 1e-6
    }
    const onEdge = Math.abs(o.x - room.x) < 1.5 || Math.abs(o.x - (room.x + room.w)) < 1.5
    return onEdge && o.y - hy >= room.y - 1e-6 && o.y + hy <= room.y + room.h + 1e-6
  }))
}

describe('repairTrace on real live output', () => {
  for (const [label, input] of [['run5', run5], ['run1', run1]] as const) {
    it(`${label}: leaves no overlapping rooms`, () => {
      const out = repairTrace(input)
      const pairs: string[] = []
      for (let i = 0; i < out.rooms.length; i++)
        for (let k = i + 1; k < out.rooms.length; k++)
          if (overlaps(out.rooms[i], out.rooms[k])) pairs.push(`${out.rooms[i].name}/${out.rooms[k].name}`)
      expect(pairs).toEqual([])
    })

    it(`${label}: keeps every room inside the drawing`, () => {
      expect(outOfBounds(repairTrace(input)).map(r => r.name)).toEqual([])
    })

    it(`${label}: every opening lands on a wall that can hold it`, () => {
      expect(detached(repairTrace(input)).map(o => `${o.type}@${o.x},${o.y}`)).toEqual([])
    })

    it(`${label}: reports what it changed`, () => {
      expect(repairTrace(input).note).toMatch(/AI-read draft/)
    })
  }
})

describe('repairTrace guards', () => {
  it('never invents a room when the model returns none', () => {
    expect(repairTrace({ rooms: [], openings: [] }).rooms).toEqual([])
  })

  it('clamps a room that the model placed off the drawing', () => {
    const out = repairTrace({ rooms: [{ id: '1', name: 'R', kind: 'living', x: 90, y: 90, w: 40, h: 40 }], openings: [] })
    expect(outOfBounds(out)).toEqual([])
  })

  it('keeps a detached opening rather than deleting it', () => {
    const out = repairTrace({ rooms: [{ id: '1', name: 'R', kind: 'living', x: 40, y: 40, w: 20, h: 20 }], openings: [{ id: 'w', type: 'window', x: 5, y: 5, rotation: 0 }] })
    expect(out.openings).toHaveLength(1)
  })

  it('does not mutate the input plan', () => {
    const input = structuredClone(run5)
    repairTrace(input)
    expect(input).toEqual(run5)
  })
})
