import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-600.css'
import '@fontsource/source-sans-3/latin-700.css'
import '@fontsource/josefin-sans/latin-600.css'
import '@fontsource/josefin-sans/latin-700.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles.css'
import App from './App'
import { trackPageview } from './analytics'

trackPageview()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
