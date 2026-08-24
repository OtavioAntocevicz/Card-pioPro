import 'dotenv/config'

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const isProd = process.env.NODE_ENV === 'production'

export const env = {
  DATABASE_URL: required('DATABASE_URL', process.env.DATABASE_URL),
  JWT_SECRET: isProd
    ? required('JWT_SECRET', process.env.JWT_SECRET)
    : (process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me'),
  PORT: Number(process.env.PORT ?? 3001),
  PUBLIC_API_URL: (process.env.PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
}
