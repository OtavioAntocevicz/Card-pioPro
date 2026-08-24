import { Hono } from 'hono'
import { query } from '../db.js'
import { getRestaurantOwnedBy, mapProductRow } from '../helpers.js'
import { HttpError, requireAuth, type AppVariables } from '../middleware.js'
import { getPlanLimits, type Plan } from '../planLimits.js'

type ProductRow = {
  id: string
  restaurant_id: string
  menu_id: string
  category_id: string | null
  name: string
  description: string | null
  price: string | number
  image_url: string | null
  is_available: boolean
  highlight_badge: 'new' | 'bestseller' | 'special' | null
  created_at: string
}

const HIGHLIGHT_BADGES = new Set(['new', 'bestseller', 'special'])

export const productRoutes = new Hono<{ Variables: AppVariables }>()

productRoutes.get('/restaurants/:restaurantId/products', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId')
    const menuId = c.req.query('menuId')

    const result = menuId
      ? await query<ProductRow>(
          `select id, restaurant_id, menu_id, category_id, name, description, price,
                  image_url, is_available, highlight_badge, created_at
           from public.products
           where restaurant_id = $1 and menu_id = $2
           order by created_at asc`,
          [restaurantId, menuId],
        )
      : await query<ProductRow>(
          `select id, restaurant_id, menu_id, category_id, name, description, price,
                  image_url, is_available, highlight_badge, created_at
           from public.products
           where restaurant_id = $1
           order by created_at asc`,
          [restaurantId],
        )

    return c.json({ products: result.rows.map(mapProductRow) })
  } catch (err) {
    console.error('list products error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

productRoutes.post('/restaurants/:restaurantId/products', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const restaurantId = c.req.param('restaurantId')
    const restaurant = await getRestaurantOwnedBy(restaurantId, userId)

    const body = await c.req.json<{
      menu_id?: string
      category_id?: string | null
      name?: string
      description?: string | null
      price?: number
      image_url?: string | null
      is_available?: boolean
      highlight_badge?: string | null
    }>()

    const name = body.name?.trim()
    const menuId = body.menu_id
    const price = body.price

    if (!name || !menuId || price === undefined || Number.isNaN(Number(price))) {
      return c.json({ error: 'name, menu_id and price are required' }, 400)
    }
    if (Number(price) < 0) {
      return c.json({ error: 'price must be >= 0' }, 400)
    }

    const badge = body.highlight_badge ?? null
    if (badge !== null && !HIGHLIGHT_BADGES.has(badge)) {
      return c.json({ error: 'invalid highlight_badge' }, 400)
    }

    const menuCheck = await query<{ id: string; restaurant_id: string }>(
      'select id, restaurant_id from public.menus where id = $1',
      [menuId],
    )
    const menu = menuCheck.rows[0]
    if (!menu || menu.restaurant_id !== restaurantId) {
      return c.json({ error: 'Invalid menu' }, 400)
    }

    const categoryId = body.category_id ?? null
    if (categoryId) {
      const catCheck = await query<{ restaurant_id: string; menu_id: string }>(
        'select restaurant_id, menu_id from public.categories where id = $1',
        [categoryId],
      )
      const cat = catCheck.rows[0]
      if (!cat || cat.restaurant_id !== restaurantId || cat.menu_id !== menuId) {
        return c.json({ error: 'Invalid category' }, 400)
      }
    }

    const limits = getPlanLimits(restaurant.plan as Plan)
    if (categoryId) {
      const countResult = await query<{ count: string }>(
        'select count(*)::text as count from public.products where category_id = $1',
        [categoryId],
      )
      const count = Number(countResult.rows[0]?.count ?? 0)
      if (count >= limits.maxProductsPerCategory) {
        return c.json({ error: 'plan_limit_exceeded:max_products_per_category' }, 403)
      }
    }

    const inserted = await query<ProductRow>(
      `insert into public.products (
         restaurant_id, menu_id, category_id, name, description, price,
         image_url, is_available, highlight_badge
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, restaurant_id, menu_id, category_id, name, description, price,
                 image_url, is_available, highlight_badge, created_at`,
      [
        restaurantId,
        menuId,
        categoryId,
        name,
        body.description ?? null,
        price,
        body.image_url ?? null,
        body.is_available ?? true,
        badge,
      ],
    )

    return c.json({ product: mapProductRow(inserted.rows[0]) }, 201)
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403 | 404)
    }
    console.error('create product error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

productRoutes.patch('/products/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const productId = c.req.param('id')
    const body = await c.req.json<{
      name?: string
      description?: string | null
      price?: number
      image_url?: string | null
      is_available?: boolean
      category_id?: string | null
      highlight_badge?: string | null
    }>()

    const existing = await query<ProductRow & { owner_id: string }>(
      `select p.*, r.user_id as owner_id
       from public.products p
       join public.restaurants r on r.id = p.restaurant_id
       where p.id = $1`,
      [productId],
    )
    const product = existing.rows[0]
    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }
    if (product.owner_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (body.highlight_badge !== undefined && body.highlight_badge !== null) {
      if (!HIGHLIGHT_BADGES.has(body.highlight_badge)) {
        return c.json({ error: 'invalid highlight_badge' }, 400)
      }
    }

    if (body.category_id) {
      const catCheck = await query<{ restaurant_id: string; menu_id: string }>(
        'select restaurant_id, menu_id from public.categories where id = $1',
        [body.category_id],
      )
      const cat = catCheck.rows[0]
      if (
        !cat ||
        cat.restaurant_id !== product.restaurant_id ||
        cat.menu_id !== product.menu_id
      ) {
        return c.json({ error: 'Invalid category' }, 400)
      }
    }

    if (body.price !== undefined && (Number.isNaN(Number(body.price)) || Number(body.price) < 0)) {
      return c.json({ error: 'Invalid price' }, 400)
    }

    const updated = await query<ProductRow>(
      `update public.products
       set name = coalesce($2, name),
           description = case when $3::boolean then $4 else description end,
           price = coalesce($5, price),
           image_url = case when $6::boolean then $7 else image_url end,
           is_available = coalesce($8, is_available),
           category_id = case when $9::boolean then $10 else category_id end,
           highlight_badge = case when $11::boolean then $12 else highlight_badge end
       where id = $1
       returning id, restaurant_id, menu_id, category_id, name, description, price,
                 image_url, is_available, highlight_badge, created_at`,
      [
        productId,
        body.name?.trim() ?? null,
        body.description !== undefined,
        body.description ?? null,
        body.price ?? null,
        body.image_url !== undefined,
        body.image_url ?? null,
        body.is_available ?? null,
        body.category_id !== undefined,
        body.category_id ?? null,
        body.highlight_badge !== undefined,
        body.highlight_badge ?? null,
      ],
    )

    return c.json({ product: mapProductRow(updated.rows[0]) })
  } catch (err) {
    console.error('update product error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

productRoutes.delete('/products/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const productId = c.req.param('id')

    const existing = await query<{ id: string; owner_id: string }>(
      `select p.id, r.user_id as owner_id
       from public.products p
       join public.restaurants r on r.id = p.restaurant_id
       where p.id = $1`,
      [productId],
    )
    const product = existing.rows[0]
    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }
    if (product.owner_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await query('delete from public.products where id = $1', [productId])
    return c.json({ ok: true })
  } catch (err) {
    console.error('delete product error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
