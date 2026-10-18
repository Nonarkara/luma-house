/**
 * Continuous morph between two saved alternatives.
 *
 * Plan A and Plan B are two discrete drawings. A slider between them is a third
 * thing to argue with: the piece slides, the shadow follows, the sun does not
 * move. RHIKNOWBOT lists "morphing" among its massing tools and we had nothing —
 * our A/B comparison could only be at one end or the other.
 *
 * What this deliberately does **not** do is pretend everything interpolates.
 *
 *  - Entities are matched by `id`. A piece present in only one plan cannot be
 *    interpolated into or out of existence, so it swaps at the midpoint and is
 *    counted. `morphCoverage` reports how much of the drawing is genuinely
 *    continuous so the interface can say so out loud.
 *  - `rotated` is a boolean and 90° is not a point on a line between `false`
 *    and `true`, so a piece turns at the midpoint rather than spinning. Turning
 *    *is* continuous in the drawing, so it is deliberately excluded.
 *  - A `kind`, `name` or `type` is categorical. A sofa does not fade into a bed;
 *    the piece switches identity at the midpoint and is counted as swapped if
 *    the other end disagrees.
 *
 * Every number here is a straight lerp between two numbers that were already
 * measured or already typed by the user. No new geometry is invented.
 */

import type { DrawnWall, Furniture, Opening, PlanState, Room } from '../types'
import { furnitureSpecFor, roomHeight } from '../plan'
import { openingDimensions } from '../openingGeometry'

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

const sameRoom = (a: Room, b: Room) => a.kind === b.kind && a.name === b.name
const sameFurniture = (a: Furniture, b: Furniture) =>
  a.kind === b.kind && a.assetId === b.assetId && a.label === b.label

/**
 * How much of the drawing a morph can actually carry, and how much of it has to
 * jump. Surfaced in the UI so nobody reads a smooth animation as a smooth
 * building.
 */
export interface MorphCoverage {
  /** Entities that interpolate continuously between the two plans. */
  continuous: number
  /** Entities that swap at the midpoint: added, removed, or re-typed. */
  swapped: number
}

function morphRoom(room: Room, other: Room | undefined, t: number): Room {
  if (!other) return room
  return {
    ...(t < 0.5 ? room : other),
    x: lerp(room.x, other.x, t),
    y: lerp(room.y, other.y, t),
    w: lerp(room.w, other.w, t),
    h: lerp(room.h, other.h, t),
    wallHeight: lerp(roomHeight(room), roomHeight(other), t),
  }
}

function morphOpening(opening: Opening, other: Opening | undefined, t: number): Opening {
  if (!other) return opening
  const from = openingDimensions(opening), to = openingDimensions(other)
  const sill = lerp(from.sill, to.sill, t)
  const height = lerp(from.height, to.height, t)
  return {
    ...(t < 0.5 ? opening : other),
    x: lerp(opening.x, other.x, t),
    y: lerp(opening.y, other.y, t),
    widthM: lerp(from.width, to.width, t),
    heightM: height,
    sillHeightM: sill,
    headHeightM: sill + height,
  }
}

function morphWall(wall: DrawnWall, other: DrawnWall | undefined, t: number): DrawnWall {
  if (!other) return wall
  return {
    ...wall,
    x1: lerp(wall.x1, other.x1, t),
    y1: lerp(wall.y1, other.y1, t),
    x2: lerp(wall.x2, other.x2, t),
    y2: lerp(wall.y2, other.y2, t),
  }
}

function morphFurniture(item: Furniture, other: Furniture | undefined, t: number): Furniture {
  if (!other) return item
  const from = furnitureSpecFor(item), to = furnitureSpecFor(other)
  return {
    ...(t < 0.5 ? item : other),
    x: lerp(item.x, other.x, t),
    y: lerp(item.y, other.y, t),
    wM: lerp(from.w, to.w, t),
    dM: lerp(from.d, to.d, t),
    // Boolean at the midpoint, never blended into a nonsense quarter turn.
    rotated: t < 0.5 ? item.rotated : other.rotated,
  }
}

/**
 * Interpolate two alternatives of the same building.
 *
 * `t = 0` returns Plan A unchanged, `t = 1` returns Plan B unchanged, so the
 * slider ends are exactly the drawings the user pinned. Shared `site`, systems,
 * location, study scenes and the saved comparison come from the baseline, which
 * keeps the camera and sun the two alternatives were compared under.
 */
