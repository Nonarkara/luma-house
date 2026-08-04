/**
 * Wall / roof / floor assemblies.
 *
 * The point: replace the boolean `systems.insulation: true/false` with a real
 * thermal spec the user can edit layer by layer. Every layer carries a
 * material with a known R-value-per-inch and an embodied-carbon value. The
 * assembly's total R-value and total kgCO₂e/m² are pure derived numbers — no
 * black box, no marketing.
 *
 * R-value unit: imperial (ft²·°F·h/Btu). Common in building science literature.
 *   1 ft²·°F·h/Btu = 0.176 m²·K/W
 * U-value unit: SI (W/m²·K). 1/U = total R-value × 0.176.
 *
 * Embodied carbon: kgCO₂e per m² of layer area per cm of thickness. So a 20 cm
 * concrete layer is 20 × 0.20 (carbon per m² per cm) = 4.0 kgCO₂e/m² of wall
 * surface. A wall with 3 layers and 30 cm total thickness sums those up.
 *
 * Numbers are conservative order-of-magnitude figures from ICE / Athena /
 * Bath university datasets. The label always says "concept estimate" — they
 * are not EPDs.
 */

export type AssemblyKind = 'wall' | 'roof' | 'floor'

export interface MaterialSpec {
  id: string
  label: string
  /** family group, used for icon + filtering */
  family:
    | 'concrete'
    | 'masonry'
    | 'timber'
    | 'finish'
    | 'insulation'
    | 'glazing'
    | 'metal'
    | 'earth'
    | 'air'
  /** Imperial: ft²·°F·h/Btu per inch of thickness */
  rValuePerInch: number
  /** kgCO₂e per m² of layer area per cm of thickness. 0 for passive layers. */
  embodiedCarbonKgPerM2PerCm: number
  /** THB per m² per cm of thickness. 0 for very cheap passive layers. */
  costThbPerM2PerCm: number
  /** one-line caveat about what this number assumes */
  caveat?: string
}

export interface AssemblyLayer {
  materialId: string
  thicknessMm: number
}

export interface Assembly {
  id: string
  label: string
  kind: AssemblyKind
  layers: AssemblyLayer[]
  /** free-text principle — what climate and what use this assembly fits */
  principle: string
}

export interface ResolvedAssembly {
  assembly: Assembly
  totalThicknessMm: number
  /** Imperial: ft²·°F·h/Btu for the whole assembly (sum of layer R-values) */
  totalRValue: number
  /** SI: W/m²·K — heat transfer coefficient. 1 / (R × 0.176) */
  uValue: number
  /** kgCO₂e per m² of this assembly's surface, summed across layers */
  embodiedCarbonKgPerM2: number
  /** THB per m² of this assembly's surface */
  costThbPerM2: number
}

export type ClimateResponseId =
  | 'tropical-humid'
  | 'hot-arid'
  | 'cold-temperate'
  | 'high-altitude'
  | 'temperate-mixed'

export interface ClimateResponseDefaults {
  wallAssemblyId: string
  roofAssemblyId: string
  floorAssemblyId: string
  /** Glazing spec — single-number spec for the whole house */
  glazingUValue: number
  glazingSHGC: number
  /** Recommended eave depth on the south + west, in meters */
  recommendedEaveDepthM: number
  /** Free-text ventilation recommendation */
  ventilationStrategy: string
  /** 'high' = thick masonry walls, 'low' = light timber, 'mixed' = balanced */
  massStrategy: 'high' | 'low' | 'mixed'
  /** Free-text short principle the user sees first */
  principle: string
}

export interface ClimateResponse {
  id: ClimateResponseId
  label: string
  shortLabel: string
  description: string
  /** Predicates used to auto-suggest a response for a latitude band. */
  appliesTo: (latitude: number) => boolean
  defaults: ClimateResponseDefaults
  /** Three or four design notes shown in the picker */
  designNotes: string[]
}
