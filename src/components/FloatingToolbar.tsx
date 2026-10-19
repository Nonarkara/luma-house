import React, { useState } from 'react'
import { MousePointer2, Pencil, PanelLeftClose, DoorOpen, Ruler, Sparkles, Plus, Armchair, Undo2, MoreHorizontal } from 'lucide-react'
import type { PlanTool } from '../types'

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
 * single accent reserved for the active state. No glass, no shadow, no
 * rounded corners — per the Axiom Design Core.
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
  const [moreOpen, setMoreOpen] = useState(false)
  const tools: Array<{ id: PlanTool; label: string; shortcut: string; icon: typeof MousePointer2 }> = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
    { id: 'draw', label: 'Pencil', shortcut: 'W', icon: Pencil },
    { id: 'window', label: 'Window', shortcut: 'O', icon: PanelLeftClose },
    { id: 'door', label: 'Door', shortcut: 'D', icon: DoorOpen },
  ]
  const ordered = compact
    ? [tools[1], tools[2], tools[3], tools[0]]
    : tools

  const choose = (tool: PlanTool) => {
    setMoreOpen(false)
    setActiveTool(tool)
  }

  return (
    <div className="floating-island-toolbar" role="toolbar" aria-label="Plan tools">
      {ordered.map((t) => {
        const Icon = t.icon
        const isActive = activeTool === t.id && !isMeasuring
        return (
          <button
            key={t.id}
            type="button"
            className={`toolbar-pill-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => choose(t.id)}
            title={`${t.label} (${t.shortcut})`}
            aria-label={t.label}
            aria-keyshortcuts={t.shortcut}
            aria-pressed={isActive}
          >
            <Icon className="toolbar-pill-icon" aria-hidden="true" />
            <span className="toolbar-pill-label">{t.label}</span>
            <kbd className="toolbar-pill-kbd" aria-hidden="true">{t.shortcut}</kbd>
          </button>
        )
      })}

      {!compact && (
        <button type="button" className={`toolbar-pill-btn ${activeTool === 'room' && !isMeasuring ? 'is-active' : ''}`} onClick={() => choose('room')} aria-label="Room" aria-pressed={activeTool === 'room' && !isMeasuring} title="Room — drag a box">
          <Plus className="toolbar-pill-icon" aria-hidden="true" /><span className="toolbar-pill-label">Room</span>
        </button>
      )}
      {!compact && onFurniture && <button type="button" className={`toolbar-pill-btn ${furnitureOpen ? 'is-active' : ''}`} onClick={onFurniture} aria-label="Add furniture" aria-pressed={furnitureOpen} title="Add furniture"><Armchair className="toolbar-pill-icon" /><span className="toolbar-pill-label">Furniture</span></button>}
      {!compact && <span className="toolbar-divider" aria-hidden="true" />}

      {!compact && (
        <button
          type="button"
          className={`toolbar-pill-btn ${isMeasuring ? 'is-active' : ''}`}
          onClick={onToggleMeasure}
          title="Tape Measure (M)"
          aria-label="Tape Measure"
          aria-pressed={isMeasuring}
        >
          <Ruler className="toolbar-pill-icon" aria-hidden="true" />
          <span className="toolbar-pill-label">Measure</span>
          <kbd className="toolbar-pill-kbd">M</kbd>
        </button>
      )}

      {!compact && onSynthesize && (
        <button
          type="button"
          className="toolbar-pill-btn toolbar-pill-ai"
          onClick={onSynthesize}
          title="Layout presets (S)"
          aria-label="Layout presets"
        >
          <Sparkles className="toolbar-pill-icon" aria-hidden="true" />
          <span className="toolbar-pill-label">Layout preset</span>
        </button>
      )}

      {compact && (
        <button type="button" className="toolbar-pill-btn" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo">
          <Undo2 className="toolbar-pill-icon" aria-hidden="true" />
          <span className="toolbar-pill-label">Undo</span>
        </button>
      )}

      {compact && (
        <div className="toolbar-more">
          <button type="button" className="toolbar-pill-btn" aria-label="More tools" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
            <MoreHorizontal className="toolbar-pill-icon" aria-hidden="true" />
            <span className="toolbar-pill-label">More</span>
          </button>
          {moreOpen && (
            <div className="toolbar-more-menu" aria-label="More tools">
              <button type="button" aria-label="Room" onClick={() => choose('room')}>Room</button>
              {onFurniture && <button type="button" aria-label="Add furniture" onClick={() => { setMoreOpen(false); onFurniture() }}>Furniture</button>}
              <button type="button" aria-label="Tape Measure" aria-pressed={isMeasuring} onClick={() => { setMoreOpen(false); onToggleMeasure?.() }}>Measure</button>
              {onSynthesize && <button type="button" aria-label="Layout presets" onClick={() => { setMoreOpen(false); onSynthesize() }}>Layout preset</button>}
              <button type="button" aria-label="Redo" disabled={!canRedo} onClick={() => { setMoreOpen(false); onRedo?.() }}>Redo</button>
              {onRoomOptions && <button type="button" aria-label="Room options" onClick={() => { setMoreOpen(false); onRoomOptions() }}>Room options</button>}
              {onQuickAction && <button type="button" aria-label="Quick action" onClick={() => { setMoreOpen(false); onQuickAction() }}>Quick action</button>}
              {onConcept && <button type="button" aria-label="Concept photo" onClick={() => { setMoreOpen(false); onConcept() }}>Concept photo</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
