import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { GitBranch, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import './pages.css'

export default function TransactionHistory() {
  const [txns, setTxns] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [openChains, setOpenChains] = useState({})
  const [typeFilter, setTypeFilter] = useState('all')

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
  const getSaleForTxn = (txnId) => sales.find(s => s.transaction_id === txnId)
  const filtered = txns.filter(t => typeFilter === 'all' ? true : t.type === typeFilter)
  const totalRealized = sales.reduce((s, r) => s + (r.sale_price - (r.cards?.actual_cost || 0)), 0)
  const fmt = (n) => { if (n == null) return '—'; const abs = Math.abs(n).toLocaleString(); return (n >= 0 ? '+$' : '-$') + abs }

  // ── 新增：根据 card_id 查找该卡后续的去向 ──────────────────────────────
  // 返回 { status: 'sold' | 'traded' | null, linkedTxn: txn | null, sale: sale | null }
  const getCardDisposition = (cardId) => {
    if (!cardId) return { status: null, linkedTxn: null, sale: null }

    // 1. 查 card_sales 里是否有卖出记录
    const sale = sales.find(s => s.card_id === cardId)
    if (sale) {
      // 再找对应的卖出 transaction
      const linkedTxn = sale.transaction_id
        ? txns.find(t => t.id === sale.transaction_id)
        : null
      return { status: 'sold', linkedTxn, sale }
    }

    // 2. 查其他 transaction 的 out legs 里是否有这张卡（trade out）
    for (const t of txns) {
      const outLegs = (t.transaction_legs || []).filter(l => l.direction === 'out' && l.card_id === cardId)
      if (outLegs.length > 0) {
        return { status: 'traded', linkedTxn: t, sale: null }
      }
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

            // ── 买入：计算每张 in 卡的去向 ──────────────────────────────────
            // dispositions: Array of { leg, status, linkedTxn, sale }
            const buyDispositions = t.type === 'buy'
              ? inCardLegs.map(leg => ({
                  leg,
                  ...getCardDisposition(leg.card_id)
                }))
              : []

            // 买入整体状态：只要有一张卡还在手里就是"持仓中"
            const buyOverallStatus = (() => {
              if (t.type !== 'buy') return null
              if (buyDispositions.length === 0) return null
              const allGone = buyDispositions.every(d => d.status !== null)
              if (!allGone) return null
              // 全部已处置：判断主要去向
              const hasSold = buyDispositions.some(d => d.status === 'sold')
              const hasTraded = buyDispositions.some(d => d.status === 'traded')
              if (hasSold && !hasTraded) return 'sold'
              if (hasTraded && !hasSold) return 'traded'
              return 'mixed' // 有卖出也有 trade
            })()

            return (
              <div key={t.id} className="history-row">
                <div className="history-main">
                  <div className="history-date mono">{t.date}</div>
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
                    <span className={`badge badge-${t.type}`}>{t.type === 'buy' ? '买入' : t.type === 'sell' ? '卖出' : 'Trade out'}</span>
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
                    {/* ── 买入状态标签 ───────────────────────────── */}
                    {t.type === 'buy' && (
                      buyOverallStatus === 'sold'
                        ? <span className="badge badge-settled" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已出售</span>
                        : buyOverallStatus === 'traded'
                          ? <span className="badge" style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}>已Trade Out</span>
                          : buyOverallStatus === 'mixed'
                            ? <span className="badge" style={{ color: 'var(--text3)', background: 'var(--bg4)' }}>已处置</span>
                            : <span style={{ color: 'var(--text3)' }}>—</span>
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

                        {/* ── 显示每张卡的后续去向 ─────────────────── */}
                        {buyDispositions.map(({ leg, status, linkedTxn, sale: dispSale }) => {
                          if (!status) return null
                          const cardName = leg.cards?.name || leg.card_name_manual

                          if (status === 'sold') {
                            const pnl = dispSale
                              ? dispSale.sale_price - (leg.cards?.actual_cost || 0)
                              : null
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
                            // 找到对应 out leg 里的 agreed_value
                            const outLeg = (linkedTxn?.transaction_legs || []).find(
                              l => l.direction === 'out' && l.card_id === leg.card_id
                            )
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
                                          // 显示换入的卡
                                          const gotCards = (linkedTxn.transaction_legs || [])
                                            .filter(l => l.direction === 'in' && l.card_id)
                                          const gotCash = (linkedTxn.transaction_legs || [])
                                            .filter(l => l.direction === 'in' && !l.card_id)
                                            .reduce((s, l) => s + (l.cash_amount || 0), 0)
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