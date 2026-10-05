import type { ProjectLocation } from '../types'
import { citySunPosition, citySunTimes, clockLabel, normalizedCivilHour } from '../location/solar'
import React, { useMemo } from 'react'
import { solarPosition } from '../plan'

/** Polar sun-path diagram for one location + day. Horizon at rim, zenith at center. */
export const SunChart = React.memo(function SunChart({
  latitude,
  location,
  day,
  hour,
  locationLabel,
}: {
  latitude: number
  location?: ProjectLocation
  day: number
  hour: number
  locationLabel: string
}) {
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const R = 72

  const path = useMemo(() => {
    const points: Array<{ hour: number; x: number; y: number; altitude: number; start: boolean }> = []
    let start = true
    for (let h = 0; h <= 24; h += 0.25) {
      if (location && normalizedCivilHour(location, day, h) !== h) continue
      const sun = location ? citySunPosition(location, day, h) : solarPosition(latitude, day, h)
      if (sun.altitude <= 0) { start = true; continue }
      const r = ((90 - sun.altitude) / 90) * R
      const rad = (sun.azimuth * Math.PI) / 180
      points.push({
        start,
        hour: h,
        altitude: sun.altitude,
        x: cx + r * Math.sin(rad),
        y: cy - r * Math.cos(rad),
      })
      start = false
    }
    return points
  }, [latitude, location, day, cx, cy, R])

  const now = useMemo(() => {
    const sun = location ? citySunPosition(location, day, hour) : solarPosition(latitude, day, hour)
    if (sun.altitude <= 0) return null
    const r = ((90 - sun.altitude) / 90) * R
    const rad = (sun.azimuth * Math.PI) / 180
    return {
      ...sun,
      x: cx + r * Math.sin(rad),
      y: cy - r * Math.cos(rad),
    }
  }, [latitude, location, day, hour, cx, cy, R])

  const pathD = path.length > 1
    ? path.map((p) => `${p.start ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : ''

  const times = useMemo(() => location ? citySunTimes(location, day) : null, [location, day])
  const formatTime = (date: Date | null) => date && location ? new Intl.DateTimeFormat('en-GB', { timeZone: location.timezone, hour: '2-digit', minute: '2-digit' }).format(date) : '—'

  return (
    <div className="sun-chart" aria-label={`Sun chart for ${locationLabel}`}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Daily sun path: north at top, horizon at rim, zenith at centre">
        <circle cx={cx} cy={cy} r={R} className="sun-chart-disk" />
        <circle cx={cx} cy={cy} r={R * (2 / 3)} className="sun-chart-ring" />
        <circle cx={cx} cy={cy} r={R / 3} className="sun-chart-ring" />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} className="sun-chart-axis" />
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} className="sun-chart-axis" />
        <text x={cx} y={cy - R - 6} className="sun-chart-cardinal">N</text>
        <text x={cx + R + 6} y={cy + 3} className="sun-chart-cardinal">E</text>
        <text x={cx} y={cy + R + 12} className="sun-chart-cardinal">S</text>
        <text x={cx - R - 10} y={cy + 3} className="sun-chart-cardinal">W</text>
        {pathD && <path d={pathD} className="sun-chart-path" />}
        {now && (
          <g>
            <circle cx={now.x} cy={now.y} r={5} className="sun-chart-now" />
            <line x1={cx} y1={cy} x2={now.x} y2={now.y} className="sun-chart-beam" />
          </g>
        )}
      </svg>
      <div className="sun-chart-caption">
        <strong>{locationLabel}</strong>
        <span>
          {now
            ? `${clockLabel(hour)} · ${now.altitude.toFixed(0)}° alt · ${now.azimuth.toFixed(0)}° az`
            : `${clockLabel(hour)} · sun below horizon`}
        </span>
        {location && <span>{location.timezone} · {location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}°</span>}
        {times && <span>{times.alwaysUp ? 'Midnight sun · no sunset' : times.alwaysDown ? 'Polar night · no sunrise' : `Sunrise ${formatTime(times.sunrise)} · Sunset ${formatTime(times.sunset)}`}</span>}
        <small>Day {day} · {new Date().getFullYear()} · <a href="https://github.com/mourner/suncalc" target="_blank" rel="noreferrer">SunCalc</a> · clear horizon</small>
      </div>
    </div>
  )
})
