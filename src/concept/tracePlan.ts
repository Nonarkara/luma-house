import type { PlanState } from '../types'
import { sanitizePlan } from '../sharePlan'
import { canGenerateConcept, getQuotaRemaining, recordAiTrace } from '../concept/renderQuota'

const DEFAULT_API =
    (import.meta.env.VITE_CONCEPT_API_URL as string | undefined) ||
    'https://luma-concept-render.drnon.workers.dev'

/** Vision trace on a real photo takes ~30-60s. The UI shows this same number. */
export const TRACE_TIMEOUT_MS = 60000

/**
 * A server can still answer with something built for a console — a JSON body, a
 * stack trace, a bare status. None of that belongs in front of someone who just
 * wants their floor plan, so anything that is not plainly a sentence is
 * replaced. The real text goes to the console, where it is actually useful.
 */
function readableServerError(message: string, status: number): string {
  const text = (message || '').trim()
  const looksLikeNoise = !text || text.length > 240 || /[{}[\]"]|":\s*"/.test(text) || /\n/.test(text)
  if (!looksLikeNoise) return text
  console.error('plan trace failed', status, text)
  return `The tracing service could not answer (HTTP ${status}). Try again in a moment, or trace the photo by hand with Manual underlay.`
}

/**
 * A hung vision call used to leave the user staring at an unchanging
 * "Reading the image…" with no way to tell working from stuck, and the abort
 * surfaced as a raw transport string. Say what happened, and say what to do.
 */
function describeTransportFailure(error: unknown, cancelled: boolean): string {
  if (cancelled) return 'Tracing canceled. Your project is untouched — pick the image again to retry.'
  const name = (error as { name?: string } | null)?.name
  if (name === 'TimeoutError') {
    return `The AI did not answer within ${Math.round(TRACE_TIMEOUT_MS / 1000)} seconds. Nothing was charged. Try again, or trace the photo by hand with Manual underlay.`
  }
  return 'Could not reach the AI tracing service. Check your connection and try again, or trace the photo by hand with Manual underlay.'
}

export interface TraceResult {
    plan: PlanState
    /** Whether the model reported low confidence (hand-drawn, partial, etc.). */
    draft: boolean
    note: string
    remaining: number
}

/**
 * Send an uploaded floor-plan image to the Gemini vision worker and get back
 * a structured plan draft. The result is ALWAYS run through sanitizePlan so a
 * malformed model output can never crash the editor. Surfaced honestly as a
 * draft the user must verify — vision trace is approximate, not exact.
 */
export async function tracePlanFromImage(options: {
    imageDataUrl: string
    siteW?: number
    siteH?: number
    signal?: AbortSignal
    apiUrl?: string
}): Promise<TraceResult> {
    if (!canGenerateConcept()) {
        throw new Error(`Daily AI limit reached (${getQuotaRemaining()} left). Try again tomorrow.`)
    }
    const endpoint = (options.apiUrl || DEFAULT_API || '').replace(/\/$/, '') + '/trace'

    const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(TRACE_TIMEOUT_MS)]) : AbortSignal.timeout(TRACE_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(endpoint, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: options.imageDataUrl,
          siteW: options.siteW,
          siteH: options.siteH,
        }),
      })
    } catch (error) {
      throw new Error(describeTransportFailure(error, options.signal?.aborted === true))
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '')
        let message = detail
        try { message = (JSON.parse(detail) as { error?: string }).error || detail } catch { /* plain-text error */ }
        if (message.includes('GEMINI_API_KEY is not configured')) message = 'AI tracing is unavailable: the service is not configured. Keep your project and use Manual underlay to trace the image locally.'
        throw new Error(readableServerError(message, response.status))
    }

    const payload = (await response.json()) as { plan?: unknown; note?: string; draft?: boolean }
    const sanitized = sanitizePlan(payload.plan)
    if (!sanitized || sanitized.rooms.length === 0) {
        throw new Error('AI could not read a usable plan from that image. Try a clearer scan or draw it.')
    }
    signal.throwIfAborted()
    return {
        plan: { ...sanitized, site: { w: options.siteW ?? sanitized.site?.w ?? 14, h: options.siteH ?? sanitized.site?.h ?? 10, unit: sanitized.site?.unit ?? 1 } },
        draft: true,
        note: payload.note || 'AI-read draft — verify walls and openings before costing.',
        remaining: recordAiTrace(),
    }
}
