import { describe, expect, it, vi } from 'vitest'
import { captureWhenReady } from './capture'
import type { ReadyStudyCapture, StudyCapture, StudyTime } from './types'

const time: StudyTime = { day: 172, hour: 12, year: 2026 }
const image: StudyCapture = { image: 'completed-frame', camera: { projection: 'orthographic', position: [3, 4, 3], target: [0, 0, 0], up: [0, 1, 0], zoom: 1, fov: 45, fieldHeight: 10 } }

describe('study capture readiness', () => {
  it('waits through cold start and refuses the previous sun clock', async () => {
    let ready: ReadyStudyCapture | null = null, tick = 0
    const stale = vi.fn(async () => image), fresh = vi.fn(async () => image)
    const view = await captureWhenReady(() => ready, time, {
      now: () => tick, timeoutMs: 5,
      nextFrame: async () => { tick++; ready = tick === 1 ? { time: { ...time, hour: 9 }, capture: stale } : { time, capture: fresh } },
    })
    expect(tick).toBe(2); expect(stale).not.toHaveBeenCalled()
    expect(fresh).toHaveBeenCalledOnce(); expect(view).toBe(image)
  })
  it('requires the complete day, hour and year, not just an hour match', async () => {
    const capture = vi.fn(async () => image)
    let tick = 0
    await captureWhenReady(() => ({ time: tick === 0 ? { ...time, day: 171 } : tick === 1 ? { ...time, year: 2025 } : time, capture }), time, {
      now: () => tick, timeoutMs: 5, nextFrame: async () => { tick++ },
    })
    expect(tick).toBe(2); expect(capture).toHaveBeenCalledOnce()
  })
  it('fails within the bound instead of saving a stale or absent frame', async () => {
    const capture = vi.fn(async () => image)
    let tick = 0
    await expect(captureWhenReady(() => ({ time: { ...time, hour: 9 }, capture }), time, {
      now: () => tick, timeoutMs: 3, nextFrame: async () => { tick++ },
    })).rejects.toThrow('did not finish loading')
    expect(tick).toBe(3); expect(capture).not.toHaveBeenCalled()
  })
  it('expires even when a hidden tab stops animation frames', async () => {
    vi.useFakeTimers()
    try {
      const result = captureWhenReady(() => null, time, {
        now: () => 0, timeoutMs: 5, nextFrame: () => new Promise<void>(() => {}),
      })
      const rejected = expect(result).rejects.toThrow('did not finish loading')
      await vi.advanceTimersByTimeAsync(6)
      await rejected
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })
})
