import { useEffect, useMemo, useState } from 'react'

const SCENARIOS = [
  { code: 'SN001', label: 'SN001 - Registered Buyer', taxRate: 18, furtherTax: 0 },
  { code: 'SN002', label: 'SN002 - Unregistered Buyer', taxRate: 18, furtherTax: 4 }
]

const api = {
  async request(path, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(path, { ...options, headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Request failed')
    return data
  }
}

const emptyCustomer = { name: '', ntnCnic: '', phone: '', email: '', address: '' }
const emptyProduct = { name: '', sku: '', hsCode: '', uom: '', taxRate: '18', unitPrice: '', description: '' }
const emptyLine = { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, hsCode: '', uom: '' }

function getScenario(code) {
  return SCENARIOS.find(item => item.code === code) || SCENARIOS[0]
}

function calc(lines, scenarioCode) {
  const scenario = getScenario(scenarioCode)
  const subTotal = lines.reduce((s, line) => s + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
  const salesTax = lines.reduce((s, line) => s + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.taxRate || 0) / 100), 0)
  const furtherTax = subTotal * Number(scenario.furtherTax || 0) / 100
  return { subTotal, salesTax, furtherTax, grandTotal: subTotal + salesTax + furtherTax }
}

export default function Home() {
  const [token, setToken] = useState('')
  const [active, setActive] = useState('invoice')
  const [data, setData] = useState({ customers: [], products: [], invoices: [], logs: [], settings: {} })
  const [login, setLogin] = useState({ email: 'admin@example.com', password: 'admin123', error: '' })
  const [customer, setCustomer] = useState(emptyCustomer)
  const [product, setProduct] = useState(emptyProduct)
  const [invoice, setInvoice] = useState({
    customerId: '',
    scenarioCode: 'SN001',
    invoiceDate: new Date().toISOString().slice(0, 10),
    lines: [{ ...emptyLine }]
  })
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [saveProductPrompt, setSaveProductPrompt] = useState({ open: false, lineIndex: null })
  const [msg, setMsg] = useState('')
  const [pageError, setPageError] = useState('')
  const [fbrResult, setFbrResult] = useState(null)

  const loadAll = async () => {
    const [customers, products, invoices, logs, settings] = await Promise.all([
      api.request('/api/customers'),
      api.request('/api/products'),
      api.request('/api/invoices'),
      api.request('/api/fbr-logs'),
      api.request('/api/settings')
    ])
    setData({
      customers: customers.items || [],
      products: products.items || [],
      invoices: invoices.items || [],
      logs: logs.items || [],
      settings: settings.item || {}
    })
  }

  useEffect(() => {
    const saved = localStorage.getItem('token')
    if (saved) setToken(saved)
  }, [])

  useEffect(() => {
    if (token) {
      loadAll().catch(() => {
        localStorage.removeItem('token')
        setToken('')
      })
    }
  }, [token])

  const metrics = useMemo(() => ({
    total: data.invoices.length,
    posted: data.invoices.filter(x => x.status === 'Posted').length,
    failed: data.invoices.filter(x => x.status === 'Failed').length,
    revenue: data.invoices.reduce((s, x) => s + Number(x.grandTotal || 0), 0)
  }), [data.invoices])

  const totals = useMemo(() => calc(invoice.lines, invoice.scenarioCode), [invoice.lines, invoice.scenarioCode])

  const doLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await api.request('/api/auth/login', { method: 'POST', body: JSON.stringify(login) })
      localStorage.setItem('token', res.token)
      setToken(res.token)
      setLogin({ ...login, error: '' })
    } catch (err) {
      setLogin({ ...login, error: err.message })
    }
  }

  const saveCustomer = async (e) => {
    e.preventDefault()
    await api.request('/api/customers', { method: 'POST', body: JSON.stringify(customer) })
    setCustomer(emptyCustomer)
    await loadAll()
  }

  const saveProduct = async (e) => {
    e.preventDefault()
    await api.request('/api/products', { method: 'POST', body: JSON.stringify(product) })
    setProduct(emptyProduct)
    await loadAll()
  }

  const handleCustomerSelect = (value) => {
    const selected = data.customers.find(c => c.id === value)
    let scenarioCode = invoice.scenarioCode
    if (selected) scenarioCode = selected.ntnCnic ? 'SN001' : 'SN002'
    setInvoice({ ...invoice, customerId: value, scenarioCode })
    if (value) setShowNewCustomer(false)
  }

  const handleScenarioChange = (scenarioCode) => {
    const scenario = getScenario(scenarioCode)
    const next = invoice.lines.map(line => ({ ...line, taxRate: scenario.taxRate }))
    setInvoice({ ...invoice, scenarioCode, lines: next })
  }

  const updateLine = (i, key, value) => {
    const next = [...invoice.lines]
    next[i] = { ...next[i], [key]: value }
    if (key === 'productId') {
      const p = data.products.find(x => x.id === value)
      if (p) {
        next[i] = {
          ...next[i],
          productId: p.id,
          description: p.name,
          quantity: next[i].quantity || 1,
          unitPrice: p.unitPrice,
          taxRate: p.taxRate ?? getScenario(invoice.scenarioCode).taxRate,
          hsCode: p.hsCode || '',
          uom: p.uom || ''
        }
      }
    }
    setInvoice({ ...invoice, lines: next })
  }

  const addInvoiceLine = () => {
    setInvoice({ ...invoice, lines: [...invoice.lines, { ...emptyLine, taxRate: getScenario(invoice.scenarioCode).taxRate }] })
  }

  const createInlineCustomerIfNeeded = async () => {
    if (!showNewCustomer) return invoice.customerId
    if (!customer.name.trim()) throw new Error('Customer name is required')

    const res = await api.request('/api/customers', { method: 'POST', body: JSON.stringify(customer) })
    const newId = res.item.id
    const suggestedScenario = customer.ntnCnic ? 'SN001' : 'SN002'
    setCustomer(emptyCustomer)
    setShowNewCustomer(false)
    setInvoice(prev => ({ ...prev, customerId: newId, scenarioCode: suggestedScenario }))
    return newId
  }

  const findUnsavedProductLine = () => invoice.lines.findIndex(line => !line.productId && line.description.trim())

  const saveProductFromLine = async (line) => {
    const payload = {
      name: line.description,
      sku: '',
      hsCode: line.hsCode || '',
      uom: line.uom || '',
      taxRate: String(line.taxRate || 0),
      unitPrice: String(line.unitPrice || 0),
      description: line.description
    }
    const res = await api.request('/api/products', { method: 'POST', body: JSON.stringify(payload) })
    return res.item
  }

  const finalizeInvoiceCreate = async (customerIdToUse, linesToUse, scenarioCodeToUse) => {
    await api.request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId: customerIdToUse,
        scenarioCode: scenarioCodeToUse,
        invoiceDate: invoice.invoiceDate,
        lines: linesToUse
      })
    })

    setInvoice({
      customerId: '',
      scenarioCode: data.settings.defaultScenarioCode || 'SN001',
      invoiceDate: new Date().toISOString().slice(0, 10),
      lines: [{ ...emptyLine }]
    })
    setPageError('')
    await loadAll()
  }

  const saveInvoiceHandler = async (e) => {
    e.preventDefault()
    try {
      const customerIdToUse = await createInlineCustomerIfNeeded()
      if (!customerIdToUse) throw new Error('Please select or create a customer')
      const unsavedIndex = findUnsavedProductLine()
      if (unsavedIndex !== -1) {
        setSaveProductPrompt({ open: true, lineIndex: unsavedIndex })
        return
      }
      await finalizeInvoiceCreate(customerIdToUse, invoice.lines, invoice.scenarioCode)
    } catch (err) {
      setPageError(err.message || 'Failed to create invoice')
    }
  }

  const handleSaveProductChoice = async (shouldSave) => {
    try {
      const customerIdToUse = await createInlineCustomerIfNeeded()
      let nextLines = [...invoice.lines]
      const lineIndex = saveProductPrompt.lineIndex
      if (shouldSave && lineIndex !== null) {
        const createdProduct = await saveProductFromLine(nextLines[lineIndex])
        nextLines[lineIndex] = {
          ...nextLines[lineIndex],
          productId: createdProduct.id,
          description: createdProduct.name,
          hsCode: createdProduct.hsCode || nextLines[lineIndex].hsCode,
          uom: createdProduct.uom || nextLines[lineIndex].uom,
          unitPrice: createdProduct.unitPrice ?? nextLines[lineIndex].unitPrice,
          taxRate: createdProduct.taxRate ?? nextLines[lineIndex].taxRate
        }
      }
      setSaveProductPrompt({ open: false, lineIndex: null })
      await finalizeInvoiceCreate(customerIdToUse, nextLines, invoice.scenarioCode)
    } catch (err) {
      setPageError(err.message || 'Failed to continue invoice save')
    }
  }

  const validateFbr = async (id) => {
    try {
      const res = await api.request(`/api/invoices/${id}/validate-fbr`, { method: 'POST' })
      setFbrResult({ type: 'validate', payload: res })
      await loadAll()
    } catch (err) {
      setPageError(err.message)
    }
  }

  const postFbr = async (id) => {
    try {
      const res = await api.request(`/api/invoices/${id}/submit-fbr`, { method: 'POST' })
      setFbrResult({ type: 'submit', payload: res })
      await loadAll()
    } catch (err) {
      setPageError(err.message)
    }
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    await api.request('/api/settings', { method: 'PUT', body: JSON.stringify(data.settings) })
    setMsg('Settings saved')
    await loadAll()
  }

  if (!token) {
    return (
      <div className="authWrap">
        <form className="card authCard" onSubmit={doLogin}>
          <p className="eyebrow">Next.js</p>
          <h1>FBR Sandbox Ready</h1>
          <p className="muted">SN001 / SN002 testing version for Hostinger.</p>
          <input placeholder="Email" value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} />
          <input placeholder="Password" type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
          {login.error ? <div className="alert error">{login.error}</div> : null}
          <button className="primary">Login</button>
        </form>
      </div>
    )
  }

  const currentScenario = getScenario(invoice.scenarioCode)

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="card brand">
            <p className="eyebrow">ERP Foundation</p>
            <h2>FBR Invoicing</h2>
            <p className="muted">Sandbox-ready SN001/SN002</p>
          </div>
          <div className="nav">
            {['invoice','dashboard','customers','products','logs','settings'].map(item => (
              <button key={item} className={active === item ? 'navBtn active' : 'navBtn'} onClick={() => setActive(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button className="secondary" onClick={() => { localStorage.removeItem('token'); setToken('') }}>Logout</button>
      </aside>

      <main className="content">
        {active === 'invoice' && (
          <div className="stack">
            <form className="card stack" onSubmit={saveInvoiceHandler}>
              <div className="titleRow">
                <h3>Create Invoice</h3>
                <input className="dateInput" type="date" value={invoice.invoiceDate} onChange={e => setInvoice({ ...invoice, invoiceDate: e.target.value })} />
              </div>

              <div className="formGrid">
                <select value={invoice.customerId} onChange={e => handleCustomerSelect(e.target.value)}>
                  <option value="">Select customer</option>
                  {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowNewCustomer(prev => !prev)
                    setInvoice({ ...invoice, customerId: '' })
                  }}
                >
                  {showNewCustomer ? 'Cancel New Customer' : '+ New Customer'}
                </button>
              </div>

              {showNewCustomer && (
                <div className="formGrid">
                  <input placeholder="Customer Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                  <input placeholder="NTN/CNIC" value={customer.ntnCnic} onChange={e => setCustomer({ ...customer, ntnCnic: e.target.value })} />
                  <input placeholder="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                  <input placeholder="Email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
                  <input className="full" placeholder="Address" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
                </div>
              )}

              <div className="formGrid">
                <select value={invoice.scenarioCode} onChange={e => handleScenarioChange(e.target.value)}>
                  {SCENARIOS.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
                </select>
                <div className="scenarioBox">
                  <strong>{currentScenario.code}</strong>
                  <span>{currentScenario.label.replace(`${currentScenario.code} - `, '')}</span>
                </div>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Description</th>
                      <th>HS Code</th>
                      <th>UOM</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Tax %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lines.map((line, i) => (
                      <tr key={i}>
                        <td>
                          <select value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)}>
                            <option value="">Select existing product</option>
                            {data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td><input placeholder="Type product name or custom item" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></td>
                        <td><input value={line.hsCode} onChange={e => updateLine(i, 'hsCode', e.target.value)} /></td>
                        <td><input value={line.uom} onChange={e => updateLine(i, 'uom', e.target.value)} /></td>
                        <td><input value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} /></td>
                        <td><input value={line.unitPrice} onChange={e => updateLine(i, 'unitPrice', e.target.value)} /></td>
                        <td><input value={line.taxRate} onChange={e => updateLine(i, 'taxRate', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row">
                <button type="button" className="secondary" onClick={addInvoiceLine}>Add Line</button>
                <div className="totals">
                  <p>Subtotal: <strong>PKR {totals.subTotal.toLocaleString()}</strong></p>
                  <p>Sales Tax: <strong>PKR {totals.salesTax.toLocaleString()}</strong></p>
                  <p>Further Tax: <strong>PKR {totals.furtherTax.toLocaleString()}</strong></p>
                  <p>Total: <strong>PKR {totals.grandTotal.toLocaleString()}</strong></p>
                </div>
              </div>

              {pageError ? <div className="alert error">{pageError}</div> : null}
              <button className="primary">Create Invoice</button>
            </form>

            <div className="card tableWrap">
              <h3>Recent Invoices</h3>
              <table>
                <thead><tr><th>Invoice No</th><th>Scenario</th><th>Customer</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead>
                <tbody>
                  {[...data.invoices].reverse().map(inv => (
                    <tr key={inv.id}>
                      <td>{inv.invoiceNumber}</td>
                      <td>{inv.scenarioCode || '-'}</td>
                      <td>{inv.customerName}</td>
                      <td>{inv.status}</td>
                      <td>PKR {Number(inv.grandTotal || 0).toLocaleString()}</td>
                      <td className="actionCell">
                        <button className="linkBtn" onClick={() => validateFbr(inv.id)}>Validate</button>
                        <button className="linkBtn" onClick={() => postFbr(inv.id)}>Post to FBR</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fbrResult ? (
              <div className="card">
                <h3>{fbrResult.type === 'validate' ? 'Validation Result' : 'Submission Result'}</h3>
                <pre className="codeBlock">{JSON.stringify(fbrResult.payload, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        )}

        {active === 'dashboard' && (
          <div className="stats">
            <div className="card stat"><p>Total Invoices</p><h3>{metrics.total}</h3></div>
            <div className="card stat"><p>Posted</p><h3>{metrics.posted}</h3></div>
            <div className="card stat"><p>Failed</p><h3>{metrics.failed}</h3></div>
            <div className="card stat"><p>Revenue</p><h3>PKR {metrics.revenue.toLocaleString()}</h3></div>
          </div>
        )}

        {active === 'customers' && (
          <div className="stack">
            <form className="card formGrid" onSubmit={saveCustomer}>
              <h3 className="full">Add Customer</h3>
              <input placeholder="Customer Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} required />
              <input placeholder="NTN/CNIC" value={customer.ntnCnic} onChange={e => setCustomer({ ...customer, ntnCnic: e.target.value })} />
              <input placeholder="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
              <input placeholder="Email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
              <input className="full" placeholder="Address" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
              <button className="primary">Save Customer</button>
            </form>

            <div className="card tableWrap">
              <h3>Customers</h3>
              <table><thead><tr><th>Name</th><th>NTN/CNIC</th><th>Phone</th><th>Email</th></tr></thead><tbody>
                {data.customers.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.ntnCnic || '-'}</td><td>{c.phone || '-'}</td><td>{c.email || '-'}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        )}

        {active === 'products' && (
          <div className="stack">
            <form className="card formGrid" onSubmit={saveProduct}>
              <h3 className="full">Add Product</h3>
              <input placeholder="Product Name" value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} required />
              <input placeholder="SKU" value={product.sku} onChange={e => setProduct({ ...product, sku: e.target.value })} />
              <input placeholder="HS Code" value={product.hsCode} onChange={e => setProduct({ ...product, hsCode: e.target.value })} />
              <input placeholder="UOM" value={product.uom} onChange={e => setProduct({ ...product, uom: e.target.value })} />
              <input placeholder="Tax Rate" value={product.taxRate} onChange={e => setProduct({ ...product, taxRate: e.target.value })} />
              <input placeholder="Unit Price" value={product.unitPrice} onChange={e => setProduct({ ...product, unitPrice: e.target.value })} required />
              <input className="full" placeholder="Description" value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} />
              <button className="primary">Save Product</button>
            </form>

            <div className="card tableWrap">
              <h3>Products</h3>
              <table><thead><tr><th>Name</th><th>HS Code</th><th>UOM</th><th>Tax</th><th>Price</th></tr></thead><tbody>
                {data.products.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.hsCode || '-'}</td><td>{p.uom || '-'}</td><td>{p.taxRate}%</td><td>PKR {Number(p.unitPrice || 0).toLocaleString()}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        )}

        {active === 'logs' && (
          <div className="card tableWrap">
            <h3>FBR Logs</h3>
            <table><thead><tr><th>Time</th><th>Invoice</th><th>Scenario</th><th>Status</th><th>Reference</th><th>Message</th></tr></thead><tbody>
              {[...data.logs].reverse().map(log => <tr key={log.id}><td>{log.createdAt}</td><td>{log.invoiceNumber}</td><td>{log.scenarioCode || '-'}</td><td>{log.status}</td><td>{log.reference || '-'}</td><td>{log.message}</td></tr>)}
            </tbody></table>
          </div>
        )}

        {active === 'settings' && (
          <form className="card formGrid" onSubmit={saveSettings}>
            <h3 className="full">Settings</h3>
            <input placeholder="Company Name" value={data.settings.companyName || ''} onChange={e => setData({ ...data, settings: { ...data.settings, companyName: e.target.value } })} />
            <input placeholder="Seller NTN" value={data.settings.sellerNTN || ''} onChange={e => setData({ ...data, settings: { ...data.settings, sellerNTN: e.target.value } })} />
            <input placeholder="Seller Business Name" value={data.settings.sellerBusinessName || ''} onChange={e => setData({ ...data, settings: { ...data.settings, sellerBusinessName: e.target.value } })} />
            <input placeholder="Seller Province" value={data.settings.sellerProvince || ''} onChange={e => setData({ ...data, settings: { ...data.settings, sellerProvince: e.target.value } })} />
            <input className="full" placeholder="Seller Address" value={data.settings.sellerAddress || ''} onChange={e => setData({ ...data, settings: { ...data.settings, sellerAddress: e.target.value } })} />
            <input placeholder="Invoice Prefix" value={data.settings.invoicePrefix || 'INV'} onChange={e => setData({ ...data, settings: { ...data.settings, invoicePrefix: e.target.value } })} />
            <input placeholder="Default Tax Rate" value={data.settings.defaultTaxRate || '18'} onChange={e => setData({ ...data, settings: { ...data.settings, defaultTaxRate: e.target.value } })} />
            <input className="full" placeholder="FBR Sandbox Base URL" value={data.settings.fbrSandboxBaseUrl || ''} onChange={e => setData({ ...data, settings: { ...data.settings, fbrSandboxBaseUrl: e.target.value } })} />
            <input className="full" placeholder="FBR Sandbox Token" value={data.settings.fbrSandboxToken || ''} onChange={e => setData({ ...data, settings: { ...data.settings, fbrSandboxToken: e.target.value } })} />
            {msg ? <div className="alert success full">{msg}</div> : null}
            <button className="primary">Save Settings</button>
          </form>
        )}
      </main>

      {saveProductPrompt.open && (
        <div className="modalOverlay">
          <div className="card modalCard">
            <h3>Save product for future?</h3>
            <p className="muted">This line item is a new product. Do you want to save it in your product list for future invoices?</p>
            <div className="row">
              <button type="button" className="secondary" onClick={() => handleSaveProductChoice(false)}>
                No, use only for this invoice
              </button>
              <button type="button" className="primary" onClick={() => handleSaveProductChoice(true)}>
                Yes, save product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
