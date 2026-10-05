import { repairTrace, type TracePlan } from './repairTrace'
import { readJson, imageInput, siteDimension, traceOutput, InputError, IMAGE_TYPES } from './input'
export { AiQuota } from './quota'

export interface Env {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  /** Vision model for the plan trace. Kept in vars so a retired model is a config change, not a redeploy of code. */
  TRACE_MODEL?: string
  DAILY_IP_LIMIT?: string
  AI_QUOTA?: DurableObjectNamespace
  DAILY_GLOBAL_LIMIT?: string
}

/**
 * Only the frontends we actually ship may call this from a browser.
 *
 * `Access-Control-Allow-Origin: *` meant any page on the internet could POST to
 * a paid key by embedding one line of script — the most likely way this quota
 * gets burned. A request carrying no Origin (curl, server-to-server) is still
 * served, because the browser is not the only client we care about; that path is
 * held down by the per-IP rate limit instead.
 */
const ALLOWED_ORIGINS = new Set([
  'https://designon.nonarkara.org',
  'https://luma.nonarkara.org',
  'https://nonarkara.github.io',
  'https://luma-house.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(request: Request): Record<string, string> {
  const base = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  const origin = request.headers.get('Origin')
  // No Origin is not a browser. Serve it, and let the rate limit hold the line.
  if (!origin) return { ...base, Vary: 'Origin' }
  if (!ALLOWED_ORIGINS.has(origin)) return { Vary: 'Origin' }
  return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
}

function isBrowserCall(request: Request): boolean {
  const origin = request.headers.get('Origin')
  return origin !== null && !ALLOWED_ORIGINS.has(origin)
}

/**
 * Gemini's failure bodies are JSON meant for a developer console. Passing them
 * straight through put a wall of quoted text in front of the user, so name the
 * failure instead. Only the status is logged; upstream bodies may contain sensitive details.
 */
function explainUpstream(status: number, detail: string): string {
  const rateLimited = status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(detail)
  if (rateLimited) {
    console.error('AI upstream error', status)
    return 'The AI service is out of capacity right now — too many requests from this account. Wait a minute and use Try again.'
  }
  if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(detail)) {
    console.error('AI upstream error', status)
    return 'The AI service is busy right now. Wait a moment and use Try again.'
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(detail)) {
    console.error('AI upstream error', status)
    return 'The AI service rejected its own credentials. This is a configuration fault, not yours — nothing was charged.'
  }
  if (status === 404 || /no longer available|is not found for API key|NOT_FOUND/i.test(detail)) {
    console.error('AI upstream error', status)
    return 'The AI service is temporarily unable to read images — the model it was pointed at is no longer served to new accounts. This is a configuration fault, not yours; nothing was charged.'
  }
  if (status === 400) {
    console.error('AI upstream error', status)
    return 'The AI service would not accept this image. Try a clearer, flatter photo of the sketch.'
  }
  console.error('AI upstream error', status)
  return 'The AI service could not read that image right now. Try again, or trace the photo by hand with Manual underlay.'
}

function json(data: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors },
  })
}

/**
 * Atomic per-network and global daily caps. If the coordinator is unreachable,
 * the request is refused,
 * because an unbounded path to a paid key is worse than a temporarily broken
 * one. Both AI endpoints call this before spending anything.
 */
