'use client'
// components/orders/OrderSlidePanel.tsx — panel trượt phải: đổi trạng thái ngay tại danh sách

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { gasApi } from '@/lib/gasApi'
import Avatar from '@/components/Avatar'
import { StatusPill } from '@/components/StatusPill'
import { OrderTimeline } from './OrderTimeline'
import OrderActions, { TransitionResp } from './OrderActions'
import { money, fmtDay, dash } from '@/lib/format'
import { OrderGetResponse } from '@/lib/types'

interface Props {
  orderId: string | null
  onClose: () => void
  onChanged?: (id: string, status: string) => void
}

export default function OrderSlidePanel({ orderId, onClose, onChanged }: Props) {
  const [data, setData] = useState<OrderGetResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = (id: string) => {
    setLoading(true)
    gasApi<OrderGetResponse>('orders.get', { order_id: id })
      .then(setData).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!orderId) { setData(null); return }
    setData(null)
    load(orderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (!orderId) return null

  const order = data?.order
  const canFinancial = !!order && order.total_price !== undefined
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
        {!order ? (
          <div>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div className="shimmer sk-line" style={{ width: 120, height: 18 }} />
              <button className="btn ghost sm" onClick={onClose}>✕</button>
            </div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer sk-line" style={{ width: `${80 - i * 8}%` }} />)}
          </div>
        ) : (
          <>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={order.customer_name} url={data?.customer_avatar_url} size="md" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{order.customer_name}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{order.order_id}</div>
                </div>
              </div>
              <button className="btn ghost sm" onClick={onClose}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}><StatusPill status={order.status} /></div>
            <OrderTimeline status={order.status} size="mini" />

            <div className="card" style={{ padding: 12, marginTop: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>Chuyển trạng thái</div>
              <OrderActions
                orderId={order.order_id}
                version={order.version}
                allowedTransitions={data.allowed_transitions}
                canFinancial={canFinancial}
                remaining={order.remaining_amount ?? 0}
                rawLinkMissing={!order.raw_link}
                onUpdated={merge}
                onReload={() => orderId && load(orderId)}
                layout="stack"
              />
            </div>

            <div style={{ marginTop: 14, fontSize: 13 }}>
              <PanelRow label="Ngày chụp" value={fmtDay(order.shoot_date) + (order.arrival_time ? ' · ' + order.arrival_time : '')} />
              <PanelRow label="Cơ sở" value={dash(order.location_name)} />
              {c0 && <PanelRow label="Photographer" value={dash(c0.photographer_name)} />}
              {c0 && <PanelRow label="MUA" value={dash(c0.mua_name)} />}
              {c0 && <PanelRow label="Hậu kỳ" value={dash(c0.hau_ky_name)} />}
              {canFinancial && <PanelRow label="Tổng" value={money(order.total_price)} />}
              {canFinancial && <PanelRow label="Còn lại" value={money(order.remaining_amount)} red={(order.remaining_amount ?? 0) > 0} />}
            </div>

            <div style={{ marginTop: 16 }}>
              <Link href={'/orders/' + order.order_id} className="btn ghost" style={{ width: '100%' }}>Xem đầy đủ chi tiết →</Link>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

function PanelRow({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="finance-row" style={{ borderTop: 'none', padding: '5px 0' }}>
      <span className="lbl">{label}</span>
      <span className="val" style={{ fontWeight: 500, color: red ? 'var(--red)' : undefined }}>{value}</span>
    </div>
  )
}
