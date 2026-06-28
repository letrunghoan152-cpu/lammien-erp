'use client'
// app/page.tsx — điều hướng theo trạng thái đăng nhập

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { hasCredential } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace(hasCredential() ? '/orders' : '/login')
  }, [router])
  return (
    <div className="center">
      <div className="dim">Đang tải…</div>
    </div>
  )
}
