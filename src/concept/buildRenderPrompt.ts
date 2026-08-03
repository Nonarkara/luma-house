import { roomAreaFor, siteOf, totalAreaFor } from '../plan'
import type { PlanState } from '../types'

export interface RenderContext {
  plan: PlanState
  locationLabel: string
  hour: number
  projectName?: string
  styleKeywords?: string
}

export const ARCHITECTURAL_STYLE_PRESETS = [
  {
    id: 'shanghai',
    name: 'Shanghai Contemporary',
    keywords: 'contemporary Shanghai, bespoke elm joinery, mineral plaster walls, linen screens, quiet craftsmanship',
  },
  {
    id: 'nordic',
    name: 'Nordic Passive House',
    keywords: 'Nordic passive house, pale cedar cladding, triple-glazed Scandinavian windows, high insulation, minimalist warm timber',
  },
  {
    id: 'tropical',
    name: 'Tropical Courtyard',
    keywords: 'contemporary tropical courtyard, deep overhanging bamboo eaves, polished terrazzo floor, lush garden courtyard, cross-breeze',
  },
  {
    id: 'japandi',
    name: 'Japandi Timber Pavilion',
    keywords: 'Japandi timber pavilion, shoji sliding screens, warm oak joinery, natural stone paving, serene courtyard garden',
  },
]

export function buildRenderPrompt({ plan, locationLabel, hour, projectName = 'River Courtyard House', styleKeywords }: RenderContext): string {
  const site = siteOf(plan)
  const rooms = plan.rooms
    .map((room) => `${room.name} (${roomAreaFor(room, site).toFixed(1)} m²)`)
    .join(', ')
  const windows = plan.openings.filter((item) => item.type === 'window').length
  const doors = plan.openings.filter((item) => item.type === 'door').length
  const systems = Object.entries(plan.systems)
    .filter(([, on]) => on)
    .map(([key]) => key)
    .join(', ') || 'none selected'
  const timeLabel = hour >= 12 ? `${hour === 12 ? 12 : hour - 12}:00 PM` : `${hour}:00 AM`

  return [
    `Architectural concept visualization of a single-storey residence named "${projectName}".`,
    `Location atmosphere: ${locationLabel}. Time of day: ${timeLabel}, soft natural daylight.`,
    `Program: ${rooms}.`,
    `Openings: ${windows} windows, ${doors} doors. Systems emphasis: ${systems}.`,
    `Style: ${styleKeywords || 'quiet contemporary residential, timber and light concrete, deep eaves, shaded terrace, green courtyard'}.`,
    'Camera: exterior eye-level three-quarter view of the house and courtyard, photographic realism for a design concept board.',
    'Important: this is a concept visualization only, not a photograph of a finished building. No text, logos, watermarks, or UI chrome.',
  ].join(' ')
}

export function buildRenderSummary(plan: PlanState) {
  return {
    roomCount: plan.rooms.length,
    windowCount: plan.openings.filter((item) => item.type === 'window').length,
    doorCount: plan.openings.filter((item) => item.type === 'door').length,
    systems: plan.systems,
    totalArea: totalAreaFor(plan.rooms, siteOf(plan)),
  }
}
