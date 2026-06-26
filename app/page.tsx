'use client'
// app/page.tsx — điều hướng theo trạng thái đăng nhập

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredToken } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getStoredToken() ? '/orders' : '/login')
  }, [router])
  return (
    <div className="center">
      <div className="dim">Đang tải…</div>
    </div>
  )
}
