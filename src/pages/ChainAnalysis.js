import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, GitBranch } from 'lucide-react'
import './pages.css'

const fmt = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n).toLocaleString()
  return (n >= 0 ? '+$' : '-$') + abs
}

function ChainNode({ cardId, cardName, depth = 0, allSales, allTxns, visited = [] }) {
  const [expanded, setExpanded] = useState({})

  if (visited.includes(cardId)) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 16, marginTop: 4 }}>
        （已在链条中出现，不再展开）
      </div>
    )
  }

  const newVisited = [...visited, cardId]

  const allLegs = allTxns.flatMap(t => (t.transaction_legs || []).map(l => ({ ...l, txn: t })))

  const inLeg = allLegs.find(l => l.card_id === cardId && l.direction === 'in')
  const outLeg = allLegs.find(l => l.card_id === cardId && l.direction === 'out')
  const sale = allSales.find(s => s.card_id === cardId)

  const inTxn = inLeg?.txn
  const inTxnLegs = inTxn ? (inTxn.transaction_legs || []) : []
  const inTxnOutCards = inTxnLegs.filter(l => l.direction === 'out' && l.card_id)
  const inTxnOutCash = inTxnLegs.filter(l => l.direction === 'out' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
  const inTxnInCash = inTxnLegs.filter(l => l.direction === 'in' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)

  const outTxn = outLeg?.txn
  const outTxnLegs = outTxn ? (outTxn.transaction_legs || []) : []
  const outTxnInCards = outTxnLegs.filter(l => l.direction === 'in' && l.card_id)
  const outTxnInCash = outTxnLegs.filter(l => l.direction === 'in' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)

  const isSold = !!sale
  const isTraded = !!outLeg && outTxn?.type === 'trade'
  const isCashBuy = inTxn?.type === 'buy'

  return (
    <div style={{ marginLeft: depth * 20, borderLeft: depth > 0 ? '2px solid var(--border)' : 'none', paddingLeft: depth > 0 ? 16 : 0, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <GitBranch size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{cardName}</span>
        <span className={`badge ${isSold ? 'badge-sell' : isTraded ? 'badge-trade' : 'badge-pending'}`} style={{ fontSize: 10 }}>
          {isSold ? '已售出' : isTraded ? '已Trade Out' : '持有中'}
        </span>
      </div>

      {inTxn && (
        <div style={{ marginBottom: 4 }}>
          {isCashBuy ? (
            <div className="chain-step">
              <ArrowDownLeft size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text3)' }}>{inTxn.date}</span>
                {' '}现金买入，花费 <b>${inLeg?.cash_amount?.toLocaleString()}</b>
              </div>
            </div>
          ) : (
            <div>
              <div className="chain-step">
                <ArrowDownLeft size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>{inTxn.date}</span>
                  {' '}Trade 得到，agreed value <b>${inLeg?.agreed_value?.toLocaleString() || '—'}</b>
                  {inTxnInCash > 0 && <span style={{ color: 'var(--text3)' }}>（对方补 Cash ${inTxnInCash.toLocaleString()}）</span>}
                  {inTxnOutCash > 0 && <span style={{ color: 'var(--text3)' }}>（你补 Cash ${inTxnOutCash.toLocaleString()}）</span>}
                </div>
              </div>
              {inTxnOutCards.length > 0 && (
                <div style={{ marginLeft: 20, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>付出的卡：</div>
                  {inTxnOutCards.map(l => (
                    <div key={l.id} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>• {l.cards?.name || '—'}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>成本 ${l.cards?.actual_cost?.toLocaleString()}</span>
                        {!newVisited.includes(l.card_id) && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [l.card_id]: !p[l.card_id] }))}
                            style={{ background: 'none', color: 'var(--accent)', fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                          >
                            {expanded[l.card_id] ? '收起' : '继续追溯'}
                            {expanded[l.card_id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                        )}
                        {newVisited.includes(l.card_id) && <span style={{ fontSize: 11, color: 'var(--text3)' }}>（已展示）</span>}
                      </div>
                      {expanded[l.card_id] && (
                        <ChainNode cardId={l.card_id} cardName={l.cards?.name} depth={depth + 1} allSales={allSales} allTxns={allTxns} visited={newVisited} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isSold && (
        <div className="chain-step">
          <ArrowUpRight size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text3)' }}>{sale.sale_date}</span>
            {' '}卖出，售价 <b>${sale.sale_price?.toLocaleString()}</b>
            ，盈亏 <b className={sale.sale_price - (sale.cards?.actual_cost || 0) >= 0 ? 'pos' : 'neg'}>
              {fmt(sale.sale_price - (sale.cards?.actual_cost || 0))}
            </b>
          </div>
        </div>
      )}

      {isTraded && !isSold && (
        <div>
          <div className="chain-step">
            <ArrowUpRight size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text3)' }}>{outTxn.date}</span>
              {' '}Trade Out，agreed value <b>${outLeg?.cards?.agreed_value?.toLocaleString() || '—'}</b>
              {outTxnInCash > 0 && <span style={{ color: 'var(--text3)' }}>，收到 Cash ${outTxnInCash.toLocaleString()}</span>}
            </div>
          </div>
          {outTxnInCards.length > 0 && (
            <div style={{ marginLeft: 20, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>换来的卡：</div>
              {outTxnInCards.map(l => (
                <div key={l.id} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>• {l.cards?.name || '—'}</span>
                    {!newVisited.includes(l.card_id) && (
                      <button
                        onClick={() => setExpanded(p => ({ ...p, [l.card_id]: !p[l.card_id] }))}
                        style={{ background: 'none', color: 'var(--accent)', fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        {expanded[l.card_id] ? '收起' : '查看去向'}
                        {expanded[l.card_id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    )}
                    {newVisited.includes(l.card_id) && <span style={{ fontSize: 11, color: 'var(--text3)' }}>（已展示）</span>}
                  </div>
                  {expanded[l.card_id] && (
                    <ChainNode cardId={l.card_id} cardName={l.cards?.name} depth={depth + 1} allSales={allSales} allTxns={allTxns} visited={newVisited} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isSold && !isTraded && (
        <div className="chain-step">
          <span style={{ width: 13, flexShrink: 0 }}>📦</span>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>目前持有中</div>
        </div>
      )}
    </div>
  )
}

export default function ChainAnalysis() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [allSales, setAllSales] = useState([])
  const [allTxns, setAllTxns] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (val) => {
    if (!val.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('cards').select('*').ilike('name', `%${val}%`).order('created_at', { ascending: false })
    setResults(data || [])
    setSearching(false)
  }

  const handleSelect = async (card) => {
    setSelected(card)
    setResults([])
    setQuery(card.name)
    setLoading(true)
    const { data: sales } = await supabase.from('card_sales').select('*, cards(actual_cost, name)')
    const { data: txns } = await supabase.from('transactions').select('*, transaction_legs(*, cards(name, actual_cost, agreed_value, source_type))').order('date', { ascending: true })
    setAllSales(sales || [])
    setAllTxns(txns || [])
    setLoading(false)
  }

  const getCashSummary = () => {
    if (!selected || !allTxns.length) return null
    const allLegs = allTxns.flatMap(t => (t.transaction_legs || []).map(l => ({ ...l, txn: t })))
    const inLeg = allLegs.find(l => l.card_id === selected.id && l.direction === 'in')
    const sale = allSales.find(s => s.card_id === selected.id)
    const cashPaid = selected.actual_cost || 0
    const cashReceived = sale ? sale.sale_price : 0
    return { cashPaid, cashReceived, net: cashReceived - cashPaid, settled: !!sale }
  }

  const summary = getCashSummary()

  return (
    <div className="page">
      <div className="page-header">
        <h1>链条分析</h1>
        <p className="page-sub">追踪一张卡从买入到卖出的完整 Cash 流</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 500 }}>
        <div className="picker-search" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
          <Search size={15} />
          <input
            placeholder="搜索卡牌名称..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); handleSearch(e.target.value) }}
            style={{ flex: 1 }}
          />
          {searching && <span style={{ fontSize: 11, color: 'var(--text3)' }}>搜索中...</span>}
        </div>
        {results.length > 0 && (
          <div className="picker-list" style={{ zIndex: 50 }}>
            {results.map(card => (
              <div key={card.id} className="picker-item" onClick={() => handleSelect(card)}>
                <span>{card.name}</span>
                <span className={`badge ${card.status === 'holding' ? 'badge-pending' : 'badge-sell'}`} style={{ fontSize: 10 }}>
                  {card.status === 'holding' ? '持有中' : '已售出'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="loading">加载链条数据...</div>}

      {selected && !loading && (
        <>
          {summary && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="metric-label">直接成本</div>
                <div className="metric-value">${summary.cashPaid.toLocaleString()}</div>
              </div>
              <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="metric-label">Cash 回收</div>
                <div className={`metric-value ${summary.cashReceived > 0 ? 'pos' : ''}`}>
                  {summary.cashReceived > 0 ? '$' + summary.cashReceived.toLocaleString() : '未出售'}
                </div>
              </div>
              <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="metric-label">净盈亏（直接成本）</div>
                <div className={`metric-value ${summary.net >= 0 ? 'pos' : 'neg'}`}>
                  {summary.settled ? fmt(summary.net) : '未结算'}
                </div>
              </div>
            </div>
          )}

          <div className="section-card">
            <div className="section-title">完整链条</div>
            <ChainNode
              cardId={selected.id}
              cardName={selected.name}
              depth={0}
              allSales={allSales}
              allTxns={allTxns}
              visited={[]}
            />
          </div>
        </>
      )}
    </div>
  )
}
