import type { Furniture, Opening, PlanState, Room, RoomKind } from './types'

// ---------------------------------------------------------------------------
// Plan sharing: encode the full plan into a URL hash so a copied link restores
// the sender's exact plan, and validate any plan-shaped JSON coming from
// localStorage, a share link, or an imported project file.
// ---------------------------------------------------------------------------

const ROOM_KINDS: RoomKind[] = ['living', 'kitchen', 'bedroom', 'bathroom', 'studio', 'terrace']
const FURNITURE_KINDS: Furniture['kind'][] = ['bed', 'sofa', 'dining', 'wardrobe', 'desk']

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function sanitizeRoom(raw: unknown): Room | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>
  const id = str(candidate.id)
  const x = num(candidate.x)
  const y = num(candidate.y)
  const w = num(candidate.w)
  const h = num(candidate.h)
  if (!id || x === null || y === null || w === null || h === null) return null
  if (w <= 0 || h <= 0) return null
  const kind = ROOM_KINDS.includes(candidate.kind as RoomKind) ? (candidate.kind as RoomKind) : 'studio'
  return { id, name: str(candidate.name) ?? 'Room', kind, x, y, w, h }
}

function sanitizeOpening(raw: unknown): Opening | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>
  const id = str(candidate.id)
  const x = num(candidate.x)
  const y = num(candidate.y)
  if (!id || x === null || y === null) return null
  if (candidate.type !== 'window' && candidate.type !== 'door') return null
  return { id, type: candidate.type, x, y, rotation: candidate.rotation === 90 ? 90 : 0 }
}

function sanitizeFurniture(raw: unknown): Furniture | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>
  const id = str(candidate.id)
  const x = num(candidate.x)
  const y = num(candidate.y)
  if (!id || x === null || y === null) return null
  if (!FURNITURE_KINDS.includes(candidate.kind as Furniture['kind'])) return null
  return { id, kind: candidate.kind as Furniture['kind'], x, y, rotated: candidate.rotated === true }
}

/**
 * Validate untrusted JSON into a PlanState. Drops malformed entries, keeps
 * valid ones, and returns null when nothing usable remains — callers fall
 * back to the default plan. Unknown extra fields are ignored.
 */
export function sanitizePlan(raw: unknown): PlanState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>
  if (!Array.isArray(candidate.rooms)) return null
  const rooms = candidate.rooms.map(sanitizeRoom).filter((room): room is Room => room !== null)
  if (rooms.length === 0) return null
  const openings = Array.isArray(candidate.openings)
    ? candidate.openings.map(sanitizeOpening).filter((o): o is Opening => o !== null)
    : []
  const furniture = Array.isArray(candidate.furniture)
    ? candidate.furniture.map(sanitizeFurniture).filter((f): f is Furniture => f !== null)
    : []
  const systemsRaw = (typeof candidate.systems === 'object' && candidate.systems !== null
    ? candidate.systems
    : {}) as Record<string, unknown>
  return {
    rooms,
    openings,
    furniture,
    systems: {
      solar: systemsRaw.solar === true,
      insulation: systemsRaw.insulation === true,
      climate: systemsRaw.climate === true,
      lighting: systemsRaw.lighting === true,
    },
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(payload: string): string {
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Plan → `#plan=…` hash payload (URL-safe base64 of UTF-8 JSON). */
export function encodePlanToHash(plan: PlanState): string {
  return toBase64Url(JSON.stringify(plan))
}

/** Inverse of encodePlanToHash. Returns null on any malformed input. */
export function decodePlanFromHash(hash: string): PlanState | null {
  const match = hash.match(/#plan=([A-Za-z0-9_-]+)/)
  if (!match) return null
  try {
    return sanitizePlan(JSON.parse(fromBase64Url(match[1])))
  } catch {
    return null
  }
}

/** Full shareable URL for the current location with the plan embedded. */
export function buildShareUrl(plan: PlanState): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#plan=${encodePlanToHash(plan)}`
}
