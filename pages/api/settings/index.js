import { requireAuth } from '../../../lib/auth'
import { readDb, writeDb } from '../../../lib/db'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  const db = readDb()
  if (req.method === 'GET') return res.status(200).json({ item: db.settings || {} })
  if (req.method === 'PUT') {
    db.settings = { ...(db.settings || {}), ...(req.body || {}) }
    writeDb(db)
    return res.status(200).json({ item: db.settings })
  }
  return res.status(405).json({ message: 'Method not allowed' })
}
