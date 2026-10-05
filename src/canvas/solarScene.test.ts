import { describe, expect, it } from 'vitest'
import { OrthographicCamera, Vector3 } from 'three'
import { buildMassing, projectIso } from './isometric'
import { solarShadowCamera, windowSunRay } from './solarScene'
import type { PlanState } from '../types'

const plan: PlanState = {
  site: { w: 8, h: 6, unit: 1 },
  rooms: [{ id: 'r', kind: 'living', name: 'Room', x: 0, y: 0, w: 100, h: 100, wallHeight: 3 }],
  openings: [{ id: 's', type: 'window', x: 50, y: 100, rotation: 0, sillHeightM: 1, heightM: 1, widthM: 2 }],
  furniture: [], systems: { solar: false, climate: false, lighting: false, insulation: false },
}
describe('local solar scene', () => {
  it('projects both sides of a calibrated site into a finite shadow map', () => {
    for (const site of [plan.site!, { w: 80, h: 30, unit: 1 }]) {
      const s = solarShadowCamera(site)
      const camera = new OrthographicCamera(s.left, s.right, s.top, s.bottom, s.near, s.far)
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true)
      const a = new Vector3(-site.w / 2, -site.h / 2, -s.distance).project(camera)
      const b = new Vector3(site.w / 2, site.h / 2, -s.distance).project(camera)
      expect(a.x).toBeGreaterThan(-1)
      expect(b.x).toBeLessThan(1)
      expect(a.y).toBeLessThan(b.y)
    }
  })
  it('uses actual sill height to reach the floor at the expected sun angle', () => {
    const ray = windowSunRay(plan, plan.openings[0], 180, 45)!
    expect(ray.end[1]).toBeCloseTo(0.1)
    expect(ray.end[2]).toBeCloseTo(1.5)
  })
  it('does not draw incoming sunlight through a back-facing window or at night', () => {
    expect(windowSunRay(plan, plan.openings[0], 0, 45)).toBeNull()
    expect(windowSunRay(plan, plan.openings[0], 180, -5)).toBeNull()
  })
  it('stops the guide at a wall before it travels outside the room', () => {
    const ray = windowSunRay(plan, plan.openings[0], 180, 5)!
    expect(ray.end[2]).toBeCloseTo(-3)
    expect(ray.end[1]).toBeGreaterThan(0.1)
  })
})

it('the SVG fallback respects custom site scale and real room height', () => {
  const box = buildMassing(plan, 18)[0]
  expect(box.height).toBe(3)
  expect(box.top[0]).toEqual(projectIso(0, 0, 3, 18))
  expect(box.top[2]).toEqual(projectIso(8, 6, 3, 18))
})
