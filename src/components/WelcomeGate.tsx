import React from 'react'
import { ArrowRight, Pencil } from 'lucide-react'

export const WelcomeGate = React.memo(function WelcomeGate({
  open,
  onStart,
  onSkip,
}: {
  open: boolean
  onStart: () => void
  onSkip: () => void
}) {
  if (!open) return null

  return (
    <div className="welcome-gate" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <p className="eyebrow">Napkin → space → climate</p>
        <h2 id="welcome-title">Draw a wall.<br />See what the sun does.</h2>
        <p className="welcome-lead">A line is a wall. A tick is a door or a window. A box is a room. No CAD language.</p>
        <ol className="welcome-steps">
          <li><span>01</span><b>Draw</b><small>Walls, rooms, a bed, a WC — one pencil.</small></li>
          <li><span>02</span><b>See</b><small>A simple 3D massing, not a fake photo.</small></li>
          <li><span>03</span><b>Know</b><small>Light, heat and cost in plain language.</small></li>
        </ol>
        <p className="welcome-note">A concept model appears in seconds. A professional still verifies structure, code and final energy performance.</p>
        <div className="welcome-actions">
          <button type="button" className="button primary" onClick={onStart}>
            <Pencil /> Start from a blank page <ArrowRight />
          </button>
          <button type="button" className="button secondary" onClick={onSkip}>
            Explore the 50 m² sample
          </button>
        </div>
      </div>
    </div>
  )
})
