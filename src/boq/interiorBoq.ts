import type { Opening, PlanState, Room, SiteSpec } from '../types'
import { roomAreaFor, roomHeight } from '../plan'

/**
 * Per-room interior fit-out BOQ.
 *
 * Quantities are driven by each room's geometry and wall height so that
 * paints, tiles, skirting, and windows are costed from the size of the
 * rooms — the explicit ask. Rates are concept-level (THB) and transparent;
 * a real BOQ is priced from local supplier quotes.
 */

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
}

// Concept rates (THB). Order-of-magnitude; replace with supplier quotes.
const RATE = {
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
        // An opening belongs to a room if it sits on one of its wall edges.
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

    // Net wall area minus openings (approx 1.9 m² door, 1.5 m² window).
    const openingM2 = doorCount * 1.9 + windowCount * 1.5
    const grossWallM2 = perimeter * height
    const wallM2 = Math.max(0, grossWallM2 - openingM2)
    const wetWallTileM2 = isWet ? perimeter * WET_WALL_TILE_HEIGHT : 0
    const paintableWallM2 = Math.max(0, wallM2 - wetWallTileM2)

    const lines: InteriorLine[] = [
        {
            label: isWet ? 'Floor tiles' : 'Floor finish',
            quantity: area,
            unit: 'm²',
            rate: isWet ? RATE.floorWet : RATE.floorDry,
            amount: area * (isWet ? RATE.floorWet : RATE.floorDry),
        },
    ]

    if (paintableWallM2 > 0) {
        lines.push({ label: 'Wall paint', quantity: paintableWallM2, unit: 'm²', rate: RATE.wallPaint, amount: paintableWallM2 * RATE.wallPaint })
    }
    if (wetWallTileM2 > 0) {
        lines.push({ label: 'Wet-wall tiles', quantity: wetWallTileM2, unit: 'm²', rate: RATE.wallTileWet, amount: wetWallTileM2 * RATE.wallTileWet })
    }
    lines.push({ label: 'Ceiling paint', quantity: area, unit: 'm²', rate: RATE.ceilingPaint, amount: area * RATE.ceilingPaint })
    lines.push({ label: 'Skirting', quantity: perimeter, unit: 'lin.m', rate: RATE.skirting, amount: perimeter * RATE.skirting })
    if (doorCount > 0) lines.push({ label: 'Door sets', quantity: doorCount, unit: 'units', rate: RATE.doorSet, amount: doorCount * RATE.doorSet })
    if (windowCount > 0) lines.push({ label: 'Window sets', quantity: windowCount, unit: 'units', rate: RATE.windowSet, amount: windowCount * RATE.windowSet })

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
    // Stable order by label.
    return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function interiorBoq(plan: PlanState, site: SiteSpec): InteriorBoq {
    const rooms = plan.rooms.map((room) => buildRoomBoq(room, plan.openings, site))
    const categories = aggregate(rooms)
    const total = categories.reduce((sum, line) => sum + line.amount, 0)
    const area = rooms.reduce((sum, r) => sum + r.floorM2, 0)
    return { rooms, categories, total, area }
}