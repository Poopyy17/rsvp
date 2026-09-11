import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClickSpark from './components/ClickSpark.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClickSpark sparkColor="#8a6428" sparkSize={8} sparkRadius={12} sparkCount={8} duration={350}>
      <App />
    </ClickSpark>
  </StrictMode>,
)
