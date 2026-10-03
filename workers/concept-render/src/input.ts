import type { TracePlan, TraceRoom, TraceOpening } from './repairTrace'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_REQUEST_BYTES = 12 * 1024 * 1024
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'])

export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Count actual streamed bytes: Content-Length can be missing or dishonest. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) throw new InputError('Send an application/json body', 415)
  const declared = Number(request.headers.get('Content-Length'))
  if (declared > MAX_REQUEST_BYTES) throw new InputError('Request is too large (maximum 12 MB)', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new InputError('A JSON object is required')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new InputError('Request is too large (maximum 12 MB)', 413) }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try {
    const body = record(JSON.parse(new TextDecoder().decode(bytes)))
    if (!body) throw new InputError('A JSON object is required')
    return body
  } catch (error) {
    if (error instanceof InputError) throw error
    throw new InputError('Invalid JSON body')
  }
}

export function imageInput(value: unknown): { mimeType: string; data: string } {
  if (typeof value !== 'string') throw new InputError('A base64 image data URL is required')
  const comma = value.indexOf(',')
  const mimeType = value.slice(5, comma).replace(/;base64$/, '')
  if (comma < 0 || !value.startsWith('data:') || value.slice(0, comma) !== `data:${mimeType};base64` || !IMAGE_TYPES.has(mimeType)) throw new InputError('Use a PNG, JPEG, WebP, HEIC or HEIF image')
  const data = value.slice(comma + 1)
  if (data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw new InputError('Image is too large (maximum 8 MB)', 413)
  const decodedBytes = data.length / 4 * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)
  if (decodedBytes > MAX_IMAGE_BYTES) throw new InputError('Image is too large (maximum 8 MB)', 413)
  if (data.length < 1000 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new InputError('Image must contain valid base64 data and be large enough to read')
  return { mimeType, data }
}
export function siteDimension(value: unknown, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 1000) throw new InputError('Site dimensions must be numbers between 1 and 1000 metres')
  return value
}

/** Model schema hints are not validation; repair only receives bounded records. */
export function traceOutput(value: unknown): TracePlan | null {
  const plan = record(value)
  if (!plan || !Array.isArray(plan.rooms) || !Array.isArray(plan.openings) || plan.rooms.length > 200 || plan.openings.length > 1000) return null
  const numeric = (row: Record<string, unknown>, keys: string[]) => keys.every(key => typeof row[key] === 'number' && Number.isFinite(row[key]) && Math.abs(row[key] as number) <= 10000)
  const identity = (row: Record<string, unknown>) => typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 128
  if (!plan.rooms.every(raw => { const row = record(raw); return row && identity(row) && typeof row.name === 'string' && row.name.length <= 256 && ['living', 'kitchen', 'bedroom', 'bathroom', 'studio', 'terrace'].includes(String(row.kind)) && numeric(row, ['x', 'y', 'w', 'h']) })) return null
  if (!plan.openings.every(raw => { const row = record(raw); return row && identity(row) && ['window', 'door'].includes(String(row.type)) && numeric(row, ['x', 'y', 'rotation']) })) return null
  return { rooms: plan.rooms as TraceRoom[], openings: plan.openings as TraceOpening[], furniture: [], systems: { solar: false, insulation: false, climate: false, lighting: false } }
}
