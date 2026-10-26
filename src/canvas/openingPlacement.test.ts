import { describe, expect, it } from 'vitest'
import { placeOpeningOnWall } from './openingPlacement'
import type { Opening, Room } from '../types'

const room: Room = { id: 'r', name: 'Room', kind: 'living', x: 20, y: 20, w: 40, h: 30 }
const site = { w: 10, h: 8, unit: 1 }
const opening: Opening = { id: 'w', type: 'window', x: 40, y: 20, rotation: 0 }
const stage = { width: 400, height: 320 }

describe('full-width opening placement', () => {
  it('hosts on the nearest wall in screen pixels', () => {
    expect(placeOpeningOnWall({ ...opening, x: 21, y: 35 }, [room], site, stage)).toMatchObject({ x: 20, y: 35, rotation: 90 })
    expect(placeOpeningOnWall({ ...opening, y: 22 }, [room], site, stage)).toMatchObject({ x: 40, y: 20, rotation: 0 })
  })
  it('keeps the complete width on the wall at both ends', () => {
    expect(placeOpeningOnWall({ ...opening, x: 20.2 }, [room], site, stage)).toMatchObject({ x: 28, y: 20 })
    expect(placeOpeningOnWall({ ...opening, x: 59.8 }, [room], site, stage)).toMatchObject({ x: 52, y: 20 })
    expect(placeOpeningOnWall({ ...opening, x: 20, y: 20.2 }, [room], site, stage)).toMatchObject({ x: 20, y: 30, rotation: 90 })
  })
  it('refuses empty floor, empty plans and walls too short for the actual width', () => {
    expect(placeOpeningOnWall({ ...opening, y: 35 }, [room], site, stage)).toBeNull()
    expect(placeOpeningOnWall(opening, [], site, stage)).toBeNull()
    expect(placeOpeningOnWall(opening, [{ ...room, w: 10, h: 10 }], site, stage)).toBeNull()
    expect(placeOpeningOnWall({ ...opening, widthM: 20 }, [room], site, stage)).toBeNull()
  })
  it('uses a consistent pixel reach after zoom and non-square resize', () => {
    expect(placeOpeningOnWall({ ...opening, y: 27 }, [room], site, { width: 900, height: 300 })).toMatchObject({ y: 20 })
    expect(placeOpeningOnWall({ ...opening, y: 27 }, [room], site, { width: 900, height: 600 })).toBeNull()
  })
  it('preserves explicit physical dimensions and does not mutate inputs', () => {
    const custom = { ...opening, x: 20, widthM: 2, heightM: 1.4, sillHeightM: 1 }
    expect(placeOpeningOnWall(custom, [room], site, stage)).toEqual({ ...custom, x: 30 })
    expect(custom.x).toBe(20)
  })
  it('refuses invalid coordinates, dimensions and unavailable drawing geometry', () => {
    expect(placeOpeningOnWall({ ...opening, x: NaN }, [room], site, stage)).toBeNull()
    expect(placeOpeningOnWall({ ...opening, widthM: -1 }, [room], site, stage)).toBeNull()
    expect(placeOpeningOnWall(opening, [room], site, { ...stage, width: 0 })).toBeNull()
  })
})
