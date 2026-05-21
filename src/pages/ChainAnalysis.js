import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, GitBranch } from 'lucide-react'
import './pages.css'

const key_headers = {}

const fmt = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n).toLocaleString()
  return (n >= 0 ? '+$' : '-$') + abs
}

// 递归追溯一张卡的完整链条节点
function ChainNode({ cardId, cardName, depth = 0, allSales, allTxns, visitedIds = new Set() }) {
  if (visitedIds.has(cardId)) return <div style={{ fontSize: 12, color: 'var(--text3)', marginLeft: depth * 20, paddingLeft: 16 }}>（已在链条中出现，不再展开）</div>
  const newVisited = new Set(visitedIds)
  newVisited.add(cardId)
  const [expanded, setExpanded] = useState(depth === 0)
  const [parentExpanded, setParentExpanded] = useState({})

  // 找这张卡的买入/trade-in transaction
  const inLeg = allTxns
    .flatMap(t => (t.transaction_legs || []).map(l => ({ ...l, txn: t })))
    .find(l => l.card_id === cardId && l.direction === 'in')

  // 找这张卡的卖出/trade-out transaction
  const outLeg = allTxns
    .flatMap(t => (t.transaction_legs || []).map(l => ({ ...l, txn: t })))
    .find(l => l.card_id === cardId && l.direction === 'out')

  const sale = allSales.find(s => s.card_id === cardId)

  // 同笔 in transaction 的所有 out legs（付出了什么）
  const inTxn = inLeg?.txn
  const inTxnOutLegs = inTxn
    ? (inTxn.transaction_legs || []).filter(l => l.direction === 'out')
    : []
  const inTxnOutCash = inTxnOutLegs.filter(l => !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
  const inTxnOutCards = inTxnOutLegs.filter(l => l.card_id)

  // 同笔 out transaction 的所有 in legs（换来了什么）
  const outTxn = outLeg?.txn
  const outTxnInLegs = outTxn
    ? (outTxn.transaction_legs || []).filter(l => l.direction === 'in')
    : []
  const outTxnInCash = outTxnInLegs.filter(l => !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
  const outTxnInCards = outTxnInLegs.filter(l => l.card_id)

  const isSold = !!sale
  const isTraded = !!outLeg && outLeg.txn?.type === 'trade'
  const isCashBuy = inTxn?.type === 'buy'

  return (
    <div style={{ marginLeft: depth * 20, borderLeft: depth > 0 ? '2px solid var(--border)' : 'none', paddingLeft: depth > 0 ? 16 : 0, marginTop: 8 }}>
      {/* 卡牌标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <GitBranch size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{cardName}</span>
        <span className={`badge ${isSold ? 'badge-sell' : 'badge-pending'}`} style={{ fontSize: 10 }}>
          {isSold ? '已售出' : isTraded ? '已Trade Out' : '持有中'}
        </span>
      </div>

      {/* 买入/来源 */}
      {inTxn && (
        <div style={{ marginBottom: 4 }}>
          {isCashBuy ? (
            <div className="chain-step">
              <ArrowDownLeft size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text3)' }}>{inTxn.date}</span>
                {' '}现金买入，花费{' '}
                <b>${inLeg?.cash_amount?.toLocaleString()}</b>
              </div>
            </div>
          ) : (
            <div>
              <div className="chain-step">
                <ArrowDownLeft size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>{inTxn.date}</span>
                  {' '}Trade 得到，agreed value{' '}
                  <b>${inLeg?.agreed_value?.toLocaleString() || '—'}</b>
                  {inTxnOutCash > 0 && <span style={{ color: 'var(--text3)' }}>（对方补 Cash ${inTxnOutCash.toLocaleString()}）</span>}
                  {inTxnOutCash < 0 && <span style={{ color: 'var(--text3)' }}>（你补 Cash ${Math.abs(inTxnOutCash).toLocaleString()}）</span>}
                </div>
              </div>
              {/* 付出的卡 */}
              {inTxnOutCards.length > 0 && (
                <div style={{ marginLeft: 20, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>付出的卡：</div>
                  {inTxnOutCards.map(l => (
                    <div key={l.id} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>• {l.cards?.name || '—'}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>成本 ${l.cards?.actual_cost?.toLocaleString()}</span>
                        {l.cards?.source_type === 'trade' && (
                          <button
                            onClick={() => setParentExpanded(p => ({ ...p, [l.card_id]: !p[l.card_id] }))}
                            style={{ background: 'none', color: 'var(--accent)', fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}
                          >
                            {parentExpanded[l.card_id] ? '收起' : '继续追溯'}
                            {parentExpanded[l.card_id] ? <ChevronUp size={10} style={{ marginLeft: 2 }} /> : <ChevronDown size={10} style={{ marginLeft: 2 }} />}
                          </button>
                        )}
                        {l.cards?.source_type === 'cash' && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>（现金购入）</span>
                        )}
                      </div>
                      {parentExpanded[l.card_id] && (
                        <ChainNode
                          cardId={l.card_id}
                          cardName={l.cards?.name}
                          depth={depth + 1}
                          allSales={allSales}
                          allTxns={allTxns}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 卖出/去向 */}
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
                    <button
                      onClick={() => setParentExpanded(p => ({ ...p, [l.card_id]: !p[l.card_id] }))}
                      style={{ background: 'none', color: 'var(--accent)', fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}
                    >
                      {parentExpanded[l.card_id] ? '收起' : '查看去向'}
                      {parentExpanded[l.card_id] ? <ChevronUp size={10} style={{ marginLeft: 2 }} /> : <ChevronDown size={10} style={{ marginLeft: 2 }} />}
                    </button>
                  </div>
                  {parentExpanded[l.card_id] && (
                    <ChainNode
                      cardId={l.card_id}
                      cardName={l.cards?.name}
                      depth={depth + 1}
                      allSales={allSales}
                      allTxns={allTxns}
                      visitedIds={newVisited}
                    />
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

  const handleSearch = async (q) => {
    const val = q !== undefined ? q : query
    if (!val.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('cards')
      .select('*')
      .ilike('name', `%${val}%`)
      .order('created_at', { ascending: false })
    setResults(data || [])
    setSearching(false)
  }

  const handleSelect = async (card) => {
    setSelected(card)
    setResults([])
    setQuery(card.name)
    setLoading(true)
    const { data: sales } = await supabase
      .from('card_sales')
      .select('*, cards(actual_cost, name)')
    const { data: txns } = await supabase
      .from('transactions')
      .select('*, transaction_legs(*, cards(name, actual_cost, agreed_value, source_type))')
      .order('date', { ascending: true })
    setAllSales(sales || [])
    setAllTxns(txns || [])
    setLoading(false)
  }

  // 计算这张卡的直接 cash 流汇总
  const getCashSummary = () => {
    if (!selected || !allTxns.length) return null
    const inLeg = allTxns
      .flatMap(t => (t.transaction_legs || []).map(l => ({ ...l, txn: t })))
      .find(l => l.card_id === selected.id && l.direction === 'in')
    const sale = allSales.find(s => s.card_id === selected.id)
    const cashPaid = inLeg?.txn?.type === 'buy' ? (inLeg.cash_amount || 0) : (selected.actual_cost || 0)
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

      {/* 搜索框 */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 500 }}>
        <div className="picker-search" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
          <Search size={15} />
          <input
            placeholder="搜索卡牌名称..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); handleSearch(e.target.value) }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <button
            onClick={handleSearch}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {searching ? '搜索中...' : '搜索'}
          </button>
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
          {/* Cash 汇总 */}
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
                <div className="metric-label">净盈亏（直接）</div>
                <div className={`metric-value ${summary.net >= 0 ? 'pos' : 'neg'}`}>
                  {summary.settled ? fmt(summary.net) : '未结算'}
                </div>
              </div>
            </div>
          )}

          {/* 链条详情 */}
          <div className="section-card">
            <div className="section-title">完整链条</div>
            <ChainNode
              cardId={selected.id}
              cardName={selected.name}
              depth={0}
              allSales={allSales}
              allTxns={allTxns}
            />
          </div>
        </>
      )}
    </div>
  )
}
