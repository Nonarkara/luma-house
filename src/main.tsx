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
import { applyTheme, readTheme } from './design/themes'
import { trackPageview } from './analytics'

applyTheme(readTheme())
trackPageview()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
