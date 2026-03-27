export const SCENARIOS = [
  { code: 'SN001', label: 'Goods at Standard Rate to Registered Buyers', taxRate: 18, furtherTax: 0, buyerType: 'registered' },
  { code: 'SN002', label: 'Goods at Standard Rate to Unregistered Buyers', taxRate: 18, furtherTax: 4, buyerType: 'unregistered' }
]

export function getScenario(code) {
  return SCENARIOS.find(item => item.code === code) || SCENARIOS[0]
}

export function suggestScenario(customer) {
  return customer?.ntnCnic ? 'SN001' : 'SN002'
}
