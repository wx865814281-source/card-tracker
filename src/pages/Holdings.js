import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Handshake, DollarSign, ArrowRight } from 'lucide-react'
import './pages.css'

export default function Holdings({ navigate }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('holding')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('cards')
        .select('*, source_card:source_card_id(name)')
        .order('created_at', { ascending: false })
      setCards(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = cards.filter(c => filter === 'all' ? true : c.status === filter)

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>持仓卡牌</h1>
          <p className="page-sub">管理你的所有球星卡</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('add')}>+ 新增交易</button>
      </div>

      <div className="filter-tabs">
        {[['holding','持有中'],['sold','已售出'],['all','全部']].map(([v,l]) => (
          <button key={v} className={`tab-btn ${filter===v?'active':''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
          <div style={{ color: 'var(--text2)' }}>暂无卡牌，<button className="link-btn" onClick={() => navigate('add')}>添加第一张</button></div>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map(card => (
            <div key={card.id} className={`card-item ${card.status === 'sold' ? 'sold' : ''}`}>
              <div className="card-photo">
                {card.photo_url
                  ? <img src={card.photo_url} alt={card.name} />
                  : <div className="card-placeholder">🃏</div>
                }
                <span className={`card-status-dot ${card.status}`} />
              </div>
              <div className="card-body">
                <div className="card-name">{card.name}</div>
                <div className="card-costs">
                  <div className="cost-item">
                    <DollarSign size={12} />
                    <span className="cost-label">实际成本</span>
                    <span className="cost-val">${card.actual_cost?.toLocaleString()}</span>
                  </div>
                  {card.agreed_value && (
                    <div className="cost-item purple">
                      <Handshake size={12} />
                      <span className="cost-label">认可价值</span>
                      <span className="cost-val">${card.agreed_value?.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="card-source">
                  <ArrowRight size={11} />
                  {card.source_type === 'cash'
                    ? '现金购入'
                    : card.source_card?.name
                      ? `来自 ${card.source_card.name}`
                      : '来自 Trade'}
                </div>
                {card.status === 'sold' && (
                  <div className="sold-label">已售出</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
