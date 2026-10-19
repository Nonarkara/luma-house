import { openingDimensions } from '../openingGeometry'
import React, { type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { useI18n } from '../i18n'
import { furnitureCatalog, furnitureLabelFor, furnitureRectFor, furnitureSpecFor, roomAreaFor, siteOf } from '../plan'
import type { SunPatch } from '../plan'
import type { Furniture, Opening, PlanState, PlanTool, Room, RoomKind } from '../types'
import type { DaylightBand, RoomEgressRoute, RoomWindPotential } from '../analysis'
import { exteriorWalls } from '../analysis'
import type { ValueLensMode } from '../components/ValueLens'
import type { Compass } from '../analysis'
import { type ResizeHandle, type StrokePoint } from './geometry'
import type { NapkinCalibrationLine } from './napkinScale'
import { type WallHit } from './wallHost'

const roomColors: Record<RoomKind, string> = {
  living: 'rgba(var(--studio-action-rgb, 138, 76, 22), 0.07)',
  kitchen: 'rgba(var(--studio-action-rgb, 138, 76, 22), 0.055)',
  bedroom: 'rgba(var(--studio-action-rgb, 138, 76, 22), 0.04)',
  bathroom: 'rgba(var(--studio-action-rgb, 138, 76, 22), 0.025)',
  studio: 'rgba(var(--studio-action-rgb, 138, 76, 22), 0.045)',
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
  liveDragRect,
  alignGuides,
  measureStart,
  measureEnd,
  openingGhost = null,
  roomDraft = null,
  wallNote = false,
  cornerNote = null,
  showEmptyHint = false,
  onPlaceOpening,
  onRoomPointerDown,
  onRoomSelect,
  onOpeningPointerDown,
  onFurniturePointerDown,
  onGesturePointerMove,
  onGesturePointerUp,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerCancel,
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
  liveDragRect?: { id: string; x: number; y: number; w: number; h: number } | null
  alignGuides?: { x: number[]; y: number[] } | null
  measureStart?: { x: number; y: number } | null
  measureEnd?: { x: number; y: number } | null
  openingGhost?: WallHit | null
  roomDraft?: { x: number; y: number; w: number; h: number } | null
  wallNote?: boolean
  cornerNote?: { x: number; y: number } | null
  showEmptyHint?: boolean
  onSetOpeningType?: (id: string, type: Opening['type']) => void
  onPlaceOpening?: (clientX: number, clientY: number) => void
  onRoomPointerDown: (event: ReactPointerEvent, room: Room, handle?: ResizeHandle) => void
  onRoomSelect: (room: Room) => void
  onOpeningPointerDown: (event: ReactPointerEvent, opening: Opening, end?: 'start' | 'end') => void
  onFurniturePointerDown: (event: ReactPointerEvent, item: Furniture) => void
  onGesturePointerMove: (event: ReactPointerEvent) => void
  onGesturePointerUp: (event: ReactPointerEvent) => void
  onCanvasPointerDown: (event: ReactPointerEvent) => void
  onCanvasPointerMove: (event: ReactPointerEvent) => void
  onCanvasPointerUp: (event: ReactPointerEvent) => void
  onCanvasPointerCancel: (event: ReactPointerEvent) => void
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void
  stageRef: RefObject<HTMLDivElement>
}) {
  const { tr } = useI18n()
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
        onCanvasPointerCancel(event)
        onGesturePointerUp(event)
      }}
      onClick={onCanvasClick}
      data-testid="plan-canvas"
    >
      <div className="plan-stage" style={viewportStyle}>
        <div
          ref={stageRef}
          className={`plan-canvas ${showGrid ? 'show-grid' : 'hide-grid'}`}
          style={{ '--site-ratio': site.w / site.h, '--grid-cell-x': `${gridCellX}%`, '--grid-cell-y': `${gridCellY}%` } as CSSProperties}
        >
          {sketchUrl && <img className="sketch-underlay" src={sketchUrl} alt="Uploaded sketch tracing layer" />}
          {alignGuides && (
            <svg className="align-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {alignGuides.x.map((x) => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={100} className="align-line" vectorEffect="non-scaling-stroke" />)}
              {alignGuides.y.map((y) => <line key={`y${y}`} x1={0} y1={y} x2={100} y2={y} className="align-line" vectorEffect="non-scaling-stroke" />)}
            </svg>
          )}
          {liveDragRect && (
            <svg className="snap-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line
                x1={liveDragRect.x} y1={0} x2={liveDragRect.x} y2={100}
                className="snap-line snap-vertical"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={liveDragRect.x + liveDragRect.w} y1={0}
                x2={liveDragRect.x + liveDragRect.w} y2={100}
                className="snap-line snap-vertical"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={0} y1={liveDragRect.y} x2={100} y2={liveDragRect.y}
                className="snap-line snap-horizontal"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={0} y1={liveDragRect.y + liveDragRect.h}
                x2={100} y2={liveDragRect.y + liveDragRect.h}
                className="snap-line snap-horizontal"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          <div className="north-mark" aria-label={tr('North points upward')}><span>N</span></div>
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
                if (activeTool === 'select') {
                  event.stopPropagation()
                  if (event.detail === 0) onRoomSelect(room)
                }
              }}
              aria-label={`${room.name}, ${roomAreaFor(room, site).toFixed(1)} square meters`}
              title={`${room.name} · ${roomAreaFor(room, site).toFixed(1)} m²`}
            >
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
          {liveDragRect && (() => {
            const wMeters = (liveDragRect.w / 100) * site.w
            const hMeters = (liveDragRect.h / 100) * site.h
            const left = liveDragRect.x + liveDragRect.w
            const top = liveDragRect.y
            return (
              <div
                className="live-dim"
                style={{ left: `${Math.min(99, left + 1)}%`, top: `${Math.max(1, top - 4)}%` }}
                aria-live="polite"
              >
                <strong>{wMeters.toFixed(2)} × {hMeters.toFixed(2)} m</strong>
                <small>{((wMeters * hMeters)).toFixed(1)} m²</small>
              </div>
            )
          })()}
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
            const dimensions = furnitureSpecFor(item)
            return (
              <button
                key={item.id}
                type="button"
                className={`furniture ${selectedFurniture === item.id ? 'is-selected' : ''} ${furnitureConflicts.has(item.id) ? 'is-conflict' : ''}`}
                style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
                onPointerDown={(event) => onFurniturePointerDown(event, item)}
                onClick={(event) => {
                  if (activeTool === 'select') event.stopPropagation()
                }}
                aria-label={`${spec.label}, ${item.rotated ? dimensions.d : dimensions.w} by ${item.rotated ? dimensions.w : dimensions.d} meters${furnitureConflicts.has(item.id) ? ', blocks a door swing' : ''}`}
                title={`${spec.label} · ${dimensions.w} × ${dimensions.d} m`}
              >
                <span>{item.kind === 'wc' ? 'WC' : furnitureLabelFor(item)}</span>
              </button>
            )
          })}
          {plan.openings.map((opening) => {
            const w = openingDimensions(opening).width
            const h = openingDimensions(opening).height
            const isSel = selectedOpening === opening.id
            // Real width: the sheet keeps the site's aspect ratio, so a width as a
            // percentage of sheet width is right on both axes (vertical walls rotate).
            const spanPct = (w / site.w) * 100
            return (
              <button
                key={opening.id}
                type="button"
                className={`opening opening-${opening.type} rotate-${opening.rotation} ${isSel ? 'is-selected' : ''}`}
                style={{ left: `${opening.x}%`, top: `${opening.y}%`, width: `${spanPct}%`, ['--span' as string]: spanPct } as CSSProperties}
                data-rotation={opening.rotation}
                title={`${opening.type} ${w.toFixed(2)} × ${h.toFixed(2)} m — drag to move, drag an end to resize`}
                aria-label={`${opening.type} opening ${w.toFixed(2)} by ${h.toFixed(2)} meters`}
                onPointerDown={(event) => onOpeningPointerDown(event, opening)}
                onClick={(event) => {
                  if (activeTool === 'select') event.stopPropagation()
                }}
              >
                {opening.type === 'window' ? (
                  <svg className="opening-glyph" viewBox="0 0 34 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <rect x="0.5" y="0.5" width="33" height="5" fill="rgb(34 80 108 / 0.3)" stroke="#006eb8" strokeWidth="1" />
                    <rect x="0" y="0" width="4" height="6" fill="#006eb8" />
                    <rect x="30" y="0" width="4" height="6" fill="#006eb8" />
                  </svg>
                ) : (
                  <svg className="opening-glyph is-door" viewBox="0 0 26 26" preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
                    <path d="M1 3h24" stroke="#f68c50" strokeWidth="3" />
                    <path d="M1 3a22 22 0 0 1 22 22" fill="none" stroke="#f68c50" strokeWidth="1" />
                  </svg>
                )}
                {isSel && (
                  <>
                    <span className="opening-handle is-start" aria-hidden="true" onPointerDown={(event) => onOpeningPointerDown(event, opening, 'start')} />
                    <span className="opening-handle is-end" aria-hidden="true" onPointerDown={(event) => onOpeningPointerDown(event, opening, 'end')} />
                    <span className="opening-dim-badge">
                      {w.toFixed(2)} m
                    </span>
                  </>
                )}
              </button>
            )
          })}

          {openingGhost && (
            <>
              <svg className="draw-overlay wall-highlight" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line x1={openingGhost.x1} y1={openingGhost.y1} x2={openingGhost.x2} y2={openingGhost.y2} className="wall-highlight-line" vectorEffect="non-scaling-stroke" />
              </svg>
              <div
                className={`opening opening-${activeTool === 'door' ? 'door' : 'window'} rotate-${openingGhost.rotation} is-ghost`}
                style={{ left: `${openingGhost.x}%`, top: `${openingGhost.y}%`, width: `${((activeTool === 'door' ? 0.9 : 1.6) / site.w) * 100}%` }}
                aria-hidden="true"
              />
            </>
          )}
          {roomDraft && roomDraft.w > 0 && roomDraft.h > 0 && (
            <div className="room-draft" style={{ left: `${roomDraft.x}%`, top: `${roomDraft.y}%`, width: `${roomDraft.w}%`, height: `${roomDraft.h}%` }} aria-hidden="true" />
          )}
          {showEmptyHint && <p className="canvas-empty-line">{tr('Drag a box to make a room. Then click a wall to add a window.')}</p>}
          {wallNote && <p className="wall-note" role="status">{tr('Click a wall')}</p>}
          {cornerNote && (
            <p className="corner-note" role="status" style={{ left: `${cornerNote.x}%`, top: `${cornerNote.y}%` }}>
              Corners don't meet
            </p>
          )}
          {plan.walls && plan.walls.length > 0 && (
            <svg className="draw-overlay napkin-walls" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {plan.walls.map((wall) => (
                <line
                  key={wall.id}
                  x1={wall.x1}
                  y1={wall.y1}
                  x2={wall.x2}
                  y2={wall.y2}
                  className="napkin-wall"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
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
          {measureStart && measureEnd && (() => {
            const dx = ((measureEnd.x - measureStart.x) / 100) * site.w
            const dy = ((measureEnd.y - measureStart.y) / 100) * site.h
            const meters = Math.sqrt(dx * dx + dy * dy)
            const feet = meters * 3.28084
            const midX = (measureStart.x + measureEnd.x) / 2
            const midY = (measureStart.y + measureEnd.y) / 2
            return (
              <svg className="draw-overlay measure-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line
                  x1={measureStart.x} y1={measureStart.y}
                  x2={measureEnd.x} y2={measureEnd.y}
                  stroke="var(--accent-primary)"
                  strokeWidth="1.5"
                  strokeDasharray="2 1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={measureStart.x} cy={measureStart.y} r="1.2" fill="var(--accent-primary)" />
                <circle cx={measureEnd.x} cy={measureEnd.y} r="1.2" fill="var(--accent-primary)" />
                <g transform={`translate(${Math.min(99, midX + 1)}, ${Math.max(1, midY - 4)})`}>
                  <text
                    x="0" y="0"
                    fontSize="3.5"
                    fill="var(--accent-primary)"
                    fontFamily="'JetBrains Mono', monospace"
                    dominantBaseline="hanging"
                  >
                    {meters.toFixed(2)} m / {feet.toFixed(2)} ft
                  </text>
                </g>
              </svg>
            )
          })()}
          {plan.rooms.map((room, index) => <span key={`label-${room.id}`} className="room-number" aria-hidden="true"
            style={{ left: `calc(${room.x}% + 4px)`, top: `calc(${room.y}% + 4px)` }}>{index + 1}</span>)}
          <div className="dimension dimension-x"><span>{Math.round(site.w * 1000).toLocaleString()}</span></div>
          <div className="dimension dimension-y"><span>{Math.round(site.h * 1000).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  )
})
