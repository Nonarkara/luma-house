import React, { useMemo, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, LampDesk, Layers3, Moon, PanelsTopLeft, Sun } from 'lucide-react'
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
  living: '#c8c0ad',
  kitchen: '#b8c4c8',
  bedroom: '#c9b8c4',
  bathroom: '#b0c4c0',
  studio: '#c4b8a8',
  terrace: '#6b7a6e',
}

type ViewId = 'interior' | 'joinery' | 'massing' | 'sunlit' | 'night'

function MassingFrame({
  plan,
  sun,
  warm,
}: {
  plan: PlanState
  sun: { altitude: number; azimuth: number }
  warm?: boolean
}) {
  const scale = 22
  const boxes = useMemo(() => buildMassing(plan, scale), [plan])
  const bounds = useMemo(() => massingBounds(boxes, 36), [boxes])
  const site = useMemo(() => siteFootprint(scale), [])
  const openings = useMemo(() => openingMarkers(plan.openings, scale), [plan.openings])
  const sunTip = useMemo(() => sunDirectionTip(sun.azimuth, sun.altitude, scale), [sun])
  const siteCenter = useMemo(() => ({
    x: site.reduce((s, p) => s + p.x, 0) / site.length,
    y: site.reduce((s, p) => s + p.y, 0) / site.length,
  }), [site])

  return (
    <svg
      className="architectural-render massing-render"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      role="img"
      aria-label="Plan-driven isometric rendering"
    >
      <rect
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.width}
        height={bounds.height}
        className={warm ? 'render-sky-warm' : 'render-sky-cool'}
      />
      <polygon points={poly(site)} className="massing-site render-site" />
      {boxes.map((box) => (
        <g key={box.room.id}>
          <polygon points={poly(box.left)} className="massing-face massing-left" />
          <polygon points={poly(box.right)} className="massing-face massing-right" />
          <polygon
            points={poly(box.top)}
            className="massing-face massing-top"
            style={{
              fill: warm ? '#ddd5c2' : roofFill[box.room.kind],
              fillOpacity: box.room.kind === 'terrace' ? 0.4 : 0.85,
            }}
          />
        </g>
      ))}
      {openings.map((marker, index) => (
        <circle
          key={index}
          cx={marker.point.x}
          cy={marker.point.y}
          r={marker.type === 'window' ? 3.6 : 2.6}
          className={marker.type === 'window' ? 'massing-window' : 'massing-door'}
        />
      ))}
      {sunTip && (
        <g className="massing-sun-ray">
          <line x1={siteCenter.x} y1={siteCenter.y} x2={sunTip.x} y2={sunTip.y} />
          <circle cx={sunTip.x} cy={sunTip.y} r={5} />
        </g>
      )}
    </svg>
  )
}

export const RenderGallery = React.memo(function RenderGallery({
  plan,
  sun,
  conceptImages,
}: {
  plan: PlanState
  sun: { altitude: number; azimuth: number }
  conceptImages: string[]
  onRequestConcept: () => void
  isRendering: boolean
  quotaLeft: number
}) {
  const views: Array<{ id: ViewId; title: string; note: string; icon: typeof Layers3 }> = [
    { id: 'interior', title: 'South living room', note: 'Custom elm · winter 10:00', icon: PanelsTopLeft },
    { id: 'joinery', title: 'Joinery detail', note: 'Made-to-measure, not flat-pack', icon: LampDesk },
    { id: 'massing', title: 'Live 3D massing', note: 'Exact to the 50 m² plan', icon: Layers3 },
    { id: 'sunlit', title: 'Solar volume', note: `${sun.altitude.toFixed(0)}° altitude`, icon: Sun },
    { id: 'night', title: 'Tea scene', note: '2700 K · L05 at 78%', icon: Moon },
  ]
  const [activeIndex, setActiveIndex] = useState(0)
  const active = views[activeIndex]
  const ActiveIcon = active.icon

  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + views.length) % views.length)
  }

  return (
    <div className="render-gallery" aria-label="Plan-driven render gallery">
      <div className="render-stage">
        {active.id === 'massing' && <MassingFrame plan={plan} sun={sun} />}
        {active.id === 'sunlit' && <MassingFrame plan={plan} sun={sun} warm />}
        {(active.id === 'interior' || active.id === 'joinery' || active.id === 'night') && (
          <img
            className={`concept-hero authored-interior ${active.id}`}
            src={conceptImages[0] ?? '/assets/shanghai-apartment-concept.png'}
            alt={`${active.title} architectural concept visualization`}
          />
        )}
        <div className="render-meta">
          <span><ActiveIcon /></span>
          <div>
            <small>View 0{activeIndex + 1}</small>
            <strong>{active.title}</strong>
            <em>{active.note}</em>
          </div>
        </div>
        <div className="render-nav">
          <button type="button" onClick={() => move(-1)} aria-label="Previous view"><ChevronLeft /></button>
          <span>{activeIndex + 1} / {views.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next view"><ChevronRight /></button>
        </div>
      </div>
      <div className="render-thumbs">
        {views.map((item, index) => {
          const Icon = item.icon
          return (
            <button key={item.id} type="button" className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
              <Icon /><span><strong>{item.title}</strong><small>{item.note}</small></span>
            </button>
          )
        })}
      </div>
      <div className="render-disclaimer">
        <Camera /> 3D massing matches the plan · Photoreal views are authored concept visualizations, not construction documents
      </div>
    </div>
  )
})
