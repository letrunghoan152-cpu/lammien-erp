'use client'
// components/orders/OrderSlidePanel.tsx — panel trượt phải: đổi trạng thái ngay tại danh sách.
// Mở TỨC THÌ từ dữ liệu dòng (seed); orders.get tải nền để bổ sung ekip + nút chuyển trạng thái.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { gasApi } from '@/lib/gasApi'
import Avatar from '@/components/Avatar'
import { StatusPill } from '@/components/StatusPill'
import { OrderTimeline } from './OrderTimeline'
import OrderActions, { TransitionResp } from './OrderActions'
import { money, fmtDay, dash } from '@/lib/format'
import { OrderGetResponse, OrderListItem } from '@/lib/types'

interface Props {
  orderId: string | null
  seed?: OrderListItem | null   // dữ liệu dòng để hiện ngay, chưa cần đợi orders.get
  onClose: () => void
  onChanged?: (id: string, status: string) => void
}

export default function OrderSlidePanel({ orderId, seed, onClose, onChanged }: Props) {
  const [data, setData] = useState<OrderGetResponse | null>(null)

  const load = (id: string) => {
    gasApi<OrderGetResponse>('orders.get', { order_id: id }).then(setData).catch(() => {})
  }

  useEffect(() => {
    if (!orderId) { setData(null); return }
    setData(null)
    load(orderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (!orderId) return null

  const order = data?.order
  // Nguồn hiển thị: ưu tiên dữ liệu đã fetch, fallback seed (hiện ngay khi click)
  const name = order?.customer_name ?? seed?.customer_name ?? ''
  const oid = order?.order_id ?? seed?.order_id ?? orderId
  const avatarUrl = data?.customer_avatar_url ?? seed?.customer_avatar_url ?? null
  const status = order?.status ?? seed?.status ?? ''
  const locName = order?.location_name ?? seed?.location_name
  const shootDate = order?.shoot_date ?? seed?.shoot_date ?? ''
  const arrival = order?.arrival_time ?? seed?.arrival_time
  const total = order?.total_price ?? seed?.total_price
  const remaining = order?.remaining_amount ?? seed?.remaining_amount
  const canFinancial = order ? order.total_price !== undefined : seed ? seed.total_price !== undefined : false
  const c0 = data?.concepts?.[0]

  const merge = (res: TransitionResp) => {
    setData((d) => {
      if (!d) return d
      const o = { ...d.order, status: res.status ?? d.order.status, version: res.version ?? d.order.version }
      if (res.payment_status !== undefined) o.payment_status = res.payment_status
      if (res.remaining_amount !== undefined) o.remaining_amount = res.remaining_amount
      if (res.deposit_amount !== undefined) o.deposit_amount = res.deposit_amount
      return { ...d, order: o, allowed_transitions: res.allowed_transitions ?? d.allowed_transitions }
    })
    if (res.status && orderId) onChanged?.(orderId, res.status)
  }

  return (
    <>
      <div className="panel-scrim" onClick={onClose} />
      <aside className="slide-panel anim-slide-right" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 10 }}>
            <Avatar name={name} url={avatarUrl} size="md" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{name}</div>
              <div className="dim" style={{ fontSize: 12 }}>{oid}</div>
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: 12 }}>{status && <StatusPill status={status} />}</div>
        {status && <OrderTimeline status={status} size="mini" />}

        <div className="card" style={{ padding: 12, marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 8 }}>Chuyển trạng thái</div>
          {data ? (
            <OrderActions
              orderId={data.order.order_id}
              version={data.order.version}
              allowedTransitions={data.allowed_transitions}
              canFinancial={canFinancial}
              remaining={data.order.remaining_amount ?? 0}
              rawLinkMissing={!data.order.raw_link}
              onUpdated={merge}
              onReload={() => orderId && load(orderId)}
              layout="stack"
            />
          ) : (
            <div className="dim" style={{ fontSize: 13 }}>Đang tải thao tác…</div>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 13 }}>
          <PanelRow label="Ngày chụp" value={fmtDay(shootDate) + (arrival ? ' · ' + arrival : '')} />
          <PanelRow label="Cơ sở" value={dash(locName)} />
          {/* ekip chỉ có sau khi orders.get về */}
          {c0 ? (
            <>
              <PanelRow label="Photographer" value={dash(c0.photographer_name)} />
              <PanelRow label="MUA" value={dash(c0.mua_name)} />
              <PanelRow label="Hậu kỳ" value={dash(c0.hau_ky_name)} />
            </>
          ) : (
            <PanelRow label="Ekip" value="Đang tải…" dim />
          )}
          {canFinancial && <PanelRow label="Tổng" value={money(total)} />}
          {canFinancial && <PanelRow label="Còn lại" value={money(remaining)} red={(remaining ?? 0) > 0} />}
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href={'/orders/' + oid} className="btn ghost" style={{ width: '100%' }}>Xem đầy đủ chi tiết →</Link>
        </div>
      </aside>
    </>
  )
}

function PanelRow({ label, value, red, dim }: { label: string; value: string; red?: boolean; dim?: boolean }) {
  return (
    <div className="finance-row" style={{ borderTop: 'none', padding: '5px 0' }}>
      <span className="lbl">{label}</span>
      <span className="val" style={{ fontWeight: 500, color: red ? 'var(--red)' : dim ? 'var(--muted-2)' : undefined }}>{value}</span>
    </div>
  )
}
