import { describe, expect, it } from 'vitest'
import { initialPlan } from '../plan'
import { buildRenderPrompt } from './buildRenderPrompt'

describe('buildRenderPrompt', () => {
  it('includes location, rooms, and concept disclaimer language', () => {
    const prompt = buildRenderPrompt({
      plan: initialPlan,
      locationLabel: 'Bangkok, TH',
      hour: 15,
    })
    expect(prompt).toContain('Bangkok')
    expect(prompt).toContain('Living + dining')
    expect(prompt).toContain('concept visualization')
    expect(prompt).toContain('No text, logos')
  })
})
