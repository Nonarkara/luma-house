import React from 'react'
import { RotateCw, Trash2, Plus, Minus } from 'lucide-react'
import type { Opening, Room, SiteSpec } from '../types'
import { roomAreaFor } from '../plan'

interface ContextualActionBarProps {
  room?: Room | null
  opening?: Opening | null
  site: SiteSpec
  onUpdateRoom?: (updates: Partial<Room>) => void
  onDeleteRoom?: () => void
  onUpdateOpening?: (id: string, updates: Partial<Opening>) => void
  onDeleteOpening?: (id: string) => void
}

/**
 * Floating action bar above the selected room or opening. Sharp edges,
 * hairline border, the single accent reserved for emphasis. No glass,
 * no shadow, no rounded corners — per the Axiom Design Core.
 */
export const ContextualActionBar: React.FC<ContextualActionBarProps> = ({
  room,
  opening,
  site,
  onUpdateRoom,
  onDeleteRoom,
  onUpdateOpening,
  onDeleteOpening,
}) => {
  if (!room && !opening) return null

  const isRoom = !!room
  const targetX = room ? room.x + room.w / 2 : opening ? opening.x : 50
  const targetY = room ? room.y : opening ? opening.y : 50
  const area = room ? roomAreaFor(room, site) : 0

  return (
    <div
      className="contextual-action-bar"
      style={{
        left: `${targetX}%`,
        top: `calc(${targetY}% - 44px)`,
        transform: 'translateX(-50%)',
      }}
    >
      {isRoom && room && (
        <>
          <span className="contextual-action-label">
            <strong>{room.name}</strong>
            <span className="contextual-action-area">{area.toFixed(1)} m²</span>
          </span>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="contextual-stepper" aria-label="Ceiling height">
            <span className="contextual-stepper-label">H</span>
            <span className="contextual-stepper-value">{(room.wallHeight ?? 2.5).toFixed(1)} m</span>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateRoom?.({ wallHeight: Math.min(6.0, (room.wallHeight ?? 2.5) + 0.1) })}
              title="Increase ceiling height"
              aria-label="Increase ceiling height"
            >
              <Plus className="contextual-stepper-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateRoom?.({ wallHeight: Math.max(2.0, (room.wallHeight ?? 2.5) - 0.1) })}
              title="Decrease ceiling height"
              aria-label="Decrease ceiling height"
            >
              <Minus className="contextual-stepper-icon" aria-hidden="true" />
            </button>
          </div>

          {onDeleteRoom && (
            <button
              type="button"
              className="contextual-icon-btn contextual-icon-btn-danger"
              onClick={onDeleteRoom}
              title="Delete room"
              aria-label="Delete room"
            >
              <Trash2 className="contextual-icon-icon" aria-hidden="true" />
            </button>
          )}
        </>
      )}

      {!isRoom && opening && (
        <>
          <span className="contextual-action-label">
            <strong>{opening.type === 'window' ? 'Window' : 'Door'}</strong>
            <span className="contextual-action-area">
              {(opening.widthM ?? (opening.type === 'window' ? 1.6 : 0.9)).toFixed(2)} ×{' '}
              {(opening.heightM ?? (opening.type === 'window' ? 1.2 : 2.1)).toFixed(2)} m
            </span>
          </span>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="contextual-stepper" aria-label="Width">
            <span className="contextual-stepper-label">W</span>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateOpening?.(opening.id, { widthM: Math.min(6.0, (opening.widthM ?? 1.6) + 0.1) })}
              title="Increase width"
              aria-label="Increase opening width"
            >
              <Plus className="contextual-stepper-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateOpening?.(opening.id, { widthM: Math.max(0.4, (opening.widthM ?? 1.6) - 0.1) })}
              title="Decrease width"
              aria-label="Decrease opening width"
            >
              <Minus className="contextual-stepper-icon" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="contextual-icon-btn"
            onClick={() => onUpdateOpening?.(opening.id, { rotation: opening.rotation === 0 ? 90 : 0 })}
            title="Rotate orientation"
            aria-label="Rotate opening orientation"
          >
            <RotateCw className="contextual-icon-icon" aria-hidden="true" />
          </button>

          {onDeleteOpening && (
            <button
              type="button"
              className="contextual-icon-btn contextual-icon-btn-danger"
              onClick={() => onDeleteOpening(opening.id)}
              title="Delete opening"
              aria-label="Delete opening"
            >
              <Trash2 className="contextual-icon-icon" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
