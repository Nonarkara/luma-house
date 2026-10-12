import { describe, expect, it } from 'vitest'
import { houseMesh, scaleToPrint } from './houseMesh'
import { meshTo3mf } from './formats'
import { checkPrint } from './printability'
import { containsPoint } from './meshTestHelpers'
import { unionBoxes } from './unionBoxes'
import type { PlanState, Room } from '../types'
const room: Room = { id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 40, h: 40 }
const plan = (rooms = [room], openings: PlanState['openings'] = [], site = { w: 10, h: 10, unit: 1 }): PlanState => ({ rooms, openings, site, furniture: [], systems: { solar: false, insulation: false, climate: false, lighting: false } })
function assertManifold(positions: number[]) {
  const edges = new Map<string, number[]>()
  const triangles = new Set<string>()
  for (let i = 0; i < positions.length; i += 9) {
    const v = [0, 3, 6].map(offset => positions.slice(i + offset, i + offset + 3).map(n => n.toFixed(6)).join(','))
    const key = [...v].sort().join('|')
    expect(triangles.has(key), 'duplicate internal face').toBe(false); triangles.add(key)
    for (let j = 0; j < 3; j++) {
      const a = v[j], b = v[(j + 1) % 3], forward = a < b
      const key = forward ? `${a}|${b}` : `${b}|${a}`
      edges.set(key, [...(edges.get(key) ?? []), forward ? 1 : -1])
    }
  }
  for (const [key, incidences] of edges) {
    expect(incidences, `edge ${key}`).toHaveLength(2)
    expect(incidences[0] + incidences[1], `winding ${key}`).toBe(0)
  }
}
describe('SIC export regressions', () => {
  it('joins corners, lintels and overlapping openings into manifold wall surfaces', () => {
    const mesh = houseMesh(plan([room], [
      { id: 'd', type: 'door', x: 30, y: 50, rotation: 0 },
      { id: 'w', type: 'window', x: 32, y: 50, rotation: 0 },
    ]))
    mesh.parts.forEach(part => assertManifold(part.positions))
    expect(containsPoint(mesh.parts[1].positions, [3.2, 5, 1.5])).toBe(false)
    // Validate topology after print rounding too; these are the 3MF vertices.
    scaleToPrint(mesh, 200, 0.2).forEach(part => assertManifold(part.positions))
    expect(new TextDecoder().decode(meshTo3mf(mesh.parts))).toContain('<triangles>')
  })
  it('keeps a near-corner north window off the west wall', () => {
    const walls = houseMesh(plan([room], [{ id: 'w', type: 'window', x: 12, y: 10, rotation: 0, widthM: 0.4 }])).parts[1].positions
    expect(containsPoint(walls, [1, 8.85, 1.5])).toBe(true)
    expect(containsPoint(walls, [1.2, 9, 1.5])).toBe(false)
  })
  it('preserves exterior height changes along adjacent rooms', () => {
    const walls = houseMesh(plan([{ ...room, wallHeight: 2.4 }, { ...room, id: 'b', x: 50, wallHeight: 4 }])).parts[1].positions
    expect(containsPoint(walls, [2, 9, 3])).toBe(false)
    expect(containsPoint(walls, [6, 9, 3])).toBe(true)
    assertManifold(walls)
  })
  it('checks the dimensions of the actual thickened print', () => {
    const p = plan([{ ...room, x: 0, y: 0, w: 100, h: 100 }], [], { w: 50.05, h: 10, unit: 1 })
    const check = checkPrint(p, 200, 'fdm', true)
    const baseM = 0.4
    const parts = scaleToPrint(houseMesh(p, { wallM: check.printedWallMm * 0.2, baseM }), 200, baseM)
    const xs = parts.flatMap(part => part.positions.filter((_, i) => i % 3 === 0))
    expect(check.sizeMm.x).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 3)
    expect(check.sizeMm.x).toBeCloseTo(256.85, 3)
    expect(check.ok).toBe(false)
  })
  it('reports overlapping apertures as one continuous unsupported span', () => {
    const p = plan([room], [{ id: 'a', type: 'door', x: 30, y: 50, rotation: 0 }, { id: 'b', type: 'door', x: 38, y: 50, rotation: 0 }])
    expect(houseMesh(p).longestLintelM).toBeCloseTo(1.7, 6)
    expect(checkPrint(p, 100, 'fdm', true).bridgeOk).toBe(false)
  })
  it('cuts the full aperture across a wall-height transition without extending artificial seams', () => {
    const p = plan([{ ...room, wallHeight: 2.4 }, { ...room, id: 'b', x: 50, wallHeight: 4 }], [{ id: 'd', type: 'door', x: 48, y: 10, rotation: 0, widthM: 0.9 }])
    const walls = houseMesh(p).parts[1].positions
    expect(containsPoint(walls, [5.1, 9, 1])).toBe(false)
    expect(containsPoint(walls, [5, 9, 1])).toBe(true) // real perpendicular divider remains
    assertManifold(walls)
  })
  it('bounds exact-union memory rather than attempting an unbounded allocation', () => {
    const boxes = Array.from({ length: 70 }, (_, i) => [i, i, i, i + 0.5, i + 0.5, i + 0.5] as [number, number, number, number, number, number])
    expect(() => unionBoxes(boxes)).toThrow(/too many wall intersections/)
  })
})
