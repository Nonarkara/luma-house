import { openingDimensions } from '../openingGeometry'
import React from 'react'
import type { Opening, Room, SiteSpec } from '../types'
import { roomAreaFor } from '../plan'
import { useI18n } from '../i18n'
import { GlyphRotate } from './ui'

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
  const { tr } = useI18n()
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
            <strong>{tr(room.name)}</strong>
            <span className="contextual-action-area">{area.toFixed(1)} m²</span>
          </span>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="contextual-stepper" aria-label={tr('Ceiling height')}>
            <span className="contextual-stepper-label">H</span>
            <span className="contextual-stepper-value">{(room.wallHeight ?? 2.5).toFixed(1)} m</span>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateRoom?.({ wallHeight: Math.min(6.0, (room.wallHeight ?? 2.5) + 0.1) })}
              title={tr('Increase ceiling height')}
              aria-label={tr('Increase ceiling height')}
            >
              +
            </button>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateRoom?.({ wallHeight: Math.max(2.0, (room.wallHeight ?? 2.5) - 0.1) })}
              title={tr('Decrease ceiling height')}
              aria-label={tr('Decrease ceiling height')}
            >
              −
            </button>
          </div>

          {onDeleteRoom && (
            <button
              type="button"
              className="contextual-icon-btn contextual-icon-btn-danger"
              onClick={onDeleteRoom}
              title={tr('Delete room')}
              aria-label={tr('Delete room')}
            >
              ×
            </button>
          )}
        </>
      )}

      {!isRoom && opening && (
        <>
          <span className="contextual-action-label">
            <strong>{tr(opening.type === 'window' ? 'Window' : 'Door')}</strong>
            <span className="contextual-action-area">
              {(openingDimensions(opening).width).toFixed(2)} ×{' '}
              {(openingDimensions(opening).height).toFixed(2)} m
            </span>
          </span>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="contextual-stepper" aria-label={tr('Width')}>
            <span className="contextual-stepper-label">W</span>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateOpening?.(opening.id, { widthM: Math.min(6.0, (opening.widthM ?? 1.6) + 0.1) })}
              title={tr('Increase opening width')}
              aria-label={tr('Increase opening width')}
            >
              +
            </button>
            <button
              type="button"
              className="contextual-stepper-btn"
              onClick={() => onUpdateOpening?.(opening.id, { widthM: Math.max(0.4, (opening.widthM ?? 1.6) - 0.1) })}
              title={tr('Decrease opening width')}
              aria-label={tr('Decrease opening width')}
            >
              −
            </button>
          </div>

          <button
            type="button"
            className="contextual-icon-btn"
            onClick={() => onUpdateOpening?.(opening.id, { rotation: opening.rotation === 0 ? 90 : 0 })}
            title={tr('Rotate opening orientation')}
            aria-label={tr('Rotate opening orientation')}
          >
            <GlyphRotate />
          </button>

          {onDeleteOpening && (
            <button
              type="button"
              className="contextual-icon-btn contextual-icon-btn-danger"
              onClick={() => onDeleteOpening(opening.id)}
              title={tr('Delete opening')}
              aria-label={tr('Delete opening')}
            >
              ×
            </button>
          )}
        </>
      )}
    </div>
  )
}
