import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialPlan } from '../plan'
import type { PlanState, ProjectLocation } from '../types'
import { PlanDrawing, SectionDrawing } from './StudySheet'
import { dimensionStops, groundShadows, planWallCuts, seasonalSun, studyWalls, type SeasonalSun } from './graphics'

const room = { id: 'r', name: 'Room', kind: 'living' as const, x: 10, y: 10, w: 40, h: 40, wallHeight: 3 }
const plan: PlanState = { ...initialPlan, site: { w: 10, h: 10, unit: 1 }, rooms: [room], furniture: [], openings: [] }
const city = (latitude: number, longitude = 0, timezone = 'UTC'): ProjectLocation => ({ name: 'Test city', label: 'Test city', latitude, longitude, timezone })

describe('measured architectural graphics', () => {
  it('draws 150 mm physical walls and leaves an actual door gap at the plan cut', () => {
    const door = { id: 'door', type: 'door' as const, x: 30, y: 10, rotation: 0 as const, widthM: 1 }
    const parts = planWallCuts({ ...plan, openings: [door] })
    const north = parts.filter(p => p.position[2] === -4)
    expect(north).toHaveLength(2)
    expect(north.map(p => p.size[2])).toEqual([.15, .15])
    expect(north.reduce((sum, p) => sum + p.size[0], 0)).toBeCloseTo(3)
    expect(planWallCuts({ ...plan, rooms: [{ ...room, wallHeight: .8 }] })).toHaveLength(4)
  })
  it('keeps wall material for an orphan marker instead of punching a fake hole', () => {
    const orphan = { id: 'off-wall', type: 'door' as const, x: 70, y: 70, rotation: 0 as const }
    expect(planWallCuts({ ...plan, openings: [orphan] })).toEqual(planWallCuts(plan))
    const svg = renderToStaticMarkup(<PlanDrawing plan={{ ...plan, openings: [orphan] }} scale={100} sectionDepth={3} />)
    expect(svg).not.toContain('indicative swing')
  })
  it('dimensions calibrated centreline geometry and preserves millimetre scale margins', () => {
    expect(dimensionStops(plan, 'x')).toEqual([1, 5])
    expect(dimensionStops({ ...plan, site: { w: 20, h: 5, unit: 1 } }, 'x')).toEqual([2, 10])
    const svg = renderToStaticMarkup(<PlanDrawing plan={plan} scale={200} sectionDepth={3} />)
    expect(svg).toContain('width="144mm"')
    expect(svg).toContain('Graphic scale, 5 metres')
    expect(svg).toContain('4.00 m')
    expect(svg).toContain('4.00 × 4.00 m · H 3.00')
  })
  it('labels swing assumptions and finished-floor levels without inventing material hatches', () => {
    const svg = renderToStaticMarkup(<PlanDrawing plan={{ ...plan, openings: [{ id: 'd', type: 'door', x: 30, y: 10, rotation: 0 }] }} scale={200} sectionDepth={3} />)
    expect(svg).toContain('indicative swing; hinge not specified')
    const section = renderToStaticMarkup(<SectionDrawing plan={plan} scale={200} depth={3} />)
    expect(section).toContain('+3.00 m')
    expect(section).toContain('±0.00')
    expect(section).toContain('looking south')
  })
  it('subtracts the union of overlapping openings at every vertical band', () => {
    const overlap: PlanState = { ...plan, openings: [
      { id: 'w', type: 'window', x: 28, y: 10, rotation: 0, widthM: 1.6, sillHeightM: 1.5, heightM: 1 },
      { id: 'd', type: 'door', x: 33, y: 10, rotation: 0, widthM: 1, heightM: 2.1 },
    ] }
    const north = studyWalls(overlap).filter(p => p.position[2] === -4)
    const contains = (x: number, y: number) => north.some(p => x > p.position[0] - p.size[0] / 2 && x < p.position[0] + p.size[0] / 2 && y > p.position[1] - p.size[1] / 2 && y < p.position[1] + p.size[1] / 2)
    expect(contains(-1.9, 1.3)).toBe(false) // door wins over window sill
    expect(contains(-1.9, 2.4)).toBe(false) // window wins over door lintel
    expect(contains(-1.9, 2.8)).toBe(true) // real solid above both apertures
    const sun: SeasonalSun = { date: '2026-06-21', day: 172, altitude: 45, bearing: 0, vector: { x: 0, y: Math.SQRT1_2, z: -Math.SQRT1_2 } }
    const covered = groundShadows(studyWalls(overlap), sun).some(polygon => {
      const signs = polygon.map((a, i) => { const b = polygon[(i + 1) % polygon.length]; return (b.x - a.x) * (-3.7 - a.z) - (b.z - a.z) * (-1.9 - a.x) })
      return signs.every(s => s >= 0) || signs.every(s => s <= 0)
    })
    expect(covered).toBe(false)
  })
})

