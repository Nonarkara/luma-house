import { ArrowRight } from 'lucide-react'
import React, { type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { furnitureCatalog, furnitureRectFor, roomAreaFor, siteOf } from '../plan'
import type { SunPatch } from '../plan'
import type { Furniture, Opening, PlanState, PlanTool, Room, RoomKind } from '../types'
import type { DaylightBand, RoomEgressRoute, RoomWindPotential } from '../analysis'
import { exteriorWalls } from '../analysis'
import type { ValueLensMode } from '../components/ValueLens'
import type { Compass } from '../analysis'
import type { ResizeHandle, StrokePoint } from './geometry'
import type { NapkinCalibrationLine } from './napkinScale'

const roomColors: Record<RoomKind, string> = {
  living: 'rgba(245, 158, 11, 0.07)',
  kitchen: 'rgba(245, 158, 11, 0.055)',
  bedroom: 'rgba(245, 158, 11, 0.04)',
  bathroom: 'rgba(245, 158, 11, 0.025)',
  studio: 'rgba(245, 158, 11, 0.045)',
  terrace: 'transparent',
}

const HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function wallPoint(room: Room, compass: Compass): { x: number; y: number } {
  if (compass === 'N') return { x: room.x + room.w / 2, y: room.y }
  if (compass === 'S') return { x: room.x + room.w / 2, y: room.y + room.h }
  if (compass === 'W') return { x: room.x, y: room.y + room.h / 2 }
  return { x: room.x + room.w, y: room.y + room.h / 2 }
}

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
  valueLens,
  daylightBands,
  windRooms,
  egressRooms,
  showGrid,
  gridCellX,
  gridCellY,
  viewportStyle,
  napkinRuler,
  rulerArmed,
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
  valueLens: ValueLensMode
  daylightBands: DaylightBand[]
  windRooms: RoomWindPotential[]
  egressRooms: RoomEgressRoute[]
  showGrid: boolean
  gridCellX: number
  gridCellY: number
  viewportStyle: CSSProperties
  napkinRuler?: NapkinCalibrationLine | null
  rulerArmed?: boolean
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
      className={`plan-viewport tool-${activeTool}${rulerArmed ? ' tool-ruler' : ''}`}
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
              onClick={(event) => {
                if (activeTool === 'select') event.stopPropagation()
              }}
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
          {valueLens !== 'off' && valueLens !== 'shade' && (
            <svg className={`value-plan-overlay is-${valueLens}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="value-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-primary)" />
                </marker>
                <pattern id="no-route-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="3" stroke="var(--accent-primary)" strokeWidth="0.5" opacity="0.34" />
                </pattern>
              </defs>
              {valueLens === 'daylight' && daylightBands.map((band) => {
                const room = plan.rooms.find((item) => item.id === band.roomId)
                if (!room) return null
                const fraction = band.reachPct / 100
                const spread = band.spreadPct / 100
                const offset = band.offsetPct / 100
                const alongStart = Math.max(0, Math.min(1 - spread, offset - spread / 2))
                const rect = band.compass === 'N'
                  ? { x: room.x + room.w * alongStart, y: room.y, w: room.w * spread, h: room.h * fraction }
                  : band.compass === 'S'
                    ? { x: room.x + room.w * alongStart, y: room.y + room.h * (1 - fraction), w: room.w * spread, h: room.h * fraction }
                    : band.compass === 'W'
                      ? { x: room.x, y: room.y + room.h * alongStart, w: room.w * fraction, h: room.h * spread }
                      : { x: room.x + room.w * (1 - fraction), y: room.y + room.h * alongStart, w: room.w * fraction, h: room.h * spread }
                return <rect key={`${band.roomId}-${band.openingId}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} className="daylight-reach" />
              })}
              {valueLens === 'air' && windRooms.map((item) => {
                const room = item.room
                const inlet = item.inlet ? wallPoint(room, item.inlet) : null
                const outlet = item.outlet ? wallPoint(room, item.outlet) : null
                return (
                  <g key={room.id}>
                    <rect x={room.x} y={room.y} width={room.w} height={room.h} className={`wind-room is-${item.mode}`} />
                    {inlet && outlet && <line x1={inlet.x} y1={inlet.y} x2={outlet.x} y2={outlet.y} className="wind-path" markerEnd="url(#value-arrow)" />}
                    <text x={room.x + room.w / 2} y={room.y + room.h - 2.2} className="value-overlay-label">
                      {item.inlet && item.outlet ? `${item.inlet} → ${item.outlet}` : item.mode.replace('-', ' ')}
                    </text>
                  </g>
                )
              })}
              {valueLens === 'escape' && egressRooms.map((item) => (
                <g key={item.room.id}>
                  {!item.connected && <rect x={item.room.x} y={item.room.y} width={item.room.w} height={item.room.h} fill="url(#no-route-hatch)" className="egress-missing" />}
                  {item.connected && item.points.length > 1 && (
                    <polyline points={item.points.map((point) => `${point.x},${point.y}`).join(' ')} className="egress-path" markerEnd="url(#value-arrow)" />
                  )}
                  <text x={item.room.x + item.room.w / 2} y={item.room.y + item.room.h - 2.2} className={`value-overlay-label ${item.connected ? '' : 'is-alert'}`}>
                    {item.connected ? `~${item.distanceM?.toFixed(1)} m out` : 'no modeled exit'}
                  </text>
                </g>
              ))}
              {valueLens === 'shell' && exteriorWalls(plan).map((wall, index) => {
                const room = plan.rooms.find((item) => item.id === wall.roomId)
                if (!room) return null
                const start = wall.compass === 'N'
                  ? { x: room.x, y: room.y }
                  : wall.compass === 'S'
                    ? { x: room.x, y: room.y + room.h }
                    : wall.compass === 'W'
                      ? { x: room.x, y: room.y }
                      : { x: room.x + room.w, y: room.y }
                const end = wall.compass === 'N'
                  ? { x: room.x + room.w, y: room.y }
                  : wall.compass === 'S'
                    ? { x: room.x + room.w, y: room.y + room.h }
                    : wall.compass === 'W'
                      ? { x: room.x, y: room.y + room.h }
                      : { x: room.x + room.w, y: room.y + room.h }
                return <line key={`${wall.roomId}-${wall.compass}-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="envelope-wall" />
              })}
            </svg>
          )}
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
          {plan.openings.map((opening) => {
            const w = opening.widthM ?? (opening.type === 'window' ? 1.6 : 0.9)
            const h = opening.heightM ?? (opening.type === 'window' ? 1.2 : 2.1)
            const isSel = selectedOpening === opening.id
            return (
              <button
                key={opening.id}
                type="button"
                className={`opening opening-${opening.type} rotate-${opening.rotation} ${isSel ? 'is-selected' : ''}`}
                style={{ left: `${opening.x}%`, top: `${opening.y}%` }}
                title={`${opening.type} (${w.toFixed(1)}m × ${h.toFixed(1)}m)`}
                aria-label={`${opening.type} opening ${w.toFixed(1)} by ${h.toFixed(1)} meters`}
                onPointerDown={(event) => onOpeningPointerDown(event, opening)}
                onClick={(event) => event.stopPropagation()}
              >
                {opening.type === 'door' && <i />}
                {isSel && (
                  <span className="opening-dim-badge">
                    {w.toFixed(1)}×{h.toFixed(1)}m
                  </span>
                )}
              </button>
            )
          })}

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
          {napkinRuler && (
            <svg className="draw-overlay napkin-ruler-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line
                x1={napkinRuler.p1.x}
                y1={napkinRuler.p1.y}
                x2={napkinRuler.p2.x}
                y2={napkinRuler.p2.y}
                stroke="var(--accent-primary)"
                strokeWidth="3"
                strokeDasharray="4 2"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={napkinRuler.p1.x} cy={napkinRuler.p1.y} r="1.5" fill="var(--accent-primary)" />
              <circle cx={napkinRuler.p2.x} cy={napkinRuler.p2.y} r="1.5" fill="var(--accent-primary)" />
            </svg>
          )}
          <div className="dimension dimension-x"><span>{Math.round(site.w * 1000).toLocaleString()}</span></div>
          <div className="dimension dimension-y"><span>{Math.round(site.h * 1000).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  )
})
