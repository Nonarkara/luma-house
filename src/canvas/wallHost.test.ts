import { describe, expect, it } from 'vitest'
import { hitIsSelectedOpening, nearestWallHit } from './wallHost'
import type { Room } from '../types'

const room: Room = { id: 'living', name: 'Living', kind: 'living', x: 20, y: 20, w: 40, h: 30 }

describe('nearestWallHit', () => {
  const stage = { width: 400, height: 280 }

  it('hosts a click on the top wall with rotation 0', () => {
    const hit = nearestWallHit({ x: 40, y: 21 }, [room], stage)
    expect(hit?.y).toBe(20)
    expect(hit?.rotation).toBe(0)
    expect(hit?.roomId).toBe('living')
  })

  it('hosts a click on a side wall with rotation 90', () => {
    const hit = nearestWallHit({ x: 21, y: 35 }, [room], stage)
    expect(hit?.x).toBe(20)
    expect(hit?.rotation).toBe(90)
  })

  it('rejects a click farther than 24px from every wall', () => {
    expect(nearestWallHit({ x: 40, y: 35 }, [room], stage)).toBeNull()
  })

  it('treats the chip on the same opening as a toggle and another wall as a new opening', () => {
    const site = { w: 14, h: 10 }
    const opening = { x: 40, y: 20, rotation: 0 as const }
    const top = nearestWallHit({ x: 42, y: 20 }, [room], stage)
    const bottom = nearestWallHit({ x: 40, y: 49 }, [room], stage)
    expect(top && hitIsSelectedOpening(top, opening, site, stage)).toBe(true)
    expect(bottom && hitIsSelectedOpening(bottom, opening, site, stage)).toBe(false)
  })

  it('uses the nearest wall when a click is inside the room but within 24px of an edge', () => {
    const wide = { width: 200, height: 200 }
    const hit = nearestWallHit({ x: 40, y: 22 }, [room], wide)
    expect(hit?.rotation).toBe(0)
    expect(hit?.y).toBe(20)
  })
})
