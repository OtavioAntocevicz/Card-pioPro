import type { ApiUser } from '@/services/api'
import { create } from 'zustand'

export type AuthSession = {
  access_token: string
  user: ApiUser
}

interface AuthState {
  user: ApiUser | null
  session: AuthSession | null
  initialized: boolean
  setSession: (session: AuthSession | null) => void
  setInitialized: (value: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  initialized: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),
  setInitialized: (initialized) => set({ initialized }),
}))
