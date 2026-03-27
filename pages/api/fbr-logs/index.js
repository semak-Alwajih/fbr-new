import { requireAuth } from '../../../lib/auth'
import { readDb } from '../../../lib/db'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  return res.status(200).json({ items: readDb().logs })
}
