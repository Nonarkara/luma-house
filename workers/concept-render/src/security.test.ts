import { describe, expect, it } from 'vitest'
import worker from './index'

const env = { GEMINI_API_KEY: 'k' } as never
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function post(path: string, origin?: string) {
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

  it('allows localhost for development', async () => {
    const res = await worker.fetch(post('/trace', 'http://localhost:5173'), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('still serves a non-browser client, which the rate limit is there to hold', async () => {
    const res = await worker.fetch(post('/trace'), env)
    expect(res.status).not.toBe(403)
  })

  it('does not hand a wildcard to any origin on a preflight', async () => {
    const res = await worker.fetch(new Request('https://worker.test/trace', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('spending is capped', () => {
  it('refuses when no rate-limit store is bound, rather than spending freely', async () => {
    // No RATE_LIMIT in env. This must not become an unlimited path to the key.
    const res = await worker.fetch(post('/trace'), env)
    expect(res.status).toBe(429)
  })

  it('never leaks the raw upstream body to the caller', async () => {
    const res = await worker.fetch(post('/trace'), env)
    const text = await res.text()
    expect(text).not.toMatch(/"code":\s*\d+/)
  })
})
