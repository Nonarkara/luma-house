import { daylightPotential, egressRoutes, heatFlowSnapshot, windFlowPotential } from '../analysis'
import { roomHeight, siteOf, totalAreaFor } from '../plan'
import type { PlanState } from '../types'

export interface CameraWaypoint {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export interface TourContext {
  sunAzimuth: number
  sunAltitude: number
  outsideC: number
  windFrom: number
  windSpeed: number
}

export interface GuidedTourChapter {
  id: 'scale' | 'volume' | 'sun' | 'routes'
  number: number
  title: string
  subtitle: string
  description: string
  camera: CameraWaypoint
  focusedRoomId?: string
  focusLabel?: string
  metrics: Array<{ label: string; value: string; highlight?: boolean }>
  actionHint: string
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** Build a tour from the user's plan. No chapter contains sample-only claims. */
export function createGuidedTour(plan: PlanState, context: TourContext): GuidedTourChapter[] {
  const site = siteOf(plan)
  const extent = Math.max(site.w, site.h, 8)
  const areaM2 = totalAreaFor(plan.rooms, site)
  const largestRoom = [...plan.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0]
  const heights = plan.rooms.map(roomHeight)
  const minHeight = heights.length > 0 ? Math.min(...heights) : 0
  const maxHeight = heights.length > 0 ? Math.max(...heights) : 0
  const daylight = daylightPotential(plan)
  const averageReach = daylight.length > 0
    ? daylight.reduce((sum, room) => sum + room.planCoverage, 0) / daylight.length
    : 0
  const roomsWithoutDaylight = daylight.filter((room) => room.exteriorWindowCount === 0).length
  const heat = heatFlowSnapshot({
    plan,
    sunAzimuth: context.sunAzimuth,
    sunAltitude: context.sunAltitude,
    outsideC: context.outsideC,
  })
  const air = windFlowPotential(plan, context.windFrom, context.windSpeed)
  const pressurePaths = air.filter((room) => room.mode === 'through-flow').length
  const escape = egressRoutes(plan)
  const exitRoutes = escape.filter((room) => room.connected).length

  return [
    {
      id: 'scale',
      number: 1,
      title: 'Your drawing, at scale',
      subtitle: '01 · Footprint',
      description: 'The marks on the page now share one measured field. Area, openings, 3D and quantities all inherit this geometry.',
      camera: { position: [0, extent * 1.35, extent * 1.45], target: [0, 0, 0], fov: 42 },
      metrics: [
        { label: 'Drawn floor area', value: `${areaM2.toFixed(1)} m²`, highlight: true },
        { label: 'Drawing field', value: `${site.w.toFixed(1)} × ${site.h.toFixed(1)} m` },
        { label: 'Rooms', value: `${plan.rooms.length}` },
        { label: 'Grid', value: `${site.unit.toFixed(1)} m / cell` },
      ],
      actionHint: 'If the scale is assumed, return to Plan and calibrate it from one known room dimension.',
    },
    {
      id: 'volume',
      number: 2,
      title: 'Lines become rooms',
      subtitle: '02 · Volume',
      description: 'Each room footprint rises to its stored wall height. Windows and doors cut the wall instead of floating on its face.',
      camera: { position: [extent * 0.8, extent * 0.7, extent * 0.85], target: [0, 1, 0], fov: 40 },
      focusedRoomId: largestRoom?.id,
      focusLabel: largestRoom?.name,
      metrics: [
        { label: 'Wall height range', value: heights.length > 0 ? `${minHeight.toFixed(2)}–${maxHeight.toFixed(2)} m` : 'No rooms', highlight: true },
        { label: 'Windows', value: `${plan.openings.filter((opening) => opening.type === 'window').length}` },
        { label: 'Doors', value: `${plan.openings.filter((opening) => opening.type === 'door').length}` },
        { label: 'Furniture at scale', value: `${plan.furniture.length} items` },
      ],
      actionHint: 'Select a room in 3D to raise or lower its wall height.',
    },
    {
      id: 'sun',
      number: 3,
      title: 'See where the sun matters',
      subtitle: '03 · Sun + envelope',
      description: 'The current sun position and envelope assumptions produce a comparison snapshot. This is useful for design moves, not equipment sizing.',
      camera: { position: [-extent * 0.8, extent * 0.7, -extent * 0.7], target: [0, 1, 0], fov: 40 },
      metrics: [
        { label: 'Net heat now', value: `${Math.abs(heat.netW) >= 1000 ? `${(Math.abs(heat.netW) / 1000).toFixed(1)} kW` : `${Math.round(Math.abs(heat.netW))} W`} ${heat.mode === 'heat-out' ? 'leaving' : 'entering'}`, highlight: true },
        { label: 'Direct solar through glass', value: `${Math.round(heat.solarW)} W` },
        { label: 'Indicative daylight reach', value: percent(averageReach) },
        { label: 'Rooms without exterior daylight', value: `${roomsWithoutDaylight}` },
      ],
      actionHint: 'Move the time slider below the model, then compare window placement and shade in Plan.',
    },
    {
      id: 'routes',
      number: 4,
      title: 'Test the paths through it',
      subtitle: '04 · Air + getting out',
      description: 'A useful plan needs a pressure path for breeze and a continuous modeled door path to outdoors. Both depend on the openings you drew.',
      camera: { position: [0, extent * 0.75, -extent * 1.15], target: [0, 1, 0], fov: 42 },
      metrics: [
        { label: 'Wind pressure paths', value: `${pressurePaths} / ${plan.rooms.length} rooms`, highlight: true },
        { label: 'Wind input', value: `${context.windFrom}° · ${context.windSpeed.toFixed(1)} m/s` },
        { label: 'Door paths outdoors', value: `${exitRoutes} / ${plan.rooms.length} rooms` },
        { label: 'Confidence', value: 'Concept geometry' },
      ],
      actionHint: 'Turn on Air paths here, or open the Value Lens in Plan to see each route.',
    },
  ]
}
