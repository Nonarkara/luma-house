import type { RoomKind } from '../types'

export const DRAWING_STYLE_IDS = [
  'minimalist',
  'classical',
  'fancy',
  'postmodern',
  'high-tech',
  'vernacular',
] as const

export type DrawingStyleId = (typeof DRAWING_STYLE_IDS)[number]

export interface SpatialPalette {
  background: string
  ground: string
  gridCell: string
  gridSection: string
  wall: string
  terrace: string
  furniture: string
  window: string
  door: string
  metalness: number
  roughness: number
  floors: Record<RoomKind, string>
}

export interface DrawingStyle {
  id: DrawingStyleId
  name: string
  note: string
  /** Finish-estimate keywords. The budget reads these words; the drawing does not. */
  keywords: string
  paper: string
  ink: string
  muted: string
  accent: string
  poche: string
  wallFill: string
  furniture: string
  cut: string
  roomFill: Record<RoomKind, string>
  font: string
  swatch: string
  wallMode: 'outline' | 'poche' | 'tone'
  profileWidth: number
  thinWidth: number
  hatch: boolean
  grid: boolean
  muntins: boolean
  louvers: boolean
  cornice: boolean
  /** Graphic eave past the exterior face. Zero means no eave is drawn. */
  eaveM: number
  diamond: boolean
  spatial: SpatialPalette
}

const kinds = (fill: string): Record<RoomKind, string> => ({
  living: fill,
  kitchen: fill,
  bedroom: fill,
  bathroom: fill,
  studio: fill,
  terrace: fill,
})

