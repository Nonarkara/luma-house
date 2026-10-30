import { describe, expect, it } from 'vitest'
import {
  eraseAt,
  eraseTargetAt,
  nextTrimCut,
  removeRoomFromPlan,
  topmostRoomAt,
  trimAt,
  trimCutAgainst,
  trimOverlaps,
  trimPreviewAt,
} from './editing'
import type { Furniture, Opening, PlanState, Room } from '../types'
import { defaultSite } from '../plan'

const site = defaultSite()

function plan(rooms: Room[] = [], extra: Partial<PlanState> = {}): PlanState {
  return {
    rooms,
    openings: [],
    furniture: [],
    walls: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
    site,
    ...extra,
  }
}

const living: Room = { id: 'living', name: 'Living', kind: 'living', x: 10, y: 10, w: 40, h: 40 }
const bedroom: Room = { id: 'bed', name: 'Bedroom', kind: 'bedroom', x: 50, y: 10, w: 30, h: 40 }

function room(over: Partial<Room> & { id: string }): Room {
  return { name: over.id, kind: 'studio', x: 0, y: 0, w: 20, h: 20, ...over }
}

describe('eraseTargetAt', () => {
  it('finds the furniture under the cursor before the room it stands in', () => {
    const sofa: Furniture = { id: 'sofa-1', kind: 'sofa', x: 20, y: 20, rotated: false, wM: 2, dM: 0.9 }
    const current = plan([living], { furniture: [sofa] })
    const hit = eraseTargetAt(current, { x: 21, y: 21 })
    expect(hit?.kind).toBe('furniture')
    expect(hit?.id).toBe('sofa-1')
  })

  it('finds an opening on the wall before the room behind it', () => {
    const window: Opening = { id: 'op-1', type: 'window', x: 30, y: 10, rotation: 0, widthM: 1.6 }
    const current = plan([living], { openings: [window] })
    const hit = eraseTargetAt(current, { x: 30, y: 10 })
    expect(hit?.kind).toBe('opening')
    expect(hit?.id).toBe('op-1')
  })

  it('finds an unfinished pencil wall', () => {
    const current = plan([], { walls: [{ id: 'wall-1', x1: 10, y1: 80, x2: 40, y2: 80 }] })
    const hit = eraseTargetAt(current, { x: 25, y: 80 })
    expect(hit?.kind).toBe('wall')
    expect(hit?.id).toBe('wall-1')
  })

  it('falls through to the room when nothing smaller is there', () => {
    const hit = eraseTargetAt(plan([living]), { x: 30, y: 30 })
    expect(hit?.kind).toBe('room')
    expect(hit?.id).toBe('living')
  })

  it('finds nothing on empty paper', () => {
    expect(eraseTargetAt(plan([living]), { x: 90, y: 90 })).toBeNull()
  })

  it('takes the smaller room when two overlap', () => {
    const hit = eraseTargetAt(plan([living, room({ id: 'shed', x: 20, y: 20, w: 10, h: 10 })]), { x: 25, y: 25 })
    expect(hit?.id).toBe('shed')
  })
})

describe('eraseAt', () => {
  it('removes a room', () => {
    const outcome = eraseAt(plan([living, bedroom]), { x: 30, y: 30 })
    expect(outcome.target?.kind).toBe('room')
    expect(outcome.plan.rooms.map((item) => item.id)).toEqual(['bed'])
  })

  it('removes the furniture that stood in the room it removed', () => {
    const sofa: Furniture = { id: 'sofa-1', kind: 'sofa', x: 20, y: 20, rotated: false, wM: 2, dM: 0.9 }
    const outcome = eraseAt(plan([living], { furniture: [sofa] }), { x: 30, y: 30 })
    expect(outcome.plan.furniture).toHaveLength(0)
  })

  it('keeps an opening that a neighbouring room still hosts', () => {
    // The opening sits on the wall the two rooms share.
    const shared: Opening = { id: 'op-1', type: 'door', x: 50, y: 30, rotation: 90, widthM: 0.9 }
    const current = plan([living, bedroom], { openings: [shared] })
    const outcome = eraseAt(current, { x: 30, y: 30 })
    expect(outcome.plan.rooms.map((item) => item.id)).toEqual(['bed'])
    expect(outcome.plan.openings).toHaveLength(1)
  })

  it('removes an opening whose wall went with the room', () => {
    const outside: Opening = { id: 'op-1', type: 'window', x: 30, y: 10, rotation: 0, widthM: 1.6 }
    const current = plan([living], { openings: [outside] })
    const outcome = eraseAt(current, { x: 30, y: 30 })
    expect(outcome.plan.openings).toHaveLength(0)
  })

  it('removes an opening when it is the thing under the cursor', () => {
    const window: Opening = { id: 'op-1', type: 'window', x: 30, y: 10, rotation: 0, widthM: 1.6 }
    const outcome = eraseAt(plan([living], { openings: [window] }), { x: 30, y: 10 })
    expect(outcome.plan.openings).toHaveLength(0)
    expect(outcome.plan.rooms).toHaveLength(1)
  })

  it('removes an unfinished pencil wall and leaves the rooms alone', () => {
    const current = plan([living], { walls: [{ id: 'wall-1', x1: 10, y1: 80, x2: 40, y2: 80 }] })
    const outcome = eraseAt(current, { x: 25, y: 80 })
    expect(outcome.plan.walls).toHaveLength(0)
    expect(outcome.plan.rooms).toHaveLength(1)
  })

  it('says so when there is nothing to erase', () => {
    const outcome = eraseAt(plan([living]), { x: 90, y: 90 })
    expect(outcome.target).toBeNull()
    expect(outcome.unchanged).toBe(true)
    expect(outcome.toast).toBe('Nothing to erase here')
  })
})

