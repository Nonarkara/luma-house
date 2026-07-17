import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Stale branch checkouts live here; they are not part of this codebase.
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
})
