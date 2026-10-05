import type { ProjectLocation } from '../types'

export const starterLocations: ProjectLocation[] = [
  { name: 'Shanghai', label: 'Shanghai, China', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai' },
  { name: 'Bangkok', label: 'Bangkok, Thailand', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' },
  { name: 'Chiang Mai', label: 'Chiang Mai, Thailand', latitude: 18.7883, longitude: 98.9853, timezone: 'Asia/Bangkok' },
  { name: 'Phuket', label: 'Phuket, Thailand', latitude: 7.8804, longitude: 98.3923, timezone: 'Asia/Bangkok' },
  { name: 'Singapore', label: 'Singapore', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
  { name: 'Quito', label: 'Quito, Ecuador', latitude: -0.1807, longitude: -78.4678, timezone: 'America/Guayaquil' },
  { name: 'Anchorage', label: 'Anchorage, Alaska, US', latitude: 61.2181, longitude: -149.9003, timezone: 'America/Anchorage' },
]

export function sanitizeLocation(raw: unknown): ProjectLocation | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Record<string, unknown>
  if (typeof c.latitude !== 'number' || !Number.isFinite(c.latitude) || Math.abs(c.latitude) > 90 ||
      typeof c.longitude !== 'number' || !Number.isFinite(c.longitude) || Math.abs(c.longitude) > 180) return undefined
  if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 160 ||
      typeof c.label !== 'string' || !c.label.trim() || c.label.length > 256 ||
      typeof c.timezone !== 'string' || c.timezone.length > 80) return undefined
  try { new Intl.DateTimeFormat('en', { timeZone: c.timezone }).format(0) } catch { return undefined }
  return { name: c.name, label: c.label, latitude: c.latitude, longitude: c.longitude, timezone: c.timezone }
}

const cache = new Map<string, ProjectLocation[]>()
export async function searchCities(query: string, signal?: AbortSignal): Promise<ProjectLocation[]> {
  const term = query.trim().slice(0, 100)
  if (term.length < 2) return []
  const key = term.toLocaleLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({ name: term, count: '8', language: 'en', format: 'json' }).toString()
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('City search is unavailable. Try again or enter coordinates below.')
  const body: unknown = await response.json()
  const rows = body && typeof body === 'object' && 'results' in body ? (body as { results: unknown }).results : []
  const results = (Array.isArray(rows) ? rows.slice(0, 8) : []).flatMap(row => {
    if (!row || typeof row !== 'object') return []
    const c = row as Record<string, unknown>
    const label = [c.name, c.admin1, c.country].filter(v => typeof v === 'string' && v.length > 0).join(', ')
    const location = sanitizeLocation({ ...c, label })
    return location ? [location] : []
  })
  if (cache.size >= 20) cache.delete(cache.keys().next().value!)
  cache.set(key, results)
  return results
}
