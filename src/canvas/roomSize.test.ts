import { describe, expect, it } from 'vitest'
import {
  MIN_STATED_M,
  formatMetres,
  parseLengthMetres,
  roomDepthM,
  roomWidthM,
  setRoomSizeM,
  sizeRefusalMessage,
} from './roomSize'
import type { Room, SiteSpec } from '../types'

const site: SiteSpec = { w: 14, h: 10, unit: 1 }
const room: Room = { id: 'r1', name: 'Bedroom', kind: 'bedroom', x: 20, y: 30, w: 30, h: 20 }

describe('parseLengthMetres', () => {
  it('reads a plain number as metres', () => {
    expect(parseLengthMetres('4.9')).toBeCloseTo(4.9, 6)
    expect(parseLengthMetres(' 4.90 ')).toBeCloseTo(4.9, 6)
    expect(parseLengthMetres('0')).toBe(0)
  })

  it('reads the units a person writes', () => {
    expect(parseLengthMetres('4.9m')).toBeCloseTo(4.9, 6)
    expect(parseLengthMetres('490cm')).toBeCloseTo(4.9, 6)
    expect(parseLengthMetres('4900mm')).toBeCloseTo(4.9, 6)
    expect(parseLengthMetres('12in')).toBeCloseTo(0.3048, 6)
    expect(parseLengthMetres('12"')).toBeCloseTo(0.3048, 6)
    expect(parseLengthMetres('4\' 6"')).toBeCloseTo(1.3716, 6)
    expect(parseLengthMetres('4\'6"')).toBeCloseTo(1.3716, 6)
    expect(parseLengthMetres('5\'')).toBeCloseTo(1.524, 6)
  })

  it('refuses anything that is not a length', () => {
    expect(parseLengthMetres('')).toBeNull()
    expect(parseLengthMetres('   ')).toBeNull()
    expect(parseLengthMetres('wide')).toBeNull()
    expect(parseLengthMetres('4.9.2')).toBeNull()
    expect(parseLengthMetres('4 9')).toBeNull()
    expect(parseLengthMetres('m')).toBeNull()
  })
})

describe('room size in metres', () => {
  it('reads the room size off the sheet and the field', () => {
    expect(roomWidthM(room, site)).toBeCloseTo(4.2, 6)
    expect(roomDepthM(room, site)).toBeCloseTo(2, 6)
  })
})

describe('stating a real length', () => {
  it('moves the far edge and keeps the edge it was drawn from', () => {
    const out = setRoomSizeM(room, site, 'w', 4.9)
    expect(out.changed).toBe(true)
    expect(out.room.x).toBe(room.x)
    expect(roomWidthM(out.room, site)).toBeCloseTo(4.9, 6)
    // The far edge moved; the near edge did not.
    expect(out.room.x + out.room.w).toBeGreaterThan(room.x + room.w)
  })

  it('keeps the top edge when a depth is stated', () => {
    const out = setRoomSizeM(room, site, 'h', 3.25)
    expect(out.changed).toBe(true)
    expect(out.room.y).toBe(room.y)
    expect(roomDepthM(out.room, site)).toBeCloseTo(3.25, 6)
  })

  it('states the length exactly, without rounding it to the grid', () => {
    const out = setRoomSizeM(room, site, 'w', 4.95)
    expect(roomWidthM(out.room, site)).toBeCloseTo(4.95, 9)
    const back = setRoomSizeM(out.room, site, 'w', 4.95)
    expect(back.room.w).toBeCloseTo(out.room.w, 9)
  })

  it('refuses a length that is not a number and changes nothing', () => {
    const out = setRoomSizeM(room, site, 'w', Number.NaN)
    expect(out.changed).toBe(false)
    expect(out.refusal).toBe('not-a-number')
    expect(out.room).toBe(room)
  })

  it('refuses a length below the smallest a room may be', () => {
    const out = setRoomSizeM(room, site, 'w', MIN_STATED_M / 2)
    expect(out.changed).toBe(false)
    expect(out.refusal).toBe('too-small')
    expect(out.room).toBe(room)
  })

  it('refuses a length longer than the field and changes nothing', () => {
    const out = setRoomSizeM(room, site, 'w', site.w + 1)
    expect(out.changed).toBe(false)
    expect(out.refusal).toBe('too-large')
    expect(out.room).toBe(room)
  })

  it('refuses a length that will not fit from where the room is drawn', () => {
    const drawn = { ...room, x: 80 }
    const out = setRoomSizeM(drawn, site, 'w', 5)
    expect(out.changed).toBe(false)
    expect(out.refusal).toBe('will-not-fit')
    expect(out.room).toBe(drawn)
  })

  it('states a depth that fits even when the width would not', () => {
    const out = setRoomSizeM({ ...room, x: 80 }, site, 'h', 2)
    expect(out.changed).toBe(true)
    expect(roomDepthM(out.room, site)).toBeCloseTo(2, 6)
  })
})

