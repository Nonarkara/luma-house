import { describe, it, expect } from 'vitest'
import { interiorBoq, WALL_THICKNESS_M, WASTE } from './interiorBoq'
import { siteOf } from '../plan'
import type { PlanState } from '../types'
import { chinaApartmentPlan } from '../mockups/chinaApartment'

const site = siteOf(chinaApartmentPlan)

function makePlan(rooms: PlanState['rooms'], openings: PlanState['openings'] = []): PlanState {
    return { rooms, openings, furniture: [], systems: { solar: false, insulation: false, climate: false, lighting: false } }
}

describe('interiorBoq', () => {
    it('returns zero total for an empty plan', () => {
        const boq = interiorBoq(makePlan([]), site)
        expect(boq.total).toBe(0)
        expect(boq.rooms).toHaveLength(0)
        expect(boq.categories).toHaveLength(0)
    })

    it('measures floor to the inner wall face and prices the order quantity', () => {
        // A 3×4 m room drawn on wall centrelines: clear span is 2.85 × 3.85 m.
        const plan = makePlan([{ id: 'r', name: 'Room', kind: 'living', x: 10, y: 10, w: (3 / 14) * 100, h: (4 / 10) * 100 }])
        const boq = interiorBoq(plan, site)
        const floor = boq.categories.find((c) => c.label === 'Floor finish')!
        const net = (3 - WALL_THICKNESS_M) * (4 - WALL_THICKNESS_M)
        expect(floor.quantity).toBeCloseTo(net, 3)
        expect(floor.orderQuantity).toBeCloseTo(net * (1 + WASTE.floorBoard), 3)
        expect(floor.amount).toBeCloseTo(net * (1 + WASTE.floorBoard) * 620, 1)
        expect(boq.rooms[0].lines[0].basis).toContain('inner wall face')
    })

    it('counts a door on a shared wall as one door set, but cuts both faces', () => {
        // Two rooms share the wall at x=50; one door sits on it.
        const plan = makePlan(
            [
                { id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 40, h: 40 },
                { id: 'b', name: 'B', kind: 'bedroom', x: 50, y: 10, w: 40, h: 40 },
            ],
            [{ id: 'd', type: 'door', x: 50, y: 30, rotation: 90 }],
        )
        const boq = interiorBoq(plan, site)
        expect(boq.categories.find((c) => c.label === 'Door sets')!.quantity).toBe(1)
        // Both rooms lose the door width from skirting.
        const solo = interiorBoq(makePlan([plan.rooms[1]]), site).rooms[0].skirtingLinM
        expect(boq.rooms[1].skirtingLinM).toBeLessThan(solo)
    })

    it('conserves opening units: BOQ door and window sets equal openings on room walls', () => {
        const boq = interiorBoq(chinaApartmentPlan, site)
        const units = (label: string) => boq.categories.find((c) => c.label === label)?.quantity ?? 0
        const onWalls = (type: 'door' | 'window') => chinaApartmentPlan.openings.filter((o) => o.type === type && boq.rooms.some((r) =>
            o.x >= r.room.x - 1.5 && o.x <= r.room.x + r.room.w + 1.5 && o.y >= r.room.y - 1.5 && o.y <= r.room.y + r.room.h + 1.5)).length
        expect(units('Door sets')).toBe(onWalls('door'))
        expect(units('Window sets')).toBe(onWalls('window'))
    })

    it('uses wet rates for bathroom and kitchen floors', () => {
        const plan = makePlan([
            { id: 'b', name: 'Bath', kind: 'bathroom', x: 10, y: 10, w: (2 / 14) * 100, h: (2.5 / 10) * 100 },
        ])
        const boq = interiorBoq(plan, site)
        const tiles = boq.categories.find((c) => c.label === 'Floor tiles')
        expect(tiles).toBeDefined()
        expect(tiles!.rate).toBe(980)
        expect(boq.categories.some((c) => c.label === 'Wet-wall tiles')).toBe(true)
    })

    it('costs doors and windows per opening', () => {
        const plan = makePlan(
            [{ id: 'r', name: 'Room', kind: 'living', x: 10, y: 10, w: 40, h: 40 }],
            [
                { id: 'd1', type: 'door', x: 10, y: 30, rotation: 90 },
                { id: 'w1', type: 'window', x: 50, y: 30, rotation: 90 },
            ],
        )
        const boq = interiorBoq(plan, site)
        const doors = boq.categories.find((c) => c.label === 'Door sets')
        const windows = boq.categories.find((c) => c.label === 'Window sets')
        expect(doors!.quantity).toBe(1)
        expect(doors!.amount).toBe(8500)
        expect(windows!.quantity).toBe(1)
        expect(windows!.amount).toBe(12000)
    })

    it('nets windows only from the wet band they intersect and clips it to wall height', () => {
        const room = { id: 'b', name: 'Bath', kind: 'bathroom' as const, x: 10, y: 10, w: 40, h: 40, wallHeight: 1.2 }
        const opening = { id: 'w', type: 'window' as const, x: 30, y: 10, rotation: 0 as const, widthM: 1, sillHeightM: 0.9, heightM: 1.2 }
        const baseline = interiorBoq(makePlan([room]), site).rooms[0]
        const withWindow = interiorBoq(makePlan([room], [opening]), site).rooms[0]
        const tiles = (r: typeof baseline) => r.lines.find(line => line.label === 'Wet-wall tiles')!.quantity
        expect(tiles(baseline) - tiles(withWindow)).toBeCloseTo(0.3, 6)
        expect(tiles(withWindow)).toBeCloseTo(withWindow.wallM2, 6)
        expect(withWindow.lines.some(line => line.label === 'Wall paint')).toBe(false)
    })

    it('does not subtract an opening from a perpendicular wall near a corner', () => {
        const a = { id: 'a', name: 'A', kind: 'living' as const, x: 10, y: 10, w: 40, h: 40 }
        const b = { ...a, id: 'b', x: 50 }
        const op = { id: 'w', type: 'window' as const, x: 49, y: 10, rotation: 0 as const, widthM: 0.2 }
        const base = interiorBoq(makePlan([a, b]), site)
        const cut = interiorBoq(makePlan([a, b], [op]), site)
        expect(cut.rooms[1].wallM2).toBe(base.rooms[1].wallM2)
        expect(cut.rooms[0].wallM2).toBeLessThan(base.rooms[0].wallM2)
    })

    it('subtotal equals sum of category amounts', () => {
        const boq = interiorBoq(chinaApartmentPlan, site)
        const sum = boq.categories.reduce((s, c) => s + c.amount, 0)
        expect(boq.total).toBeCloseTo(sum, 2)
        expect(boq.rooms.length).toBe(chinaApartmentPlan.rooms.length)
    })

    it('scales quantities with site dimensions', () => {
        const room = [{ id: 'r', name: 'Room', kind: 'living' as const, x: 0, y: 0, w: 50, h: 50 }]
        const small = interiorBoq(makePlan(room), { w: 8, h: 6, unit: 1 })
        const large = interiorBoq(makePlan(room), { w: 16, h: 12, unit: 1 })
        // Doubling each site dimension quadruples floor area; skirting doubles;
        // door/window costs are fixed. Total grows between 2× and 4×.
        expect(large.rooms[0].floorM2).toBeGreaterThan(small.rooms[0].floorM2 * 3.9)
        expect(large.total).toBeGreaterThan(small.total * 2)
        expect(large.total).toBeLessThan(small.total * 5)
    })
})