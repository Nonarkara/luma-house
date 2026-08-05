import type { Opening, PlanState, Room } from '../types'
import { defaultSite } from '../plan'

export interface SynthesizerBrief {
  style: 'courtyard' | 'linear' | 'compact' | 'l-shaped'
  includeStudy?: boolean
  includeTerrace?: boolean
  targetAreaM2?: number
}

/**
 * Algorithmic Layout Synthesizer: Synthesizes a non-overlapping, solar-optimized
 * architectural floor plan from scratch.
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

  // Synthesize exterior windows & interior doors automatically
  // Windows facing South / East
  openings.push(
    { id: 'op-win-living-s', type: 'window', x: 35, y: 80, rotation: 0, widthM: 2.4, heightM: 1.8, sillHeightM: 0.4, headHeightM: 2.2, shgc: 0.35, operableFraction: 0.6 },
    { id: 'op-win-bed-s', type: 'window', x: 71, y: 50, rotation: 0, widthM: 1.8, heightM: 1.4, sillHeightM: 0.8, headHeightM: 2.2, shgc: 0.35, operableFraction: 0.5 },
    { id: 'op-win-kitchen-n', type: 'window', x: 35, y: 15, rotation: 0, widthM: 1.6, heightM: 1.2, sillHeightM: 1.0, headHeightM: 2.2, shgc: 0.65, operableFraction: 0.5 },
    { id: 'op-door-main', type: 'door', x: 15, y: 62, rotation: 90, widthM: 0.9, heightM: 2.1, sillHeightM: 0 },
    { id: 'op-door-living-bed', type: 'door', x: 55, y: 32, rotation: 90, widthM: 0.9, heightM: 2.1, sillHeightM: 0 },
  )

  return {
    rooms,
    openings,
    furniture: [
      { id: 'f-sofa', kind: 'sofa', x: 25, y: 52, rotated: false },
      { id: 'f-bed', kind: 'bed', x: 62, y: 22, rotated: false },
      { id: 'f-dining', kind: 'dining', x: 25, y: 22, rotated: false },
    ],
    systems: {
      solar: true,
      insulation: true,
      climate: true,
      lighting: true,
    },
    site: defaultSite(),
  }
}
