import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, Plus, Users } from 'lucide-react'
import './pages.css'

function CardPicker({ cards, onSelect, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const filtered = cards.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="picker-wrap" ref={ref}>
      <div className="picker-search">
        <Search size={14} />
        <input placeholder={placeholder || '搜索卡库...'} value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setOpen(true)} />
      </div>
      {open && (
        <div className="picker-list">
          {filtered.length === 0 ? <div className="picker-empty">没有找到卡牌</div> : filtered.map(c => (
            <div key={c.id} className="picker-item" onMouseDown={() => { onSelect(c); setOpen(false); setQuery('') }}>
              <span>{c.name}</span><span className="picker-cost">成本 ${c.actual_cost?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AddTransaction({ onSaved, navigate }) {
  const [type, setType] = useState('buy')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [buyCardName, setBuyCardName] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [buyPhoto, setBuyPhoto] = useState(null)
  const [buyPhotoPreview, setBuyPhotoPreview] = useState(null)
  const [sellCard, setSellCard] = useState(null)
  const [salePrice, setSalePrice] = useState('')
  const [tradeOutCards, setTradeOutCards] = useState([])
  const [tradeOutCash, setTradeOutCash] = useState('')
  const [tradeInRows, setTradeInRows] = useState([{ name: '', agreedValue: '' }])
  const [tradeInCash, setTradeInCash] = useState('')
  const [holdingCards, setHoldingCards] = useState([])

  useEffect(() => {
    supabase.from('cards').select('*').eq('status', 'holding').then(({ data }) => setHoldingCards(data || []))
  }, [])

  const availableForOut = holdingCards.filter(c => !tradeOutCards.find(s => s.id === c.id))

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setBuyPhoto(file)
    setBuyPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async (file, cardId) => {
    const ext = file.name.split('.').pop()
    const path = `cards/${cardId}.${ext}`
    const { error } = await supabase.storage.from('card-photos').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('card-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      if (type === 'buy') {
        if (!buyCardName || !buyAmount) { setMsg('请填写卡牌名称和金额'); setSaving(false); return }
        const { data: txn } = await supabase.from('transactions').insert({ type: 'buy', date, notes }).select().single()
        const { data: card } = await supabase.from('cards').insert({ name: buyCardName, source_type: 'cash', actual_cost: parseFloat(buyAmount), agreed_value: Math.round(parseFloat(buyAmount) / 0.88), status: 'holding' }).select().single()
        let photoUrl = null
        if (buyPhoto) photoUrl = await uploadPhoto(buyPhoto, card.id)
        if (photoUrl) await supabase.from('cards').update({ photo_url: photoUrl }).eq('id', card.id)
        await supabase.from('transaction_legs').insert([{ transaction_id: txn.id, direction: 'in', card_id: card.id, cash_amount: parseFloat(buyAmount) }])
      }
      if (type === 'sell') {
        if (!sellCard) { setMsg('请选择要卖出的卡'); setSaving(false); return }
        if (!salePrice) { setMsg('请填写卖出价格'); setSaving(false); return }
        const { data: txn } = await supabase.from('transactions').insert({ type: 'sell', date, notes }).select().single()
        await supabase.from('transaction_legs').insert([{ transaction_id: txn.id, direction: 'out', card_id: sellCard.id }])
        await supabase.from('card_sales').insert({ card_id: sellCard.id, transaction_id: txn.id, sale_price: parseFloat(salePrice), sale_date: date })
        await supabase.from('cards').update({ status: 'sold' }).eq('id', sellCard.id)
      }
      if (type === 'trade') {
        if (tradeOutCards.length === 0) { setMsg('请至少选择一张付出的卡'); setSaving(false); return }
        const validInRows = tradeInRows.filter(r => r.name.trim())
        if (validInRows.length === 0) { setMsg('请填写至少一张得到的卡'); setSaving(false); return }
        const { data: txn } = await supabase.from('transactions').insert({ type: 'trade', date, notes }).select().single()
        const cashOut = parseFloat(tradeOutCash) || 0
        const cashIn = parseFloat(tradeInCash) || 0
        const totalOutCost = tradeOutCards.reduce((s, c) => s + (c.actual_cost || 0), 0)
        for (const c of tradeOutCards) {
          await supabase.from('transaction_legs').insert([{ transaction_id: txn.id, direction: 'out', card_id: c.id, cash_amount: 0 }])
          await supabase.from('cards').update({ status: 'sold' }).eq('id', c.id)
        }
        if (cashOut > 0) await supabase.from('transaction_legs').insert([{ transaction_id: txn.id, direction: 'out', card_id: null, card_name_manual: 'Cash', cash_amount: cashOut }])
        const netCost = totalOutCost + cashOut - cashIn
        const totalAgreedValue = validInRows.reduce((s, r) => s + (parseFloat(r.agreedValue) || 0), 0)
        for (const row of validInRows) {
          const rowAgreed = parseFloat(row.agreedValue) || 0
          const share = totalAgreedValue > 0 ? rowAgreed / totalAgreedValue : 1 / validInRows.length
          const cardCost = Math.round(netCost * share * 100) / 100
          const { data: newCard } = await supabase.from('cards').insert({ name: row.name, source_type: 'trade', source_card_id: tradeOutCards[0]?.id || null, agreed_value: rowAgreed || null, actual_cost: cardCost, status: 'holding' }).select().single()
          await supabase.from('transaction_legs').insert([{ transaction_id: txn.id, direction: 'in', card_id: newCard.id, agreed_value: rowAgreed || null, cash_amount: 0 }])
        }
        if (cashIn > 0) await supabase.from('transaction_legs').insert([{ transaction_id: txn.id, direction: 'in', card_id: null, card_name_manual: 'Cash', cash_amount: cashIn }])
      }
      setMsg('success')
      setTimeout(() => onSaved(), 800)
    } catch (e) { setMsg('保存失败：' + e.message) }
    setSaving(false)
  }

  const totalOutCost = tradeOutCards.reduce((s, c) => s + (c.actual_cost || 0), 0)
  const cashOut = parseFloat(tradeOutCash) || 0
  const cashIn = parseFloat(tradeInCash) || 0
  const netCost = totalOutCost + cashOut - cashIn
  const totalAgreed = tradeInRows.reduce((s, r) => s + (parseFloat(r.agreedValue) || 0), 0)

  return (
    <div className="page">
      <div className="page-header"><h1>新增交易</h1><p className="page-sub">记录买入、卖出或 Trade</p></div>
      <div className="form-card">
        <div className="form-row">
          <div className="form-group">
            <label>交易类型</label>
            <div className="type-tabs">
              {[['buy','买入'],['sell','卖出'],['trade','Trade']].map(([v,l]) => (
                <button key={v} className={`type-tab ${type===v?'active':''}`} onClick={() => setType(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-group"><label>交易日期</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>

        {type === 'buy' && (<>
          <div className="form-group"><label>卡牌名称</label><input placeholder="例：LeBron James 2003 Topps Chrome RC" value={buyCardName} onChange={e => setBuyCardName(e.target.value)} /></div>
          <div className="form-group"><label>购入金额（$）</label><input type="number" placeholder="0.00" value={buyAmount} onChange={e => setBuyAmount(e.target.value)} /></div>
          <div className="form-group"><label>卡牌照片（可选）</label>
            <label className="photo-upload"
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '' }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { setBuyPhoto(file); setBuyPhotoPreview(URL.createObjectURL(file)) } }}
            >
              {buyPhotoPreview ? <img src={buyPhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : <><span style={{ fontSize: 28 }}>📷</span><span>点击或拖拽上传照片</span></>}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </div>
        </>)}

        {type === 'sell' && (<>
          <div className="form-group"><label>选择卖出的卡</label>
            {sellCard ? <div className="selected-pill">{sellCard.name} <button onClick={() => setSellCard(null)}><X size={13} /></button></div> : <CardPicker cards={holdingCards} onSelect={setSellCard} placeholder="搜索持仓卡牌..." />}
          </div>
          {sellCard && (<div className="form-group"><label>卖出价格（$）</label><input type="number" placeholder="0.00" value={salePrice} onChange={e => setSalePrice(e.target.value)} /><div className="form-hint">成本 ${sellCard.actual_cost?.toLocaleString()}{sellCard.agreed_value ? `，认可Value $${sellCard.agreed_value?.toLocaleString()}` : ''}</div></div>)}
        </>)}

        {type === 'trade' && (
          <div className="trade-wrap">
            <div className="trade-side">
              <div className="trade-side-label">📤 我付出（out）</div>
              {tradeOutCards.map(c => (
                <div key={c.id} className="selected-pill" style={{ marginBottom: 6 }}>
                  {c.name}<span style={{ color: 'var(--text3)', fontSize: 12 }}>成本 ${c.actual_cost?.toLocaleString()}</span>
                  <button onClick={() => setTradeOutCards(tradeOutCards.filter(x => x.id !== c.id))}><X size={13} /></button>
                </div>
              ))}
              <CardPicker cards={availableForOut} onSelect={c => setTradeOutCards([...tradeOutCards, c])} placeholder={tradeOutCards.length === 0 ? '从卡库选择...' : '+ 再添加一张卡'} />
              <div className="form-group" style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12 }}>我额外付出Cash（$，没有填0）</label>
                <input type="number" placeholder="0" value={tradeOutCash} onChange={e => setTradeOutCash(e.target.value)} />
              </div>
{tradeOutCards.length > 0 && (
  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.8 }}>
    <div>付出卡总成本：${totalOutCost.toLocaleString()}{cashOut > 0 && ` + Cash $${cashOut.toLocaleString()}`}</div>
    <div>预计付出总 Value：
      {cashOut > 0 && `Cash $${cashOut.toLocaleString()} + `}
      Value ${tradeOutCards.reduce((s, c) => s + (c.agreed_value || 0), 0).toLocaleString()}
    </div>
  </div>
)}            </div>

            <div className="trade-divider">⇄</div>

            <div className="trade-side">
              <div className="trade-side-label">📥 我得到（in）</div>
              {tradeInRows.map((row, i) => (
                <div key={i} className="trade-in-row">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input placeholder="卡牌名称" value={row.name} onChange={e => { const r=[...tradeInRows]; r[i].name=e.target.value; setTradeInRows(r) }} style={{ flex: 2 }} />
                    {tradeInRows.length > 1 && <button className="icon-btn" onClick={() => setTradeInRows(tradeInRows.filter((_,j) => j!==i))}><X size={13} /></button>}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> 双方认可Value（$）</label>
                    <input type="number" placeholder="0" value={row.agreedValue} onChange={e => { const r=[...tradeInRows]; r[i].agreedValue=e.target.value; setTradeInRows(r) }} />
                  </div>
                </div>
              ))}
              <button className="add-row-btn" onClick={() => setTradeInRows([...tradeInRows, { name: '', agreedValue: '' }])}><Plus size={13} /> 添加更多卡</button>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12 }}>我额外收到的Cash（$，没有填0）</label>
                <input type="number" placeholder="0" value={tradeInCash} onChange={e => setTradeInCash(e.target.value)} />
              </div>
              {tradeOutCards.length > 0 && tradeInRows.some(r => r.name) && (
                <div className="cost-preview">
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>净成本预览（总共 ${netCost.toLocaleString()}）</div>
                  {tradeInRows.filter(r => r.name).map((row, i) => {
                    const rowAgreed = parseFloat(row.agreedValue) || 0
                    const share = totalAgreed > 0 ? rowAgreed / totalAgreed : 1 / tradeInRows.filter(r=>r.name).length
                    const cost = Math.round(netCost * share * 100) / 100
                    return (<div key={i} style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>{row.name}</span><span>实际成本 ${cost.toLocaleString()}</span></div>)
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group"><label>备注（可选）</label><input placeholder="交易备注" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        {msg === 'success' && <div className="msg-success">✅ 保存成功！跳转中...</div>}
        {msg && msg !== 'success' && <div className="msg-error">⚠️ {msg}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-secondary" onClick={() => navigate('dashboard')}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '✓ 保存交易'}</button>
        </div>
      </div>
    </div>
  )
}