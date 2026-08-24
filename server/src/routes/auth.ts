import { Hono } from 'hono'
import { hashPassword, signToken, verifyPassword } from '../auth.js'
import { query } from '../db.js'
import {
  HttpError,
  isPlatformAdmin,
  requireAuth,
  type AppVariables,
} from '../middleware.js'

type UserRow = {
  id: string
  email: string
  password_hash: string
}

export const authRoutes = new Hono<{ Variables: AppVariables }>()

authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json<{ email?: string; password?: string }>()
    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return c.json({ error: 'email and password are required' }, 400)
    }
    if (password.length < 6) {
      return c.json({ error: 'password must be at least 6 characters' }, 400)
    }

    const existing = await query<{ id: string }>(
      'select id from public.users where lower(email) = lower($1) limit 1',
      [email],
    )
    if ((existing.rowCount ?? 0) > 0) {
      return c.json({ error: 'Email already registered' }, 409)
    }

    const passwordHash = await hashPassword(password)
    const inserted = await query<UserRow>(
      `insert into public.users (email, password_hash)
       values ($1, $2)
       returning id, email, password_hash`,
      [email, passwordHash],
    )
    const user = inserted.rows[0]
    const token = await signToken({ id: user.id, email: user.email })

    return c.json({ token, user: { id: user.id, email: user.email } }, 201)
  } catch (err) {
    console.error('register error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json<{ email?: string; password?: string }>()
    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return c.json({ error: 'email and password are required' }, 400)
    }

    const result = await query<UserRow>(
      'select id, email, password_hash from public.users where lower(email) = lower($1) limit 1',
      [email],
    )
    const user = result.rows[0]
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = await signToken({ id: user.id, email: user.email })
    return c.json({ token, user: { id: user.id, email: user.email } })
  } catch (err) {
    console.error('login error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

authRoutes.get('/me', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const email = c.get('email')
    const admin = await isPlatformAdmin(userId)
    return c.json({
      user: { id: userId, email },
      isPlatformAdmin: admin,
    })
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 401 | 403 | 404 | 400 | 409 | 500)
    }
    console.error('me error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
