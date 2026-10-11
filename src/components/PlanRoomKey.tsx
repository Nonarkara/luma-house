import { roomAreaFor } from '../plan'
import type { Room, SiteSpec } from '../types'

/** Names stay outside the geometry; the same index labels each drawn room. */
export function PlanRoomKey({ rooms, site, selectedRoom, onSelect }: {
  rooms: Room[]
  site: SiteSpec
  selectedRoom: string | null
  onSelect: (room: Room) => void
}) {
  if (!rooms.length) return null
  return <nav className="plan-room-key" aria-label="Rooms in this drawing">
    {rooms.map((room, index) => <button key={room.id} type="button"
      aria-label={`Select ${room.name}, ${roomAreaFor(room, site).toFixed(1)} square meters`}
      aria-pressed={selectedRoom === room.id} onClick={() => onSelect(room)}>
      <span className="room-key-number" aria-hidden="true">{index + 1}</span>
      <span className="room-name">{room.name}</span>
      <span className="room-area">{roomAreaFor(room, site).toFixed(1)} m²</span>
    </button>)}
  </nav>
}
