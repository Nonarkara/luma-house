import React from 'react'
import { CircleDollarSign, Grid2X2, Leaf, Settings2, Sun, Zap } from 'lucide-react'
import type { WorkspaceMode } from '../types'

interface SideNavProps {
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

const modeItems: Array<{ id: WorkspaceMode; label: string; icon: typeof Grid2X2 }> = [
  { id: 'plan', label: 'Plan', icon: Grid2X2 },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'climate', label: 'Climate', icon: Leaf },
  { id: 'systems', label: 'Systems', icon: Zap },
  { id: 'budget', label: 'Budget', icon: CircleDollarSign },
]

export const SideNav = React.memo(function SideNav({
  mode,
  setMode,
  mobileNavOpen,
  setMobileNavOpen,
  settingsOpen,
  setSettingsOpen,
}: SideNavProps) {
  return (
    <nav className={`side-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Design stages">
      <div className="nav-primary">
        {modeItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'active' : ''}
              onClick={() => {
                setMode(item.id)
                setMobileNavOpen(false)
                setSettingsOpen(false)
              }}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="nav-secondary">
        <button
          type="button"
          className={settingsOpen ? 'active' : ''}
          onClick={() => {
            setSettingsOpen(true)
            setMobileNavOpen(false)
          }}
        >
          <Settings2 />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  )
})
