import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

const IMG = 'data:image/png;base64,' + 'AAAA'.repeat(300)

const quotaEnv = {
  GEMINI_API_KEY: 'k',
  AI_QUOTA: {
    idFromName: () => 'id',
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  },
} as never

function traceRequest() {
  return new Request('https://worker.test/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: IMG }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('upstream failures are named, logged and never raw', () => {
  it('maps a 503 from the model host to the busy message and logs only the status', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 })))

    const res = await worker.fetch(traceRequest(), quotaEnv)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: expect.stringContaining('busy right now') })
    expect(spy).toHaveBeenCalledWith('AI upstream error', 503)
    expect(JSON.stringify(spy.mock.calls)).not.toContain('UNAVAILABLE')
  })

  it('maps a quota rejection to the account-capacity message and logs only the status', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('RESOURCE_EXHAUSTED: Quota exceeded', { status: 429 })))

    const res = await worker.fetch(traceRequest(), quotaEnv)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: expect.stringContaining('too many requests from this account') })
    expect(spy).toHaveBeenCalledWith('AI upstream error', 429)
    expect(JSON.stringify(spy.mock.calls)).not.toContain('RESOURCE_EXHAUSTED')
  })

  it('a successful upstream call is not treated as an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ rooms: [], openings: [] }) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const res = await worker.fetch(traceRequest(), quotaEnv)
    expect(res.status).toBe(200)
    const body = await res.json() as { draft?: boolean; plan?: { rooms?: unknown[] } | null }
    expect(body.draft).toBe(true)
    expect(Array.isArray(body.plan?.rooms)).toBe(true)
  })
})
