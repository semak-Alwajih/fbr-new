import { useEffect, useMemo, useState } from 'react'

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

function calc(lines) {
  const subTotal = lines.reduce((s, line) => s + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
  const taxTotal = lines.reduce((s, line) => s + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.taxRate || 0) / 100), 0)
  return { subTotal, taxTotal, grandTotal: subTotal + taxTotal }
}

export default function Home() {
  const [token, setToken] = useState('')
  const [active, setActive] = useState('dashboard')
  const [data, setData] = useState({ customers: [], products: [], invoices: [], logs: [], settings: {} })
  const [login, setLogin] = useState({ email: 'admin@example.com', password: 'admin123', error: '' })
  const [customer, setCustomer] = useState(emptyCustomer)
  const [product, setProduct] = useState(emptyProduct)
  const [invoice, setInvoice] = useState({
    customerId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, hsCode: '', uom: '' }]
  })
  const [msg, setMsg] = useState('')

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
    if (saved) {
      setToken(saved)
    }
  }, [])

  useEffect(() => {
    if (token) loadAll().catch(() => {
      localStorage.removeItem('token')
      setToken('')
    })
  }, [token])

  const metrics = useMemo(() => ({
    total: data.invoices.length,
    posted: data.invoices.filter(x => x.status === 'Posted').length,
    failed: data.invoices.filter(x => x.status === 'Failed').length,
    revenue: data.invoices.reduce((s, x) => s + Number(x.grandTotal || 0), 0)
  }), [data.invoices])

  const totals = useMemo(() => calc(invoice.lines), [invoice.lines])

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

  const updateLine = (i, key, value) => {
    const next = [...invoice.lines]
    next[i] = { ...next[i], [key]: value }
    if (key === 'productId') {
      const p = data.products.find(x => x.id === value)
      if (p) next[i] = { ...next[i], productId: p.id, description: p.name, quantity: 1, unitPrice: p.unitPrice, taxRate: p.taxRate, hsCode: p.hsCode || '', uom: p.uom || '' }
    }
    setInvoice({ ...invoice, lines: next })
  }

  const saveInvoice = async (e) => {
    e.preventDefault()
    await api.request('/api/invoices', { method: 'POST', body: JSON.stringify(invoice) })
    setInvoice({
      customerId: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, hsCode: '', uom: '' }]
    })
    await loadAll()
  }

  const postFbr = async (id) => {
    await api.request(`/api/invoices/${id}/submit-fbr`, { method: 'POST' })
    await loadAll()
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
          <p className="eyebrow">Next.js Rebuild</p>
          <h1>FBR Digital Invoicing</h1>
          <p className="muted">Hostinger-friendly version.</p>
          <input placeholder="Email" value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} />
          <input placeholder="Password" type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
          {login.error ? <div className="alert error">{login.error}</div> : null}
          <button className="primary">Login</button>
        </form>
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="card brand">
            <p className="eyebrow">ERP Foundation</p>
            <h2>FBR Invoicing</h2>
            <p className="muted">Next.js + API routes</p>
          </div>
          <div className="nav">
            {['dashboard','customers','products','invoices','logs','settings'].map(item => (
              <button key={item} className={active === item ? 'navBtn active' : 'navBtn'} onClick={() => setActive(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button className="secondary" onClick={() => { localStorage.removeItem('token'); setToken('') }}>Logout</button>
      </aside>
      <main className="content">
        {active === 'dashboard' && (
          <div className="stack">
            <div className="stats">
              <div className="card stat"><p>Total Invoices</p><h3>{metrics.total}</h3></div>
              <div className="card stat"><p>Posted</p><h3>{metrics.posted}</h3></div>
              <div className="card stat"><p>Failed</p><h3>{metrics.failed}</h3></div>
              <div className="card stat"><p>Revenue</p><h3>PKR {metrics.revenue.toLocaleString()}</h3></div>
            </div>
          </div>
        )}

        {active === 'customers' && (
          <div className="stack">
            <form className="card formGrid" onSubmit={saveCustomer}>
              <h3>Add Customer</h3>
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
              <h3>Add Product</h3>
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

        {active === 'invoices' && (
          <div className="stack">
            <form className="card stack" onSubmit={saveInvoice}>
              <h3>Create Invoice</h3>
              <div className="formGrid">
                <select value={invoice.customerId} onChange={e => setInvoice({ ...invoice, customerId: e.target.value })} required>
                  <option value="">Select customer</option>
                  {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={invoice.invoiceDate} onChange={e => setInvoice({ ...invoice, invoiceDate: e.target.value })} />
              </div>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Product</th><th>Description</th><th>Qty</th><th>Price</th><th>Tax</th></tr></thead>
                  <tbody>
                    {invoice.lines.map((line, i) => (
                      <tr key={i}>
                        <td>
                          <select value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)}>
                            <option value="">Select product</option>
                            {data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td><input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></td>
                        <td><input value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} /></td>
                        <td><input value={line.unitPrice} onChange={e => updateLine(i, 'unitPrice', e.target.value)} /></td>
                        <td><input value={line.taxRate} onChange={e => updateLine(i, 'taxRate', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row">
                <button type="button" className="secondary" onClick={() => setInvoice({ ...invoice, lines: [...invoice.lines, { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, hsCode: '', uom: '' }] })}>Add Line</button>
                <div className="totals">
                  <p>Subtotal: <strong>PKR {totals.subTotal.toLocaleString()}</strong></p>
                  <p>Tax: <strong>PKR {totals.taxTotal.toLocaleString()}</strong></p>
                  <p>Total: <strong>PKR {totals.grandTotal.toLocaleString()}</strong></p>
                </div>
              </div>
              <button className="primary">Create Invoice</button>
            </form>
            <div className="card tableWrap">
              <h3>Invoices</h3>
              <table><thead><tr><th>Invoice No</th><th>Customer</th><th>Status</th><th>Total</th><th>Action</th></tr></thead><tbody>
                {[...data.invoices].reverse().map(inv => <tr key={inv.id}><td>{inv.invoiceNumber}</td><td>{inv.customerName}</td><td>{inv.status}</td><td>PKR {Number(inv.grandTotal || 0).toLocaleString()}</td><td><button className="linkBtn" onClick={() => postFbr(inv.id)}>Post to FBR</button></td></tr>)}
              </tbody></table>
            </div>
          </div>
        )}

        {active === 'logs' && (
          <div className="card tableWrap">
            <h3>FBR Logs</h3>
            <table><thead><tr><th>Time</th><th>Invoice</th><th>Status</th><th>Reference</th><th>Message</th></tr></thead><tbody>
              {[...data.logs].reverse().map(log => <tr key={log.id}><td>{log.createdAt}</td><td>{log.invoiceNumber}</td><td>{log.status}</td><td>{log.reference}</td><td>{log.message}</td></tr>)}
            </tbody></table>
          </div>
        )}

        {active === 'settings' && (
          <form className="card formGrid" onSubmit={saveSettings}>
            <h3 className="full">Settings</h3>
            <input placeholder="Company Name" value={data.settings.companyName || ''} onChange={e => setData({ ...data, settings: { ...data.settings, companyName: e.target.value } })} />
            <input placeholder="NTN" value={data.settings.ntn || ''} onChange={e => setData({ ...data, settings: { ...data.settings, ntn: e.target.value } })} />
            <input className="full" placeholder="Address" value={data.settings.address || ''} onChange={e => setData({ ...data, settings: { ...data.settings, address: e.target.value } })} />
            <input placeholder="Invoice Prefix" value={data.settings.invoicePrefix || 'INV'} onChange={e => setData({ ...data, settings: { ...data.settings, invoicePrefix: e.target.value } })} />
            <input placeholder="Default Tax Rate" value={data.settings.defaultTaxRate || '18'} onChange={e => setData({ ...data, settings: { ...data.settings, defaultTaxRate: e.target.value } })} />
            <input className="full" placeholder="FBR Base URL" value={data.settings.fbrBaseUrl || ''} onChange={e => setData({ ...data, settings: { ...data.settings, fbrBaseUrl: e.target.value } })} />
            <input className="full" placeholder="FBR API Key" value={data.settings.fbrApiKey || ''} onChange={e => setData({ ...data, settings: { ...data.settings, fbrApiKey: e.target.value } })} />
            {msg ? <div className="alert success full">{msg}</div> : null}
            <button className="primary">Save Settings</button>
          </form>
        )}
      </main>
    </div>
  )
}