describe('removeRoomFromPlan', () => {
  it('leaves the plan alone when the room is not there', () => {
    const current = plan([living])
    expect(removeRoomFromPlan(current, 'nope')).toBe(current)
  })
})

describe('trimCutAgainst', () => {
  it('cuts a room back to the wall it crosses', () => {
    // The new room runs from x=30 to x=70 and y=30 to y=60; the old room ends
    // at x=50 and y=40. The crossing is the 20×10 band at the new room's
    // top-left corner, so two walls would clear it: the old room's east wall
    // (a 20×30 column, 600) and its south wall (a 40×10 band, 400). The trim
    // takes the smaller one.
    const crossing = room({ id: 'new', x: 30, y: 30, w: 40, h: 30 })
    const existing = room({ id: 'old', x: 10, y: 10, w: 40, h: 30 })
    const cut = trimCutAgainst(crossing, existing, site)
    expect(cut?.outcome).toBe('cut')
    expect(cut?.next.y).toBe(40)
    expect(cut?.next.h).toBe(20)
    expect(cut?.againstCompass).toBe('S')
  })

  it('cuts on the vertical wall when the horizontal one would cost more', () => {
    // A taller old room: the east wall leaves a 20×30 column (600) while the
    // south wall would leave a 40×20 strip (800) — and a 10% room is a sliver.
    const crossing = room({ id: 'new', x: 30, y: 30, w: 40, h: 30 })
    const existing = room({ id: 'old', x: 10, y: 10, w: 40, h: 40 })
    const cut = trimCutAgainst(crossing, existing, site)
    expect(cut?.outcome).toBe('cut')
    expect(cut?.next.x).toBe(50)
    expect(cut?.next.w).toBe(20)
    expect(cut?.againstCompass).toBe('E')
  })

  it('takes the smallest cut when two walls would do', () => {
    // The crossing is a thin band along the top of the room, so the band is
    // cheaper to take than the column under it.
    const crossing = room({ id: 'new', x: 30, y: 30, w: 40, h: 30 })
    const existing = room({ id: 'old', x: 10, y: 10, w: 40, h: 30 })
    const cut = trimCutAgainst(crossing, existing, site)
    expect(cut).not.toBeNull()
    expect(cut!.removedM2).toBeGreaterThan(0)
    expect(cut!.next.w).toBeGreaterThan(0)
  })

  it('reports a room that lies entirely inside another', () => {
    const inside = room({ id: 'shed', x: 40, y: 40, w: 14, h: 14 })
    const host = room({ id: 'hall', x: 0, y: 0, w: 80, h: 80 })
    const cut = trimCutAgainst(inside, host, site)
    expect(cut?.outcome).toBe('remove-room')
  })

  it('refuses a cut that would leave a sliver', () => {
    const sliver = room({ id: 'sliver', x: 40, y: 40, w: 14, h: 14 })
    const host = room({ id: 'hall', x: 0, y: 0, w: 45, h: 45 })
    const cut = trimCutAgainst(sliver, host, site)
    expect(cut?.outcome).toBe('refused')
    expect(cut?.reason).toBeTruthy()
  })

  it('finds no cut between two rooms that do not touch', () => {
    expect(trimCutAgainst(room({ id: 'a', x: 0, y: 0, w: 20, h: 20 }), room({ id: 'b', x: 60, y: 60, w: 20, h: 20 }), site)).toBeNull()
  })
})

