import { roomArea } from '../plan'
import type { PlanState } from '../types'

export interface RenderContext {
  plan: PlanState
  locationLabel: string
  hour: number
  projectName?: string
}

export function buildRenderPrompt({ plan, locationLabel, hour, projectName = 'River Courtyard House' }: RenderContext): string {
  const rooms = plan.rooms
    .map((room) => `${room.name} (${roomArea(room).toFixed(1)} m²)`)
    .join(', ')
  const windows = plan.openings.filter((item) => item.type === 'window').length
  const doors = plan.openings.filter((item) => item.type === 'door').length
  const systems = Object.entries(plan.systems)
    .filter(([, on]) => on)
    .map(([key]) => key)
    .join(', ') || 'none selected'
  const timeLabel = hour >= 12 ? `${hour === 12 ? 12 : hour - 12}:00 PM` : `${hour}:00 AM`

  return [
    `Architectural concept visualization of a tropical single-storey courtyard house named "${projectName}".`,
    `Location atmosphere: ${locationLabel}. Time of day: ${timeLabel}, soft natural light.`,
    `Program: ${rooms}.`,
    `Openings: ${windows} windows, ${doors} doors. Systems emphasis: ${systems}.`,
    'Style: quiet contemporary tropical residential, timber and light concrete, deep eaves, shaded terrace, green courtyard.',
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
    totalArea: plan.rooms.reduce((sum, room) => sum + roomArea(room), 0),
  }
}
