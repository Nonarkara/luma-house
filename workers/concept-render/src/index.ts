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
  },
}
