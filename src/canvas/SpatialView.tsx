import React, { useMemo } from 'react'
import { Box, Layers3 } from 'lucide-react'
import type { PlanState, RoomKind } from '../types'
import {
  buildMassing,
  massingBounds,
  openingMarkers,
  poly,
  siteFootprint,
  sunDirectionTip,
} from './isometric'

const roofFill: Record<RoomKind, string> = {
  living: '#a3ff00',
  kitchen: '#38bdf8',
  bedroom: '#e879f9',
  bathroom: '#2dd4bf',
  studio: '#fb923c',
  terrace: '#64748b',
}

const COLD = new Set(['Anchorage'])

export const SpatialView = React.memo(function SpatialView({
  plan,
  sun,
  location,
}: {
  plan: PlanState
  sun: { altitude: number; azimuth: number }
  location: string
}) {
  const scale = 20
  const boxes = useMemo(() => buildMassing(plan, scale), [plan])
  const bounds = useMemo(() => massingBounds(boxes), [boxes])
  const site = useMemo(() => siteFootprint(scale), [])
  const openings = useMemo(() => openingMarkers(plan.openings, scale), [plan.openings])
  const sunTip = useMemo(() => sunDirectionTip(sun.azimuth, sun.altitude, scale), [sun])
  const siteCenter = useMemo(() => {
    const x = site.reduce((sum, p) => sum + p.x, 0) / site.length
    const y = site.reduce((sum, p) => sum + p.y, 0) / site.length
    return { x, y }
  }, [site])
  const isCold = COLD.has(location)

  return (
    <div className="spatial-scene spatial-massing" aria-label="3D massing from your plan">
      <svg
        className="massing-svg"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        role="img"
        aria-label="Isometric 3D model generated from the floor plan"
      >
        <polygon points={poly(site)} className="massing-site" />

        {boxes.map((box) => (
          <g key={box.room.id} className={`massing-box massing-${box.room.kind}`}>
            <polygon points={poly(box.left)} className="massing-face massing-left" />
            <polygon points={poly(box.right)} className="massing-face massing-right" />
            <polygon
              points={poly(box.top)}
              className="massing-face massing-top"
              style={{ fill: roofFill[box.room.kind], fillOpacity: box.room.kind === 'terrace' ? 0.35 : 0.55 }}
            />
            <text x={box.label.x} y={box.label.y} className="massing-label">
              {box.room.name}
            </text>
          </g>
        ))}

        {openings.map((marker, index) => (
          <circle
            key={index}
            cx={marker.point.x}
            cy={marker.point.y}
            r={marker.type === 'window' ? 3.2 : 2.4}
            className={marker.type === 'window' ? 'massing-window' : 'massing-door'}
          />
        ))}

        {sunTip && (
          <g className="massing-sun-ray">
            <line x1={siteCenter.x} y1={siteCenter.y} x2={sunTip.x} y2={sunTip.y} />
            <circle cx={sunTip.x} cy={sunTip.y} r={4} />
          </g>
        )}
      </svg>

      <div className="spatial-hud">
        {plan.systems.solar && <span className="spatial-solar-badge">Solar on</span>}
        {plan.systems.climate && (
          <span className={`spatial-hvac-chip ${isCold ? 'is-heat' : 'is-cool'}`}>
            {isCold ? 'Heating zones' : 'Cooling zones'}
          </span>
        )}
        {plan.systems.insulation && (
          <span className="spatial-shell-chip"><Layers3 /> High-performance shell</span>
        )}
      </div>

      <div className="spatial-note">
        <Box /> Live 3D massing from your plan · 1:100 · {plan.rooms.length} volumes
        {sun.altitude > 0 ? ` · Sun ${sun.altitude.toFixed(0)}° / ${sun.azimuth.toFixed(0)}°` : ' · Sun below horizon'}
      </div>
    </div>
  )
})
