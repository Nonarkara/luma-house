import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { initialPlan, siteOf } from '../plan'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { starterLocations } from '../location/locations'
import { decodePlanFromHash, encodePlanToHash } from '../sharePlan'
import { cutPart, drawingCamera, geometryFingerprint, modelBounds, physicalGeometryKey, sheetScale, wallParts } from './geometry'
import { sanitizeStudyScenes } from './scenes'
import type { StudyScene } from './types'

const frame = drawingCamera(initialPlan, 'axonometric', 1.6)
const scene: StudyScene = {
  id: 'saved-view', name: 'Morning', capturedAt: '2026-10-06T00:00:00Z', geometryKey: geometryFingerprint(initialPlan),
  location: starterLocations[0], year: 2026, day: 355, hour: 9,
  camera: { projection: 'orthographic', position: frame.camera.position.toArray() as [number, number, number], target: frame.target, up: [0, 1, 0], zoom: 1, fov: 45, fieldHeight: frame.camera.top - frame.camera.bottom },
  settings: { preset: 'axonometric', style: 'architectural', sectionHeight: 1.4, roofStyle: 'flat', showRoof: false, shadows: true, sunRays: true, airPaths: false },
}
describe('architectural study geometry', () => {
  it('keeps projected lengths constant at different depths', () => {
    const c = frame.camera, shift = c.getWorldDirection(new Vector3()).multiplyScalar(4)
    const span = (offset: Vector3) => new Vector3(1, 0, 0).add(offset).project(c).distanceTo(new Vector3().add(offset).project(c))
    expect(span(new Vector3())).toBeCloseTo(span(shift), 12)
    expect(c.isOrthographicCamera).toBe(true)
  })
  it.each([0.45, 1.6])('fits all building corners at aspect %s and keeps north up', aspect => {
    for (const preset of ['topdown', 'axonometric'] as const) {
      const { camera } = drawingCamera(initialPlan, preset, aspect), box = modelBounds(initialPlan)
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = new Vector3(x, y, z).project(camera)
        expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1)
      }
      if (preset === 'topdown') expect(new Vector3(0, 0, -1).project(camera).y).toBeGreaterThan(new Vector3().project(camera).y)
    }
  })
  it('fills only actual wall intersections without changing physical wall pieces', () => {
    const room = chinaApartmentPlan.rooms.find(r => r.kind === 'living')!
    const parts = wallParts(room, 'S', chinaApartmentPlan), before = JSON.stringify(parts)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.map(p => cutPart(p, 1.4)).some(p => p.capped)).toBe(true)
    expect(parts.map(p => cutPart(p, 1.4)).some(p => p.height === 0)).toBe(true)
    expect(JSON.stringify(parts)).toBe(before)
  })
  it('excludes saved views and city from the shadow cache identity but includes openings', () => {
    const same = { ...initialPlan, studyScenes: [scene], location: starterLocations[1] }
    expect(physicalGeometryKey(same)).toBe(physicalGeometryKey(initialPlan))
    expect(physicalGeometryKey({ ...initialPlan, openings: [] })).not.toBe(physicalGeometryKey(initialPlan))
  })
  it('fits the plan into the paper frame at a standard physical scale', () => {
    const site = siteOf(initialPlan), scale = sheetScale(site)
    expect(site.w * 1000 / scale).toBeLessThanOrEqual(128)
    expect(site.h * 1000 / scale).toBeLessThanOrEqual(76)
    expect(1 * 1000 / 100).toBe(10) // one metre prints as 10 mm at 1:100
  })
})
describe('saved study views at import boundaries', () => {
  it('shares city, civil date, view style and full camera pose without preview bytes', () => {
    const payload = encodePlanToHash({ ...initialPlan, studyScenes: [scene] })
    expect(decodePlanFromHash('#plan=' + payload)?.studyScenes).toEqual([scene])
    expect(payload.length).toBeLessThan(15000)
  })
  it('drops invalid cameras, impossible civil dates and unsafe external preview data', () => {
    expect(sanitizeStudyScenes([{ ...scene, camera: { ...scene.camera, position: [Infinity, 0, 0] } }, { ...scene, day: 366 }])).toBeUndefined()
    expect(sanitizeStudyScenes([{ ...scene, preview: 'https://tracking.invalid/image.svg' }])).toEqual([scene])
    expect(sanitizeStudyScenes([{ ...scene, location: { ...scene.location, timezone: 'invalid' } }])).toBeUndefined()
  })
  it('bounds collections and rejects duplicate identifiers', () => {
    const values = Array.from({ length: 12 }, (_, i) => ({ ...scene, id: `view-${i}` }))
    expect(sanitizeStudyScenes(values)).toHaveLength(6)
    expect(sanitizeStudyScenes([scene, scene])).toHaveLength(1)
  })
})
