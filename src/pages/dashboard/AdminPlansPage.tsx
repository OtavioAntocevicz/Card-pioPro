import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import {
  adminSetRestaurantPlanStatus,
  fetchAdminAuditLogs,
  fetchAllRestaurantsAdmin,
} from '@/services/restaurants'
import type { AdminRestaurantUsage, Plan, SubscriptionStatus } from '@/types/database'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

const PLANS: Plan[] = ['free', 'pro', 'enterprise']
type BillingStatus = 'active' | 'pending' | 'canceled'
const BILLING_STATUS: BillingStatus[] = ['active', 'pending', 'canceled']

function planSelectClassName() {
  return 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
}

function toBillingStatus(status: SubscriptionStatus): BillingStatus {
  if (status === 'active') return 'active'
  if (status === 'canceled') return 'canceled'
  return 'pending'
}

function toDbStatus(status: BillingStatus): SubscriptionStatus {
  if (status === 'active') return 'active'
  if (status === 'canceled') return 'canceled'
  return 'manual'
}

function statusLabel(status: BillingStatus): string {
  if (status === 'active') return 'Ativado'
  if (status === 'canceled') return 'Cancelado'
  return 'Pendente'
}

function statusBadgeClass(status: BillingStatus): string {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (status === 'canceled') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
}

export function AdminPlansPage() {
  const qc = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['admin-restaurants'],
    queryFn: fetchAllRestaurantsAdmin,
  })

  const [pendingId, setPendingId] = useState<string | null>(null)

  const planMut = useMutation({
    mutationFn: ({ id, plan, status }: { id: string; plan: Plan; status: SubscriptionStatus }) =>
      adminSetRestaurantPlanStatus({ restaurantId: id, plan, status }),
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => setPendingId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-restaurants'] }),
  })
  const [selectedAuditRestaurant, setSelectedAuditRestaurant] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | Plan>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | BillingStatus>('all')
  const auditQuery = useQuery({
    queryKey: ['admin-audit', selectedAuditRestaurant],
    queryFn: () => fetchAdminAuditLogs(selectedAuditRestaurant!),
    enabled: Boolean(selectedAuditRestaurant),
  })

  const filteredRows = useMemo(() => {
    const rows = listQuery.data ?? []
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      const b = toBillingStatus(r.subscription_status)
      const matchesPlan = planFilter === 'all' || r.plan === planFilter
      const matchesStatus = statusFilter === 'all' || b === statusFilter
      const matchesSearch =
        !term ||
        r.restaurant_name.toLowerCase().includes(term) ||
        r.restaurant_slug.toLowerCase().includes(term) ||
        r.user_id.toLowerCase().includes(term)
      return matchesPlan && matchesStatus && matchesSearch
    })
  }, [listQuery.data, q, planFilter, statusFilter])

  if (listQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (listQuery.isError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-300">
        {(listQuery.error as Error).message}
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Planos (admin)</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Altere o plano de cada restaurante. O dono é identificado pelo{' '}
        <code className="text-xs text-slate-700 dark:text-slate-300">user_id</code> na tabela{' '}
        <code className="text-xs text-slate-700 dark:text-slate-300">users</code> do Postgres.
      </p>

      <Card className="mt-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Buscar"
            name="admin-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, slug ou user_id"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Plano</label>
            <select
              className={planSelectClassName()}
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as 'all' | Plan)}
            >
              <option value="all">Todos</option>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensalidade</label>
            <select
              className={planSelectClassName()}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | BillingStatus)}
            >
              <option value="all">Todos</option>
              {BILLING_STATUS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <h2 className="mt-8 text-lg font-semibold text-slate-900 dark:text-white">Restaurantes e planos</h2>
      <Card className="mt-3 overflow-x-auto p-0">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Mensalidade</th>
              <th className="px-4 py-3 font-medium">Uso</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredRows.map((r: AdminRestaurantUsage) => {
              const billingStatus = toBillingStatus(r.subscription_status)
              return (
              <tr key={r.restaurant_id} className="text-slate-800 dark:text-slate-200">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.restaurant_name}</p>
                  <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    /m/{r.restaurant_slug}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {r.user_id}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={planSelectClassName()}
                      value={r.plan}
                      disabled={planMut.isPending && pendingId === r.restaurant_id}
                      aria-label={`Plano de ${r.restaurant_name}`}
                      onChange={(e) => {
                        const plan = e.target.value as Plan
                        if (plan === r.plan) return
                        planMut.mutate({
                          id: r.restaurant_id,
                          plan,
                          status: toDbStatus(billingStatus),
                        })
                      }}
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(billingStatus)}`}>
                      {statusLabel(billingStatus)}
                    </span>
                    <select
                      className={planSelectClassName()}
                      value={billingStatus}
                      disabled={planMut.isPending && pendingId === r.restaurant_id}
                      onChange={(e) =>
                        planMut.mutate({
                          id: r.restaurant_id,
                          plan: r.plan,
                          status: toDbStatus(e.target.value as BillingStatus),
                        })
                      }
                    >
                      {BILLING_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div>Cardápios: {r.menus_count}</div>
                  <div>Categorias: {r.categories_count}</div>
                  <div>Produtos: {r.products_count}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs">
                    <a
                      href={`/m/${r.restaurant_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Ver cardápio
                    </a>
                    <button
                      type="button"
                      className="text-left text-slate-600 hover:underline dark:text-slate-300"
                      onClick={() => setSelectedAuditRestaurant(r.restaurant_id)}
                    >
                      Ver auditoria
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        {filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
            Nenhum resultado encontrado.
          </p>
        ) : null}
      </Card>

      {planMut.isError ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-300">
          {(planMut.error as Error).message}
        </p>
      ) : null}

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
        Para ver o email do dono, consulte a tabela{' '}
        <code className="text-xs">users</code> no Postgres do Railway pelo UUID acima.
      </p>
      {selectedAuditRestaurant ? (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Auditoria recente</h3>
            <button
              type="button"
              className="text-xs text-slate-500 hover:underline dark:text-slate-400"
              onClick={() => setSelectedAuditRestaurant(null)}
            >
              Fechar
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {(auditQuery.data ?? []).map((log) => (
              <p key={log.id} className="text-slate-600 dark:text-slate-300">
                {new Date(log.created_at).toLocaleString()} — {log.old_plan ?? '-'} → {log.new_plan ?? '-'} /{' '}
                {log.old_status ?? '-'} → {log.new_status ?? '-'}
              </p>
            ))}
            {!auditQuery.isLoading && (auditQuery.data?.length ?? 0) === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">Sem eventos recentes.</p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
