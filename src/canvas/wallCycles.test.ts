import { describe, expect, it } from 'vitest'
import { cornerSnapPercent, resolveSketchWalls, type AxisSeg } from './wallCycles'

function at(mx: number, my: number, site = { w: 14, h: 10 }): { x: number; y: number } {
  return { x: (mx / site.w) * 100, y: (my / site.h) * 100 }
}

function loop(over: number): AxisSeg[] {
  const x1 = 4
  const x2 = 9
  const y1 = 3
  const y2 = 7
  const a = at(x1 - over, y1)
  const b = at(x2 + over, y1)
  const c = at(x2, y1 - over)
  const d = at(x2, y2 + over)
  const e = at(x2 + over, y2)
  const f = at(x1 - over, y2)
  const g = at(x1, y2 + over)
  const h = at(x1, y1 - over)
  return [
    { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
    { x1: c.x, y1: c.y, x2: d.x, y2: d.y },
    { x1: e.x, y1: e.y, x2: f.x, y2: f.y },
    { x1: g.x, y1: g.y, x2: h.x, y2: h.y },
  ]
}

describe('resolveSketchWalls', () => {
  it.each([0.5, 0.7])('keeps a single face when corners overshoot by %s m', (over) => {
    const snap = cornerSnapPercent(640)
    const { rooms, segments } = resolveSketchWalls(loop(over), snap, snap)
    expect(rooms).toHaveLength(1)
    const area = (rooms[0].w / 100) * 14 * (rooms[0].h / 100) * 10
    expect(area).toBeGreaterThan(18)
    expect(area).toBeLessThan(28)
    expect(segments.every((seg) => seg.x2 - seg.x1 < rooms[0].w + 0.5 && seg.y2 - seg.y1 < rooms[0].h + 0.5)).toBe(true)
  })

  it('joins a corner gap inside the pixel snap and refuses a wider one', () => {
    const gap = (metres: number): AxisSeg[] => {
      const top = [at(4, 3), at(8, 3)]
      const right = [at(8 + metres, 3), at(8 + metres, 6)]
      const bottom = [at(8, 6), at(4, 6)]
      const left = [at(4, 6), at(4, 3)]
      return [
        { x1: top[0].x, y1: top[0].y, x2: top[1].x, y2: top[1].y },
        { x1: right[0].x, y1: right[0].y, x2: right[1].x, y2: right[1].y },
        { x1: bottom[0].x, y1: bottom[0].y, x2: bottom[1].x, y2: bottom[1].y },
        { x1: left[0].x, y1: left[0].y, x2: left[1].x, y2: left[1].y },
      ]
    }
    const tight = cornerSnapPercent(400, 1)
    expect(resolveSketchWalls(gap(0.5), tight, tight).rooms).toHaveLength(1)
    const zoomed = cornerSnapPercent(700, 3)
    expect(resolveSketchWalls(gap(0.5), zoomed, zoomed).rooms).toHaveLength(0)
  })

  it('shrinks the join distance as zoom increases', () => {
    expect(cornerSnapPercent(700, 2)).toBeCloseTo(cornerSnapPercent(700, 1) / 2, 5)
  })
})
