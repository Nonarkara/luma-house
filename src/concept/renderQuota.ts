import { readJson, writeJson } from '../storage/keys'

const STORAGE_KEY = 'concept-quota'
const LEGACY_KEY = 'luma-house:concept-quota'
export const DAILY_LIMIT = 3

interface QuotaState {
  day: string
  count: number
  images: string[]
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function readQuota(): QuotaState {
  const parsed = readJson<QuotaState>(STORAGE_KEY, LEGACY_KEY)
  if (!parsed) return { day: todayKey(), count: 0, images: [] }
  if (parsed.day !== todayKey()) return { day: todayKey(), count: 0, images: [] }
  return {
    day: parsed.day,
    count: parsed.count ?? 0,
    images: Array.isArray(parsed.images) ? parsed.images.slice(0, 12) : [],
  }
}

function writeQuota(state: QuotaState) {
  // Concept images are multi-MB data URLs and browsers cap localStorage near
  // 5 MB. Evict oldest images until the payload fits — storage failure must
  // never swallow a render the user already spent daily quota on. The count
  // always persists so quota accounting stays honest even with zero images.
  let images = state.images
  for (;;) {
    try {
      writeJson(STORAGE_KEY, { ...state, images })
      return
    } catch {
      if (images.length === 0) return
      images = images.slice(0, -1)
    }
  }
}

export function getQuotaRemaining(): number {
  const state = readQuota()
  return Math.max(0, DAILY_LIMIT - state.count)
}

export function getSavedConceptImages(): string[] {
  return readQuota().images
}

export function canGenerateConcept(): boolean {
  return getQuotaRemaining() > 0
}

function recordConceptUse(dataUrl?: string): number {
  const state = readQuota()
  const next: QuotaState = {
    day: todayKey(),
    count: state.count + 1,
    images: dataUrl ? [dataUrl, ...state.images].slice(0, 12) : state.images,
  }
  writeQuota(next)
  return Math.max(0, DAILY_LIMIT - next.count)
}

export function recordAiTrace(): number {
  return recordConceptUse()
}

export function recordConceptImage(dataUrl: string): number {
  return recordConceptUse(dataUrl)
}
