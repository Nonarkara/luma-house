import type { PlanState } from '../types'
import { sanitizePlan } from '../sharePlan'
import { canGenerateConcept, getQuotaRemaining, recordAiTrace } from '../concept/renderQuota'

const DEFAULT_API =
    (import.meta.env.VITE_CONCEPT_API_URL as string | undefined) ||
    'https://luma-concept-render.drnon.workers.dev'

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

    const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)
    const response = await fetch(endpoint, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: options.imageDataUrl,
            siteW: options.siteW,
            siteH: options.siteH,
        }),
    })

    if (!response.ok) {
        const detail = await response.text().catch(() => '')
        let message = detail
        try { message = (JSON.parse(detail) as { error?: string }).error || detail } catch { /* plain-text error */ }
        if (message.includes('GEMINI_API_KEY is not configured')) message = 'AI tracing is unavailable: the service is not configured. Keep your project and use Manual underlay to trace the image locally.'
        throw new Error(message || `Plan trace failed (${response.status})`)
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
