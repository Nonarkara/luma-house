import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StandardsBadge } from './StandardsBadge'

describe('StandardsBadge', () => {
  it('renders a code reference as data instead of React reserved ref metadata', () => {
    const html = renderToStaticMarkup(
      <StandardsBadge
        codeRef="IBC 1208.1"
        severity="info"
        name="Minimum Habitable Area"
        inline
      />,
    )

    expect(html).toContain('IBC 1208.1')
    expect(html).toContain('Minimum Habitable Area')
  })
})
