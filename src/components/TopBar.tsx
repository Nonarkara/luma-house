import React from 'react'
import { Copy, Download, FilePlus2, HelpCircle, PanelRight, Plus, Settings2 } from 'lucide-react'
import { Logo, IconButton } from './ui'

interface TopBarProps {
  projectName: string
  lastSaved: string
  inspectorOpen: boolean
  onToggleInspector: () => void
  onOpenSettings: () => void
  exportPlan: () => void
  sharePlan: () => void
  onNewSketch: () => void
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
  onNewSketch,
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
            className="button secondary top-action-label"
            onClick={onToggleCatalog}
            aria-label="Furniture Catalog"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <Plus className="top-action-icon" aria-hidden="true" />
            <span className="btn-label">Furniture Catalog</span>
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
          className="button secondary top-action-label"
          type="button"
          onClick={onNewSketch}
          aria-label="New sketch"
          title="Start a fresh napkin sketch. Undo brings the current one back."
        >
          <FilePlus2 className="top-action-icon" aria-hidden="true" />
          <span className="btn-label">New sketch</span>
        </button>

        <button
          className="button secondary top-action-label"
          type="button"
          onClick={sharePlan}
          aria-label="Share"
        >
          <Copy className="top-action-icon" aria-hidden="true" />
          <span className="btn-label">Share</span>
        </button>

        <button className="button primary" type="button" onClick={exportPlan}>
          <Download /> Export
        </button>
      </div>
    </header>
  )
})
