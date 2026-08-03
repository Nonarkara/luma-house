export type RoomKind = 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'studio' | 'terrace'

export interface Room {
  id: string
  name: string
  kind: RoomKind
  x: number
  y: number
  w: number
  h: number
  wallHeight?: number
}

export interface Opening {
  id: string
  type: 'window' | 'door'
  x: number
  y: number
  rotation: 0 | 90
  /** Explicit width in meters (default window: 1.6m, door: 0.9m) */
  widthM?: number
  /** Explicit height in meters (default window: 1.2m, door: 2.1m) */
  heightM?: number
  /** Sill height from floor in meters (default window: 0.9m, door: 0m) */
  sillHeightM?: number
  /** Head height from floor in meters (default window: 2.1m, door: 2.1m) */
  headHeightM?: number
  /** Solar Heat Gain Coefficient (0–1; clear = 0.65, Low-E = 0.35) */
  shgc?: number
  /** Visible Light Transmittance (0–1; clear = 0.75, double Low-E = 0.65) */
  vlt?: number
  /** Operable opening fraction for natural ventilation (0–1; default 0.50) */
  operableFraction?: number
}

export type FurnitureKind = 'bed' | 'sofa' | 'dining' | 'wardrobe' | 'desk'

export interface Furniture {
  id: string
  kind: FurnitureKind
  x: number
  y: number
  rotated: boolean
}

export interface EnvelopeAssemblies {
  wallU: number // W/m²K (uninsulated ~2.1, standard ~0.85, high-R ~0.35)
  wallInsulationThicknessMm: number // 0, 50, 100, 150
  roofU: number // W/m²K (uninsulated ~1.8, insulated ~0.25)
  glazingU: number // W/m²K (single ~5.8, double clear ~2.7, triple low-e ~1.1)
  airtightnessAch50: number // ACH @ 50Pa (standard ~5.0, airtight ~1.5, Passivhaus ~0.6)
}

export interface HouseSystems {
  solar: boolean
  insulation: boolean
  climate: boolean
  lighting: boolean
  /** Extended envelope assemblies specification */
  assemblies?: EnvelopeAssemblies
}

export interface SiteSpec {
  /** Site width in meters (was a hardcoded global; now per-plan). */
  w: number
  /** Site height/depth in meters. */
  h: number
  /** Meters represented by one grid cell — the adjustable "1×1" scale. */
  unit: number
}

export interface PlanState {
  rooms: Room[]
  openings: Opening[]
  furniture: Furniture[]
  systems: HouseSystems
  /** Per-plan site + scale. Omitted on legacy plans = default 14×10, 1 m/cell. */
  site?: SiteSpec
}

export interface ABComparisonState {
  baselinePlan: PlanState
  baselineName: string
  pinnedAt: string
}

export type CurrencyCode = 'CNY' | 'USD' | 'EUR'

export interface RegionalRateCard {
  code: CurrencyCode
  symbol: string
  label: string
  ratePerM2: number
  windowUnitRate: number
  doorUnitRate: number
  insulationM2Rate: number
  solarSystemRate: number
}

export type PlanTool = 'select' | 'draw' | 'window' | 'door'
export type WorkspaceMode = 'plan' | 'light' | 'wellbeing' | 'climate' | 'systems' | 'budget'
export type CanvasView = 'plan' | 'spatial' | 'renders'
