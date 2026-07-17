import React from 'react'
import { ChevronDown, Copy, Download, Menu } from 'lucide-react'
import { Logo, IconButton } from './ui'

interface TopBarProps {
  projectName: string
  lastSaved: string
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>
  exportPlan: () => void
  sharePlan: () => void
}

export const TopBar = React.memo(function TopBar({ projectName, lastSaved, setMobileNavOpen, exportPlan, sharePlan }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}>
          <Menu />
        </IconButton>
        <Logo />
        <span className="top-divider" />
        <button className="project-picker" type="button">
          <span><strong>{projectName}</strong><small>{lastSaved}</small></span>
          <ChevronDown />
        </button>
      </div>
      <div className="top-actions">
        <button
          className="button secondary"
          type="button"
          onClick={sharePlan}
        >
          <Copy /> Share
        </button>
        <button className="button primary" type="button" onClick={exportPlan}>
          <Download /> Export
        </button>
      </div>
    </header>
  )
})
