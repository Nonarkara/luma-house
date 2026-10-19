import { themes, type StudioTheme } from '../design/themes'
import { useI18n } from '../i18n'

export function ThemePicker({ theme, onChange }: { theme: StudioTheme; onChange: (theme: StudioTheme) => void }) {
  const { tr } = useI18n()
  return <label className="theme-picker">
    <span>{tr('Colour scheme')}</span>
    <select aria-label="Colour scheme" value={theme.id} onChange={event => onChange(themes.find(item => item.id === event.target.value) ?? themes[0])}>
      {themes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>
}
