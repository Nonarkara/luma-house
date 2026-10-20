import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import './design/studio.css'
import { SelfTestPage } from './components/SelfTestPage'
import { applyTheme, readTheme } from './design/themes'

applyTheme(readTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SelfTestPage />
  </React.StrictMode>,
)
