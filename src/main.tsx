import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ensureSupabase, supabase } from './lib/supabase'
import { queryClient } from './lib/queryClient'
import { ThemeProvider } from './theme/ThemeContext'

ensureSupabase()

const element = document.getElementById('root')!
if (!supabase) {
  createRoot(element).render(
    <StrictMode>
      <p className="banner warn" style={{ margin: '2rem', maxWidth: '42rem' }}>
        Failed to initialize the database. Please let me know on Discord @halzyn.
      </p>
    </StrictMode>,
  )
} else {
  createRoot(element).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
