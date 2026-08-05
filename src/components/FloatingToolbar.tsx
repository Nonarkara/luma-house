import React from 'react'
import { MousePointer2, Pencil, PanelLeftClose, DoorOpen, Ruler, Sparkles } from 'lucide-react'
import type { PlanTool } from '../types'

interface FloatingToolbarProps {
  activeTool: PlanTool
  setActiveTool: (tool: PlanTool) => void
  isMeasuring?: boolean
  onToggleMeasure?: () => void
  onSynthesize?: () => void
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
}) => {
  const tools: Array<{ id: PlanTool; label: string; shortcut: string; icon: typeof MousePointer2 }> = [
    { id: 'select', label: 'Select & Move', shortcut: 'V', icon: MousePointer2 },
    { id: 'draw', label: 'Draw Wall', shortcut: 'W', icon: Pencil },
    { id: 'window', label: 'Place Window', shortcut: 'O', icon: PanelLeftClose },
    { id: 'door', label: 'Place Door', shortcut: 'D', icon: DoorOpen },
  ]

  return (
    <div className="floating-island-toolbar" role="toolbar" aria-label="Plan tools">
      {tools.map((t) => {
        const Icon = t.icon
        const isActive = activeTool === t.id && !isMeasuring
        return (
          <button
            key={t.id}
            type="button"
            className={`toolbar-pill-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => setActiveTool(t.id)}
            title={`${t.label} (${t.shortcut})`}
            aria-label={t.label}
            aria-pressed={isActive}
          >
            <Icon className="toolbar-pill-icon" aria-hidden="true" />
            <span className="toolbar-pill-label">{t.label}</span>
            <kbd className="toolbar-pill-kbd">{t.shortcut}</kbd>
          </button>
        )
      })}

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
          title="AI Layout Synthesizer (S)"
          aria-label="AI Layout Synthesizer"
        >
          <Sparkles className="toolbar-pill-icon" aria-hidden="true" />
          <span className="toolbar-pill-label">AI Layout</span>
        </button>
      )}
    </div>
  )
}
