import { requireAuth } from '../../../lib/auth'
import { readDb, writeDb, createId } from '../../../lib/db'

function calc(lines) {
  const normalized = lines.map(line => ({
    productId: line.productId || '',
    description: line.description || '',
    quantity: Number(line.quantity || 0),
    unitPrice: Number(line.unitPrice || 0),
    taxRate: Number(line.taxRate || 0),
    hsCode: line.hsCode || '',
    uom: line.uom || ''
  }))

  const subTotal = normalized.reduce((s, x) => s + x.quantity * x.unitPrice, 0)
  const taxTotal = normalized.reduce((s, x) => s + (x.quantity * x.unitPrice * x.taxRate / 100), 0)

  return { normalized, subTotal, taxTotal, grandTotal: subTotal + taxTotal }
}

export default function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  const db = readDb()

  if (req.method === 'GET') return res.status(200).json({ items: db.invoices })

  if (req.method === 'POST') {
    const { customerId, invoiceDate, lines } = req.body || {}
    if (!customerId) return res.status(400).json({ message: 'Customer is required' })
    if (!invoiceDate) return res.status(400).json({ message: 'Invoice date is required' })
    if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ message: 'At least one line is required' })

    const customer = db.customers.find(x => x.id === customerId)
    if (!customer) return res.status(400).json({ message: 'Customer not found' })

    const { normalized, subTotal, taxTotal, grandTotal } = calc(lines)
    const prefix = db.settings?.invoicePrefix || 'INV'
    const invoiceNumber = `${prefix}-${String(db.invoices.length + 1).padStart(5, '0')}`

    const item = {
      id: createId('inv'),
      invoiceNumber,
      invoiceDate,
      customerId,
      customerName: customer.name,
      status: 'Draft',
      lines: normalized,
      subTotal,
      taxTotal,
      grandTotal
    }

    db.invoices.push(item)
    writeDb(db)
    return res.status(201).json({ item })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
