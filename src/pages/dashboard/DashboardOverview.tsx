import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { getPlanLimits } from '@/config/planLimits'
import { fetchCategories } from '@/services/categories'
import { createRestaurant, fetchMyRestaurant } from '@/services/restaurants'
import { fetchProducts } from '@/services/products'
import { downloadMenuPdf } from '@/utils/menuPdf'
import { downloadMenuQrPng } from '@/utils/menuQr'
import { isValidSlug, slugify } from '@/utils/slug'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileDown, Link2, Package, QrCode, Tags } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export function DashboardOverview() {
  const qc = useQueryClient()
  const restaurantQuery = useQuery({
    queryKey: ['my-restaurant'],
    queryFn: fetchMyRestaurant,
  })

  const restaurant = restaurantQuery.data

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return { categories: 0, products: 0 }
      const [cats, prods] = await Promise.all([
        fetchCategories(restaurant.id),
        fetchProducts(restaurant.id),
      ])
      return { categories: cats.length, products: prods.length }
    },
    enabled: Boolean(restaurant?.id),
  })

  const menuExportQuery = useQuery({
    queryKey: ['dashboard-menu-export', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) throw new Error('Restaurante não carregado')
      const [categories, products] = await Promise.all([
        fetchCategories(restaurant.id),
        fetchProducts(restaurant.id),
      ])
      return { categories, products }
    },
    enabled: Boolean(restaurant?.id),
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: createRestaurant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-restaurant'] }),
  })

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [includePhotosInPdf, setIncludePhotosInPdf] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    const s = slug.trim().toLowerCase()
    if (!isValidSlug(s)) {
      return
    }
    createMut.mutate({ name, slug: s })
  }

  async function handleDownloadPdf() {
    if (!restaurant || !publicUrl) return
    const data = menuExportQuery.data
    if (!data) return
    setExportBusy(true)
    setExportError(null)
    try {
      await downloadMenuPdf({
        restaurantName: restaurant.name,
        categories: data.categories,
        products: data.products,
        includePhotos: includePhotosInPdf,
        fileBaseName: `cardapio-${restaurant.slug}`,
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.')
    } finally {
      setExportBusy(false)
    }
  }

  async function handleDownloadQr() {
    if (!restaurant || !publicUrl) return
    setExportError(null)
    try {
      await downloadMenuQrPng(publicUrl, `qrcode-cardapio-${restaurant.slug}`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Não foi possível gerar o QR Code.')
    }
  }

  const publicUrl =
    typeof window !== 'undefined' && restaurant
      ? `${window.location.origin}/m/${restaurant.slug}`
      : ''
  const limits = getPlanLimits(restaurant?.plan)

  if (restaurantQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (restaurantQuery.isError) {
    const raw = restaurantQuery.error
    const detail =
      raw instanceof Error
        ? raw.message
        : typeof raw === 'object' &&
            raw !== null &&
            'message' in raw &&
            typeof (raw as { message: unknown }).message === 'string'
          ? (raw as { message: string }).message
          : String(raw)

    const looksLikeMissingTable =
      /does not exist|schema cache|Could not find the table|relation/i.test(detail)

    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
        <p className="font-medium text-red-800 dark:text-red-50">
          Não foi possível consultar a API.
        </p>
        <p className="rounded-lg bg-white/80 px-3 py-2 font-mono text-xs text-red-800 dark:bg-black/20 dark:text-red-200/95">
          {detail}
        </p>
        {looksLikeMissingTable ? (
          <div className="space-y-2 text-red-900/90 dark:text-slate-300">
            <p>
              Isso costuma significar que a{' '}
              <strong className="text-red-950 dark:text-slate-200">migração SQL</strong> ainda não foi
              executada no Postgres do Railway.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-xs">
              <li>
                No serviço da API, rode <code className="text-brand-700 dark:text-brand-300">npm run db:migrate</code>.
              </li>
              <li>
                Ou aplique <code className="text-brand-700 dark:text-brand-300">db/schema.sql</code> no
                Postgres.
              </li>
              <li>
                Confira se a tabela{' '}
                <code className="text-brand-700 dark:text-brand-300">restaurants</code> existe.
              </li>
            </ol>
          </div>
        ) : (
          <p className="text-xs text-red-800/90 dark:text-slate-400">
            Confira se a API no Railway está no ar e se{' '}
            <code className="text-red-950 dark:text-slate-300">VITE_API_URL</code> aponta para ela. Em
            desenvolvimento local, use o proxy do Vite (<code className="text-red-950 dark:text-slate-300">/api</code>)
            com <code className="text-red-950 dark:text-slate-300">npm run dev</code> na pasta{' '}
            <code className="text-red-950 dark:text-slate-300">server</code>.
          </p>
        )}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Criar restaurante</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Defina o nome e o endereço público do cardápio (slug). O slug deve ser único.
        </p>
        <Card className="mt-6">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              label="Nome do restaurante"
              name="name"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex.: Cantinho da Esquina"
            />
            <Input
              label="Slug público (URL)"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
              placeholder="ex-cantinho"
            />
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Seu link:{' '}
              <span className="text-slate-700 dark:text-slate-400">/m/{slug || 'seu-slug'}</span>
            </p>
            {createMut.isError ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {(createMut.error as Error).message.includes('duplicate') ||
                (createMut.error as Error).message.includes('unique')
                  ? 'Este slug já está em uso. Escolha outro.'
                  : (createMut.error as Error).message}
              </p>
            ) : null}
            <Button type="submit" loading={createMut.isPending}>
              Criar restaurante
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Visão geral</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        Olá! Gerencie seu cardápio em{' '}
        <span className="font-medium text-slate-800 dark:text-slate-200">{restaurant.name}</span>.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <Tags className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Categorias</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {statsQuery.isLoading ? '—' : statsQuery.data?.categories ?? 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">Total no restaurante</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Package className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Produtos</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {statsQuery.isLoading ? '—' : statsQuery.data?.products ?? 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">Total no restaurante</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              <Link2 className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
              Link público do cardápio
            </p>
            <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">{publicUrl}</p>
            <p className="mt-2 text-xs text-slate-500">
              Plano atual:{' '}
              <span className="text-slate-700 dark:text-slate-400">{restaurant.plan}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="gap-2">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Abrir em nova aba
              </Button>
            </a>
            <Link to="/app/settings">
              <Button variant="ghost" className="gap-2">
                Editar restaurante
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          <FileDown className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
          PDF e QR Code para impressão
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Gere um PDF em formato lista (apenas itens disponíveis) ou uma imagem do QR com o link
          público do cardápio.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
            checked={includePhotosInPdf}
            onChange={(e) => setIncludePhotosInPdf(e.target.checked)}
          />
          <span>Incluir fotos dos pratos no PDF (arquivo maior; pode demorar um pouco)</span>
        </label>
        {exportError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{exportError}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            loading={exportBusy}
            disabled={menuExportQuery.isLoading || menuExportQuery.isError || exportBusy}
            onClick={() => void handleDownloadPdf()}
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={!publicUrl || !limits.allowQrCode}
            onClick={() => void handleDownloadQr()}
          >
            <QrCode className="h-4 w-4" aria-hidden />
            Baixar QR Code (PNG)
          </Button>
        </div>
        {!limits.allowQrCode ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            QR Code disponível apenas nos planos Pro e Enterprise.
          </p>
        ) : null}
        {menuExportQuery.isError ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            Não foi possível carregar os dados do cardápio para o PDF. Atualize a página.
          </p>
        ) : null}
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/app/menus">
          <Button variant="ghost">Gerenciar cardápios</Button>
        </Link>
        <Link to="/app/categories">
          <Button variant="secondary">Gerenciar categorias</Button>
        </Link>
        <Link to="/app/products">
          <Button>Gerenciar produtos</Button>
        </Link>
      </div>
    </div>
  )
}
