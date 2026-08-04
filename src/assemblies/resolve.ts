import { getMaterial } from './materials'
import { getAssemblyPreset, ASSEMBLY_PRESETS } from './presets'
import { getClimateResponse, suggestClimateResponse, CLIMATE_RESPONSES } from './responses'
import type { Assembly, AssemblyKind, ResolvedAssembly, ClimateResponseId } from './types'

const MM_PER_INCH = 25.4
const RVALUE_TO_U = 0.176 // 1 imperial R = 0.176 m²·K/W

/**
 * Resolve an assembly to its computed totals: R-value, U-value,
 * embodied carbon per m², cost per m², total thickness.
 *
 * Zero-thickness layers (vapour barriers, films) are counted in the layer
 * list but contribute nothing — they exist to communicate the design intent
 * (e.g. "poly" inside the wall).
 */
export function resolveAssembly(assembly: Assembly): ResolvedAssembly {
  let totalRValue = 0
  let totalThicknessMm = 0
  let embodiedCarbonKgPerM2 = 0
  let costThbPerM2 = 0
  for (const layer of assembly.layers) {
    if (layer.thicknessMm <= 0) continue
    const material = getMaterial(layer.materialId)
    const inches = layer.thicknessMm / MM_PER_INCH
    totalRValue += material.rValuePerInch * inches
    const cm = layer.thicknessMm / 10
    embodiedCarbonKgPerM2 += material.embodiedCarbonKgPerM2PerCm * cm
    costThbPerM2 += material.costThbPerM2PerCm * cm
    totalThicknessMm += layer.thicknessMm
  }
  const uValue = totalRValue > 0 ? 1 / (totalRValue * RVALUE_TO_U) : Number.POSITIVE_INFINITY
  return {
    assembly,
    totalThicknessMm,
    totalRValue,
    uValue,
    embodiedCarbonKgPerM2,
    costThbPerM2,
  }
}

/** Resolve every preset, keyed by id. Used by the UI to render choices. */
export function listResolvedAssemblies(kind?: AssemblyKind): ResolvedAssembly[] {
  const ids = Object.keys(ASSEMBLY_PRESETS)
  return ids
    .filter((id) => !kind || ASSEMBLY_PRESETS[id].kind === kind)
    .map((id) => resolveAssembly(getAssemblyPreset(id)))
}

export interface PlanAssemblies {
  wall: string
  roof: string
  floor: string
  /** Single glazing spec for the whole house */
  glazingUValue: number
  glazingSHGC: number
  /** Climate response that produced these defaults (for provenance) */
  climateResponseId: ClimateResponseId | null
}

export const DEFAULT_ASSEMBLIES: PlanAssemblies = {
  wall: 'wall-tropical-block',
  roof: 'roof-tile-on-air',
  floor: 'floor-concrete-slab',
  glazingUValue: 2.0,
  glazingSHGC: 0.30,
  climateResponseId: 'tropical-humid',
}

export function resolvePlanAssemblies(assemblies: PlanAssemblies) {
  return {
    wall: resolveAssembly(getAssemblyPreset(assemblies.wall)),
    roof: resolveAssembly(getAssemblyPreset(assemblies.roof)),
    floor: resolveAssembly(getAssemblyPreset(assemblies.floor)),
    glazingUValue: assemblies.glazingUValue,
    glazingSHGC: assemblies.glazingSHGC,
    climateResponseId: assemblies.climateResponseId,
  }
}

/**
 * Apply a climate response: returns a new PlanAssemblies with the defaults
 * from the chosen response. The user can then edit individual layers.
 */
export function applyClimateResponse(
  current: PlanAssemblies,
  responseId: ClimateResponseId,
): PlanAssemblies {
  const response = getClimateResponse(responseId)
  return {
    wall: response.defaults.wallAssemblyId,
    roof: response.defaults.roofAssemblyId,
    floor: response.defaults.floorAssemblyId,
    glazingUValue: response.defaults.glazingUValue,
    glazingSHGC: response.defaults.glazingSHGC,
    climateResponseId: responseId,
  }
}

export { CLIMATE_RESPONSES, getClimateResponse, suggestClimateResponse }
