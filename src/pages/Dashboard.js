import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, Layers, ArrowRightLeft } from 'lucide-react'
import './pages.css'

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState({ totalCashIn: 0, holdingCost: 0, realized: 0, holdings: 0, trades: 0 })
  const [recent, setRecent] = useState([])
  const [monthly, setMonthly] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: sales } = await supabase.from('card_sales').select('*, cards(actual_cost, name)')
      const { data: cards } = await supabase.from('cards').select('*')
      const { data: txns } = await supabase.from('transactions').select('*, transaction_legs(*)').order('date', { ascending: false })

      // 历史总现金投入 = 所有buy交易的cash + 所有trade中付出的cash
      const buyTxns = (txns || []).filter(t => t.type === 'buy')
      const tradeTxns = (txns || []).filter(t => t.type === 'trade')
      const totalCashIn = buyTxns.reduce((s, t) => {
        const inLegs = (t.transaction_legs || []).filter(l => l.direction === 'in')
        return s + inLegs.reduce((a, l) => a + (l.cash_amount || 0), 0)
      }, 0) + tradeTxns.reduce((s, t) => {
        const outCashLegs = (t.transaction_legs || []).filter(l => l.direction === 'out' && !l.card_id)
        return s + outCashLegs.reduce((a, l) => a + (l.cash_amount || 0), 0)
      }, 0)

      // 当前持仓成本 = 持有中的卡的actual_cost之和
      const holdingCost = (cards || []).filter(c => c.status === 'holding').reduce((s, c) => s + (c.actual_cost || 0), 0)

      // 已实现盈亏
      const realized = (sales || []).reduce((s, r) => s + (r.sale_price - (r.cards?.actual_cost || 0)), 0)
      const holdings = (cards || []).filter(c => c.status === 'holding').length
      const trades = (txns || []).filter(t => t.type === 'trade').length

      setStats({ totalCashIn, holdingCost, realized, holdings, trades })

      const recentTxns = (txns || []).slice(0, 5).map(t => {
        const saleForTxn = (sales || []).find(s => s.transaction_id === t.id)
        let pnl = null
        if (saleForTxn) pnl = saleForTxn.sale_price - (saleForTxn.cards?.actual_cost || 0)
        return { ...t, pnl }
      })
      setRecent(recentTxns)

      const monthMap = {}
      ;(sales || []).forEach(s => {
        const m = s.sale_date?.slice(0, 7)
        if (!m) return
        if (!monthMap[m]) monthMap[m] = 0
        monthMap[m] += s.sale_price - (s.cards?.actual_cost || 0)
      })
      const sorted = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      setMonthly(sorted)
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n) => {
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return (n >= 0 ? '+$' : '-$') + abs
  }

  const maxAbs = Math.max(...monthly.map(([, v]) => Math.abs(v)), 1)
  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-sub">总览你的球星卡交易数据</p>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>历史总 Cash 投入</div>
          <div className="metric-value">${stats.totalCashIn.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>当前持仓成本</div>
          <div className={`metric-value ${stats.holdingCost < 0 ? 'pos' : ''}`}>${stats.holdingCost.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>已实现盈亏</div>
          <div className={`metric-value ${stats.realized >= 0 ? 'pos' : 'neg'}`}>
            {stats.realized >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {fmt(stats.realized)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>当前持仓</div>
          <div className="metric-value accent"><Layers size={18} /> {stats.holdings} 张</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>Trade 次数</div>
          <div className="metric-value purple"><ArrowRightLeft size={18} /> {stats.trades} 次</div>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="section-card">
          <div className="section-title">月度已实现盈亏</div>
          <div className="bar-chart">
            {monthly.map(([month, val]) => (
              <div key={month} className="bar-col">
                <div className="bar-label-val" style={{ color: val >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {val >= 0 ? '+' : ''}{Math.round(val)}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${Math.abs(val) / maxAbs * 100}%`, background: val >= 0 ? 'var(--green)' : 'var(--red)', alignSelf: 'flex-end' }} />
                </div>
                <div className="bar-month">{month.slice(5)}月</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="section-title-row">
          <div className="section-title">最近交易</div>
          <button className="link-btn" onClick={() => navigate('history')}>查看全部 →</button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">暂无交易记录，<button className="link-btn" onClick={() => navigate('add')}>添加第一笔</button></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th style={{ color: 'var(--text2)' }}>日期</th><th style={{ color: 'var(--text2)' }}>备注</th><th style={{ color: 'var(--text2)' }}>类型</th><th style={{ color: 'var(--text2)' }}>盈亏</th></tr>
            </thead>
            <tbody>
              {recent.map(t => (
                <tr key={t.id}>
                  <td className="mono">{t.date}</td>
                  <td>{t.notes || '—'}</td>
                  <td><span className={`badge badge-${t.type}`}>{t.type === 'buy' ? '买入' : t.type === 'sell' ? '卖出' : 'Trade'}</span></td>
                  <td className={t.pnl != null ? (t.pnl >= 0 ? 'pos' : 'neg') : ''}>{t.pnl != null ? fmt(t.pnl) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}