export function MissingApiConfig() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 text-center dark:bg-slate-950">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Configuração necessária
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
          URL da API não encontrada
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          O build não recebeu{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
            VITE_API_URL
          </code>
          . No Vite ela precisa existir <strong>no momento do build</strong>.
        </p>
        <ol className="mt-6 space-y-3 text-left text-sm text-slate-700 dark:text-slate-300">
          <li className="flex gap-2">
            <span className="font-semibold text-brand-600 dark:text-brand-400">1.</span>
            No painel da Vercel: <strong>Project → Settings → Environment Variables</strong>.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-brand-600 dark:text-brand-400">2.</span>
            Adicione <code className="text-xs">VITE_API_URL</code> apontando para a API no Railway
            (ex.: <code className="text-xs">https://sua-api.up.railway.app/api</code>).
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-brand-600 dark:text-brand-400">3.</span>
            <strong>Redeploy</strong> o projeto para o build embutir o valor.
          </li>
        </ol>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          Localmente, copie <code className="text-slate-600 dark:text-slate-400">.env.example</code>{' '}
          para <code className="text-slate-600 dark:text-slate-400">.env</code> (o proxy do Vite usa{' '}
          <code className="text-xs">/api</code> se a variável estiver vazia).
        </p>
      </div>
    </div>
  )
}
