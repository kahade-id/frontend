import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { addI18nResources } from '@kahade/utils'
import id from './locales/id.json'
import en from './locales/en.json'

// Load app-specific translations
addI18nResources({ id: id as any, en: en as any })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
