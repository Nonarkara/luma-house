import React from 'react'
import { AppErrorBoundary } from './AppErrorBoundary'

/**
 * A page that throws during render on purpose, so the recovery sheet can be
 * exercised in a real browser. A render crash is the one failure a unit test
 * cannot reach, and the recovery sheet is the last thing between a user and
 * a lost drawing — so it is checked where it actually runs.
 */
function DeliberateCrash(): React.ReactElement {
  throw new Error('designon self-test: this render was meant to fail')
}

export function SelfTestPage() {
  return (
    <div className="app-failed">
      <main className="app-failed-card">
        <p className="app-failed-eyebrow">Self-test</p>
        <h1>The recovery sheet, on purpose.</h1>
        <p className="app-failed-lead">
          The block below throws while it renders. The sheet that replaces it is the same one a
          real crash would show, with the same actions.
        </p>
        <AppErrorBoundary>
          <DeliberateCrash />
        </AppErrorBoundary>
      </main>
    </div>
  )
}
