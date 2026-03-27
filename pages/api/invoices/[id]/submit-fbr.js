import { requireAuth } from '../../../../lib/auth'
import { readDb, writeDb, createId } from '../../../../lib/db'
import { buildFbrPayload, validateBeforeFbr } from '../../../../lib/fbr'

export default async function handler(req, res) {
  try { requireAuth(req) } catch (e) { return res.status(401).json({ message: e.message }) }
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const db = readDb()
  const invoice = db.invoices.find(x => x.id === req.query.id)
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

  const customer = db.customers.find(x => x.id === invoice.customerId)
  const settings = db.settings || {}
  const payload = buildFbrPayload({ invoice, customer, settings })
  const errors = validateBeforeFbr({ invoice, customer, settings })

  if (errors.length) {
    db.logs.push({
      id: createId('log'),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      scenarioCode: invoice.scenarioCode,
      status: 'Failed',
      reference: '',
      message: errors.join(' | '),
      createdAt: new Date().toLocaleString(),
      payloadPreview: payload
    })
    writeDb(db)
    return res.status(400).json({ success: false, message: 'Local validation failed', errors, payloadPreview: payload })
  }

  if (!settings.fbrSandboxBaseUrl || !settings.fbrSandboxToken) {
    return res.status(400).json({ success: false, message: 'Sandbox URL/token missing in settings', payloadPreview: payload })
  }

  try {
    const response = await fetch(`${settings.fbrSandboxBaseUrl}/postinvoicedata_sb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.fbrSandboxToken}`
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      invoice.status = 'Failed'
      db.logs.push({
        id: createId('log'),
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        scenarioCode: invoice.scenarioCode,
        status: 'Failed',
        reference: '',
        message: data.message || 'FBR rejected the payload',
        createdAt: new Date().toLocaleString(),
        payloadPreview: payload,
        fbrResponse: data
      })
      writeDb(db)
      return res.status(response.status).json({ success: false, payloadPreview: payload, fbrResponse: data })
    }

    invoice.status = 'Posted'
    db.logs.push({
      id: createId('log'),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      scenarioCode: invoice.scenarioCode,
      status: 'Success',
      reference: data.invoiceNumber || data.reference || '',
      message: 'Invoice posted to FBR sandbox.',
      createdAt: new Date().toLocaleString(),
      payloadPreview: payload,
      fbrResponse: data
    })
    writeDb(db)

    return res.status(200).json({ success: true, payloadPreview: payload, fbrResponse: data })
  } catch (err) {
    invoice.status = 'Failed'
    db.logs.push({
      id: createId('log'),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      scenarioCode: invoice.scenarioCode,
      status: 'Failed',
      reference: '',
      message: err.message,
      createdAt: new Date().toLocaleString(),
      payloadPreview: payload
    })
    writeDb(db)
    return res.status(500).json({ success: false, message: err.message, payloadPreview: payload })
  }
}
