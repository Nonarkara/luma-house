export interface WalkPoint {
  x: number
  z: number
}

export interface WalkBounds {
  halfWidth: number
  halfDepth: number
}

/** Pure, frame-rate-independent WASD step used by the first-person camera. */
export function nextWalkPosition(
  position: WalkPoint,
  forward: WalkPoint,
  keys: ReadonlySet<string>,
  distance: number,
  bounds: WalkBounds,
): WalkPoint {
  const forwardLength = Math.hypot(forward.x, forward.z) || 1
  const fx = forward.x / forwardLength
  const fz = forward.z / forwardLength
  const rx = -fz
  const rz = fx
  let dx = 0
  let dz = 0
  if (keys.has('KeyW')) { dx += fx; dz += fz }
  if (keys.has('KeyS')) { dx -= fx; dz -= fz }
  if (keys.has('KeyD')) { dx += rx; dz += rz }
  if (keys.has('KeyA')) { dx -= rx; dz -= rz }
  const movementLength = Math.hypot(dx, dz)
  if (movementLength > 0) {
    dx = (dx / movementLength) * distance
    dz = (dz / movementLength) * distance
  }
  return {
    x: Math.max(-bounds.halfWidth, Math.min(bounds.halfWidth, position.x + dx)),
    z: Math.max(-bounds.halfDepth, Math.min(bounds.halfDepth, position.z + dz)),
  }
}
