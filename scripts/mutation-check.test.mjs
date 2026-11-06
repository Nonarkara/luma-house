import { describe, expect, it } from 'vitest'
import { classifyMutationRun, summarizeMutations } from './mutation-check.mjs'

const killed = { verdict: 'KILLED — the gate caught it' }

describe('mutation proof counts only executed gate failures', () => {
  it('accepts actual killed mutations', () => {
    expect(summarizeMutations([killed, killed])).toEqual({ killed: 2, survivors: 0, invalid: 0, ok: true })
  })
  for (const verdict of ['NOT APPLIED — anchor missing', 'the mutant did not build', 'INFRASTRUCTURE — browser unavailable', 'unknown outcome']) {
    it(`refuses ${verdict}`, () => {
      expect(summarizeMutations([killed, { verdict }])).toEqual({ killed: 1, survivors: 0, invalid: 1, ok: false })
    })
  }
  it('reports survivors separately', () => {
    expect(summarizeMutations([killed, { verdict: 'SURVIVED — the rule is not owned' }])).toEqual({ killed: 1, survivors: 1, invalid: 0, ok: false })
  })
  it('refuses an empty run', () => { expect(summarizeMutations([]).ok).toBe(false) })
  it('refuses an unsuccessful restored build', () => { expect(summarizeMutations([killed], false).ok).toBe(false) })
})

describe('mutation browser evidence', () => {
  const report = (results, errors = []) => JSON.stringify({ errors, suites: [{ specs: [{ tests: [{ results }] }] }] })
  it('counts an actual failed gate', () => {
    expect(classifyMutationRun(report([{ status: 'failed', errors: [{ message: 'expect(room).toHaveCount(0)' }] }]))).toEqual({ failed: true, infrastructure: false })
  })
  it('identifies a survivor from executed passing tests', () => {
    expect(classifyMutationRun(report([{ status: 'passed' }]))).toEqual({ failed: false, infrastructure: false })
  })
  it('refuses no tests and all skipped tests', () => {
    expect(classifyMutationRun(JSON.stringify({ errors: [{ message: 'No tests found' }], suites: [] })).infrastructure).toBe(true)
    expect(classifyMutationRun(report([{ status: 'skipped' }])).infrastructure).toBe(true)
  })
  it('refuses a browser launch failure inside a test result', () => {
    expect(classifyMutationRun(report([{ status: 'failed', errors: [{ message: 'browserType.launch: missing executable' }] }])).infrastructure).toBe(true)
  })
  it('refuses global/import errors even if a test also failed', () => {
    expect(classifyMutationRun(report([{ status: 'failed' }], [{ message: 'Cannot find module' }])).infrastructure).toBe(true)
  })
  it('refuses a command failure without a browser report', () => {
    expect(classifyMutationRun('', 'command not found').infrastructure).toBe(true)
  })
})
