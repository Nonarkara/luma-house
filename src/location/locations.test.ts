import { afterEach, describe, expect, it, vi } from 'vitest'
import { geocodingLanguage, searchCities } from './locations'
afterEach(() => vi.unstubAllGlobals())
describe('worldwide city search boundary', () => {
  it('encodes multilingual search, validates matches and caches a repeated query', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [
      { name: 'Tromsø', latitude: 69.65, longitude: 18.96, timezone: 'Europe/Oslo', country: 'Norway' },
      { name: 'Invalid', latitude: 999, longitude: 0, timezone: 'UTC' },
    ] })))
    vi.stubGlobal('fetch', fetcher)
    const results = await searchCities('Tromsø')
    expect(results).toHaveLength(1)
    expect(results[0].label).toBe('Tromsø, Norway')
    expect(String(fetcher.mock.calls[0][0])).toContain('name=Troms%C3%B8')
    expect(String(fetcher.mock.calls[0][0])).toContain('language=en')
    expect(await searchCities('Tromsø')).toEqual(results)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('asks in Thai or Chinese when the query is written in that script', async () => {
    expect(geocodingLanguage('กรุงเทพ')).toBe('th')
    expect(geocodingLanguage('北京')).toBe('zh')
    expect(geocodingLanguage('Bangkok')).toBe('en')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const hit = url.includes('language=th') || url.includes('language=zh')
      const body = hit
        ? { results: [{ name: url.includes('language=th') ? 'กรุงเทพมหานคร' : '北京', latitude: url.includes('language=th') ? 13.75 : 39.9, longitude: url.includes('language=th') ? 100.5 : 116.4, timezone: url.includes('language=th') ? 'Asia/Bangkok' : 'Asia/Shanghai', country: 'X' }] }
        : { results: [] }
      return new Response(JSON.stringify(body))
    })
    vi.stubGlobal('fetch', fetcher)
    const thai = await searchCities('กรุงเทพ')
    expect(thai[0]?.timezone).toBe('Asia/Bangkok')
    expect(fetcher.mock.calls.map((call) => String(call[0])).some((url) => url.includes('language=th'))).toBe(true)
    const chinese = await searchCities('北京')
    expect(chinese[0]?.timezone).toBe('Asia/Shanghai')
    expect(fetcher.mock.calls.map((call) => String(call[0])).some((url) => url.includes('language=zh'))).toBe(true)
  })

  it('reports a failed search rather than inventing a city', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    await expect(searchCities('unreachable-test')).rejects.toThrow('unavailable')
  })
})
