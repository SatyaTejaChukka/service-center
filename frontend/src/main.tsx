import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { AuthProvider } from './context/AuthContext'
import { DesktopModalProvider } from './context/DesktopModalContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DesktopModalProvider>
        <App />
      </DesktopModalProvider>
    </AuthProvider>
  </StrictMode>,
)
