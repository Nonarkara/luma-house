import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-600.css'
import '@fontsource/source-sans-3/latin-700.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './styles.css'
import './design/studio.css'
import App from './App'
import { I18nProvider } from './i18n'
import { installFiberTimer } from './canvas/fiberTimer'
import { applyTheme, readTheme } from './design/themes'
import { trackPageview } from './analytics'

installFiberTimer()
applyTheme(readTheme())
trackPageview()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
)
