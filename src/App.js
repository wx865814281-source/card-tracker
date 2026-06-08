import React, { useState } from 'react'
import { LayoutDashboard, Layers, History, Plus, FileSpreadsheet, Menu, X, GitBranch } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Holdings from './pages/Holdings'
import TransactionHistory from './pages/TransactionHistory'
import AddTransaction from './pages/AddTransaction'
import ChainAnalysis from './pages/ChainAnalysis'
import './App.css'

const NAV = [
  { id: 'dashboard', label: ' Dashboard', icon: LayoutDashboard },
  { id: 'holdings', label: '持仓卡牌', icon: Layers },
  { id: 'history', label: '交易历史', icon: History },
  { id: 'add', label: '新增交易', icon: Plus },
  { id: 'chain', label: '链条分析', icon: GitBranch },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [language, setLanguage] = useState('zh')

  const navigate = (p) => { setPage(p); setMenuOpen(false) }
  const onSaved = () => { setRefresh(r => r + 1); setPage('history') }

  const pages = { dashboard: Dashboard, holdings: Holdings, history: TransactionHistory, add: AddTransaction, chain: ChainAnalysis }
  const PageComponent = pages[page]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="logo-icon">♦</span>
            <span>Card Tracker</span>
          </div>
          <button
            onClick={() => setLanguage(l => l === 'zh' ? 'en' : 'zh')}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            {language === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        <nav>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-btn ${page === id ? 'active' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <button className="nav-btn export-btn" onClick={() => alert('导出功能即将上线')}>
          <FileSpreadsheet size={16} />
          <span>导出数据</span>
        </button>
      </aside>

      <div className="mobile-header">
        <div className="sidebar-logo" style={{ padding: 0 }}>
          <span className="logo-icon">♦</span>
          <span>Card Tracker</span>
        </div>
        <button className="menu-toggle" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}

      <main className="main-content">
        <PageComponent key={page === 'dashboard' || page === 'holdings' || page === 'history' ? refresh : undefined} onSaved={onSaved} navigate={navigate} language={language} />
      </main>
    </div>
  )
}
