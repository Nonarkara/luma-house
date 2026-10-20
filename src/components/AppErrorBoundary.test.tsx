import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, afterEach } from 'vitest'
import { AppErrorBoundary, rescuedPlan } from './AppErrorBoundary'

function renderFallback(): string {
  const boundary = new AppErrorBoundary({ children: null })
  boundary.state = { failed: true }
  return renderToStaticMarkup(boundary.render() as React.ReactElement)
}

describe('recovery sheet', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('turns a render failure into a recovery sheet with a reload action', () => {
    expect(AppErrorBoundary.getDerivedStateFromError!()).toEqual({ failed: true })
    const html = renderFallback()
    expect(html).toContain('The drawing desk stopped')
    expect(html).toContain('Reload the desk')
    expect(html).toContain('has not been lost')
  })

  it('does not promise a copy when there is no drawing to copy', () => {
    expect(rescuedPlan()).toBeNull()
    const html = renderFallback()
    expect(html).not.toContain('Download a copy')
    expect(html).toContain('No saved drawing was found')
  })

  it('finds the saved drawing and names the file for it', () => {
    const store = new Map([['designon:plan', '{"rooms":[{"name":"Saved room"}]}']])
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
    }
    const found = rescuedPlan()
    expect(found?.name).toBe('designon-plan.json')
    expect(found?.body).toContain('Saved room')
    expect(renderFallback()).toContain('Download a copy')
  })
})