describe('topmostRoomAt', () => {
  it('takes the room drawn last where two overlap', () => {
    const found = topmostRoomAt(plan([living, room({ id: 'shed', x: 20, y: 20, w: 10, h: 10 })]), { x: 25, y: 25 })
    expect(found?.id).toBe('shed')
  })
})

describe('trimAt', () => {
  it('cuts the overlapping part away and names the wall it followed', () => {
    const crossing = room({ id: 'new', name: 'Bedroom', x: 30, y: 30, w: 40, h: 30 })
    const existing = room({ id: 'old', name: 'Kitchen', x: 10, y: 10, w: 40, h: 40 })
    const outcome = trimAt(plan([existing, crossing]), { x: 60, y: 45 })
    expect(outcome.unchanged).toBe(false)
    expect(outcome.plan.rooms.find((item) => item.id === 'new')?.x).toBe(50)
    expect(outcome.toast).toContain('Bedroom')
    expect(outcome.toast).toContain('Kitchen')
  })

  it('says so when the room crosses nothing', () => {
    const outcome = trimAt(plan([living]), { x: 30, y: 30 })
    expect(outcome.unchanged).toBe(true)
    expect(outcome.toast).toBe('Nothing to trim — this room does not cross another')
  })

  it('removes a room that sits entirely inside another', () => {
    const inside = room({ id: 'shed', name: 'Closet', x: 40, y: 40, w: 14, h: 14 })
    const host = room({ id: 'hall', name: 'Hall', x: 0, y: 0, w: 80, h: 80 })
    const outcome = trimAt(plan([host, inside]), { x: 45, y: 45 })
    expect(outcome.plan.rooms.map((item) => item.id)).toEqual(['hall'])
    expect(outcome.toast).toContain('Closet')
  })

  it('refuses a cut that would leave a sliver and changes nothing', () => {
    const sliver = room({ id: 'sliver', x: 40, y: 40, w: 14, h: 14 })
    const host = room({ id: 'hall', x: 0, y: 0, w: 45, h: 45 })
    const outcome = trimAt(plan([host, sliver]), { x: 45, y: 45 })
    expect(outcome.unchanged).toBe(true)
    expect(outcome.plan.rooms).toHaveLength(2)
    expect(outcome.toast).toContain('too small')
  })

  it('takes the room drawn last when the click lands in an overlap', () => {
    const crossing = room({ id: 'new', x: 30, y: 30, w: 40, h: 30 })
    const existing = room({ id: 'old', x: 10, y: 10, w: 40, h: 30 })
    const outcome = trimAt(plan([existing, crossing]), { x: 40, y: 40 })
    expect(outcome.cuts[0]?.roomId).toBe('new')
  })
})

describe('trimPreviewAt', () => {
  it('reports the cut without changing the plan', () => {
    const crossing = room({ id: 'new', x: 30, y: 30, w: 40, h: 30 })
    const existing = room({ id: 'old', x: 10, y: 10, w: 40, h: 30 })
    const current = plan([existing, crossing])
    const preview = trimPreviewAt(current, { x: 60, y: 45 })
    expect(preview?.outcome).toBe('cut')
    expect(current.rooms.find((item) => item.id === 'new')?.x).toBe(30)
  })

  it('finds nothing on empty paper', () => {
    expect(trimPreviewAt(plan([living]), { x: 90, y: 90 })).toBeNull()
  })
})

describe('nextTrimCut', () => {
  it('finds no cut for a room that is alone', () => {
    expect(nextTrimCut(plan([living]), 'living')).toBeNull()
  })
})

describe('trimOverlaps', () => {
  it('cuts the room that was drawn over another', () => {
    const crossing = room({ id: 'new', name: 'New room', x: 30, y: 30, w: 70, h: 30 })
    const existing = room({ id: 'old', name: 'Old room', x: 10, y: 10, w: 40, h: 40 })
    const outcome = trimOverlaps(plan([existing, crossing]))
    expect(outcome.unchanged).toBe(false)
    expect(outcome.trimmed).toBe(1)
    // The room drawn last is the one cut, exactly as the trim tool behaves
    // when you click the top of an overlap. The old room ends at x=50, so the
    // new room is cut back to that wall and keeps the rest of its width.
    expect(outcome.plan.rooms.find((item) => item.id === 'new')?.x).toBe(50)
    expect(outcome.plan.rooms.find((item) => item.id === 'new')?.w).toBe(50)
    expect(outcome.plan.rooms.find((item) => item.id === 'old')?.x).toBe(10)
  })

  it('says so when nothing overlaps', () => {
    const outcome = trimOverlaps(plan([living, bedroom]))
    expect(outcome.unchanged).toBe(true)
    expect(outcome.trimmed).toBe(0)
  })

  it('leaves the plan alone when the cut would leave a sliver', () => {
    // The old room ends at x=60 and the new room runs from x=30 to x=70, so
    // the only cut leaves ten percent of a room — too small to use.
    const host: Room = { id: 'host', name: 'Host room', kind: 'living', x: 20, y: 20, w: 40, h: 40 }
    const crossing = room({ id: 'new', name: 'New room', x: 30, y: 30, w: 40, h: 30 })
    const outcome = trimOverlaps(plan([host, crossing]))
    expect(outcome.unchanged).toBe(true)
    expect(outcome.toast).toContain('too small')
    expect(outcome.plan.rooms).toHaveLength(2)
  })
})

