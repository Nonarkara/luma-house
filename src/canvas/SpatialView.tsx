import React from 'react'
import { Box, Sun } from 'lucide-react'
import type { PlanState, RoomKind } from '../types'

const roomColors: Record<RoomKind, string> = {
  living: 'rgba(163, 255, 0, 0.1)',
  kitchen: 'rgba(56, 189, 248, 0.1)',
  bedroom: 'rgba(232, 121, 249, 0.1)',
  bathroom: 'rgba(45, 212, 191, 0.1)',
  studio: 'rgba(251, 146, 60, 0.1)',
  terrace: 'transparent',
}

export const SpatialView = React.memo(function SpatialView({ plan }: { plan: PlanState }) {
  return (
    <div className="spatial-scene" aria-label="Conceptual spatial view">
      <div className="spatial-sun"><Sun /></div>
      <div className="spatial-board">
        {plan.rooms.map((room) => (
          <div
            key={room.id}
            className={`spatial-room spatial-${room.kind}`}
            style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`, background: roomColors[room.kind] }}
          >
            <span>{room.name}</span>
          </div>
        ))}
      </div>
      <div className="spatial-note"><Box /> Concept massing • 1:100</div>
    </div>
  )
})
