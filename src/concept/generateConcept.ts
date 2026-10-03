import type { PlanState } from '../types'
import { buildRenderPrompt, buildRenderSummary } from './buildRenderPrompt'
import { canGenerateConcept, getQuotaRemaining, recordConceptImage } from './renderQuota'

const DEFAULT_API =
  (import.meta.env.VITE_CONCEPT_API_URL as string | undefined) ||
  'https://luma-concept-render.drnon.workers.dev'

export interface ConceptResult {
  imageDataUrl: string
  remaining: number
}

export async function generateConceptPhoto(options: {
  plan: PlanState
  locationLabel: string
  hour: number
  apiUrl?: string
  styleKeywords?: string
}): Promise<ConceptResult> {
  if (!canGenerateConcept()) {
    throw new Error(`Daily concept limit reached (${getQuotaRemaining()} left). Try again tomorrow.`)
  }

  const endpoint = options.apiUrl || DEFAULT_API || '/api/concept-render'
  const prompt = buildRenderPrompt({
    plan: options.plan,
    locationLabel: options.locationLabel,
    hour: options.hour,
    styleKeywords: options.styleKeywords,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      summary: buildRenderSummary(options.plan),
      locationLabel: options.locationLabel,
      hour: options.hour,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Concept render failed (${response.status})`)
  }

  const payload = (await response.json()) as { imageBase64?: string; mimeType?: string; error?: string }
  if (payload.error || !payload.imageBase64) {
    throw new Error(payload.error || 'No image returned')
  }

  const mime = payload.mimeType || 'image/png'
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime) || typeof payload.imageBase64 !== 'string' || payload.imageBase64.length > 16 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.imageBase64)) {
    throw new Error('The service returned an invalid image. Try again.')
  }
  const imageDataUrl = `data:${mime};base64,${payload.imageBase64}`
  const remaining = recordConceptImage(imageDataUrl)
  return { imageDataUrl, remaining }
}
