import { roomsForOpening } from '../analysis/walls'
import { roomAreaFor, siteOf } from '../plan'
import type { DrawnWall, Furniture, FurnitureKind, Opening, PlanState, Room, RoomKind, SiteSpec } from '../types'
import { MIN_ROOM, clampRoom, snap, snapOpeningToWall, strokeToRoomRect, type StrokePoint } from './geometry'

const SHORT_MAX = 8
const LINE_ASPECT = 3.2
const MIN_WALL = 8
const END_SNAP = 2.5

export type NapkinResult = {
  plan: PlanState
  toast: string
  label: string
  selectRoom?: string
  selectOpening?: string
  selectFurniture?: string
}

function nid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function bbox(points: StrokePoint[]): { x: number; y: number; w: number; h: number } | null {
  const rect = strokeToRoomRect(points)
  if (rect) return rect
  if (points.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) }
}

function centroid(points: StrokePoint[]): StrokePoint | null {
  const box = bbox(points)
  if (!box) return null
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
}

function roomAt(rooms: Room[], x: number, y: number): Room | undefined {
  return rooms.find((room) => x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h)
}

function orthogonalLine(a: StrokePoint, b: StrokePoint): DrawnWall {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const y = snap((a.y + b.y) / 2, true)
    return { id: nid('wall'), x1: snap(Math.min(a.x, b.x), true), y1: y, x2: snap(Math.max(a.x, b.x), true), y2: y }
  }
  const x = snap((a.x + b.x) / 2, true)
  return { id: nid('wall'), x1: x, y1: snap(Math.min(a.y, b.y), true), x2: x, y2: snap(Math.max(a.y, b.y), true) }
}

function wallLength(wall: DrawnWall): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
}

function snapWallToSketch(wall: DrawnWall, plan: PlanState): DrawnWall {
  const anchors: StrokePoint[] = []
  for (const other of plan.walls ?? []) {
    anchors.push({ x: other.x1, y: other.y1 }, { x: other.x2, y: other.y2 })
  }
  for (const room of plan.rooms) {
    anchors.push(
      { x: room.x, y: room.y },
      { x: room.x + room.w, y: room.y },
      { x: room.x, y: room.y + room.h },
      { x: room.x + room.w, y: room.y + room.h },
    )
  }
  const snapEnd = (x: number, y: number): StrokePoint => {
    let best = { x, y }
    let bestDist = END_SNAP
    for (const anchor of anchors) {
      const dist = Math.hypot(anchor.x - x, anchor.y - y)
      if (dist < bestDist) {
        best = anchor
        bestDist = dist
      }
    }
    return best
  }
  const a = snapEnd(wall.x1, wall.y1)
  const b = snapEnd(wall.x2, wall.y2)
  return orthogonalLine(a, b)
}

function covers(intervals: Array<[number, number]>, start: number, end: number): boolean {
  const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  let cursor = start
  for (const [a, b] of sorted) {
    if (b < cursor - 1) continue
    if (a > cursor + 1) return false
    cursor = Math.max(cursor, b)
    if (cursor >= end - 1) return true
  }
  return cursor >= end - 1
}

function closedRoomsFromWalls(walls: DrawnWall[]): Array<Pick<Room, 'x' | 'y' | 'w' | 'h'>> {
  const xs = [...new Set(walls.flatMap((wall) => [wall.x1, wall.x2]))].sort((a, b) => a - b)
  const ys = [...new Set(walls.flatMap((wall) => [wall.y1, wall.y2]))].sort((a, b) => a - b)
  const rooms: Array<Pick<Room, 'x' | 'y' | 'w' | 'h'>> = []
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      for (let k = 0; k < ys.length; k += 1) {
        for (let l = k + 1; l < ys.length; l += 1) {
          const x = xs[i]
          const right = xs[j]
          const y = ys[k]
          const bottom = ys[l]
          const w = right - x
          const h = bottom - y
          if (w < MIN_ROOM || h < MIN_ROOM) continue
          const horizontal = (yy: number) =>
            walls
              .filter((wall) => Math.abs(wall.y1 - yy) <= 1.5 && Math.abs(wall.y2 - yy) <= 1.5)
              .map((wall) => [Math.min(wall.x1, wall.x2), Math.max(wall.x1, wall.x2)] as [number, number])
          const vertical = (xx: number) =>
            walls
              .filter((wall) => Math.abs(wall.x1 - xx) <= 1.5 && Math.abs(wall.x2 - xx) <= 1.5)
              .map((wall) => [Math.min(wall.y1, wall.y2), Math.max(wall.y1, wall.y2)] as [number, number])
          if (
            covers(horizontal(y), x, right) &&
            covers(horizontal(bottom), x, right) &&
            covers(vertical(x), y, bottom) &&
            covers(vertical(right), y, bottom)
          ) {
            rooms.push(clampRoom({ x, y, w, h }))
          }
        }
      }
    }
  }
  return rooms
}

