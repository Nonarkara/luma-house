import React, { useMemo } from 'react'
import { solarPosition } from '../plan'

/** Polar sun-path diagram for one location + day. Horizon at rim, zenith at center. */
export const SunChart = React.memo(function SunChart({
  latitude,
  day,
  hour,
  locationLabel,
}: {
  latitude: number
  day: number
  hour: number
  locationLabel: string
}) {
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const R = 72

  const path = useMemo(() => {
    const points: Array<{ hour: number; x: number; y: number; altitude: number }> = []
    for (let h = 5; h <= 19; h += 0.5) {
      const sun = solarPosition(latitude, day, h)
      if (sun.altitude <= 0) continue
      const r = ((90 - sun.altitude) / 90) * R
      const rad = (sun.azimuth * Math.PI) / 180
      points.push({
        hour: h,
        altitude: sun.altitude,
        x: cx + r * Math.sin(rad),
        y: cy - r * Math.cos(rad),
      })
    }
    return points
  }, [latitude, day, cx, cy, R])

  const now = useMemo(() => {
    const sun = solarPosition(latitude, day, hour)
    if (sun.altitude <= 0) return null
    const r = ((90 - sun.altitude) / 90) * R
    const rad = (sun.azimuth * Math.PI) / 180
    return {
      ...sun,
      x: cx + r * Math.sin(rad),
      y: cy - r * Math.cos(rad),
    }
  }, [latitude, day, hour, cx, cy, R])

  const pathD = path.length > 1
    ? `M ${path.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`
    : ''

  return (
    <div className="sun-chart" aria-label={`Sun chart for ${locationLabel}`}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img">
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
            ? `${hour}:00 · ${now.altitude.toFixed(0)}° alt · ${now.azimuth.toFixed(0)}° az`
            : `${hour}:00 · sun below horizon`}
        </span>
      </div>
    </div>
  )
})
