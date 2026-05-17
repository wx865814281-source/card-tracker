import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { DollarSign, ArrowRight, LayoutGrid, List, X, Calendar, Tag, TrendingUp, TrendingDown, Camera, Trash2 } from 'lucide-react'
import './pages.css'

function CardDetail({ card, onClose, onDeleted, onUpdated }) {
  const [sales, setSales] = useState([])
  const [txns, setTxns] = useState([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(card.photo_url)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('card_sales').select('*').eq('card_id', card.id).then(({ data }) => setSales(data || []))
    supabase.from('transaction_legs').select('*, transactions(date, type, notes)').eq('card_id', card.id).then(({ data }) => setTxns(data || []))
  }, [card.id])

  const saleInfo = sales[0]
  const pnl = saleInfo ? saleInfo.sale_price - card.actual_cost : null

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `cards/${card.id}.${ext}`
    await supabase.storage.from('card-photos').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('card-photos').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    await supabase.from('cards').update({ photo_url: url }).eq('id', card.id)
    setPhotoUrl(url)
    setUploading(false)
    onUpdated()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('transaction_legs').delete().eq('card_id', card.id)
    await supabase.from('card_sales').delete().eq('card_id', card.id)
    await supabase.from('cards').delete().eq('id', card.id)
    setDeleting(false)
    onDeleted()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="modal-photo" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          {photoUrl
            ? <img src={photoUrl} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🃏</div>
          }
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}>
            <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Camera size={24} />
              <span style={{ fontSize: 13 }}>{uploading ? '上传中...' : '点击更换照片'}</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>{card.name}</h2>
            <span className={`badge ${card.status === 'holding' ? 'badge-pending' : 'badge-sold'}`}>
              {card.status === 'holding' ? '持有中' : '已售出'}
            </span>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label"><DollarSign size={12} /> 实际成本</div>
              <div className="detail-value">${card.actual_cost?.toLocaleString()}</div>
            </div>
            {card.agreed_value && (
              <div className="detail-item">
                <div className="detail-label">认可价值</div>
                <div className="detail-value purple">${card.agreed_value?.toLocaleString()}</div>
              </div>
            )}
            {saleInfo && (
              <div className="detail-item">
                <div className="detail-label"><Tag size={12} /> 卖出价格</div>
                <div className="detail-value">${saleInfo.sale_price?.toLocaleString()}</div>
              </div>
            )}
            {pnl != null && (
              <div className="detail-item">
                <div className="detail-label">{pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} 盈亏</div>
                <div className={`detail-value ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}</div>
              </div>
            )}
            <div className="detail-item">
              <div className="detail-label"><ArrowRight size={12} /> 来源</div>
              <div className="detail-value" style={{ fontSize: 12 }}>{card.source_type === 'cash' ? '现金购入' : 'Trade 得到'}</div>
            </div>
          </div>

          {txns.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>交易记录</div>
              {txns.map(leg => (
                <div key={leg.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={11} />{leg.transactions?.date}</span>
                  <span className={`badge badge-${leg.transactions?.type}`} style={{ fontSize: 10 }}>{leg.transactions?.type === 'buy' ? '买入' : leg.transactions?.type === 'sell' ? '卖出' : 'Trade'}</span>
                  <span>{leg.direction === 'in' ? '得到' : '付出'}</span>
                </div>
              ))}
            </div>
          )}

          {saleInfo && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>售出日期：{saleInfo.sale_date}</div>}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: 'var(--red)', fontSize: 13, padding: '6px 0', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={14} /> 删除这张卡
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>确认删除？此操作不可撤销</span>
                <button onClick={handleDelete} disabled={deleting} style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                  {deleting ? '删除中...' : '确认删除'}
                </button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', color: 'var(--text3)', border: 'none', fontSize: 12, cursor: 'pointer' }}>取消</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Holdings({ navigate }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('holding')
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('cards').select('*, source_card:source_card_id(name)').order('created_at', { ascending: false })
    setCards(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = cards.filter(c => filter === 'all' ? true : c.status === filter)
  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      {selected && (
        <CardDetail
          card={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); load() }}
          onUpdated={() => load()}
        />
      )}

      <div className="page-header-row">
        <div><h1>持仓卡牌</h1><p className="page-sub">管理你的所有球星卡</p></div>
        <button className="btn-primary" onClick={() => navigate('add')}>+ 新增交易</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {[['holding','持有中'],['sold','已售出'],['all','全部']].map(([v,l]) => (
            <button key={v} className={`tab-btn ${filter===v?'active':''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`tab-btn ${view==='grid'?'active':''}`} onClick={() => setView('grid')}><LayoutGrid size={15} /></button>
          <button className={`tab-btn ${view==='list'?'active':''}`} onClick={() => setView('list')}><List size={15} /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
          <div style={{ color: 'var(--text2)' }}>暂无卡牌，<button className="link-btn" onClick={() => navigate('add')}>添加第一张</button></div>
        </div>
      ) : view === 'grid' ? (
        <div className="card-grid">
          {filtered.map(card => (
            <div key={card.id} className={`card-item ${card.status === 'sold' ? 'sold' : ''}`} onClick={() => setSelected(card)} style={{ cursor: 'pointer' }}>
              <div className="card-photo">
                {card.photo_url ? <img src={card.photo_url} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="card-placeholder">🃏</div>}
                <span className={`card-status-dot ${card.status}`} />
              </div>
              <div className="card-body">
                <div className="card-name">{card.name}</div>
                <div className="card-costs">
                  <div className="cost-item"><DollarSign size={12} /><span className="cost-label">实际成本</span><span className="cost-val">${card.actual_cost?.toLocaleString()}</span></div>
                  {card.agreed_value && <div className="cost-item purple"><span className="cost-label">认可价值</span><span className="cost-val">${card.agreed_value?.toLocaleString()}</span></div>}
                </div>
                <div className="card-source"><ArrowRight size={11} />{card.source_type === 'cash' ? '现金购入' : card.source_card?.name ? `来自 ${card.source_card.name}` : '来自 Trade'}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>卡牌</th><th>实际成本</th><th>认可价值</th><th>来源</th><th>状态</th></tr></thead>
            <tbody>
              {filtered.map(card => (
                <tr key={card.id} onClick={() => setSelected(card)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg3)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {card.photo_url ? <img src={card.photo_url} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🃏'}
                      </div>
                      <span style={{ fontWeight: 500 }}>{card.name}</span>
                    </div>
                  </td>
                  <td>${card.actual_cost?.toLocaleString()}</td>
                  <td>{card.agreed_value ? <span className="value-tag">${card.agreed_value?.toLocaleString()}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{card.source_type === 'cash' ? '现金购入' : card.source_card?.name ? `来自 ${card.source_card.name}` : '来自 Trade'}</td>
                  <td><span className={`badge ${card.status === 'holding' ? 'badge-pending' : 'badge-sold'}`}>{card.status === 'holding' ? '持有中' : '已售出'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}