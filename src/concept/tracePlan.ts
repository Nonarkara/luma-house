import type { PlanState } from '../types'
import { sanitizePlan } from '../sharePlan'
import { canGenerateConcept, getQuotaRemaining } from '../concept/renderQuota'

const DEFAULT_API =
    (import.meta.env.VITE_CONCEPT_API_URL as string | undefined) ||
    'https://luma-concept-render.drnon.workers.dev'

export interface TraceResult {
    plan: PlanState
    /** Whether the model reported low confidence (hand-drawn, partial, etc.). */
    draft: boolean
    note: string
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
    apiUrl?: string
}): Promise<TraceResult> {
    if (!canGenerateConcept()) {
        throw new Error(`Daily AI limit reached (${getQuotaRemaining()} left). Try again tomorrow.`)
    }
    const endpoint = (options.apiUrl || DEFAULT_API || '').replace(/\/$/, '') + '/trace'

    const response = await fetch(endpoint, {
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
        throw new Error(detail || `Plan trace failed (${response.status})`)
    }

    const payload = (await response.json()) as { plan?: unknown; note?: string; draft?: boolean }
    const sanitized = sanitizePlan(payload.plan)
    if (!sanitized) {
        throw new Error('AI could not read a usable plan from that image. Try a clearer scan or draw it.')
    }
    return {
        plan: sanitized,
        draft: payload.draft !== false,
        note: payload.note || 'AI-read draft — verify walls and openings before costing.',
    }
}