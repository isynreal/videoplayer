import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { APP_VERSION } from './version.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <div
      className="fixed left-3 top-3 z-[100] pointer-events-none rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-white/45 backdrop-blur-md shadow-lg"
      aria-label={`目前版本 ${APP_VERSION}`}
    >
      {APP_VERSION}
    </div>
  </StrictMode>,
)
