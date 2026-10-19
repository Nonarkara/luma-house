import React from 'react'
import { useI18n } from '../i18n'

/** Browser installation instructions, without implying a native store release. */
export function WebAppAccess() {
  const { tr } = useI18n()
  return (
    <details className="web-app-access">
      <summary aria-label={tr('Available on Android and iPhone')}><img src="./brand/designon-app.png" alt="" width="28" height="28" /><span>{tr('Available on Android and iPhone')} <small>{tr('Web app · Add to Home Screen')}</small></span></summary>
      <div className="web-app-instructions">
        <p><strong>{tr('Android')}</strong> — {tr('Open in Chrome. In the menu, choose')} <b>{tr('Add to Home Screen')}</b> {tr('or')} <b>{tr('Install app')}</b>.</p>
        <p><strong>{tr('iPhone')}</strong> — {tr('Open in Safari. Tap')} <b>{tr('Share → Add to Home Screen')}</b>. {tr('Keep')} <b>{tr('Open as Web App')}</b> {tr('enabled if shown.')}</p>
        <p className="web-app-note">{tr('Launch designon from your home screen. Drawings are saved locally in the browser or installed app you use. Use Share to move a plan between them. An internet connection is needed to load the app and use AI features.')}</p>
      </div>
    </details>
  )
}
