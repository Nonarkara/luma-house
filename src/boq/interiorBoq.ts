import type { CurrencyCode, Opening, PlanState, RegionalRateCard, Room, SiteSpec } from '../types'
import { roomAreaFor, roomHeight } from '../plan'

export interface InteriorLine {
  label: string
  quantity: number
  unit: string
  rate: number
  amount: number
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
    label: 'Shanghai / East Asia (RMB ¥)',
    ratePerM2: 2400,
    windowUnitRate: 3500,
    doorUnitRate: 2800,
    insulationM2Rate: 180,
    solarSystemRate: 28000,
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

const WET_KINDS = new Set(['bathroom', 'kitchen'])
const WET_WALL_TILE_HEIGHT = 1.5 // m of tiled wall in wet rooms

function roomPerimeterMeters(room: Room, site: SiteSpec): number {
  const w = (room.w / 100) * site.w
  const d = (room.h / 100) * site.h
  return 2 * (w + d)
}

function openingsInRoom(openings: Opening[], room: Room): Opening[] {
  const left = room.x
  const top = room.y
  const right = room.x + room.w
  const bottom = room.y + room.h
  return openings.filter((o) => {
    const onX = Math.abs(o.x - left) < 1.5 || Math.abs(o.x - right) < 1.5
    const onY = Math.abs(o.y - top) < 1.5 || Math.abs(o.y - bottom) < 1.5
    const inSpanX = o.x >= left - 1.5 && o.x <= right + 1.5
    const inSpanY = o.y >= top - 1.5 && o.y <= bottom + 1.5
    return (onX && inSpanY) || (onY && inSpanX)
  })
}

function buildRoomBoq(room: Room, openings: Opening[], site: SiteSpec): RoomInteriorBoq {
  const area = roomAreaFor(room, site)
  const perimeter = roomPerimeterMeters(room, site)
  const height = roomHeight(room)
  const isWet = WET_KINDS.has(room.kind)
  const roomOpenings = openingsInRoom(openings, room)
  const doorCount = roomOpenings.filter((o) => o.type === 'door').length
  const windowCount = roomOpenings.filter((o) => o.type === 'window').length

  const openingM2 = roomOpenings.reduce((acc, op) => {
    const w = op.widthM ?? (op.type === 'window' ? 1.6 : 0.9)
    const h = op.heightM ?? (op.type === 'window' ? 1.2 : 2.1)
    return acc + w * h
  }, 0)

  const grossWallM2 = perimeter * height
  const wallM2 = Math.max(0, grossWallM2 - openingM2)
  const wetWallTileM2 = isWet ? perimeter * WET_WALL_TILE_HEIGHT : 0
  const paintableWallM2 = Math.max(0, wallM2 - wetWallTileM2)

  const lines: InteriorLine[] = [
    {
      label: isWet ? 'Floor tiles' : 'Floor finish',
      quantity: area,
      unit: 'm²',
      rate: isWet ? BASE_RATE.floorWet : BASE_RATE.floorDry,
      amount: area * (isWet ? BASE_RATE.floorWet : BASE_RATE.floorDry),
    },
  ]

  if (paintableWallM2 > 0) {
    lines.push({ label: 'Wall paint', quantity: paintableWallM2, unit: 'm²', rate: BASE_RATE.wallPaint, amount: paintableWallM2 * BASE_RATE.wallPaint })
  }
  if (wetWallTileM2 > 0) {
    lines.push({ label: 'Wet-wall tiles', quantity: wetWallTileM2, unit: 'm²', rate: BASE_RATE.wallTileWet, amount: wetWallTileM2 * BASE_RATE.wallTileWet })
  }
  lines.push({ label: 'Ceiling paint', quantity: area, unit: 'm²', rate: BASE_RATE.ceilingPaint, amount: area * BASE_RATE.ceilingPaint })
  lines.push({ label: 'Skirting', quantity: perimeter, unit: 'lin.m', rate: BASE_RATE.skirting, amount: perimeter * BASE_RATE.skirting })
  if (doorCount > 0) lines.push({ label: 'Door sets', quantity: doorCount, unit: 'units', rate: BASE_RATE.doorSet, amount: doorCount * BASE_RATE.doorSet })
  if (windowCount > 0) lines.push({ label: 'Window sets', quantity: windowCount, unit: 'units', rate: BASE_RATE.windowSet, amount: windowCount * BASE_RATE.windowSet })

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  return {
    room,
    floorM2: area,
    wallM2,
    skirtingLinM: perimeter,
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
        existing.amount += line.amount
      } else {
        byLabel.set(line.label, { ...line })
      }
    }
  }
  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function interiorBoq(plan: PlanState, site: SiteSpec, currency: CurrencyCode = 'CNY'): InteriorBoq {
  const card = REGIONAL_RATE_CARDS[currency] ?? REGIONAL_RATE_CARDS.CNY
  const rooms = plan.rooms.map((room) => buildRoomBoq(room, plan.openings, site))
  const categories = aggregate(rooms)
  const total = categories.reduce((sum, line) => sum + line.amount, 0)
  const area = rooms.reduce((sum, r) => sum + r.floorM2, 0)
  return { rooms, categories, total, area, currency: card.code, symbol: card.symbol }
}