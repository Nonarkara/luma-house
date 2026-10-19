import { openingDimensions } from '../openingGeometry'
import { openingCompassForRoom } from '../analysis/walls'
import type { CurrencyCode, Opening, PlanState, RegionalRateCard, Room, SiteSpec } from '../types'
import { FX_PER_CNY } from './currency'
import { roomHeight } from '../plan'

export interface InteriorLine {
  label: string
  /** Measured quantity, taken off at the inner wall face. */
  quantity: number
  unit: string
  rate: number
  /** Cutting and breakage allowance as a fraction (0.1 = 10%). */
  waste: number
  /** What gets bought: quantity × (1 + waste). Amount is priced on this. */
  orderQuantity: number
  amount: number
  /** How the quantity was measured, so every number can be argued with. */
  basis: string
}

export interface RoomInteriorBoq {
  room: Room
  floorM2: number
  wallM2: number
  skirtingLinM: number
  openings: number
  lines: InteriorLine[]
  subtotal: number
}

export interface InteriorBoq {
  rooms: RoomInteriorBoq[]
  /** Aggregated by category across all rooms. */
  categories: InteriorLine[]
  total: number
  area: number
  currency: CurrencyCode
  symbol: string
}

export const REGIONAL_RATE_CARDS: Record<CurrencyCode, RegionalRateCard> = {
  CNY: {
    code: 'CNY',
    symbol: '¥',
    label: 'China (RMB ¥)',
    ratePerM2: 2400,
    windowUnitRate: 3500,
    doorUnitRate: 2800,
    insulationM2Rate: 180,
    solarSystemRate: 28000,
  },
  // The Shanghai card converted at the Bank of Thailand rate (see ../boq/currency.ts).
  // A conversion of the authored specification, not a Thai market survey.
  THB: {
    code: 'THB',
    symbol: '฿',
    label: 'Thailand (THB ฿), converted from the RMB card',
    ratePerM2: Math.round(2400 * FX_PER_CNY.THB),
    windowUnitRate: Math.round(3500 * FX_PER_CNY.THB),
    doorUnitRate: Math.round(2800 * FX_PER_CNY.THB),
    insulationM2Rate: Math.round(180 * FX_PER_CNY.THB),
    solarSystemRate: Math.round(28000 * FX_PER_CNY.THB),
  },
  USD: {
    code: 'USD',
    symbol: '$',
    label: 'North America (USD $)',
    ratePerM2: 350,
    windowUnitRate: 520,
    doorUnitRate: 450,
    insulationM2Rate: 25,
    solarSystemRate: 12000,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    label: 'Western Europe (EUR €)',
    ratePerM2: 320,
    windowUnitRate: 480,
    doorUnitRate: 410,
    insulationM2Rate: 22,
    solarSystemRate: 11000,
  },
}

// Concept rates (THB baseline, scaled for regional rate cards)
const BASE_RATE = {
  floorDry: 620, // laminate / engineered wood per m²
  floorWet: 980, // tile per m² (wet rooms)
  wallPaint: 145, // paint per m² (2 coats)
  wallTileWet: 880, // tile per m² (wet-room walls, 1.5 m height)
  skirting: 240, // per linear metre
  doorSet: 8500, // internal door set, per unit
  windowSet: 12000, // window set, per unit
  ceilingPaint: 110, // ceiling paint per m²
}

/** Napkin lines are wall centrelines (same 0.15 m the 3D view draws), so
 * finishes start half a wall in from every drawn edge. */
export const WALL_THICKNESS_M = 0.15

/** Rule-of-thumb order allowances for cutting and breakage. Paint is priced
 * per m² of surface, so it carries none; counted units carry none. */
export const WASTE = {
  floorTile: 0.1,
  floorBoard: 0.08,
  wallTile: 0.1,
  skirting: 0.1,
  none: 0,
} as const

const WET_KINDS = new Set(['bathroom', 'kitchen'])
const WET_WALL_TILE_HEIGHT = 1.5 // m of tiled wall in wet rooms

/** Clear width and depth between inner wall faces. */
function innerFace(room: Room, site: SiteSpec): { w: number; d: number } {
  return {
    w: Math.max(0, (room.w / 100) * site.w - WALL_THICKNESS_M),
    d: Math.max(0, (room.h / 100) * site.h - WALL_THICKNESS_M),
  }
}

function line(label: string, quantity: number, unit: string, rate: number, waste: number, basis: string): InteriorLine {
  const orderQuantity = quantity * (1 + waste)
  return { label, quantity, unit, rate, waste, orderQuantity, amount: orderQuantity * rate, basis }
}

function openingsInRoom(openings: Opening[], room: Room, site: SiteSpec): Opening[] {
  return openings.filter(opening => openingCompassForRoom(room, opening, site) !== null)
}

