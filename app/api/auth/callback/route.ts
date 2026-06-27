// app/api/auth/callback/route.ts
// Nhận credential từ Google Sign-In (ux_mode: 'redirect').
// Google POST form-encoded { credential, g_csrf_token } tới đây sau khi user đăng nhập.
// Không dùng popup/postMessage → không dính FedCM/COOP → chạy mọi trình duyệt.

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function backToLogin(msg: string) {
  const m = JSON.stringify(msg)
  return html(
    `<!doctype html><meta charset="utf-8"><script>` +
    `location.replace('/login' + (${m} ? '?auth_error=' + encodeURIComponent(${m}) : ''))</script>`
  )
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return backToLogin('Yêu cầu đăng nhập không hợp lệ')
  }

  const credential = (form.get('credential') || '').toString()
  const bodyCsrf = (form.get('g_csrf_token') || '').toString()
  const cookieCsrf = req.cookies.get('g_csrf_token')?.value || ''

  // ── CSRF: double-submit cookie (g_csrf_token cookie phải khớp body) ──
  if (!credential) return backToLogin('Thiếu thông tin đăng nhập')
  if (!bodyCsrf || !cookieCsrf || bodyCsrf !== cookieCsrf) {
    return backToLogin('Phiên đăng nhập không hợp lệ — thử lại')
  }
  // ── Token phải đúng dạng JWT (3 phần base64url) ──
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credential)) {
    return backToLogin('Token không hợp lệ')
  }

  // Lưu id_token vào sessionStorage (cùng key lib/auth.ts dùng) rồi vào dashboard.
  // Cùng origin + cùng tab nên /orders đọc được. < được escape phòng injection.
  const tokenJs = JSON.stringify(credential).replace(/</g, '\\u003c')
  return html(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Đang đăng nhập…</title></head>` +
    `<body style="font-family:system-ui,sans-serif;background:#f5f6f4;color:#5f6857;padding:40px;text-align:center">` +
    `<script>try{sessionStorage.setItem('gis_id_token',${tokenJs});}catch(e){}location.replace('/orders');</script>` +
    `Đang đăng nhập…</body></html>`
  )
}

// Truy cập trực tiếp (GET) → về trang login
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/login', req.url))
}
