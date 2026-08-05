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

  return (
    <div
      className="contextual-action-bar"
      style={{
        position: 'absolute',
        left: `${targetX}%`,
        top: `calc(${targetY}% - 46px)`,
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
        color: '#ffffff',
        fontSize: '0.78rem',
      }}
    >
      {isRoom && room && (
        <>
          <span style={{ fontWeight: 600, padding: '0 4px', color: 'var(--accent-amber, #f59e0b)' }}>
            {room.name} ({roomAreaFor(room, site).toFixed(1)}m²)
          </span>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

          {/* Wall Height ±0.1m */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '2px 6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>H:</span>
            <span style={{ fontWeight: 600 }}>{(room.wallHeight ?? 2.5).toFixed(1)}m</span>
            <button
              type="button"
              style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 2 }}
              onClick={() => onUpdateRoom?.({ wallHeight: Math.min(6.0, (room.wallHeight ?? 2.5) + 0.1) })}
              title="Increase Ceiling Height"
            >
              <Plus style={{ width: 12, height: 12 }} />
            </button>
            <button
              type="button"
              style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 2 }}
              onClick={() => onUpdateRoom?.({ wallHeight: Math.max(2.0, (room.wallHeight ?? 2.5) - 0.1) })}
              title="Decrease Ceiling Height"
            >
              <Minus style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {onDeleteRoom && (
            <button
              type="button"
              style={{ background: 'none', border: 0, color: '#ef4444', cursor: 'pointer', padding: 4 }}
              onClick={onDeleteRoom}
              title="Delete Room"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </>
      )}

      {!isRoom && opening && (
        <>
          <span style={{ fontWeight: 600, padding: '0 4px', color: '#38bdf8' }}>
            {opening.type === 'window' ? 'Window' : 'Door'} ({(opening.widthM ?? (opening.type === 'window' ? 1.6 : 0.9)).toFixed(1)}×{(opening.heightM ?? (opening.type === 'window' ? 1.2 : 2.1)).toFixed(1)}m)
          </span>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

          {/* Width ±0.1m */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '2px 6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>W:</span>
            <button
              type="button"
              style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 2 }}
              onClick={() => onUpdateOpening?.(opening.id, { widthM: Math.min(6.0, (opening.widthM ?? 1.6) + 0.1) })}
            >
              <Plus style={{ width: 12, height: 12 }} />
            </button>
            <button
              type="button"
              style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 2 }}
              onClick={() => onUpdateOpening?.(opening.id, { widthM: Math.max(0.4, (opening.widthM ?? 1.6) - 0.1) })}
            >
              <Minus style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {/* Rotate opening orientation */}
          <button
            type="button"
            style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 4 }}
            onClick={() => onUpdateOpening?.(opening.id, { rotation: opening.rotation === 0 ? 90 : 0 })}
            title="Rotate Orientation"
          >
            <RotateCw style={{ width: 14, height: 14 }} />
          </button>

          {onDeleteOpening && (
            <button
              type="button"
              style={{ background: 'none', border: 0, color: '#ef4444', cursor: 'pointer', padding: 4 }}
              onClick={() => onDeleteOpening(opening.id)}
              title="Delete Opening"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
