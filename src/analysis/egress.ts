import { siteOf } from '../plan'
import type { Opening, PlanState, Room } from '../types'
import { roomsForOpening } from './walls'

export interface RoutePoint {
  x: number
  y: number
}

export interface RoomEgressRoute {
  room: Room
  connected: boolean
  distanceM: number | null
  points: RoutePoint[]
  doors: string[]
  note: string
  confidence: 'geometry-only'
}

function center(room: Room): RoutePoint {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 }
}

function roomsForDoor(plan: PlanState, door: Opening): Room[] {
  return roomsForOpening(plan, door).map((match) => match.room)
}

function distanceMeters(a: RoutePoint, b: RoutePoint, plan: PlanState): number {
  const site = siteOf(plan)
  return Math.hypot(((a.x - b.x) / 100) * site.w, ((a.y - b.y) / 100) * site.h)
}

/**
 * Door-graph connectivity to an exterior door. This intentionally checks only
 * geometry: it does not infer fire ratings, door hardware, smoke protection,
 * clear widths, accessibility, or jurisdiction-specific travel limits.
 */
export function egressRoutes(plan: PlanState): RoomEgressRoute[] {
  const doors = plan.openings.filter((opening) => opening.type === 'door')
  const adjacency = new Map<string, Array<{ roomId: string; door: Opening }>>()
  const exits = new Map<string, Opening[]>()

  for (const door of doors) {
    const rooms = roomsForDoor(plan, door)
    if (rooms.length >= 2) {
      for (const room of rooms) {
        for (const other of rooms) {
          if (room.id === other.id) continue
          const list = adjacency.get(room.id) ?? []
          list.push({ roomId: other.id, door })
          adjacency.set(room.id, list)
        }
      }
    } else if (rooms.length === 1) {
      const list = exits.get(rooms[0].id) ?? []
      list.push(door)
      exits.set(rooms[0].id, list)
    }
  }

  return plan.rooms.map((room) => {
    type Search = { roomId: string; doors: Opening[]; points: RoutePoint[]; distanceM: number }
    const queue: Search[] = [{ roomId: room.id, doors: [], points: [center(room)], distanceM: 0 }]
    const visited = new Set<string>()
    let found: Search | null = null

    while (queue.length > 0) {
      queue.sort((a, b) => a.distanceM - b.distanceM)
      const current = queue.shift()!
      if (visited.has(current.roomId)) continue
      visited.add(current.roomId)
      const currentRoom = plan.rooms.find((item) => item.id === current.roomId)
      if (!currentRoom) continue

      const roomExits = exits.get(current.roomId) ?? []
      if (roomExits.length > 0) {
        const exit = roomExits.reduce((best, candidate) => {
          const last = current.points[current.points.length - 1]
          return distanceMeters(last, candidate, plan) < distanceMeters(last, best, plan) ? candidate : best
        })
        const last = current.points[current.points.length - 1]
        found = {
          ...current,
          doors: [...current.doors, exit],
          points: [...current.points, { x: exit.x, y: exit.y }],
          distanceM: current.distanceM + distanceMeters(last, exit, plan),
        }
        break
      }

      for (const edge of adjacency.get(current.roomId) ?? []) {
        if (visited.has(edge.roomId)) continue
        const nextRoom = plan.rooms.find((item) => item.id === edge.roomId)
        if (!nextRoom) continue
        const point = { x: edge.door.x, y: edge.door.y }
        const last = current.points[current.points.length - 1]
        queue.push({
          roomId: edge.roomId,
          doors: [...current.doors, edge.door],
          points: [...current.points, point, center(nextRoom)],
          distanceM: current.distanceM + distanceMeters(last, point, plan) + distanceMeters(point, center(nextRoom), plan),
        })
      }
    }

    return {
      room,
      connected: found !== null,
      distanceM: found?.distanceM ?? null,
      points: found?.points ?? [center(room)],
      doors: found?.doors.map((door) => door.id) ?? [],
      note: found ? 'Continuous door path reaches an exterior door.' : 'No continuous modeled door path reaches outdoors.',
      confidence: 'geometry-only' as const,
    }
  })
}
