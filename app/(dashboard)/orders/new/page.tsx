'use client'
// app/(dashboard)/orders/new/page.tsx — Booking Form (Module 2) với validation (PRD 5.4 / 15.14)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import Avatar from '@/components/Avatar'
import { invalidateCache } from '@/lib/cache'
import { DEFAULT_SLOT_TIMES } from '@/lib/config'
import { useBootstrap } from '@/lib/useBootstrap'
import { money, fmtDay } from '@/lib/format'
import { SALE_CHANNELS, CUSTOMER_SOURCES } from '@/lib/status'
import { computeTotal, addMinutes, minutesOf } from '@/lib/booking'
import { Service, Voucher, Location, StaffAvailable, AddonCatalog, CustomerSearchItem } from '@/lib/types'

interface ConceptState {
  key: number
  service_id: string
  custom_price: string
  voucher_id: string
  assigned_photographer_id: string
  assigned_mua_id: string
  assigned_hau_ky_id: string
  assigned_support_id: string
  reference_photo_urls: string[]
  refInput: string
  notes: string
}
interface AddonState { key: number; addon_catalog_id: string; quantity: number; actual_price: string }

let _ck = 0
function emptyConcept(): ConceptState {
  return {
    key: ++_ck, service_id: '', custom_price: '', voucher_id: '',
    assigned_photographer_id: '', assigned_mua_id: '', assigned_hau_ky_id: '', assigned_support_id: '',
    reference_photo_urls: [], refInput: '', notes: '',
  }
}

