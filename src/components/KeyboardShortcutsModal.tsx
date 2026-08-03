import { Command, X } from 'lucide-react'

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcutGroups = [
    {
      category: '3D',
      items: [
        { key: 'T', description: 'Start the drawing-to-3D tour' },
        { key: 'G', description: 'Enter or leave 1.6 m eye-level walk mode' },
        { key: 'W / A / S / D', description: 'Move while walk mode is active' },
        { key: '?', description: 'Open or close this guide' },
      ],
    },
    {
      category: 'Drawing',
      items: [
        { key: 'Esc', description: 'Leave walk/tour or clear the current selection' },
        { key: 'Delete / Backspace', description: 'Remove selected room, opening, or furniture' },
        { key: 'Cmd / Ctrl + Z', description: 'Undo last spatial plan edit' },
        { key: 'Cmd / Ctrl + Shift + Z', description: 'Redo previously undone edit' },
        { key: 'Arrow keys', description: 'Nudge the selected room, opening, or furniture' },
      ],
    },
  ]

  const visualLegend = [
    { style: 'solid', label: 'Sun ray', role: 'Current solar direction to an exterior window' },
    { style: 'dashed', label: 'Air path', role: 'Concept inlet-to-outlet pressure path' },
    { style: 'hatch', label: 'Unresolved', role: 'Geometry needs another opening or route' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(event) => event.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <div>
            <Command />
            <h2 id="shortcuts-title">Keyboard + drawing language</h2>
          </div>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close modal">
            <X />
          </button>
        </div>

        <div className="shortcuts-grid">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="shortcut-group">
              <h3>{group.category}</h3>
              <div className="shortcut-list">
                {group.items.map((item) => (
                  <div key={item.key} className="shortcut-item">
                    <kbd>{item.key}</kbd>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="legend-section">
          <h3>Drawing language</h3>
          <div className="legend-grid">
            {visualLegend.map((item) => (
              <div key={item.label} className="legend-item">
                <span className={`legend-swatch is-${item.style}`} />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
