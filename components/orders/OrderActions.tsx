'use client'
// components/orders/OrderActions.tsx — nút chuyển trạng thái + modal xác nhận (tái dùng panel + detail)
// Dùng allowed_transitions động từ GAS; cập nhật tại chỗ (1 call) → phản hồi nhanh + toast.

import { useState } from 'react'
import { gasApi, GasError } from '@/lib/gasApi'
import { useToast } from '@/components/Toast'
import { Modal } from '@/components/Modal'
import { invalidateCache } from '@/lib/cache'
import { money } from '@/lib/format'
import { CANCEL_REASONS } from '@/lib/status'
import { AllowedTransition } from '@/lib/types'

export interface TransitionResp {
  status?: string; version?: number; warning?: string
  allowed_transitions?: AllowedTransition[]
  payment_status?: string; remaining_amount?: number; deposit_amount?: number
}

interface Props {
  orderId: string
  version: number
  allowedTransitions: AllowedTransition[]
  canFinancial: boolean
  remaining: number
  rawLinkMissing?: boolean
  onUpdated: (resp: TransitionResp) => void
  onReload?: () => void
  layout?: 'bar' | 'stack'
}

export default function OrderActions({
  orderId, version, allowedTransitions, canFinancial, remaining, rawLinkMissing,
  onUpdated, onReload, layout = 'bar',
}: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('customer')
  const [chupOpen, setChupOpen] = useState(false)
  const [collected, setCollected] = useState('')

  const doTransition = async (t: AllowedTransition, extra: Record<string, unknown> = {}) => {
    setBusy(true)
    try {
      const res = t.hk
        ? await gasApi<TransitionResp>('orders.updateStatusHK', { order_id: orderId })
        : await gasApi<TransitionResp>('orders.updateStatus', { order_id: orderId, status: t.to, version, ...extra })
      if (res?.warning) toast('⚠️ ' + res.warning, 'error')
      invalidateCache('orders'); invalidateCache('calendar')
      toast('Đã cập nhật trạng thái')
      onUpdated(res)
    } catch (e) {
      const ge = e as GasError
      if (ge.appStatus === 409) { toast('Đơn vừa bị người khác sửa — đang tải lại…', 'error'); onReload?.() }
      else if (ge.appStatus === 403) toast('Không có quyền thực hiện', 'error')
      else toast(ge.message || 'Không thể cập nhật', 'error')
    } finally { setBusy(false); setCancelOpen(false); setChupOpen(false) }
  }

  const onClick = (t: AllowedTransition) => {
    if (t.to === 'HUY') { setCancelOpen(true); return }
    if (t.to === 'DA_CHUP') { setChupOpen(true); return }
    doTransition(t)
  }

  const stack = layout === 'stack'

  if (!allowedTransitions.length) {
    return <div className="dim" style={{ fontSize: 13 }}>Không có thao tác khả dụng ở trạng thái này.</div>
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: stack ? 'column' : 'row', alignItems: stack ? 'stretch' : 'center' }}>
        {allowedTransitions.map((t) => (
          <button
            key={t.to}
            className={'btn press' + (t.kind === 'danger' ? ' danger' : t.kind === 'ghost' ? ' ghost' : '') + (stack ? '' : ' sm')}
            style={stack ? { width: '100%' } : undefined}
            onClick={() => onClick(t)}
            disabled={busy}
          >
            {t.label}{!t.hk && t.to !== 'HUY' ? ' →' : ''}
          </button>
        ))}
      </div>

      {/* Modal HỦY */}
      <Modal open={cancelOpen} title="Hủy đơn hàng" onClose={() => setCancelOpen(false)} small>
        <p className="muted" style={{ marginTop: 0 }}>Hành động không thể hoàn tác. Chọn lý do hủy:</p>
        <div className="field">
          {CANCEL_REASONS.map((r) => (
            <label key={r.value} className="row" style={{ gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input type="radio" name={'cr_' + orderId} checked={cancelReason === r.value} onChange={() => setCancelReason(r.value)} />
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
        {rawLinkMissing && <div className="banner amber"><span>⚠️</span><span>Photographer chưa upload link ảnh raw — vẫn cho phép chuyển trạng thái.</span></div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => setChupOpen(false)} disabled={busy}>Hủy bỏ</button>
          <button className="btn" onClick={() => doTransition({ to: 'DA_CHUP' } as AllowedTransition, { collected_amount: Number(collected) || 0 })} disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Xác nhận'}
          </button>
        </div>
      </Modal>
    </>
  )
}
