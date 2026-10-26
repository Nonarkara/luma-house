import { describe, expect, it } from 'vitest'
import { releaseDecision, stampFromHtml, stampMatches } from './release-gate.mjs'

const sha = '6b9b2719c1de0f0a8f0a2b3c4d5e6f708192a3b4'
const ready = { dirty: false, pushed: true, ciStatus: 'success', sha, builtSha: sha }

describe('the release gate', () => {
  it('lets a clean, pushed, green commit through', () => {
    const decision = releaseDecision(ready)
    expect(decision.ok).toBe(true)
    expect(decision.blockers).toEqual([])
  })

  it('refuses a dirty tree', () => {
    const decision = releaseDecision({ ...ready, dirty: true })
    expect(decision.ok).toBe(false)
    expect(decision.blockers.join(' ')).toContain('uncommitted')
  })

  it('refuses a commit that is not on the remote', () => {
    // The CI run that passed was for a different commit, so the gate says
    // nothing about this one.
    const decision = releaseDecision({ ...ready, pushed: false })
    expect(decision.ok).toBe(false)
    expect(decision.blockers.join(' ')).toContain('not on the remote')
  })

  it('refuses a failed, cancelled, unfinished or missing CI run', () => {
    for (const status of ['failure', 'cancelled', 'in_progress', 'queued', null]) {
      const decision = releaseDecision({ ...ready, ciStatus: status })
      expect(decision.ok, `a ${status} run must not open the gate`).toBe(false)
      expect(decision.blockers.length).toBeGreaterThan(0)
    }
  })

  it('names every blocker at once, so one run tells the whole story', () => {
    const decision = releaseDecision({ ...ready, dirty: true, pushed: false, ciStatus: 'failure' })
    expect(decision.blockers).toHaveLength(3)
  })

  it.each([null, undefined, '', sha.slice(0, 7), sha.slice(0, 39) + '5'])('refuses a missing, shortened or stale build stamp (%s)', (builtSha) => {
    const decision = releaseDecision({ ...ready, builtSha })
    expect(decision.ok).toBe(false)
    expect(decision.blockers.join(' ')).toContain('dist/index.html')
  })
})

describe('the commit stamp', () => {
  const html = (sha) => `<!doctype html><html><head><meta name="designon-build" content="${sha}" /></head><body></body></html>`

  it('reads the commit out of a served page', () => {
    expect(stampFromHtml(html('6b9b2719c1de0f0a8f0a2b3c4d5e6f708192a3b4'))).toBe('6b9b2719c1de0f0a8f0a2b3c4d5e6f708192a3b4')
  })

  it('finds no stamp in a page that carries none', () => {
    expect(stampFromHtml('<!doctype html><html><head></head></html>')).toBeNull()
    expect(stampFromHtml('')).toBeNull()
    expect(stampFromHtml(undefined)).toBeNull()
  })

  it('accepts the same commit, in full or in short form', () => {
    const sha = '6b9b2719c1de0f0a8f0a2b3c4d5e6f708192a3b4'
    expect(stampMatches(html(sha), sha)).toBe(true)
    expect(stampMatches(html(sha), sha.slice(0, 7))).toBe(true)
  })

  it('refuses a page serving a different commit', () => {
    const served = '63f0661055a9b62de680541d3824179d0754873a'
    const deployed = '6b9b2719c1de0f0a8f0a2b3c4d5e6f708192a3b4'
    expect(stampMatches(html(served), deployed)).toBe(false)
    expect(stampMatches('<html></html>', deployed)).toBe(false)
  })
})
