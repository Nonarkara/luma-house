export interface TraceRoom { id: string; name: string; kind: string; x: number; y: number; w: number; h: number }
export interface TraceOpening { id: string; type: string; x: number; y: number; rotation: number }
export interface TracePlan {
  rooms: TraceRoom[]
  openings: TraceOpening[]
  furniture?: unknown[]
  systems?: Record<string, unknown>
  /** Set by repairTrace to report what it adjusted. */
  note?: string
}

const EPS = 0.5
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/**
 * The model gets the structure right far more often than the millimetre, and
 * two failure modes show up in real traces:
 *
 *  1. rooms that spill past the drawing edge, or overlap each other, which the
 *     editor then reports as double-counted floor area;
 *  2. an opening nudged a little off a wall, which the editor reports as not
 *     fitting a wall at all.
 *
 * Both are repaired here and counted, so the note can tell the user exactly
 * what was adjusted instead of quietly shipping a wrong plan. Nothing is
 * invented: rooms are only pulled back inside the outline and overlapping
 * edges are trimmed, and an opening is only moved onto the nearest wall edge
 * it was already within half a percent of.
 */
export function repairTrace(plan: TracePlan): TracePlan {
  // --- rooms: pull inside the outline, then resolve overlaps to a clean tiling
  //
  // Placed largest-first so the big spaces keep their area and corrections land
  // on the small ones. A rectangle is only ever trimmed (never moved) against
  // a neighbour it actually intersects, and only along one axis, so a room can
  // never be pushed outside the outline by the repair itself.
  const ordered = (plan.rooms || [])
    .map(raw => {
      const w = clamp(num(raw.w, 0), 1, 100)
      const h = clamp(num(raw.h, 0), 1, 100)
      return {
        ...raw,
        x: clamp(num(raw.x, 0), 0, Math.max(0, 100 - w)),
        y: clamp(num(raw.y, 0), 0, Math.max(0, 100 - h)),
        w,
        h,
      }
    })
    .sort((a, b) => b.w * b.h - a.w * a.h)

  const placed: TraceRoom[] = []
  let overlapsTrimmed = 0
  let roomsDropped = 0
  const clash = (a: TraceRoom, b: TraceRoom) => {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    return { ox, oy, hit: ox > EPS && oy > EPS }
  }
  for (const room of ordered) {
    // Keep the far edge pinned: the repair only ever shrinks a room, so the
    // side it grows toward must stay where the model drew it.
    const right0 = room.x + room.w
    const bottom0 = room.y + room.h
    // Re-check after every trim: shrinking against one neighbour can expose a
    // clash with another, so resolve until the room is clear or we run out of
    // passes (which can only happen for a fully degenerate input).
    for (let pass = 0; pass <= placed.length; pass++) {
      const other = placed.find(candidate => clash(room, candidate).hit)
      if (!other) break
      overlapsTrimmed++
      const { ox, oy } = clash(room, other)
      // Resolve along the axis of least overlap, keeping the half on the side
      // the room's own centre sits. That can never invert the rectangle, which
      // picking "the nearest edge" could.
      if (ox <= oy) {
        if (room.x + room.w / 2 >= other.x + other.w / 2) {
          room.x = other.x + other.w
          room.w = Math.max(1, right0 - room.x)
        } else {
          room.w = Math.max(1, other.x - room.x)
        }
      } else if (room.y + room.h / 2 >= other.y + other.h / 2) {
        room.y = other.y + other.h
        room.h = Math.max(1, bottom0 - room.y)
      } else {
        room.h = Math.max(1, other.y - room.y)
      }
    }
    // Clamp inside the loop, so a room can never be pushed back out of the
    // outline and straight into the neighbour we just cleared it from.
    room.x = clamp(room.x, 0, Math.max(0, 100 - room.w))
    room.y = clamp(room.y, 0, Math.max(0, 100 - room.h))
    // Fully contained in another room there is no legal placement at all. Keep
    // it anyway and the floor area double-counts; drop it and the user is told
    // a room is missing, which they can fix. Say which happened.
    if (placed.some(candidate => clash(room, candidate).hit)) {
      roomsDropped++
    } else {
      placed.push(room)
    }
  }
  const rooms = placed.sort((a, b) => a.y - b.y || a.x - b.x)

  // An opening is valid when its centre lies on a room edge and the whole
  // 1.6m opening fits along it. Two things go wrong: the mark sits a little
  // inside the wall, or it sits too close to a corner to hold its width.
  // Fix the first by pulling it onto the edge it is already near, the second by
  // sliding it along that wall. Both stay inside EDGE_TOLERANCE, so nothing is
  // invented far from where the model actually drew it.
  const EDGE_TOLERANCE = 12 // ~1.7m on a 14m field
  let openingsMoved = 0
  const openings = plan.openings.map(opening => {
    const rotation = opening.rotation === 90 ? 90 : 0
    const half = (rotation === 0 ? 1.6 / 14 : 1.6 / 10) * 50
    const x = clamp(num(opening.x, 0), 0, 100)
    const y = clamp(num(opening.y, 0), 0, 100)
    const fits = (px: number, py: number) => rooms.some(room => {
      if (rotation === 0) {
        const onEdge = Math.abs(py - room.y) < 1.5 || Math.abs(py - (room.y + room.h)) < 1.5
        return onEdge && px - half >= room.x - 1e-6 && px + half <= room.x + room.w + 1e-6
      }
      const onEdge = Math.abs(px - room.x) < 1.5 || Math.abs(px - (room.x + room.w)) < 1.5
      return onEdge && py - half >= room.y - 1e-6 && py + half <= room.y + room.h + 1e-6
    })
    // Candidate cross-wall positions: as drawn, then snapped to each room edge
    // it is already close to.
    const walls: Array<{ x: number; y: number }> = [{ x, y }]
    for (const room of rooms) {
      if (rotation === 0) {
        for (const edge of [room.y, room.y + room.h]) if (Math.abs(y - edge) <= EDGE_TOLERANCE) walls.push({ x, y: edge })
      } else {
        for (const edge of [room.x, room.x + room.w]) if (Math.abs(x - edge) <= EDGE_TOLERANCE) walls.push({ x: edge, y })
      }
    }
    for (const wall of walls) {
      if (fits(wall.x, wall.y)) {
        if (wall.x !== x || wall.y !== y) openingsMoved++
        return { ...opening, rotation, x: wall.x, y: wall.y }
      }
      for (let step = 0.5; step <= 50; step += 0.5) {
        for (const sign of [1, -1]) {
          const probe = rotation === 0
            ? { x: clamp(wall.x + sign * step, 0, 100), y: wall.y }
            : { x: wall.x, y: clamp(wall.y + sign * step, 0, 100) }
          if (fits(probe.x, probe.y)) { openingsMoved++; return { ...opening, rotation, ...probe } }
        }
      }
    }
    return { ...opening, rotation, x, y }
  })

  const notes: string[] = []
  if (overlapsTrimmed > 0) notes.push(`${overlapsTrimmed} overlapping room edge${overlapsTrimmed > 1 ? 's were' : ' was'} trimmed`)
  if (roomsDropped > 0) notes.push(`${roomsDropped} room${roomsDropped > 1 ? 's' : ''} sat entirely inside another and ${roomsDropped > 1 ? 'were' : 'was'} dropped — add ${roomsDropped > 1 ? 'them' : 'it'} back if the drawing really shows ${roomsDropped > 1 ? 'them' : 'it'}`)
  if (openingsMoved > 0) notes.push(`${openingsMoved} opening${openingsMoved > 1 ? 's were' : ' was'} moved onto the nearest wall`)
  return {
    ...plan,
    rooms,
    openings,
    note: notes.length > 0
      ? `AI-read draft — ${notes.join('; ')}. Check every dimension before costing.`
      : 'AI-read draft — verify walls and openings before costing.',
  }
}
