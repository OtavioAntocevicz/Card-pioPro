import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { loginWithPassword } from '@/hooks/useAuth'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ApiError } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (initialized && user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await loginWithPassword(email, password)
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? 'Email ou senha inválidos.'
          : err instanceof Error
            ? err.message
            : 'Falha ao entrar.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <CardSection title="Entrar" subtitle="Acesse o painel do seu restaurante.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            name="email"
            label="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            name="password"
            label="Senha"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Não tem conta?{' '}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Criar conta
          </Link>
        </p>
      </CardSection>
    </AuthLayout>
  )
}

function CardSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/30">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}