async function rateLimit(env: Env, ip: string): Promise<boolean> {
  if (!env.AI_QUOTA) return false
  try {
    const day = new Date().toISOString().slice(0, 10)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${ip}`))
    const network = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
    const stub = env.AI_QUOTA.get(env.AI_QUOTA.idFromName('ai-quota-v1'))
    const response = await stub.fetch(`https://quota.internal/?network=${network}`, { method: 'POST' })
    return response.status === 204
  } catch {
    console.error('AI quota unavailable; refusing upstream call')
    return false
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, cors)
    }

    // A browser on a site that is not ours gets no CORS headers, which stops the
    // response being readable — and refuse it outright rather than relying on
    // the browser to be the thing that stops it.
    if (isBrowserCall(request)) {
      return json({ error: 'This service is only available to the designon app.' }, 403, cors)
    }

    const url = new URL(request.url)
    if (url.pathname !== '/' && url.pathname !== '/trace') return json({ error: 'Not found' }, 404, cors)
    let body: Record<string, unknown>
    try { body = await readJson(request) } catch (error) {
      return json({ error: error instanceof InputError ? error.message : 'Could not read request' }, error instanceof InputError ? error.status : 400, cors)
    }
    try {
    // AI floor-plan trace (vision → structured plan JSON).
    if (url.pathname === '/trace') {
      return await handleTrace(request, env, cors, body)
    }

    // Default: concept photo generation.
    return await handleRender(request, env, cors, body)
    } catch (error) {
      if (error instanceof InputError) return json({ error: error.message }, error.status, cors)
      console.error('AI upstream failed without a usable response')
      return json({ error: 'The AI service could not answer. Try again or use Manual underlay.' }, 502, cors)
    }
  },
}

async function handleRender(request: Request, env: Env, cors: Record<string, string>, body: Record<string, unknown>): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured on the worker' }, 500, cors)
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (prompt.length < 20 || prompt.length > 4000) {
    return json({ error: 'Prompt must be between 20 and 4000 characters' }, 400, cors)
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!(await rateLimit(env, ip))) {
    return json({ error: 'Server daily AI limit reached for this network or app' }, 429, cors)
  }

  const model = env.GEMINI_MODEL || 'gemini-3.8-flash-image'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '4:3',
          imageSize: '1K',
        },
      },
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text()
    return json({ error: explainUpstream(upstream.status, detail) }, 502, cors)
  }

  const payload = (await upstream.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }>
      }
    }>
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? []
  if (!Array.isArray(parts)) throw new Error('Invalid upstream parts')
  const imagePart = parts.find((part) => part.inlineData?.data)
  if (!imagePart?.inlineData?.data) {
    return json({ error: 'Gemini returned no image. Try a shorter prompt.' }, 502, cors)
  }

  if (!IMAGE_TYPES.has(imagePart.inlineData.mimeType ?? 'image/png') || typeof imagePart.inlineData.data !== 'string' || imagePart.inlineData.data.length > 16 * 1024 * 1024) throw new Error('Invalid upstream image')
  return json({
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  }, 200, cors)
}

// ---------------------------------------------------------------------------
// AI floor-plan trace
// Sends an uploaded plan image to a Gemini vision model with a strict JSON
// schema prompt, then returns the structured plan for the editor to import.
// ---------------------------------------------------------------------------

const TRACE_PROMPT = (siteW: number, siteH: number) => `You are an architectural plan reader. Analyze the uploaded image — it is usually a hand-drawn floor plan sketched on paper — and return ONLY a JSON object describing the rooms and openings, normalized to a ${siteW}m x ${siteH}m site coordinate system where the full width is 0-100% and the full height is 0-100%. North is up.

Return this exact JSON shape, no markdown, no commentary:
{
  "rooms": [
    { "id": "room-1", "name": "Living room", "kind": "living", "x": <0-100>, "y": <0-100>, "w": <width %>, "h": <height %> }
  ],
  "openings": [
    { "id": "w-1", "type": "window", "x": <0-100>, "y": <0-100>, "rotation": 0 }
  ],
  "furniture": [],
  "systems": { "solar": false, "insulation": false, "climate": false, "lighting": false }
}

Rules:
- "kind" must be one of: living, kitchen, bedroom, bathroom, studio, terrace.
- "rotation" is 0 for windows/doors on horizontal walls (top/bottom edges), 90 for vertical walls (left/right edges).
- x,y is the CENTER of the opening on its wall.
- If the image is not a floor plan, return { "rooms": [], "openings": [] }.
- Coordinates are approximate from the image proportions; precision is not expected.

Layout rules — these are checked against your answer afterwards, and violations are reported to the user as errors:
- ROOMS MUST COVER THE WHOLE DRAWING. The rooms together must reach every drawn
  wall. Do not leave a margin around the outside of your layout, and do not
  cluster the rooms in one corner. If the drawing's outer wall is at 5% and
  100%, the outermost rooms must sit on 5% and 100%.
- ROOMS MUST NOT OVERLAP. No two rooms may share any area. Measure each room from
  the picture, then check every pair.
- ROOMS MUST TOUCH THE OUTLINE. Keep the whole layout inside 0-100 on both axes.
- Give every room a unique id.
- NAME THE ROOMS. Commit to the most likely label for each space: a room with a
  bed drawn in it is a bedroom, a room with a sink or shower is a bathroom, the
  largest shared space is the living room, and the one by the front door is the
  entry. "studio" is a last resort, not a default — five rooms all called
  Studio tells the user nothing, and renaming costs one tap. Do not invent a
  room that is not in the picture, but do label the ones that are.
- AN OPENING MUST SIT ON A ROOM EDGE. A window on an outer wall is only usable if
  a room actually reaches that wall, so place rooms first. Put x,y on a room's
  edge, far enough from each corner that the full opening width (about 1.6 m for
  a window, 0.9 m for a door) still lies on that wall. An opening flush against a
  corner, or on a wall no room reaches, will be rejected.`

