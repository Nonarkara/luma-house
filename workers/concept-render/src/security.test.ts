import { describe, expect, it, vi } from 'vitest'
import worker from './index'

const APP = 'https://designon.nonarkara.org'

const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-2.0-flash', TRACE_MODEL: 'gemini-2.0-flash' } as never
const IMG = 'data:image/png;base64,' + 'AAAA'.repeat(300)

function post(path: string, origin: string | null = APP) {
  return new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ image: IMG, prompt: 'a calm concrete room with warm light and a large window' }),
  })
}

describe('who may call the AI', () => {
  it('refuses a browser on a site that is not ours', async () => {
    const res = await worker.fetch(post('/trace', 'https://evil.example'), env)
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not let that browser read the refusal either', async () => {
    const res = await worker.fetch(post('/trace', 'https://evil.example'), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('allows the shipped frontend', async () => {
    const res = await worker.fetch(post('/trace', 'https://nonarkara.github.io'), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://nonarkara.github.io')
  })

  it('allows the Pages hostname too', async () => {
    const res = await worker.fetch(post('/trace', 'https://luma-house.pages.dev'), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://luma-house.pages.dev')
  })

  it.each(['https://designon.nonarkara.org', 'https://luma.nonarkara.org'])('allows the production custom domain %s', async (origin) => {
    const res = await worker.fetch(new Request('https://worker.test/trace', {
      method: 'OPTIONS', headers: { Origin: origin },
    }), env)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  })

  it('allows localhost for development', async () => {
    const res = await worker.fetch(post('/trace', 'http://localhost:5173'), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('refuses a request with no Origin before any model call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await worker.fetch(post('/trace', null), env)
    expect(res.status).toBe(403)
    const body = await res.json() as { error?: string }
    expect(body.error).toMatch(/Origin/)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('does not hand a wildcard to any origin on a preflight', async () => {
    const res = await worker.fetch(new Request('https://worker.test/trace', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('the request envelope', () => {
  it('has no other routes to probe', async () => {
    const res = await worker.fetch(post('/anything'), env)
    expect(res.status).toBe(404)
  })

  it('rejects a body that is not application/json before touching anything else', async () => {
    const req = new Request('https://worker.test/trace', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: APP }, body: IMG })
    const res = await worker.fetch(req, env)
    expect(res.status).toBe(415)
  })

  it('never caches an AI response', async () => {
    const res = await worker.fetch(post('/trace'), env)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('spending is capped', () => {
  it('refuses when no rate-limit store is bound, rather than spending freely', async () => {
    // No AI_QUOTA in env. This must not become an unlimited path to the key.
    const res = await worker.fetch(post('/trace'), env)
    expect(res.status).toBe(429)
  })

  it('never leaks the raw upstream body to the caller', async () => {
    const res = await worker.fetch(post('/trace'), env)
    const text = await res.text()
    expect(text).not.toMatch(/"code":\s*\d+/)
  })
})

describe('AI disabled at the source', () => {
  // When the model var is empty we want the user to get a fast, clear 503 —
  // not a 60-second wait followed by a 404 from upstream. Local rendering,
  // study sheets and the manual underlay still work.
  const envDisabled = { GEMINI_API_KEY: 'k', TRACE_MODEL: '', GEMINI_MODEL: '' } as never
  it('returns 503 on /trace when TRACE_MODEL is empty', async () => {
    const res = await worker.fetch(post('/trace'), envDisabled)
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(text).toMatch(/AI plan tracing is temporarily disabled/)
  })

  it('returns 503 on / when GEMINI_MODEL is empty', async () => {
    const res = await worker.fetch(post('/'), envDisabled)
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(text).toMatch(/AI concept photos are temporarily disabled/)
  })
})
