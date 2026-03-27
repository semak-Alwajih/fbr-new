import { requireAuth } from '../../../lib/auth'
import { readDb, writeDb, createId } from '../../../lib/db'
import { calcTotals } from '../../../lib/fbr'

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  const db = readDb()
  if (req.method === 'GET') return res.status(200).json({ items: db.invoices })

  if (req.method === 'POST') {
    const { customerId, scenarioCode = 'SN001', invoiceDate, lines } = req.body || {}
    if (!customerId) return res.status(400).json({ message: 'Customer is required' })
    if (!invoiceDate) return res.status(400).json({ message: 'Invoice date is required' })
    if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ message: 'At least one line is required' })

    const customer = db.customers.find(x => x.id === customerId)
    if (!customer) return res.status(400).json({ message: 'Customer not found' })

    const { normalized, subTotal, salesTax, furtherTax, grandTotal } = calcTotals(lines, scenarioCode)
    const prefix = db.settings?.invoicePrefix || 'INV'
    const invoiceNumber = `${prefix}-${String(db.invoices.length + 1).padStart(5, '0')}`

    const item = {
      id: createId('inv'),
      invoiceNumber,
      invoiceDate,
      customerId,
      customerName: customer.name,
      scenarioCode,
      status: 'Draft',
      lines: normalized,
      subTotal,
      salesTax,
      furtherTax,
      grandTotal
    }

    db.invoices.push(item)
    writeDb(db)
    return res.status(201).json({ item })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