export function morphPlan(baseline: PlanState, proposed: PlanState, t: number): PlanState {
  const amount = Math.min(1, Math.max(0, t))
  // Endpoints preserve every geometry field, including omitted defaults and
  // categorical metadata, while comparison conditions stay with the baseline.
  if (amount === 0) return baseline
  if (amount === 1) return {
    ...baseline,
    rooms: proposed.rooms,
    openings: proposed.openings,
    walls: proposed.walls,
    furniture: proposed.furniture,
  }
  // Morphing from the proposed side runs the same trajectory backwards.
  const reverse = 1 - amount
  const pastMidpoint = amount >= 0.5
  const index = <T extends { id: string }>(list: T[] | undefined): Map<string, T> =>
    new Map((list ?? []).map((item) => [item.id, item]))
  const roomsB = index(baseline.rooms), openingsB = index(baseline.openings), wallsB = index(baseline.walls), furnitureB = index(baseline.furniture)
  const roomsP = index(proposed.rooms), openingsP = index(proposed.openings), wallsP = index(proposed.walls), furnitureP = index(proposed.furniture)

  /**
   * Which side owns an entity at this point on the slider.
   *
   *  - Present in both: the baseline side owns the trajectory A → B. Each
   *    morph helper switches categorical fields at the midpoint.
   *  - Present in one plan only: it holds its side until the midpoint and
   *    swaps there, without interpolating a piece into existence.
   */
  const owner = (inBaseline: boolean, inProposed: boolean): 'baseline' | 'proposed' | null => {
    if (inBaseline && inProposed) {
      return 'baseline'
    }
    if (inBaseline) return pastMidpoint ? null : 'baseline'
    return pastMidpoint ? 'proposed' : null
  }

  return {
    ...baseline,
    rooms: [
      ...baseline.rooms.filter((r) => owner(roomsB.has(r.id), roomsP.has(r.id)) === 'baseline').map((r) => morphRoom(r, roomsP.get(r.id), amount)),
      ...proposed.rooms.filter((r) => owner(roomsB.has(r.id), roomsP.has(r.id)) === 'proposed').map((r) => morphRoom(r, roomsB.get(r.id), reverse)),
    ],
    openings: [
      ...baseline.openings.filter((o) => owner(openingsB.has(o.id), openingsP.has(o.id)) === 'baseline').map((o) => morphOpening(o, openingsP.get(o.id), amount)),
      ...proposed.openings.filter((o) => owner(openingsB.has(o.id), openingsP.has(o.id)) === 'proposed').map((o) => morphOpening(o, openingsB.get(o.id), reverse)),
    ],
    walls: baseline.walls || proposed.walls ? [
      ...(baseline.walls ?? []).filter((w) => owner(wallsB.has(w.id), wallsP.has(w.id)) === 'baseline').map((w) => morphWall(w, wallsP.get(w.id), amount)),
      ...(proposed.walls ?? []).filter((w) => owner(wallsB.has(w.id), wallsP.has(w.id)) === 'proposed').map((w) => morphWall(w, wallsB.get(w.id), reverse)),
    ] : undefined,
    furniture: [
      ...baseline.furniture.filter((f) => owner(furnitureB.has(f.id), furnitureP.has(f.id)) === 'baseline').map((f) => morphFurniture(f, furnitureP.get(f.id), amount)),
      ...proposed.furniture.filter((f) => owner(furnitureB.has(f.id), furnitureP.has(f.id)) === 'proposed').map((f) => morphFurniture(f, furnitureB.get(f.id), reverse)),
    ],
  }
}

/**
 * What a morph can and cannot carry, counted across every entity type.
 *
 * A re-typed piece counts as swapped even though its id matches: a sofa that
 * becomes a bed is a different object, and animating it would be a lie.
 */
export function morphCoverage(baseline: PlanState, proposed: PlanState): MorphCoverage {
  const pair = <T extends { id: string }>(a: T[], b: T[], same: (x: T, y: T) => boolean) => {
    const inB = new Map(b.map((item) => [item.id, item]))
    const inA = new Set(a.map((item) => item.id))
    let continuous = 0
    for (const item of a) {
      const other = inB.get(item.id)
      if (other && same(item, other)) continuous += 1
    }
    return { continuous, swapped: a.length - continuous + b.filter((item) => !inA.has(item.id)).length }
  }
  const rooms = pair(baseline.rooms, proposed.rooms, sameRoom)
  const openings = pair(baseline.openings, proposed.openings, (x, y) => x.type === y.type)
  const furniture = pair(baseline.furniture, proposed.furniture, sameFurniture)
  const walls = pair(baseline.walls ?? [], proposed.walls ?? [], () => true)
  return {
    continuous: rooms.continuous + openings.continuous + furniture.continuous + walls.continuous,
    swapped: rooms.swapped + openings.swapped + furniture.swapped + walls.swapped,
  }
}
