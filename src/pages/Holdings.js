import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DollarSign, ArrowRight, LayoutGrid, List, X, Search, Calendar, Tag, TrendingUp, TrendingDown, Camera, Trash2, Check } from 'lucide-react'
import './pages.css'

function ImageCropper({ src, onCrop, onCancel }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const previewRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(null)
  const [box, setBox] = useState({ x: 50, y: 50, w: 200, h: 200 })
  const startRef = useRef(null)
  const [imgReady, setImgReady] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgReady) return
    const ctx = canvas.getContext('2d')
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    // 保持比例绘制图片
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    const dx = (W - dw) / 2
    const dy = (H - dh) / 2

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, dx, dy, dw, dh)

    // 暗色蒙层
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, W, H)

    // 裁剪区域显示原图
    ctx.save()
    ctx.beginPath()
    ctx.rect(box.x, box.y, box.w, box.h)
    ctx.clip()
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.restore()

    // 边框
    ctx.strokeStyle = '#c8f135'
    ctx.lineWidth = 2
    ctx.strokeRect(box.x, box.y, box.w, box.h)

    // 四个角
    const corners = [[box.x, box.y], [box.x+box.w, box.y], [box.x, box.y+box.h], [box.x+box.w, box.y+box.h]]
    ctx.fillStyle = '#c8f135'
    corners.forEach(([cx, cy]) => { ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill() })

    // 更新预览
    const prev = previewRef.current
    if (prev) {
      const pctx = prev.getContext('2d')
      prev.width = 120; prev.height = 120
      // 计算实际图片坐标
      const sx = (box.x - dx) / scale
      const sy = (box.y - dy) / scale
      const sw = box.w / scale
      const sh = box.h / scale
      pctx.clearRect(0, 0, 120, 120)
      pctx.drawImage(img, sx, sy, sw, sh, 0, 0, 120, 120)
    }
  }, [box, imgReady])

  useEffect(() => { draw() }, [draw])

  const getImgTransform = () => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return { scale: 1, dx: 0, dy: 0 }
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    return { scale, dx: (W - dw) / 2, dy: (H - dh) / 2 }
  }

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const getCorner = (pos) => {
    const corners = [
      { name: 'tl', x: box.x, y: box.y }, { name: 'tr', x: box.x+box.w, y: box.y },
      { name: 'bl', x: box.x, y: box.y+box.h }, { name: 'br', x: box.x+box.w, y: box.y+box.h }
    ]
    return corners.find(c => Math.abs(c.x - pos.x) < 14 && Math.abs(c.y - pos.y) < 14)
  }

  const onMouseDown = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const pos = getPos(e, canvas)
    const corner = getCorner(pos)
    if (corner) { setResizing(corner.name); startRef.current = { pos, box: { ...box } } }
    else if (pos.x >= box.x && pos.x <= box.x+box.w && pos.y >= box.y && pos.y <= box.y+box.h) {
      setDragging(true); startRef.current = { pos, box: { ...box } }
    }
  }

  const onMouseMove = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e, canvas)
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    if (dragging && startRef.current) {
      const dx = pos.x - startRef.current.pos.x
      const dy = pos.y - startRef.current.pos.y
      setBox(b => ({
        ...b,
        x: Math.max(0, Math.min(W - startRef.current.box.w, startRef.current.box.x + dx)),
        y: Math.max(0, Math.min(H - startRef.current.box.h, startRef.current.box.y + dy))
      }))
    } else if (resizing && startRef.current) {
      const sb = startRef.current.box
      const dx = pos.x - startRef.current.pos.x
      const dy = pos.y - startRef.current.pos.y
      let { x, y, w, h } = sb
      if (resizing === 'br') { w = Math.max(40, sb.w + dx); h = Math.max(40, sb.h + dy) }
      else if (resizing === 'tr') { w = Math.max(40, sb.w + dx); h = Math.max(40, sb.h - dy); y = sb.y + (sb.h - h) }
      else if (resizing === 'bl') { w = Math.max(40, sb.w - dx); h = Math.max(40, sb.h + dy); x = sb.x + (sb.w - w) }
      else if (resizing === 'tl') { w = Math.max(40, sb.w - dx); h = Math.max(40, sb.h - dy); x = sb.x + (sb.w - w); y = sb.y + (sb.h - h) }
      x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y))
      setBox({ x, y, w: Math.min(w, W - x), h: Math.min(h, H - y) })
    }
  }

  const onMouseUp = () => { setDragging(false); setResizing(null) }

  const handleCrop = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const { scale, dx, dy } = getImgTransform()
    const sx = (box.x - dx) / scale
    const sy = (box.y - dy) / scale
    const sw = box.w / scale
    const sh = box.h / scale
    const out = document.createElement('canvas')
    out.width = 400; out.height = 400
    out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, 400, 400)
    out.toBlob(blob => onCrop(blob), 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ color: '#fff', fontSize: 13, marginBottom: 10, opacity: 0.8 }}>拖动方框选择裁剪区域，拖动角点调整大小</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', width: 460, height: 340, background: '#111', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <img ref={imgRef} src={src} alt="crop"
            onLoad={() => { setImgReady(true) }}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
          <canvas ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
            onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ color: '#fff', fontSize: 12, opacity: 0.7 }}>预览效果</div>
          <canvas ref={previewRef} style={{ width: 120, height: 120, borderRadius: 8, border: '2px solid #c8f135', background: '#111' }} />
          <div style={{ color: '#aaa', fontSize: 11 }}>卡片缩略图</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 20px', fontSize: 14, cursor: 'pointer' }}>取消</button>
        <button onClick={handleCrop} style={{ background: '#c8f135', color: '#000', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={15} /> 确认裁剪
        </button>
      </div>
    </div>
  )
}