describe('trimAt settles what stood on the cut floor', () => {
  // Found on review: a trim took the floor but left its furniture and openings
  // standing in the void, still counted in the bill and floating in the 3D.
  const existing = room({ id: 'old', name: 'Kitchen', x: 10, y: 10, w: 40, h: 40 })
  const crossing = room({ id: 'new', name: 'Bedroom', x: 30, y: 30, w: 40, h: 30 })
  const bed: Furniture = { id: 'bed', kind: 'sofa', x: 32, y: 51, rotated: false } // in the cut band (x < 50), below the Kitchen
  const robe: Furniture = { id: 'robe', kind: 'wardrobe', x: 62, y: 40, rotated: false } // in the kept part
  const strayDoor: Opening = { id: 'd-west', type: 'door', x: 30, y: 45, rotation: 90 } // on the Bedroom's old west wall
  it('removes the piece that stood in the cut band, keeps the one in the kept room, and says so', () => {
    const outcome = trimAt(plan([existing, crossing], { furniture: [bed, robe] }), { x: 60, y: 45 })
    expect(outcome.plan.rooms.find((item) => item.id === 'new')?.x).toBe(50)
    expect(outcome.plan.furniture.map((item) => item.id)).toEqual(['robe'])
    expect(outcome.toast).toContain('1 piece of furniture')
  })
  it('keeps a piece that is still inside some other room after the cut', () => {
    const inOld: Furniture = { ...bed, x: 31, y: 36 } // centre lies in the Kitchen too
    const outcome = trimAt(plan([existing, crossing], { furniture: [inOld] }), { x: 60, y: 45 })
    expect(outcome.plan.furniture).toHaveLength(1)
  })
  it('drops an opening whose wall was cut away and leaves one on a surviving wall', () => {
    const onKept: Opening = { id: 'w-east', type: 'window', x: 70, y: 45, rotation: 90 }
    const outcome = trimAt(plan([existing, crossing], { openings: [strayDoor, onKept] }), { x: 60, y: 45 })
    expect(outcome.plan.openings.some((item) => item.id === 'w-east')).toBe(true)
  })
})



describe('trim footprint conservation', () => {
  it('removes furniture straddling a new wall even when its centre survives', () => {
    const crossing = room({ id: 'new', x: 30, y: 30, w: 40, h: 30 })
    const sofa: Furniture = { id: 'sofa', kind: 'sofa', x: 46, y: 52, rotated: false, wM: 2, dM: .6 }
    const current = plan([living, crossing], { furniture: [sofa] })
    const outcome = trimAt(current, { x: 60, y: 45 })
    expect(outcome.plan.furniture).toEqual([])
    expect(outcome.toast).toContain('1 piece of furniture')
    expect(current.furniture).toEqual([sofa])
    expect(trimOverlaps(current).toast).toContain('1 piece of furniture removed')
  })

  it('preserves furniture fully supported by a surviving surrounding room', () => {
    const host = room({ id: 'host', x: 0, y: 0, w: 80, h: 80 })
    const inner = room({ id: 'inner', x: 30, y: 30, w: 20, h: 20 })
    const sofa: Furniture = { id: 'sofa', kind: 'sofa', x: 33, y: 33, rotated: false, wM: 2, dM: .6 }
    const current = plan([host, inner], { furniture: [sofa] })
    expect(removeRoomFromPlan(current, 'inner').furniture).toEqual([sofa])
    const result = trimOverlaps(current)
    expect(result.plan.furniture).toEqual([sofa])
    expect(result.toast).toContain('Removed contained room: inner')
  })

  it('chooses a usable cut before refusing a smaller sliver', () => {
    const crossing = room({ id: 'new', x: 30, y: 20, w: 20, h: 80 })
    const old = room({ id: 'old', x: 41, y: 0, w: 40, h: 60 })
    const cut = trimCutAgainst(crossing, old, site)
    expect(cut?.outcome).toBe('cut')
    expect(cut?.next).toMatchObject({ x: 30, y: 60, w: 20, h: 40 })
  })
})
