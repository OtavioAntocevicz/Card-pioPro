import { Hono } from 'hono'
import { query } from '../db.js'
import { getRestaurantOwnedBy } from '../helpers.js'
import { HttpError, requireAuth, type AppVariables } from '../middleware.js'
import { getPlanLimits, type Plan } from '../planLimits.js'

type CategoryRow = {
  id: string
  restaurant_id: string
  menu_id: string
  name: string
  created_at: string
}

export const categoryRoutes = new Hono<{ Variables: AppVariables }>()

categoryRoutes.get('/restaurants/:restaurantId/categories', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId')
    const menuId = c.req.query('menuId')

    const result = menuId
      ? await query<CategoryRow>(
          `select id, restaurant_id, menu_id, name, created_at
           from public.categories
           where restaurant_id = $1 and menu_id = $2
           order by created_at asc`,
          [restaurantId, menuId],
        )
      : await query<CategoryRow>(
          `select id, restaurant_id, menu_id, name, created_at
           from public.categories
           where restaurant_id = $1
           order by created_at asc`,
          [restaurantId],
        )

    return c.json({ categories: result.rows })
  } catch (err) {
    console.error('list categories error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

categoryRoutes.post('/restaurants/:restaurantId/categories', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const restaurantId = c.req.param('restaurantId')
    const restaurant = await getRestaurantOwnedBy(restaurantId, userId)

    const body = await c.req.json<{ name?: string; menu_id?: string }>()
    const name = body.name?.trim()
    const menuId = body.menu_id

    if (!name || !menuId) {
      return c.json({ error: 'name and menu_id are required' }, 400)
    }

    const menuCheck = await query<{ id: string; restaurant_id: string }>(
      'select id, restaurant_id from public.menus where id = $1',
      [menuId],
    )
    const menu = menuCheck.rows[0]
    if (!menu || menu.restaurant_id !== restaurantId) {
      return c.json({ error: 'Invalid menu' }, 400)
    }

    const limits = getPlanLimits(restaurant.plan as Plan)
    const countResult = await query<{ count: string }>(
      'select count(*)::text as count from public.categories where menu_id = $1',
      [menuId],
    )
    const count = Number(countResult.rows[0]?.count ?? 0)
    if (count >= limits.maxCategoriesPerMenu) {
      return c.json({ error: 'plan_limit_exceeded:max_categories_per_menu' }, 403)
    }

    const inserted = await query<CategoryRow>(
      `insert into public.categories (restaurant_id, menu_id, name)
       values ($1, $2, $3)
       returning id, restaurant_id, menu_id, name, created_at`,
      [restaurantId, menuId, name],
    )
    return c.json({ category: inserted.rows[0] }, 201)
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403 | 404)
    }
    console.error('create category error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

categoryRoutes.patch('/categories/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const categoryId = c.req.param('id')
    const body = await c.req.json<{ name?: string }>()
    const name = body.name?.trim()

    if (!name) {
      return c.json({ error: 'name is required' }, 400)
    }

    const existing = await query<{ id: string; owner_id: string }>(
      `select c.id, r.user_id as owner_id
       from public.categories c
       join public.restaurants r on r.id = c.restaurant_id
       where c.id = $1`,
      [categoryId],
    )
    const category = existing.rows[0]
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }
    if (category.owner_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const updated = await query<CategoryRow>(
      `update public.categories
       set name = $2
       where id = $1
       returning id, restaurant_id, menu_id, name, created_at`,
      [categoryId, name],
    )
    return c.json({ category: updated.rows[0] })
  } catch (err) {
    console.error('update category error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

categoryRoutes.delete('/categories/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const categoryId = c.req.param('id')

    const existing = await query<{ id: string; owner_id: string }>(
      `select c.id, r.user_id as owner_id
       from public.categories c
       join public.restaurants r on r.id = c.restaurant_id
       where c.id = $1`,
      [categoryId],
    )
    const category = existing.rows[0]
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }
    if (category.owner_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await query('delete from public.categories where id = $1', [categoryId])
    return c.json({ ok: true })
  } catch (err) {
    console.error('delete category error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
