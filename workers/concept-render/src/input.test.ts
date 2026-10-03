import { describe, expect, it } from 'vitest'
import { InputError, imageInput, readJson, siteDimension, traceOutput } from './input'

const PNG = 'data:image/png;base64,' + 'QUJD'.repeat(300)

function post(body: string, headers: Record<string, string> = { 'Content-Type': 'application/json' }) {
  return new Request('https://worker.test/trace', { method: 'POST', headers, body })
}

describe('readJson', () => {
  it('requires an application/json content type', async () => {
    await expect(readJson(post('{"a":1}', { 'Content-Type': 'text/plain' }))).rejects.toMatchObject({ status: 415 })
  })

  it('rejects a declared body above the request budget before reading it', async () => {
    const req = post('{}', { 'Content-Type': 'application/json', 'Content-Length': String(13 * 1024 * 1024) })
    await expect(readJson(req)).rejects.toMatchObject({ status: 413 })
  })

  it('rejects a streamed body that grows past the budget despite a small declaration', async () => {
    const huge = JSON.stringify({ image: 'A'.repeat(13 * 1024 * 1024) })
    const req = new Request('https://worker.test/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: huge,
    })
    await expect(readJson(req)).rejects.toMatchObject({ status: 413 })
  })

  it('rejects malformed JSON and non-object payloads', async () => {
    await expect(readJson(post('{bad'))).rejects.toMatchObject({ status: 400 })
    await expect(readJson(post('[1,2]'))).rejects.toMatchObject({ status: 400 })
    await expect(readJson(post('"text"'))).rejects.toMatchObject({ status: 400 })
  })

  it('returns the parsed object', async () => {
    expect(await readJson(post('{"prompt":"draw"}'))).toEqual({ prompt: 'draw' })
  })
})

describe('imageInput', () => {
  it('requires a data URL for a supported raster type', () => {
    expect(() => imageInput('https://example.com/x.png')).toThrow(InputError)
    expect(() => imageInput('data:image/svg+xml;base64,' + 'AAAA'.repeat(300))).toThrow(InputError)
    expect(imageInput(PNG).mimeType).toBe('image/png')
  })

  it('rejects images too small to read and over the byte budget', () => {
    expect(() => imageInput('data:image/png;base64,QUJDRA==')).toThrow(InputError)
    expect(() => imageInput('data:image/png;base64,' + 'AAAA'.repeat(3 * 1024 * 1024))).toThrow(InputError)
  })

  it('rejects invalid base64, including misaligned lengths', () => {
    expect(() => imageInput('data:image/png;base64,' + 'A'.repeat(1201))).toThrow(InputError)
    expect(() => imageInput('data:image/png;base64,' + 'QUJD$$DE'.repeat(150))).toThrow(InputError)
  })
})

describe('siteDimension', () => {
  it('falls back when omitted and rejects nonsense dimensions', () => {
    expect(siteDimension(undefined, 14)).toBe(14)
    expect(siteDimension(20, 14)).toBe(20)
    expect(() => siteDimension(-1, 14)).toThrow(InputError)
    expect(() => siteDimension(NaN, 14)).toThrow(InputError)
    expect(() => siteDimension(10000, 14)).toThrow(InputError)
    expect(() => siteDimension('14', 14)).toThrow(InputError)
  })
})

describe('traceOutput', () => {
  const valid = {
    rooms: [{ id: 'r1', name: 'Living', kind: 'living', x: 0, y: 0, w: 50, h: 50 }],
    openings: [{ id: 'w1', type: 'window', x: 25, y: 0, rotation: 0 }],
  }

  it('accepts a well-formed plan and normalizes furniture and systems', () => {
    const plan = traceOutput({ ...valid, furniture: [{ junk: true }], note: 'leak me?' })
    expect(plan?.rooms).toHaveLength(1)
    expect(plan?.furniture).toEqual([])
    expect(plan?.systems).toEqual({ solar: false, insulation: false, climate: false, lighting: false })
    expect(plan).not.toHaveProperty('note')
  })

  it('rejects unknown room kinds and window/door types it cannot model', () => {
    expect(traceOutput({ ...valid, rooms: [{ ...valid.rooms[0], kind: 'garage' }] })).toBeNull()
    expect(traceOutput({ ...valid, openings: [{ ...valid.openings[0], type: 'skylight' }] })).toBeNull()
  })

  it('rejects non-finite or unbounded coordinates', () => {
    expect(traceOutput({ ...valid, rooms: [{ ...valid.rooms[0], w: Infinity }] })).toBeNull()
    expect(traceOutput({ ...valid, rooms: [{ ...valid.rooms[0], x: 99999 }] })).toBeNull()
  })

  it('rejects collection floods and missing identity', () => {
    const rooms = Array.from({ length: 201 }, (_, i) => ({ ...valid.rooms[0], id: `r${i}` }))
    expect(traceOutput({ ...valid, rooms })).toBeNull()
    expect(traceOutput({ ...valid, rooms: [{ ...valid.rooms[0], id: '' }] })).toBeNull()
  })
})
