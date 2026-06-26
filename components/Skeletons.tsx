'use client'
// components/Skeletons.tsx — skeleton loading theo trang (PRD Section 15.15)

export function ColdStartHint() {
  return <div className="dim" style={{ fontSize: 12.5, marginTop: 8 }}>Đang kết nối…</div>
}

/** Danh sách đơn: 5 dòng row, mỗi dòng 4 block shimmer */
export function OrderListSkeleton() {
  return (
    <div className="card">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="sk-row" key={i}>
          <div className="shimmer" style={{ width: 70, height: 22, borderRadius: 999 }} />
          <div className="shimmer sk-line" style={{ flex: 1 }} />
          <div className="shimmer sk-line" style={{ width: 90 }} />
          <div className="shimmer sk-line" style={{ width: 80 }} />
        </div>
      ))}
      <ColdStartHint />
    </div>
  )
}

/** Chi tiết đơn: header + 2 cột detail-grid */
export function OrderDetailSkeleton() {
  return (
    <div>
      <div className="shimmer sk-line" style={{ width: 220, height: 26, marginBottom: 16 }} />
      <div className="detail-grid">
        <div className="card">
          {Array.from({ length: 6 }).map((_, i) => <div className="shimmer sk-line" key={i} style={{ width: `${70 - i * 5}%` }} />)}
        </div>
        <div className="card">
          {Array.from({ length: 4 }).map((_, i) => <div className="shimmer sk-line" key={i} />)}
        </div>
      </div>
      <ColdStartHint />
    </div>
  )
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card">
      {Array.from({ length: lines }).map((_, i) => <div className="shimmer sk-line" key={i} style={{ width: `${90 - i * 8}%` }} />)}
    </div>
  )
}
