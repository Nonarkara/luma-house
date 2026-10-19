import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applyDomTranslations } from './domTranslate'
import { detectLang, persistLang, translate, type Lang } from './translate'

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  tr: (text: string) => string
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  setLang: () => {},
  tr: (text) => text,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)
  useEffect(() => { persistLang(lang) }, [lang])
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    let frame = 0
    const paint = () => {
      frame = 0
      applyDomTranslations(root, lang)
    }
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(paint)
    }
    paint()
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'],
    })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [lang])
  const value = useMemo<I18nValue>(() => ({
    lang,
    setLang: setLangState,
    tr: (text) => translate(lang, text),
  }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

const OPTIONS: Array<{ id: Lang; label: string }> = [
  { id: 'th', label: 'ไทย' },
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
]

export function LanguageSwitch() {
  const { lang, setLang, tr } = useI18n()
  return (
    <div className="language-switch" role="group" aria-label={tr('Language')}>
      {OPTIONS.map((option) => (
        <button key={option.id} type="button" aria-pressed={lang === option.id} onClick={() => setLang(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
