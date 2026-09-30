import { describe, expect, it } from 'vitest'
import { readOrMigrate, readString, writeString, key } from './keys'

/** A Storage that exists and throws on every call, like Safari private browsing. */
function hostileStorage(): Storage {
  const boom = () => { throw new DOMException('The operation is insecure.', 'SecurityError') }
  return {
    get length() { return 0 },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  }
}

/** Storage that works, for the control cases. */
function workingStore(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k) },
    setItem: (k: string, v: string) => { map.set(k, v) },
  }
}

describe('storage that refuses to work', () => {
  it('readString returns the default instead of throwing', () => {
    expect(() => readString('anything', 'legacy', hostileStorage())).not.toThrow()
    expect(readString('anything', 'legacy', hostileStorage())).toBeNull()
  })

  it('readOrMigrate returns null instead of throwing', () => {
    expect(readOrMigrate('k', 'legacy', (raw) => raw, hostileStorage())).toBeNull()
  })

  it('writeString never throws', () => {
    expect(() => writeString('k', 'v', hostileStorage())).not.toThrow()
  })

  it('a read that works but a write that fails still returns the value', () => {
    const halfBroken: Storage = {
      ...workingStore({ 'designon:k': 'saved' }),
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
    }
    expect(readString('k', 'legacy', halfBroken)).toBe('saved')
    expect(() => writeString('k', 'v', halfBroken)).not.toThrow()
  })
})

describe('storage that works', () => {
  it('still round-trips, so the fallback changes nothing when storage is fine', () => {
    const store = workingStore()
    writeString('greeting', 'hello', store)
    expect(readString('greeting', 'legacy', store)).toBe('hello')
  })

  it('still migrates a legacy key', () => {
    const store = workingStore({ 'luma-thing': 'old value' })
    expect(readString('thing', 'luma-thing', store)).toBe('old value')
    expect(store.getItem('designon:thing')).toBe('old value')
    // and the legacy key is left alone for rollback
    expect(store.getItem('luma-thing')).toBe('old value')
  })

  it('prefers the new key over the legacy one', () => {
    const store = workingStore({ 'designon:thing': 'new', 'luma-thing': 'old' })
    expect(readString('thing', 'luma-thing', store)).toBe('new')
  })

  it('composes keys under the designon prefix', () => {
    expect(key('plan')).toBe('designon:plan')
  })
})
