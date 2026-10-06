import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import { AppProviders } from './app/providers'
import { createQueryClient } from './app/queryClient'
import { createAppRouter } from './app/router'
import { initI18n } from './i18n'

initI18n()

const queryClient = createQueryClient()
const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders client={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
