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
    uom: line.uom || ''
  }))
  const subTotal = normalized.reduce((s, x) => s + x.quantity * x.unitPrice, 0)
  const salesTax = normalized.reduce((s, x) => s + (x.quantity * x.unitPrice * x.taxRate / 100), 0)
  const furtherTax = subTotal * Number(scenario.furtherTax || 0) / 100
  return { normalized, subTotal, salesTax, furtherTax, grandTotal: subTotal + salesTax + furtherTax }
}

export function buildFbrPayload({ invoice, customer, settings }) {
  const scenario = getScenario(invoice.scenarioCode)
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    scenarioId: invoice.scenarioCode,
    sellerNTN: settings.sellerNTN || '',
    sellerBusinessName: settings.sellerBusinessName || settings.companyName || '',
    sellerProvince: settings.sellerProvince || '',
    sellerAddress: settings.sellerAddress || '',
    buyerName: customer?.name || invoice.customerName || '',
    buyerRegistrationNo: customer?.ntnCnic || '',
    buyerType: scenario.buyerType,
    invoiceType: 'Sale Invoice',
    items: invoice.lines.map((line, index) => {
      const valueSalesExcludingST = Number(line.quantity || 0) * Number(line.unitPrice || 0)
      const salesTaxApplicable = valueSalesExcludingST * Number(line.taxRate || 0) / 100
      const furtherTax = valueSalesExcludingST * Number(scenario.furtherTax || 0) / 100
      return {
        itemSerialNo: index + 1,
        hsCode: line.hsCode || '',
        productDescription: line.description || '',
        rate: Number(line.taxRate || 0),
        uom: line.uom || '',
        quantity: Number(line.quantity || 0),
        totalValues: valueSalesExcludingST + salesTaxApplicable + furtherTax,
        valueSalesExcludingST,
        salesTaxApplicable,
        furtherTax
      }
    }),
    totalValue: Number(invoice.subTotal || 0),
    totalSalesTax: Number(invoice.salesTax || 0),
    totalFurtherTax: Number(invoice.furtherTax || 0),
    invoiceTotal: Number(invoice.grandTotal || 0)
  }
}

export function validateBeforeFbr({ invoice, customer, settings }) {
  const errors = []
  if (!settings.sellerNTN) errors.push('Seller NTN is required')
  if (!settings.sellerBusinessName && !settings.companyName) errors.push('Seller business name is required')
  if (!invoice.scenarioCode) errors.push('Scenario code is required')
  if (!customer?.name) errors.push('Buyer name is required')

  if (invoice.scenarioCode === 'SN001' && !customer?.ntnCnic) {
    errors.push('SN001 requires buyer NTN/CNIC/registration')
  }

  for (const [index, line] of invoice.lines.entries()) {
    if (!line.description) errors.push(`Line ${index + 1}: description is required`)
    if (!line.hsCode) errors.push(`Line ${index + 1}: HS code is required`)
    if (!line.uom) errors.push(`Line ${index + 1}: UOM is required`)
    if (!Number(line.quantity)) errors.push(`Line ${index + 1}: quantity is required`)
    if (Number(line.unitPrice) < 0) errors.push(`Line ${index + 1}: unit price must be valid`)
  }

  return errors
}
