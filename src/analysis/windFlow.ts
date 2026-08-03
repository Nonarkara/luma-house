import { roomAreaFor, roomHeight, siteOf } from '../plan'
import type { Opening, PlanState, Room } from '../types'
import type { Compass } from './types'
import { roomsForOpening } from './walls'

export const WIND_ASSUMPTIONS = {
  speedMps: 3,
  dischargeCoefficient: 0.6,
  operableWindowAreaM2: 0.96,
  openDoorAreaM2: 1.89,
  windwardCp: 0.6,
  leewardCp: -0.3,
  sideCp: -0.2,
} as const

export interface RoomWindPotential {
  room: Room
  ach: number | null
  mode: 'sealed' | 'single-sided' | 'through-flow'
  inlet: Compass | null
  outlet: Compass | null
  pressureDifference: number
  note: string
  confidence: 'concept'
}

interface ExteriorAperture {
  roomId: string
  compass: Compass
  areaM2: number
  cp: number
}

interface DoorEdge {
  door: Opening
  a: string
  b: string
  compassA: Compass
  compassB: Compass
}

interface RoomPath {
  rooms: string[]
  edges: DoorEdge[]
}

function wallAzimuth(compass: Compass): number {
  return { N: 0, E: 90, S: 180, W: 270 }[compass]
}

function angleDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}

/** Representative facade coefficient for early comparison, not a CFD result. */
export function facadePressureCoefficient(compass: Compass, windFromDeg: number): number {
  const difference = angleDifference(wallAzimuth(compass), windFromDeg)
  if (difference <= 60) {
    return WIND_ASSUMPTIONS.windwardCp * Math.cos((difference * Math.PI) / 180)
  }
  if (difference >= 120) return WIND_ASSUMPTIONS.leewardCp
  return WIND_ASSUMPTIONS.sideCp
}

function openingArea(opening: Opening): number {
  return opening.type === 'window'
    ? WIND_ASSUMPTIONS.operableWindowAreaM2
    : WIND_ASSUMPTIONS.openDoorAreaM2
}

function roomPath(start: string, end: string, edges: DoorEdge[]): RoomPath | null {
  if (start === end) return { rooms: [start], edges: [] }
  const queue: RoomPath[] = [{ rooms: [start], edges: [] }]
  const visited = new Set<string>([start])
  while (queue.length > 0) {
    const current = queue.shift()!
    const roomId = current.rooms[current.rooms.length - 1]
    for (const edge of edges) {
      const next = edge.a === roomId ? edge.b : edge.b === roomId ? edge.a : null
      if (!next || visited.has(next)) continue
      const candidate = { rooms: [...current.rooms, next], edges: [...current.edges, edge] }
      if (next === end) return candidate
      visited.add(next)
      queue.push(candidate)
    }
  }
  return null
}

function compassAt(edge: DoorEdge, roomId: string): Compass {
  return edge.a === roomId ? edge.compassA : edge.compassB
}

/**
 * Wind-driven through-flow using Δp = ΔCp·ρV²/2 and an early orifice model.
 * A room qualifies only when a continuous open-door route connects two real
 * exterior apertures with pressure separation. This is still not CFD: terrain,
 * gusts, screens, door position and internal friction remain explicit unknowns.
 */
export function windFlowPotential(
  plan: PlanState,
  windFromDeg: number,
  windSpeedMps: number = WIND_ASSUMPTIONS.speedMps,
): RoomWindPotential[] {
  const site = siteOf(plan)
  const exterior: ExteriorAperture[] = []
  const edges: DoorEdge[] = []
  const localOpeningCount = new Map<string, number>()
  const localFirstCompass = new Map<string, Compass>()

  for (const opening of plan.openings) {
    const matches = roomsForOpening(plan, opening)
    for (const match of matches) {
      localOpeningCount.set(match.room.id, (localOpeningCount.get(match.room.id) ?? 0) + 1)
      if (!localFirstCompass.has(match.room.id)) localFirstCompass.set(match.room.id, match.compass)
    }
    if (matches.length === 1) {
      exterior.push({
        roomId: matches[0].room.id,
        compass: matches[0].compass,
        areaM2: openingArea(opening),
        cp: facadePressureCoefficient(matches[0].compass, windFromDeg),
      })
    } else if (opening.type === 'door' && matches.length >= 2) {
      edges.push({
        door: opening,
        a: matches[0].room.id,
        b: matches[1].room.id,
        compassA: matches[0].compass,
        compassB: matches[1].compass,
      })
    }
  }

  const paths = exterior.flatMap((a, index) => exterior.slice(index + 1).flatMap((b) => {
    const path = roomPath(a.roomId, b.roomId, edges)
    if (!path) return []
    const deltaCp = Math.abs(a.cp - b.cp)
    if (deltaCp < 0.01) return []
    const inlet = a.cp >= b.cp ? a : b
    const outlet = inlet === a ? b : a
    const orderedPath = inlet === a ? path : { rooms: [...path.rooms].reverse(), edges: [...path.edges].reverse() }
    const resistanceAreas = [inlet.areaM2, ...orderedPath.edges.map((edge) => openingArea(edge.door)), outlet.areaM2]
    const equivalentArea = 1 / Math.sqrt(resistanceAreas.reduce((sum, area) => sum + 1 / area ** 2, 0))
    const flowM3s = WIND_ASSUMPTIONS.dischargeCoefficient * equivalentArea * Math.max(0, windSpeedMps) * Math.sqrt(deltaCp)
    return [{ inlet, outlet, deltaCp, flowM3s, path: orderedPath }]
  })).sort((a, b) => b.flowM3s - a.flowM3s)

  return plan.rooms.map((room) => {
    const candidate = paths.find((item) => item.path.rooms.includes(room.id))
    if (!candidate) {
      const openingCount = localOpeningCount.get(room.id) ?? 0
      return {
        room,
        ach: null,
        mode: openingCount === 0 ? 'sealed' : 'single-sided',
        inlet: localFirstCompass.get(room.id) ?? null,
        outlet: null,
        pressureDifference: 0,
        note: openingCount === 0 ? 'No modeled opening.' : 'No continuous path between two exterior pressure faces.',
        confidence: 'concept' as const,
      }
    }

    const roomIndex = candidate.path.rooms.indexOf(room.id)
    const inlet = roomIndex === 0
      ? candidate.inlet.compass
      : compassAt(candidate.path.edges[roomIndex - 1], room.id)
    const outlet = roomIndex === candidate.path.rooms.length - 1
      ? candidate.outlet.compass
      : compassAt(candidate.path.edges[roomIndex], room.id)
    const volumeM3 = roomAreaFor(room, site) * roomHeight(room)
    return {
      room,
      ach: volumeM3 > 0 ? (candidate.flowM3s * 3600) / volumeM3 : 0,
      mode: 'through-flow',
      inlet,
      outlet,
      pressureDifference: candidate.deltaCp,
      note: candidate.path.edges.length > 0
        ? `Path reaches two exterior pressure faces through ${candidate.path.edges.length} open internal door${candidate.path.edges.length === 1 ? '' : 's'}.`
        : 'Two exterior openings create a pressure path.',
      confidence: 'concept' as const,
    }
  })
}
