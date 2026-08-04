import { getAssemblyPreset } from './presets'
import { resolveAssembly, type PlanAssemblies } from './resolve'
import type { PlanState } from '../types'

/**
 * Effective envelope numbers derived from the layered assemblies.
 *
 * `thermal.ts` and `heatFlow.ts` use these for the real envelope math.
 * When `plan.assemblies` is absent (legacy localStorage save) the defaults
 * are used so the system still runs.
 */
export interface EnvelopeFromAssemblies {
  wallU: number
  wallRValue: number
  roofU: number
  roofRValue: number
  floorU: number
  floorRValue: number
  glazingU: number
  glazingSHGC: number
  /** Embodied carbon (kgCO₂e) summed across wall + roof + floor per m² of floor plan */
  embodiedCarbonKgPerM2Floor: number
  /** Insulation factor: 0.3 (very insulated) → 1.0 (uninsulated). For the rough thermal model. */
  insulationFactor: number
}

function safeResolve(id: string) {
  try {
    return resolveAssembly(getAssemblyPreset(id))
  } catch {
    return null
  }
}

function rToFactor(u: number): number {
  // Map U-value 0.2 → 0.3, 0.5 → 0.5, 1.0 → 0.7, 2.0 → 1.0
  if (u <= 0.2) return 0.3
  if (u <= 0.5) return 0.3 + ((0.5 - u) / 0.3) * 0.2
  if (u <= 1.0) return 0.5 + ((1.0 - u) / 0.5) * 0.2
  if (u <= 2.0) return 0.7 + ((2.0 - u) / 1.0) * 0.3
  return 1.0
}

export function getEnvelopeFromAssemblies(plan: PlanState): EnvelopeFromAssemblies {
  // Legacy plans (no `assemblies` field) fall back to the boolean insulation
  // signal. New plans use the layered assembly U-values.
  if (!plan.assemblies) {
    const insulated = plan.systems?.insulation
    const wallU = insulated ? 0.45 : 2.1
    const roofU = insulated ? 0.25 : 1.8
    return {
      wallU,
      wallRValue: wallU > 0 ? 1 / (wallU * 0.176) : 0,
      roofU,
      roofRValue: roofU > 0 ? 1 / (roofU * 0.176) : 0,
      floorU: 1.5,
      floorRValue: 1 / (1.5 * 0.176),
      glazingU: insulated ? 1.4 : 2.7,
      glazingSHGC: insulated ? 0.35 : 0.65,
      embodiedCarbonKgPerM2Floor: 0,
      insulationFactor: rToFactor(wallU),
    }
  }
  const a: PlanAssemblies = plan.assemblies
  const wall = safeResolve(a.wall)
  const roof = safeResolve(a.roof)
  const floor = safeResolve(a.floor)
  const wallU = wall?.uValue ?? 2.0
  const roofU = roof?.uValue ?? 1.8
  const floorU = floor?.uValue ?? 1.5
  const carbon = (wall?.embodiedCarbonKgPerM2 ?? 0) + (roof?.embodiedCarbonKgPerM2 ?? 0) + (floor?.embodiedCarbonKgPerM2 ?? 0)
  return {
    wallU,
    wallRValue: wall?.totalRValue ?? 0,
    roofU,
    roofRValue: roof?.totalRValue ?? 0,
    floorU,
    floorRValue: floor?.totalRValue ?? 0,
    glazingU: a.glazingUValue,
    glazingSHGC: a.glazingSHGC,
    embodiedCarbonKgPerM2Floor: carbon,
    insulationFactor: rToFactor(wallU),
  }
}

