import { SITE_HEIGHT_METERS, SITE_WIDTH_METERS } from '../plan'
import type { Opening, PlanState, Room, RoomKind } from '../types'

const COS30 = Math.sqrt(3) / 2
const SIN30 = 0.5

export const WALL_HEIGHT_M = 2.8
export const TERRACE_HEIGHT_M = 0.12

export interface IsoPoint {
  x: number
  y: number
}

export interface IsoBox {
  room: Room
  height: number
  top: [IsoPoint, IsoPoint, IsoPoint, IsoPoint]
  left: [IsoPoint, IsoPoint, IsoPoint, IsoPoint]
  right: [IsoPoint, IsoPoint, IsoPoint, IsoPoint]
  depth: number
  label: IsoPoint
}

export function roomHeight(kind: RoomKind): number {
  return kind === 'terrace' ? TERRACE_HEIGHT_M : WALL_HEIGHT_M
}

/** Plan % → site meters (origin at NW corner, +x east, +y south). */
export function toMeters(xPct: number, yPct: number): { mx: number; my: number } {
  return {
    mx: (xPct / 100) * SITE_WIDTH_METERS,
    my: (yPct / 100) * SITE_HEIGHT_METERS,
  }
}

/** Classic isometric: N-up plan → screen. */
export function projectIso(mx: number, my: number, mz = 0, scale = 18): IsoPoint {
  return {
    x: (mx - my) * COS30 * scale,
    y: (mx + my) * SIN30 * scale - mz * scale,
  }
}

export function buildIsoBox(room: Room, scale = 18): IsoBox {
  const { mx, my } = toMeters(room.x, room.y)
  const w = (room.w / 100) * SITE_WIDTH_METERS
  const d = (room.h / 100) * SITE_HEIGHT_METERS
  const h = roomHeight(room.kind)

  const nw = { mx, my }
  const ne = { mx: mx + w, my }
  const sw = { mx, my: my + d }
  const se = { mx: mx + w, my: my + d }

  const top: IsoBox['top'] = [
    projectIso(nw.mx, nw.my, h, scale),
    projectIso(ne.mx, ne.my, h, scale),
    projectIso(se.mx, se.my, h, scale),
    projectIso(sw.mx, sw.my, h, scale),
  ]
  const left: IsoBox['left'] = [
    projectIso(sw.mx, sw.my, 0, scale),
    projectIso(se.mx, se.my, 0, scale),
    projectIso(se.mx, se.my, h, scale),
    projectIso(sw.mx, sw.my, h, scale),
  ]
  const right: IsoBox['right'] = [
    projectIso(se.mx, se.my, 0, scale),
    projectIso(ne.mx, ne.my, 0, scale),
    projectIso(ne.mx, ne.my, h, scale),
    projectIso(se.mx, se.my, h, scale),
  ]

  return {
    room,
    height: h,
    top,
    left,
    right,
    depth: mx + my + w + d,
    label: projectIso(mx + w / 2, my + d / 2, h + 0.35, scale),
  }
}

export function buildMassing(plan: PlanState, scale = 18): IsoBox[] {
  return plan.rooms
    .map((room) => buildIsoBox(room, scale))
    .sort((a, b) => a.depth - b.depth)
}

export function siteFootprint(scale = 18): IsoPoint[] {
  const w = SITE_WIDTH_METERS
  const h = SITE_HEIGHT_METERS
  return [
    projectIso(0, 0, 0, scale),
    projectIso(w, 0, 0, scale),
    projectIso(w, h, 0, scale),
    projectIso(0, h, 0, scale),
  ]
}

export function openingMarkers(openings: Opening[], scale = 18): Array<{ point: IsoPoint; type: Opening['type'] }> {
  return openings.map((opening) => {
    const { mx, my } = toMeters(opening.x, opening.y)
    return {
      type: opening.type,
      point: projectIso(mx, my, WALL_HEIGHT_M * 0.45, scale),
    }
  })
}

/** Sun ray tip from site center toward the sun's horizontal direction. */
export function sunDirectionTip(azimuth: number, altitude: number, scale = 18): IsoPoint | null {
  if (altitude <= 0) return null
  const rad = (azimuth * Math.PI) / 180
  // Plan: N=0 → -y, E=90 → +x. Azimuth from north, clockwise in solarPosition.
  const dirX = Math.sin(rad)
  const dirY = -Math.cos(rad)
  const cx = SITE_WIDTH_METERS / 2
  const cy = SITE_HEIGHT_METERS / 2
  const reach = 6
  return projectIso(cx + dirX * reach, cy + dirY * reach, Math.sin((altitude * Math.PI) / 180) * 4, scale)
}

export function poly(points: IsoPoint[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

export function massingBounds(boxes: IsoBox[], pad = 24): { minX: number; minY: number; width: number; height: number } {
  const pts = boxes.flatMap((box) => [...box.top, ...box.left, ...box.right])
  if (pts.length === 0) return { minX: -pad, minY: -pad, width: pad * 2, height: pad * 2 }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const maxX = Math.max(...xs) + pad
  const maxY = Math.max(...ys) + pad
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}
