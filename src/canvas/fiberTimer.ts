import { Timer } from 'three'

/**
 * Drop-in clock for react-three-fiber. Fiber still calls start/stop/getDelta
 * and writes elapsedTime; the deprecated THREE.Clock warned on every 3D mount.
 * Time advances through THREE.Timer.
 */
export class FiberTimerClock {
  autoStart: boolean
  startTime = 0
  oldTime = 0
  elapsedTime = 0
  running = false
  private readonly timer = new Timer()

  constructor(autoStart = true) {
    this.autoStart = autoStart
    if (typeof document !== 'undefined') this.timer.connect(document)
  }

  start() {
    this.startTime = performance.now()
    this.oldTime = this.startTime
    this.elapsedTime = 0
    this.running = true
    this.timer.reset()
  }

  stop() {
    this.running = false
    this.autoStart = false
  }

  getElapsedTime() {
    return this.elapsedTime
  }

  getDelta() {
    if (this.autoStart && !this.running) {
      this.start()
      return 0
    }
    if (!this.running) return 0
    this.timer.update()
    const diff = this.timer.getDelta()
    this.oldTime = performance.now()
    this.elapsedTime = this.timer.getElapsed()
    return diff
  }
}

export function installFiberTimer() {
  ;(globalThis as { __designonFiberClock?: typeof FiberTimerClock }).__designonFiberClock = FiberTimerClock
}
