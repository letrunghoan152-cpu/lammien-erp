'use client'
// components/Placeholder.tsx — trang module chưa thuộc Phase 2

export default function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 className="h1">{title}</h1>
      <p className="sub">Module này sẽ được hoàn thiện ở {phase}.</p>
      <div className="card">
        <div className="empty">
          <div className="em-icon">🛠️</div>
          <div>Đang phát triển — {phase}</div>
          <div className="dim" style={{ marginTop: 6 }}>Phase 2 hiện tập trung vào Order Hub + Booking Form.</div>
        </div>
      </div>
    </div>
  )
}
