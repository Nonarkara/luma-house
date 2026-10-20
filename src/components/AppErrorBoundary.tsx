import React from 'react'
import { CHINA_PROJECT_KEY } from '../mockups/chinaApartment'

/** Plan storage the boundary can rescue. The draft is written under
 *  `designon:plan`; the 50 m² sample lives under its own key. */
const RESCUABLE_KEYS = [CHINA_PROJECT_KEY, 'designon:plan']

export function rescuedPlan(): { name: string; body: string } | null {
  try {
    for (const key of RESCUABLE_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw) return { name: `${key.replace('designon:', 'designon-')}.json`, body: raw }
    }
  } catch {
    // Storage can be unavailable; the reload action still works.
  }
  return null
}

/**
 * A render crash used to leave a blank page and a drawing the user had
 * already spent time on. The plan lives in this browser, so the boundary
 * says so and offers the file back rather than losing it.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state: { failed: boolean } = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    // Keep the detail in the console for the person who can act on it.
    console.error('designon could not draw this view:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const file = rescuedPlan()
    return (
      <div className="app-failed">
        <main className="app-failed-card">
          <p className="app-failed-eyebrow">The drawing desk stopped</p>
          <h1>This view could not be drawn.</h1>
          <p className="app-failed-lead">
            Your drawing is stored in this browser and has not been lost. Reload to carry on, or
            take a copy first.
          </p>
          <div className="app-failed-actions">
            <button type="button" className="app-failed-primary" onClick={() => window.location.reload()}>
              Reload the desk
            </button>
            {file && (
              <button
                type="button"
                className="app-failed-secondary"
                onClick={() => {
                  const blob = new Blob([file.body], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = file.name
                  link.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Download a copy
              </button>
            )}
          </div>
          <p className="app-failed-note">
            {file
              ? 'The copy is the plan exactly as it was last saved.'
              : 'No saved drawing was found in this browser.'}
          </p>
        </main>
      </div>
    )
  }
}
