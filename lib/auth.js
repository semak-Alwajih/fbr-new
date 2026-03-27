import jwt from 'jsonwebtoken'
import { getToken } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function requireAuth(req) {
  const token = getToken(req)
  if (!token) throw new Error('Missing token')
  return jwt.verify(token, JWT_SECRET)
}
