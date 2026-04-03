import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.PROD) {
  const manifestLink = document.createElement('link')
  manifestLink.rel = 'manifest'
  manifestLink.href = '/manifest.json'
  document.head.appendChild(manifestLink)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
