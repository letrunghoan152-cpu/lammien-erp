'use client'
// components/Sidebar.tsx — app shell sidebar, nav gated theo permission (PRD Section 15.11)

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import Avatar from './Avatar'
import NotificationBell from './NotificationBell'
import { ROLE_LABELS } from '@/lib/roles'

interface NavItem { href: string; label: string; icon: string; perm?: string; manager?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: '📊', perm: 'order.view_all' },
  { href: '/orders', label: 'Đơn hàng', icon: '📋', perm: 'order.view_own' },
  { href: '/calendar', label: 'Lịch chụp', icon: '📅', perm: 'calendar.view_own' },
  { href: '/hau-ky', label: 'Hậu Kỳ', icon: '🎨', perm: 'hau_ky.view_all' },
  { href: '/finance', label: 'Tài chính', icon: '💰', perm: 'finance.view_all' },
  { href: '/catalog', label: 'Danh mục', icon: '📦', perm: 'order.create_edit' },
  { href: '/crm', label: 'CRM', icon: '👥', perm: 'crm.view_edit' },
  { href: '/salary', label: 'Lương', icon: '💳', perm: 'salary.view_own' },
  { href: '/users', label: 'Nhân sự', icon: '👤', perm: 'salary.manage_config' },
  { href: '/settings', label: 'Cài đặt', icon: '⚙️', manager: true },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, hasPerm, isManager, logout } = useAuth()
  const pathname = usePathname()

  const visible = NAV.filter((n) => {
    if (n.manager) return isManager
    if (n.perm) return hasPerm(n.perm)
    return true
  })

  return (
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <div className="brand">
        <span className="logo">LM</span>
        <span className="brand-text">LẠM MIÊN</span>
      </div>

      <nav className="nav">
        {visible.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/')
          return (
            <Link key={n.href} href={n.href} className={active ? 'active' : ''} onClick={onClose}>
              <span className="ico">{n.icon}</span>
              <span className="label-text">{n.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="user-row">
          <Avatar name={user?.name} size="md" />
          <div className="meta">
            <div className="name">{user?.name || '—'}</div>
            <div className="role">{ROLE_LABELS[user?.role_id || ''] || user?.role_id}</div>
          </div>
          <NotificationBell />
        </div>
        <button className="btn ghost sm" style={{ width: '100%', marginTop: 8 }} onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
