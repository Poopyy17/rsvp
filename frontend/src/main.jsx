import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminPhotos from './pages/AdminPhotos.jsx'
import ApprovedPhotos from './pages/ApprovedPhotos.jsx'
import Guests from './pages/Guests.jsx'
import ClickSpark from './components/ClickSpark.jsx'
import { Toaster } from '@/components/ui/sonner'
import { LoadingProvider } from '@/lib/loading-context'

const ROUTES = {
  '/upload-photos': AdminPhotos,
  '/upload-photos/approved': ApprovedPhotos,
  '/guests': Guests,
}

const Page = ROUTES[window.location.pathname] ?? App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoadingProvider>
      <ClickSpark sparkColor="#8a6428" sparkSize={8} sparkRadius={12} sparkCount={8} duration={350}>
        <Page />
      </ClickSpark>
      <Toaster position="bottom-right" />
    </LoadingProvider>
  </StrictMode>,
)
