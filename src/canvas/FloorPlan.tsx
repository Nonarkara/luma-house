import { ArrowRight } from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { roomArea } from '../plan'
import type { Opening, PlanState, Room, RoomKind } from '../types'
import type { ResizeHandle } from './geometry'

const roomColors: Record<RoomKind, string> = {
  living: '#e9e0cd',
  kitchen: '#d7dfce',
  bedroom: '#e4d9d3',
  bathroom: '#d9e2e0',
  studio: '#e8e4d6',
  terrace: '#dce8d1',
}

const HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export function FloorPlan({
  plan,
  selectedRoom,
  selectedOpening,
  activeTool,
  sketchUrl,
  showSun,
  sunAngle,
  showGrid,
  viewportStyle,
  onRoomPointerDown,
  onOpeningPointerDown,
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
  activeTool: 'select' | 'window' | 'door'
  sketchUrl: string | null
  showSun: boolean
  sunAngle: number
  showGrid: boolean
  viewportStyle: CSSProperties
  onRoomPointerDown: (event: ReactPointerEvent, room: Room, handle?: ResizeHandle) => void
  onOpeningPointerDown: (event: ReactPointerEvent, opening: Opening) => void
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
          <div className="dimension dimension-x"><span>14,000</span></div>
          <div className="dimension dimension-y"><span>10,000</span></div>
        </div>
      </div>
    </div>
  )
}
