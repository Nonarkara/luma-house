import { describe, expect, it } from 'vitest'
import { evaluateJourney } from './evaluateJourney'
import { STAGES, stageFromVisit, type JourneyContext } from './stages'
import type { PlanState } from '../types'

function ctx(partial: Partial<JourneyContext> & { plan: PlanState }): JourneyContext {
  return {
    areaM2: 50,
    hasConcept: false,
    visited: new Set(),
    mode: 'plan',
    view: 'plan',
    ...partial,
  }
}

const emptyPlan: PlanState = {
  rooms: [],
  openings: [],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}

const sketched: PlanState = {
  rooms: [{ id: 'r1', name: 'Room', kind: 'living', x: 10, y: 10, w: 40, h: 40 }],
  openings: [],
  furniture: [],
  systems: { solar: false, insulation: false, climate: false, lighting: false },
}

describe('journey stages', () => {
  it('maps mode/view visits onto stage ids', () => {
    expect(stageFromVisit('plan', 'plan')).toBe('draw')
    expect(stageFromVisit('plan', 'spatial')).toBe('model')
    expect(stageFromVisit('light', 'spatial')).toBe('sun')
    expect(stageFromVisit('wellbeing', 'plan')).toBe('living')
    expect(stageFromVisit('budget', 'plan')).toBe('cost')
    expect(stageFromVisit('plan', 'renders')).toBe('picture')
  })

  it('starts newcomers on draw with endowment coach copy', () => {
    const result = evaluateJourney(ctx({ plan: emptyPlan }))
    expect(result.nextId).toBe('draw')
    expect(result.doneCount).toBe(0)
    expect(result.coach.cta.toLowerCase()).toContain('draw')
    expect(result.stages[0].status).toBe('current')
  })

  it('advances next recommendation after the first room exists', () => {
    const result = evaluateJourney(
      ctx({ plan: sketched, visited: new Set(['draw']) }),
    )
    expect(result.stages.find((s) => s.def.id === 'draw')?.complete).toBe(true)
    expect(result.nextId).toBe('model')
    expect(result.coach.nav.view).toBe('spatial')
  })

  it('requires a window before sun stage is complete', () => {
    const withWindow: PlanState = {
      ...sketched,
      openings: [{ id: 'w1', type: 'window', x: 30, y: 10, rotation: 0 }],
    }
    const incomplete = evaluateJourney(
      ctx({ plan: sketched, mode: 'light', view: 'spatial', visited: new Set(['draw', 'model', 'sun']) }),
    )
    expect(incomplete.stages.find((s) => s.def.id === 'sun')?.complete).toBe(false)

    const complete = evaluateJourney(
      ctx({
        plan: withWindow,
        mode: 'light',
        view: 'spatial',
        visited: new Set(['draw', 'model', 'sun']),
      }),
    )
    expect(complete.stages.find((s) => s.def.id === 'sun')?.complete).toBe(true)
  })

  it('never marks any stage complete over an empty plan, even when all are visited', () => {
    // The single progress-truth invariant: rail checkmarks can never claim
    // progress the canvas has not earned. Visit every stage AND fake a concept —
    // an empty plan must still show zero completions.
    const result = evaluateJourney(
      ctx({
        plan: emptyPlan,
        hasConcept: true,
        visited: new Set(['draw', 'model', 'sun', 'living', 'systems', 'cost', 'picture']),
      }),
    )
    expect(result.doneCount).toBe(0)
    expect(result.stages.every((s) => !s.complete)).toBe(true)
    expect(result.nextId).toBe('draw')
  })

  it('keeps seven stages in the decision sequence', () => {
    expect(STAGES).toHaveLength(7)
    expect(STAGES.map((s) => s.id)).toEqual([
      'draw',
      'model',
      'sun',
      'living',
      'systems',
      'cost',
      'picture',
    ])
  })
})
