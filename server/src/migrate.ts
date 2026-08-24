import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import { env } from './env.js'

async function migrate() {
  // Ensure env is loaded (DATABASE_URL required)
  void env.DATABASE_URL

  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve('/workspace/db/schema.sql'),
    path.resolve(here, '../../db/schema.sql'),
    path.resolve(here, '../db/schema.sql'),
  ]

  let schemaPath: string | null = null
  let sql = ''
  for (const candidate of candidates) {
    try {
      sql = await readFile(candidate, 'utf8')
      schemaPath = candidate
      break
    } catch {
      // try next
    }
  }

  if (!schemaPath) {
    throw new Error(`schema.sql not found. Tried: ${candidates.join(', ')}`)
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query(sql)
    console.log(`Migration applied from ${schemaPath}`)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
