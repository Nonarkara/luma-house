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
}

export type FurnitureKind = 'bed' | 'sofa' | 'dining' | 'wardrobe' | 'desk'

export interface Furniture {
  id: string
  kind: FurnitureKind
  x: number
  y: number
  rotated: boolean
}

export interface HouseSystems {
  solar: boolean
  insulation: boolean
  climate: boolean
  lighting: boolean
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

export type PlanTool = 'select' | 'draw' | 'window' | 'door'
export type WorkspaceMode = 'plan' | 'light' | 'wellbeing' | 'climate' | 'systems' | 'budget'
export type CanvasView = 'plan' | 'spatial' | 'renders'
