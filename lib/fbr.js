import { getScenario } from './scenarios'

export function calcTotals(lines, scenarioCode) {
  const scenario = getScenario(scenarioCode)
  const normalized = lines.map(line => ({
    productId: line.productId || '',
    description: line.description || '',
    quantity: Number(line.quantity || 0),
    unitPrice: Number(line.unitPrice || 0),
    taxRate: Number(line.taxRate || 0),
    hsCode: line.hsCode || '',
    uom: line.uom || '',
    buyerProvince: line.buyerProvince || '',
    saleType: line.saleType || 'Goods at standard rate',
    sroScheduleNo: line.sroScheduleNo || '',
    sroItemSerialNo: line.sroItemSerialNo || ''
  }))
  const subTotal = normalized.reduce((s, x) => s + x.quantity * x.unitPrice, 0)
  const salesTax = normalized.reduce((s, x) => s + (x.quantity * x.unitPrice * x.taxRate / 100), 0)
  const furtherTax = subTotal * Number(scenario.furtherTax || 0) / 100
  return { normalized, subTotal, salesTax, furtherTax, grandTotal: subTotal + salesTax + furtherTax }
}

export function buildFbrPayload({ invoice, customer, settings }) {
  const scenario = getScenario(invoice.scenarioCode)
  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: invoice.invoiceDate,
    sellerNTNCNIC: String(settings.sellerNTN || '').trim(),
    sellerBusinessName: settings.sellerBusinessName || settings.companyName || '',
    sellerProvince: settings.sellerProvince || '',
    sellerAddress: settings.sellerAddress || '',
    buyerNTNCNIC: customer?.ntnCnic || '',
    buyerBusinessName: customer?.name || invoice.customerName || '',
    buyerProvince: customer?.province || settings.sellerProvince || '',
    buyerAddress: customer?.address || '',
    buyerRegistrationType: scenario.buyerType === 'registered' ? 'Registered' : 'Unregistered',
    invoiceRefNo: invoice.invoiceRefNo || '',
    scenarioId: invoice.scenarioCode,
    items: invoice.lines.map((line) => {
      const valueSalesExcludingST = Number(line.quantity || 0) * Number(line.unitPrice || 0)
      const salesTaxApplicable = valueSalesExcludingST * Number(line.taxRate || 0) / 100
      const furtherTax = valueSalesExcludingST * Number(scenario.furtherTax || 0) / 100
      return {
        hsCode: line.hsCode || '',
        productDescription: line.description || '',
        rate: `${Number(line.taxRate || 0)}%`,
        uoM: line.uom || '',
        quantity: Number(line.quantity || 0),
        totalValues: valueSalesExcludingST + salesTaxApplicable + furtherTax,
        valueSalesExcludingST,
        fixedNotifiedValueOrRetailPrice: 0,
        salesTaxApplicable,
        salesTaxWithheldAtSource: 0,
        extraTax: '',
        furtherTax,
        sroScheduleNo: line.sroScheduleNo || '',
        fedPayable: 0,
        discount: 0,
        saleType: line.saleType || 'Goods at standard rate',
        sroItemSerialNo: line.sroItemSerialNo || ''
      }
    })
  }
}

export function validateBeforeFbr({ invoice, customer, settings }) {
  const errors = []
  if (!String(settings.sellerNTN || '').trim()) errors.push('Seller NTN/CNIC is required')
  if (!settings.sellerBusinessName && !settings.companyName) errors.push('Seller business name is required')
  if (!settings.sellerProvince) errors.push('Seller province is required')
  if (!settings.sellerAddress) errors.push('Seller address is required')
  if (!invoice.scenarioCode) errors.push('Scenario code is required')
  if (!customer?.name) errors.push('Buyer business name is required')

  const seller = String(settings.sellerNTN || '').trim()
    if (invoice.scenarioCode === 'SN001' && !customer?.ntnCnic) {
    errors.push('SN001 requires buyer NTN/CNIC')
  }

  for (const [index, line] of invoice.lines.entries()) {
    if (!line.description) errors.push(`Line ${index + 1}: product description is required`)
    if (!line.hsCode) errors.push(`Line ${index + 1}: HS code is required`)
    if (!line.uom) errors.push(`Line ${index + 1}: UOM is required`)
    if (!Number(line.quantity)) errors.push(`Line ${index + 1}: quantity is required`)
    if (Number(line.unitPrice) <= 0) errors.push(`Line ${index + 1}: unit price must be greater than zero`)
  }

  if (!(seller.length === 7 || seller.length === 13)) {
    errors.push('Seller NTN/CNIC must be 7-digit NTN or 13-digit CNIC')
  }

  return errors
}
