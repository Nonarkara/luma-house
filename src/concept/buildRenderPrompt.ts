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
    id: 'japandi',
    name: 'Japandi Timber',
    category: 'Minimalist',
    keywords: 'Japandi timber pavilion, shoji sliding screens, warm oak joinery, natural stone paving, serene courtyard garden, soft diffuse daylight',
  },
  {
    id: 'tropical',
    name: 'Tropical Courtyard',
    category: 'Regional',
    keywords: 'contemporary tropical courtyard, deep overhanging bamboo eaves, polished terrazzo floor, lush garden courtyard, cross-breeze, dappled shadows',
  },
  {
    id: 'nordic',
    name: 'Nordic Passive',
    category: 'Minimalist',
    keywords: 'Nordic passive house, pale cedar cladding, triple-glazed Scandinavian windows, high insulation, minimalist warm timber, hygge atmosphere',
  },
  {
    id: 'brutalist',
    name: 'Brutalist Monolith',
    category: 'Modernist',
    keywords: 'warm brutalist architecture, board-formed concrete walls, geometric deep lightwells, sculptural massing, teak interior panels, architectural shadows',
  },
  {
    id: 'bauhaus',
    name: 'Modern Bauhaus',
    category: 'Modernist',
    keywords: 'Bauhaus modernism, slim black steel frames, floor-to-ceiling glass curtain walls, pure geometric planes, primary accent colors, floating roof',
  },
  {
    id: 'vernacular',
    name: 'Thai Vernacular',
    category: 'Regional',
    keywords: 'contemporary Thai timber pavilion, elevated platform, sweeping gabled clay tile roof, slatted wooden louvers, open breezeway, lotus water court',
  },
  {
    id: 'midcentury',
    name: 'Mid-Century Modern',
    category: 'Modernist',
    keywords: 'mid-century modern residence, warm walnut wall cladding, terrazzo floors, clerestory ribbon windows, post-and-beam structure, brass hardware',
  },
  {
    id: 'biophilic',
    name: 'Biophilic Oasis',
    category: 'Eco',
    keywords: 'biophilic residential architecture, integrated living plant walls, sunken courtyard atrium, natural river stone, daylight-responsive skylights',
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean Court',
    category: 'Regional',
    keywords: 'Mediterranean coastal villa, textured warm lime plaster, terracotta roof tiles, arched shaded loggia, stone paved courtyard with olive tree',
  },
  {
    id: 'industrial',
    name: 'Industrial Loft',
    category: 'Modernist',
    keywords: 'refined industrial loft residence, exposed black steel trusses, crittall window frames, polished screed concrete floor, warm tungsten lighting',
  },
  {
    id: 'monochrome',
    name: 'Minimalist White',
    category: 'Minimalist',
    keywords: 'ultra-minimalist monochrome residence, museum-grade white microcement, frameless floor-to-ceiling glass, architectural shadow reveals, quiet emptiness',
  },
  {
    id: 'rammedearth',
    name: 'Rammed Earth Sanctuary',
    category: 'Eco',
    keywords: 'sustainable rammed earth house, stratified sedimentary earth walls, heavy timber rafters, natural lime plaster, terracotta floor tiles, thermal mass',
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
