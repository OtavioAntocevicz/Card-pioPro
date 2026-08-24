import { Hono } from 'hono'
import { getPool, query } from '../db.js'
import { getRestaurantOwnedBy } from '../helpers.js'
import { HttpError, requireAuth, type AppVariables } from '../middleware.js'
import { getPlanLimits, type Plan } from '../planLimits.js'

type MenuRow = {
  id: string
  restaurant_id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export const menuRoutes = new Hono<{ Variables: AppVariables }>()

menuRoutes.get('/restaurants/:restaurantId/menus', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId')
    const isPublic = c.req.query('public') === '1'

    const result = isPublic
      ? await query<MenuRow>(
          `select id, restaurant_id, name, slug, is_active, created_at
           from public.menus
           where restaurant_id = $1 and is_active = true
           order by created_at asc`,
          [restaurantId],
        )
      : await query<MenuRow>(
          `select id, restaurant_id, name, slug, is_active, created_at
           from public.menus
           where restaurant_id = $1
           order by created_at asc`,
          [restaurantId],
        )

    return c.json({ menus: result.rows })
  } catch (err) {
    console.error('list menus error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

menuRoutes.post('/restaurants/:restaurantId/menus', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const restaurantId = c.req.param('restaurantId')
    const restaurant = await getRestaurantOwnedBy(restaurantId, userId)

    const body = await c.req.json<{ name?: string; slug?: string; is_active?: boolean }>()
    const name = body.name?.trim()
    const slug = body.slug?.trim().toLowerCase()
    const isActive = body.is_active ?? false

    if (!name || !slug) {
      return c.json({ error: 'name and slug are required' }, 400)
    }

    const limits = getPlanLimits(restaurant.plan as Plan)
    const countResult = await query<{ count: string }>(
      'select count(*)::text as count from public.menus where restaurant_id = $1',
      [restaurantId],
    )
    const count = Number(countResult.rows[0]?.count ?? 0)
    if (count >= limits.maxMenus) {
      return c.json({ error: 'plan_limit_exceeded:max_menus' }, 403)
    }

    const db = await getPool().connect()
    try {
      await db.query('begin')
      const inserted = await db.query<MenuRow>(
        `insert into public.menus (restaurant_id, name, slug, is_active)
         values ($1, $2, $3, $4)
         returning id, restaurant_id, name, slug, is_active, created_at`,
        [restaurantId, name, slug, isActive],
      )
      const menu = inserted.rows[0]
      if (menu.is_active) {
        await db.query(
          `update public.menus
           set is_active = false
           where restaurant_id = $1 and id <> $2`,
          [restaurantId, menu.id],
        )
      }
      await db.query('commit')
      return c.json({ menu }, 201)
    } catch (err) {
      await db.query('rollback')
      const pgErr = err as { code?: string }
      if (pgErr.code === '23505') {
        return c.json({ error: 'Menu slug already exists for this restaurant' }, 409)
      }
      throw err
    } finally {
      db.release()
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403 | 404)
    }
    console.error('create menu error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

menuRoutes.patch('/menus/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const menuId = c.req.param('id')
    const body = await c.req.json<{ name?: string; is_active?: boolean }>()

    const existing = await query<MenuRow & { owner_id: string }>(
      `select m.id, m.restaurant_id, m.name, m.slug, m.is_active, m.created_at, r.user_id as owner_id
       from public.menus m
       join public.restaurants r on r.id = m.restaurant_id
       where m.id = $1`,
      [menuId],
    )
    const menu = existing.rows[0]
    if (!menu) {
      return c.json({ error: 'Menu not found' }, 404)
    }
    if (menu.owner_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (body.name === undefined && body.is_active === undefined) {
      return c.json({ error: 'Nothing to update' }, 400)
    }

    const db = await getPool().connect()
    try {
      await db.query('begin')
      const updated = await db.query<MenuRow>(
        `update public.menus
         set name = coalesce($2, name),
             is_active = coalesce($3, is_active)
         where id = $1
         returning id, restaurant_id, name, slug, is_active, created_at`,
        [menuId, body.name?.trim() ?? null, body.is_active ?? null],
      )
      const row = updated.rows[0]
      if (row.is_active) {
        await db.query(
          `update public.menus
           set is_active = false
           where restaurant_id = $1 and id <> $2`,
          [row.restaurant_id, row.id],
        )
      }
      await db.query('commit')
      return c.json({ menu: row })
    } catch (err) {
      await db.query('rollback')
      throw err
    } finally {
      db.release()
    }
  } catch (err) {
    console.error('update menu error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

menuRoutes.delete('/menus/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const menuId = c.req.param('id')

    const existing = await query<{ id: string; owner_id: string }>(
      `select m.id, r.user_id as owner_id
       from public.menus m
       join public.restaurants r on r.id = m.restaurant_id
       where m.id = $1`,
      [menuId],
    )
    const menu = existing.rows[0]
    if (!menu) {
      return c.json({ error: 'Menu not found' }, 404)
    }
    if (menu.owner_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await query('delete from public.menus where id = $1', [menuId])
    return c.json({ ok: true })
  } catch (err) {
    console.error('delete menu error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
