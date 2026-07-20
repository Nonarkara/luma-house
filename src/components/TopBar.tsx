import React from 'react'
import { ChevronDown, Copy, Download, PanelRight, Settings2 } from 'lucide-react'
import { Logo, IconButton } from './ui'

interface TopBarProps {
  projectName: string
  lastSaved: string
  inspectorOpen: boolean
  onToggleInspector: () => void
  onOpenSettings: () => void
  exportPlan: () => void
  sharePlan: () => void
}

export const TopBar = React.memo(function TopBar({
  projectName,
  lastSaved,
  inspectorOpen,
  onToggleInspector,
  onOpenSettings,
  exportPlan,
  sharePlan,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        <span className="top-divider" />
        <button className="project-picker" type="button">
          <span><strong>{projectName}</strong><small>{lastSaved}</small></span>
          <ChevronDown />
        </button>
      </div>
      <div className="top-actions">
        <IconButton label="Workspace settings" onClick={onOpenSettings}>
          <Settings2 />
        </IconButton>
        <IconButton
          label={inspectorOpen ? 'Close panel' : 'Open panel'}
          className={inspectorOpen ? 'active' : ''}
          onClick={onToggleInspector}
        >
          <PanelRight />
        </IconButton>
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
