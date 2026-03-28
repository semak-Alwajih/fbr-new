export const SCENARIOS = [
  {
    code: 'SN026',
    label: 'Sale to End Consumer by Retailers',
    taxRate: 18,
    furtherTax: 0,
    buyerType: 'unregistered',
    saleType: 'Goods at Standard Rate (default)'
  },
  {
    code: 'SN027',
    label: 'Sale to End Consumer by Retailers',
    taxRate: 18,
    furtherTax: 0,
    buyerType: 'unregistered',
    saleType: '3rd Schedule Goods'
  },
  {
    code: 'SN028',
    label: 'Sale to End Consumer by Retailers',
    taxRate: 18,
    furtherTax: 0,
    buyerType: 'unregistered',
    saleType: 'Goods at Reduced Rate'
  },
  {
    code: 'SN008',
    label: 'Sale of 3rd Schedule Goods',
    taxRate: 18,
    furtherTax: 0,
    buyerType: 'unregistered',
    saleType: '3rd Schedule Goods'
  }
]

export function getScenario(code) {
  return SCENARIOS.find(s => s.code === code) || SCENARIOS[0]
}

export function suggestScenario() {
  return 'SN026'
}
