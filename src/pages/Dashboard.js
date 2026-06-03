import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, Layers } from 'lucide-react'
import './pages.css'

const PERIODS = [
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '今年', value: 'this_year' },
  { label: '去年', value: 'last_year' },
  { label: '全部', value: 'all' },
  { label: '自定义', value: 'custom' },
]

function getPeriodRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (period === 'this_month') return [new Date(y, m, 1), new Date(y, m+1, 0, 23, 59, 59)]
  if (period === 'last_month') return [new Date(y, m-1, 1), new Date(y, m, 0, 23, 59, 59)]
  if (period === 'this_year') return [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59)]
  if (period === 'last_year') return [new Date(y-1, 0, 1), new Date(y-1, 11, 31, 23, 59, 59)]
  return [null, null]
}

function fmt(n) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return (n >= 0 ? '+$' : '-$') + abs
}

function inRange(dateStr, start, end) {
  if (!start && !end) return true
  const d = new Date(dateStr + 'T12:00:00')
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}

export default function Dashboard({ navigate }) {
  const [period, setPeriod] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [allSales, setAllSales] = useState([])
  const [allCards, setAllCards] = useState([])
  const [allTxns, setAllTxns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: sales } = await supabase.from('card_sales').select('*, cards(actual_cost, name)')
      const { data: cards } = await supabase.from('cards').select('*')
      const { data: txns } = await supabase.from('transactions').select('*, transaction_legs(*, cards(name))').order('date', { ascending: false })
      setAllSales(sales || [])
      setAllCards(cards || [])
      setAllTxns(txns || [])
      setLoading(false)
    }
    load()
  }, [])

  const getRange = () => {
    if (period === 'custom') {
      return [customStart ? new Date(customStart) : null, customEnd ? new Date(customEnd) : null]
    }
    return getPeriodRange(period)
  }

  const [start, end] = getRange()

  // 筛选后的数据
  const filteredSales = allSales.filter(s => inRange(s.sale_date, start, end))
  const filteredTxns = allTxns.filter(t => inRange(t.date, start, end))

  // 统计
  const cashIn = filteredTxns.filter(t => t.type === 'buy').reduce((s, t) => {
    return s + (t.transaction_legs || []).filter(l => l.direction === 'in').reduce((a, l) => a + (l.cash_amount || 0), 0)
  }, 0) + filteredTxns.filter(t => t.type === 'trade').reduce((s, t) => {
    return s + (t.transaction_legs || []).filter(l => l.direction === 'out' && !l.card_id).reduce((a, l) => a + (l.cash_amount || 0), 0)
  }, 0)

  const realized = filteredSales.reduce((s, r) => s + (r.sale_price - (r.cards?.actual_cost || 0)), 0)
  const cashOut = filteredSales.reduce((s, r) => s + r.sale_price, 0)
    + filteredTxns.filter(t => t.type === 'trade').reduce((s, t) => {
      return s + (t.transaction_legs || []).filter(l => l.direction === 'in' && !l.card_id).reduce((a, l) => a + (l.cash_amount || 0), 0)
    }, 0)
  const holdings = allCards.filter(c => c.status === 'holding').length
  const holdingCost = allCards.filter(c => c.status === 'holding').reduce((s, c) => s + (c.actual_cost || 0), 0)
  const trades = filteredTxns.filter(t => t.type === 'trade').length

  // 月度图表（全部时间或年度时显示）
  const monthMap = {}
  allSales.forEach(s => {
    const m = s.sale_date?.slice(0, 7)
    if (!m) return
    if (!monthMap[m]) monthMap[m] = 0
    monthMap[m] += s.sale_price - (s.cards?.actual_cost || 0)
  })
  const monthly = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
  const maxAbs = Math.max(...monthly.map(([, v]) => Math.abs(v)), 1)

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">总览你的球星卡交易数据</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button key={p.value} className={`tab-btn ${period === p.value ? 'active' : ''}`} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>从</span>
          <input type="date" min="2000-01-01" max="2099-12-31" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ width: 150 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>到</span>
          <input type="date" min="2000-01-01" max="2099-12-31" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ width: 150 }} />
        </div>
      )}

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>
            {period === 'all' ? '历史总 Cash 投入' : '期间 Cash 投入'}
          </div>
          <div className="metric-value">${cashIn.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>
            {period === 'all' ? '当前持仓成本' : '期间 Cash 回收'}
          </div>
          <div className={`metric-value ${period === 'all' ? (holdingCost < 0 ? 'pos' : '') : 'pos'}`}>
            ${period === 'all' ? holdingCost.toLocaleString() : cashOut.toLocaleString()}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>已实现盈亏</div>
          <div className={`metric-value ${realized >= 0 ? 'pos' : 'neg'}`}>
            {realized >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {fmt(realized)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>当前持仓</div>
          <div className="metric-value accent"><Layers size={18} /> {holdings} 张</div>
        </div>
        <div className="metric-card">
          <div className="metric-label" style={{ color: 'var(--text2)' }}>
            {period === 'all' ? '净投入 Cash' : '期间净投入 Cash'}
          </div>
          <div className={`metric-value ${cashIn - cashOut >= 0 ? '' : 'pos'}`}>
            {cashIn - cashOut >= 0 ? '-' : '+'}${Math.abs(cashIn - cashOut).toLocaleString()}
          </div>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="section-card">
          <div className="section-title">月度已实现盈亏（近6个月）</div>
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
          <div className="section-title">
            {period === 'all' ? '最近交易' : `${PERIODS.find(p=>p.value===period)?.label || ''}交易记录`}
          </div>
          <button className="link-btn" onClick={() => navigate('history')}>查看全部 →</button>
        </div>
        {filteredTxns.length === 0 ? (
          <div className="empty-state">该时间段内暂无交易记录</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ color: 'var(--text2)' }}>日期</th>
                <th style={{ color: 'var(--text2)' }}>卡牌 / 交易内容</th>
                <th style={{ color: 'var(--text2)' }}>类型</th>
                <th style={{ color: 'var(--text2)' }}>盈亏 / 状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.slice(0, 8).map(t => {
                const sale = filteredSales.find(s => s.transaction_id === t.id)
                const pnl = sale ? sale.sale_price - (sale.cards?.actual_cost || 0) : null
                return (
                  <tr key={t.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{t.date.slice(5)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text)' }}>
                      {(() => {
                        const legs = t.transaction_legs || []
                        if (t.type === 'buy') {
                          const inLegs = legs.filter(l => l.direction === 'in' && l.card_id)
                          return inLegs.map(l => l.cards?.name).filter(Boolean).join('、') || '—'
                        }
                        if (t.type === 'sell') {
                          const outLegs = legs.filter(l => l.direction === 'out' && l.card_id)
                          return outLegs.map(l => l.cards?.name).filter(Boolean).join('、') || '—'
                        }
                        if (t.type === 'trade') {
                          const outCards = legs.filter(l => l.direction === 'out' && l.card_id).map(l => l.cards?.name).filter(Boolean)
                          const inCards = legs.filter(l => l.direction === 'in' && l.card_id).map(l => l.cards?.name).filter(Boolean)
                          return <span>{outCards.join('、') || '—'} <span style={{color:'var(--text3)'}}>⇄</span> {inCards.join('、') || '—'}</span>
                        }
                        return '—'
                      })()}
                    </td>
                    <td>
                      {t.type === 'buy' && <span className="badge" style={{ color: '#facc15', background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.3)' }}>买入</span>}
                      {t.type === 'sell' && <span className="badge badge-sell">卖出</span>}
                      {t.type === 'trade' && <span className="badge badge-trade">Trade</span>}
                    </td>
                    <td>
                      {t.type === 'sell' && pnl != null && <span className={pnl >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 600 }}>{fmt(pnl)}</span>}
                      {t.type === 'sell' && pnl == null && <span style={{ color: 'var(--text3)' }}>—</span>}
                      {t.type === 'buy' && (() => {
                        const inCards = (t.transaction_legs||[]).filter(l => l.direction === 'in' && l.card_id)
                        const allGone = inCards.length > 0 && inCards.every(l => {
                          return allSales.some(s => s.card_id === l.card_id) ||
                            allTxns.some(tx => (tx.transaction_legs||[]).some(tl => tl.direction === 'out' && tl.card_id === l.card_id))
                        })
                        const anyTraded = inCards.some(l => allTxns.some(tx => (tx.transaction_legs||[]).some(tl => tl.direction === 'out' && tl.card_id === l.card_id)))
                        const anySold = inCards.some(l => allSales.some(s => s.card_id === l.card_id))
                        if (!allGone) return <span className="badge" style={{ color: '#facc15', background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.3)', whiteSpace: 'nowrap' }}>未出售</span>
                        if (anySold && !anyTraded) return <span className="badge badge-settled" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已出售</span>
                        if (anyTraded && !anySold) return <span className="badge" style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', whiteSpace: 'nowrap' }}>Trade Out</span>
                        return <span className="badge" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已处置</span>
                      })()}
                      {t.type === 'trade' && (() => {
                        const inCards = (t.transaction_legs||[]).filter(l => l.direction === 'in' && l.card_id)
                        const allSoldOut = inCards.length > 0 && inCards.every(l => allSales.some(s => s.card_id === l.card_id))
                        return allSoldOut
                          ? <span className="badge badge-settled" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已完结</span>
                          : <span className="badge" style={{ color: '#fff', background: 'var(--red)', border: 'none', whiteSpace: 'nowrap' }}>进行中</span>
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}