export default function NewOrderPage() {
  const router = useRouter()
  const toast = useToast()
  const { user } = useAuth()

  // ── Static data ──
  const [services, setServices] = useState<Service[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [addonCatalog, setAddonCatalog] = useState<AddonCatalog[]>([])
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOT_TIMES)
  const [staff, setStaff] = useState<StaffAvailable[]>([])

  // ── Form state ──
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [lookup, setLookup] = useState<CustomerSearchItem | null>(null)

  const [locationId, setLocationId] = useState('')
  const [saleChannel, setSaleChannel] = useState('ONLINE')
  const [shootDate, setShootDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [makeupStart, setMakeupStart] = useState('')
  const [makeupDuration, setMakeupDuration] = useState('30')

  const [concepts, setConcepts] = useState<ConceptState[]>([emptyConcept()])
  const [addons, setAddons] = useState<AddonState[]>([])
  const [orderVoucherId, setOrderVoucherId] = useState('')
  const [deposit, setDeposit] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // ── Load static data — 1 call bootstrap (đã cache cả phiên) thay vì 5 call ──
  const { data: boot } = useBootstrap()
  useEffect(() => {
    if (!boot) return
    setServices(boot.services)
    setVouchers(boot.vouchers)
    setLocations(boot.locations)
    setAddonCatalog(boot.addons)
    if (boot.slot_times?.length) setSlots(boot.slot_times)
  }, [boot])
  useEffect(() => {
    if (user?.default_location_id) setLocationId(user.default_location_id)
  }, [user])

  // ── Phone lookup (debounce 400ms) ──
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const clean = phone.replace(/\s/g, '')
    if (clean.length < 9) { setLookup(null); return }
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    lookupTimer.current = setTimeout(() => {
      gasApi<{ customers: CustomerSearchItem[] }>('customers.search', { phone: clean })
        .then((d) => setLookup(d.customers[0] || null))
        .catch(() => {})
    }, 400)
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current) }
  }, [phone])

  const useFoundCustomer = (c: CustomerSearchItem) => {
    setCustomerId(c.customer_id); setName(c.name); setPhone(c.phone)
    setSource(c.source || ''); setAvatarUrl(c.avatar_url); setLookup(null)
  }

  // ── Tính giờ + tổng ──
  const shootDuration = useMemo(() => concepts.reduce((s, c) => {
    const svc = services.find((x) => x.service_id === c.service_id)
    return s + (svc?.duration_minutes || 0)
  }, 0), [concepts, services])

  const shootStart = useMemo(() => addMinutes(makeupStart || arrivalTime, Number(makeupDuration) || 0), [makeupStart, arrivalTime, makeupDuration])
  const estimatedEnd = useMemo(() => addMinutes(shootStart, shootDuration), [shootStart, shootDuration])

  const totals = useMemo(() => computeTotal(
    concepts.map((c) => ({ service_id: c.service_id, custom_price: c.custom_price, voucher_id: c.voucher_id || null })),
    addons.map((a) => ({ addon_catalog_id: a.addon_catalog_id, quantity: a.quantity, actual_price: Number(a.actual_price) || 0 })),
    orderVoucherId || null, vouchers,
  ), [concepts, addons, orderVoucherId, vouchers])

  const deliveryType = useMemo(() => {
    const hasPrintSvc = concepts.some((c) => services.find((s) => s.service_id === c.service_id)?.includes_print)
    const hasPrintAddon = addons.some((a) => {
      const cat = addonCatalog.find((x) => x.addon_id === a.addon_catalog_id)?.category
      return cat === 'PRINT' || cat === 'PRINT_ALBUM' || cat === 'CANVAS' || cat === 'FRAME'
    })
    return hasPrintSvc || hasPrintAddon ? 'PRINT' : 'DIGITAL'
  }, [concepts, addons, services, addonCatalog])

  // ── Staff availability (refetch debounce) ──
  const staffTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!locationId || !shootDate || !(makeupStart || arrivalTime)) { setStaff([]); return }
    if (staffTimer.current) clearTimeout(staffTimer.current)
    staffTimer.current = setTimeout(() => {
      gasApi<{ staff: StaffAvailable[] }>('staff.available', {
        location_id: locationId, shoot_date: shootDate,
        makeup_start: makeupStart || arrivalTime, makeup_duration: makeupDuration, shoot_duration: shootDuration,
      }).then((d) => setStaff(d.staff)).catch(() => {})
    }, 500)
    return () => { if (staffTimer.current) clearTimeout(staffTimer.current) }
  }, [locationId, shootDate, makeupStart, arrivalTime, makeupDuration, shootDuration])

  const staffByRole = useCallback((role: string) => staff.filter((s) => s.role_id === role), [staff])

  // ── Concept helpers ──
  const updConcept = (key: number, patch: Partial<ConceptState>) =>
    setConcepts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const pickService = (key: number, serviceId: string) => {
    const svc = services.find((s) => s.service_id === serviceId)
    updConcept(key, { service_id: serviceId, custom_price: svc ? String(svc.suggested_price) : '' })
  }

  const addRef = (key: number) => {
    const c = concepts.find((x) => x.key === key)!
    const url = c.refInput.trim()
    if (!url || c.reference_photo_urls.length >= 10) return
    updConcept(key, { reference_photo_urls: [...c.reference_photo_urls, url], refInput: '' })
  }
  const removeRef = (key: number, idx: number) => {
    const c = concepts.find((x) => x.key === key)!
    updConcept(key, { reference_photo_urls: c.reference_photo_urls.filter((_, i) => i !== idx) })
  }

  // ── Slot pick ──
  const pickSlot = (t: string) => { setArrivalTime(t); if (!makeupStart) setMakeupStart(t) }

  // ── Validate (mirror server) ──
  const validate = (): string[] => {
    const e: string[] = []
    if (!name.trim()) e.push('Thiếu tên khách hàng')
    const cleanPhone = phone.replace(/\s/g, '')
    if (!cleanPhone) e.push('Thiếu số điện thoại')
    else if (!/^0\d{8,10}$/.test(cleanPhone)) e.push('SĐT không đúng định dạng (vd 0901234567)')
    if (!locationId) e.push('Phải chọn cơ sở')
    if (!shootDate) e.push('Thiếu ngày chụp')
    else if (shootDate < new Date().toISOString().slice(0, 10)) e.push('Ngày chụp không được ở quá khứ')
    if (!arrivalTime && !makeupStart) e.push('Thiếu giờ KH có mặt / makeup')
    concepts.forEach((c, i) => {
      if (!c.service_id) e.push(`Concept ${i + 1}: chưa chọn dịch vụ`)
      if (c.custom_price === '' || Number(c.custom_price) < 0) e.push(`Concept ${i + 1}: giá báo không hợp lệ`)
      if (i + 1 >= 2 && !c.voucher_id) e.push(`Concept ${i + 1}: bắt buộc chọn voucher`)
    })
    const dep = Number(deposit) || 0
    if (dep < 0) e.push('Tiền cọc không hợp lệ')
    if (dep > totals.total) e.push(`Tiền cọc (${money(dep)}) không được lớn hơn tổng (${money(totals.total)})`)
    // double-booking client-side cảnh báo
    const busy = staff.filter((s) => s.busy).map((s) => s.user_id)
    concepts.forEach((c, i) => {
      [c.assigned_photographer_id, c.assigned_mua_id, c.assigned_support_id].forEach((sid) => {
        if (sid && busy.includes(sid)) e.push(`Concept ${i + 1}: nhân sự đã có lịch trùng giờ`)
      })
    })
    return e
  }

  const submit = async () => {
    const e = validate()
    setErrors(e)
    if (e.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setSubmitting(true)
    try {
      const data = {
        customer_id: customerId, customer_name: name.trim(), customer_phone: phone.replace(/\s/g, ''),
        source, avatar_url: avatarUrl,
        location_id: locationId, sale_channel: saleChannel, sale_staff_id: user?.user_id,
        shoot_date: shootDate, arrival_time: arrivalTime, makeup_start: makeupStart || arrivalTime,
        makeup_duration: Number(makeupDuration) || 0, shoot_duration: shootDuration,
        order_voucher_id: orderVoucherId || null, deposit_amount: Number(deposit) || 0,
        notes, status: 'BAO_GIA',
      }
      const conceptsPayload = concepts.map((c) => ({
        service_id: c.service_id, custom_price: Number(c.custom_price) || 0, voucher_id: c.voucher_id || null,
        assigned_photographer_id: c.assigned_photographer_id || null,
        assigned_mua_id: c.assigned_mua_id || null,
        assigned_hau_ky_id: c.assigned_hau_ky_id || null,
        assigned_support_id: c.assigned_support_id || null,
        reference_photo_urls: c.reference_photo_urls, notes: c.notes,
      }))
      const addonsPayload = addons.filter((a) => a.addon_catalog_id).map((a) => {
        const cat = addonCatalog.find((x) => x.addon_id === a.addon_catalog_id)
        return { addon_catalog_id: a.addon_catalog_id, quantity: a.quantity, catalog_price: cat?.sell_price || 0, actual_price: Number(a.actual_price) || 0 }
      })
      const res = await gasApi<{ order_id: string }>('orders.create', { data, concepts: conceptsPayload, addons: addonsPayload })
      invalidateCache('orders')
      toast('Đã tạo đơn ' + res.order_id)
      router.push('/orders/' + res.order_id)
    } catch (err) {
      const ge = err as GasError
      if (ge.appStatus === 409) setErrors([ge.message])
      else if (ge.appStatus === 400) setErrors([ge.message])
      else toast(ge.message || 'Không thể tạo đơn', 'error')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="row between"><h1 className="h1">Tạo đơn mới</h1>
        <button className="btn ghost" onClick={() => router.back()}>← Quay lại</button>
      </div>
      <p className="sub">Form validation nghiêm ngặt — điền đúng để tạo đơn ngay (không cần duyệt).</p>

      {errors.length > 0 && (
        <div className="note-box danger" style={{ marginBottom: 16 }}>
          <b>Vui lòng kiểm tra:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <div className="detail-grid">
        {/* ── Cột trái ── */}
        <div>
          {/* Khách hàng */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Khách hàng</h3>
            <div className="grid-2">
              <div className="field">
                <label className="label">Số điện thoại *</label>
                <input className="input" inputMode="numeric" placeholder="0901234567" value={phone} onChange={(e) => { setPhone(e.target.value); setCustomerId(null) }} />
                {lookup && (
                  <div className="lookup-result">
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={lookup.name} url={lookup.avatar_url} size="md" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>✓ {lookup.name}</div>
                        <div className="dim" style={{ fontSize: 12 }}>{lookup.order_count} đơn{lookup.last_order_date ? ` · Lần cuối ${fmtDay(lookup.last_order_date)}` : ''}</div>
                      </div>
                      <button type="button" className="btn sm" onClick={() => useFoundCustomer(lookup)}>Chọn KH này</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="field">
                <label className="label">Tên khách hàng *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Thị Mai" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Nguồn khách</label>
                <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">— Chọn nguồn —</option>
                  {CUSTOMER_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Ảnh đại diện KH (URL)</label>
                <input className="input" value={avatarUrl || ''} onChange={(e) => setAvatarUrl(e.target.value || null)} placeholder="https://… (tuỳ chọn)" />
              </div>
            </div>
          </div>

          {/* Lịch chụp */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Lịch & cơ sở</h3>
            <div className="grid-2">
              <div className="field">
                <label className="label">Cơ sở *</label>
                <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">— Chọn cơ sở —</option>
                  {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Kênh bán</label>
                <select className="input" value={saleChannel} onChange={(e) => setSaleChannel(e.target.value)}>
                  {SALE_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">Ngày chụp *</label>
              <input type="date" className="input" value={shootDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setShootDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Khung giờ KH có mặt *</label>
              <div className="row" style={{ gap: 8 }}>
                {slots.map((t) => (
                  <button type="button" key={t} className={'btn sm ' + (arrivalTime === t ? '' : 'ghost')} onClick={() => pickSlot(t)}>{t}</button>
                ))}
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div>
                  <label className="label">Hoặc nhập giờ tay</label>
                  <input type="time" className="input" value={arrivalTime} onChange={(e) => { setArrivalTime(e.target.value); if (!makeupStart) setMakeupStart(e.target.value) }} />
                </div>
                <div>
                  <label className="label">Giờ bắt đầu makeup</label>
                  <input type="time" className="input" value={makeupStart} onChange={(e) => setMakeupStart(e.target.value)} />
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div>
                  <label className="label">Thời gian makeup (phút)</label>
                  <input type="number" className="input" value={makeupDuration} onChange={(e) => setMakeupDuration(e.target.value)} />
                </div>
                <div>
                  <label className="label">Thời gian chụp (tự tính)</label>
                  <input className="input" disabled value={shootDuration + ' phút'} />
                </div>
              </div>
              {shootStart && (
                <div className="dim" style={{ marginTop: 8, fontSize: 12.5 }}>
                  Bắt đầu chụp ~{shootStart} · Kết thúc dự kiến ~{estimatedEnd}
                </div>
              )}
            </div>
          </div>

          {/* Concepts */}
          <div className="card">
            <div className="row between"><h3 style={{ margin: 0 }}>Concept</h3>
              <span className="dim" style={{ fontSize: 12.5 }}>Concept 2+ giảm 50% lương, bắt buộc voucher</span>
            </div>
            {concepts.map((c, i) => {
              const svc = services.find((s) => s.service_id === c.service_id)
              return (
                <div className="concept-block" key={c.key} style={{ marginTop: 12 }}>
                  <div className="concept-head">
                    <span className="ttl">Concept {i + 1}</span>
                    {i >= 1 && <span className="pill" style={{ background: 'rgba(169,128,47,.12)', color: 'var(--amber)' }}>giảm 50%</span>}
                    <span className="spacer" />
                    {concepts.length > 1 && <button type="button" className="btn ghost sm danger" onClick={() => setConcepts((p) => p.filter((x) => x.key !== c.key))}>✕ xoá</button>}
                  </div>
                  <div className="grid-2">
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">Dịch vụ *</label>
                      <select className="input" value={c.service_id} onChange={(e) => pickService(c.key, e.target.value)}>
                        <option value="">— Chọn dịch vụ —</option>
                        {services.map((s) => <option key={s.service_id} value={s.service_id}>{s.name} — {money(s.suggested_price)}</option>)}
                      </select>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">Giá báo KH *</label>
                      <input type="number" className="input" value={c.custom_price} onChange={(e) => updConcept(c.key, { custom_price: e.target.value })} />
                    </div>
                  </div>

                  {svc && svc.sample_photo_urls.length > 0 && (
                    <div className="thumbs" style={{ marginTop: 10 }}>
                      {svc.sample_photo_urls.slice(0, 4).map((u, idx) => (
                        <img key={idx} className="thumb sm" src={u} alt="" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                      ))}
                    </div>
                  )}

                  {i >= 1 && (
                    <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                      <label className="label">Voucher (bắt buộc) *</label>
                      <select className="input" value={c.voucher_id} onChange={(e) => updConcept(c.key, { voucher_id: e.target.value })}
                        style={{ borderColor: !c.voucher_id ? 'var(--red)' : undefined }}>
                        <option value="">— Chọn voucher —</option>
                        {vouchers.map((v) => <option key={v.voucher_id} value={v.voucher_id}>{v.code} ({v.type === 'PERCENT' ? v.value + '%' : money(v.value)})</option>)}
                      </select>
                    </div>
                  )}

                  {/* Phân công nhân sự */}
                  <div className="grid-2" style={{ marginTop: 12 }}>
                    <StaffSelect label="Photographer" role="photographer" value={c.assigned_photographer_id} options={staffByRole('photographer')} onChange={(v) => updConcept(c.key, { assigned_photographer_id: v })} />
                    <StaffSelect label="Makeup Artist" role="mua" value={c.assigned_mua_id} options={staffByRole('mua')} onChange={(v) => updConcept(c.key, { assigned_mua_id: v })} />
                  </div>
                  <div className="grid-2" style={{ marginTop: 0 }}>
                    <StaffSelect label="Hậu Kỳ" role="hau_ky" value={c.assigned_hau_ky_id} options={staffByRole('hau_ky')} onChange={(v) => updConcept(c.key, { assigned_hau_ky_id: v })} hideBusy />
                    <StaffSelect label="Support" role="support" value={c.assigned_support_id} options={staffByRole('support')} onChange={(v) => updConcept(c.key, { assigned_support_id: v })} />
                  </div>

                  {/* Moodboard */}
                  <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label className="label">Ảnh tham khảo / Moodboard ({c.reference_photo_urls.length}/10)</label>
                    {c.reference_photo_urls.length > 0 && (
                      <div className="thumbs" style={{ marginBottom: 8 }}>
                        {c.reference_photo_urls.map((u, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img className="thumb sm" src={u} alt="" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                            <button type="button" onClick={() => removeRef(c.key, idx)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--red)', color: '#fff', fontSize: 11 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="row" style={{ gap: 8 }}>
                      <input className="input" placeholder="https://pin.it/… (Pinterest, Drive…)" value={c.refInput} onChange={(e) => updConcept(c.key, { refInput: e.target.value })} style={{ flex: 1 }} />
                      <button type="button" className="btn ghost" onClick={() => addRef(c.key)} disabled={c.reference_photo_urls.length >= 10}>Thêm</button>
                    </div>
                  </div>

                  <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label className="label">Ghi chú concept</label>
                    <textarea className="input" value={c.notes} onChange={(e) => updConcept(c.key, { notes: e.target.value })} placeholder="Trang phục, yêu cầu riêng…" />
                  </div>
                </div>
              )
            })}
            <button type="button" className="btn ghost" onClick={() => setConcepts((p) => [...p, emptyConcept()])}>+ Thêm concept</button>
          </div>

          {/* Add-ons */}
          <div className="card">
            <div className="row between"><h3 style={{ margin: 0 }}>Add-on (dịch vụ phát sinh)</h3></div>
            {addons.map((a, i) => {
              const cat = addonCatalog.find((x) => x.addon_id === a.addon_catalog_id)
              return (
                <div className="row" key={a.key} style={{ marginTop: 10, gap: 8 }}>
                  <select className="input" style={{ flex: 2 }} value={a.addon_catalog_id} onChange={(e) => {
                    const c = addonCatalog.find((x) => x.addon_id === e.target.value)
                    setAddons((p) => p.map((x) => x.key === a.key ? { ...x, addon_catalog_id: e.target.value, actual_price: String(c?.sell_price || '') } : x))
                  }}>
                    <option value="">— Chọn add-on —</option>
                    {addonCatalog.map((x) => <option key={x.addon_id} value={x.addon_id}>{x.name} ({x.category})</option>)}
                  </select>
                  <input type="number" className="input" style={{ width: 80 }} value={a.quantity} min={1} onChange={(e) => setAddons((p) => p.map((x) => x.key === a.key ? { ...x, quantity: Number(e.target.value) || 1 } : x))} title="Số lượng" />
                  <input type="number" className="input" style={{ width: 130 }} value={a.actual_price} onChange={(e) => setAddons((p) => p.map((x) => x.key === a.key ? { ...x, actual_price: e.target.value } : x))} title="Giá bán thực tế" placeholder={cat ? String(cat.sell_price) : 'Giá'} />
                  <button type="button" className="btn ghost sm danger" onClick={() => setAddons((p) => p.filter((x) => x.key !== a.key))}>✕</button>
                </div>
              )
            })}
            <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => setAddons((p) => [...p, { key: ++_ck, addon_catalog_id: '', quantity: 1, actual_price: '' }])}>+ Thêm add-on</button>
          </div>
        </div>

        {/* ── Cột phải: tóm tắt tài chính ── */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <h3 style={{ marginTop: 0 }}>Tóm tắt</h3>
            <div className="finance-box">
              <div className="finance-row"><span className="lbl">Tạm tính</span><span className="val">{money(totals.subtotal)}</span></div>
              {totals.conceptDiscount > 0 && <div className="finance-row"><span className="lbl">Voucher concept 2+</span><span className="val red">− {money(totals.conceptDiscount)}</span></div>}
              {totals.orderDiscount > 0 && <div className="finance-row"><span className="lbl">Voucher đơn hàng</span><span className="val red">− {money(totals.orderDiscount)}</span></div>}
              <div className="finance-row total"><span className="lbl">Tổng đơn</span><span className="val">{money(totals.total)}</span></div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label className="label">Voucher toàn đơn</label>
              <select className="input" value={orderVoucherId} onChange={(e) => setOrderVoucherId(e.target.value)}>
                <option value="">— Không áp —</option>
                {vouchers.map((v) => <option key={v.voucher_id} value={v.voucher_id}>{v.code} ({v.type === 'PERCENT' ? v.value + '%' : money(v.value)})</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Tiền cọc</label>
              <input type="number" className="input" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" />
            </div>
            <div className="finance-row"><span className="lbl">Còn lại</span><span className="val">{money(Math.max(totals.total - (Number(deposit) || 0), 0))}</span></div>

            <div className="field" style={{ marginTop: 12 }}>
              <label className="label">Luồng giao hàng</label>
              <div className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>{deliveryType === 'PRINT' ? '🖨 In ấn' : '💾 Digital'}</div>
            </div>

            <div className="field">
              <label className="label">Ghi chú đơn</label>
              <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button className="btn press" style={{ width: '100%' }} onClick={submit} disabled={submitting}>
              {submitting ? 'Đang tạo…' : 'Tạo đơn'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Staff select với marker trùng lịch ──
function StaffSelect({ label, value, options, onChange, hideBusy }: {
  label: string; role: string; value: string; options: StaffAvailable[]; onChange: (v: string) => void; hideBusy?: boolean
}) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Chọn… —</option>
        {options.map((s) => (
          <option key={s.user_id} value={s.user_id} disabled={!hideBusy && s.busy}>
            {s.name}{!hideBusy && s.busy ? ' (đã có lịch)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
