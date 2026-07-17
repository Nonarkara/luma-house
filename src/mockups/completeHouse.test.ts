import { describe, expect, it } from 'vitest'
import { furnitureDoorConflicts, totalArea } from '../plan'
import { completeHousePlan, completeHouseVariants, lightingChannels, lightingScenes } from './completeHouse'

describe('complete 100 m² mockup', () => {
  it('contains exactly 100 square meters across eight rooms', () => {
    expect(completeHousePlan.rooms).toHaveLength(8)
    expect(totalArea(completeHousePlan.rooms)).toBeCloseTo(100, 5)
  })

  it('keeps every design direction at 100 square meters', () => {
    for (const variant of completeHouseVariants) {
      expect(totalArea(variant.rooms)).toBeCloseTo(100, 5)
    }
  })

  it('defines a complete lighting control schedule', () => {
    expect(lightingChannels).toHaveLength(6)
    expect(Object.keys(lightingScenes)).toEqual(['Morning', 'Entertain', 'Night path', 'Away'])
    expect(lightingChannels.reduce((sum, channel) => sum + channel.loadWatts, 0)).toBe(204)
  })

  it('starts with every measured furniture item clear of door swings', () => {
    expect(furnitureDoorConflicts(completeHousePlan.furniture, completeHousePlan.openings).size).toBe(0)
  })
})
