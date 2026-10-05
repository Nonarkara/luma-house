import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchCities } from './locations'
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
    expect(await searchCities('Tromsø')).toEqual(results)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('reports a failed search rather than inventing a city', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    await expect(searchCities('unreachable-test')).rejects.toThrow('unavailable')
  })
})
