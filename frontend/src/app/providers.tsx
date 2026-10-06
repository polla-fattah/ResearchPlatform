import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth'
import { PreferencesProvider } from './preferences'

export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
