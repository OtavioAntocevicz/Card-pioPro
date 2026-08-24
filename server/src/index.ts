import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js'
import type { AppVariables } from './middleware.js'
import { authRoutes } from './routes/auth.js'
import { categoryRoutes } from './routes/categories.js'
import { menuRoutes } from './routes/menus.js'
import { productRoutes } from './routes/products.js'
import { adminRestaurantRoutes, restaurantRoutes } from './routes/restaurants.js'
import { supportRoutes } from './routes/support.js'
import { uploadRoutes } from './routes/uploads.js'

const app = new Hono<{ Variables: AppVariables }>()

app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

await mkdir(path.resolve(env.UPLOAD_DIR), { recursive: true })

app.use(
  '/uploads/*',
  serveStatic({
    root: path.resolve(env.UPLOAD_DIR),
    rewriteRequestPath: (p) => p.replace(/^\/uploads\/?/, ''),
  }),
)

const api = new Hono<{ Variables: AppVariables }>()

api.get('/health', (c) => c.json({ ok: true }))

api.route('/auth', authRoutes)
api.route('/restaurants', restaurantRoutes)
api.route('/admin/restaurants', adminRestaurantRoutes)
api.route('/', menuRoutes)
api.route('/', categoryRoutes)
api.route('/', productRoutes)
api.route('/support', supportRoutes)
api.route('/uploads', uploadRoutes)

app.route('/api', api)

app.onError((err, c) => {
  console.error('Unhandled error', err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`CardápioPro API listening on http://localhost:${info.port}`)
  },
)

export default app
