/**
 * Rectilinear rooms from pencil walls.
 *
 * A hand-drawn box overshoots its corners, so the four strokes cross and leave
 * tails. Treating every pair of endpoints as a rectangle, with a metre-wide
 * tolerance, turns that one loop into a stack of overlapping rooms. This walks
 * the crossings instead: join a real gap, split at intersections, drop duplicate
 * collinear pieces, and keep only the atomic face each loop encloses. One closed
 * loop is one room. The join distance is a screen-pixel snap, so it shrinks as
 * the sheet is zoomed in.
 */

export interface AxisSeg {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface RectCycle {
  x: number
  y: number
  w: number
  h: number
}

/** On-screen pixels. About half a finger, and it tracks zoom. */
export const CORNER_SNAP_PX = 28

const EPS = 0.2

export function cornerSnapPercent(spanPx: number, zoom = 1, snapPx = CORNER_SNAP_PX): number {
  const px = spanPx * Math.max(zoom, 0.01)
  if (!(px > 0)) return 4
  return (snapPx / px) * 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function horizontal(seg: AxisSeg): boolean {
  return Math.abs(seg.y1 - seg.y2) <= Math.abs(seg.x1 - seg.x2)
}

function norm(seg: AxisSeg): AxisSeg | null {
  if (horizontal(seg)) {
    const y = round2((seg.y1 + seg.y2) / 2)
    const x1 = round2(Math.min(seg.x1, seg.x2))
    const x2 = round2(Math.max(seg.x1, seg.x2))
    if (x2 - x1 <= EPS) return null
    return { x1, y1: y, x2, y2: y }
  }
  const x = round2((seg.x1 + seg.x2) / 2)
  const y1 = round2(Math.min(seg.y1, seg.y2))
  const y2 = round2(Math.max(seg.y1, seg.y2))
  if (y2 - y1 <= EPS) return null
  return { x1: x, y1, x2: x, y2 }
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const value of sorted) {
    if (out.length === 0 || value - out[out.length - 1] > EPS) out.push(value)
  }
  return out
}

/** Extend open corners that miss by less than the pixel snap. A crossing is left alone. */
function closeGaps(segs: AxisSeg[], snapX: number, snapY: number): AxisSeg[] {
  const next = segs.map((seg) => ({ ...seg }))
  for (let guard = 0; guard < 6; guard += 1) {
    let changed = false
    for (const hor of next) {
      if (!horizontal(hor)) continue
      for (const ver of next) {
        if (horizontal(ver)) continue
        const cornerX = ver.x1
        const cornerY = hor.y1
        const insideH = cornerX >= hor.x1 - EPS && cornerX <= hor.x2 + EPS
        const insideV = cornerY >= ver.y1 - EPS && cornerY <= ver.y2 + EPS
        if (insideH && insideV) continue
        const hEnd = Math.abs(cornerX - hor.x1) <= Math.abs(cornerX - hor.x2) ? hor.x1 : hor.x2
        const vEnd = Math.abs(cornerY - ver.y1) <= Math.abs(cornerY - ver.y2) ? ver.y1 : ver.y2
        if (Math.abs(hEnd - cornerX) > snapX || Math.abs(vEnd - cornerY) > snapY) continue
        if (cornerX < hor.x1 - EPS) hor.x1 = round2(cornerX)
        else if (cornerX > hor.x2 + EPS) hor.x2 = round2(cornerX)
        if (cornerY < ver.y1 - EPS) ver.y1 = round2(cornerY)
        else if (cornerY > ver.y2 + EPS) ver.y2 = round2(cornerY)
        changed = true
      }
    }
    if (!changed) break
  }
  return next
}

function splitAtCrossings(segs: AxisSeg[]): AxisSeg[] {
  const hors = segs.filter(horizontal)
  const vers = segs.filter((seg) => !horizontal(seg))
  const hCuts = new Map<AxisSeg, number[]>()
  const vCuts = new Map<AxisSeg, number[]>()
  for (const hor of hors) hCuts.set(hor, [])
  for (const ver of vers) vCuts.set(ver, [])
  for (const hor of hors) {
    for (const ver of vers) {
      if (ver.x1 < hor.x1 - EPS || ver.x1 > hor.x2 + EPS) continue
      if (hor.y1 < ver.y1 - EPS || hor.y1 > ver.y2 + EPS) continue
      hCuts.get(hor)!.push(ver.x1)
      vCuts.get(ver)!.push(hor.y1)
    }
  }
  const out: AxisSeg[] = []
  for (const hor of hors) {
    const xs = uniqueSorted([hor.x1, hor.x2, ...(hCuts.get(hor) ?? [])])
    for (let i = 0; i < xs.length - 1; i += 1) {
      if (xs[i + 1] - xs[i] > EPS) out.push({ x1: xs[i], y1: hor.y1, x2: xs[i + 1], y2: hor.y1 })
    }
  }
  for (const ver of vers) {
    const ys = uniqueSorted([ver.y1, ver.y2, ...(vCuts.get(ver) ?? [])])
    for (let i = 0; i < ys.length - 1; i += 1) {
      if (ys[i + 1] - ys[i] > EPS) out.push({ x1: ver.x1, y1: ys[i], x2: ver.x1, y2: ys[i + 1] })
    }
  }
  return out
}

function mergeIntervals(intervals: Array<[number, number]>, gap: number): Array<[number, number]> {
  const sorted = intervals.filter(([a, b]) => b - a > EPS).sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const [start, end] of sorted) {
    const last = out[out.length - 1]
    if (last && start <= last[1] + gap) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}

function mergeCollinear(segs: AxisSeg[], gap: number): AxisSeg[] {
  const hors = new Map<number, Array<[number, number]>>()
  const vers = new Map<number, Array<[number, number]>>()
  for (const seg of segs) {
    if (horizontal(seg)) {
      const key = round2(seg.y1)
      const list = hors.get(key) ?? []
      list.push([seg.x1, seg.x2])
      hors.set(key, list)
    } else {
      const key = round2(seg.x1)
      const list = vers.get(key) ?? []
      list.push([seg.y1, seg.y2])
      vers.set(key, list)
    }
  }
  const out: AxisSeg[] = []
  for (const [y, spans] of hors) {
    for (const [x1, x2] of mergeIntervals(spans, gap)) out.push({ x1, y1: y, x2, y2: y })
  }
  for (const [x, spans] of vers) {
    for (const [y1, y2] of mergeIntervals(spans, gap)) out.push({ x1: x, y1, x2: x, y2 })
  }
  return out
}

function covers(spans: Array<[number, number]>, start: number, end: number): boolean {
  const sorted = spans.filter(([a, b]) => b - a > EPS).sort((a, b) => a[0] - b[0])
  let cursor = start
  for (const [a, b] of sorted) {
    if (b < cursor - EPS) continue
    if (a > cursor + EPS) return false
    cursor = Math.max(cursor, b)
    if (cursor >= end - EPS) return true
  }
  return cursor >= end - EPS
}

function atomicRooms(segs: AxisSeg[], minSpan: number): RectCycle[] {
  const xs = uniqueSorted(segs.flatMap((seg) => [seg.x1, seg.x2]))
  const ys = uniqueSorted(segs.flatMap((seg) => [seg.y1, seg.y2]))
  const rooms: RectCycle[] = []
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x = xs[i]
      const right = xs[i + 1]
      const y = ys[j]
      const bottom = ys[j + 1]
      if (right - x < minSpan || bottom - y < minSpan) continue
      const top = segs.filter((seg) => horizontal(seg) && Math.abs(seg.y1 - y) <= EPS).map((seg) => [seg.x1, seg.x2] as [number, number])
      const bot = segs.filter((seg) => horizontal(seg) && Math.abs(seg.y1 - bottom) <= EPS).map((seg) => [seg.x1, seg.x2] as [number, number])
      const left = segs.filter((seg) => !horizontal(seg) && Math.abs(seg.x1 - x) <= EPS).map((seg) => [seg.y1, seg.y2] as [number, number])
      const rite = segs.filter((seg) => !horizontal(seg) && Math.abs(seg.x1 - right) <= EPS).map((seg) => [seg.y1, seg.y2] as [number, number])
      if (covers(top, x, right) && covers(bot, x, right) && covers(left, y, bottom) && covers(rite, y, bottom)) {
        rooms.push({ x, y, w: right - x, h: bottom - y })
      }
    }
  }
  return rooms
}

