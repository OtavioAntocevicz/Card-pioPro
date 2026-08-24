# CardápioPro

SaaS de cardápio digital para restaurantes: painel admin (categorias, produtos, imagens) e cardápio público por slug (`/m/:slug`). Stack: React, Vite, TypeScript, Tailwind CSS, Zustand, TanStack Query, API Node (Hono) + Postgres no Railway e PWA.

## Pré-requisitos

- Node.js 20+
- Projeto no [Railway](https://railway.com) com Postgres + serviço da API

## Configuração

1. Clone o repositório e instale dependências:

   ```bash
   npm install
   npm install --prefix server
   ```

2. Copie o exemplo de variáveis do frontend:

   ```bash
   cp .env.example .env
   ```

   - Em desenvolvimento local, deixe `VITE_API_URL` vazio — o Vite faz proxy de `/api` e `/uploads` para `http://localhost:3001`.
   - Em produção (Vercel), defina `VITE_API_URL` como a URL pública da API, incluindo `/api` (ex.: `https://api.exemplo.up.railway.app/api`).

3. Configure a API (`server/.env`):

   ```bash
   cp server/.env.example server/.env
   ```

   - `DATABASE_URL` — connection string do Postgres (no Railway: `${{Postgres.DATABASE_URL}}`)
   - `JWT_SECRET` — segredo forte para assinar tokens
   - `PUBLIC_API_URL` — URL pública da API (sem `/api`), usada nas URLs de upload
   - `CORS_ORIGIN` — origem do frontend (ou `*` em desenvolvimento)

4. Aplique o schema:

   ```bash
   npm run db:migrate --prefix server
   ```

   O SQL canônico fica em `db/schema.sql`.

5. Rode API e frontend:

   ```bash
   npm run dev --prefix server
   npm run dev
   ```

### Administrar planos

1. Inclua seu usuário como admin (UUID da tabela `users`):

   ```sql
   insert into public.platform_admins (user_id)
   values ('cole-aqui-o-uuid-do-seu-usuario');
   ```

2. Faça login e abra **Planos (admin)** (`/app/admin/plans`).

## Deploy

### API + Postgres (Railway)

Projeto Railway **CardapioPro**:

- Serviço **Postgres** — banco de dados
- Serviço **api** — pasta `server/`, variáveis:
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `JWT_SECRET=...`
  - `PUBLIC_API_URL=https://<dominio-da-api>`
  - `CORS_ORIGIN=https://<dominio-do-frontend>`
  - `PORT` (Railway injeta automaticamente)

Build/start sugeridos na pasta `server`:

```bash
npm install && npm run build
npm run db:migrate && npm start
```

### Frontend (Vercel)

1. **Project → Settings → Environment Variables**
2. Adicione `VITE_API_URL` = URL da API + `/api`
3. Redeploy após salvar

O arquivo `vercel.json` redireciona rotas do React Router para `index.html`.

### Checklist

- [ ] Postgres no Railway com `db/schema.sql` aplicado
- [ ] API no Railway saudável (`GET /api/health`)
- [ ] `VITE_API_URL` no build da Vercel
- [ ] `CORS_ORIGIN` liberando o domínio do frontend

## CI (GitHub Actions)

No push/PR para `main` ou `master`, o workflow `.github/workflows/ci.yml` roda `lint`, `test:run` e `build`. Use **Node 20+** localmente para espelhar o CI.

## Scripts

| Comando                       | Descrição                    |
| ----------------------------- | ---------------------------- |
| `npm run dev`                 | Frontend (Vite)              |
| `npm run build`               | Build do frontend            |
| `npm run preview`             | Servir pasta `dist`          |
| `npm run lint`                | ESLint                       |
| `npm run test` / `test:run`   | Vitest                       |
| `npm run dev --prefix server` | API local                    |
| `npm run db:migrate --prefix server` | Aplica `db/schema.sql` |

## Estrutura

- `src/` — frontend
- `server/` — API Hono + Postgres
- `db/schema.sql` — schema Railway
- `supabase/` — schema legado (referência; não usado pelo app atual)
