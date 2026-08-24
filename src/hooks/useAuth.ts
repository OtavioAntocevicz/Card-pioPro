import { apiRequest, getToken, isApiConfigured, setToken, type ApiUser } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'

export function useAuthBootstrap() {
  const setSession = useAuthStore((s) => s.setSession)
  const setInitialized = useAuthStore((s) => s.setInitialized)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      if (!isApiConfigured()) {
        setSession(null)
        setInitialized(true)
        return
      }

      const token = getToken()
      if (!token) {
        if (mounted) {
          setSession(null)
          setInitialized(true)
        }
        return
      }

      try {
        const data = await apiRequest<{ user: ApiUser }>('/auth/me')
        if (!mounted) return
        setSession({ access_token: token, user: data.user })
      } catch {
        setToken(null)
        if (mounted) setSession(null)
      } finally {
        if (mounted) setInitialized(true)
      }
    }

    void bootstrap()
    return () => {
      mounted = false
    }
  }, [setSession, setInitialized])
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  const data = await apiRequest<{ token: string; user: ApiUser }>('/auth/login', {
    auth: false,
    body: { email, password },
  })
  setToken(data.token)
  useAuthStore.getState().setSession({ access_token: data.token, user: data.user })
}

export async function registerWithPassword(email: string, password: string): Promise<void> {
  const data = await apiRequest<{ token: string; user: ApiUser }>('/auth/register', {
    auth: false,
    body: { email, password },
  })
  setToken(data.token)
  useAuthStore.getState().setSession({ access_token: data.token, user: data.user })
}

export async function logout(): Promise<void> {
  setToken(null)
  useAuthStore.getState().setSession(null)
}
