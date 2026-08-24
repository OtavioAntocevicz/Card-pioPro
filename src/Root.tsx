import { MissingApiConfig } from '@/components/MissingApiConfig'
import { useAuthBootstrap } from '@/hooks/useAuth'
import { useThemeSync } from '@/hooks/useThemeSync'
import { QueryProvider } from '@/providers/QueryProvider'
import { isApiConfigured } from '@/services/api'
import App from './App.tsx'

export function Root() {
  useThemeSync()
  useAuthBootstrap()

  if (!isApiConfigured()) {
    return <MissingApiConfig />
  }

  return (
    <QueryProvider>
      <App />
    </QueryProvider>
  )
}
