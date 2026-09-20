import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useAppStore } from './stores/useAppStore'

const initialState = useAppStore.getState()
document.documentElement.dataset.theme = initialState.theme
document.documentElement.dataset.skin = initialState.skin
document.documentElement.style.colorScheme =
  initialState.skin === 'win98' ? 'light' : initialState.theme

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
