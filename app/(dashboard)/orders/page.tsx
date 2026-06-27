'use client'
// app/(dashboard)/orders/page.tsx — Order Hub (Module 1): danh sách đơn + lọc + phân trang

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gasApi, GasError } from '@/lib/gasApi'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import { StatusPill, PaymentPill } from '@/components/StatusPill'
import OrderSlidePanel from '@/components/orders/OrderSlidePanel'
import { OrderListSkeleton } from '@/components/Skeletons'
import { money, fmtDay, dash } from '@/lib/format'
import { STATUS_META } from '@/lib/status'
import { OrderListItem, Location } from '@/lib/types'
import { cache } from '@/lib/cache'
import { TTL } from '@/lib/config'
import { useBootstrap } from '@/lib/useBootstrap'

const PAGE = 50

export default function OrdersPage() {
  const { hasPerm } = useAuth()

  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [locations, setLocations] = useState<Location[]>([])
  const [status, setStatus] = useState('')
  const [locationId, setLocationId] = useState('')
  const [q, setQ] = useState('')
  const qDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [qApplied, setQApplied] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const canFinancial = hasPerm('order.view_financial')
  const canCreate = hasPerm('order.create_edit')

  // Cơ sở lấy từ bootstrap (đã cache cả phiên) — bỏ 1 call locations.list
  const { data: boot } = useBootstrap()
  useEffect(() => { if (boot?.locations) setLocations(boot.locations) }, [boot])

  const fetchPage = useCallback((reset: boolean) => {
    const off = reset ? 0 : offset
    const cacheKey = `orders:list:${status}|${locationId}|${qApplied}`
    if (reset) {
      // stale-while-revalidate: hiện cache cũ ngay (điều hướng tức thì), fetch nền
      const cached = cache.get<OrderListItem[]>(cacheKey)
      if (cached) { setOrders(cached); setOffset(PAGE); setHasMore(cached.length === PAGE); setLoading(false) }
      else setLoading(true)
    } else setLoadingMore(true)
    gasApi<{ orders: OrderListItem[]; hasMore: boolean }>('orders.list', {
      status, location_id: locationId, q: qApplied, limit: PAGE, offset: off,
    })
      .then((d) => {
        setOrders((prev) => (reset ? d.orders : [...prev, ...d.orders]))
        setOffset(off + PAGE)
        setHasMore(d.hasMore)
        setError(null)
        if (reset) cache.set(cacheKey, d.orders, TTL.DYNAMIC)
      })
      .catch((e: GasError) => setError(e.message))
      .finally(() => { setLoading(false); setLoadingMore(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, locationId, qApplied, offset])

  // refetch khi filter đổi
  useEffect(() => { fetchPage(true) /* eslint-disable-next-line */ }, [status, locationId, qApplied])

  const onSearch = (val: string) => {
    setQ(val)
    if (qDebounce.current) clearTimeout(qDebounce.current)
    qDebounce.current = setTimeout(() => setQApplied(val.trim()), 400)
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h1 className="h1">Đơn hàng</h1>
        {canCreate && <Link href="/orders/new" className="btn press">+ Tạo đơn</Link>}
      </div>
      <p className="sub">Trung tâm vận hành — trạng thái, lịch chụp, tài chính từng đơn.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input
            className="input" style={{ flex: 2, minWidth: 180 }}
            placeholder="🔍 Tìm theo mã đơn, tên KH, SĐT…"
            value={q} onChange={(e) => onSearch(e.target.value)}
          />
          <select className="input" style={{ flex: 1, minWidth: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">— Tất cả trạng thái —</option>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select className="input" style={{ flex: 1, minWidth: 150 }} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">— Tất cả cơ sở —</option>
            {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <OrderListSkeleton />
      ) : error ? (
        <div className="card note-box danger">
          Không tải được danh sách đơn.<br />{error}
          <div style={{ marginTop: 10 }}><button className="btn ghost sm" onClick={() => fetchPage(true)}>Thử lại</button></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="em-icon">📋</div>
            <div>Chưa có đơn nào khớp bộ lọc.</div>
            {canCreate && <div style={{ marginTop: 10 }}><Link href="/orders/new" className="btn">+ Tạo đơn đầu tiên</Link></div>}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Cơ sở</th>
                  <th>Ngày chụp</th>
                  <th>Trạng thái</th>
                  {canFinancial && <th>Thanh toán</th>}
                  {canFinancial && <th className="num">Tổng</th>}
                  {canFinancial && <th className="num">Còn lại</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.order_id}
                    onClick={() => setSelectedId(o.order_id)}
                    style={o.order_id === selectedId ? { background: 'var(--brand-soft)', boxShadow: 'inset 2px 0 0 var(--brand)' } : undefined}
                  >
                    <td>
                      <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <Avatar name={o.customer_name} url={o.customer_avatar_url} size="md" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                          <div className="dim" style={{ fontSize: 12 }}>{o.order_id} · {dash(o.customer_phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{dash(o.location_name)}</td>
                    <td>{fmtDay(o.shoot_date)} {o.arrival_time && <span className="dim">· {o.arrival_time}</span>}</td>
                    <td><StatusPill status={o.status} /></td>
                    {canFinancial && <td><PaymentPill status={o.payment_status} /></td>}
                    {canFinancial && <td className="num">{money(o.total_price)}</td>}
                    {canFinancial && <td className="num" style={{ color: (o.remaining_amount || 0) > 0 ? 'var(--red)' : 'var(--muted)' }}>{money(o.remaining_amount)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid var(--line-soft)' }}>
              <button className="btn ghost" onClick={() => fetchPage(false)} disabled={loadingMore}>
                {loadingMore ? 'Đang tải…' : 'Tải thêm'}
              </button>
            </div>
          )}
        </div>
      )}

      <OrderSlidePanel
        orderId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={(id, newStatus) => {
          setOrders((prev) => prev.map((o) => (o.order_id === id ? { ...o, status: newStatus } : o)))
          cache.delPrefix('orders:list:') // danh sách cache đã cũ
        }}
      />
    </div>
  )
}
