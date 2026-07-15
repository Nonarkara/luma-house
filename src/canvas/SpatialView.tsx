import { Box, Sun } from 'lucide-react'
import type { PlanState, RoomKind } from '../types'

const roomColors: Record<RoomKind, string> = {
  living: '#e9e0cd',
  kitchen: '#d7dfce',
  bedroom: '#e4d9d3',
  bathroom: '#d9e2e0',
  studio: '#e8e4d6',
  terrace: '#dce8d1',
}

export function SpatialView({ plan }: { plan: PlanState }) {
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
}
