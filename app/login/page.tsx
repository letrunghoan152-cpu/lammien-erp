'use client'
// app/login/page.tsx — đăng nhập Google (GIS redirect mode) + warm GAS chống cold start

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderSignInButton, hasCredential } from '@/lib/auth'
import { gasPing } from '@/lib/gasApi'
import { IS_CONFIGURED, GAS_URL, GOOGLE_CLIENT_ID } from '@/lib/config'

export default function LoginPage() {
  const router = useRouter()
  const btnRef = useRef<HTMLDivElement>(null)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Đã có phiên hợp lệ → vào thẳng dashboard
    if (hasCredential()) { router.replace('/orders'); return }

    // Hiển thị lỗi nếu redirect callback trả về ?auth_error=
    const params = new URLSearchParams(window.location.search)
    const err = params.get('auth_error')
    if (err) setAuthError(err)

    gasPing() // warm GAS ngay khi mở trang (PRD Section 20.2)
    if (!IS_CONFIGURED || !btnRef.current) return
    renderSignInButton(btnRef.current).catch(() => {
      setAuthError('Không tải được đăng nhập Google — thử lại')
    })
  }, [router])

  return (
    <div className="center">
      <div className="auth-card card anim-scale-in">
        <div className="logo-lg">LM</div>
        <h1 className="h1" style={{ marginBottom: 4 }}>Studio LẠM MIÊN</h1>
        <p className="sub">Hệ thống quản lý vận hành studio</p>

        {!IS_CONFIGURED ? (
          <div className="note-box danger" style={{ textAlign: 'left' }}>
            Chưa cấu hình môi trường. Tạo file <b>.env.local</b> với:
            <br />• NEXT_PUBLIC_GAS_URL {GAS_URL ? '✓' : '✗ thiếu'}
            <br />• NEXT_PUBLIC_GOOGLE_CLIENT_ID {GOOGLE_CLIENT_ID ? '✓' : '✗ thiếu'}
            <br />
            <span className="dim">(xem .env.local.example)</span>
          </div>
        ) : (
          <>
            <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }} />
            {authError && <div className="note-box danger" style={{ marginTop: 12, textAlign: 'left' }}>{authError}</div>}
            <p className="dim" style={{ marginTop: 16, fontSize: 12.5 }}>
              Đăng nhập bằng tài khoản Google đã được Manager cấp quyền.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
