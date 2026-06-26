'use client'
// app/(dashboard)/layout.tsx — guard đăng nhập + app shell (sidebar + main)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, error } = useAuth()
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  if (!ready) {
    return (
      <div className="center"><div className="dim">Đang tải phiên làm việc…</div></div>
    )
  }

  if (!user) {
    // đang redirect; nếu lỗi cấu hình/inactive thì hiện thông báo
    return (
      <div className="center">
        <div className="auth-card card">
          <div className="logo-lg">LM</div>
          <p className="sub">Cần đăng nhập để tiếp tục</p>
          {error && <div className="note-box danger">{error.message}</div>}
          <button className="btn" style={{ marginTop: 12 }} onClick={() => router.replace('/login')}>Đến trang đăng nhập</button>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button className="bell menu-btn press" onClick={() => setNavOpen(true)} aria-label="Menu">☰</button>
          <span className="brand"><span className="logo">LM</span></span>
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