function clipToRooms(segs: AxisSeg[], rooms: RectCycle[]): AxisSeg[] {
  if (rooms.length === 0) return segs
  const kept: AxisSeg[] = []
  for (const seg of segs) {
    let used = false
    for (const room of rooms) {
      const edges: AxisSeg[] = [
        { x1: room.x, y1: room.y, x2: room.x + room.w, y2: room.y },
        { x1: room.x, y1: room.y + room.h, x2: room.x + room.w, y2: room.y + room.h },
        { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.h },
        { x1: room.x + room.w, y1: room.y, x2: room.x + room.w, y2: room.y + room.h },
      ]
      for (const edge of edges) {
        if (horizontal(seg) !== horizontal(edge)) continue
        if (horizontal(seg)) {
          if (Math.abs(seg.y1 - edge.y1) > EPS) continue
          const a = Math.max(seg.x1, edge.x1)
          const b = Math.min(seg.x2, edge.x2)
          if (b - a > EPS) {
            kept.push({ x1: a, y1: edge.y1, x2: b, y2: edge.y1 })
            used = true
          }
        } else if (Math.abs(seg.x1 - edge.x1) <= EPS) {
          const a = Math.max(seg.y1, edge.y1)
          const b = Math.min(seg.y2, edge.y2)
          if (b - a > EPS) {
            kept.push({ x1: edge.x1, y1: a, x2: edge.x1, y2: b })
            used = true
          }
        }
      }
    }
    if (!used) kept.push(seg)
  }
  return mergeCollinear(kept, EPS)
}

/**
 * One closed pencil loop becomes one rectangle. Overshoot tails are cut back
 * to the crossings before any room is accepted, so endpoint pairs cannot spawn
 * a second face.
 */
export function resolveSketchWalls(walls: AxisSeg[], snapX: number, snapY: number, minSpan = 12): { segments: AxisSeg[]; rooms: RectCycle[] } {
  const seeded = walls.map(norm).filter((seg): seg is AxisSeg => seg !== null)
  const joined = closeGaps(seeded, snapX, snapY)
  const split = splitAtCrossings(joined)
  const merged = mergeCollinear(split, Math.max(snapX, snapY))
  const rooms = atomicRooms(merged, minSpan)
  return { segments: clipToRooms(merged, rooms), rooms }
}
