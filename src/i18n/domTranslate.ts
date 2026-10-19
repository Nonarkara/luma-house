import { translate, type Lang } from './translate'

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const
const textSource = new WeakMap<Text, string>()
const attrSource = new WeakMap<Element, Map<string, string>>()

function paint(stored: string, translated: string): string {
  const trimmed = stored.trim()
  if (!trimmed || translated === trimmed) return stored
  return stored.replace(trimmed, translated)
}

function rememberText(node: Text, lang: Lang): string {
  const current = node.nodeValue ?? ''
  const stored = textSource.get(node)
  if (stored === undefined) {
    textSource.set(node, current)
    return current
  }
  // Keep the English source while the node still shows that source or the
  // translation we painted from it. A different value is a new source from React.
  const painted = paint(stored, translate(lang, stored.trim()))
  if (current === stored || current === painted) return stored
  textSource.set(node, current)
  return current
}

function skipText(node: Text): boolean {
  const parent = node.parentElement
  if (!parent) return true
  if (parent.closest('script, style, textarea, noscript, [data-no-translate]')) return true
  return false
}

/** Rewrite visible English copy in place. React keeps the English source; this layer paints the active language. */
export function applyDomTranslations(root: ParentNode, lang: Lang): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  for (const node of texts) {
    if (skipText(node)) continue
    const source = rememberText(node, lang)
    const next = lang === 'en' ? source : paint(source, translate(lang, source.trim()))
    if (next !== node.nodeValue) node.nodeValue = next
  }

  const elements = root.querySelectorAll<HTMLElement>('*')
  elements.forEach((el) => {
    if (el.closest('script, style, [data-no-translate]')) return
    let store = attrSource.get(el)
    for (const attr of ATTRS) {
      const current = el.getAttribute(attr)
      if (current == null || current === '') continue
      if (!store) {
        store = new Map()
        attrSource.set(el, store)
      }
      const stored = store.get(attr)
      const translated = stored !== undefined ? translate(lang, stored) : ''
      const source = stored !== undefined && (current === stored || current === translated) ? stored : current
      if (stored !== source) store.set(attr, source)
      const next = lang === 'en' ? source : translate(lang, source)
      if (next !== current) el.setAttribute(attr, next)
    }
  })
}
