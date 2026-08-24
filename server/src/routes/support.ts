import { Hono } from 'hono'
import { query } from '../db.js'
import { getRestaurantOwnedBy } from '../helpers.js'
import {
  HttpError,
  requireAdmin,
  requireAuth,
  type AppVariables,
} from '../middleware.js'

type SupportRow = {
  id: string
  restaurant_id: string
  user_id: string
  request_type: 'plan' | 'support'
  contact_whatsapp: string
  message: string
  status: 'new' | 'in_progress' | 'done'
  created_at: string
  handled_at: string | null
  handled_by_admin_id: string | null
  restaurant_name?: string
}

const REQUEST_TYPES = new Set(['plan', 'support'])
const STATUSES = new Set(['new', 'in_progress', 'done'])

export const supportRoutes = new Hono<{ Variables: AppVariables }>()

supportRoutes.post('/', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json<{
      restaurantId?: string
      requestType?: string
      contactWhatsapp?: string
      message?: string
    }>()

    const restaurantId = body.restaurantId
    const requestType = body.requestType
    const contactWhatsapp = body.contactWhatsapp?.trim()
    const message = body.message?.trim()

    if (!restaurantId || !requestType || !contactWhatsapp || !message) {
      return c.json(
        { error: 'restaurantId, requestType, contactWhatsapp and message are required' },
        400,
      )
    }
    if (!REQUEST_TYPES.has(requestType)) {
      return c.json({ error: 'Invalid requestType' }, 400)
    }

    await getRestaurantOwnedBy(restaurantId, userId)

    const inserted = await query<SupportRow>(
      `insert into public.support_notifications (
         restaurant_id, user_id, request_type, contact_whatsapp, message
       ) values ($1, $2, $3, $4, $5)
       returning id, restaurant_id, user_id, request_type, contact_whatsapp, message,
                 status, created_at, handled_at, handled_by_admin_id`,
      [restaurantId, userId, requestType, contactWhatsapp, message],
    )

    return c.json({ notification: inserted.rows[0] }, 201)
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403 | 404)
    }
    console.error('create support notification error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

supportRoutes.get('/me', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const result = await query<SupportRow>(
      `select id, restaurant_id, user_id, request_type, contact_whatsapp, message,
              status, created_at, handled_at, handled_by_admin_id
       from public.support_notifications
       where user_id = $1
       order by created_at desc`,
      [userId],
    )
    return c.json({ notifications: result.rows })
  } catch (err) {
    console.error('list my support notifications error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

supportRoutes.get('/', requireAuth, async (c) => {
  try {
    await requireAdmin(c.get('userId'))
    const result = await query<SupportRow>(
      `select sn.id, sn.restaurant_id, sn.user_id, sn.request_type, sn.contact_whatsapp,
              sn.message, sn.status, sn.created_at, sn.handled_at, sn.handled_by_admin_id,
              r.name as restaurant_name
       from public.support_notifications sn
       join public.restaurants r on r.id = sn.restaurant_id
       order by sn.created_at desc`,
    )
    return c.json({ notifications: result.rows })
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403)
    }
    console.error('list all support notifications error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

supportRoutes.patch('/:id/status', requireAuth, async (c) => {
  try {
    const adminUserId = c.get('userId')
    await requireAdmin(adminUserId)

    const id = c.req.param('id')
    const body = await c.req.json<{ status?: string }>()
    if (!body.status || !STATUSES.has(body.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const existing = await query<{ id: string }>(
      'select id from public.support_notifications where id = $1',
      [id],
    )
    if (!existing.rows[0]) {
      return c.json({ error: 'Notification not found' }, 404)
    }

    const handledAt = body.status === 'done' ? new Date().toISOString() : null
    const updated = await query<SupportRow>(
      `update public.support_notifications
       set status = $2,
           handled_at = $3,
           handled_by_admin_id = case when $2 = 'done' then $4 else handled_by_admin_id end
       where id = $1
       returning id, restaurant_id, user_id, request_type, contact_whatsapp, message,
                 status, created_at, handled_at, handled_by_admin_id`,
      [id, body.status, handledAt, adminUserId],
    )

    return c.json({ notification: updated.rows[0] })
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 403)
    }
    console.error('update support status error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
