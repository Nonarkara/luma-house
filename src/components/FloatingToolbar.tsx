import React, { useState } from 'react'
import type { PlanTool } from '../types'
import { useI18n } from '../i18n'

interface FloatingToolbarProps {
  activeTool: PlanTool
  setActiveTool: (tool: PlanTool) => void
  isMeasuring?: boolean
  onToggleMeasure?: () => void
  onSynthesize?: () => void
  onFurniture?: () => void
  furnitureOpen?: boolean
  compact?: boolean
  onUndo?: () => void
  canUndo?: boolean
  onRedo?: () => void
  canRedo?: boolean
  onRoomOptions?: () => void
  onQuickAction?: () => void
  onConcept?: () => void
}

/**
 * Bottom-anchored tool bar. Sharp edges, single hairline border, the
 * single accent reserved for the active state. Labels only — no stock icons.
 */
export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  activeTool,
  setActiveTool,
  isMeasuring = false,
  onToggleMeasure,
  onSynthesize,
  onFurniture,
  furnitureOpen = false,
  compact = false,
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  onRoomOptions,
  onQuickAction,
  onConcept,
}) => {
  const { tr } = useI18n()
  const [moreOpen, setMoreOpen] = useState(false)
  const tools: Array<{ id: PlanTool; label: string; shortcut: string }> = [
    { id: 'select', label: 'Select', shortcut: 'V' },
    { id: 'draw', label: 'Pencil', shortcut: 'W' },
    { id: 'window', label: 'Window', shortcut: 'O' },
    { id: 'door', label: 'Door', shortcut: 'D' },
  ]
  const ordered = compact
    ? [tools[1], tools[2], tools[3], tools[0]]
    : tools

  const choose = (tool: PlanTool) => {
    setMoreOpen(false)
    setActiveTool(tool)
  }

  return (
    <div className="floating-island-toolbar" role="toolbar" aria-label={tr('Plan tools')}>
      {ordered.map((t) => {
        const isActive = activeTool === t.id && !isMeasuring
        return (
          <button
            key={t.id}
            type="button"
            className={`toolbar-pill-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => choose(t.id)}
            title={`${tr(t.label)} (${t.shortcut})`}
            aria-label={tr(t.label)}
            aria-keyshortcuts={t.shortcut}
            aria-pressed={isActive}
          >
            <span className="toolbar-pill-label">{tr(t.label)}</span>
            <kbd className="toolbar-pill-kbd" aria-hidden="true">{t.shortcut}</kbd>
          </button>
        )
      })}

      {!compact && (
        <button type="button" className={`toolbar-pill-btn ${activeTool === 'room' && !isMeasuring ? 'is-active' : ''}`} onClick={() => choose('room')} aria-label={tr('Room')} aria-pressed={activeTool === 'room' && !isMeasuring} title={tr('Room')}>
          <span className="toolbar-pill-label">{tr('Room')}</span>
        </button>
      )}
      {!compact && onFurniture && <button type="button" className={`toolbar-pill-btn ${furnitureOpen ? 'is-active' : ''}`} onClick={onFurniture} aria-label={tr('Add furniture')} aria-pressed={furnitureOpen} title={tr('Add furniture')}><span className="toolbar-pill-label">{tr('Furniture')}</span></button>}
      {!compact && <span className="toolbar-divider" aria-hidden="true" />}

      {!compact && (
        <button
          type="button"
          className={`toolbar-pill-btn ${isMeasuring ? 'is-active' : ''}`}
          onClick={onToggleMeasure}
          title={`${tr('Tape Measure')} (M)`}
          aria-label={tr('Tape Measure')}
          aria-keyshortcuts="M"
          aria-pressed={isMeasuring}
        >
          <span className="toolbar-pill-label">{tr('Measure')}</span>
          <kbd className="toolbar-pill-kbd" aria-hidden="true">M</kbd>
        </button>
      )}

      {!compact && onSynthesize && (
        <button
          type="button"
          className="toolbar-pill-btn toolbar-pill-ai"
          onClick={onSynthesize}
          title={tr('Layout presets')}
          aria-label={tr('Layout presets')}
        >
          <span className="toolbar-pill-label">{tr('Layout preset')}</span>
        </button>
      )}

      {compact && (
        <button type="button" className="toolbar-pill-btn" onClick={onUndo} disabled={!canUndo} aria-label={tr('Undo')} title={tr('Undo')}>
          <span className="toolbar-pill-label">{tr('Undo')}</span>
        </button>
      )}

      {compact && (
        <div className="toolbar-more">
          <button type="button" className="toolbar-pill-btn" aria-label={tr('More tools')} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
            <span className="toolbar-pill-label">{tr('More')}</span>
          </button>
          {moreOpen && (
            <div className="toolbar-more-menu" aria-label={tr('More tools')}>
              <button type="button" aria-label={tr('Room')} onClick={() => choose('room')}>{tr('Room')}</button>
              {onFurniture && <button type="button" aria-label={tr('Add furniture')} onClick={() => { setMoreOpen(false); onFurniture() }}>{tr('Furniture')}</button>}
              <button type="button" aria-label={tr('Tape Measure')} aria-pressed={isMeasuring} onClick={() => { setMoreOpen(false); onToggleMeasure?.() }}>{tr('Measure')}</button>
              {onSynthesize && <button type="button" aria-label={tr('Layout presets')} onClick={() => { setMoreOpen(false); onSynthesize() }}>{tr('Layout preset')}</button>}
              <button type="button" aria-label={tr('Redo')} disabled={!canRedo} onClick={() => { setMoreOpen(false); onRedo?.() }}>{tr('Redo')}</button>
              {onRoomOptions && <button type="button" aria-label={tr('Room options')} onClick={() => { setMoreOpen(false); onRoomOptions() }}>{tr('Room options')}</button>}
              {onQuickAction && <button type="button" aria-label={tr('Quick action')} onClick={() => { setMoreOpen(false); onQuickAction() }}>{tr('Quick action')}</button>}
              {onConcept && <button type="button" aria-label={tr('Concept photo')} onClick={() => { setMoreOpen(false); onConcept() }}>{tr('Concept photo')}</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
