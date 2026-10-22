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

/**
 * A message a person can read.
 *
 * The worker answers with a JSON body, and that body used to go straight
 * into the toast: a person pressing "Concept photo" read
 * `{"error":"GEMINI_API_KEY is not configured on the worker"}`. That is a
 * server's account of itself, not an answer to the person who asked, and it
 * names an environment variable that has no business being in a product.
 *
 * So the body is read, understood, and replaced with a sentence. The detail
 * stays in the console, where a person debugging the worker will look.
 */
export function conceptErrorMessage(detail: string, status: number): string {
  const trimmed = detail.trim()
  let serverMessage = ''
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown }
    if (typeof parsed?.error === 'string') serverMessage = parsed.error
  } catch {
    // Not JSON. A plain-text body is used as it is, if it is short enough to
    // be a sentence rather than a stack trace.
    if (trimmed && trimmed.length <= 120) serverMessage = trimmed
  }

  if (/GEMINI_API_KEY|API_KEY is not configured|no model|model is not configured/i.test(serverMessage)) {
    return 'Concept photos need a model on the server. This build has none.'
  }
  if (/quota|rate limit|too many/i.test(serverMessage)) {
    return 'The concept service is busy or out of quota. Try again shortly.'
  }
  if (/disabled|MODEL|not enabled/i.test(serverMessage)) {
    return 'Concept photos are switched off on this server.'
  }
  if (serverMessage && serverMessage.length <= 140 && !/[{}<>]/.test(serverMessage)) {
    return `Concept render failed: ${serverMessage}`
  }
  return `Concept render failed (${status}). The plan still works.`
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
    console.warn('concept render failed', response.status, detail)
    throw new Error(conceptErrorMessage(detail, response.status))
  }

  const payload = (await response.json()) as { imageBase64?: string; mimeType?: string; error?: string }
  if (payload.error || !payload.imageBase64) {
    throw new Error(conceptErrorMessage(payload.error ?? '', response.status))
  }

  const mime = payload.mimeType || 'image/png'
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime) || typeof payload.imageBase64 !== 'string' || payload.imageBase64.length > 16 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.imageBase64)) {
    throw new Error('The service returned an invalid image. Try again.')
  }
  const imageDataUrl = `data:${mime};base64,${payload.imageBase64}`
  const remaining = recordConceptImage(imageDataUrl)
  return { imageDataUrl, remaining }
}
