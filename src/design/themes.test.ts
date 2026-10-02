import { describe, expect, it } from 'vitest'
import { resolveTheme, themes, themeTokens, STATUS_COLORS } from './themes'

function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
}
function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
describe('studio colour schemes', () => {
  for (const theme of themes) {
    it(`${theme.name} protects reading, actions, states and input boundaries`, () => {
      const tokens = themeTokens(theme)
      for (const surface of [theme.paper, theme.sheet, tokens['--studio-support'], tokens['--studio-selection']]) {
        for (const ink of [theme.ink, tokens['--studio-secondary'], tokens['--studio-quiet']]) expect(contrast(ink, surface), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        for (const signal of Object.values(STATUS_COLORS)) expect(contrast(signal, surface)).toBeGreaterThanOrEqual(4.5)
      }
      for (const action of [theme.action, tokens['--studio-action-hover']]) expect(contrast(theme.sheet, action)).toBeGreaterThanOrEqual(4.5)
      for (const rail of [theme.rail, tokens['--studio-rail-hover']]) expect(contrast(theme.paper, rail)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(tokens['--studio-border'], theme.sheet)).toBeGreaterThanOrEqual(3)
    })
  }
  it('an unknown or missing saved scheme falls back to Solar Pop', () => {
    expect(resolveTheme(null).id).toBe('solar-pop')
    expect(resolveTheme('unexpected').id).toBe('solar-pop')
    expect(resolveTheme('drafting-room').id).toBe('drafting-room')
  })
})
