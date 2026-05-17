import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, Plus, Handshake } from 'lucide-react'
import './pages.css'

export default function AddTransaction({ onSaved }) {
  const [type, setType] = useState('buy')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // buy
  const [buyCardName, setBuyCardName] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [buyPhoto, setBuyPhoto] = useState(null)
  const [buyPhotoPreview, setBuyPhotoPreview] = useState(null)

  // sell
  const [sellCard, setSellCard] = useState(null)
  const [salePrice, setSalePrice] = useState('')

  // trade
  const [tradeOutCard, setTradeOutCard] = useState(null)
  const [tradeOutCash, setTradeOutCash] = useState('')
  const [tradeInRows, setTradeInRows] = useState([{ name: '', agreedValue: '', cash: '' }])

  const [card库, setCard库] = useState([])
  const [showSellPicker, setShowSellPicker] = useState(false)
  const [showOutPicker, setShowOutPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')

  useEffect(() => {
    supabase.from('cards').select('*').eq('status', 'holding').then(({ data }) => setCard库(data || []))
  }, [])

  const filtered库 = cardku => cardku.filter(c => c.name.toLowerCase().includes(pickerQuery.toLowerCase()))

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
    setSaving(true)
    setMsg(null)
    try {
      if (type === 'buy') {
        const { data: txn } = await supabase.from('transactions').insert({ type: 'buy', date, notes }).select().single()
        const { data: card } = await supabase.from('cards').insert({
          name: buyCardName, source_type: 'cash', actual_cost: parseFloat(buyAmount), status: 'holding'
        }).select().single()
        let photoUrl = null
        if (buyPhoto) photoUrl = await uploadPhoto(buyPhoto, card.id)
        if (photoUrl) await supabase.from('cards').update({ photo_url: photoUrl }).eq('id', card.id)
        await supabase.from('transaction_legs').insert([
          { transaction_id: txn.id, direction: 'in', card_id: card.id, cash_amount: parseFloat(buyAmount) }
        ])
      }

      if (type === 'sell') {
        if (!sellCard) { setMsg('请选择要卖出的卡'); setSaving(false); return }
        const { data: txn } = await supabase.from('transactions').insert({ type: 'sell', date, notes }).select().single()
        await supabase.from('transaction_legs').insert([
          { transaction_id: txn.id, direction: 'out', card_id: sellCard.id }
        ])
        await supabase.from('card_sales').insert({
          card_id: sellCard.id, transaction_id: txn.id,
          sale_price: parseFloat(salePrice), sale_date: date
        })
        await supabase.from('cards').update({ status: 'sold' }).eq('id', sellCard.id)
      }

      if (type === 'trade') {
        if (!tradeOutCard) { setMsg('请选择付出的卡'); setSaving(false); return }
        const { data: txn } = await supabase.from('transactions').insert({ type: 'trade', date, notes }).select().single()

        const totalCashIn = tradeInRows.reduce((s, r) => s + (parseFloat(r.cash) || 0), 0)
        const totalCashBack = parseFloat(tradeOutCash) || 0
        const outCardCost = tradeOutCard.actual_cost || 0
        const netCashOut = outCardCost - totalCashBack - totalCashIn

        await supabase.from('transaction_legs').insert([
          { transaction_id: txn.id, direction: 'out', card_id: tradeOutCard.id, cash_amount: totalCashBack }
        ])
        await supabase.from('cards').update({ status: 'sold' }).eq('id', tradeOutCard.id)

        const validInRows = tradeInRows.filter(r => r.name.trim())
        const totalAgreedValue = validInRows.reduce((s, r) => s + (parseFloat(r.agreedValue) || 0), 0)

        for (const row of validInRows) {
          const rowAgreed = parseFloat(row.agreedValue) || 0
          const share = totalAgreedValue > 0 ? rowAgreed / totalAgreedValue : 1 / validInRows.length
          const cardCost = Math.round(netCashOut * share * 100) / 100

          const { data: newCard } = await supabase.from('cards').insert({
            name: row.name,
            source_type: 'trade',
            source_card_id: tradeOutCard.id,
            agreed_value: rowAgreed || null,
            actual_cost: cardCost,
            status: 'holding'
          }).select().single()

          await supabase.from('transaction_legs').insert([{
            transaction_id: txn.id,
            direction: 'in',
            card_id: newCard.id,
            agreed_value: rowAgreed || null,
            cash_amount: parseFloat(row.cash) || 0
          }])
        }
      }

      setMsg('success')
      setTimeout(() => onSaved(), 800)
    } catch (e) {
      setMsg('保存失败，请检查输入：' + e.message)
    }
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>新增交易</h1>
        <p className="page-sub">记录买入、卖出或 Trade</p>
      </div>

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
          <div className="form-group">
            <label>交易日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* 买入 */}
        {type === 'buy' && (
          <>
            <div className="form-group">
              <label>卡牌名称</label>
              <input placeholder="例：LeBron James 2003 Topps Chrome RC" value={buyCardName} onChange={e => setBuyCardName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>购入金额（$）</label>
              <input type="number" placeholder="0.00" value={buyAmount} onChange={e => setBuyAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label>卡牌照片（可选）</label>
              <label className="photo-upload">
                {buyPhotoPreview
                  ? <img src={buyPhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                  : <><span style={{ fontSize: 28 }}>📷</span><span>点击上传照片</span></>
                }
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
            </div>
          </>
        )}

        {/* 卖出 */}
        {type === 'sell' && (
          <>
            <div className="form-group">
              <label>选择卖出的卡</label>
              {sellCard
                ? <div className="selected-pill">{sellCard.name} <button onClick={() => setSellCard(null)}><X size={13} /></button></div>
                : (
                  <div className="picker-wrap">
                    <div className="picker-search"><Search size={14} /><input placeholder="搜索卡库..." value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} onFocus={() => setShowSellPicker(true)} /></div>
                    {showSellPicker && (
                      <div className="picker-list">
                        {filtered库(cardku).map(c => (
                          <div key={c.id} className="picker-item" onClick={() => { setSellCard(c); setShowSellPicker(false); setPickerQuery('') }}>
                            <span>{c.name}</span><span className="picker-cost">成本 ${c.actual_cost?.toLocaleString()}</span>
                          </div>
                        ))}
                        {filtered库(cardku).length === 0 && <div className="picker-empty">没有找到卡牌</div>}
                      </div>
                    )}
                  </div>
                )
              }
            </div>
            {sellCard && (
              <div className="form-group">
                <label>卖出价格（$）</label>
                <input type="number" placeholder="0.00" value={salePrice} onChange={e => setSalePrice(e.target.value)} />
                <div className="form-hint">成本 ${sellCard.actual_cost?.toLocaleString()}{sellCard.agreed_value ? `，认可价值 $${sellCard.agreed_value?.toLocaleString()}` : ''}</div>
              </div>
            )}
          </>
        )}

        {/* Trade */}
        {type === 'trade' && (
          <div className="trade-wrap">
            <div className="trade-side">
              <div className="trade-side-label">📤 我付出（out）</div>
              {tradeOutCard
                ? <div className="selected-pill">{tradeOutCard.name} <span style={{ color: 'var(--text3)', fontSize: 12 }}>成本 ${tradeOutCard.actual_cost?.toLocaleString()}</span> <button onClick={() => setTradeOutCard(null)}><X size={13} /></button></div>
                : (
                  <div className="picker-wrap">
                    <div className="picker-search"><Search size={14} /><input placeholder="从卡库选择..." value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} onFocus={() => setShowOutPicker(true)} /></div>
                    {showOutPicker && (
                      <div className="picker-list">
                        {filtered库(cardku).map(c => (
                          <div key={c.id} className="picker-item" onClick={() => { setTradeOutCard(c); setShowOutPicker(false); setPickerQuery('') }}>
                            <span>{c.name}</span><span className="picker-cost">成本 ${c.actual_cost?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              <div className="form-group" style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12 }}>我额外收到的现金（$，没有填0）</label>
                <input type="number" placeholder="0" value={tradeOutCash} onChange={e => setTradeOutCash(e.target.value)} />
              </div>
            </div>

            <div className="trade-divider">⇄</div>

            <div className="trade-side">
              <div className="trade-side-label">📥 我得到（in）</div>
              {tradeInRows.map((row, i) => (
                <div key={i} className="trade-in-row">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input placeholder="卡牌名称" value={row.name} onChange={e => { const r=[...tradeInRows]; r[i].name=e.target.value; setTradeInRows(r) }} style={{ flex: 2 }} />
                    {tradeInRows.length > 1 && <button className="icon-btn" onClick={() => setTradeInRows(tradeInRows.filter((_,j) => j!==i))}><X size={13} /></button>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}><Handshake size={11} /> 双方认可价值（$）</label>
                      <input type="number" placeholder="0" value={row.agreedValue} onChange={e => { const r=[...tradeInRows]; r[i].agreedValue=e.target.value; setTradeInRows(r) }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>附加现金（$）</label>
                      <input type="number" placeholder="0" value={row.cash} onChange={e => { const r=[...tradeInRows]; r[i].cash=e.target.value; setTradeInRows(r) }} />
                    </div>
                  </div>
                </div>
              ))}
              <button className="add-row-btn" onClick={() => setTradeInRows([...tradeInRows, { name: '', agreedValue: '', cash: '' }])}>
                <Plus size={13} /> 添加更多卡
              </button>

              {tradeOutCard && (
                <div className="cost-preview">
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>成本预览</div>
                  {tradeInRows.filter(r => r.name).map((row, i) => {
                    const totalAgreed = tradeInRows.reduce((s,r) => s+(parseFloat(r.agreedValue)||0), 0)
                    const totalCashBack = parseFloat(tradeOutCash)||0
                    const totalCashIn = tradeInRows.reduce((s,r) => s+(parseFloat(r.cash)||0), 0)
                    const net = (tradeOutCard.actual_cost||0) - totalCashBack - totalCashIn
                    const share = totalAgreed > 0 ? (parseFloat(row.agreedValue)||0)/totalAgreed : 1/tradeInRows.filter(r=>r.name).length
                    const cost = Math.round(net * share * 100) / 100
                    return (
                      <div key={i} style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{row.name || '新卡'}</span>
                        <span>实际成本 ${cost.toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>备注（可选）</label>
          <input placeholder="交易备注" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {msg === 'success' && <div className="msg-success">✅ 保存成功！跳转中...</div>}
        {msg && msg !== 'success' && <div className="msg-error">⚠️ {msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-secondary" onClick={() => window.history.back()}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '✓ 保存交易'}
          </button>
        </div>
      </div>
    </div>
  )
}

// closure fix
function cardku(arr) { return arr }
