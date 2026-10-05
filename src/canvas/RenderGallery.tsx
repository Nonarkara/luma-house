import React, { useMemo, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, LampDesk, Layers3, Moon, PanelsTopLeft, Sun } from 'lucide-react'
import { siteOf } from '../plan'
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

type ViewId = 'wireframe' | 'interior' | 'joinery' | 'massing' | 'sunlit' | 'night'

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
  const site = useMemo(() => siteFootprint(scale, siteOf(plan)), [plan])
  const openings = useMemo(() => openingMarkers(plan.openings, scale, siteOf(plan)), [plan])
  const sunTip = useMemo(() => sunDirectionTip(sun.azimuth, sun.altitude, scale, siteOf(plan)), [sun, plan])
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
  localView,
  localControls,
}: {
  plan: PlanState
  sun: { altitude: number; azimuth: number }
  conceptImages: string[]
  localView: React.ReactNode
  localControls: React.ReactNode
  onRequestConcept: () => void
  isRendering: boolean
  quotaLeft: number
}) {
  const views: Array<{ id: ViewId; title: string; note: string; icon: typeof Layers3 }> = [
    { id: 'wireframe', title: 'Your space + light', note: 'Interactive · local · no AI call', icon: Layers3 },
    { id: 'massing', title: 'Live 3D massing', note: 'Computed from your drawing', icon: Layers3 },
    { id: 'sunlit', title: 'Sun direction diagram', note: `${sun.altitude.toFixed(0)}° altitude · schematic`, icon: Sun },
  ]
  const references = [
    { id: 'interior', title: 'South living room', note: 'Custom elm · winter 10:00', icon: PanelsTopLeft },
    { id: 'joinery', title: 'Joinery detail', note: 'Made-to-measure, not flat-pack', icon: LampDesk },
    { id: 'night', title: 'Tea scene', note: '2700 K · L05 at 78%', icon: Moon },
  ]
  const [referenceIndex, setReferenceIndex] = useState(0)
  const reference = references[referenceIndex]
  const [activeIndex, setActiveIndex] = useState(0)
  const active = views[activeIndex]
  const ActiveIcon = active.icon

  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + views.length) % views.length)
  }

  return (
    <div className="render-gallery" aria-label="Plan-driven render gallery">
      <div className={`render-stage ${active.id === 'wireframe' ? 'is-local-study' : ''}`}>
        {active.id === 'wireframe' && localView}
        {active.id === 'massing' && <MassingFrame plan={plan} sun={sun} />}
        {active.id === 'sunlit' && <MassingFrame plan={plan} sun={sun} warm />}
        {active.id !== 'wireframe' && <div className="render-meta">
          <span><ActiveIcon /></span>
          <div>
            <small>View 0{activeIndex + 1}</small>
            <strong>{active.title}</strong>
            <em>{active.note}</em>
          </div>
        </div>}
        <div className="render-nav">
          <button type="button" onClick={() => move(-1)} aria-label="Previous view"><ChevronLeft /></button>
          <span>{activeIndex + 1} / {views.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next view"><ChevronRight /></button>
        </div>
      </div>
      {active.id === 'wireframe' && <div className="render-local-controls">{localControls}</div>}
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
      <details className="render-references">
        <summary>Concept references · photographs do not represent your drawing</summary>
        <p><strong>Reference image only.</strong> This authored interior does not change with your rooms, city or sun. Study your actual shadows in “Your space + light” above.</p>
        <div className="render-thumbs">
          {references.map((item, index) => {
            const Icon = item.icon
            return <button key={item.id} type="button" className={index === referenceIndex ? 'active' : ''} onClick={() => setReferenceIndex(index)}>
              <Icon /><span><strong>{item.title}</strong><small>{item.note}</small></span>
            </button>
          })}
        </div>
        <img className={`concept-hero authored-interior ${reference.id}`} src={conceptImages[0] ?? './assets/shanghai-apartment-concept.png'} alt={`${reference.title} — authored reference, unrelated to the current drawing`} />
      </details>
      <div className="render-disclaimer">
        <Camera /> Local 3D uses your drawing and clear-sky sun angles · Interior references are optional concepts, not a prediction of your plan
      </div>
    </div>
  )
})
