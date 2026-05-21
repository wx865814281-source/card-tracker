import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { GitBranch, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, Pencil, Check, X } from 'lucide-react'
import './pages.css'

export default function TransactionHistory() {
  const [txns, setTxns] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [openChains, setOpenChains] = useState({})
  const [typeFilter, setTypeFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [period, setPeriod] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    async function load() {
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*, transaction_legs(*, cards(name, actual_cost, agreed_value, source_type, source_card_id))')
        .order('date', { ascending: false })
      const { data: saleData } = await supabase
        .from('card_sales')
        .select('*, cards(name, actual_cost, agreed_value)')
      setTxns(txnData || [])
      setSales(saleData || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggleChain = (id) => setOpenChains(o => ({ ...o, [id]: !o[id] }))

  const saveDate = async (id) => {
    await supabase.from('transactions').update({ date: editDate }).eq('id', id)
    setTxns(txns.map(t => t.id === id ? { ...t, date: editDate } : t))
    setEditingId(null)
  }
  const getSaleForTxn = (txnId) => sales.find(s => s.transaction_id === txnId)
  const filtered = txns.filter(t => (typeFilter === 'all' ? true : t.type === typeFilter) && inRange(t.date))
  const totalRealized = sales.filter(r => inRange(r.sale_date)).reduce((s, r) => s + (r.sale_price - (r.cards?.actual_cost || 0)), 0)
  const fmt = (n) => { if (n == null) return '—'; const abs = Math.abs(n).toLocaleString(); return (n >= 0 ? '+$' : '-$') + abs }

  const getPeriodRange = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    if (period === 'this_month') return [new Date(y, m, 1), new Date(y, m+1, 0, 23, 59, 59)]
    if (period === 'last_month') return [new Date(y, m-1, 1), new Date(y, m, 0, 23, 59, 59)]
    if (period === 'this_year') return [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59)]
    if (period === 'last_year') return [new Date(y-1, 0, 1), new Date(y-1, 11, 31, 23, 59, 59)]
    if (period === 'custom') return [customStart ? new Date(customStart) : null, customEnd ? new Date(customEnd) : null]
    return [null, null]
  }

  const inRange = (dateStr) => {
    const [start, end] = getPeriodRange()
    if (!start && !end) return true
    const d = new Date(dateStr + 'T12:00:00')
    if (start && d < start) return false
    if (end && d > end) return false
    return true
  }

  const getCardDisposition = (cardId) => {
    if (!cardId) return { status: null, linkedTxn: null, sale: null }
    const sale = sales.find(s => s.card_id === cardId)
    if (sale) {
      const linkedTxn = sale.transaction_id ? txns.find(t => t.id === sale.transaction_id) : null
      return { status: 'sold', linkedTxn, sale }
    }
    for (const t of txns) {
      const outLegs = (t.transaction_legs || []).filter(l => l.direction === 'out' && l.card_id === cardId)
      if (outLegs.length > 0) return { status: 'traded', linkedTxn: t, sale: null }
    }
    return { status: null, linkedTxn: null, sale: null }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      <div className="page-header-row">
        <div><h1>交易历史</h1><p className="page-sub">所有买入、卖出和 Trade 记录</p></div>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {[['all','全部'],['buy','买入'],['sell','卖出'],['trade','Trade']].map(([v,l]) => (
            <button key={v} className={`tab-btn ${typeFilter===v?'active':''}`} onClick={() => setTypeFilter(v)}>{l}</button>
          ))}
        </div>
      </div>


      {/* 时间筛选 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {[['all','全部'],['this_month','本月'],['last_month','上月'],['this_year','今年'],['last_year','去年'],['custom','自定义']].map(([v,l]) => (
          <button key={v} className={`tab-btn ${period===v?'active':''}`} onClick={() => setPeriod(v)}>{l}</button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>从</span>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ width: 150 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>到</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ width: 150 }} />
        </div>
      )}
      {/* ── 固定标题行 ── */}
      <div className="history-header">
        <div className="history-header-cell">日期</div>
        <div className="history-header-cell">卡牌 / 交易内容</div>
        <div className="history-header-cell">类型</div>
        <div className="history-header-cell">成本</div>
        <div className="history-header-cell">收入</div>
        <div className="history-header-cell">盈亏 / 状态</div>
        <div className="history-header-cell"></div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text2)' }}>暂无交易记录</div>
      ) : (
        <div className="history-list">
          {filtered.map(t => {
            const outLegs = (t.transaction_legs || []).filter(l => l.direction === 'out')
            const inLegs = (t.transaction_legs || []).filter(l => l.direction === 'in')
            const sale = getSaleForTxn(t.id)
            const pnl = sale ? sale.sale_price - (sale.cards?.actual_cost || 0) : null
            const outCardLegs = outLegs.filter(l => l.card_id)
            const outCashLegs = outLegs.filter(l => !l.card_id)
            const inCardLegs = inLegs.filter(l => l.card_id)
            const inCashLegs = inLegs.filter(l => !l.card_id)
            const totalOutCost = outCardLegs.reduce((s, l) => s + (l.cards?.actual_cost || 0), 0)
            const totalOutValue = outCardLegs.reduce((s, l) => s + (l.cards?.agreed_value || 0), 0)
            const totalOutCash = outCashLegs.reduce((s, l) => s + (l.cash_amount || 0), 0)
            const totalInCash = inCashLegs.reduce((s, l) => s + (l.cash_amount || 0), 0)

            const buyDispositions = t.type === 'buy'
              ? inCardLegs.map(leg => ({ leg, ...getCardDisposition(leg.card_id) }))
              : []

            const buyOverallStatus = (() => {
              if (t.type !== 'buy') return null
              if (buyDispositions.length === 0) return null
              const allGone = buyDispositions.every(d => d.status !== null)
              if (!allGone) return null
              const hasSold = buyDispositions.some(d => d.status === 'sold')
              const hasTraded = buyDispositions.some(d => d.status === 'traded')
              if (hasSold && !hasTraded) return 'sold'
              if (hasTraded && !hasSold) return 'traded'
              return 'mixed'
            })()

            return (
              <div key={t.id} className="history-row">
                <div className="history-main">
                  <div className="history-date mono">
                    {editingId === t.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          style={{ fontSize: 11, padding: '2px 4px', width: 110 }} />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveDate(t.id)} style={{ background: 'var(--green)', color: '#000', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}><Check size={11} /></button>
                          <button onClick={() => setEditingId(null)} style={{ background: 'var(--bg4)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}><X size={11} /></button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{t.date}</span>
                        <button onClick={() => { setEditingId(t.id); setEditDate(t.date) }}
                          style={{ background: 'none', color: 'var(--text3)', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.6 }}>
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="history-center">
                    {t.type === 'sell' && outLegs.map(leg => (
                      <div key={leg.id}>
                        <div className="history-card-name">{leg.cards?.name || leg.card_name_manual}</div>
                        {leg.cards?.agreed_value && <div className="value-tag" style={{ marginTop: 3 }}>value ${leg.cards.agreed_value.toLocaleString()}</div>}
                      </div>
                    ))}
                    {t.type === 'buy' && inLegs.map(leg => (
                      <div key={leg.id} className="history-card-name">{leg.cards?.name || leg.card_name_manual}</div>
                    ))}
                    {t.type === 'trade' && (
                      <div className="trade-summary">
                        <div className="trade-out">
                          {outCardLegs.map(l => (
                            <div key={l.id} className="trade-card-chip out">
                              {l.cards?.name || l.card_name_manual}
                              {l.cards?.agreed_value && <span className="inline-value"> @value ${l.cards.agreed_value.toLocaleString()}</span>}
                            </div>
                          ))}
                          {totalOutCash > 0 && <div className="trade-card-chip out">Cash +${totalOutCash.toLocaleString()}</div>}
                        </div>
                        <span className="trade-arrow">⇄</span>
                        <div className="trade-in">
                          {inCardLegs.map(l => (
                            <div key={l.id} className="trade-card-chip in">
                              {l.cards?.name || l.card_name_manual}
                              {l.agreed_value && <span className="inline-value"> @${l.agreed_value.toLocaleString()}</span>}
                            </div>
                          ))}
                          {totalInCash > 0 && <div className="trade-card-chip in">Cash +${totalInCash.toLocaleString()}</div>}
                        </div>
                      </div>
                    )}
                    {t.notes && <div className="history-notes">{t.notes}</div>}
                  </div>

                  <div className="history-type">
                    {t.type === 'buy' && <span className="badge" style={{ color: '#facc15', background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.3)' }}>买入</span>}{t.type === 'sell' && <span className="badge badge-sell">卖出</span>}{t.type === 'trade' && <span className="badge badge-trade">Trade out</span>}
                  </div>

                  <div className="history-cost">
                    {t.type === 'sell' && outLegs[0]?.cards?.actual_cost != null && (
                      <div>
                        <div style={{ fontSize: 13 }}>${outLegs[0].cards.actual_cost.toLocaleString()}</div>
                        {outLegs[0].cards?.agreed_value && <div className="value-tag" style={{ marginTop: 3 }}>value ${outLegs[0].cards.agreed_value.toLocaleString()}</div>}
                      </div>
                    )}
                    {t.type === 'buy' && inLegs[0]?.cash_amount != null && `$${inLegs[0].cash_amount.toLocaleString()}`}
                    {t.type === 'trade' && (
                      <div style={{ fontSize: 12 }}>
                        <div>成本 ${totalOutCost.toLocaleString()}</div>
                        {totalOutValue > 0 && <div className="value-tag" style={{ marginTop: 3 }}>value ${totalOutValue.toLocaleString()}</div>}
                        {totalOutCash > 0 && <div style={{ color: 'var(--text3)', marginTop: 2 }}>+Cash ${totalOutCash.toLocaleString()}</div>}
                      </div>
                    )}
                  </div>

                  <div className="history-income">
                    {t.type === 'sell' && sale && `$${sale.sale_price.toLocaleString()}`}
                    {t.type === 'buy' && inLegs[0]?.cash_amount != null && `$${inLegs[0].cash_amount.toLocaleString()}`}
                    {t.type === 'trade' && (
                      <div>
                        {totalInCash > 0 && <div>Cash ${totalInCash.toLocaleString()}</div>}
                        {inCardLegs.map(l => (
                          <div key={l.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                            + {l.cards?.name || l.card_name_manual}
                            {l.agreed_value && <span className="value-tag" style={{ marginLeft: 4 }}>@${l.agreed_value.toLocaleString()}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="history-pnl">
                    {t.type === 'sell' && pnl != null && <span className={pnl >= 0 ? 'pos' : 'neg'}>{fmt(pnl)}</span>}
                    {t.type === 'trade' && (() => {
                      const inCardLegs = inLegs.filter(l => l.card_id)
                      const allSold = inCardLegs.length > 0 && inCardLegs.every(l => {
                        const sale = sales.find(s => s.card_id === l.card_id)
                        return !!sale
                      })
                      return allSold
                        ? <span className="badge badge-settled" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已完结</span>
                        : <span className="badge" style={{ color: '#fff', background: 'var(--red)', border: 'none' }}>进行中</span>
                    })()}
                    {t.type === 'buy' && (
                      buyOverallStatus === 'sold'
                        ? <span className="badge badge-settled" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已出售</span>
                        : buyOverallStatus === 'traded'
                          ? <span className="badge" style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', whiteSpace: 'nowrap' }}>Trade Out</span>
                          : buyOverallStatus === 'mixed'
                            ? <span className="badge" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已处置</span>
                            : <span className="badge" style={{ color: '#facc15', background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.3)' }}>未出售</span>
                    )}
                  </div>

                  <button className="chain-btn" onClick={() => toggleChain(t.id)}>
                    <GitBranch size={13} />
                    {openChains[t.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>

                {openChains[t.id] && (
                  <div className="chain-body">
                    {t.type === 'buy' && (
                      <>
                        <div className="chain-step">
                          <ArrowDownLeft size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <div>Cash <b>${inLegs[0]?.cash_amount?.toLocaleString()}</b> 买入 <b>{inLegs[0]?.cards?.name || inLegs[0]?.card_name_manual}</b></div>
                        </div>
                        {buyDispositions.map(({ leg, status, linkedTxn, sale: dispSale }) => {
                          if (!status) return null
                          const cardName = leg.cards?.name || leg.card_name_manual
                          if (status === 'sold') {
                            const pnl = dispSale ? dispSale.sale_price - (leg.cards?.actual_cost || 0) : null
                            return (
                              <React.Fragment key={leg.id}>
                                <div className="chain-step">
                                  <ArrowUpRight size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                                  <div>
                                    <b>{cardName}</b> 于 <b>{linkedTxn?.date || dispSale?.date || '—'}</b> 卖出
                                    {dispSale?.sale_price != null && <>，售价 <b>${dispSale.sale_price.toLocaleString()}</b></>}
                                    {pnl != null && <>，盈亏 <b className={pnl >= 0 ? 'pos' : 'neg'}>{fmt(pnl)}</b></>}
                                  </div>
                                </div>
                              </React.Fragment>
                            )
                          }
                          if (status === 'traded') {
                            const outLeg = (linkedTxn?.transaction_legs || []).find(l => l.direction === 'out' && l.card_id === leg.card_id)
                            return (
                              <React.Fragment key={leg.id}>
                                <div className="chain-step">
                                  <ArrowUpRight size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />
                                  <div>
                                    <b>{cardName}</b> 于 <b>{linkedTxn?.date || '—'}</b> Trade Out
                                    {outLeg?.cards?.agreed_value != null && <>，value <b>${outLeg.cards.agreed_value.toLocaleString()}</b></>}
                                    {linkedTxn && (
                                      <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>
                                        → 对应交易：{linkedTxn.date}
                                        {(() => {
                                          const gotCards = (linkedTxn.transaction_legs || []).filter(l => l.direction === 'in' && l.card_id)
                                          const gotCash = (linkedTxn.transaction_legs || []).filter(l => l.direction === 'in' && !l.card_id).reduce((s, l) => s + (l.cash_amount || 0), 0)
                                          const parts = []
                                          gotCards.forEach(l => parts.push(l.cards?.name || l.card_name_manual))
                                          if (gotCash > 0) parts.push(`Cash $${gotCash.toLocaleString()}`)
                                          return parts.length > 0 ? `，换入：${parts.join('、')}` : ''
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </React.Fragment>
                            )
                          }
                          return null
                        })}
                      </>
                    )}
                    {t.type === 'sell' && (<>
                      <div className="chain-step">
                        <ArrowUpRight size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                        <div>付出：<b>{outLegs[0]?.cards?.name}</b>｜成本 ${outLegs[0]?.cards?.actual_cost?.toLocaleString()}{outLegs[0]?.cards?.agreed_value ? `｜value $${outLegs[0].cards.agreed_value.toLocaleString()}` : ''}</div>
                      </div>
                      <div className="chain-step">
                        <ArrowDownLeft size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                        <div>得到：Cash <b>${sale?.sale_price?.toLocaleString()}</b></div>
                      </div>
                      {pnl != null && <div className="chain-step"><span style={{ width: 14, flexShrink: 0 }}>📊</span><div>盈亏：<b className={pnl >= 0 ? 'pos' : 'neg'}>{fmt(pnl)}</b></div></div>}
                    </>)}
                    {t.type === 'trade' && (<>
                      {outCardLegs.map(l => (
                        <div key={l.id} className="chain-step">
                          <ArrowUpRight size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                          <div>付出卡：<b>{l.cards?.name || l.card_name_manual}</b>｜成本 ${l.cards?.actual_cost?.toLocaleString()}{l.cards?.agreed_value ? `｜value $${l.cards.agreed_value.toLocaleString()}` : ''}</div>
                        </div>
                      ))}
                      {totalOutCash > 0 && (
                        <div className="chain-step">
                          <ArrowUpRight size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                          <div>付出：Cash <b>${totalOutCash.toLocaleString()}</b></div>
                        </div>
                      )}
                      {inCardLegs.map(l => (
                        <div key={l.id} className="chain-step">
                          <ArrowDownLeft size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <div>得到卡：<b>{l.cards?.name || l.card_name_manual}</b>{l.agreed_value ? `｜认可Value $${l.agreed_value.toLocaleString()}｜实际成本 $${l.cards?.actual_cost?.toLocaleString()}` : ''}</div>
                        </div>
                      ))}
                      {totalInCash > 0 && (
                        <div className="chain-step">
                          <ArrowDownLeft size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <div>得到：Cash <b>${totalInCash.toLocaleString()}</b></div>
                        </div>
                      )}
                      <div className="chain-step"><span style={{ width: 14, flexShrink: 0 }}>⏳</span><div style={{ color: 'var(--text3)' }}>链条盈亏在所有卡售出后结算</div></div>
                    </>)}
                    {t.notes && <div className="chain-step"><span style={{ width: 14, flexShrink: 0 }}>📝</span><div>备注：{t.notes}</div></div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="summary-bar">
        <span style={{ color: 'var(--text2)' }}>已结算盈亏合计</span>
        <span className={totalRealized >= 0 ? 'pos' : 'neg'} style={{ fontSize: 15, fontWeight: 600 }}>{fmt(totalRealized)}</span>
      </div>
    </div>
  )
}