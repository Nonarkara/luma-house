import { useEffect, useState } from 'react'
import type { ProjectLocation } from '../types'
import { sanitizeLocation, searchCities, starterLocations } from '../location/locations'

export function CityPicker({ location, onChange }: { location: ProjectLocation; onChange: (location: ProjectLocation) => void }) {
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
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    setResults([])
    if (query.trim().length < 2) { setStatus('Type at least two letters.'); return }
    setStatus('Searching…')
    const timer = setTimeout(() => {
      timeout = setTimeout(() => controller.abort(), 8000)
      searchCities(query, controller.signal).then(items => {
        if (controller.signal.aborted) return
        setResults(items); setStatus(items.length ? 'Choose a city below.' : 'No matching cities. Try a nearby town or enter coordinates.')
      }).catch(() => {
        if (!controller.signal.aborted || timeout) setStatus('City search is unavailable. Try again or enter coordinates.')
      }).finally(() => clearTimeout(timeout))
    }, 350)
    return () => { clearTimeout(timer); clearTimeout(timeout); timeout = undefined; controller.abort() }
  }, [query])
  return <section className="city-picker" aria-label="Worldwide city search">
    <label className="field-label">Search any city or postal code
      <input type="search" aria-label="Search any city" placeholder="Cape Town, Oslo, Tokyo…" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} />
    </label>
    <p role="status">{status}</p>
    <div className="city-results">
      {(query.trim().length >= 2 ? results : starterLocations).map(item => <button type="button" key={`${item.label}:${item.latitude}:${item.longitude}`} onClick={() => { onChange(item); setQuery('') }}>
        <strong>{item.label}</strong><small>{item.latitude.toFixed(3)}°, {item.longitude.toFixed(3)}° · {item.timezone}</small>
      </button>)}
    </div>
    <details className="city-coordinates"><summary>Use exact coordinates · works offline</summary>
      <form onSubmit={e => {
        e.preventDefault()
        const next = latitude.trim() && longitude.trim() ? sanitizeLocation({ name: 'Custom site', label: `Site ${latitude}°, ${longitude}°`, latitude: Number(latitude), longitude: Number(longitude), timezone: timezone.trim() }) : undefined
        if (!next) { setCoordinateError('Enter latitude −90 to 90, longitude −180 to 180, and a valid time zone such as Asia/Bangkok or UTC.'); return }
        onChange(next); setCoordinateError('')
      }}>
        <label>Latitude<input aria-label="Site latitude" type="number" min="-90" max="90" step="any" required value={latitude} onChange={e => setLatitude(e.target.value)} /></label>
        <label>Longitude<input aria-label="Site longitude" type="number" min="-180" max="180" step="any" required value={longitude} onChange={e => setLongitude(e.target.value)} /></label>
        <label>Time zone<input aria-label="Site time zone" required maxLength={80} value={timezone} onChange={e => setTimezone(e.target.value)} /></label>
        <button type="submit">Use coordinates</button>
      </form>
      {coordinateError && <p role="alert">{coordinateError}</p>}
    </details>
    <small>City search: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo / GeoNames</a>. Once selected, sun and shadows are calculated on your device.</small>
  </section>
}
