import { requireAuth } from '../../../../lib/auth'
import { readDb, writeDb, createId } from '../../../../lib/db'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  const db = readDb()
  const invoice = db.invoices.find(x => x.id === req.query.id)
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' })
  invoice.status = 'Posted'
  const reference = `FBR-${Date.now()}`
  db.logs.push({
    id: createId('log'),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: 'Success',
    reference,
    message: 'Invoice submitted to mock FBR service successfully.',
    createdAt: new Date().toLocaleString()
  })
  writeDb(db)
  return res.status(200).json({ success: true, reference })
}
