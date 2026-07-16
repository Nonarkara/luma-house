import React from 'react'

export function Logo() {
  return (
    <div className="brand" aria-label="Luma House">
      <span className="brand-mark"><span /></span>
      <span>Luma<span className="brand-light">/house</span></span>
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
