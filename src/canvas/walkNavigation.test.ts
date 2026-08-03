import { describe, expect, it } from 'vitest'
import { nextWalkPosition } from './walkNavigation'

const bounds = { halfWidth: 7, halfDepth: 5 }

describe('walk navigation', () => {
  it('moves forward and strafes relative to the camera direction', () => {
    const forward = nextWalkPosition({ x: 0, z: 0 }, { x: 0, z: -1 }, new Set(['KeyW']), 2, bounds)
    expect(forward).toEqual({ x: 0, z: -2 })
    const right = nextWalkPosition({ x: 0, z: 0 }, { x: 0, z: -1 }, new Set(['KeyD']), 2, bounds)
    expect(right).toEqual({ x: 2, z: 0 })
  })

  it('normalizes diagonal speed and keeps the camera inside the field', () => {
    const diagonal = nextWalkPosition({ x: 0, z: 0 }, { x: 0, z: -1 }, new Set(['KeyW', 'KeyD']), 2, bounds)
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(2)
    const edge = nextWalkPosition({ x: 6.9, z: -4.9 }, { x: 0, z: -1 }, new Set(['KeyW', 'KeyD']), 2, bounds)
    expect(edge).toEqual({ x: 7, z: -5 })
  })
})
