import { describe, expect, it } from 'vitest'
import { assumedOutsideC } from './climate'

describe('assumed outside temperature', () => {
  it('is not a fixed 34°C, and December follows the hemisphere', () => {
    const bangkokDecember = assumedOutsideC(13.7563, 355)
    const shanghaiDecember = assumedOutsideC(31.2304, 355)
    const sydneyDecember = assumedOutsideC(-33.8688, 355)
    const sydneyJune = assumedOutsideC(-33.8688, 172)
    expect(bangkokDecember).toBeGreaterThan(20)
    expect(bangkokDecember).toBeLessThan(30)
    expect(shanghaiDecember).toBeLessThan(12)
    expect(sydneyDecember).toBeGreaterThan(sydneyJune)
  })
})
