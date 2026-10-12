import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function fiberTimerPlugin() {
  return {
    name: 'designon-fiber-timer',
    transform(code: string, id: string) {
      if (id.indexOf('@react-three/fiber') === -1) return null
      if (code.indexOf('new THREE.Clock()') === -1 && code.indexOf('new THREE__namespace.Clock()') === -1) return null
      const clock = 'new globalThis.__designonFiberClock()'
      return {
        code: code.split('new THREE.Clock()').join(clock).split('new THREE__namespace.Clock()').join(clock),
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [fiberTimerPlugin(), react()],
  base: './',
  test: {
    // Stale branch checkouts live here; they are not part of this codebase.
    // Playwright specs live in `e2e/` and run via `npm run test:e2e`, not vitest.
    exclude: ['**/node_modules/**', '**/.worktrees/**', 'e2e/**'],
  },
})
