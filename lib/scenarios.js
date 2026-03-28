export const SCENARIOS = [
  { code: 'SN008', label: 'Sale of 3rd Schedule Goods', taxRate: 18, furtherTax: 0, buyerType: 'unregistered', saleType: 'Third Schedule Goods' },
  { code: 'SN026', label: 'Sale to End Consumer by Retailers', taxRate: 18, furtherTax: 0, buyerType: 'unregistered', saleType: 'Retail Sale' },
  { code: 'SN027', label: 'Sale to End Consumer by Retailers', taxRate: 18, furtherTax: 0, buyerType: 'unregistered', saleType: 'Retail Sale' },
  { code: 'SN028', label: 'Sale to End Consumer by Retailers', taxRate: 18, furtherTax: 0, buyerType: 'unregistered', saleType: 'Retail Sale' }
]

export function getScenario(code) {
  return SCENARIOS.find(item => item.code === code) || SCENARIOS[1]
}

export function suggestScenario() {
  return 'SN026'
}
