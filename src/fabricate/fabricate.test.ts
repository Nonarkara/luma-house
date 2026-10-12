import { describe, expect, it } from 'vitest'
import { containsPoint } from './meshTestHelpers'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import type { PlanState } from '../types'
import { meshTo3mf, meshToBinaryStl, meshToGlb, triangleNormal } from './formats'
import { houseMesh, pushBox, scaleToPrint, wallRuns } from './houseMesh'
import { checkPrint, recommendScale } from './printability'

const site = { w: 10, h: 10, unit: 1 }
const systems = { solar: false, insulation: false, climate: false, lighting: false }
const plan = (rooms: PlanState['rooms'], openings: PlanState['openings'] = []): PlanState => ({ site, rooms, openings, furniture: [], systems })


describe('house mesh', () => {
  it('writes closed boxes whose faces all point outward', () => {
    const out: number[] = []
    pushBox(out, 0, 0, 0, 2, 1, 3)
    expect(out.length).toBe(12 * 9)
    for (let t = 0; t < 12; t += 1) {
      const n = triangleNormal(out, t * 9)
      const c = [0, 1, 2].map((k) => (out[t * 9 + k] + out[t * 9 + 3 + k] + out[t * 9 + 6 + k]) / 3 - [1, 0.5, 1.5][k])
      expect(n[0] * c[0] + n[1] * c[1] + n[2] * c[2]).toBeGreaterThan(0)
    }
  })

  it('builds a wall two rooms share once', () => {
    const runs = wallRuns(plan([
      { id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 40, h: 40 },
      { id: 'b', name: 'B', kind: 'bedroom', x: 50, y: 10, w: 40, h: 40 },
    ]))
    expect(runs).toHaveLength(5) // merged top, merged bottom, three verticals
  })

  it('cuts a real hole where a door is, and keeps a lintel above it', () => {
    const mesh = houseMesh(plan(
      [{ id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 40, h: 40 }],
      [{ id: 'd', type: 'door', x: 30, y: 50, rotation: 0 }],
    ))
    const walls = mesh.parts[1].positions
    // Door centre at x = 3 m on the south wall (plan y 50% → model y 5 m).
    expect(containsPoint(walls, [3, 5, 1.0])).toBe(false)
    expect(containsPoint(walls, [3, 5, 2.4])).toBe(true)
    expect(containsPoint(walls, [1.5, 5, 1.0])).toBe(true)
    expect(mesh.longestLintelM).toBeCloseTo(0.9, 6)
  })

  it('scales to millimetres at 1:100 with the base at z = 0', () => {
    const mesh = houseMesh(plan([{ id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 40, h: 40 }]), { baseM: 0.2 })
    const parts = scaleToPrint(mesh, 100, 0.2)
    const zs = parts.flatMap((p) => p.positions.filter((_, i) => i % 3 === 2))
    expect(Math.min(...zs)).toBeCloseTo(0, 6)
    expect(Math.max(...zs)).toBeCloseTo(29, 6) // 2 mm base + 2.7 m wall → 27 mm
  })
})

describe('mesh formats', () => {
  const parts = houseMesh(chinaApartmentPlan).parts

  it('writes a binary STL whose header counts every triangle', () => {
    const stl = meshToBinaryStl(parts)
    const triangles = parts.reduce((s, p) => s + p.positions.length / 9, 0)
    expect(new DataView(stl.buffer).getUint32(80, true)).toBe(triangles)
    expect(stl.length).toBe(84 + triangles * 50)
  })

  it('writes a 3MF zip in millimetres', () => {
    const file = meshTo3mf(parts)
    expect([file[0], file[1]]).toEqual([0x50, 0x4b])
    const text = new TextDecoder().decode(file)
    expect(text).toContain('3D/3dmodel.model')
    expect(text).toContain('unit="millimeter"')
  })

  it('writes a GLB whose header length matches and whose JSON parses', () => {
    const glb = meshToGlb(parts)
    const view = new DataView(glb.buffer)
    expect(view.getUint32(0, true)).toBe(0x46546c67)
    expect(view.getUint32(8, true)).toBe(glb.length)
    const jsonLength = view.getUint32(12, true)
    const gltf = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + jsonLength)))
    expect(gltf.meshes).toHaveLength(2)
    expect(gltf.accessors[2].count).toBe(parts[1].positions.length / 3)
  })
})

describe('printability (text-to-cad DfAM limits)', () => {
  it('flags 0.15 m walls at 1:100 on a filament printer, and passes when thickened', () => {
    const raw = checkPrint(chinaApartmentPlan, 100, 'fdm', false)
    expect(raw.wallMm).toBeCloseTo(1.5, 6)
    expect(raw.wallOk).toBe(false)
    const thick = checkPrint(chinaApartmentPlan, 100, 'fdm', true)
    expect(thick.printedWallMm).toBe(1.6)
    expect(thick.wallOk).toBe(true)
  })

  it('flags a 1.6 m window lintel at 1:100 as a bridge over the 10 mm FDM limit', () => {
    const c = checkPrint(plan([{ id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 40, h: 40 }], [{ id: 'w', type: 'window', x: 30, y: 10, rotation: 0 }]), 100, 'fdm', true)
    expect(c.bridgeMm).toBeCloseTo(16, 6)
    expect(c.bridgeOk).toBe(false)
  })

  it('recommends the biggest model that fits the plate; long lintels only ask for supports', () => {
    const rec = recommendScale(chinaApartmentPlan, 'fdm', true)!
    expect(rec.denominator).toBe(50) // 198 × 137 mm on a 256 mm plate
    expect(rec.fits).toBe(true)
    expect(rec.bridgeOk).toBe(false) // 1.6 m windows → 32 mm lintels: supports on
    expect(rec.ok).toBe(true)
    // Without thickening, walls stay true to scale and 1:100+ would fail; 1:50 still holds at 3 mm.
    expect(recommendScale(chinaApartmentPlan, 'fdm', false)!.denominator).toBe(50)
  })
})
