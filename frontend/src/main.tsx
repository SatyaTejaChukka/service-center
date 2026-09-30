import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { AuthProvider } from './context/AuthContext'
import { DesktopModalProvider } from './context/DesktopModalContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <DesktopModalProvider>
          <App />
        </DesktopModalProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
