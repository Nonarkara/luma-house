import { beforeEach, describe, expect, it } from 'vitest'
import { getQuotaRemaining, getSavedConceptImages, recordAiTrace, recordConceptImage } from './renderQuota'

const values = new Map<string, string>()

beforeEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
})

describe('shared daily AI quota', () => {
  it('counts a trace without pretending it created a saved image', () => {
    expect(recordAiTrace()).toBe(2)
    expect(getQuotaRemaining()).toBe(2)
    expect(getSavedConceptImages()).toEqual([])
  })

  it('counts and stores a completed concept image', () => {
    expect(recordConceptImage('data:image/png;base64,abc')).toBe(2)
    expect(getSavedConceptImages()).toEqual(['data:image/png;base64,abc'])
  })
})