describe('analytic city solar drawings', () => {
  it('uses real city sun positions, the selected year, and hemisphere-dependent seasons', () => {
    const north = seasonalSun(city(51.5, -.12, 'Europe/London'), 2024, 12)
    const south = seasonalSun(city(-33.9, 18.4, 'Africa/Johannesburg'), 2024, 12)
    expect(north.map(s => s.date)).toEqual(['2024-06-21', '2024-12-21'])
    expect(north.map(s => s.day)).toEqual([173, 356])
    expect(north[0].altitude).toBeGreaterThan(north[1].altitude)
    expect(south[1].altitude).toBeGreaterThan(south[0].altitude)
    for (const s of [...north, ...south]) {
      expect(Math.hypot(s.vector.x, s.vector.y, s.vector.z)).toBeCloseTo(1)
      expect(s.altitude).toBeGreaterThan(-90); expect(s.altitude).toBeLessThanOrEqual(90)
      expect(s.vector.y).toBeCloseTo(Math.sin(s.altitude * Math.PI / 180))
      expect(s.vector.x).toBeCloseTo(Math.sin(s.bearing * Math.PI / 180) * Math.cos(s.altitude * Math.PI / 180))
    }
    expect(south[0].altitude).toBeGreaterThan(30); expect(south[0].altitude).toBeLessThan(35)
    expect(south[1].altitude).toBeGreaterThan(70)
  })
  it('casts the cuboid away from the sun with the measured height-to-shadow ratio', () => {
    const sun: SeasonalSun = { date: '2026-06-21', day: 172, altitude: 45, bearing: 90, vector: { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 } }
    const [p] = groundShadows([{ key: 'wall', position: [0, 1.5, 0], size: [.15, 3, 4] }], sun)
    expect(Math.min(...p.map(q => q.x))).toBeCloseTo(-3.075)
    expect(Math.max(...p.map(q => q.x))).toBeCloseTo(.075)
    expect(Math.min(...p.map(q => q.z))).toBe(-2)
    expect(Math.max(...p.map(q => q.z))).toBe(2)
    expect(groundShadows(studyWalls(plan), { ...sun, altitude: -2, vector: { x: 1, y: -.1, z: 0 } })).toEqual([])
  })
  it('retains full-height opening holes and finite low-sun shadows', () => {
    const open: PlanState = { ...plan, openings: [{ id: 'full-door', type: 'door', x: 30, y: 10, rotation: 0, widthM: 1, heightM: 3 }] }
    const sun: SeasonalSun = { date: '2026-06-21', day: 172, altitude: 90, bearing: 0, vector: { x: 0, y: 1, z: 0 } }
    const north = studyWalls(open).filter(p => p.position[2] === -4)
    expect(north).toHaveLength(2)
    for (const p of groundShadows(north, sun)) {
      expect(p.every(q => q.x <= -2.5 || q.x >= -1.5)).toBe(true)
    }
    const low = seasonalSun(city(67), 2026, 10)[0]
    expect(groundShadows(studyWalls(plan), low).flat().every(p => Number.isFinite(p.x) && Number.isFinite(p.z))).toBe(true)
  })
})
