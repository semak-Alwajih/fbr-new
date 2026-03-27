import { requireAuth } from '../../../lib/auth'
import { readDb, writeDb, createId } from '../../../lib/db'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  const db = readDb()

  if (req.method === 'GET') return res.status(200).json({ items: db.customers })

  if (req.method === 'POST') {
    const { name, ntnCnic = '', phone = '', email = '', address = '' } = req.body || {}
    if (!name) return res.status(400).json({ message: 'Customer name is required' })

    const item = { id: createId('cus'), name, ntnCnic, phone, email, address }
    db.customers.push(item)
    writeDb(db)
    return res.status(201).json({ item })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
