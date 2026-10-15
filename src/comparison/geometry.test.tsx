import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialPlan, furnitureRectFor, siteOf } from '../plan'
import { comparisonFrame, compareRoomLayouts, furnitureChanges } from './geometry'
import { MeasuredComparison } from './MeasuredComparison'
import { roomsForOpening } from '../analysis/walls'
import type { PlanState } from '../types'

const a: PlanState = { ...initialPlan, site: { w: 10, h: 8, unit: 1 }, rooms: [{ id: 'room', name: 'Work room', kind: 'studio', x: 10, y: 10, w: 50, h: 60 }], openings: [{ id: 'window', type: 'window', x: 30, y: 10, rotation: 0, widthM: 1.6 }], furniture: [{ id: 'desk', kind: 'desk', x: 28, y: 30, rotated: false, wM: 1.8, dM: .8 }] }
describe('measured design comparison', () => {
  it('preserves physical room, opening, wall and rotated furniture coordinates across unequal sites', () => {
    const b = { ...a, site: { w: 20, h: 16, unit: 2 }, furniture: [{ ...a.furniture[0], rotated: true }] }
    const before = JSON.stringify([a, b]), f = comparisonFrame(a, b)
    expect(f.site).toEqual({ w: 20, h: 16, unit: 1 })
    expect(f.baseline).toBe(a); expect(f.proposed).toBe(b)
    expect(f.framing.rooms[0].x / 100 * f.site.w).toBe(1)
    expect(f.framing.rooms[0].w / 100 * f.site.w).toBe(5)
    expect(f.baseline.openings[0].widthM).toBe(1.6)
    const actual = furnitureRectFor(f.proposed.furniture[0], siteOf(f.proposed))
    expect(actual.w / 100 * b.site.w).toBeCloseTo(.8)
    expect(actual.h / 100 * b.site.h).toBeCloseTo(1.8)
    expect(f.framing.rooms).toHaveLength(2)
    expect(JSON.stringify([a, b])).toBe(before)
  })
  it('preserves opening association across shared fields instead of rescaling tolerance semantics', () => {
    const source: PlanState = { ...a, site: { w: 10, h: 10, unit: 1 },
      rooms: [{ ...a.rooms[0], id: 'main', w: 40, h: 40 }, { ...a.rooms[0], id: 'nearby', x: 10, y: 0, w: 20, h: 9.2 }],
      openings: [{ id: 'window', type: 'window', x: 30, y: 10, rotation: 0, widthM: 1.6 }], furniture: [] }
    const frame = comparisonFrame(source, { ...source, site: { w: 20, h: 20, unit: 1 } })
    expect(roomsForOpening(frame.baseline, source.openings[0]).map(m => `${m.room.id}/${m.compass}`)).toEqual(['main/N'])
    const svg = renderToStaticMarkup(<MeasuredComparison baseline={source} proposed={{ ...source, site: { w: 20, h: 20, unit: 1 } }} />)
    expect(svg).toContain('window 1.60 m')
    const detached = { ...source.openings[0], y: 12 }
    expect(roomsForOpening(frame.baseline, detached)).toEqual([])
  })
  it('shows real furniture changes while identifying missing/added rooms and missing window measures', () => {
    const b = { ...a, rooms: [a.rooms[0], { ...a.rooms[0], id: 'added', name: 'Added room', x: 70, w: 20 }], furniture: [{ ...a.furniture[0], y: 12 }] }
    const [matched, added] = compareRoomLayouts(a, b)
    expect(matched.baseline?.nearestWindowM).toBeGreaterThan(matched.proposed!.nearestWindowM!)
    expect(added.status).toBe('Added room'); expect(added.baseline).toBeNull()
    expect(added.proposed?.nearestWindowM).toBeNull()
    expect(compareRoomLayouts(b, a)[1].status).toBe('Removed room')
    expect(furnitureChanges(a, b)).toEqual({ added: 0, removed: 0, changed: 1 })
  })
  it('counts a physical pose unchanged even when the percentage/site representation differs', () => {
    const b = { ...a, site: { w: 20, h: 16, unit: 1 }, furniture: a.furniture.map(f => ({ ...f, x: f.x / 2, y: f.y / 2 })) }
    expect(furnitureChanges(a, b).changed).toBe(0)
    expect(furnitureChanges(a, { ...b, furniture: [] }).removed).toBe(1)
  })
  it('renders equal metre viewports with stable room numbers after reorder', () => {
    const b = { ...a, site: { ...siteOf(a), w: 20 }, rooms: [{ ...a.rooms[0], id: 'new', name: 'New room' }, ...a.rooms] }
    const svg = renderToStaticMarkup(<MeasuredComparison baseline={a} proposed={b} />)
    const viewBoxes = [...svg.matchAll(/viewBox="([^"]+)"/g)].map(m => m[1])
    expect(viewBoxes).toHaveLength(2); expect(viewBoxes[0]).toBe(viewBoxes[1])
    expect(svg).toContain('1. Work room'); expect(svg).toContain('2. New room')
    expect(svg).toContain('window 1.60 m')
  })
})
