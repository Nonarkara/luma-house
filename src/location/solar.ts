import { getPosition, getTimes } from 'suncalc'
import type { ProjectLocation } from '../types'

const formatters = new Map<string, Intl.DateTimeFormat>()
function zoneParts(date: Date, zone: string) {
  let fmt = formatters.get(zone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    if (formatters.size >= 20) formatters.delete(formatters.keys().next().value!)
    formatters.set(zone, fmt)
  }
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]))
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
}

/** Interpret city civil time. A repeated DST hour uses its first occurrence;
 * a skipped hour advances across the gap, which the workspace reports to the user. */
export function localDate(location: ProjectLocation, day: number, hour: number, year = new Date().getFullYear()) {
  const wall = Date.UTC(year, 0, day, 0, Math.round(hour * 60))
  const offsets = [-36, 0, 36].map(hours => {
    const instant = wall + hours * 3600000
    return zoneParts(new Date(instant), location.timezone) - instant
  })
  const candidates = [...new Set(offsets)].map(offset => new Date(wall - offset))
  const exact = candidates.filter(date => zoneParts(date, location.timezone) === wall).sort((a, b) => a.getTime() - b.getTime())
  if (exact[0]) return exact[0]
  // No exact civil instant exists during the spring-forward gap.
  return candidates.filter(date => zoneParts(date, location.timezone) > wall)
    .sort((a, b) => zoneParts(a, location.timezone) - zoneParts(b, location.timezone))[0] ?? candidates[0]
}

export function normalizedCivilHour(location: ProjectLocation, day: number, hour: number, year = new Date().getFullYear()) {
  return (zoneParts(localDate(location, day, hour, year), location.timezone) - Date.UTC(year, 0, day)) / 3600000
}

export function citySunPosition(location: ProjectLocation, day: number, hour: number, year?: number) {
  return getPosition(localDate(location, day, hour, year), location.latitude, location.longitude)
}

export function citySunTimes(location: ProjectLocation, day: number, year?: number) {
  const noon = localDate(location, day, 12, year)
  const offset = (zoneParts(noon, location.timezone) - noon.getTime()) / 60000
  return getTimes(noon, location.latitude, location.longitude, 0, offset)
}

export function clockLabel(hour: number) {
  const minutes = Math.round(hour * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
