import { describe, expect, it, beforeEach } from 'vitest'
import { readString, readJson, writeJson, writeString, key } from './keys'

// A Map-backed Storage for the test environment.
function makeStorage() {
  const map = new Map<string, string>()
  const storage: Storage = {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size
    },
  }
  return { storage, map }
}

let storage: Storage
let map: Map<string, string>

beforeEach(() => {
  const env = makeStorage()
  storage = env.storage
  map = env.map
})

describe('storage keys', () => {
  it('reads from the new key when present', () => {
    writeString('plan', '{"rooms":[]}', storage)
    expect(readString('plan', 'luma-house:plan', storage)).toBe('{"rooms":[]}')
  })

  it('falls back to the legacy key on first read, then writes the new key', () => {
    map.set('luma-house:plan', '{"legacy":true}')
    expect(readString('plan', 'luma-house:plan', storage)).toBe('{"legacy":true}')
    // One-shot migration: the new key now exists too.
    expect(map.get('designon:plan')).toBe('{"legacy":true}')
  })

  it('parses JSON from the new key', () => {
    writeJson('plan', { rooms: [1, 2, 3] }, storage)
    expect(readJson<{ rooms: number[] }>('plan', 'luma-house:plan', storage)).toEqual({ rooms: [1, 2, 3] })
  })

  it('parses JSON from the legacy key when new key absent', () => {
    map.set('luma-house:plan', '{"rooms":[1]}')
    expect(readJson<{ rooms: number[] }>('plan', 'luma-house:plan', storage)).toEqual({ rooms: [1] })
  })

  it('returns null on invalid JSON without throwing', () => {
    map.set('luma-house:plan', '{not json')
    expect(readJson('plan', 'luma-house:plan', storage)).toBeNull()
  })

  it('composes the new key with the right prefix', () => {
    expect(key('plan')).toBe('designon:plan')
  })
})