function buildRoomBoq(room: Room, openings: Opening[], owned: Set<string>, site: SiteSpec): RoomInteriorBoq {
  const { w, d } = innerFace(room, site)
  const area = w * d
  const perimeter = 2 * (w + d)
  const height = roomHeight(room)
  const isWet = WET_KINDS.has(room.kind)
  // Every opening on this room's walls cuts this room's faces; a door on a
  // shared wall cuts both sides. Units are counted once, by the owning room.
  const roomOpenings = openingsInRoom(openings, room, site)
  const doors = roomOpenings.filter((o) => o.type === 'door')
  const doorWidth = doors.reduce((acc, o) => acc + (openingDimensions(o).sill <= 0 ? openingDimensions(o).width : 0), 0)
  const ownedDoors = doors.filter((o) => owned.has(o.id)).length
  const ownedWindows = roomOpenings.filter((o) => o.type === 'window' && owned.has(o.id)).length

  const openingM2 = roomOpenings.reduce((acc, op) => {
    const dims = openingDimensions(op)
    return acc + dims.width * Math.max(0, Math.min(height, dims.head) - Math.max(0, dims.sill))
  }, 0)

  const grossWallM2 = perimeter * height
  const wallM2 = Math.max(0, grossWallM2 - openingM2)
  const runLessDoors = Math.max(0, perimeter - doorWidth)
  const tileHeight = Math.min(height, WET_WALL_TILE_HEIGHT)
  const tileOpeningsM2 = roomOpenings.reduce((sum, opening) => {
    const dims = openingDimensions(opening)
    return sum + dims.width * Math.max(0, Math.min(tileHeight, dims.head) - Math.max(0, dims.sill))
  }, 0)
  const wetWallTileM2 = isWet ? Math.max(0, perimeter * tileHeight - tileOpeningsM2) : 0
  const paintableWallM2 = Math.max(0, wallM2 - wetWallTileM2)
  const faceBasis = `${w.toFixed(2)} × ${d.toFixed(2)} m to inner wall face`
  const runBasis = `${perimeter.toFixed(2)} m run − ${doorWidth.toFixed(2)} m doors`

  const lines: InteriorLine[] = [
    isWet
      ? line('Floor tiles', area, 'm²', BASE_RATE.floorWet, WASTE.floorTile, faceBasis)
      : line('Floor finish', area, 'm²', BASE_RATE.floorDry, WASTE.floorBoard, faceBasis),
  ]

  if (paintableWallM2 > 0) {
    lines.push(line('Wall paint', paintableWallM2, 'm²', BASE_RATE.wallPaint, WASTE.none,
      `${perimeter.toFixed(2)} m × ${height.toFixed(2)} m − ${openingM2.toFixed(1)} m² openings${isWet ? ' − tile band' : ''}`))
  }
  if (wetWallTileM2 > 0) {
    lines.push(line('Wet-wall tiles', wetWallTileM2, 'm²', BASE_RATE.wallTileWet, WASTE.wallTile, `${perimeter.toFixed(2)} m × ${tileHeight.toFixed(2)} m band − ${tileOpeningsM2.toFixed(2)} m² openings`))
  }
  lines.push(line('Ceiling paint', area, 'm²', BASE_RATE.ceilingPaint, WASTE.none, faceBasis))
  if (runLessDoors > 0) lines.push(line('Skirting', runLessDoors, 'lin.m', BASE_RATE.skirting, WASTE.skirting, runBasis))
  if (ownedDoors > 0) lines.push(line('Door sets', ownedDoors, 'units', BASE_RATE.doorSet, WASTE.none, `${ownedDoors} counted here, once per door`))
  if (ownedWindows > 0) lines.push(line('Window sets', ownedWindows, 'units', BASE_RATE.windowSet, WASTE.none, `${ownedWindows} counted here, once per window`))

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0)
  return {
    room,
    floorM2: area,
    wallM2,
    skirtingLinM: runLessDoors,
    openings: roomOpenings.length,
    lines,
    subtotal,
  }
}

function aggregate(rooms: RoomInteriorBoq[]): InteriorLine[] {
  const byLabel = new Map<string, InteriorLine>()
  for (const r of rooms) {
    for (const line of r.lines) {
      const existing = byLabel.get(line.label)
      if (existing) {
        existing.quantity += line.quantity
        existing.orderQuantity += line.orderQuantity
        existing.amount += line.amount
        existing.basis = 'sum of rooms'
      } else {
        byLabel.set(line.label, { ...line, basis: 'sum of rooms' })
      }
    }
  }
  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function interiorBoq(plan: PlanState, site: SiteSpec, currency: CurrencyCode = 'CNY'): InteriorBoq {
  const card = REGIONAL_RATE_CARDS[currency] ?? REGIONAL_RATE_CARDS.CNY
  // Each opening is owned by the first room (plan order) whose wall it sits on,
  // so a shared door is one door set, not one per side.
  const owned = new Map<string, Set<string>>()
  for (const opening of plan.openings) {
    const owner = plan.rooms.find((room) => openingsInRoom([opening], room, site).length > 0)
    if (!owner) continue
    if (!owned.has(owner.id)) owned.set(owner.id, new Set())
    owned.get(owner.id)!.add(opening.id)
  }
  const rooms = plan.rooms.map((room) => buildRoomBoq(room, plan.openings, owned.get(room.id) ?? new Set(), site))
  const categories = aggregate(rooms)
  const total = categories.reduce((sum, line) => sum + line.amount, 0)
  const area = rooms.reduce((sum, r) => sum + r.floorM2, 0)
  return { rooms, categories, total, area, currency: card.code, symbol: card.symbol }
}