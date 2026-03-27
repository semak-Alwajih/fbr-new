import { requireAuth } from '../../../../lib/auth'
import { readDb, writeDb } from '../../../../lib/db'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  const db = readDb()
  const invoice = db.invoices.find(x => x.id === req.query.id)
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

  if (req.method === 'GET') return res.status(200).json({ item: invoice })

  if (req.method === 'DELETE') {
    db.invoices = db.invoices.filter(x => x.id !== req.query.id)
    db.logs = db.logs.filter(x => x.invoiceId !== req.query.id)
    writeDb(db)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
