import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { GitBranch, ChevronDown, ChevronUp, Handshake, CornerUpLeft } from 'lucide-react'
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

  const getSaleForCard = (cardId) => sales.find(s => s.card_id === cardId)
  const getSaleForTxn = (txnId) => sales.find(s => s.transaction_id === txnId)

  const filtered = txns.filter(t => typeFilter === 'all' ? true : t.type === typeFilter)

  const totalRealized = sales.reduce((s, r) => s + (r.sale_price - (r.cards?.actual_cost || 0)), 0)

  const fmt = (n) => {
    if (n == null) return '—'
    const abs = Math.abs(n).toLocaleString()
    return (n >= 0 ? '+$' : '-$') + abs
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>交易历史</h1>
          <p className="page-sub">所有买入、卖出和 Trade 记录</p>
        </div>
        <div className="filter-tabs">
          {[['all','全部'],['buy','买入'],['sell','卖出'],['trade','Trade']].map(([v,l]) => (
            <button key={v} className={`tab-btn ${typeFilter===v?'active':''}`} onClick={() => setTypeFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text2)' }}>暂无交易记录</div>
      ) : (
        <div className="history-list">
          {filtered.map(t => {
            const outLegs = (t.transaction_legs || []).filter(l => l.direction === 'out')
            const inLegs = (t.transaction_legs || []).filter(l => l.direction === 'in')
            const sale = getSaleForTxn(t.id)
            const pnl = sale ? sale.sale_price - (sale.cards?.actual_cost || 0) : null

            return (
              <div key={t.id} className="history-row">
                <div className="history-main">
                  <div className="history-date mono">{t.date}</div>

                  <div className="history-center">
                    {/* 卖出 */}
                    {t.type === 'sell' && outLegs.map(leg => (
                      <div key={leg.id}>
                        <div className="history-card-name">
                          {leg.cards?.name || leg.card_name_manual}
                          {leg.cards?.agreed_value && (
                            <span className="value-tag"><Handshake size={10} /> value ${leg.cards.agreed_value.toLocaleString()}</span>
                          )}
                        </div>
                        {leg.cards?.source_type === 'trade' && (
                          <div className="history-sub"><CornerUpLeft size={11} /> 来自 trade</div>
                        )}
                      </div>
                    ))}

                    {/* 买入 */}
                    {t.type === 'buy' && inLegs.map(leg => (
                      <div key={leg.id} className="history-card-name">{leg.cards?.name || leg.card_name_manual}</div>
                    ))}

                    {/* Trade */}
                    {t.type === 'trade' && (
                      <div className="trade-summary">
                        <div className="trade-out">
                          {outLegs.map(l => <span key={l.id} className="trade-card-chip out">{l.cards?.name || l.card_name_manual}{l.cash_amount > 0 ? ` + $${l.cash_amount}` : ''}</span>)}
                        </div>
                        <span className="trade-arrow">⇄</span>
                        <div className="trade-in">
                          {inLegs.map(l => (
                            <span key={l.id} className="trade-card-chip in">
                              {l.cards?.name || l.card_name_manual}
                              {l.agreed_value && <span className="inline-value"> @${l.agreed_value.toLocaleString()}</span>}
                              {l.cash_amount > 0 ? ` + $${l.cash_amount}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {t.notes && <div className="history-notes">{t.notes}</div>}
                  </div>

                  <div className="history-type">
                    <span className={`badge badge-${t.type}`}>
                      {t.type === 'buy' ? '买入' : t.type === 'sell' ? '卖出' : 'Trade out'}
                    </span>
                  </div>

                  <div className="history-cost">
                    {t.type === 'sell' && outLegs[0]?.cards?.actual_cost != null && (
                      <div>
                        <div style={{ fontSize: 13 }}>${outLegs[0].cards.actual_cost.toLocaleString()}</div>
                        {outLegs[0].cards?.agreed_value && (
                          <div className="value-tag" style={{ marginTop: 3 }}>
                            <Handshake size={10} /> value ${outLegs[0].cards.agreed_value.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                    {t.type === 'buy' && inLegs[0]?.cash_amount != null && `$${inLegs[0].cash_amount.toLocaleString()}`}
                    {t.type === 'trade' && outLegs.reduce((s, l) => s + (l.cards?.actual_cost || 0), 0) > 0 && (
                      `$${outLegs.reduce((s, l) => s + (l.cards?.actual_cost || 0), 0).toLocaleString()}`
                    )}
                  </div>

                  <div className="history-income">
                    {t.type === 'sell' && sale && `$${sale.sale_price.toLocaleString()}`}
                    {t.type === 'buy' && inLegs[0]?.cash_amount != null && `$${inLegs[0].cash_amount.toLocaleString()}`}
                    {t.type === 'trade' && (
                      <div>
                        {outLegs.filter(l => l.cash_amount > 0).map(l => (
                          <div key={l.id}>${l.cash_amount.toLocaleString()} 现金</div>
                        ))}
                        {inLegs.map(l => (
                          <div key={l.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                            + {l.cards?.name || l.card_name_manual}
                            {l.agreed_value && <span className="value-tag" style={{ marginLeft: 4 }}><Handshake size={10} /> ${l.agreed_value.toLocaleString()}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="history-pnl">
                    {t.type === 'sell' && pnl != null && (
                      <span className={pnl >= 0 ? 'pos' : 'neg'}>{fmt(pnl)}</span>
                    )}
                    {t.type === 'trade' && (
                      <span className="badge badge-settled">
                        {inLegs.some(l => l.cards && getSaleForCard(l.cards?.id || l.card_id)?.card_id) ? '已结算' : '进行中'}
                      </span>
                    )}
                    {t.type === 'buy' && <span style={{ color: 'var(--text3)' }}>—</span>}
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
                        <div className="chain-step">💰 起点：${inLegs[0]?.cash_amount?.toLocaleString()} 现金购入 <b>{inLegs[0]?.cards?.name || inLegs[0]?.card_name_manual}</b></div>
                      </>
                    )}
                    {t.type === 'sell' && (
                      <>
                        <div className="chain-step">📋 成本 ${outLegs[0]?.cards?.actual_cost?.toLocaleString()}{outLegs[0]?.cards?.agreed_value ? `（认可价值 $${outLegs[0].cards.agreed_value.toLocaleString()}）` : ''}</div>
                        <div className="chain-step">🏷️ {t.date} 以 ${sale?.sale_price?.toLocaleString()} 卖出 <b>{outLegs[0]?.cards?.name}</b></div>
                        {pnl != null && <div className="chain-step">📊 盈亏：${sale?.sale_price?.toLocaleString()} − ${outLegs[0]?.cards?.actual_cost?.toLocaleString()} = <b className={pnl >= 0 ? 'pos' : 'neg'}>{fmt(pnl)}</b></div>}
                      </>
                    )}
                    {t.type === 'trade' && (
                      <>
                        {outLegs.map(l => (
                          <div key={l.id} className="chain-step">📤 付出：<b>{l.cards?.name || l.card_name_manual}</b>（成本 ${l.cards?.actual_cost?.toLocaleString()}）{l.cash_amount > 0 ? ` + $${l.cash_amount} 现金` : ''}</div>
                        ))}
                        {inLegs.map(l => (
                          <div key={l.id} className="chain-step">📥 得到：<b>{l.cards?.name || l.card_name_manual}</b>
                            {l.agreed_value ? `（认可价值 $${l.agreed_value.toLocaleString()}，实际成本 $${l.cards?.actual_cost?.toLocaleString()}）` : ''}
                            {l.cash_amount > 0 ? ` + $${l.cash_amount} 现金` : ''}
                          </div>
                        ))}
                        <div className="chain-step" style={{ color: 'var(--text3)' }}>⏳ 链条盈亏在所有卡售出后结算</div>
                      </>
                    )}
                    {t.notes && <div className="chain-step">📝 备注：{t.notes}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="summary-bar">
        <span style={{ color: 'var(--text2)' }}>已结算盈亏合计</span>
        <span className={totalRealized >= 0 ? 'pos' : 'neg'} style={{ fontSize: 15, fontWeight: 600 }}>
          {fmt(totalRealized)}
        </span>
      </div>
    </div>
  )
}