export const DRAWING_STYLES: DrawingStyle[] = [
  {
    id: 'minimalist',
    name: 'Minimalist',
    note: 'Hairline walls, open paper, one measured label',
    keywords: 'minimalist simple plaster',
    paper: '#f4f1ea',
    ink: '#1c1b19',
    muted: '#8a847a',
    accent: '#1c1b19',
    poche: '#1c1b19',
    wallFill: '#f4f1ea',
    furniture: '#d9d3c8',
    roomFill: kinds('#faf8f4'),
    cut: '#1c1b19',
    font: '"Source Sans 3", sans-serif',
    swatch: '#f4f1ea',
    wallMode: 'outline',
    profileWidth: 0.9,
    thinWidth: 0.45,
    hatch: false,
    grid: false,
    muntins: false,
    louvers: false,
    cornice: false,
    eaveM: 0,
    diamond: false,
    spatial: {
      background: '#e6e1d6',
      ground: '#d4cec2',
      gridCell: '#c4beb2',
      gridSection: '#b0a89a',
      wall: '#f6f3ec',
      terrace: '#c8c2b4',
      furniture: '#b7b1a6',
      window: '#c9d4d6',
      door: '#2a2926',
      metalness: 0,
      roughness: 0.96,
      floors: kinds('#efeae1'),
    },
  },
  {
    id: 'classical',
    name: 'Classical',
    note: 'Solid poché, cornice, and a cut hatch',
    keywords: 'classical marble premium stone',
    paper: '#f3ead7',
    ink: '#1a140e',
    muted: '#7a6a56',
    accent: '#6e1d22',
    poche: '#16130f',
    wallFill: '#16130f',
    furniture: '#e4d5bc',
    roomFill: kinds('#f7f1e4'),
    cut: '#6e1d22',
    font: 'Palatino, "Palatino Linotype", Georgia, serif',
    swatch: '#f3ead7',
    wallMode: 'poche',
    profileWidth: 1.15,
    thinWidth: 0.45,
    hatch: true,
    grid: false,
    muntins: false,
    louvers: false,
    cornice: true,
    eaveM: 0,
    diamond: false,
    spatial: {
      background: '#e7dcc8',
      ground: '#cfc3ad',
      gridCell: '#c0b39c',
      gridSection: '#a89880',
      wall: '#f4efe4',
      terrace: '#b7aa92',
      furniture: '#8d7b62',
      window: '#8ea6b2',
      door: '#2c241c',
      metalness: 0.04,
      roughness: 0.82,
      floors: kinds('#e6d9c2'),
    },
  },
  {
    id: 'fancy',
    name: 'Fancy',
    note: 'Ruled borders, floor diamonds, gilded muntins',
    keywords: 'fancy gold designer luxury',
    paper: '#f7f1e4',
    ink: '#2a2116',
    muted: '#8d7350',
    accent: '#8a6a2f',
    poche: '#3f3426',
    wallFill: '#c4b496',
    furniture: '#ead9b4',
    roomFill: kinds('#fbf6ec'),
    cut: '#8a6a2f',
    font: 'Palatino, "Palatino Linotype", Georgia, serif',
    swatch: '#8a6a2f',
    wallMode: 'tone',
    profileWidth: 1.2,
    thinWidth: 0.5,
    hatch: false,
    grid: false,
    muntins: true,
    louvers: false,
    cornice: true,
    eaveM: 0,
    diamond: true,
    spatial: {
      background: '#1a120c',
      ground: '#24180f',
      gridCell: '#3a2c1c',
      gridSection: '#5a4630',
      wall: '#4a3824',
      terrace: '#2c2118',
      furniture: '#c4a46a',
      window: '#f0e2c4',
      door: '#8a6a32',
      metalness: 0.38,
      roughness: 0.42,
      floors: kinds('#5c4630'),
    },
  },
  {
    id: 'postmodern',
    name: 'Postmodern',
    note: 'Flat room color, heavy outline, a loud cut',
    keywords: 'postmodern playful color',
    paper: '#f7f6f3',
    ink: '#111111',
    muted: '#5c5c5c',
    accent: '#e10600',
    poche: '#111111',
    wallFill: '#111111',
    furniture: '#111111',
    roomFill: {
      living: '#ff5a36',
      kitchen: '#f2c14e',
      bedroom: '#3d5a80',
      bathroom: '#2ec4b6',
      studio: '#c77dff',
      terrace: '#7d9b76',
    },
    cut: '#e10600',
    font: '"Source Sans 3", sans-serif',
    swatch: '#e10600',
    wallMode: 'poche',
    profileWidth: 2.4,
    thinWidth: 0.8,
    hatch: false,
    grid: false,
    muntins: false,
    louvers: false,
    cornice: false,
    eaveM: 0,
    diamond: false,
    spatial: {
      background: '#f3f3f1',
      ground: '#e4e4e0',
      gridCell: '#d0d0cc',
      gridSection: '#111111',
      wall: '#f7f7f5',
      terrace: '#d5d5d0',
      furniture: '#111111',
      window: '#7ec8ff',
      door: '#ff4d6d',
      metalness: 0.08,
      roughness: 0.38,
      floors: {
        living: '#ff5a36',
        kitchen: '#f2c14e',
        bedroom: '#3d5a80',
        bathroom: '#2ec4b6',
        studio: '#c77dff',
        terrace: '#7d9b76',
      },
    },
  },
  {
    id: 'high-tech',
    name: 'High-tech',
    note: 'Meter grid, mullions, and dimension figures',
    keywords: 'high tech steel digital',
    paper: '#101418',
    ink: '#d5e6ea',
    muted: '#6e838c',
    accent: '#7dffe1',
    poche: '#9fd6df',
    wallFill: '#101418',
    furniture: '#1c2830',
    roomFill: kinds('#182228'),
    cut: '#7dffe1',
    font: '"JetBrains Mono", ui-monospace, monospace',
    swatch: '#7dffe1',
    wallMode: 'outline',
    profileWidth: 1.05,
    thinWidth: 0.45,
    hatch: false,
    grid: true,
    muntins: true,
    louvers: false,
    cornice: false,
    eaveM: 0,
    diamond: false,
    spatial: {
      background: '#0e1418',
      ground: '#12181d',
      gridCell: '#1e2a32',
      gridSection: '#3d5562',
      wall: '#d5dee6',
      terrace: '#243038',
      furniture: '#8b98a3',
      window: '#9ff7ef',
      door: '#f4f7f8',
      metalness: 0.74,
      roughness: 0.26,
      floors: kinds('#1b242c'),
    },
  },
  {
    id: 'vernacular',
    name: 'Vernacular',
    note: 'Timber walls, louvers, and a drawn eave',
    keywords: 'vernacular timber wooden',
    paper: '#f3e6d0',
    ink: '#3a2415',
    muted: '#8a6244',
    accent: '#6b3e2e',
    poche: '#6b3e2e',
    wallFill: '#e4c8a4',
    furniture: '#e7d3b4',
    roomFill: kinds('#f8edd8'),
    cut: '#6b3e2e',
    font: '"Source Sans 3", sans-serif',
    swatch: '#6b3e2e',
    wallMode: 'tone',
    profileWidth: 1.15,
    thinWidth: 0.5,
    hatch: false,
    grid: false,
    muntins: false,
    louvers: true,
    cornice: false,
    eaveM: 0.6,
    diamond: false,
    spatial: {
      background: '#efe4d2',
      ground: '#d9c4a4',
      gridCell: '#cbb48e',
      gridSection: '#a88862',
      wall: '#efd8b4',
      terrace: '#c6b090',
      furniture: '#8d5a3a',
      window: '#6f8f78',
      door: '#6b3e2e',
      metalness: 0,
      roughness: 0.9,
      floors: kinds('#c4a574'),
    },
  },
]

const byId = new Map(DRAWING_STYLES.map((style) => [style.id, style]))

export function isDrawingStyleId(value: string | null | undefined): value is DrawingStyleId {
  return DRAWING_STYLE_IDS.some((id) => id === value)
}

export function drawingStyleById(id: DrawingStyleId): DrawingStyle {
  return byId.get(id) ?? DRAWING_STYLES[0]
}