describe('the refusal is explained', () => {
  it('names the field and the way out', () => {
    expect(sizeRefusalMessage('will-not-fit', 'w', site)).toContain('move the room first')
    expect(sizeRefusalMessage('too-large', 'w', site)).toContain('14.0 m')
    expect(sizeRefusalMessage('not-a-number', 'w', site)).toContain('490cm')
  })
})

describe('formatting', () => {
  it('writes a length with two decimals', () => {
    expect(formatMetres(4.9)).toBe('4.90')
    expect(formatMetres(4)).toBe('4.00')
  })
})

import { clearInvalidStatements, isStatedSize, recalibratePlan } from './roomSize'
import { initialPlan } from '../plan'
import { decodePlanFromHash, encodePlanToHash, sanitizePlan } from '../sharePlan'

describe('measurement provenance and recalibration', () => {
  const stated = setRoomSizeM(room, site, 'w', 4.1234).room
  const plan = { ...initialPlan, site, rooms: [stated] }
  it('retains stated metres while the unmeasured axis follows scale', () => {
    const result = recalibratePlan(plan, site, { ...site, w: 20, h: 15 })!
    expect(roomWidthM(result.rooms[0], result.site!)).toBeCloseTo(4.1234, 9)
    expect(roomDepthM(result.rooms[0], result.site!)).toBeCloseTo(3, 9)
    expect(isStatedSize(result.rooms[0], result.site!, 'w')).toBe(true)
    expect(isStatedSize(result.rooms[0], result.site!, 'h')).toBe(false)
  })
  it('refuses the whole calibration without modifying the old plan', () => {
    const before = JSON.stringify(plan)
    expect(recalibratePlan(plan, site, { ...site, w: 4 })).toBeNull()
    expect(JSON.stringify(plan)).toBe(before)
  })
  it('does not resurrect a statement after a resize and coincident scale', () => {
    const resized = { ...plan, rooms: [{ ...stated, w: 20 }] }
    expect(clearInvalidStatements(resized, site).rooms[0].statedSize).toBeUndefined()
    const result = recalibratePlan(resized, site, { ...site, w: 4.1234 / .2 })!
    expect(isStatedSize(result.rooms[0], result.site!, 'w')).toBe(false)
  })
  it('preserves provenance through save, import and sharing', () => {
    expect(sanitizePlan(JSON.parse(JSON.stringify(plan)))!.rooms[0].statedSize?.w).toBe(4.1234)
    expect(decodePlanFromHash('#plan=' + encodePlanToHash(plan))!.rooms[0].statedSize?.w).toBe(4.1234)
    expect(isStatedSize(room, site, 'w')).toBe(false)
  })
  it('rejects invalid imported provenance', () => {
    expect(sanitizePlan({ ...plan, rooms: [{ ...room, statedSize: { w: '4', h: -1 } }] })!.rooms[0].statedSize).toBeUndefined()
  })
})

it('keeps both axes and ignores a stale statement independently', () => {
  const sized = setRoomSizeM(setRoomSizeM(room, site, 'w', 4).room, site, 'h', 3).room
  const resized = { ...sized, w: 20 }
  const plan = { ...initialPlan, site, rooms: [resized] }
  const result = recalibratePlan(plan, site, { ...site, w: 20, h: 20 })!
  expect(result.rooms[0].statedSize?.w).toBeUndefined()
  expect(roomDepthM(result.rooms[0], result.site!)).toBe(3)
})
