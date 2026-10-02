import React from 'react'

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