function CardDetail({ card, onClose, onDeleted, onUpdated }) {
  const [sales, setSales] = useState([])
  const [txns, setTxns] = useState([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(card.photo_url)
  const [cropSrc, setCropSrc] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('card_sales').select('*').eq('card_id', card.id).then(({ data }) => setSales(data || []))
    supabase.from('transaction_legs').select('*, transactions(date, type, notes)').eq('card_id', card.id).then(({ data }) => setTxns(data || []))
  }, [card.id])

  const saleInfo = sales[0]
  const pnl = saleInfo ? saleInfo.sale_price - card.actual_cost : null

  const getDuration = () => {
    const buyLeg = txns.find(l => l.direction === 'in')
    if (!buyLeg?.transactions?.date) return '—'
    const start = new Date(buyLeg.transactions.date)
    const end = card.status === 'sold' && saleInfo ? new Date(saleInfo.sale_date) : new Date()
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24))
    if (days < 30) return `${days} 天`
    if (days < 365) return `${Math.floor(days / 30)} 个月 ${days % 30} 天`
    return `${Math.floor(days / 365)} 年 ${Math.floor((days % 365) / 30)} 个月`
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCropSrc(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCrop = async (blob) => {
    setCropSrc(null)
    setUploading(true)
    const path = `cards/${card.id}.jpg`
    await supabase.storage.from('card-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
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
    <>
      {cropSrc && <ImageCropper src={cropSrc} onCrop={handleCrop} onCancel={() => setCropSrc(null)} />}
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
          <div className="modal-photo" style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.outline = '2px solid var(--accent)' }}
            onDragLeave={e => { e.currentTarget.style.outline = '' }}
            onDrop={e => {
              e.preventDefault()
              e.currentTarget.style.outline = ''
              const file = e.dataTransfer.files[0]
              if (file && file.type.startsWith('image/')) {
                const reader = new FileReader()
                reader.onload = (ev) => setCropSrc(ev.target.result)
                reader.readAsDataURL(file)
              }
            }}
          >
            {photoUrl
              ? <img src={photoUrl} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🃏</div>
            }
            <div className="photo-hover-overlay">
              <Camera size={22} />
              <span>{uploading ? '上传中...' : '点击更换照片'}</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
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
                  <div className="detail-label">认可 Value</div>
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
                <div className="detail-value" style={{ fontSize: 12 }}>{card.source_type === 'cash' ? 'Cash 购入' : 'Trade 得到'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label"><Calendar size={12} /> 持有时长</div>
                <div className="detail-value" style={{ fontSize: 14 }}>{getDuration()}</div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
    </>
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

  const [search, setSearch] = useState('')
  const filtered = cards.filter(c => {
    const matchFilter = filter === 'all' ? true : c.status === filter
    const matchSearch = search === '' ? true : c.name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })
  if (loading) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      {selected && <CardDetail card={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load() }} onUpdated={() => load()} />}

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

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        <input placeholder="搜索卡牌名称..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}><X size={14} /></button>}
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
                  {card.agreed_value && <div className="cost-item purple"><span className="cost-label">认可 Value</span><span className="cost-val">${card.agreed_value?.toLocaleString()}</span></div>}
                </div>
                <div className="card-source"><ArrowRight size={11} />{card.source_type === 'cash' ? 'Cash 购入' : card.source_card?.name ? `来自 ${card.source_card.name}` : '来自 Trade'}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>卡牌</th><th>实际成本</th><th>认可 Value</th><th>来源</th><th>状态</th></tr></thead>
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
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{card.source_type === 'cash' ? 'Cash 购入' : card.source_card?.name ? `来自 ${card.source_card.name}` : '来自 Trade'}</td>
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