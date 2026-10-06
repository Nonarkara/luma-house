import { sanitizeLocation } from '../location/locations'
import { ROOF_STYLES } from '../canvas/roofStyles'
import type { StudyCamera, StudyScene, StudySettings } from './types'
export const MAX_STUDY_SCENES = 6
const finite = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const tuple = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(n => finite(n, -10000, 10000))
function camera(raw: unknown): StudyCamera | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!['perspective', 'orthographic'].includes(String(r.projection)) || !tuple(r.position) || !tuple(r.target) || !tuple(r.up) || !finite(r.zoom, 0.01, 100) || !finite(r.fov, 10, 120) || !finite(r.fieldHeight, 0.1, 10000)) return null
  if (Math.hypot(...r.up) < 0.01 || Math.hypot(...r.position.map((v, i) => v - (r.target as number[])[i])) < 0.01) return null
  return { projection: r.projection as StudyCamera['projection'], position: r.position, target: r.target, up: r.up, zoom: r.zoom, fov: r.fov, fieldHeight: r.fieldHeight }
}
export function sanitizeStudyScenes(raw: unknown): StudyScene[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const result: StudyScene[] = []
  for (const item of raw.slice(0, MAX_STUDY_SCENES)) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>, c = camera(r.camera), location = sanitizeLocation(r.location)
    const s = r.settings as Partial<StudySettings> | undefined
    if (!c || !location || !s || !['orbit', 'axonometric', 'topdown'].includes(String(s.preset)) || !['architectural', 'wireframe', 'solid'].includes(String(s.style)) || !ROOF_STYLES.includes(s.roofStyle!) || !finite(s.sectionHeight, 0.5, 6)) continue
    if (!finite(r.day, 1, 366) || !Number.isInteger(r.day) || !finite(r.hour, 0, 24) || !finite(r.year, 2000, 2100) || !Number.isInteger(r.year)) continue
    const daysInYear = (Date.UTC(r.year + 1, 0, 1) - Date.UTC(r.year, 0, 1)) / 86400000
    if (r.day > daysInYear) continue
    if (typeof r.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(r.id) || result.some(v => v.id === r.id) || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 64 || typeof r.geometryKey !== 'string' || r.geometryKey.length > 64 || typeof r.capturedAt !== 'string' || r.capturedAt.length > 32 || !Number.isFinite(Date.parse(r.capturedAt))) continue
    result.push({ id: r.id, name: r.name.trim(), geometryKey: r.geometryKey, capturedAt: r.capturedAt, location, day: r.day, hour: r.hour, year: r.year, camera: c, settings: { preset: s.preset!, style: s.style!, sectionHeight: s.sectionHeight!, roofStyle: s.roofStyle!, showRoof: s.showRoof === true, shadows: s.shadows === true, sunRays: s.sunRays === true, airPaths: s.airPaths === true } })
  }
  return result.length ? result : undefined
}
const PREVIEW_KEY = 'designon:study-previews'
type Previews = Record<string, string>
const validImage = (v: unknown): v is string => typeof v === 'string' && v.length < 180000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v)
export function readPreviews(): Previews {
  try {
    const raw = JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).slice(-12).filter(([key, value]) => /^[a-zA-Z0-9-]{1,64}$/.test(key) && validImage(value))) as Previews
  } catch { return {} }
}
export function savePreview(id: string, image: string): boolean {
  if (!validImage(image)) return false
  try {
    const previews = readPreviews()
    delete previews[id]
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(Object.fromEntries([...Object.entries(previews), [id, image]].slice(-12))))
    return true
  } catch { return false }
}
