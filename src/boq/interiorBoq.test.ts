import { describe, it, expect } from 'vitest'
import { interiorBoq } from './interiorBoq'
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

    it('costs floor finish from room area', () => {
        // A 3×4 m room on a 14×10 site: w=21.43%, h=40%.
        const plan = makePlan([{ id: 'r', name: 'Room', kind: 'living', x: 10, y: 10, w: (3 / 14) * 100, h: (4 / 10) * 100 }])
        const boq = interiorBoq(plan, site)
        const floor = boq.categories.find((c) => c.label === 'Floor finish')
        expect(floor).toBeDefined()
        expect(floor!.quantity).toBeCloseTo(12, 1) // 3×4=12 m²
        expect(floor!.amount).toBeCloseTo(12 * 620, 0)
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