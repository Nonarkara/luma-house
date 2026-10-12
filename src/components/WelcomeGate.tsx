import React from 'react'
import { ArrowRight, Pencil } from 'lucide-react'
import { WebAppAccess } from './WebAppAccess'

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
        <div className="welcome-brand"><img src="./brand/designon-symbol.png" alt="" width="80" height="80" /><img src="./brand/designon-wordmark.png" alt="designon" width="220" height="64" /></div>
        <p className="eyebrow">Napkin → space → climate</p>
        <h2 id="welcome-title">Draw a wall.<br />See what the sun does.</h2>
        <p className="welcome-lead">A line is a wall. Click a wall for a window or a door. Drag a box for a room.</p>
        <ol className="welcome-steps">
          <li><span>01</span><b>Draw</b><small>Walls, rooms, a bed, a WC — one pencil.</small></li>
          <li><span>02</span><b>See</b><small>Your plan becomes a real-time 3D study with sun, shadow and section cuts — local, no AI wait.</small></li>
          <li><span>03</span><b>Know</b><small>Light, heat and cost in plain language.</small></li>
        </ol>
        <p className="welcome-note">Concept photos and AI plan traces are opt-in add-ons — the building study, sun hours and printable study sheets are all local.</p>
        <div className="welcome-actions">
          <button type="button" className="button primary" onClick={onStart}>
            <Pencil /> Start from a blank page <ArrowRight />
          </button>
          <button type="button" className="button secondary" onClick={onSkip}>
            Explore the 50 m² sample
          </button>
        </div>
        <WebAppAccess />
      </div>
    </div>
  )
})
