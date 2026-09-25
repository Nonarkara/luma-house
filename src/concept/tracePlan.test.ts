import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { tracePlanFromImage } from './tracePlan'
import { getQuotaRemaining } from './renderQuota'
import { calibrateTrace, traceIssues, traceSiteFromImage } from './reviewTrace'
import { synthesizeLayout } from './layoutSynthesizer'

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
})
afterEach(() => vi.unstubAllGlobals())

describe('trace boundary', () => {
  it('always returns an unconfirmed draft and preserves the requested coordinate field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan: synthesizeLayout(), draft: false })))
    const result = await tracePlanFromImage({ imageDataUrl: 'data:image/png;base64,test', siteW: 20, siteH: 15 })
    expect(result.draft).toBe(true)
    expect(result.plan.site).toEqual({ w: 20, h: 15, unit: 1 })
    expect(getQuotaRemaining()).toBe(2)
  })
  it('rejects empty traces and does not charge the successful-use quota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan: { rooms: [] } })))
    await expect(tracePlanFromImage({ imageDataUrl: 'test' })).rejects.toThrow('usable plan')
    expect(getQuotaRemaining()).toBe(3)
  })
  it('rejects canceled responses even if the transport completes late', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      controller.abort()
      return Response.json({ plan: synthesizeLayout() })
    }))
    await expect(tracePlanFromImage({ imageDataUrl: 'test', signal: controller.signal })).rejects.toThrow()
    expect(getQuotaRemaining()).toBe(3)
  })
  it('surfaces provider failures without returning a replacement plan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Trace service unavailable', { status: 503 })))
    await expect(tracePlanFromImage({ imageDataUrl: 'test' })).rejects.toThrow('Trace service unavailable')
  })
  it('calibrates a square source as square regardless of previous project dimensions', () => {
    const plan = { ...synthesizeLayout(), site: traceSiteFromImage(1000, 1000), rooms: [{ id: 'square', name: 'Square', kind: 'living' as const, x: 0, y: 0, w: 50, h: 50 }] }
    const calibrated = calibrateTrace(plan, 'square', 'w', 5)!
    expect(calibrated.site!.w * 0.5).toBe(5)
    expect(calibrated.site!.h * 0.5).toBe(5)
  })
  it('calibrates uniformly and reports detached openings', () => {
    const plan = synthesizeLayout()
    const calibrated = calibrateTrace(plan, plan.rooms[0].id, 'w', 8)!
    expect(calibrated.site!.w * calibrated.rooms[0].w / 100).toBeCloseTo(8)
    expect(calibrated.site!.w / calibrated.site!.h).toBeCloseTo(plan.site!.w / plan.site!.h)
    expect(calibrateTrace(plan, plan.rooms[0].id, 'w', 0)).toBeNull()
    expect(calibrateTrace(plan, plan.rooms[0].id, 'w', 1000)).toBeNull()
    expect(traceIssues({ ...plan, openings: [{ id: 'lost', type: 'window', rotation: 0, x: 1, y: 1 }] }).join(' ')).toContain('do not fit a wall')
  })
})
