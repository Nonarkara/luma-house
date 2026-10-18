import { starterLocations } from './locations'
import type { ProjectLocation } from '../types'

/** City whose IANA zone matches the browser, preferring the city named by the zone. */
export function locationForTimeZone(timeZone: string): ProjectLocation {
  const city = timeZone.split('/').pop()?.replace(/_/g, ' ')
  const named = starterLocations.find((item) => item.timezone === timeZone && item.name === city)
  if (named) return named
  return starterLocations.find((item) => item.timezone === timeZone) ?? starterLocations[0]
}
