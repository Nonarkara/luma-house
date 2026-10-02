import React from 'react'

/** Browser installation instructions, without implying a native store release. */
export function WebAppAccess() {
  return (
    <details className="web-app-access">
      <summary><img src="./brand/designon-app.png" alt="" width="28" height="28" /><span>Available on Android and iPhone <small>Web app · Add to Home Screen</small></span></summary>
      <div className="web-app-instructions">
        <p><strong>Android</strong> — Open in Chrome. In the menu, choose <b>Add to Home screen</b> or <b>Install app</b>.</p>
        <p><strong>iPhone</strong> — Open in Safari. Tap <b>Share → Add to Home Screen</b>. Keep <b>Open as Web App</b> enabled if shown.</p>
        <p className="web-app-note">Launch designon from your home screen. Drawings are saved locally in the browser or installed app you use. Use Share to move a plan between them. An internet connection is needed to load the app and use AI features.</p>
      </div>
    </details>
  )
}
