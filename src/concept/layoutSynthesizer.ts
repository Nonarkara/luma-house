import type { Furniture, Opening, PlanState, Room } from '../types'
import { defaultSite, furnitureDoorConflicts } from '../plan'
import { boundarySpans } from '../analysis/walls'

export interface SynthesizerBrief {
  style: 'courtyard' | 'linear' | 'compact' | 'l-shaped'
  includeStudy?: boolean
  includeTerrace?: boolean
  targetAreaM2?: number
}

/**
 * Deterministic layout presets. Rooms are templates; openings and scale derive
 * from their actual geometry. No AI or solar optimization is performed.
 */
export function synthesizeLayout(brief: SynthesizerBrief = { style: 'courtyard' }): PlanState {
  const rooms: Room[] = []
  const openings: Opening[] = []

  if (brief.style === 'l-shaped') {
    // L-Shaped courtyard villa
    rooms.push(
      { id: 'synth-living', name: 'Living Room', kind: 'living', x: 20, y: 40, w: 35, h: 30, wallHeight: 2.8 },
      { id: 'synth-kitchen', name: 'Kitchen & Dining', kind: 'kitchen', x: 20, y: 15, w: 35, h: 25, wallHeight: 2.5 },
      { id: 'synth-bed1', name: 'Master Bedroom', kind: 'bedroom', x: 55, y: 40, w: 30, h: 30, wallHeight: 2.6 },
      { id: 'synth-bath', name: 'Ensuite Bath', kind: 'bathroom', x: 55, y: 25, w: 30, h: 15, wallHeight: 2.5 },
    )
    if (brief.includeStudy) {
      rooms.push({ id: 'synth-study', name: 'Design Studio', kind: 'studio', x: 55, y: 70, w: 30, h: 20, wallHeight: 2.5 })
    }
    if (brief.includeTerrace) {
      rooms.push({ id: 'synth-terrace', name: 'Sun Courtyard', kind: 'terrace', x: 20, y: 70, w: 35, h: 20, wallHeight: 0 })
    }
  } else if (brief.style === 'linear') {
    // Passive Solar Linear Layout (All main rooms face South)
    rooms.push(
      { id: 'synth-bed2', name: 'Guest Room', kind: 'bedroom', x: 10, y: 30, w: 22, h: 40, wallHeight: 2.5 },
      { id: 'synth-living', name: 'Great Room', kind: 'living', x: 32, y: 30, w: 36, h: 40, wallHeight: 3.0 },
      { id: 'synth-kitchen', name: 'Open Kitchen', kind: 'kitchen', x: 68, y: 30, w: 22, h: 22, wallHeight: 2.5 },
      { id: 'synth-bath', name: 'Bath & Utility', kind: 'bathroom', x: 68, y: 52, w: 22, h: 18, wallHeight: 2.5 },
    )
  } else {
    // Default Courtyard / Compact Layout
    rooms.push(
      { id: 'synth-living', name: 'Living Room', kind: 'living', x: 15, y: 45, w: 40, h: 35, wallHeight: 2.8 },
      { id: 'synth-kitchen', name: 'Kitchen & Dining', kind: 'kitchen', x: 15, y: 15, w: 40, h: 30, wallHeight: 2.5 },
      { id: 'synth-bed1', name: 'Master Suite', kind: 'bedroom', x: 55, y: 15, w: 32, h: 35, wallHeight: 2.6 },
      { id: 'synth-bath', name: 'Main Bathroom', kind: 'bathroom', x: 55, y: 50, w: 32, h: 20, wallHeight: 2.5 },
    )
    if (brief.includeTerrace ?? true) {
      rooms.push({ id: 'synth-terrace', name: 'Garden Terrace', kind: 'terrace', x: 55, y: 70, w: 32, h: 18, wallHeight: 0 })
    }
  }

  const site = defaultSite()
  const enclosedArea = rooms.filter(room => room.kind !== 'terrace').reduce((sum, room) => sum + room.w * room.h / 10000 * site.w * site.h, 0)
  if (brief.targetAreaM2 !== undefined) {
    if (!Number.isFinite(brief.targetAreaM2) || brief.targetAreaM2 < 20 || brief.targetAreaM2 > 1000) {
      throw new Error('Choose an enclosed area between 20 and 1000 m².')
    }
    const factor = Math.sqrt(brief.targetAreaM2 / enclosedArea)
    site.w *= factor
    site.h *= factor
  }
  const plan: PlanState = {
    rooms,
    openings,
    furniture: [],
    systems: {
      solar: true,
      insulation: true,
      climate: true,
      lighting: true,
    },
    site,
  }
  // Connect every touching pair once. A window only uses an exterior span.
  const connectedPairs = new Set<string>()
  for (const room of rooms) {
    if (room.kind === 'terrace') continue
    const spans = boundarySpans(plan, room)
    const add = (span: typeof spans[number], type: Opening['type'], id: string) => {
      const lengthM = (span.end - span.start) / 100 * (span.rotation === 0 ? site.w : site.h)
      const widthM = Math.min(type === 'door' ? 0.9 : 1.6, lengthM - 0.2)
      if (widthM < 0.4) return false
      const center = (span.start + span.end) / 2
      openings.push({ id, type, x: span.rotation === 0 ? center : span.fixed, y: span.rotation === 0 ? span.fixed : center,
        rotation: span.rotation, widthM, heightM: type === 'door' ? 2.1 : 1.2,
        sillHeightM: type === 'door' ? 0 : 0.9, headHeightM: 2.1,
        ...(type === 'window' ? { shgc: 0.35, vlt: 0.65, operableFraction: 0.5 } : {}),
      })
      return true
    }
    for (const span of spans.filter(span => span.neighborIds.length === 1)) {
      const pair = [room.id, span.neighborIds[0]].sort().join(':')
      if (!connectedPairs.has(pair) && add(span, 'door', `door-${pair}`)) connectedPairs.add(pair)
    }
    const exterior = spans.filter(span => span.neighborIds.length === 0).sort((a, b) => (b.end - b.start) - (a.end - a.start))
    // Reserve a separate exterior face for the living-room entry.
    const entry = room.kind === 'living' ? exterior.find(span => span.compass === 'W') ?? exterior[0] : undefined
    if (entry) add(entry, 'door', `entry-${room.id}`)
    const windowSpan = exterior.find(span => span !== entry)
    if (windowSpan) add(windowSpan, 'window', `window-${room.id}`)
  }
  // Center each piece in its intended room and fit its real dimensions.
  for (const room of rooms) {
    const kind = room.kind === 'living' ? 'sofa' : room.kind === 'bedroom' ? 'bed' : room.kind === 'kitchen' ? 'dining' : null
    if (!kind) continue
    const wM = Math.min(kind === 'sofa' ? 2.2 : kind === 'bed' ? 2 : 1.8, room.w / 100 * site.w * 0.7)
    const dM = Math.min(kind === 'sofa' ? 0.9 : kind === 'bed' ? 1.8 : 0.9, room.h / 100 * site.h * 0.7)
    const item: Furniture = { id: `f-${room.id}`, kind, x: 0, y: 0, rotated: false, wM, dM }
    const candidates = [0.5, 0.05, 0.95].flatMap(u => [0.5, 0.05, 0.95].map(v => ({
      ...item,
      x: room.x + (room.w - wM / site.w * 100) * u,
      y: room.y + (room.h - dM / site.h * 100) * v,
    })))
    const placement = candidates.find(candidate => furnitureDoorConflicts([candidate], openings, site).size === 0)
    // A tight preset can be furnished manually; never pre-place a blocked door.
    if (placement) plan.furniture.push(placement)
  }
  return plan
}
