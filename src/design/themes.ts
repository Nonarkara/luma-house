import { readString, writeString } from '../storage/keys'

/** Screen adaptations of verified Wada combinations; see docs/PALETTE.md. */
export const themes = [
  { id: 'solar-pop', name: 'Solar Pop', plate: 209, paper: '#fff0bf', sheet: '#fff8e5', ink: '#263454', rail: '#2e447c', action: '#a33b0b' },
  { id: 'guava-club', name: 'Guava Club', plate: 137, paper: '#ffe1db', sheet: '#fff2ed', ink: '#3b2631', rail: '#245543', action: '#a12848' },
  { id: 'violet-hour', name: 'Violet Hour', plate: 235, paper: '#eaddfa', sheet: '#f8f0ff', ink: '#342347', rail: '#52256d', action: '#963b0c' },
  { id: 'drafting-room', name: 'Drafting Room', plate: 243, paper: '#f6f0e3', sheet: '#faf6ed', ink: '#26383f', rail: '#41482b', action: '#8a4c16' },
] as const
export type ThemeId = typeof themes[number]['id']
export type StudioTheme = typeof themes[number]
export const STATUS_COLORS = { success: '#285733', warning: '#713c10', error: '#92271f' } as const
export const DEFAULT_THEME: ThemeId = 'solar-pop'

export function resolveTheme(id: string | null): StudioTheme {
  return themes.find(theme => theme.id === id) ?? themes[0]
}
export function readTheme(): StudioTheme {
  return resolveTheme(readString('appearance', 'luma-house:appearance'))
}

function channels(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
}
function mix(a: string, b: string, share: number): string {
  const other = channels(b)
  return '#' + channels(a).map((value, i) => Math.round(value * share + other[i] * (1 - share)).toString(16).padStart(2, '0')).join('')
}

/** A complete set of roles, shared by CSS and the Three.js environment. */
export function themeTokens(theme: StudioTheme): Record<string, string> {
  return {
    '--success': STATUS_COLORS.success,
    '--warning': STATUS_COLORS.warning,
    '--error': STATUS_COLORS.error,
    '--studio-paper': theme.paper,
    '--studio-sheet': theme.sheet,
    '--studio-ink': theme.ink,
    '--studio-olive': theme.rail,
    '--studio-sienna': theme.action,
    '--studio-secondary': mix(theme.ink, theme.paper, .88),
    '--studio-quiet': mix(theme.ink, theme.paper, .8),
    '--studio-border': mix(theme.ink, theme.paper, .6),
    '--studio-support': mix(theme.paper, theme.rail, .87),
    '--studio-selection': mix(theme.paper, theme.action, .88),
    '--studio-action-hover': mix(theme.action, theme.ink, .75),
    '--studio-rail-hover': mix(theme.rail, theme.paper, .9),
    '--studio-rail-track': mix(theme.rail, theme.paper, .75),
    '--studio-grid': mix(theme.ink, theme.paper, .35),
    '--studio-ground': mix(theme.paper, theme.rail, .75),
    '--studio-ink-rgb': channels(theme.ink).join(', '),
    '--studio-action-rgb': channels(theme.action).join(', '),
  }
}
export function applyTheme(theme: StudioTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme.id
  for (const [name, value] of Object.entries(themeTokens(theme))) root.style.setProperty(name, value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.paper)
}
export function saveTheme(theme: StudioTheme): void {
  applyTheme(theme)
  writeString('appearance', theme.id)
}
