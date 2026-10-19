import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanState } from '../types'
import { conceptFailureMessage, generateConceptPhoto } from './generateConcept'

const plan = { rooms: [], openings: [], furniture: [], systems: { solar: false, insulation: false, climate: false, lighting: false } } as PlanState

afterEach(() => vi.unstubAllGlobals())

describe('concept photo errors', () => {
  it('reads the worker error sentence instead of showing raw JSON', () => {
    const raw = '{"error":"AI concept photos are temporarily disabled. Use the local light study or the printable study sheet — both work without the AI service."}'
    expect(conceptFailureMessage(raw, 503)).toBe('AI concept photos are temporarily disabled. Use the local light study or the printable study sheet — both work without the AI service.')
    expect(conceptFailureMessage('{"code":503}', 503)).toMatch(/HTTP 503/)
  })

  it('does not call the network while AI is paused', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(generateConceptPhoto({ plan, locationLabel: 'Bangkok', hour: 12 })).rejects.toThrow(/paused/)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
