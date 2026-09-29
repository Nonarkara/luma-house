import { repairTrace, type TracePlan } from './repairTrace'

export interface Env {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  DAILY_IP_LIMIT?: string
  RATE_LIMIT?: KVNamespace
}

interface RenderBody {
  prompt?: string
  locationLabel?: string
  hour?: number
}

interface TraceBody {
  image?: string
  siteW?: number
  siteH?: number
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function rateLimit(env: Env, ip: string): Promise<boolean> {
  if (!env.RATE_LIMIT) return true
  const day = new Date().toISOString().slice(0, 10)
  const key = `concept:${day}:${ip}`
  const limit = Number(env.DAILY_IP_LIMIT || 20)
  const current = Number((await env.RATE_LIMIT.get(key)) || '0')
  if (current >= limit) return false
  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: 60 * 60 * 36 })
  return true
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405)
    }

    const url = new URL(request.url)
    // AI floor-plan trace (vision → structured plan JSON).
    if (url.pathname.endsWith('/trace')) {
      return handleTrace(request, env)
    }

    // Default: concept photo generation.
    return handleRender(request, env)
  },
}

async function handleRender(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured on the worker' }, 500)
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!(await rateLimit(env, ip))) {
    return json({ error: 'Server daily render limit reached for this network' }, 429)
  }

  let body: RenderBody
  try {
    body = (await request.json()) as RenderBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const prompt = (body.prompt || '').trim()
  if (prompt.length < 20 || prompt.length > 4000) {
    return json({ error: 'Prompt must be between 20 and 4000 characters' }, 400)
  }

  const model = env.GEMINI_MODEL || 'gemini-2.5-flash-image'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    return json({ error: `Gemini request failed: ${detail.slice(0, 400)}` }, 502)
  }

  const payload = (await upstream.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }>
      }
    }>
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((part) => part.inlineData?.data)
  if (!imagePart?.inlineData?.data) {
    return json({ error: 'Gemini returned no image. Try a shorter prompt.' }, 502)
  }

  return json({
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  })
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
- ROOMS MUST NOT OVERLAP. No two rooms may share any area. Measure each room from the picture, then check every pair.
- ROOMS MUST TOUCH THE OUTLINE. Keep the whole layout inside 0-100 on both axes.
- Give every room a unique id.
- Name a room for what is actually drawn. Do not invent a second bedroom, bathroom or kitchen that is not in the picture. If you are unsure, use "studio".
- AN OPENING MUST FIT ITS WALL. Place x,y on a room's edge, far enough from each corner that the full opening width (about 1.6 m for a window, 0.9 m for a door) still lies on that wall. An opening flush against a corner will be rejected.`

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

async function handleTrace(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured on the worker' }, 500)
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!(await rateLimit(env, ip))) {
    return json({ error: 'Server daily AI limit reached for this network' }, 429)
  }

  let body: TraceBody
  try {
    body = (await request.json()) as TraceBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const image = (body.image || '').trim()
  // Expect a data URL: data:image/...;base64,....
  const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
  if (!match) {
    return json({ error: 'A base64 image data URL is required' }, 400)
  }
  const mimeType = match[1]
  const base64 = match[2]
  if (base64.length < 1000) {
    return json({ error: 'Image too small to read a plan from' }, 400)
  }

  const siteW = body.siteW && body.siteW > 0 ? body.siteW : 14
  const siteH = body.siteH && body.siteH > 0 ? body.siteH : 10
  const visionModel = 'gemini-2.5-flash' // vision-capable, text output
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${env.GEMINI_API_KEY}`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    return json({ error: `Gemini vision request failed: ${detail.slice(0, 400)}` }, 502)
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
      parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as TracePlan
    } catch {
      note = 'AI returned unparseable JSON — the image may not be a clear floor plan.'
    }
  } else {
    note = 'AI did not return a plan — the image may not be a recognizable floor plan.'
  }

  if (!parsed) return json({ plan: null, note, draft: true })
  const repaired = repairTrace(parsed)
  return json({ plan: repaired, note: repaired.note ?? note, draft: true })
}