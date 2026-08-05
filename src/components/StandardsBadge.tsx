import React from 'react'
import type { Severity } from '../codes/standards'

export interface StandardsBadgeProps {
  /** Standard ref id, e.g. "IBC-1208.2" (catalogued) or already-rendered "IBC 1208.2". */
  ref: string
  /** Severity — controls the border + text color. */
  severity: Severity
  /** Long name for the tooltip. */
  name?: string
  /** When true, the badge is rendered as a plain monospace label (no border). */
  inline?: boolean
}

/**
 * Small monospace label for a building-code reference ("IBC 1208.2"). Shown
 * next to the dimension or issue that triggers it, so the user sees the
 * authority behind the number without digging through docs.
 *
 * Per Axiom Design Core: sharp edges, single hairline, no glass. Color is
 * the only signal — the value of the number is what matters.
 */
export const StandardsBadge: React.FC<StandardsBadgeProps> = ({
  ref,
  severity,
  name,
  inline = false,
}) => {
  const sevClass = `is-${severity}`
  const className = inline ? `standards-tag ${sevClass}` : `standards-badge ${sevClass}`
  return (
    <span
      className={className}
      title={name ?? ref}
      aria-label={name ? `${ref} — ${name}` : ref}
    >
      {ref}
    </span>
  )
}
