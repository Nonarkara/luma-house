import { ArrowRight } from 'lucide-react'
import React, { type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { furnitureCatalog, furnitureRect, roomArea } from '../plan'
import type { Furniture, Opening, PlanState, PlanTool, Room, RoomKind } from '../types'
import type { ResizeHandle, StrokePoint } from './geometry'

const roomColors: Record<RoomKind, string> = {
  living: 'rgba(163, 255, 0, 0.06)',
  kitchen: 'rgba(56, 189, 248, 0.06)',
  bedroom: 'rgba(232, 121, 249, 0.06)',
  bathroom: 'rgba(45, 212, 191, 0.06)',
  studio: 'rgba(251, 146, 60, 0.06)',
  terrace: 'transparent',
}

const HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export const FloorPlan = React.memo(function FloorPlan({
  plan,
  selectedRoom,
  selectedOpening,
  selectedFurniture,
  furnitureConflicts,
  draftStroke,
  activeTool,
  sketchUrl,
  showSun,
  sunAngle,
  showGrid,
  viewportStyle,
  onRoomPointerDown,
  onOpeningPointerDown,
  onFurniturePointerDown,
  onGesturePointerMove,
  onGesturePointerUp,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasClick,
  stageRef,
}: {
  plan: PlanState
  selectedRoom: string | null
  selectedOpening: string | null
  selectedFurniture: string | null
  furnitureConflicts: Set<string>
  draftStroke: StrokePoint[] | null
  activeTool: PlanTool
  sketchUrl: string | null
  showSun: boolean
  sunAngle: number
  showGrid: boolean
  viewportStyle: CSSProperties
  onRoomPointerDown: (event: ReactPointerEvent, room: Room, handle?: ResizeHandle) => void
  onOpeningPointerDown: (event: ReactPointerEvent, opening: Opening) => void
  onFurniturePointerDown: (event: ReactPointerEvent, item: Furniture) => void
  onGesturePointerMove: (event: ReactPointerEvent) => void
  onGesturePointerUp: (event: ReactPointerEvent) => void
  onCanvasPointerDown: (event: ReactPointerEvent) => void
  onCanvasPointerMove: (event: ReactPointerEvent) => void
  onCanvasPointerUp: (event: ReactPointerEvent) => void
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void
  stageRef: RefObject<HTMLDivElement>
}) {
  const rayX = Math.max(1, Math.min(99, 50 + 72 * Math.sin((sunAngle * Math.PI) / 180)))
  const rayY = Math.max(1, Math.min(99, 50 - 72 * Math.cos((sunAngle * Math.PI) / 180)))

  return (
    <div
      className={`plan-viewport tool-${activeTool}`}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={(event) => {
        onCanvasPointerMove(event)
        onGesturePointerMove(event)
      }}
      onPointerUp={(event) => {
        onCanvasPointerUp(event)
        onGesturePointerUp(event)
      }}
      onPointerCancel={(event) => {
        onCanvasPointerUp(event)
        onGesturePointerUp(event)
      }}
      onClick={onCanvasClick}
      data-testid="plan-canvas"
    >
      <div className="plan-stage" style={viewportStyle}>
        <div ref={stageRef} className={`plan-canvas ${showGrid ? 'show-grid' : 'hide-grid'}`}>
          {sketchUrl && <img className="sketch-underlay" src={sketchUrl} alt="Uploaded sketch tracing layer" />}
          <div className="north-mark" aria-label="North points upward"><ArrowRight /> <span>N</span></div>
          <div className="scale-label">1:100 <span>•</span> 14 × 10 m site</div>
          {showSun && (
            <svg className="sun-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
              {[-18, -9, 0, 9, 18].map((offset) => (
                <line key={offset} x1={rayX + offset} y1={rayY} x2={50 + offset * .25} y2="50" stroke="#e2b53e" strokeOpacity=".48" strokeWidth=".55" vectorEffect="non-scaling-stroke" />
              ))}
              <circle cx={rayX} cy={rayY} r="2.3" fill="#f3c84a" />
            </svg>
          )}
          {plan.rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`room room-${room.kind} ${selectedRoom === room.id ? 'is-selected' : ''}`}
              style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`, background: roomColors[room.kind] }}
              onPointerDown={(event) => onRoomPointerDown(event, room)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`${room.name}, ${roomArea(room).toFixed(1)} square meters`}
            >
              <span className="room-name">{room.name}</span>
              <span className="room-area">{roomArea(room).toFixed(1)} m²</span>
              {selectedRoom === room.id && HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={`resize-handle handle-${handle}`}
                  onPointerDown={(event) => onRoomPointerDown(event, room, handle)}
                  aria-hidden="true"
                />
              ))}
            </button>
          ))}
          {plan.furniture.map((item) => {
            const rect = furnitureRect(item)
            const spec = furnitureCatalog[item.kind]
            return (
              <button
                key={item.id}
                type="button"
                className={`furniture ${selectedFurniture === item.id ? 'is-selected' : ''} ${furnitureConflicts.has(item.id) ? 'is-conflict' : ''}`}
                style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
                onPointerDown={(event) => onFurniturePointerDown(event, item)}
                onClick={(event) => event.stopPropagation()}
                aria-label={`${spec.label}, ${spec.w} by ${spec.d} meters${furnitureConflicts.has(item.id) ? ', blocks a door swing' : ''}`}
              >
                <span>{spec.label}</span>
              </button>
            )
          })}
          {plan.openings.map((opening) => (
            <button
              key={opening.id}
              type="button"
              className={`opening opening-${opening.type} rotate-${opening.rotation} ${selectedOpening === opening.id ? 'is-selected' : ''}`}
              style={{ left: `${opening.x}%`, top: `${opening.y}%` }}
              title={opening.type}
              aria-label={`${opening.type} opening`}
              onPointerDown={(event) => onOpeningPointerDown(event, opening)}
              onClick={(event) => event.stopPropagation()}
            >
              {opening.type === 'door' && <i />}
            </button>
          ))}
          {draftStroke && draftStroke.length > 1 && (
            <svg className="draw-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={draftStroke.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity="0.9"
              />
            </svg>
          )}
          <div className="dimension dimension-x"><span>14,000</span></div>
          <div className="dimension dimension-y"><span>10,000</span></div>
        </div>
      </div>
    </div>
  )
})
