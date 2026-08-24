import type { MiddlewareHandler } from 'hono'
import { verifyToken } from './auth.js'
import { query } from './db.js'

export type AppVariables = {
  userId: string
  email: string
}

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const requireAuth: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const user = await verifyToken(token)
    c.set('userId', user.id)
    c.set('email', user.email)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export async function requireAdmin(userId: string): Promise<void> {
  const result = await query<{ user_id: string }>(
    'select user_id from public.platform_admins where user_id = $1 limit 1',
    [userId],
  )
  if (result.rowCount === 0) {
    throw new HttpError(403, 'Forbidden')
  }
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const result = await query<{ user_id: string }>(
    'select user_id from public.platform_admins where user_id = $1 limit 1',
    [userId],
  )
  return (result.rowCount ?? 0) > 0
}
