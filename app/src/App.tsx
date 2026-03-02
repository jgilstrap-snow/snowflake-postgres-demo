import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { 
  Users, Package, ShoppingCart, DollarSign, LayoutDashboard, Activity, Settings,
  Circle, CircleDot, TrendingUp, Zap, Square, Trash2, RefreshCw, Plus, X,
  Check, AlertCircle, Sun, Moon, Wifi
} from 'lucide-react'
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

const Skeleton = ({ width = '100%', height = '20px', className = '' }: { width?: string; height?: string; className?: string }) => (
  <div className={`skeleton ${className}`} style={{ width, height }} />
)

const TableSkeleton = ({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) => (
  <table>
    <thead>
      <tr>{Array(cols).fill(0).map((_, i) => <th key={i}><Skeleton width="80%" height="14px" /></th>)}</tr>
    </thead>
    <tbody>
      {Array(rows).fill(0).map((_, r) => (
        <tr key={r}>{Array(cols).fill(0).map((_, c) => <td key={c}><Skeleton width={c === 0 ? '40px' : '70%'} height="16px" /></td>)}</tr>
      ))}
    </tbody>
  </table>
)

const GaugeChart = ({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) => {
  const percentage = Math.min((value / max) * 100, 100)
  const data = [{ value: percentage }, { value: 100 - percentage }]
  return (
    <div className="gauge-container">
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="70%"
            startAngle={180}
            endAngle={0}
            innerRadius={40}
            outerRadius={55}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="var(--border)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="gauge-label">
        <span className="gauge-value" style={{ color }}>{value.toFixed(1)}%</span>
        <span className="gauge-text">{label}</span>
      </div>
    </div>
  )
}

const aggregateOperations = (ops: Operation[], windowSize = 30) => {
  const recent = ops.slice(-windowSize * 10)
  const buckets: { time: number; INSERT: number; SELECT: number; UPDATE: number; count: { INSERT: number; SELECT: number; UPDATE: number } }[] = []
  
  for (let i = 0; i < windowSize; i++) {
    buckets.push({ time: i, INSERT: 0, SELECT: 0, UPDATE: 0, count: { INSERT: 0, SELECT: 0, UPDATE: 0 } })
  }
  
  const bucketSize = Math.max(1, Math.ceil(recent.length / windowSize))
  recent.forEach((op, i) => {
    const bucketIdx = Math.min(Math.floor(i / bucketSize), windowSize - 1)
    const type = op.type as 'INSERT' | 'SELECT' | 'UPDATE'
    if (buckets[bucketIdx] && type in buckets[bucketIdx].count) {
      buckets[bucketIdx][type] += op.duration
      buckets[bucketIdx].count[type]++
    }
  })
  
  return buckets.map(b => ({
    time: b.time,
    INSERT: b.count.INSERT ? Math.round(b.INSERT / b.count.INSERT) : null,
    SELECT: b.count.SELECT ? Math.round(b.SELECT / b.count.SELECT) : null,
    UPDATE: b.count.UPDATE ? Math.round(b.UPDATE / b.count.UPDATE) : null,
  }))
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'products' | 'orders' | 'monitor' | 'settings'>('dashboard')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved as 'dark' | 'light') || 'dark'
  })
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
  const [loadMode, setLoadMode] = useState<'light' | 'heavy' | 'ramp' | 'enterprise'>('light')
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

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

  const getOpsPerSec = useCallback((mode: 'light' | 'heavy' | 'ramp' | 'enterprise', rampLevel: number = 0) => {
    switch (mode) {
      case 'light': return 2
      case 'heavy': return 15
      case 'ramp': return [2, 5, 10, 20, 35, 50][Math.min(rampLevel, 5)]
      case 'enterprise': return 200
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

  const startLoad = (mode: 'light' | 'heavy' | 'ramp' | 'enterprise') => {
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

  const switchTab = (tab: 'dashboard' | 'customers' | 'products' | 'orders' | 'monitor' | 'settings') => {
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
          <span className="logo-text">E-Commerce on Snowflake</span>
        </div>
        <p className="subtitle">React on SPCS | Snowflake Postgres | Openflow CDC</p>
      </header>

      <nav>
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => switchTab('dashboard')}><LayoutDashboard size={16} /> Dashboard</button>
        <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => switchTab('customers')}><Users size={16} /> Customers</button>
        <button className={activeTab === 'products' ? 'active' : ''} onClick={() => switchTab('products')}><Package size={16} /> Products</button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => switchTab('orders')}><ShoppingCart size={16} /> Orders</button>
        <button className={activeTab === 'monitor' ? 'active' : ''} onClick={() => switchTab('monitor')}><Activity size={16} /> Monitor</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => switchTab('settings')}><Settings size={16} /> Settings</button>
      </nav>

      {error && <div className="error"><AlertCircle size={18} /> {error} <button onClick={() => setError(null)}><X size={18} /></button></div>}

      <main>
        {activeTab === 'dashboard' && (
          <div className="dashboard tab-content">
            <div className="stats-grid">
              <div className="stat-card">
                <h3><Users size={14} /> Customers</h3>
                <div className="stat-value">{(stats?.customer_count || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3><Package size={14} /> Products</h3>
                <div className="stat-value">{(stats?.product_count || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3><ShoppingCart size={14} /> Orders</h3>
                <div className="stat-value">{(stats?.order_count || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3><DollarSign size={14} /> Revenue</h3>
                <div className="stat-value">${Number(stats?.total_revenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </div>
            </div>

            <div className="traffic-simulator">
              <div className="simulator-header">
                <h2>Live User Traffic Simulator</h2>
                <div className="header-buttons">
                  <button className="clear-button" onClick={clearAllData} disabled={loading || isPlaying}>
                    <Trash2 size={16} /> Clear All
                  </button>
                  {isPlaying && (
                    <button className="stop-button" onClick={stopLoad}>
                      <Square size={14} /> Stop
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
                  <span className="preset-icon"><Circle size={24} /></span>
                  <span className="preset-label">Light</span>
                  <span className="preset-desc">2 ops/sec</span>
                </button>
                <button 
                  className={`preset-button heavy ${isPlaying && loadMode === 'heavy' ? 'active' : ''}`}
                  onClick={() => startLoad('heavy')}
                  disabled={isPlaying}
                >
                  <span className="preset-icon"><CircleDot size={24} /></span>
                  <span className="preset-label">Heavy</span>
                  <span className="preset-desc">15 ops/sec</span>
                </button>
                <button 
                  className={`preset-button ramp ${isPlaying && loadMode === 'ramp' ? 'active' : ''}`}
                  onClick={() => startLoad('ramp')}
                  disabled={isPlaying}
                >
                  <span className="preset-icon"><TrendingUp size={24} /></span>
                  <span className="preset-label">Ramp Up</span>
                  <span className="preset-desc">2→50 ops/sec</span>
                </button>
                <button 
                  className={`preset-button enterprise ${isPlaying && loadMode === 'enterprise' ? 'active' : ''}`}
                  onClick={() => startLoad('enterprise')}
                  disabled={isPlaying}
                >
                  <span className="preset-icon"><Zap size={24} /></span>
                  <span className="preset-label">Enterprise</span>
                  <span className="preset-desc">200 ops/sec</span>
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
                <h3>Operation Latency (ms) <span className="chart-hint">Rolling average</span></h3>
                <div className="chart-legend">
                  <span className="legend-item"><span className="dot insert"></span>INSERT</span>
                  <span className="legend-item"><span className="dot select"></span>SELECT</span>
                  <span className="legend-item"><span className="dot update"></span>UPDATE</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={aggregateOperations(operations)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientInsert" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradientSelect" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#29b5e8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#29b5e8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradientUpdate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="time" tick={false} stroke="var(--border)" />
                    <YAxis width={40} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} stroke="var(--border)" />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text)' }}
                      formatter={(value) => value != null ? [`${value}ms`] : ['—']}
                    />
                    <Area type="monotone" dataKey="INSERT" stroke="#34d399" strokeWidth={2} fill="url(#gradientInsert)" connectNulls />
                    <Area type="monotone" dataKey="SELECT" stroke="#29b5e8" strokeWidth={2} fill="url(#gradientSelect)" connectNulls />
                    <Area type="monotone" dataKey="UPDATE" stroke="#fbbf24" strokeWidth={2} fill="url(#gradientUpdate)" connectNulls />
                  </AreaChart>
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
                        {op.success ? <Check size={14} /> : <X size={14} />}
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
          <div className="section tab-content">
            <div className="section-header">
              <h2>Customers ({stats?.customer_count ?? customers.length})</h2>
              <button onClick={createCustomer} disabled={loading}><Plus size={16} /> Add Customer</button>
            </div>
            {loading && customers.length === 0 ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
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
                      <td><button className="delete" onClick={() => deleteCustomer(c.id)}><Trash2 size={14} /> Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="section tab-content">
            <div className="section-header">
              <h2>Products ({stats?.product_count ?? products.length})</h2>
              <button onClick={createProduct} disabled={loading}><Plus size={16} /> Add Product</button>
            </div>
            {loading && products.length === 0 ? (
              <TableSkeleton rows={5} cols={6} />
            ) : (
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
                      <td><button className="delete" onClick={() => deleteProduct(p.id)}><Trash2 size={14} /> Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="section tab-content">
            <div className="section-header">
              <h2>Orders ({stats?.order_count ?? orders.length})</h2>
              <button onClick={createOrder} disabled={loading}><Plus size={16} /> Create Order</button>
            </div>
            {loading && orders.length === 0 ? (
              <TableSkeleton rows={5} cols={6} />
            ) : (
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
            )}
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="monitor-dashboard tab-content">
            <div className="monitor-header">
              <h2>Database Health Monitor</h2>
              <button onClick={fetchMonitor} className="refresh-btn"><RefreshCw size={16} /> Refresh</button>
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
                    <GaugeChart 
                      value={Number(monitorData.database.cache_hit_ratio)} 
                      label="Buffer Cache" 
                      color={Number(monitorData.database.cache_hit_ratio) > 90 ? 'var(--success)' : 'var(--warning)'} 
                    />
                  </div>

                  <div className="monitor-card">
                    <h3>Pool Utilization</h3>
                    <GaugeChart 
                      value={((monitorData.pool.total - monitorData.pool.idle) / monitorData.pool.total) * 100} 
                      label="In Use" 
                      color={monitorData.pool.idle > 5 ? 'var(--success)' : 'var(--warning)'} 
                    />
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

        {activeTab === 'settings' && (
          <div className="settings-page tab-content">
            <div className="settings-header">
              <h2>Settings</h2>
            </div>
            
            <div className="settings-section">
              <h3>Appearance</h3>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Theme</span>
                  <span className="setting-desc">Choose between light and dark mode</span>
                </div>
                <div className="theme-toggle">
                  <button 
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={18} />
                    <span>Light</span>
                  </button>
                  <button 
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={18} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>Database Connection</h3>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Status</span>
                  <span className="setting-desc">Current connection to Snowflake Postgres</span>
                </div>
                <span className="connection-status connected"><Wifi size={14} /> Connected</span>
              </div>
            </div>
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
