import React from 'react'
import { Copy, Download, FilePlus2, HelpCircle, MoreHorizontal, PanelRight, Plus, Settings2 } from 'lucide-react'
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
  onOpenGuide?: () => void
  onToggleCatalog?: () => void
  /** View switch and history: the controls used every minute, kept in the bar. */
  center?: React.ReactNode
  /** Project facts (area, city, colour scheme) shown beside the name on wide screens. */
  meta?: React.ReactNode
  /** Rarely used content placed at the bottom of the More menu. */
  menuExtra?: React.ReactNode
  onChangeLocation?: () => void
  locationName?: string
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
  onOpenGuide,
  onToggleCatalog,
  center,
  meta,
  menuExtra,
  onChangeLocation,
  locationName,
}: TopBarProps) {
  const menuRef = React.useRef<HTMLDetailsElement>(null)
  const close = () => menuRef.current?.removeAttribute('open')
  const run = (action?: () => void) => () => { close(); action?.() }
  React.useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        <div className="project-picker">
          <span><strong>{projectName}</strong><small>{lastSaved}</small></span>
        </div>
        {meta && <div className="topbar-meta">{meta}</div>}
      </div>

      {center && <div className="topbar-center">{center}</div>}

      <div className="top-actions">
        <details className="top-more" ref={menuRef} onKeyDown={event => {
          if (event.key === 'Escape') { close(); menuRef.current?.querySelector('summary')?.focus() }
        }}>
          <summary role="button" className="icon-button" aria-label="More actions" title="More actions">
            <MoreHorizontal aria-hidden="true" />
          </summary>
          <div className="top-more-menu">
            <p className="menu-project-name">{projectName}<small>{lastSaved}</small></p>
            {onChangeLocation && <button type="button" className="menu-location" onClick={run(onChangeLocation)}>Change city · {locationName}</button>}
            {onToggleCatalog && (
              <button type="button" aria-label="Furniture Catalog" onClick={run(onToggleCatalog)}>
                <Plus aria-hidden="true" /> Furniture catalog
              </button>
            )}
            <button type="button" className="top-more-share" aria-label="Share" onClick={run(sharePlan)}>
              <Copy aria-hidden="true" /> Share link
            </button>
            <button type="button" onClick={run(onNewSketch)} title="Start a fresh napkin sketch. Undo brings the current one back.">
              <FilePlus2 aria-hidden="true" /> New sketch
            </button>
            <button type="button" onClick={run(onOpenSettings)}>
              <Settings2 aria-hidden="true" /> Workspace settings
            </button>
            {onOpenGuide && <button type="button" onClick={run(onOpenGuide)}>Getting started guide</button>}
            {onOpenShortcuts && (
              <button type="button" onClick={run(onOpenShortcuts)}>
                <HelpCircle aria-hidden="true" /> Shortcuts and legend <kbd>?</kbd>
              </button>
            )}
            {menuExtra && <div className="top-more-extra">{menuExtra}</div>}
          </div>
        </details>

        <IconButton
          label={inspectorOpen ? 'Close panel' : 'Open panel'}
          className={inspectorOpen ? 'active' : ''}
          onClick={onToggleInspector}
        >
          <PanelRight />
        </IconButton>

        <button className="button secondary top-action-label" type="button" onClick={sharePlan} aria-label="Share">
          <Copy className="top-action-icon" aria-hidden="true" />
          <span className="btn-label">Share</span>
        </button>

        <button className="button primary" type="button" onClick={exportPlan} aria-label="Export">
          <Download /><span className="btn-label">Export</span>
        </button>
      </div>
    </header>
  )
})
