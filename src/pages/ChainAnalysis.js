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
          {summary && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="metric-label">{T('directCost')}</div>
                <div className="metric-value">${summary.cashPaid.toLocaleString()}</div>
              </div>
              <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="metric-label">{T('cashRecovered')}</div>
                <div className={`metric-value ${summary.cashReceived > 0 ? 'pos' : ''}`}>
                  {summary.cashReceived > 0 ? '$' + summary.cashReceived.toLocaleString() : T('unsoldStatus')}
                </div>
              </div>
              <div className="metric-card" style={{ flex: 1, minWidth: 140 }}>
                <div className="metric-label">净{T('pnlLabel')}（{T('directCost')}）</div>
                <div className={`metric-value ${summary.net >= 0 ? 'pos' : 'neg'}`}>
                  {summary.settled ? fmt(summary.net) : T('unsettled')}
                </div>
              </div>
            </div>
          )}

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
