'use client'
// app/(dashboard)/orders/[id]/page.tsx — Chi tiết đơn + status transition UI (PRD 15.13)

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import Avatar from '@/components/Avatar'
import { StatusPill, PaymentPill, DeliveryPill } from '@/components/StatusPill'
import { ConfirmModal, Modal } from '@/components/Modal'
import { PhotoGallery } from '@/components/Lightbox'
import OrderHistory from '@/components/OrderHistory'
import { OrderDetailSkeleton } from '@/components/Skeletons'
import { money, fmtDay, dash } from '@/lib/format'
import { CANCEL_REASONS } from '@/lib/status'
import { invalidateCache } from '@/lib/cache'
import { OrderGetResponse, AllowedTransition } from '@/lib/types'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { hasPerm, isManager } = useAuth()

  const [data, setData] = useState<OrderGetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // modals
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('customer')
  const [chupOpen, setChupOpen] = useState(false)
  const [collected, setCollected] = useState('')
  const [busy, setBusy] = useState(false)

  // raw link
  const [rawInput, setRawInput] = useState('')
  const [rawBusy, setRawBusy] = useState(false)

  const load = useCallback(() => {
    gasApi<OrderGetResponse>('orders.get', { order_id: id })
      .then((d) => { setData(d); setError(null) })
      .catch((e: GasError) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <OrderDetailSkeleton />
  if (error && !data) return (
    <div>
      <button className="btn ghost" onClick={() => router.push('/orders')}>← Danh sách đơn</button>
      <div className="card note-box danger" style={{ marginTop: 12 }}>Không tải được đơn.<br />{error}</div>
    </div>
  )
  if (!data) return null

  const { order, concepts, addons, customer_avatar_url, allowed_transitions } = data
  const canFinancial = order.total_price !== undefined
  const canEditRaw = hasPerm('order.upload_raw_link') || isManager

  // ── Thực hiện transition ──
  const doTransition = async (t: AllowedTransition, extra: Record<string, unknown> = {}) => {
    setBusy(true)
    const prevStatus = order.status
    setData((d) => d ? { ...d, order: { ...d.order, status: t.hk ? d.order.status : t.to } } : d)
    try {
      if (t.hk) {
        await gasApi('orders.updateStatusHK', { order_id: id })
      } else {
        const res = await gasApi<{ warning?: string }>('orders.updateStatus', {
          order_id: id, status: t.to, version: order.version, ...extra,
        })
        if (res?.warning) toast('⚠️ ' + res.warning, 'error')
      }
      invalidateCache('orders'); invalidateCache('calendar')
      toast('Đã cập nhật trạng thái')
      load()
    } catch (e) {
      const ge = e as GasError
      setData((d) => d ? { ...d, order: { ...d.order, status: prevStatus } } : d)
      if (ge.appStatus === 409) { toast('Đơn vừa bị người khác sửa — đang tải lại…', 'error'); load() }
      else if (ge.appStatus === 403) toast('Không có quyền thực hiện', 'error')
      else toast(ge.message || 'Không thể cập nhật', 'error')
    } finally {
      setBusy(false); setCancelOpen(false); setChupOpen(false)
    }
  }

  const onTransitionClick = (t: AllowedTransition) => {
    if (t.to === 'HUY') { setCancelOpen(true); return }
    if (t.to === 'DA_CHUP') { setChupOpen(true); return }
    doTransition(t)
  }

  const uploadRaw = async () => {
    if (!rawInput.trim()) return
    setRawBusy(true)
    try {
      await gasApi('orders.uploadRawLink', { order_id: id, raw_link: rawInput.trim() })
      toast('Đã lưu link — đã thông báo Manager & Sale')
      setRawInput(''); load()
    } catch (e) {
      toast((e as GasError).message || 'Không thể lưu link', 'error')
    } finally { setRawBusy(false) }
  }

  const overrideDelivery = async (dt: 'PRINT' | 'DIGITAL') => {
    try {
      await gasApi('orders.overrideDeliveryType', { order_id: id, delivery_type: dt })
      toast('Đã đổi luồng giao hàng → ' + dt); load()
    } catch (e) { toast((e as GasError).message || 'Lỗi', 'error') }
  }

  const remaining = order.remaining_amount ?? 0
  // cảnh báo: đơn có addon PRINT nhưng delivery DIGITAL (sau lock)
  const printAddon = addons.length > 0 // (chi tiết phân loại nằm ở GAS; hiển thị gợi ý override cho Manager)

  return (
    <div>
      <button className="btn ghost" onClick={() => router.push('/orders')} style={{ marginBottom: 12 }}>← Danh sách đơn</button>

      {/* Header */}
      <div className="card">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Avatar name={order.customer_name} url={customer_avatar_url} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 10 }}>
              <h1 className="h1" style={{ margin: 0 }}>{order.customer_name}</h1>
              <StatusPill status={order.status} />
              <DeliveryPill type={order.delivery_type} />
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {order.order_id} · {dash(order.customer_phone)} · {dash(order.location_name)}
              {order.sale_name && <> · Sale: {order.sale_name}</>}
            </div>
          </div>
          {canFinancial && <PaymentPill status={order.payment_status} />}
        </div>
      </div>

      {/* Banner: Manager override delivery type khi đã lock + có addon */}
      {isManager && printAddon && order.delivery_type === 'DIGITAL' && (
        <div className="banner amber">
          <span>⚠️</span>
          <div style={{ flex: 1 }}>
            Đơn đang theo luồng DIGITAL nhưng có sản phẩm in ấn — nếu cần, đổi sang luồng IN ẤN.
            <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => overrideDelivery('PRINT')}>Đổi sang IN ẤN</button></div>
          </div>
        </div>
      )}

      <div className="detail-grid" style={{ marginTop: 16 }}>
        {/* ── Trái: concepts, addons, history ── */}
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Concept ({concepts.length})</h3>
            {concepts.map((c) => (
              <div className="concept-block" key={c.concept_id}>
                <div className="concept-head">
                  <span className="ttl">Concept {c.concept_index}: {c.service?.name || c.service_id}</span>
                  {c.concept_index >= 2 && <span className="pill" style={{ background: 'rgba(169,128,47,.12)', color: 'var(--amber)' }}>giảm 50%</span>}
                  <span className="spacer" />
                  {c.custom_price !== undefined && <b>{money(c.custom_price)}</b>}
                </div>
                <div className="row" style={{ gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                  <span><span className="dim">Photographer:</span> {dash(c.photographer_name)}</span>
                  <span><span className="dim">MUA:</span> {dash(c.mua_name)}</span>
                  <span><span className="dim">Hậu Kỳ:</span> {dash(c.hau_ky_name)}</span>
                  <span><span className="dim">Support:</span> {dash(c.support_name)}</span>
                </div>
                {c.notes && <div className="note-box" style={{ marginTop: 10 }}>📋 {c.notes}</div>}
                {c.reference_photo_urls.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="label">🎨 Moodboard</div>
                    <PhotoGallery urls={c.reference_photo_urls} thumbClass="thumb" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {addons.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Add-on</h3>
              <div className="table-wrap">
                <table className="tbl" style={{ minWidth: 420 }}>
                  <thead><tr><th>Sản phẩm</th><th className="num">SL</th><th className="num">Giá</th><th className="num">Hoa hồng</th></tr></thead>
                  <tbody>
                    {addons.map((a) => (
                      <tr key={a.order_addon_id} style={{ cursor: 'default' }}>
                        <td>{a.addon_catalog_id}</td>
                        <td className="num">{a.quantity}</td>
                        <td className="num">{money(a.actual_price)}</td>
                        <td className="num muted">{money(a.commission_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {hasPerm('order.view_all') && <OrderHistory orderId={order.order_id} />}
        </div>

        {/* ── Phải: lịch, tài chính, raw link ── */}
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Buổi chụp</h3>
            <InfoRow label="Ngày chụp" value={fmtDay(order.shoot_date)} />
            <InfoRow label="KH có mặt" value={dash(order.arrival_time)} />
            <InfoRow label="Makeup" value={order.makeup_start ? `${order.makeup_start} (${order.makeup_duration}′)` : '—'} />
            <InfoRow label="Bắt đầu chụp" value={dash(order.shoot_start)} />
            <InfoRow label="Kết thúc dự kiến" value={dash(order.estimated_end)} />
          </div>

          {canFinancial && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Tài chính</h3>
              <div className="finance-box">
                <div className="finance-row"><span className="lbl">Tổng đơn</span><span className="val">{money(order.total_price)}</span></div>
                <div className="finance-row"><span className="lbl">Đã thu / cọc</span><span className="val">{money(order.deposit_amount)}</span></div>
                <div className="finance-row total"><span className="lbl">Còn lại</span><span className="val" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--brand-700)' }}>{money(remaining)}</span></div>
              </div>
            </div>
          )}

          {/* Raw link (Section 15.14) */}
          {canEditRaw && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>📎 Link ảnh raw</h3>
              {order.raw_link ? (
                <div className="row between">
                  <a href={order.raw_link} target="_blank" rel="noreferrer">🔗 Xem ảnh raw</a>
                </div>
              ) : <div className="dim" style={{ marginBottom: 8 }}>Chưa có link ảnh raw.</div>}
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <input className="input" placeholder="https://drive.google.com/…" value={rawInput} onChange={(e) => setRawInput(e.target.value)} style={{ flex: 1 }} />
                <button className="btn" onClick={uploadRaw} disabled={rawBusy || !rawInput.trim()}>{rawBusy ? 'Đang lưu…' : (order.raw_link ? 'Cập nhật' : 'Xác nhận')}</button>
              </div>
            </div>
          )}

          {order.notes && <div className="card"><h3 style={{ marginTop: 0 }}>Ghi chú</h3><div className="note-box">{order.notes}</div></div>}
        </div>
      </div>

      {/* Action bar transitions (Section 15.13) */}
      {allowed_transitions.length > 0 && (
        <div className="action-bar">
          <span className="muted">Trạng thái:</span> <StatusPill status={order.status} />
          <span className="spacer" />
          {allowed_transitions.map((t) => (
            <button key={t.to} className={'btn press' + (t.kind === 'danger' ? ' danger' : t.kind === 'ghost' ? ' ghost' : '')}
              onClick={() => onTransitionClick(t)} disabled={busy}>
              {t.label}{!t.hk && t.to !== 'HUY' ? ' →' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Modal HỦY */}
      <Modal open={cancelOpen} title="Hủy đơn hàng" onClose={() => setCancelOpen(false)} small>
        <p className="muted" style={{ marginTop: 0 }}>Hành động không thể hoàn tác. Chọn lý do hủy:</p>
        <div className="field">
          {CANCEL_REASONS.map((r) => (
            <label key={r.value} className="row" style={{ gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input type="radio" name="cr" checked={cancelReason === r.value} onChange={() => setCancelReason(r.value)} />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => setCancelOpen(false)} disabled={busy}>Hủy bỏ</button>
          <button className="btn danger" onClick={() => doTransition({ to: 'HUY' } as AllowedTransition, { cancel_reason: cancelReason })} disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Xác nhận hủy'}
          </button>
        </div>
      </Modal>

      {/* Modal ĐÃ CHỤP + thu tiền */}
      <Modal open={chupOpen} title="Đã chụp + Thu tiền" onClose={() => setChupOpen(false)} small>
        <p className="muted" style={{ marginTop: 0 }}>Xác nhận buổi chụp hoàn tất. Nhập số tiền thu thêm tại buổi chụp:</p>
        <div className="field">
          <label className="label">Số tiền thu thêm</label>
          <input type="number" className="input" value={collected} onChange={(e) => setCollected(e.target.value)} placeholder={canFinancial ? String(remaining) : '0'} />
          {canFinancial && <div className="dim" style={{ marginTop: 6 }}>Còn lại hiện tại: {money(remaining)}</div>}
        </div>
        {!order.raw_link && <div className="banner amber"><span>⚠️</span><span>Photographer chưa upload link ảnh raw — vẫn cho phép chuyển trạng thái.</span></div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => setChupOpen(false)} disabled={busy}>Hủy bỏ</button>
          <button className="btn" onClick={() => doTransition({ to: 'DA_CHUP' } as AllowedTransition, { collected_amount: Number(collected) || 0 })} disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Xác nhận'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="finance-row" style={{ borderTop: 'none', padding: '5px 0' }}>
      <span className="lbl">{label}</span><span className="val" style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}
