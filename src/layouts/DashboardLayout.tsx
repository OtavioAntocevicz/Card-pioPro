import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { logout } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { fetchIsPlatformAdmin } from '@/services/platformAdmin'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  PanelLeftClose,
  Settings,
  Shield,
  Bell,
  LifeBuoy,
  Tags,
  LayoutList,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-100 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-600/15 dark:text-brand-300 dark:ring-brand-500/30'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
  }`

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const adminQuery = useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: fetchIsPlatformAdmin,
    enabled: Boolean(user),
    staleTime: 60_000,
  })
  const isPlatformAdmin = Boolean(adminQuery.data)

  async function handleLogout() {
    await logout()
    setSession(null)
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <UtensilsCrossed className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden />
        <span className="font-semibold text-slate-900 dark:text-slate-100">CardápioPro</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <NavLink to="/app" end className={navClass} onClick={() => setOpen(false)}>
          <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
          Visão Geral
        </NavLink>
        <NavLink to="/app/settings" className={navClass} onClick={() => setOpen(false)}>
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          Restaurante
        </NavLink>
        <NavLink to="/app/menus" className={navClass} onClick={() => setOpen(false)}>
          <LayoutList className="h-4 w-4 shrink-0" aria-hidden />
          Cardápio
        </NavLink>
        <NavLink to="/app/categories" className={navClass} onClick={() => setOpen(false)}>
          <Tags className="h-4 w-4 shrink-0" aria-hidden />
          Categoria
        </NavLink>
        <NavLink to="/app/products" className={navClass} onClick={() => setOpen(false)}>
          <Package className="h-4 w-4 shrink-0" aria-hidden />
          Produto
        </NavLink>
        <NavLink to="/app/personalizacao" className={navClass} onClick={() => setOpen(false)}>
          <Palette className="h-4 w-4 shrink-0" aria-hidden />
          Personalização
        </NavLink>
        <NavLink to="/app/plans" className={navClass} onClick={() => setOpen(false)}>
          <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
          Planos
        </NavLink>
        <NavLink to="/app/support" className={navClass} onClick={() => setOpen(false)}>
          <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
          Suporte
        </NavLink>
        {isPlatformAdmin ? (
          <>
            <NavLink to="/app/admin/plans" className={navClass} onClick={() => setOpen(false)}>
              <Shield className="h-4 w-4 shrink-0" aria-hidden />
              Planos (admin)
            </NavLink>
            <NavLink to="/app/admin/notifications" className={navClass} onClick={() => setOpen(false)}>
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              Notificações
            </NavLink>
          </>
        ) : null}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <p
          className="truncate px-1 text-xs text-slate-500 dark:text-slate-500"
          title={user?.email ?? ''}
        >
          {user?.email}
        </p>
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-60 shrink-0 md:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[min(280px,85vw)] shadow-2xl">
            {sidebar}
            <button
              type="button"
              className="absolute right-2 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-medium text-slate-800 dark:text-slate-200">Painel</span>
          </div>
          <ThemeToggle />
        </header>
        <div className="hidden h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 md:flex">
          <div className="flex items-center text-sm text-slate-500 dark:text-slate-500">
            <PanelLeftClose className="mr-2 h-4 w-4 text-slate-400" aria-hidden />
            Área do restaurante
          </div>
          <ThemeToggle />
        </div>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
