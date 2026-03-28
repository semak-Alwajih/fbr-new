import { requireAuth } from '../../../lib/auth'
import { readDb, writeDb, createId } from '../../../lib/db'
import { calcTotals } from '../../../lib/fbr'

export default function handler(req, res) {
  try {
    requireAuth(req)
  } catch (e) {
    return res.status(401).json({ message: e.message })
  }

  try {
    const db = readDb()

    if (req.method === 'GET') {
      return res.status(200).json({ items: db.invoices || [] })
    }

    if (req.method === 'POST') {
      const {
        customerId,
        scenarioCode = 'SN026',
        invoiceDate,
        lines
      } = req.body || {}

      if (!customerId) {
        return res.status(400).json({ message: 'Customer is required' })
      }

      if (!invoiceDate) {
        return res.status(400).json({ message: 'Invoice date is required' })
      }

      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ message: 'At least one line is required' })
      }

      const customer = (db.customers || []).find((x) => x.id === customerId)

      if (!customer) {
        return res.status(400).json({ message: 'Customer not found' })
      }

      const cleanedLines = lines.map((line, index) => ({
        productId: line.productId || '',
        description: String(line.description || '').trim(),
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        taxRate: Number(line.taxRate || 0),
        hsCode: String(line.hsCode || '').trim(),
        uom: String(line.uom || '').trim(),
        saleType: line.saleType || '',
        sroScheduleNo: line.sroScheduleNo || '',
        sroItemSerialNo: line.sroItemSerialNo || ''
      }))

      for (let i = 0; i < cleanedLines.length; i += 1) {
        const line = cleanedLines[i]

        if (!line.description) {
          return res.status(400).json({ message: `Line ${i + 1}: description is required` })
        }

        if (!line.hsCode) {
          return res.status(400).json({ message: `Line ${i + 1}: HS code is required` })
        }

        if (!line.uom) {
          return res.status(400).json({ message: `Line ${i + 1}: UOM is required` })
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          return res.status(400).json({ message: `Line ${i + 1}: quantity must be greater than zero` })
        }

        if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
          return res.status(400).json({ message: `Line ${i + 1}: unit price must be greater than zero` })
        }

        if (!Number.isFinite(line.taxRate) || line.taxRate < 0) {
          return res.status(400).json({ message: `Line ${i + 1}: tax rate is invalid` })
        }
      }

      const { normalized, subTotal, salesTax, furtherTax, grandTotal } = calcTotals(
        cleanedLines,
        scenarioCode
      )

      const prefix = db.settings?.invoicePrefix || 'INV'
      const invoiceNumber = `${prefix}-${String((db.invoices || []).length + 1).padStart(5, '0')}`

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
        grandTotal,
        createdAt: new Date().toISOString()
      }

      if (!db.invoices) db.invoices = []
      db.invoices.push(item)
      writeDb(db)

      return res.status(201).json({ item })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (error) {
    console.error('Invoice API error:', error)
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    })
  }
}
