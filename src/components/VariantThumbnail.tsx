import React from 'react'
import type { Room } from '../types'

const ROOM_COLORS: Record<string, string> = {
  living: 'rgba(138, 76, 22, 0.25)',
  kitchen: 'rgba(34, 80, 108, 0.25)',
  bedroom: 'rgba(65, 72, 43, 0.25)',
  bathroom: 'rgba(38, 56, 63, 0.2)',
  studio: 'rgba(113, 60, 16, 0.25)',
  terrace: 'transparent',
}

/**
 * Render a top-down miniature of a layout variant as an SVG.
 * Each room is drawn as a stroked rectangle in its kind color. The output
 * is small and grid-free — meant to be glanced at, not measured.
 */
export const VariantThumbnail = React.memo(function VariantThumbnail({
  rooms,
  width = 110,
  height = 70,
}: {
  rooms: Room[]
  width?: number
  height?: number
}) {
  if (rooms.length === 0) {
    return (
      <svg
        className="variant-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width={width}
        height={height}
        aria-hidden="true"
      >
        <rect x="0" y="0" width="100" height="100" className="variant-svg-empty" />
      </svg>
    )
  }
  return (
    <svg
      className="variant-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width={width}
      height={height}
      aria-hidden="true"
    >
      {rooms.map((room) => (
        <g key={room.id}>
          <rect
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            fill={ROOM_COLORS[room.kind] ?? ROOM_COLORS.studio}
            stroke="currentColor"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  )
})
