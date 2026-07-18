import { describe, expect, it } from 'vitest'
import { completeHousePlan } from '../mockups/completeHouse'
import { buildIsoBox, buildMassing, projectIso, roomHeight, sunDirectionTip } from './isometric'

describe('isometric massing', () => {
  it('projects plan meters onto an isometric plane', () => {
    const origin = projectIso(0, 0, 0, 10)
    const east = projectIso(10, 0, 0, 10)
    const south = projectIso(0, 10, 0, 10)
    expect(origin).toEqual({ x: 0, y: 0 })
    expect(east.x).toBeGreaterThan(0)
    expect(south.x).toBeLessThan(0)
    expect(east.y).toBeGreaterThan(0)
    expect(south.y).toBeGreaterThan(0)
  })

  it('extrudes rooms with terrace shorter than enclosed space', () => {
    expect(roomHeight('living')).toBeGreaterThan(roomHeight('terrace'))
    const living = buildIsoBox({ id: 'a', name: 'A', kind: 'living', x: 10, y: 10, w: 20, h: 20 })
    const terrace = buildIsoBox({ id: 'b', name: 'B', kind: 'terrace', x: 40, y: 10, w: 20, h: 20 })
    expect(living.height).toBeGreaterThan(terrace.height)
    expect(living.top[0].y).toBeLessThan(living.left[0].y)
  })

  it('builds one box per room sorted back-to-front', () => {
    const boxes = buildMassing(completeHousePlan)
    expect(boxes).toHaveLength(completeHousePlan.rooms.length)
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i].depth).toBeGreaterThanOrEqual(boxes[i - 1].depth)
    }
  })

  it('hides the sun tip when the sun is below the horizon', () => {
    expect(sunDirectionTip(180, 0)).toBeNull()
    expect(sunDirectionTip(180, 40)).not.toBeNull()
  })
})
