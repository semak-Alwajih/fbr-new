import { requireAuth } from '../../../lib/auth'
import { readDb, writeDb, createId } from '../../../lib/db'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  const db = readDb()

  if (req.method === 'GET') return res.status(200).json({ items: db.products })

  if (req.method === 'POST') {
    const { name, sku = '', hsCode = '', uom = '', taxRate = '18', unitPrice, description = '' } = req.body || {}
    if (!name) return res.status(400).json({ message: 'Product name is required' })
    if (unitPrice === undefined || unitPrice === '') return res.status(400).json({ message: 'Unit price is required' })

    const item = {
      id: createId('prd'),
      name,
      sku,
      hsCode,
      uom,
      taxRate: Number(taxRate || 0),
      unitPrice: Number(unitPrice || 0),
      description
    }

    db.products.push(item)
    writeDb(db)
    return res.status(201).json({ item })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
