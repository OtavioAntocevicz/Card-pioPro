import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import { env } from '../env.js'
import { requireAuth, type AppVariables } from '../middleware.js'

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export const uploadRoutes = new Hono<{ Variables: AppVariables }>()

uploadRoutes.post('/', requireAuth, async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file']
    const restaurantIdRaw = body['restaurantId']
    const restaurantId =
      typeof restaurantIdRaw === 'string' && restaurantIdRaw.trim()
        ? restaurantIdRaw.trim()
        : 'general'

    if (!file || typeof file === 'string') {
      return c.json({ error: 'file is required' }, 400)
    }

    const originalName = file.name || 'upload.bin'
    const ext = (originalName.split('.').pop() || '').toLowerCase()
    const safeExt = ALLOWED_EXT.has(ext) ? ext : 'bin'
    const filename = `${randomUUID()}.${safeExt}`
    const relativeDir = restaurantId
    const absoluteDir = path.resolve(env.UPLOAD_DIR, relativeDir)
    await mkdir(absoluteDir, { recursive: true })

    const absolutePath = path.join(absoluteDir, filename)
    const arrayBuffer = await file.arrayBuffer()
    await writeFile(absolutePath, Buffer.from(arrayBuffer))

    const url = `${env.PUBLIC_API_URL}/uploads/${relativeDir}/${filename}`
    return c.json({ url }, 201)
  } catch (err) {
    console.error('upload error', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