function wallConsumedByRoom(wall: DrawnWall, room: Pick<Room, 'x' | 'y' | 'w' | 'h'>): boolean {
  const onTop = Math.abs(wall.y1 - room.y) <= 1.5 && Math.abs(wall.y2 - room.y) <= 1.5
  const onBottom = Math.abs(wall.y1 - (room.y + room.h)) <= 1.5 && Math.abs(wall.y2 - (room.y + room.h)) <= 1.5
  const onLeft = Math.abs(wall.x1 - room.x) <= 1.5 && Math.abs(wall.x2 - room.x) <= 1.5
  const onRight = Math.abs(wall.x1 - (room.x + room.w)) <= 1.5 && Math.abs(wall.x2 - (room.x + room.w)) <= 1.5
  if (onTop || onBottom) {
    return Math.min(wall.x1, wall.x2) >= room.x - 1.5 && Math.max(wall.x1, wall.x2) <= room.x + room.w + 1.5
  }
  if (onLeft || onRight) {
    return Math.min(wall.y1, wall.y2) >= room.y - 1.5 && Math.max(wall.y1, wall.y2) <= room.y + room.h + 1.5
  }
  return false
}

function inferRoomKind(areaM2: number, existing: Room[]): RoomKind {
  if (areaM2 < 5) return 'bathroom'
  if (areaM2 < 16) return existing.some((room) => room.kind === 'living') ? 'bedroom' : 'living'
  return existing.some((room) => room.kind === 'living') ? 'studio' : 'living'
}

function roomName(kind: RoomKind, existing: Room[]): string {
  const count = existing.filter((room) => room.kind === kind).length + 1
  const labels: Record<RoomKind, string> = {
    living: 'Living',
    kitchen: 'Kitchen',
    bedroom: 'Bedroom',
    bathroom: 'Bathroom',
    studio: 'Room',
    terrace: 'Terrace',
  }
  return count === 1 ? labels[kind] : `${labels[kind]} ${count}`
}

function classifyFurniture(wM: number, dM: number, host: Room): FurnitureKind {
  const min = Math.min(wM, dM)
  const max = Math.max(wM, dM)
  if (host.kind === 'bathroom' || (max < 0.95 && min < 0.8)) return 'wc'
  if (min < 0.75 && max >= 1.2) return 'wardrobe'
  if (min >= 0.55 && min <= 1.15 && max >= 1.5) return 'sofa'
  if (min >= 0.7 && max >= 1.4) return 'bed'
  if (min < 0.95 && max < 1.8) return 'desk'
  return 'bed'
}

function splitRoom(room: Room, wall: DrawnWall): [Room, Room] | null {
  const vertical = Math.abs(wall.x1 - wall.x2) <= 1.5
  const horizontal = Math.abs(wall.y1 - wall.y2) <= 1.5
  if (vertical) {
    const x = wall.x1
    if (x < room.x + MIN_ROOM || x > room.x + room.w - MIN_ROOM) return null
    const spans = Math.min(wall.y1, wall.y2) <= room.y + 2 && Math.max(wall.y1, wall.y2) >= room.y + room.h - 2
    if (!spans) return null
    const left = { ...room, id: nid('room'), w: x - room.x }
    const right = { ...room, id: nid('room'), x, w: room.x + room.w - x, name: `${room.name} b` }
    return [left, right]
  }
  if (horizontal) {
    const y = wall.y1
    if (y < room.y + MIN_ROOM || y > room.y + room.h - MIN_ROOM) return null
    const spans = Math.min(wall.x1, wall.x2) <= room.x + 2 && Math.max(wall.x1, wall.x2) >= room.x + room.w - 2
    if (!spans) return null
    const top = { ...room, id: nid('room'), h: y - room.y }
    const bottom = { ...room, id: nid('room'), y, h: room.y + room.h - y, name: `${room.name} b` }
    return [top, bottom]
  }
  return null
}

function mintRoom(rect: Pick<Room, 'x' | 'y' | 'w' | 'h'>, plan: PlanState, site: SiteSpec): Room {
  const area = roomAreaFor({ id: 'tmp', name: '', kind: 'studio', ...rect }, site)
  const kind = inferRoomKind(area, plan.rooms)
  return { id: nid('room'), name: roomName(kind, plan.rooms), kind, ...rect }
}

/**
 * One pencil, many meanings. A line is a wall, a short stop on a wall is a
 * door (interior) or window (exterior), a box in empty space is a room, a
 * box inside a room is furniture.
 */
