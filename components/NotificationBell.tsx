'use client'
// components/NotificationBell.tsx — bell + panel polling 60s (PRD Section 15.12 / 18)

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gasApi } from '@/lib/gasApi'
import { POLL } from '@/lib/config'
import { Notif } from '@/lib/types'
import { fmtDate } from '@/lib/format'

const TYPE_LABEL: Record<string, string> = {
  RAW_UPLOADED: 'Đã có ảnh raw', PHOTO_SELECTED: 'KH chọn ảnh xong',
  PHOTO_APPROVED: 'KH duyệt ảnh', STAFF_ASSIGNED: 'Được phân công',
  HK_READY_FOR_REVIEW: 'Hậu kỳ xong', DEADLINE_RAW: 'Trễ ảnh raw',
  DEADLINE_HK: 'Trễ hậu kỳ', DEADLINE_SHIP: 'Trễ giao hàng', INFO: 'Thông báo',
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    gasApi<{ notifications: Notif[] }>('notifications.list')
      .then((d) => setItems(d.notifications || []))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, POLL.NOTIFICATIONS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const markAll = () => {
    setItems([]) // optimistic (low-stakes, không rollback)
    gasApi('notifications.markRead').catch(() => {})
  }

  const onItem = (n: Notif) => {
    setItems((prev) => prev.filter((x) => x.notif_id !== n.notif_id))
    gasApi('notifications.markRead', { notif_id: n.notif_id }).catch(() => {})
    setOpen(false)
    if (n.order_id) router.push('/orders/' + n.order_id)
  }

  const unread = items.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="bell press" onClick={() => setOpen((o) => !o)} aria-label="Thông báo">
        🔔
        {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel anim-scale-in">
          <div className="notif-head">
            <span>Thông báo</span>
            {unread > 0 && <button className="btn ghost sm" onClick={markAll}>Đọc tất cả</button>}
          </div>
          {unread === 0 ? (
            <div className="empty" style={{ padding: 24 }}>Không có thông báo mới</div>
          ) : (
            items.map((n) => (
              <div key={n.notif_id} className="notif-item unread press" onClick={() => onItem(n)}>
                <div className="nt">● {TYPE_LABEL[n.type] || n.type}</div>
                <div className="msg">{n.message}</div>
                <div className="time">{fmtDate(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
