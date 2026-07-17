export type RoomKind = 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'studio' | 'terrace'

export interface Room {
  id: string
  name: string
  kind: RoomKind
  x: number
  y: number
  w: number
  h: number
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

export interface PlanState {
  rooms: Room[]
  openings: Opening[]
  furniture: Furniture[]
  systems: HouseSystems
}

export type PlanTool = 'select' | 'draw' | 'window' | 'door'
export type WorkspaceMode = 'plan' | 'light' | 'climate' | 'systems' | 'budget'
export type CanvasView = 'plan' | 'spatial' | 'renders'
