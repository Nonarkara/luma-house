import { ArrowRight } from 'lucide-react'
import React, { type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { furnitureCatalog, furnitureRectFor, roomAreaFor, siteOf } from '../plan'
import type { SunPatch } from '../plan'
import type { Furniture, Opening, PlanState, PlanTool, Room, RoomKind } from '../types'
import type { ResizeHandle, StrokePoint } from './geometry'

const roomColors: Record<RoomKind, string> = {
  living: 'rgba(245, 158, 11, 0.07)',
  kitchen: 'rgba(245, 158, 11, 0.055)',
  bedroom: 'rgba(245, 158, 11, 0.04)',
  bathroom: 'rgba(245, 158, 11, 0.025)',
  studio: 'rgba(245, 158, 11, 0.045)',
  terrace: 'transparent',
}

const HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export const FloorPlan = React.memo(function FloorPlan({
  plan,
  selectedRoom,
  selectedOpening,
  selectedFurniture,
  furnitureConflicts,
  overlaps,
  draftStroke,
  activeTool,
  sketchUrl,
  showSun,
  sunAngle,
  sunPatchList,
  showGrid,
  gridCellX,
  gridCellY,
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
  overlaps: Set<string>
  draftStroke: StrokePoint[] | null
  activeTool: PlanTool
  sketchUrl: string | null
  showSun: boolean
  sunAngle: number
  sunPatchList: SunPatch[]
  showGrid: boolean
  gridCellX: number
  gridCellY: number
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
  const site = siteOf(plan)
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
        <div
          ref={stageRef}
          className={`plan-canvas ${showGrid ? 'show-grid' : 'hide-grid'}`}
          style={{ '--grid-cell-x': `${gridCellX}%`, '--grid-cell-y': `${gridCellY}%` } as CSSProperties}
        >
          {sketchUrl && <img className="sketch-underlay" src={sketchUrl} alt="Uploaded sketch tracing layer" />}
          <div className="north-mark" aria-label="North points upward"><ArrowRight /> <span>N</span></div>
          <div className="scale-label">{site.unit} m grid <span>•</span> {site.w.toFixed(1)} × {site.h.toFixed(1)} m field</div>
          {showSun && (
            <svg className="sun-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
              {Array.from(new Set(sunPatchList.map((patch) => patch.roomId))).map((roomId) => {
                const litRoom = plan.rooms.find((item) => item.id === roomId)
                if (!litRoom) return null
                return (
                  <clipPath key={roomId} id={`clip-${roomId}`}>
                    <rect x={litRoom.x} y={litRoom.y} width={litRoom.w} height={litRoom.h} />
                  </clipPath>
                )
              })}
              {sunPatchList.map((patch) => (
                <polygon
                  key={patch.windowId}
                  points={patch.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="#f3c84a"
                  fillOpacity="0.16"
                  stroke="none"
                  clipPath={`url(#clip-${patch.roomId})`}
                />
              ))}
              <circle cx={rayX} cy={rayY} r="2.3" fill="#f3c84a" />
            </svg>
          )}
          {plan.rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`room room-${room.kind} ${selectedRoom === room.id ? 'is-selected' : ''} ${overlaps.has(room.id) ? 'is-overlap' : ''}`}
              style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`, background: roomColors[room.kind] }}
              onPointerDown={(event) => onRoomPointerDown(event, room)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`${room.name}, ${roomAreaFor(room, site).toFixed(1)} square meters`}
            >
              <span className="room-name">{room.name}</span>
              <span className="room-area">{roomAreaFor(room, site).toFixed(1)} m²</span>
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
            const rect = furnitureRectFor(item, site)
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
          <div className="dimension dimension-x"><span>{Math.round(site.w * 1000).toLocaleString()}</span></div>
          <div className="dimension dimension-y"><span>{Math.round(site.h * 1000).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  )
})
