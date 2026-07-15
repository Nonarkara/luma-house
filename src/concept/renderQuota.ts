const STORAGE_KEY = 'luma-house:concept-quota'
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { day: todayKey(), count: 0, images: [] }
    const parsed = JSON.parse(raw) as QuotaState
    if (parsed.day !== todayKey()) return { day: todayKey(), count: 0, images: [] }
    return {
      day: parsed.day,
      count: parsed.count ?? 0,
      images: Array.isArray(parsed.images) ? parsed.images.slice(0, 12) : [],
    }
  } catch {
    return { day: todayKey(), count: 0, images: [] }
  }
}

function writeQuota(state: QuotaState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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

export function recordConceptImage(dataUrl: string): number {
  const state = readQuota()
  const next: QuotaState = {
    day: todayKey(),
    count: state.count + 1,
    images: [dataUrl, ...state.images].slice(0, 12),
  }
  writeQuota(next)
  return Math.max(0, DAILY_LIMIT - next.count)
}
