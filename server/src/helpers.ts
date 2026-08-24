import { query } from './db.js'
import { HttpError } from './middleware.js'
import type { Plan } from './planLimits.js'

export type RestaurantRow = {
  id: string
  user_id: string
  name: string
  slug: string
  plan: Plan
  theme: unknown
  subscription_status: string
  current_period_end: string | null
  updated_by_admin_id: string | null
  updated_at: string
  created_at: string
}

export async function getRestaurantOwnedBy(
  restaurantId: string,
  userId: string,
): Promise<RestaurantRow> {
  const result = await query<RestaurantRow>(
    `select id, user_id, name, slug, plan, theme, subscription_status,
            current_period_end, updated_by_admin_id, updated_at, created_at
     from public.restaurants
     where id = $1`,
    [restaurantId],
  )
  const restaurant = result.rows[0]
  if (!restaurant) {
    throw new HttpError(404, 'Restaurant not found')
  }
  if (restaurant.user_id !== userId) {
    throw new HttpError(403, 'Forbidden')
  }
  return restaurant
}

export function mapProductRow<T extends { price: string | number }>(row: T): T & { price: number } {
  return {
    ...row,
    price: typeof row.price === 'number' ? row.price : Number.parseFloat(row.price),
  }
}