export function applyNapkinStroke(plan: PlanState, points: StrokePoint[], site: SiteSpec = siteOf(plan)): NapkinResult | { plan: null; toast: string } {
  const box = bbox(points)
  if (!box || points.length < 2) {
    return { plan: null, toast: 'Draw a line for a wall, or a box for a room' }
  }
  const maxSide = Math.max(box.w, box.h)
  const minSide = Math.min(box.w, box.h)
  const aspect = minSide <= 0.01 ? 99 : maxSide / Math.max(minSide, 0.01)
  const center = centroid(points) ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const host = roomAt(plan.rooms, center.x, center.y)
  const isLine = aspect >= LINE_ASPECT || minSide < 5
  const isTick = minSide < 3.2 && maxSide < SHORT_MAX + 1

  if (isTick) {
    const opening = snapOpeningToWall(
      {
        id: nid('op'),
        type: 'window',
        x: center.x,
        y: center.y,
        rotation: box.w >= box.h ? 0 : 90,
      },
      plan.rooms,
    )
    const matches = roomsForOpening(plan, opening)
    if (matches.length > 0) {
      const type: Opening['type'] = matches.length >= 2 ? 'door' : 'window'
      const alongM = type === 'door'
        ? Math.max(0.8, Math.min(1.1, (maxSide / 100) * (opening.rotation === 0 ? site.w : site.h)))
        : Math.max(0.9, Math.min(2.2, (maxSide / 100) * (opening.rotation === 0 ? site.w : site.h)))
      const placed: Opening = {
        ...opening,
        type,
        widthM: alongM,
        heightM: type === 'door' ? 2.1 : 1.2,
      }
      return {
        plan: { ...plan, openings: [...plan.openings, placed] },
        toast: type === 'door' ? 'Door on the interior wall' : 'Window on the exterior wall',
        label: type === 'door' ? 'Sketch door' : 'Sketch window',
        selectOpening: placed.id,
      }
    }
    return { plan: null, toast: 'Tick a wall for a door or window' }
  }

  if (host && minSide >= 3.2) {
    const wM = (box.w / 100) * site.w
    const dM = (box.h / 100) * site.h
    if (wM >= 0.35 && dM >= 0.35 && wM < 3.6 && dM < 3.6) {
      const kind = classifyFurniture(wM, dM, host)
      const item: Furniture = { id: nid('f'), kind, x: box.x, y: box.y, rotated: false, wM, dM }
      return {
        plan: { ...plan, furniture: [...plan.furniture, item] },
        toast: kind === 'wc' ? 'WC' : kind === 'bed' ? 'Bed' : kind === 'wardrobe' ? 'Wardrobe' : kind === 'sofa' ? 'Sofa' : 'Desk',
        label: `Sketch ${kind}`,
        selectFurniture: item.id,
      }
    }
  }

  if (isLine) {
    const raw = orthogonalLine(points[0], points[points.length - 1])
    const wall = snapWallToSketch(raw, plan)
    if (wallLength(wall) < MIN_WALL) {
      return { plan: null, toast: 'Draw a longer line — a wall needs a few meters' }
    }

    const splitHost = roomAt(plan.rooms, (wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2)
    if (splitHost) {
      const parts = splitRoom(splitHost, wall)
      if (parts) {
        const [a, b] = parts
        a.kind = inferRoomKind(roomAreaFor(a, site), plan.rooms.filter((room) => room.id !== splitHost.id))
        b.kind = inferRoomKind(roomAreaFor(b, site), [...plan.rooms.filter((room) => room.id !== splitHost.id), a])
        a.name = roomName(a.kind, plan.rooms.filter((room) => room.id !== splitHost.id))
        b.name = roomName(b.kind, [...plan.rooms.filter((room) => room.id !== splitHost.id), a])
        return {
          plan: {
            ...plan,
            rooms: plan.rooms.flatMap((room) => (room.id === splitHost.id ? [a, b] : [room])),
          },
          toast: `Split into ${a.name} and ${b.name}`,
          label: 'Split room',
          selectRoom: a.id,
        }
      }
    }

    const walls = [...(plan.walls ?? []), wall]
    const closed = closedRoomsFromWalls(walls)
    const fresh = closed.filter((rect) =>
      !plan.rooms.some((room) =>
        Math.abs(room.x - rect.x) < 2 && Math.abs(room.y - rect.y) < 2 && Math.abs(room.w - rect.w) < 2 && Math.abs(room.h - rect.h) < 2,
      ),
    )
    if (fresh.length > 0) {
      let next: PlanState = { ...plan, walls }
      const minted: Room[] = []
      for (const rect of fresh) {
        const room = mintRoom(rect, next, site)
        minted.push(room)
        next = {
          ...next,
          rooms: [...next.rooms, room],
          walls: (next.walls ?? []).filter((item) => !wallConsumedByRoom(item, room)),
        }
      }
      const last = minted[minted.length - 1]
      return {
        plan: next,
        toast: minted.length === 1 ? `${last.name} closed` : `${minted.length} rooms closed`,
        label: 'Close room from walls',
        selectRoom: last.id,
      }
    }

    return {
      plan: { ...plan, walls },
      toast: 'Wall. Draw the other three sides to close a room, or tick this wall for a window.',
      label: 'Sketch wall',
    }
  }

  const rect = strokeToRoomRect(points)
  if (!rect) {
    return { plan: null, toast: 'Draw a box for a room, or a line for a wall' }
  }
  const room = mintRoom(rect, plan, site)
  return {
    plan: { ...plan, rooms: [...plan.rooms, room] },
    toast: `${room.name} · type one real dimension to set the scale`,
    label: 'Sketch room',
    selectRoom: room.id,
  }
}
