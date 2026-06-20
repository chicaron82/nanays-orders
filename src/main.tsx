import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import './index.css'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <App />
        <PwaUpdatePrompt />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