/**
 * Ask for JSON via the API rather than parsing it back out of prose. This is
 * what makes the trace dependable: no markdown, no commentary, no
 * unparseable-JSON failure mode.
 */
const TRACE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          kind: { type: 'string', enum: ['living', 'kitchen', 'bedroom', 'bathroom', 'studio', 'terrace'] },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
        },
        required: ['id', 'name', 'kind', 'x', 'y', 'w', 'h'],
      },
    },
    openings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['window', 'door'] },
          x: { type: 'number' },
          y: { type: 'number' },
          rotation: { type: 'integer' },
        },
        required: ['id', 'type', 'x', 'y', 'rotation'],
      },
    },
    furniture: { type: 'array', items: { type: 'object' } },
    systems: {
      type: 'object',
      properties: {
        solar: { type: 'boolean' },
        insulation: { type: 'boolean' },
        climate: { type: 'boolean' },
        lighting: { type: 'boolean' },
      },
    },
  },
  required: ['rooms', 'openings', 'furniture', 'systems'],
}

async function handleTrace(request: Request, env: Env, cors: Record<string, string>, body: Record<string, unknown>): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured on the worker' }, 500, cors)
  }

  const { mimeType, data: base64 } = imageInput(body.image)
  const siteW = siteDimension(body.siteW, 14)
  const siteH = siteDimension(body.siteH, 10)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!(await rateLimit(env, ip))) {
    return json({ error: 'Server daily AI limit reached for this network or app' }, 429, cors)
  }

  const visionModel = env.TRACE_MODEL || 'gemini-3.8-flash' // vision-capable, text output
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: TRACE_PROMPT(siteW, siteH) },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT'],
        responseMimeType: 'application/json',
        responseSchema: TRACE_RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text()
    return json({ error: explainUpstream(upstream.status, detail) }, 502, cors)
  }

  const payload = (await upstream.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  // Extract the first JSON object from the text (the model may wrap it in prose).
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  let parsed: TracePlan | null = null
  let note = 'AI-read draft — verify walls and openings before costing.'
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      parsed = traceOutput(JSON.parse(text.slice(jsonStart, jsonEnd + 1)))
    } catch {
      note = 'AI returned unparseable JSON — the image may not be a clear floor plan.'
    }
  } else {
    note = 'AI did not return a plan — the image may not be a recognizable floor plan.'
  }

  if (!parsed) return json({ plan: null, note: 'AI returned no usable plan. Try a clearer scan or use Manual underlay.', draft: true }, 200, cors)
  const repaired = repairTrace(parsed)
  return json({ plan: repaired, note: repaired.note ?? note, draft: true }, 200, cors)
}