import { describe, expect, it } from 'vitest'
import { dayLabel, todayIn } from './solar'

describe('todayIn', () => {
  it('uses the city time zone, not the browser', () => {
    // 19 Oct 2026 03:00 UTC is 10:00 in Bangkok and 11:00 in Shanghai.
    const now = new Date(Date.UTC(2026, 9, 19, 3, 0))
    expect(todayIn({ timezone: 'Asia/Bangkok' }, now)).toEqual({ day: 292, year: 2026, hour: 10 })
    expect(todayIn({ timezone: 'Asia/Shanghai' }, now).hour).toBe(11)
    expect(dayLabel(292, 2026)).toBe('19 Oct')
  })
})

describe('studyStartIn', () => {
  it('keeps the current hour in daylight and falls back to 10:00 at night', async () => {
    const { studyStartIn } = await import('./solar')
    const bangkok = { name: 'Bangkok', label: 'Bangkok, Thailand', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' }
    expect(studyStartIn(bangkok, new Date('2026-10-19T07:00:00Z')).hour).toBe(14)
    expect(studyStartIn(bangkok, new Date('2026-10-19T16:00:00Z')).hour).toBe(10)
  })
})
