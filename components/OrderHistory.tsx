'use client'
// components/OrderHistory.tsx — audit log đơn (PRD Section 17), lazy load

import { useState } from 'react'
import { gasApi } from '@/lib/gasApi'
import { OrderHistoryItem } from '@/lib/types'
import { fmtDate, dash } from '@/lib/format'

const ACTION_LABEL: Record<string, string> = {
  STATUS_CHANGE: 'Đổi trạng thái', FIELD_UPDATE: 'Cập nhật', STAFF_ASSIGN: 'Phân công',
  PAYMENT: 'Thanh toán', CANCEL: 'Hủy đơn',
}

export default function OrderHistory({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<OrderHistoryItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = () => {
    if (!open && items === null) {
      setLoading(true)
      gasApi<{ history: OrderHistoryItem[] }>('orders.history', { order_id: orderId })
        .then((d) => setItems(d.history))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }
    setOpen((o) => !o)
  }

  return (
    <div className="card">
      <div className="row between press" onClick={toggle} style={{ cursor: 'pointer' }}>
        <h3 style={{ margin: 0 }}>Lịch sử thay đổi</h3>
        <span className="dim">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? <div className="shimmer sk-line" style={{ width: '60%' }} />
            : !items || items.length === 0 ? <div className="dim">Chưa có lịch sử.</div>
            : (
              <div className="table-wrap">
                <table className="tbl" style={{ minWidth: 480 }}>
                  <thead><tr><th>Thời gian</th><th>Người</th><th>Hành động</th><th>Thay đổi</th></tr></thead>
                  <tbody>
                    {items.map((h) => (
                      <tr key={h.history_id} style={{ cursor: 'default' }}>
                        <td className="muted">{fmtDate(h.changed_at)}</td>
                        <td>{dash(h.changed_by_name)}</td>
                        <td>{ACTION_LABEL[h.action] || h.action}</td>
                        <td className="muted">
                          {h.field_name && <span className="dim">{h.field_name}: </span>}
                          {h.old_value && <span>{h.old_value} → </span>}{dash(h.new_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
