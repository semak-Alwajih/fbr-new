import { getScenario } from './scenarios'

export function buildFbrPayload({ invoice, customer, settings }) {
  const scenario = getScenario(invoice.scenarioCode)

  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: invoice.invoiceDate,

    sellerNTNCNIC: String(settings.sellerNTN || '').trim(),
    sellerBusinessName: settings.sellerBusinessName || '',
    sellerProvince: settings.sellerProvince || '',
    sellerAddress: settings.sellerAddress || '',

    buyerNTNCNIC: customer?.ntnCnic || '',
    buyerBusinessName: customer?.name || '',
    buyerProvince: customer?.province || settings.sellerProvince || '',
    buyerAddress: customer?.address || '',
    buyerRegistrationType: scenario.buyerType === 'registered' ? 'Registered' : 'Unregistered',

    invoiceRefNo: '',
    scenarioId: invoice.scenarioCode,

    items: invoice.lines.map((line) => {
      const valueSalesExcludingST = Number(line.quantity) * Number(line.unitPrice)
      const salesTaxApplicable = valueSalesExcludingST * (Number(line.taxRate) / 100)
      const furtherTax = 0

      return {
        hsCode: line.hsCode,
        productDescription: line.description,
        rate: `${line.taxRate}%`,
        uoM: line.uom,
        quantity: Number(line.quantity),

        totalValues: valueSalesExcludingST + salesTaxApplicable + furtherTax,
        valueSalesExcludingST,

        fixedNotifiedValueOrRetailPrice: 0,
        salesTaxApplicable,
        salesTaxWithheldAtSource: 0,
        extraTax: '',
        furtherTax,

        sroScheduleNo: '',
        fedPayable: 0,
        discount: 0,

        // 🔥 CRITICAL FIX
        saleType: scenario.saleType,

        sroItemSerialNo: ''
      }
    })
  }
}
