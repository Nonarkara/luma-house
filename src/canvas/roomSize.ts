import type { Room, SiteSpec } from '../types'

/**
 * Stating a real length.
 *
 * The drawing field has one scale, and that scale comes from a single known
 * measurement. Every other length on the sheet is that scale applied to a
 * rough line, so every other length is an estimate.
 *
 * Typing a length states a fact. The room becomes that long, the wall keeps
 * the direction it was drawn in, and the edge it was drawn from stays put —
 * the far edge moves. A length that will not fit inside the field is refused
 * and the drawing does not change.
 */

export type SizeAxis = 'w' | 'h'

/** The shortest length a room may be stated to be, in metres. */
export const MIN_STATED_M = 0.1

/** Why a stated length was refused. The drawing is left alone. */
export type SizeRefusal = 'not-a-number' | 'too-small' | 'too-large' | 'will-not-fit'

export interface SizeOutcome {
  /** The room after the change; the same room when nothing changed. */
  room: Room
  changed: boolean
  refusal?: SizeRefusal
}

const UNIT_M: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  '"': 0.0254,
  ft: 0.3048,
  "'": 0.3048,
}

/**
 * Read a length the way a person writes one: "4.9", "4.9 m", "490cm",
 * "4900mm", "12in", or "4' 6"".
 *
 * Returns null for anything that is not a length, so the caller can refuse
 * the edit rather than guess at it.
 */
export function parseLengthMetres(text: string): number | null {
  const raw = text.trim().toLowerCase()
  if (!raw) return null

  const feet = raw.match(/^(\d+)\s*'\s*(?:(\d+(?:\.\d+)?)\s*")?$/)
  if (feet) {
    return Number(feet[1]) * 0.3048 + (feet[2] ? Number(feet[2]) * 0.0254 : 0)
  }

  const simple = raw.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|"|')?$/)
  if (!simple) return null
  const value = Number(simple[1])
  if (!Number.isFinite(value)) return null
  const unit = simple[2]
  return unit ? value * UNIT_M[unit] : value
}

/** A room's real width in metres, read off the sheet and the field. */
export function roomWidthM(room: Room, site: SiteSpec): number {
  return (room.w / 100) * site.w
}

/** A room's real depth in metres. */
export function roomDepthM(room: Room, site: SiteSpec): number {
  return (room.h / 100) * site.h
}

/**
 * State the room's real width or depth in metres.
 *
 * The edge the room was drawn from stays where it was; the far edge moves to
 * the length that was stated. A length that will not fit inside the field is
 * refused and nothing changes.
 */
export function setRoomSizeM(room: Room, site: SiteSpec, axis: SizeAxis, metres: number): SizeOutcome {
  if (!Number.isFinite(metres)) return { room, changed: false, refusal: 'not-a-number' }
  if (metres < MIN_STATED_M) return { room, changed: false, refusal: 'too-small' }
  const fieldM = axis === 'w' ? site.w : site.h
  if (metres > fieldM) return { room, changed: false, refusal: 'too-large' }

  const percent = (metres / fieldM) * 100
  const near = axis === 'w' ? room.x : room.y
  if (near + percent > 100 + 1e-9) return { room, changed: false, refusal: 'will-not-fit' }

  return {
    room: axis === 'w' ? { ...room, w: percent } : { ...room, h: percent },
    changed: true,
  }
}

/** A length in metres, written the way a drawing writes it. */
export function formatMetres(value: number): string {
  return value.toFixed(2)
}

/** What to say when a stated length is refused. */
export function sizeRefusalMessage(refusal: SizeRefusal, axis: SizeAxis, site: SiteSpec): string {
  const fieldM = axis === 'w' ? site.w : site.h
  const what = axis === 'w' ? 'width' : 'depth'
  switch (refusal) {
    case 'not-a-number':
      return 'That is not a length. Type a number — 4.90, or 490cm.'
    case 'too-small':
      return `A room cannot be shorter than ${MIN_STATED_M.toFixed(2)} m.`
    case 'too-large':
      return `That ${what} is longer than the ${fieldM.toFixed(1)} m drawing field.`
    case 'will-not-fit':
      return `That ${what} will not fit from where the room is drawn — move the room first.`
  }
}
