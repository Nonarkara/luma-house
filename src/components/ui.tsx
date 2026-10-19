import React from 'react'

/** Small marks drawn for this studio. They replace the stock icon set. */
function Mark({ children }: { children: React.ReactNode }) {
  return (
    <svg className="mark" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function GlyphExport() {
  return (
    <Mark>
      <path d="M3 11v2h10v-2M8 2v8M5 7l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Mark>
  )
}

export function GlyphCopy() {
  return (
    <Mark>
      <rect x="5.5" y="5.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 10.5v-8h8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Mark>
  )
}

export function GlyphMore() {
  return (
    <Mark>
      <path d="M3 4h10M3 8h10M3 12h10" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Mark>
  )
}

export function GlyphRotate() {
  return (
    <Mark>
      <path d="M13 8a5 5 0 1 1-1.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2v3.2H8.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Mark>
  )
}

export function GlyphCompare() {
  return (
    <Mark>
      <path d="M3 12V7M8 12V4M13 12V8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Mark>
  )
}

export function GlyphPhoto() {
  return (
    <Mark>
      <path d="M2 4h12v9H2zM6 4l1-2h2l1 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Mark>
  )
}

export function Logo() {
  return (
    <div className="brand" aria-label="designon — Design + Non">
      <img className="brand-symbol" src="./brand/designon-symbol.png" alt="" width="36" height="36" />
      <img className="brand-wordmark" src="./brand/designon-wordmark.png" alt="designon" width="126" height="36" />
    </div>
  )
}

export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button className={`toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
      <span />
    </button>
  )
}
