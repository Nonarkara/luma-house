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
    <div
      className="floating-island-toolbar"
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 30,
        boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
      }}
    >
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 20,
              background: isActive ? 'var(--accent-primary, #3b82f6)' : 'transparent',
              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
              border: 0,
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <Icon style={{ width: 16, height: 16 }} />
            <span>{t.label}</span>
            <kbd
              style={{
                fontSize: '0.65rem',
                opacity: 0.6,
                background: 'rgba(255,255,255,0.15)',
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {t.shortcut}
            </kbd>
          </button>
        )
      })}

      <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

      {/* Tape Measure Toggle */}
      <button
        type="button"
        className={`toolbar-pill-btn ${isMeasuring ? 'is-active' : ''}`}
        onClick={onToggleMeasure}
        title="Tape Measure Tool (M)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 20,
          background: isMeasuring ? 'var(--accent-emerald, #10b981)' : 'transparent',
          color: isMeasuring ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
          border: 0,
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 500,
        }}
      >
        <Ruler style={{ width: 16, height: 16 }} />
        <span>Measure</span>
        <kbd style={{ fontSize: '0.65rem', opacity: 0.6, background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 4 }}>M</kbd>
      </button>

      {/* AI Layout Synthesizer Button */}
      {onSynthesize && (
        <button
          type="button"
          className="toolbar-pill-btn ai-btn"
          onClick={onSynthesize}
          title="AI Layout Synthesizer (S)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 20,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            color: '#ffffff',
            border: 0,
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)',
          }}
        >
          <Sparkles style={{ width: 15, height: 15 }} />
          <span>AI Layout</span>
        </button>
      )}
    </div>
  )
}
