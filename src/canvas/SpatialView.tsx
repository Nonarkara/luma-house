import React, { useMemo } from 'react'
import { Box, Sun } from 'lucide-react'
import { furnitureCatalog, furnitureRect } from '../plan'
import type { PlanState, RoomKind } from '../types'

const roomColors: Record<RoomKind, string> = {
  living: 'rgba(163, 255, 0, 0.12)',
  kitchen: 'rgba(56, 189, 248, 0.12)',
  bedroom: 'rgba(232, 121, 249, 0.12)',
  bathroom: 'rgba(45, 212, 191, 0.12)',
  studio: 'rgba(251, 146, 60, 0.12)',
  terrace: 'transparent',
}

const COLD_LOCATIONS = new Set(['Anchorage'])

export const SpatialView = React.memo(function SpatialView({
  plan,
  sun,
  location,
}: {
  plan: PlanState
  sun: { altitude: number; azimuth: number }
  location: string
}) {
  const isColdClimate = COLD_LOCATIONS.has(location)
  const showWind = plan.systems.climate
  const showSolar = plan.systems.solar

  const sunStyle = useMemo(() => {
    if (sun.altitude <= 0) return null
    const left = 50 + 38 * Math.sin((sun.azimuth * Math.PI) / 180)
    const top = 14 + 30 * (1 - sun.altitude / 90)
    const opacity = Math.min(1, 0.4 + sun.altitude / 100)
    return { left: `${left}%`, top: `${top}%`, opacity }
  }, [sun.altitude, sun.azimuth])

  const windPoints = useMemo(() => {
    if (!showWind || plan.rooms.length < 2) return ''
    const sorted = [...plan.rooms].sort((a, b) => b.y - a.y)
    const midpoints = sorted.map((room) => `${room.x + room.w / 2},${room.y + room.h / 2}`)
    const south = sorted[0]
    const north = sorted[sorted.length - 1]
    const entry = `${south.x + south.w / 2},${Math.min(99, south.y + south.h + 6)}`
    const exit = `${north.x + north.w / 2},${Math.max(1, north.y - 6)}`
    return `${entry} ${midpoints.join(' ')} ${exit}`
  }, [showWind, plan.rooms])

  const sunRays = useMemo(() => {
    if (sun.altitude <= 0) return []
    const altRad = sun.altitude * (Math.PI / 180)
    const azRad = sun.azimuth * (Math.PI / 180)
    const dirX = -Math.sin(azRad) * Math.cos(altRad)
    const dirY = Math.cos(azRad) * Math.cos(altRad)
    return plan.openings
      .filter((opening) => opening.type === 'window')
      .map((window) => ({
        x1: window.x,
        y1: window.y,
        x2: window.x - dirX * 14,
        y2: window.y - dirY * 14,
      }))
  }, [plan.openings, sun.altitude, sun.azimuth])

  return (
    <div className="spatial-scene" aria-label="Section axonometric spatial view">
      {sunStyle && (
        <div className="spatial-sun" style={sunStyle}>
          <Sun />
        </div>
      )}

      <div className="spatial-board">
        <svg className="spatial-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {sunRays.map((ray, index) => (
            <line
              key={`ray-${index}`}
              x1={ray.x1}
              y1={ray.y1}
              x2={ray.x2}
              y2={ray.y2}
              className="spatial-sun-ray"
            />
          ))}
          {windPoints && <polyline points={windPoints} className="spatial-wind-path" />}
        </svg>

        {plan.rooms.map((room) => (
          <div
            key={room.id}
            className={`spatial-room spatial-${room.kind}`}
            style={{
              left: `${room.x}%`,
              top: `${room.y}%`,
              width: `${room.w}%`,
              height: `${room.h}%`,
              background: roomColors[room.kind],
            }}
          >
            {room.kind !== 'terrace' && (
              <>
                <i className="spatial-cut spatial-cut-n" aria-hidden="true" />
                <i className="spatial-cut spatial-cut-w" aria-hidden="true" />
              </>
            )}
            <span>{room.name}</span>
            {plan.systems.climate && room.kind !== 'terrace' && (
              <em className={`spatial-hvac ${isColdClimate ? 'is-heat' : 'is-cool'}`}>
                {isColdClimate ? 'Heat' : 'Cool'}
              </em>
            )}
          </div>
        ))}

        {plan.furniture.map((item) => {
          const rect = furnitureRect(item)
          const spec = furnitureCatalog[item.kind]
          return (
            <div
              key={item.id}
              className={`spatial-furniture spatial-furniture-${item.kind}`}
              style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
              title={spec.label}
            />
          )
        })}

        {plan.openings.map((opening) => (
          <div
            key={opening.id}
            className={`spatial-opening spatial-opening-${opening.type} rotate-${opening.rotation}`}
            style={{ left: `${opening.x}%`, top: `${opening.y}%` }}
          />
        ))}
      </div>

      {showSolar && <div className="spatial-solar-badge">Solar · 7.2 kWp</div>}

      <div className="spatial-note">
        <Box /> Section axonometric · 1:100{showWind ? ' · Breeze path on' : ''}
      </div>
    </div>
  )
})
