import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import './App.css'

interface Customer {
  id: number
  email: string
  first_name: string
  last_name: string
  created_at: string
}

interface Product {
  id: number
  sku: string
  name: string
  description: string
  price: number
  inventory_count: number
}

interface Order {
  id: number
  customer_id: number
  status: string
  total_amount: number
  first_name?: string
  last_name?: string
  customer_email?: string
  created_at: string
}

interface Stats {
  customer_count: number
  product_count: number
  order_count: number
  total_revenue: number
}

interface Operation {
  type: string
  detail?: string
  duration: number
  success: boolean
  timestamp: string
  id: number
}

interface MonitorData {
  connections: { total: number; active: number; idle: number; waiting: number }
  database: {
    xact_commit: number
    xact_rollback: number
    blks_read: number
    blks_hit: number
    tup_inserted: number
    tup_updated: number
    tup_deleted: number
    cache_hit_ratio: number
    size: string
  }
  tables: Array<{ table_name: string; row_count: number; inserts: number; updates: number; deletes: number; seq_scan: number; idx_scan: number }>
  activeQueries: Array<{ pid: number; state: string; query: string; duration_sec: number }>
  pool: { total: number; idle: number; waiting: number }
}

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'

const TYPE_COLORS: Record<string, string> = {
  INSERT: '#34d399',
  SELECT: '#29b5e8',
  UPDATE: '#fbbf24'
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'products' | 'orders' | 'monitor'>('dashboard')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operationLog, setOperationLog] = useState<string[]>([])
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [operations, setOperations] = useState<Operation[]>([])
  const [totalOps, setTotalOps] = useState(0)
  const [loadMode, setLoadMode] = useState<'light' | 'heavy' | 'ramp'>('light')
  const [currentOpsPerSec, setCurrentOpsPerSec] = useState(0)
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null)
  const operationIdRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)
  const rampIntervalRef = useRef<number | null>(null)

  const log = (message: string) => {
    setOperationLog(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 49)])
  }

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/stats`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/customers`)
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      setError('Failed to fetch customers')
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/products`)
      const data = await res.json()
      setProducts(data)
    } catch (err) {
      setError('Failed to fetch products')
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/orders`)
      const data = await res.json()
      setOrders(data)
    } catch (err) {
      setError('Failed to fetch orders')
    }
  }, [])

  const fetchMonitor = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/monitor`)
      const data = await res.json()
      setMonitorData(data)
    } catch (err) {
      console.error('Failed to fetch monitor data')
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchCustomers()
    fetchProducts()
    fetchOrders()
  }, [fetchStats, fetchCustomers, fetchProducts, fetchOrders])

  const runSingleOp = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/simulate/burst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 })
      })
      const data = await res.json()
      
      if (data.operations && data.operations.length > 0) {
        const op = data.operations[0]
        const newOp = { ...op, id: operationIdRef.current++ }
        setOperations(prev => [newOp, ...prev].slice(0, 100))
        setTotalOps(prev => prev + 1)
      }
      
      fetchStats()
    } catch (err) {
      console.error('Op failed')
    }
  }, [fetchStats])

  const getOpsPerSec = useCallback((mode: 'light' | 'heavy' | 'ramp', rampLevel: number = 0) => {
    switch (mode) {
      case 'light': return 2
      case 'heavy': return 15
      case 'ramp': return [2, 5, 10, 20, 35, 50][Math.min(rampLevel, 5)]
      default: return 2
    }
  }, [])

  useEffect(() => {
    let rampLevel = 0
    
    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (rampIntervalRef.current) {
        clearInterval(rampIntervalRef.current)
        rampIntervalRef.current = null
      }
    }

    if (!isPlaying) {
      cleanup()
      setCurrentOpsPerSec(0)
      return
    }

    const opsPerSec = getOpsPerSec(loadMode, rampLevel)
    setCurrentOpsPerSec(opsPerSec)

    const scheduleNext = () => {
      const currentOps = getOpsPerSec(loadMode, rampLevel)
      const delay = 1000 / currentOps
      
      timeoutRef.current = window.setTimeout(() => {
        runSingleOp()
        if (isPlaying) scheduleNext()
      }, delay)
    }

    scheduleNext()

    if (loadMode === 'ramp') {
      rampIntervalRef.current = window.setInterval(() => {
        rampLevel = Math.min(rampLevel + 1, 5)
        setCurrentOpsPerSec(getOpsPerSec('ramp', rampLevel))
        log(`Ramp: ${getOpsPerSec('ramp', rampLevel)} ops/sec`)
      }, 8000)
    }

    return cleanup
  }, [isPlaying, loadMode, runSingleOp, getOpsPerSec])

  const startLoad = (mode: 'light' | 'heavy' | 'ramp') => {
    setLoadMode(mode)
    setIsPlaying(true)
    log(`Started ${mode} load`)
  }

  const stopLoad = () => {
    setIsPlaying(false)
    log('Stopped')
    fetchCustomers()
    fetchProducts()
    fetchOrders()
  }

  const switchTab = (tab: 'dashboard' | 'customers' | 'products' | 'orders' | 'monitor') => {
    setActiveTab(tab)
    if (tab === 'customers') fetchCustomers()
    else if (tab === 'products') fetchProducts()
    else if (tab === 'orders') fetchOrders()
    else if (tab === 'dashboard') fetchStats()
    else if (tab === 'monitor') fetchMonitor()
  }

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL data? This cannot be undone.')) return
    try {
      setLoading(true)
      setIsPlaying(false)
      await fetch(`${API_URL}/reset`, { method: 'DELETE' })
      setOperations([])
      setTotalOps(0)
      setOperationLog([])
      log('All data cleared')
      fetchStats()
      fetchCustomers()
      fetchProducts()
      fetchOrders()
    } catch (err) {
      setError('Failed to clear data')
    } finally {
      setLoading(false)
    }
  }

  const createCustomer = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      log(`Created customer: ${data.first_name} ${data.last_name}`)
      fetchCustomers()
      fetchStats()
    } catch (err) {
      setError('Failed to create customer')
    } finally {
      setLoading(false)
    }
  }

  const deleteCustomer = async (id: number) => {
    try {
      await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE' })
      log(`Deleted customer ID: ${id}`)
      fetchCustomers()
      fetchStats()
    } catch (err) {
      setError('Failed to delete customer')
    }
  }

  const createProduct = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      log(`Created product: ${data.name} ($${data.price})`)
      fetchProducts()
      fetchStats()
    } catch (err) {
      setError('Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const deleteProduct = async (id: number) => {
    try {
      await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' })
      log(`Deleted product ID: ${id}`)
      fetchProducts()
      fetchStats()
    } catch (err) {
      setError('Failed to delete product')
    }
  }

  const createOrder = async () => {
    if (customers.length === 0 || products.length === 0) {
      setError('Need customers and products to create orders')
      return
    }
    try {
      setLoading(true)
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const product = products[Math.floor(Math.random() * products.length)]
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          items: [{ product_id: product.id, quantity: Math.floor(Math.random() * 3) + 1 }]
        })
      })
      const data = await res.json()
      log(`Created order #${data.id} for ${customer.first_name} - $${data.total_amount}`)
      fetchOrders()
      fetchProducts()
      fetchStats()
    } catch (err) {
      setError('Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (id: number, status: string) => {
    try {
      await fetch(`${API_URL}/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      log(`Order #${id} status → ${status}`)
      fetchOrders()
      fetchStats()
    } catch (err) {
      setError('Failed to update order status')
    }
  }

  const chartData = operations.slice(0, 50).reverse().map((op, i) => ({
    index: i,
    duration: op.duration,
    type: op.type,
    success: op.success
  }))

  const avgLatency = operations.length > 0 
    ? (operations.reduce((sum, op) => sum + op.duration, 0) / operations.length).toFixed(0)
    : 0

  const successRate = operations.length > 0
    ? ((operations.filter(op => op.success).length / operations.length) * 100).toFixed(1)
    : 100

  return (
    <div className="app">
      <header>
        <div className="logo-container">
          <img src="/snowflake-icon.svg" alt="Snowflake" className="logo-icon" />
          <span className="logo-text">Snowflake Postgres Demo</span>
        </div>
        <p className="subtitle">E-commerce CRUD Operations</p>
      </header>

      <nav>
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => switchTab('dashboard')}>Dashboard</button>
        <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => switchTab('customers')}>Customers</button>
        <button className={activeTab === 'products' ? 'active' : ''} onClick={() => switchTab('products')}>Products</button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => switchTab('orders')}>Orders</button>
        <button className={activeTab === 'monitor' ? 'active' : ''} onClick={() => switchTab('monitor')}>Monitor</button>
      </nav>

      {error && <div className="error">{error} <button onClick={() => setError(null)}>×</button></div>}

      <main>
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Customers</h3>
                <div className="stat-value">{(stats?.customer_count || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3>Products</h3>
                <div className="stat-value">{(stats?.product_count || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3>Orders</h3>
                <div className="stat-value">{(stats?.order_count || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3>Revenue</h3>
                <div className="stat-value">${Number(stats?.total_revenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </div>
            </div>

            <div className="traffic-simulator">
              <div className="simulator-header">
                <h2>Live Traffic Simulator</h2>
                <div className="header-buttons">
                  <button className="clear-button" onClick={clearAllData} disabled={loading || isPlaying}>
                    Clear All
                  </button>
                  {isPlaying && (
                    <button className="stop-button" onClick={stopLoad}>
                      ■ Stop
                    </button>
                  )}
                </div>
              </div>
              
              <div className="load-presets">
                <button 
                  className={`preset-button light ${isPlaying && loadMode === 'light' ? 'active' : ''}`}
                  onClick={() => startLoad('light')}
                  disabled={isPlaying}
                >
                  <span className="preset-icon">○</span>
                  <span className="preset-label">Light</span>
                  <span className="preset-desc">2 ops/sec</span>
                </button>
                <button 
                  className={`preset-button heavy ${isPlaying && loadMode === 'heavy' ? 'active' : ''}`}
                  onClick={() => startLoad('heavy')}
                  disabled={isPlaying}
                >
                  <span className="preset-icon">●</span>
                  <span className="preset-label">Heavy</span>
                  <span className="preset-desc">15 ops/sec</span>
                </button>
                <button 
                  className={`preset-button ramp ${isPlaying && loadMode === 'ramp' ? 'active' : ''}`}
                  onClick={() => startLoad('ramp')}
                  disabled={isPlaying}
                >
                  <span className="preset-icon">↗</span>
                  <span className="preset-label">Ramp Up</span>
                  <span className="preset-desc">2→50 ops/sec</span>
                </button>
              </div>

              {isPlaying && (
                <div className="current-load">
                  <span className="load-indicator"></span>
                  Running: <strong>{currentOpsPerSec} ops/sec</strong>
                  {loadMode === 'ramp' && <span className="ramp-badge">RAMPING</span>}
                </div>
              )}

              <div className="metrics-row">
                <div className="metric">
                  <span className="metric-label">Total Ops</span>
                  <span className="metric-value">{totalOps.toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Avg Latency</span>
                  <span className="metric-value">{avgLatency}ms</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Success Rate</span>
                  <span className="metric-value">{successRate}%</span>
                </div>
              </div>

              <div className="chart-container">
                <h3>Operation Latency (ms)</h3>
                <div className="chart-legend">
                  <span className="legend-item"><span className="dot insert"></span>INSERT</span>
                  <span className="legend-item"><span className="dot select"></span>SELECT</span>
                  <span className="legend-item"><span className="dot update"></span>UPDATE</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="index" tick={false} />
                    <YAxis width={40} tick={{ fill: '#8babc7', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ background: '#0f2137', border: '1px solid #1e3a5f', borderRadius: '8px' }}
                      labelStyle={{ color: '#f0f6fc' }}
                      formatter={(value, _name, props) => [`${value}ms`, (props.payload as { type: string }).type]}
                    />
                    <Bar dataKey="duration" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type] || '#29b5e8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="recent-operations">
                <h3>Recent Operations</h3>
                <div className="ops-list">
                  {operations.slice(0, 10).map(op => (
                    <div key={op.id} className={`op-item ${op.type.toLowerCase()}`}>
                      <span className="op-type">{op.type}</span>
                      {op.detail && <span className="op-detail">{op.detail}</span>}
                      <span className="op-duration">{op.duration}ms</span>
                      <span className={`op-status ${op.success ? 'success' : 'error'}`}>
                        {op.success ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="operation-log">
              <h2>Activity Log</h2>
              <div className="log-entries">
                {operationLog.length === 0 ? (
                  <p className="empty">No operations yet. Press Play or create some data!</p>
                ) : (
                  operationLog.map((entry, i) => <div key={i} className="log-entry">{entry}</div>)
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="section">
            <div className="section-header">
              <h2>Customers ({customers.length})</h2>
              <button onClick={createCustomer} disabled={loading}>+ Add Customer</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.first_name} {c.last_name}</td>
                    <td>{c.email}</td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td><button className="delete" onClick={() => deleteCustomer(c.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="section">
            <div className="section-header">
              <h2>Products ({products.length})</h2>
              <button onClick={createProduct} disabled={loading}>+ Add Product</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Inventory</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td>{p.inventory_count}</td>
                    <td><button className="delete" onClick={() => deleteProduct(p.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="section">
            <div className="section-header">
              <h2>Orders ({orders.length})</h2>
              <button onClick={createOrder} disabled={loading}>+ Create Order</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.first_name} {o.last_name}</td>
                    <td>${Number(o.total_amount).toFixed(2)}</td>
                    <td><span className={`status ${o.status}`}>{o.status}</span></td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="shipped">Shipped</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="monitor-dashboard">
            <div className="monitor-header">
              <h2>Database Health Monitor</h2>
              <button onClick={fetchMonitor} className="refresh-btn">↻ Refresh</button>
            </div>

            {monitorData ? (
              <>
                <div className="monitor-grid">
                  <div className="monitor-card">
                    <h3>Connection Pool</h3>
                    <div className="monitor-stats">
                      <div className="monitor-stat">
                        <span className="monitor-value">{monitorData.pool.total}</span>
                        <span className="monitor-label">Total</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value good">{monitorData.pool.idle}</span>
                        <span className="monitor-label">Idle</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value warn">{monitorData.pool.waiting}</span>
                        <span className="monitor-label">Waiting</span>
                      </div>
                    </div>
                  </div>

                  <div className="monitor-card">
                    <h3>DB Connections</h3>
                    <div className="monitor-stats">
                      <div className="monitor-stat">
                        <span className="monitor-value">{monitorData.connections.total}</span>
                        <span className="monitor-label">Total</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value good">{monitorData.connections.active}</span>
                        <span className="monitor-label">Active</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value">{monitorData.connections.idle}</span>
                        <span className="monitor-label">Idle</span>
                      </div>
                    </div>
                  </div>

                  <div className="monitor-card">
                    <h3>Cache Hit Ratio</h3>
                    <div className="monitor-stats single">
                      <div className="monitor-stat large">
                        <span className={`monitor-value ${Number(monitorData.database.cache_hit_ratio) > 90 ? 'good' : 'warn'}`}>
                          {monitorData.database.cache_hit_ratio}%
                        </span>
                        <span className="monitor-label">Buffer Cache</span>
                      </div>
                    </div>
                  </div>

                  <div className="monitor-card">
                    <h3>Database Size</h3>
                    <div className="monitor-stats single">
                      <div className="monitor-stat large">
                        <span className="monitor-value">{monitorData.database.size}</span>
                        <span className="monitor-label">Total</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="monitor-grid two-col">
                  <div className="monitor-card wide">
                    <h3>Transaction Stats</h3>
                    <div className="monitor-stats">
                      <div className="monitor-stat">
                        <span className="monitor-value good">{Number(monitorData.database.xact_commit).toLocaleString()}</span>
                        <span className="monitor-label">Commits</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value warn">{Number(monitorData.database.xact_rollback).toLocaleString()}</span>
                        <span className="monitor-label">Rollbacks</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value">{Number(monitorData.database.tup_inserted).toLocaleString()}</span>
                        <span className="monitor-label">Inserts</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value">{Number(monitorData.database.tup_updated).toLocaleString()}</span>
                        <span className="monitor-label">Updates</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value">{Number(monitorData.database.tup_deleted).toLocaleString()}</span>
                        <span className="monitor-label">Deletes</span>
                      </div>
                    </div>
                  </div>

                  <div className="monitor-card wide">
                    <h3>I/O Stats</h3>
                    <div className="monitor-stats">
                      <div className="monitor-stat">
                        <span className="monitor-value">{Number(monitorData.database.blks_hit).toLocaleString()}</span>
                        <span className="monitor-label">Blocks Hit</span>
                      </div>
                      <div className="monitor-stat">
                        <span className="monitor-value">{Number(monitorData.database.blks_read).toLocaleString()}</span>
                        <span className="monitor-label">Blocks Read</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="monitor-card full-width">
                  <h3>Table Statistics</h3>
                  <table className="monitor-table">
                    <thead>
                      <tr>
                        <th>Table</th>
                        <th>Rows</th>
                        <th>Inserts</th>
                        <th>Updates</th>
                        <th>Deletes</th>
                        <th>Seq Scans</th>
                        <th>Idx Scans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitorData.tables.map(t => (
                        <tr key={t.table_name}>
                          <td>{t.table_name}</td>
                          <td>{Number(t.row_count).toLocaleString()}</td>
                          <td>{Number(t.inserts).toLocaleString()}</td>
                          <td>{Number(t.updates).toLocaleString()}</td>
                          <td>{Number(t.deletes).toLocaleString()}</td>
                          <td>{Number(t.seq_scan).toLocaleString()}</td>
                          <td>{Number(t.idx_scan).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {monitorData.activeQueries.length > 0 && (
                  <div className="monitor-card full-width">
                    <h3>Active Queries</h3>
                    <div className="active-queries">
                      {monitorData.activeQueries.map(q => (
                        <div key={q.pid} className="query-item">
                          <span className="query-pid">PID {q.pid}</span>
                          <span className="query-duration">{q.duration_sec}s</span>
                          <code className="query-text">{q.query.substring(0, 100)}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty">Loading monitor data...</div>
            )}
          </div>
        )}
      </main>

      <footer>
        <p>Connected to Snowflake Postgres</p>
      </footer>
    </div>
  )
}

export default App
