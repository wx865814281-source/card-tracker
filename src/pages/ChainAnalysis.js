import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, GitBranch } from 'lucide-react'
import { lang } from '../lib/i18n'
import './pages.css'

const fmt = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n).toLocaleString()
  return (n >= 0 ? '+$' : '-$') + abs
}

function ChainNode({ cardId, cardName, depth = 0, allSales, allTxns, visited = [], language = 'zh' }) {
  const T = (key) => lang(key, language)
  const [expanded, setExpanded] = useState({})

  if (visited.includes(cardId)) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 16, marginTop: 4 }}>
        {T('alreadyInChain')}
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
          {isSold ? T('soldOut') : isTraded ? T('tradedOut') : T('holding')}
        </span>
      </div>

      {inTxn && (
        <div style={{ marginBottom: 4 }}>
          {isCashBuy ? (
            <div className="chain-step">
              <ArrowDownLeft size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text3)' }}>{inTxn.date}</span>
                {' '}{T('cashBuyChain2')} <b>${inLeg?.cash_amount?.toLocaleString()}</b>
              </div>
            </div>
          ) : (
            <div>
              <div className="chain-step">
                <ArrowDownLeft size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>{inTxn.date}</span>
                  {' '}{T('tradeReceived2')} <b>${inLeg?.agreed_value?.toLocaleString() || '—'}</b>
                  {inTxnInCash > 0 && <span style={{ color: 'var(--text3)' }}>（{T('otherAddedCash')} ${inTxnInCash.toLocaleString()}）</span>}
                  {inTxnOutCash > 0 && <span style={{ color: 'var(--text3)' }}>（{T('youAddedCash')} ${inTxnOutCash.toLocaleString()}）</span>}
                </div>
              </div>
              {inTxnOutCards.length > 0 && (
                <div style={{ marginLeft: 20, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{T('cardGiven')}</div>
                  {inTxnOutCards.map(l => (
                    <div key={l.id} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>• {l.cards?.name || '—'}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>{T('actualCost')} ${l.cards?.actual_cost?.toLocaleString()}</span>
                        {!newVisited.includes(l.card_id) && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [l.card_id]: !p[l.card_id] }))}
                            style={{ background: 'none', color: 'var(--accent)', fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                          >
                            {expanded[l.card_id] ? T('collapse') : T('traceBack')}
                            {expanded[l.card_id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                        )}
                        {newVisited.includes(l.card_id) && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{T('alreadyShown')}</span>}
                      </div>
                      {expanded[l.card_id] && (
                        <ChainNode cardId={l.card_id} cardName={l.cards?.name} depth={depth + 1} allSales={allSales} allTxns={allTxns} visited={newVisited} language={language} />
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
            {' '}{T('soldFor')} <b>${sale.sale_price?.toLocaleString()}</b>
            ，{T('pnlLabel')} <b className={sale.sale_price - (sale.cards?.actual_cost || 0) >= 0 ? 'pos' : 'neg'}>
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
              {' '}{T('tradeOutFor')} <b>${outLeg?.cards?.agreed_value?.toLocaleString() || '—'}</b>
              {outTxnInCash > 0 && <span style={{ color: 'var(--text3)' }}>，{T('receivedCash')} ${outTxnInCash.toLocaleString()}</span>}
            </div>
          </div>
          {outTxnInCards.length > 0 && (
            <div style={{ marginLeft: 20, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{T('cardReceived2')}</div>
              {outTxnInCards.map(l => (
                <div key={l.id} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>• {l.cards?.name || '—'}</span>
                    {!newVisited.includes(l.card_id) && (
                      <button
                        onClick={() => setExpanded(p => ({ ...p, [l.card_id]: !p[l.card_id] }))}
                        style={{ background: 'none', color: 'var(--accent)', fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        {expanded[l.card_id] ? T('collapse') : T('viewHistory')}
                        {expanded[l.card_id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    )}
                    {newVisited.includes(l.card_id) && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{T('alreadyShown')}</span>}
                  </div>
                  {expanded[l.card_id] && (
                    <ChainNode cardId={l.card_id} cardName={l.cards?.name} depth={depth + 1} allSales={allSales} allTxns={allTxns} visited={newVisited} language={language} />
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
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{T('currentlyHolding')}</div>
        </div>
      )}
    </div>
  )
}

export default function ChainAnalysis({ language = 'zh' }) {
  const T = (key) => lang(key, language)
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

  // 递归计算整条链的 cash 流
  const calcChainCash = (cardId, visited = []) => {
    if (visited.includes(cardId)) return { cashOut: 0, cashIn: 0, complete: true }
    const newVisited = [...visited, cardId]

    const allLegs = allTxns.flatMap(t => (t.transaction_legs || []).map(l => ({ ...l, txn: t })))

    // 这张卡的买入 leg
    const inLeg = allLegs.find(l => l.card_id === cardId && l.direction === 'in')
    // 这张卡的卖出/trade-out leg
    const outLeg = allLegs.find(l => l.card_id === cardId && l.direction === 'out')
    const sale = allSales.find(s => s.card_id === cardId)

    let cashOut = 0  // 花出去的
    let cashIn = 0   // 收回来的
    let complete = true

    // 买入时花的 cash
    if (inLeg?.txn?.type === 'buy') {
      cashOut += inLeg.cash_amount || 0
    }

    // trade 得到时：同笔交易付出的 cash（你补的）
    if (inLeg?.txn?.type === 'trade') {
      const inTxnLegs = inLeg.txn.transaction_legs || []
      const tradeCashOut = inTxnLegs.filter(l => l.direction === 'out' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
      const tradeCashIn = inTxnLegs.filter(l => l.direction === 'in' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
      // 按这张卡的 agreed value 占比分摊 cash
      const inCards = inTxnLegs.filter(l => l.direction === 'in' && l.card_id)
      const totalAgreed = inCards.reduce((s, l) => s + (l.agreed_value || 0), 0)
      const myAgreed = inLeg.agreed_value || 0
      const share = totalAgreed > 0 ? myAgreed / totalAgreed : 1 / Math.max(inCards.length, 1)
      cashOut += tradeCashOut * share
      cashIn += tradeCashIn * share
    }

    // 最终卖出
    if (sale) {
      cashIn += sale.sale_price || 0
    } else if (outLeg?.txn?.type === 'trade') {
      // trade 出去：递归计算换来的每张卡
      const outTxnLegs = outLeg.txn.transaction_legs || []
      const receivedCards = outTxnLegs.filter(l => l.direction === 'in' && l.card_id)
      const receivedCash = outTxnLegs.filter(l => l.direction === 'in' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
      const paidCash = outTxnLegs.filter(l => l.direction === 'out' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)

      // trade 时直接收到的 cash
      cashIn += receivedCash
      // trade 时额外付出的 cash
      cashOut += paidCash

      // 递归每张换来的卡
      for (const l of receivedCards) {
        if (!newVisited.includes(l.card_id)) {
          const sub = calcChainCash(l.card_id, newVisited)
          cashOut += sub.cashOut
          cashIn += sub.cashIn
          if (!sub.complete) complete = false
        }
      }
    } else {
      // 还在持有中，未完结
      complete = false
    }

    return { cashOut, cashIn, complete }
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
        <h1>{T('chainTitle')}</h1>
        <p className="page-sub">{T('chainSub')}</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 500 }}>
        <div className="picker-search" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
          <Search size={15} />
          <input
            placeholder="{T('searchCard')}"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); handleSearch(e.target.value) }}
            style={{ flex: 1 }}
          />
          {searching && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{T('searching')}</span>}
        </div>
        {results.length > 0 && (
          <div className="picker-list" style={{ zIndex: 50 }}>
            {results.map(card => (
              <div key={card.id} className="picker-item" onClick={() => handleSelect(card)}>
                <span>{card.name}</span>
                <span className={`badge ${card.status === 'holding' ? 'badge-pending' : 'badge-sell'}`} style={{ fontSize: 10 }}>
                  {card.status === 'holding' ? T('holding') : T('soldOut')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="loading">{T('loadingChain')}</div>}

      {selected && !loading && (
        <>
          {selected && allTxns.length > 0 && (() => {
            const chain = calcChainCash(selected.id, [])
            const net = chain.cashIn - chain.cashOut
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="metric-label">链条总花出</div>
                  <div className="metric-value">${Math.round(chain.cashOut).toLocaleString()}</div>
                </div>
                <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="metric-label">链条总收回</div>
                  <div className={`metric-value ${chain.cashIn > 0 ? 'pos' : ''}`}>
                    ${Math.round(chain.cashIn).toLocaleString()}
                  </div>
                </div>
                <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="metric-label">
                    链条净盈亏{!chain.complete && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>（未完结）</span>}
                  </div>
                  <div className={`metric-value ${net >= 0 ? 'pos' : 'neg'}`}>
                    {fmt(net)}
                    {!chain.complete && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>部分未结算</span>}
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="section-card">
            <div className="section-title">{T('fullChain')}</div>
            <ChainNode
              cardId={selected.id}
              cardName={selected.name}
              depth={0}
              allSales={allSales}
              allTxns={allTxns}
              visited={[]}
              language={language}
            />
          </div>
        </>
      )}
    </div>
  )
}
