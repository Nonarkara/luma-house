import React from 'react'
import { MousePointer2, Pencil, AppWindow, DoorOpen, Ruler, Sparkles, Plus, Armchair, Eraser, Scissors } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlanTool } from '../types'

interface FloatingToolbarProps {
  activeTool: PlanTool
  setActiveTool: (tool: PlanTool) => void
  isMeasuring?: boolean
  onToggleMeasure?: () => void
  onSynthesize?: () => void
  onAddRoom?: () => void
  onFurniture?: () => void
  furnitureOpen?: boolean
  /**
   * Carry a window or a door to a wall. The press still arms the tool, so a
   * tap on the button is still how you ask for a window; the drag is the extra
   * way in, and it works with a finger.
   */
  onOpeningDrag?: (type: 'window' | 'door', event: ReactPointerEvent) => void
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
  onAddRoom,
  onFurniture,
  furnitureOpen = false,
  onOpeningDrag,
}) => {
  const tools: Array<{ id: PlanTool; label: string; shortcut: string; icon: typeof MousePointer2 }> = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
    { id: 'draw', label: 'Pencil', shortcut: 'W', icon: Pencil },
    { id: 'window', label: 'Window', shortcut: 'O', icon: AppWindow },
    { id: 'door', label: 'Door', shortcut: 'D', icon: DoorOpen },
    { id: 'erase', label: 'Erase', shortcut: 'E', icon: Eraser },
    { id: 'trim', label: 'Trim', shortcut: 'C', icon: Scissors },
  ]

  return (
    <div className="floating-island-toolbar" role="toolbar" aria-label="Plan tools">
      {tools.map((t) => {
        const Icon = t.icon
        const isActive = activeTool === t.id && !isMeasuring
        const carryable = t.id === 'window' || t.id === 'door'
        return (
          <button
            key={t.id}
            type="button"
            className={`toolbar-pill-btn ${isActive ? 'is-active' : ''}${carryable ? ' is-carryable' : ''}`}
            onClick={() => setActiveTool(t.id)}
            onPointerDown={(event) => {
              if (carryable) onOpeningDrag?.(t.id as 'window' | 'door', event)
            }}
            title={carryable ? `${t.label} (${t.shortcut}) — drag onto a wall to place it` : `${t.label} (${t.shortcut})`}
            aria-label={t.label}
            aria-pressed={isActive}
          >
            <Icon className="toolbar-pill-icon" aria-hidden="true" />
            <span className="toolbar-pill-label">{t.label}</span>
            <kbd className="toolbar-pill-kbd">{t.shortcut}</kbd>
          </button>
        )
      })}

      {onAddRoom && <button type="button" className="toolbar-pill-btn" onClick={onAddRoom} aria-label="Add room" title="Add room"><Plus className="toolbar-pill-icon" /><span className="toolbar-pill-label">Room</span></button>}
      {onFurniture && <button type="button" className={`toolbar-pill-btn ${furnitureOpen ? 'is-active' : ''}`} onClick={onFurniture} aria-label="Add furniture" aria-pressed={furnitureOpen} title="Add furniture"><Armchair className="toolbar-pill-icon" /><span className="toolbar-pill-label">Furniture</span></button>}
      <span className="toolbar-divider" aria-hidden="true" />

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

      {onSynthesize && (
        <button
          type="button"
          className="toolbar-pill-btn toolbar-pill-ai"
          onClick={onSynthesize}
          title="Layout presets (S)"
          aria-label="Layout presets"
        >
          <Sparkles className="toolbar-pill-icon" aria-hidden="true" />
          {/* The long form is the desktop's, where the column is wide enough
              for it; the phone says "Presets", which is the dialog's own word
              and fits on one line. */}
          <span className="toolbar-pill-label">
            <span className="is-wide">Layout preset</span>
            <span className="is-narrow">Presets</span>
          </span>
        </button>
      )}
    </div>
  )
}
