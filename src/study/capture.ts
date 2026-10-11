import type { ReadyStudyCapture, StudyCapture, StudyTime } from './types'

/** Wait for the Three.js tree to commit the requested clock, including cold starts. */
export async function captureWhenReady(read: () => ReadyStudyCapture | null, time: StudyTime, timing = {
  nextFrame: () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
  now: () => performance.now(),
  timeoutMs: 10_000,
}): Promise<StudyCapture> {
  const deadline = timing.now() + timing.timeoutMs
  const error = () => new Error('The 3D view did not finish loading. Close this panel and try again.')
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  const wait = async () => {
    while (!stopped && timing.now() < deadline) {
      const ready = read()
      if (ready && ready.time.day === time.day && ready.time.hour === time.hour && ready.time.year === time.year) return ready.capture()
      await timing.nextFrame()
    }
    throw error()
  }
  try {
    return await Promise.race([wait(), new Promise<StudyCapture>((_, reject) => {
      timer = setTimeout(() => { stopped = true; reject(error()) }, timing.timeoutMs)
    })])
  } finally {
    stopped = true
    if (timer !== undefined) clearTimeout(timer)
  }
}
