import { useEffect, useState } from 'react'
import type { ProjectLocation } from '../types'
import { sanitizeLocation, searchCities, starterLocations } from '../location/locations'
import { useI18n } from '../i18n'

export function CityPicker({ location, onChange }: { location: ProjectLocation; onChange: (location: ProjectLocation) => void }) {
  const { tr } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProjectLocation[]>([])
  const [status, setStatus] = useState('')
  const [latitude, setLatitude] = useState(String(location.latitude))
  const [longitude, setLongitude] = useState(String(location.longitude))
  const [timezone, setTimezone] = useState(location.timezone)
  const [coordinateError, setCoordinateError] = useState('')
  useEffect(() => {
    setLatitude(String(location.latitude)); setLongitude(String(location.longitude)); setTimezone(location.timezone)
  }, [location])
  useEffect(() => {
    const term = query.trim()
    if (term.length === 0) { setResults([]); setStatus(''); return }
    if (term.length < 2) { setResults([]); setStatus('Type at least two letters.'); return }
    const controller = new AbortController()
    let active = true
    setStatus('Searching…')
    const timer = setTimeout(() => {
      const timeout = setTimeout(() => controller.abort(), 8000)
      searchCities(query, controller.signal).then(items => {
        if (!active) return
        setResults(items)
        setStatus(items.length ? 'Choose a city below.' : 'No matching cities. Try a nearby town or enter coordinates.')
      }).catch(() => {
        if (!active) return
        setResults([])
        setStatus('City search is unavailable. Try again or enter coordinates.')
      }).finally(() => clearTimeout(timeout))
    }, 350)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [query])
  // The current city is never offered as a result.
  const isCurrent = (item: ProjectLocation) => item.label === location.label || (Math.abs(item.latitude - location.latitude) < 0.01 && Math.abs(item.longitude - location.longitude) < 0.01)
  const choice = (item: ProjectLocation) => <button type="button" key={`${item.label}:${item.latitude}:${item.longitude}`} onClick={() => { onChange(item); setQuery('') }}>
    <strong>{item.label}</strong><small>{item.latitude.toFixed(3)}°, {item.longitude.toFixed(3)}° · {item.timezone}</small>
  </button>
  return <section className="city-picker" aria-label={tr('Worldwide city search')}>
    <label className="field-label">{tr('Search any city or postal code')}
      <input type="search" aria-label={tr('Search any city')} placeholder={tr('Cape Town, Oslo, Tokyo…')} value={query} maxLength={100} onChange={e => setQuery(e.target.value)} />
    </label>
    <p role="status">{tr(status)}</p>
    {query.trim().length >= 2 ? <div className="city-results">
      {results.filter(item => !isCurrent(item)).map(choice)}
    </div> : <details className="city-starters"><summary>{tr('Suggested cities')}</summary><div className="city-results">
      {starterLocations.filter(item => !isCurrent(item)).map(choice)}
    </div></details>}
    <details className="city-coordinates"><summary>{tr('Use exact coordinates · works offline')}</summary>
      <form onSubmit={e => {
        e.preventDefault()
        const next = latitude.trim() && longitude.trim() ? sanitizeLocation({ name: 'Custom site', label: `Site ${latitude}°, ${longitude}°`, latitude: Number(latitude), longitude: Number(longitude), timezone: timezone.trim() }) : undefined
        if (!next) { setCoordinateError('Enter latitude −90 to 90, longitude −180 to 180, and a valid time zone such as Asia/Bangkok or UTC.'); return }
        onChange(next); setCoordinateError('')
      }}>
        <label>{tr('Latitude')}<input aria-label={tr('Site latitude')} type="number" min="-90" max="90" step="any" required value={latitude} onChange={e => setLatitude(e.target.value)} /></label>
        <label>{tr('Longitude')}<input aria-label={tr('Site longitude')} type="number" min="-180" max="180" step="any" required value={longitude} onChange={e => setLongitude(e.target.value)} /></label>
        <label>{tr('Time zone')}<input aria-label={tr('Site time zone')} required maxLength={80} value={timezone} onChange={e => setTimezone(e.target.value)} /></label>
        <button type="submit">{tr('Use coordinates')}</button>
      </form>
      {coordinateError && <p role="alert">{tr(coordinateError)}</p>}
    </details>
    <small>{tr('City search: ')}<a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">{tr('Open-Meteo / GeoNames')}</a>{tr('. Once selected, sun and shadows are calculated on your device.')}</small>
  </section>
}
