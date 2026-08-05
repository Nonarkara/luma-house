import React from 'react'
import { Copy, Download, HelpCircle, PanelRight, Settings2 } from 'lucide-react'
import { Logo, IconButton } from './ui'

interface TopBarProps {
  projectName: string
  lastSaved: string
  inspectorOpen: boolean
  onToggleInspector: () => void
  onOpenSettings: () => void
  exportPlan: () => void
  sharePlan: () => void
  onOpenShortcuts?: () => void
  onToggleCatalog?: () => void
}

export const TopBar = React.memo(function TopBar({
  projectName,
  lastSaved,
  inspectorOpen,
  onToggleInspector,
  onOpenSettings,
  exportPlan,
  sharePlan,
  onOpenShortcuts,
  onToggleCatalog,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        <span className="top-divider" />
        <div className="project-picker">
          <span><strong>{projectName}</strong><small>{lastSaved}</small></span>
        </div>
      </div>

      <div className="top-actions">
        {onToggleCatalog && (
          <button
            type="button"
            className="button secondary"
            onClick={onToggleCatalog}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            + Furniture Catalog
          </button>
        )}
        {onOpenShortcuts && (
          <IconButton label="Keyboard shortcuts & visual legend (?)" onClick={onOpenShortcuts}>
            <HelpCircle className="w-4 h-4" />
          </IconButton>
        )}

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
