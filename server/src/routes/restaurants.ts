import { Hono } from 'hono'
import { getPool, query } from '../db.js'
import type { RestaurantRow } from '../helpers.js'
import {
  HttpError,
  requireAdmin,
  requireAuth,
  type AppVariables,
} from '../middleware.js'
import { getPlanLimits, isPlan, type Plan } from '../planLimits.js'

const SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'paused',
  'canceled',
  'manual',
])

export const restaurantRoutes = new Hono<{ Variables: AppVariables }>()

restaurantRoutes.get('/me', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const result = await query<RestaurantRow>(
      `select id, user_id, name, slug, plan, theme, subscription_status,
              current_period_end, updated_by_admin_id, updated_at, created_at
       from public.restaurants
       where user_id = $1
       order by created_at asc
       limit 1`,
      [userId],
    )
    return c.json({ restaurant: result.rows[0] ?? null })
  } catch (err) {
    console.error('restaurants/me error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

restaurantRoutes.get('/by-slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug').trim().toLowerCase()
    const result = await query<RestaurantRow>(
      `select id, user_id, name, slug, plan, theme, subscription_status,
              current_period_end, updated_by_admin_id, updated_at, created_at
       from public.restaurants
       where slug = $1
       limit 1`,
      [slug],
    )
    return c.json({ restaurant: result.rows[0] ?? null })
  } catch (err) {
    console.error('restaurants/by-slug error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

restaurantRoutes.post('/', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json<{ name?: string; slug?: string }>()
    const name = body.name?.trim()
    const slug = body.slug?.trim().toLowerCase()

    if (!name || !slug) {
      return c.json({ error: 'name and slug are required' }, 400)
    }

    const existing = await query<{ id: string; plan: Plan }>(
      'select id, plan from public.restaurants where user_id = $1',
      [userId],
    )
    const currentPlan = existing.rows[0]?.plan ?? 'free'
    const limits = getPlanLimits(currentPlan)
    if (existing.rows.length >= limits.maxRestaurants) {
      return c.json(
        { error: `plan_limit_exceeded:max_restaurants (${limits.maxRestaurants})` },
        403,
      )
    }

    const db = await getPool().connect()
    try {
      await db.query('begin')
      const inserted = await db.query<RestaurantRow>(
        `insert into public.restaurants (user_id, name, slug, plan)
         values ($1, $2, $3, $4)
         returning id, user_id, name, slug, plan, theme, subscription_status,
                   current_period_end, updated_by_admin_id, updated_at, created_at`,
        [userId, name, slug, currentPlan],
      )
      const restaurant = inserted.rows[0]
      await db.query(
        `insert into public.menus (restaurant_id, name, slug, is_active)
         values ($1, 'Principal', 'principal', true)`,
        [restaurant.id],
      )
      await db.query('commit')
      return c.json({ restaurant }, 201)
    } catch (err) {
      await db.query('rollback')
      const pgErr = err as { code?: string }
      if (pgErr.code === '23505') {
        return c.json({ error: 'Slug already in use' }, 409)
      }
      throw err
    } finally {
      db.release()
    }
  } catch (err) {
    console.error('create restaurant error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

restaurantRoutes.patch('/me', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json<{ name?: string; slug?: string }>()

    const current = await query<RestaurantRow>(
      `select id from public.restaurants
       where user_id = $1
       order by created_at asc
       limit 1`,
      [userId],
    )
    const restaurant = current.rows[0]
    if (!restaurant) {
      return c.json({ error: 'Restaurant not found' }, 404)
    }

    const name = body.name?.trim()
    const slug = body.slug?.trim().toLowerCase()
    if (name === undefined && slug === undefined) {
      return c.json({ error: 'Nothing to update' }, 400)
    }

    const updated = await query<RestaurantRow>(
      `update public.restaurants
       set name = coalesce($2, name),
           slug = coalesce($3, slug),
           updated_at = now()
       where id = $1
       returning id, user_id, name, slug, plan, theme, subscription_status,
                 current_period_end, updated_by_admin_id, updated_at, created_at`,
      [restaurant.id, name ?? null, slug ?? null],
    )
    return c.json({ restaurant: updated.rows[0] })
  } catch (err) {
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      return c.json({ error: 'Slug already in use' }, 409)
    }
    console.error('patch restaurant/me error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

restaurantRoutes.patch('/me/theme', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json<{ theme?: unknown }>()
    if (body.theme === undefined) {
      return c.json({ error: 'theme is required' }, 400)
    }

    const current = await query<RestaurantRow>(
      `select id from public.restaurants
       where user_id = $1
       order by created_at asc
       limit 1`,
      [userId],
    )
    const restaurant = current.rows[0]
    if (!restaurant) {
      return c.json({ error: 'Restaurant not found' }, 404)
    }

    const updated = await query<RestaurantRow>(
      `update public.restaurants
       set theme = $2::jsonb,
           updated_at = now()
       where id = $1
       returning id, user_id, name, slug, plan, theme, subscription_status,
                 current_period_end, updated_by_admin_id, updated_at, created_at`,
      [restaurant.id, JSON.stringify(body.theme)],
    )
    return c.json({ restaurant: updated.rows[0] })
  } catch (err) {
    console.error('patch restaurant theme error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export const adminRestaurantRoutes = new Hono<{ Variables: AppVariables }>()

adminRestaurantRoutes.get('/', requireAuth, async (c) => {
  try {
    await requireAdmin(c.get('userId'))
    const result = await query(
      `select
         r.id as restaurant_id,
         r.name as restaurant_name,
         r.slug as restaurant_slug,
         r.user_id,
         r.plan,
         r.subscription_status,
         r.current_period_end,
         (select count(*)::int from public.menus m where m.restaurant_id = r.id) as menus_count,
         (select count(*)::int from public.categories cat where cat.restaurant_id = r.id) as categories_count,
         (select count(*)::int from public.products p where p.restaurant_id = r.id) as products_count
       from public.restaurants r
       order by r.created_at desc`,
    )
    return c.json({ restaurants: result.rows })
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403)
    }
    console.error('admin restaurants error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

adminRestaurantRoutes.post('/:id/plan-status', requireAuth, async (c) => {
  try {
    const adminUserId = c.get('userId')
    await requireAdmin(adminUserId)

    const restaurantId = c.req.param('id')
    const body = await c.req.json<{
      plan?: string
      status?: string
      periodEnd?: string | null
      note?: string | null
    }>()

    if (!isPlan(body.plan)) {
      return c.json({ error: 'Invalid plan' }, 400)
    }
    if (!body.status || !SUBSCRIPTION_STATUSES.has(body.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const existing = await query<{
      id: string
      plan: string
      subscription_status: string
    }>('select id, plan, subscription_status from public.restaurants where id = $1', [
      restaurantId,
    ])
    const restaurant = existing.rows[0]
    if (!restaurant) {
      return c.json({ error: 'Restaurant not found' }, 404)
    }

    const db = await getPool().connect()
    try {
      await db.query('begin')
      await db.query(
        `update public.restaurants
         set plan = $2,
             subscription_status = $3,
             current_period_end = $4,
             updated_by_admin_id = $5,
             updated_at = now()
         where id = $1`,
        [restaurantId, body.plan, body.status, body.periodEnd ?? null, adminUserId],
      )
      await db.query(
        `insert into public.admin_audit_logs (
           admin_user_id, restaurant_id, action, old_plan, new_plan, old_status, new_status, note
         ) values ($1, $2, 'plan_status_update', $3, $4, $5, $6, $7)`,
        [
          adminUserId,
          restaurantId,
          restaurant.plan,
          body.plan,
          restaurant.subscription_status,
          body.status,
          body.note ?? null,
        ],
      )
      await db.query('commit')
    } catch (err) {
      await db.query('rollback')
      throw err
    } finally {
      db.release()
    }

    return c.json({ ok: true })
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403)
    }
    console.error('admin plan-status error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

adminRestaurantRoutes.get('/:id/audit-logs', requireAuth, async (c) => {
  try {
    await requireAdmin(c.get('userId'))
    const restaurantId = c.req.param('id')
    const result = await query(
      `select id, admin_user_id, restaurant_id, action, old_plan, new_plan,
              old_status, new_status, note, created_at
       from public.admin_audit_logs
       where restaurant_id = $1
       order by created_at desc
       limit 20`,
      [restaurantId],
    )
    return c.json({ logs: result.rows })
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403)
    }
    console.error('admin audit-logs error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
