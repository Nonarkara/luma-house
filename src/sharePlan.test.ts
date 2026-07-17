import { describe, expect, it } from 'vitest'
import { completeHousePlan } from './mockups/completeHouse'
import { decodePlanFromHash, encodePlanToHash, sanitizePlan } from './sharePlan'

describe('sharePlan', () => {
  it('round-trips a plan through the URL hash without loss', () => {
    const hash = `#plan=${encodePlanToHash(completeHousePlan)}`
    expect(decodePlanFromHash(hash)).toEqual(completeHousePlan)
  })

  it('returns null for hashes without a plan payload', () => {
    expect(decodePlanFromHash('')).toBeNull()
    expect(decodePlanFromHash('#other=abc')).toBeNull()
    expect(decodePlanFromHash('#plan=!!!not-base64!!!')).toBeNull()
  })

  it('returns null for corrupted payloads', () => {
    expect(decodePlanFromHash(`#plan=${btoa('{"rooms": 42}')}`)).toBeNull()
    expect(decodePlanFromHash(`#plan=${btoa('not json at all')}`)).toBeNull()
  })

  it('sanitizes malformed entries while keeping valid ones', () => {
    const plan = sanitizePlan({
      rooms: [
        { id: 'ok', name: 'Good room', kind: 'kitchen', x: 5, y: 5, w: 30, h: 30 },
        { id: 'bad-size', name: 'Zero', kind: 'living', x: 0, y: 0, w: 0, h: 10 },
        { id: 'bad-kind', name: 'Mystery', kind: 'dungeon', x: 1, y: 1, w: 10, h: 10 },
        'garbage',
      ],
      openings: [
        { id: 'w', type: 'window', x: 10, y: 5, rotation: 0 },
        { id: 'nope', type: 'portal', x: 1, y: 1, rotation: 0 },
      ],
      furniture: [{ id: 'f', kind: 'bed', x: 8, y: 8, rotated: true }],
      systems: { solar: true, insulation: false, climate: true },
    })
    expect(plan).not.toBeNull()
    expect(plan!.rooms).toHaveLength(2)
    expect(plan!.rooms[1].kind).toBe('studio') // unknown kind falls back
    expect(plan!.openings).toHaveLength(1)
    expect(plan!.furniture).toHaveLength(1)
    expect(plan!.systems).toEqual({ solar: true, insulation: false, climate: true, lighting: false })
  })

  it('rejects payloads with no usable rooms', () => {
    expect(sanitizePlan({ rooms: [] })).toBeNull()
    expect(sanitizePlan({ rooms: [{ id: 'x' }] })).toBeNull()
    expect(sanitizePlan(null)).toBeNull()
    expect(sanitizePlan('plan')).toBeNull()
  })
})
