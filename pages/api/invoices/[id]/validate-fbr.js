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

  let result = { localValidationPassed: errors.length === 0, errors, payloadPreview: payload }

  if (!errors.length && settings.fbrSandboxBaseUrl && settings.fbrSandboxToken) {
    try {
      const response = await fetch(`${settings.fbrSandboxBaseUrl}/validateinvoicedata_sb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.fbrSandboxToken}`
        },
        body: JSON.stringify(payload)
      })
      const data = await response.json().catch(() => ({}))
      result.fbrValidateResponse = data
      result.fbrValidateStatus = response.status
    } catch (err) {
      result.fbrValidateError = err.message
    }
  }

  db.logs.push({
    id: createId('log'),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    scenarioCode: invoice.scenarioCode,
    status: errors.length ? 'Validation Failed' : 'Validation Logged',
    reference: '',
    message: errors.length ? errors.join(' | ') : 'Validation request generated.',
    createdAt: new Date().toLocaleString(),
    payloadPreview: payload
  })
  writeDb(db)

  return res.status(200).json(result)
}
