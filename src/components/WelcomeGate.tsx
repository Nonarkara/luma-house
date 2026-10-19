import React from 'react'
import { LanguageSwitch, useI18n } from '../i18n'
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
  const { tr } = useI18n()
  if (!open) return null

  return (
    <div className="welcome-gate" role="region" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-brand"><img src="./brand/designon-symbol.png" alt="" width="80" height="80" /><img src="./brand/designon-wordmark.png" alt="designon" width="220" height="64" /></div>
        <LanguageSwitch />
        <p className="eyebrow">{tr('Napkin → space → climate')}</p>
        <h2 id="welcome-title">{tr('Draw a wall.')}<br />{tr('See what the sun does.')}</h2>
        <p className="welcome-lead">{tr('A line is a wall. Click a wall for a window or a door. Drag a box for a room.')}</p>
        <div className="welcome-actions">
          <button type="button" className="button primary" onClick={onStart}>
            {tr('Start from a blank page')}
          </button>
          <button type="button" className="button secondary" onClick={onSkip}>
            {tr('Explore the 50 m² sample')}
          </button>
        </div>
        <WebAppAccess />
      </div>
    </div>
  )
})
