import { useEffect, useState } from 'react'

/**
 * Whether a media query matches, kept in step with the window.
 *
 * Some things cannot be decided in CSS alone: a panel that must not be built
 * at all on a narrow screen cannot be built and then hidden, because the work
 * of building it — a 3D scene, a chart — is the cost this is avoiding.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}
