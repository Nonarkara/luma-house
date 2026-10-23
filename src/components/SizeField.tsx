import { useEffect, useRef, useState } from 'react'
import { formatMetres, isStatedSize, parseLengthMetres, roomDepthM, roomWidthM, type SizeAxis } from '../canvas/roomSize'
import type { Room, SiteSpec } from '../types'

/**
 * One axis of a room's real size, as an editable figure.
 *
 * The drawing field has one scale, and that scale comes from a single known
 * measurement, so every other length on the sheet is that scale applied to a
 * rough line. The figure is where the length stops being a guess: type over it
 * and press Enter, and the room becomes that long — the wall keeps its
 * direction, the edge it was drawn from stays put, and the far edge moves.
 *
 * The length is read the way a person writes one ("4.90", "490cm", "4' 6\""),
 * and a length that cannot be drawn is refused with nothing changed. Escape
 * puts the figure back.
 */
export function SizeField({ room, axis, site, onState, className }: {
  room: Room
  axis: SizeAxis
  site: SiteSpec
  /** State the length. Returns false when the length was refused. */
  onState?: (axis: SizeAxis, text: string) => boolean
  className?: string
}) {
  const value = axis === 'w' ? roomWidthM(room, site) : roomDepthM(room, site)
  const [draft, setDraft] = useState(() => formatMetres(value))
  const typing = useRef(false)
  const dirty = useRef(false)
  const stated = isStatedSize(room, site, axis)

  // The figure follows the room, unless the user is mid-edit.
  useEffect(() => {
    if (!typing.current) setDraft(formatMetres(value))
  }, [value])

  const what = axis === 'w' ? 'width' : 'depth'
  const commit = () => {
    typing.current = false
    dirty.current = false
    const accepted = onState?.(axis, draft)
    // A refused length must not leave a figure on screen that the room does
    // not have: put the true length back, and let the room say why.
    setDraft(formatMetres(accepted === false ? value : parseLengthMetres(draft) ?? value))
  }
  const revert = () => {
    typing.current = false
    dirty.current = false
    setDraft(formatMetres(value))
  }
  const blur = () => {
    if (!dirty.current) { revert(); return }
    const metres = parseLengthMetres(draft)
    // A half-typed number is not a refusal worth announcing. An explicitly
    // edited equal length still states a measurement rather than a guess.
    if (metres === null) { revert(); return }
    commit()
  }

  return (
    <span className={`size-field${className ? ' size-field--compact' : ''}`}>
      {!stated && <span className="size-field-estimate" aria-hidden="true">~</span>}
    <input
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      data-measurement={stated ? 'stated' : 'scaled'}
      aria-description={stated ? 'Stated measurement; preserved through recalibration.' : 'Approximate from sketch scale. Type a known length to state a measurement.'}
      aria-label={`${room.name} ${what} in metres`}
      title={`${stated ? 'Stated measurement' : '~ Approximate from sketch scale'}. Type the real ${what} in metres and press Enter`}
      onChange={(event) => { typing.current = true; dirty.current = true; setDraft(event.target.value) }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        else if (event.key === 'Escape') { event.preventDefault(); revert() }
      }}
      onBlur={blur}
    />
    </span>
  )
}
