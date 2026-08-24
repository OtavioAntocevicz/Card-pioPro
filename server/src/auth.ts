import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { env } from './env.js'

export type AuthUser = {
  id: string
  email: string
}

const encoder = new TextEncoder()

function secretKey(): Uint8Array {
  return encoder.encode(env.JWT_SECRET)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey())
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
  const id = payload.sub
  const email = typeof payload.email === 'string' ? payload.email : null
  if (!id || !email) {
    throw new Error('Invalid token payload')
  }
  return { id, email }
}
