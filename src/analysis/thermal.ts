import type { PlanState, Room } from '../types'
import { getEnvelopeFromAssemblies } from '../assemblies/envelope'
import { openingsForRoomWall } from './walls'
import type { WallSun } from './types'
import { roomAreaFor, siteOf } from '../plan'
import type { Compass } from './types'

/**
 * Peak outdoor dry-bulb °C by latitude, averaged across the worst month.
 * Rough model — real climate data would replace this. Directional, not lab-accurate.
 */
export function peakOutdoorC(latitude: number): number {
  const absLat = Math.abs(latitude)
  if (absLat <= 5) return 35
  if (absLat <= 12) return 38
  if (absLat <= 20) return 36
  if (absLat <= 30) return 40
  if (absLat <= 40) return 34
  return 30
}

interface ThermalInputs {
  walls: WallSun[]
  plan: PlanState
  room: Room
  ventilationScore: number
  insulationOn: boolean
  latitude: number
}

interface ThermalVerdict {
  /** Peak indoor °C in the worst month, very rough envelope model */
  peakIndoorC: number
  /** 0 = no heat stress, 1 = maxed out */
  stress: number
  /** Degrees above outdoor in the worst case */
  deltaC: number
}

/**
 * Rough steady-state heat-gain model.
 *
 * Q  = solar gain (through walls + windows) + conductive gain (U × A × ΔT)
 * ΔT = Q / (mass + ventilation)
 *
 * The solar gain term uses the existing wall- and window-orientation data.
 * The conductive term is read from the chosen wall / roof assembly, so
 * switching the wall to a higher-R assembly moves the peak indoor °C.
 *
 * Tuned for directional guidance — surfaces "the hot room", not a replacement for EnergyPlus.
 */
export function thermalProfile(input: ThermalInputs): ThermalVerdict {
  const { walls, plan, room, ventilationScore, insulationOn, latitude } = input
  const outdoorC = peakOutdoorC(latitude)
  const envelope = getEnvelopeFromAssemblies(plan)

  // Solar heat gain through opaque walls: sun-hours × length × SHGC × wall height (Wh)
  let wallHeatWh = 0
  for (const wall of walls) {
    const sunHours = wall.directMinutes / 60
    // wall height ≈ 2.7m default; we use 3.0 to be honest about real walls
    wallHeatWh += sunHours * wall.lengthMeters * 3.0 * 0.35
  }

  // Window heat gain: each window adds ~70 Wh per ~1.2m² pane, doubled on hot walls
  const sunBlasted: Record<Compass, boolean> = { N: false, E: false, S: true, W: true }
  let windowHeatWh = 0
  for (const compass of ['N', 'E', 'S', 'W'] as Compass[]) {
    const openings = openingsForRoomWall(plan, room.id, compass)
    const windowCount = openings.filter((o) => o.type === 'window').length
    const multiplier = sunBlasted[compass] ? 2 : 1
    windowHeatWh += windowCount * 70 * multiplier
  }

  // Conductive gain: this is what responds to the assembly choice
  const wallArea = walls.reduce((sum, w) => sum + w.lengthMeters * 3.0, 0)
  const conductiveHeatWh = envelope.wallU * wallArea * (outdoorC - 26) * 6 // ~6 sun hours

  let totalHeat = wallHeatWh + windowHeatWh + conductiveHeatWh

  // Legacy boolean still scales for back-compat with old plans
  if (insulationOn && !plan.assemblies) totalHeat *= 0.55
  // Real assembly scaling: factor 0.3 (high-R) → 1.0 (uninsulated)
  if (plan.assemblies) totalHeat *= envelope.insulationFactor

  // Thermal mass + ventilation heat removal (Wh/°C)
  const area = roomAreaFor(room, siteOf(plan))
  const mass = 80 + area * 1.5
  const vent = 40 + ventilationScore * 220
  const netMass = mass + vent

  const deltaC = totalHeat / netMass
  const peakIndoorC = outdoorC + deltaC
  const stress = Math.max(0, Math.min(1, deltaC / 10))

  return { peakIndoorC, stress, deltaC }
}
