import React, { useMemo, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Layers3, Sun } from 'lucide-react'
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

type ViewId = 'massing' | 'sunlit' | 'concept'

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
  onRequestConcept,
  isRendering,
  quotaLeft,
}: {
  plan: PlanState
  sun: { altitude: number; azimuth: number }
  conceptImages: string[]
  onRequestConcept: () => void
  isRendering: boolean
  quotaLeft: number
}) {
  const views: Array<{ id: ViewId; title: string; note: string; icon: typeof Layers3 }> = [
    { id: 'massing', title: 'Your massing', note: 'From live plan', icon: Layers3 },
    { id: 'sunlit', title: 'Sun study', note: `${sun.altitude.toFixed(0)}° altitude`, icon: Sun },
    { id: 'concept', title: 'Concept photo', note: conceptImages[0] ? 'Gemini visualize' : 'Generate when ready', icon: ImagePlus },
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
        {active.id === 'concept' && (
          conceptImages[0] ? (
            <img className="concept-hero" src={conceptImages[0]} alt="Latest concept visualization" />
          ) : (
            <div className="concept-empty">
              <ImagePlus />
              <strong>No concept photo yet</strong>
              <p>Massing above is exact to your plan. Concept photos are AI visualizations — labeled honestly, limited to 3/day.</p>
              <button
                type="button"
                className="button primary"
                onClick={onRequestConcept}
                disabled={isRendering || quotaLeft <= 0}
              >
                {isRendering ? 'Rendering…' : `Generate concept · ${quotaLeft} left`}
              </button>
            </div>
          )
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
        <Camera /> Massing matches your plan · Concept photos are visualizations, not construction documents
      </div>
    </div>
  )
})
