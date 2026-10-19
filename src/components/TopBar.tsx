import React from 'react'
import { LanguageSwitch, useI18n } from '../i18n'
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
  /** View switch and history: the controls used every minute, kept in the bar. */
  center?: React.ReactNode
  /** Project facts (area, city, colour scheme) shown beside the name on wide screens. */
  meta?: React.ReactNode
  /** Rarely used content placed at the bottom of the More menu. */
  menuExtra?: React.ReactNode
  onChangeLocation?: () => void
  locationName?: string
  hideLabeledShare?: boolean
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
  center,
  meta,
  menuExtra,
  onChangeLocation,
  locationName,
  hideLabeledShare = false,
}: TopBarProps) {
  const { tr } = useI18n()
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
  const panelLabel = inspectorOpen ? tr('Close panel') : tr('Open panel')
  const panelShort = inspectorOpen ? tr('Close') : tr('Open')

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        <div className="project-picker">
          <span><strong>{tr(projectName)}</strong><small>{tr(lastSaved)}</small></span>
        </div>
        {meta && <div className="topbar-meta">{meta}</div>}
      </div>

      {center && <div className="topbar-center">{center}</div>}

      <div className="top-actions">
        <details className="top-more" ref={menuRef} onKeyDown={event => {
          if (event.key === 'Escape') { close(); menuRef.current?.querySelector('summary')?.focus() }
        }}>
          <summary role="button" className="icon-button" aria-label={tr('More actions')} title={tr('More actions')}>
            {tr('More')}
          </summary>
          <div className="top-more-menu">
            <LanguageSwitch />
            <p className="menu-project-name">{tr(projectName)}<small>{tr(lastSaved)}</small></p>
            {onChangeLocation && (
              <button type="button" className="menu-location" aria-label={locationName ? tr(`Change city · ${locationName}`) : tr('Change city')} onClick={run(onChangeLocation)}>
                {tr('Change city')} · {locationName}
              </button>
            )}
            {onToggleCatalog && (
              <button type="button" aria-label={tr('Furniture Catalog')} onClick={run(onToggleCatalog)}>
                {tr('Furniture catalog')}
              </button>
            )}
            <button type="button" className="top-more-share" aria-label={tr('Share')} onClick={run(sharePlan)}>
              {tr('Share')}
            </button>
            <button type="button" aria-label={tr('New sketch')} onClick={run(onNewSketch)} title={tr('New sketch')}>
              {tr('New sketch')}
            </button>
            <button type="button" aria-label={tr('Workspace settings')} onClick={run(onOpenSettings)}>
              {tr('Workspace settings')}
            </button>
            {onOpenShortcuts && (
              <button type="button" aria-label={tr('Shortcuts and legend')} onClick={run(onOpenShortcuts)}>
                {tr('Shortcuts and legend')} <kbd>?</kbd>
              </button>
            )}
            {menuExtra && <div className="top-more-extra">{menuExtra}</div>}
          </div>
        </details>

        <IconButton
          label={panelLabel}
          className={inspectorOpen ? 'active' : ''}
          onClick={onToggleInspector}
        >
          {panelShort}
        </IconButton>

        {!hideLabeledShare && (
          <button className="button secondary top-action-label" type="button" onClick={sharePlan} aria-label={tr('Share')}>
            <span className="btn-label">{tr('Share')}</span>
          </button>
        )}

        <button className="button primary" type="button" onClick={exportPlan} aria-label={tr('Export')}>
          <span className="btn-label">{tr('Export')}</span>
        </button>
      </div>
    </header>
  )
})
