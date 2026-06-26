'use client'
// app/login/page.tsx — đăng nhập Google (GIS) + warm GAS chống cold start

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderSignInButton } from '@/lib/auth'
import { gasApi, gasPing } from '@/lib/gasApi'
import { IS_CONFIGURED, GAS_URL, GOOGLE_CLIENT_ID } from '@/lib/config'
import { cache } from '@/lib/cache'

export default function LoginPage() {
  const router = useRouter()
  const btnRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    gasPing() // warm GAS ngay khi mở trang (PRD Section 20.2)
    if (!IS_CONFIGURED || !btnRef.current) return
    renderSignInButton(btnRef.current, async () => {
      setStatus('verifying')
      try {
        const data = await gasApi<{ user: unknown; permissions: string[] }>('auth.verify')
        cache.set('auth.verify', data, 30 * 60 * 1000)
        router.replace('/orders')
      } catch (e) {
        const err = e as { message?: string }
        setStatus('error')
        setErrMsg(err.message || 'Đăng nhập thất bại')
      }
    }).catch((e) => { setStatus('error'); setErrMsg(e.message) })
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
            {status === 'verifying' && <div className="dim" style={{ marginTop: 12 }}>Đang xác thực…</div>}
            {status === 'error' && <div className="note-box danger" style={{ marginTop: 12, textAlign: 'left' }}>{errMsg}</div>}
            <p className="dim" style={{ marginTop: 16, fontSize: 12.5 }}>
              Đăng nhập bằng tài khoản Google đã được Manager cấp quyền.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
