// lib/auth.ts — Google Identity Services (Sign In With Google) → id_token (JWT)
// PRD Section 13.2: dùng id_token, KHÔNG dùng access_token.

import { GOOGLE_CLIENT_ID } from './config'

const TOKEN_KEY = 'gis_id_token'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
    __gisLoaded?: boolean
  }
}

let scriptPromise: Promise<void> | null = null

/** Load script GIS 1 lần */
export function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.__gisLoaded) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => { window.__gisLoaded = true; resolve() }
    s.onerror = () => reject(new Error('Không tải được Google Identity Services'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** Decode payload JWT (không verify — chỉ đọc exp/email phía client) */
export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') sessionStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(TOKEN_KEY)
}

/** Token còn hạn (exp > now + 60s) thì trả về, ngược lại null */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const t = sessionStorage.getItem(TOKEN_KEY)
  if (!t) return null
  const payload = decodeJwt(t)
  if (!payload || !payload.exp) return null
  if (Date.now() / 1000 > payload.exp - 60) {
    sessionStorage.removeItem(TOKEN_KEY)
    return null
  }
  return t
}

/** Lấy id_token hợp lệ cho gasApi; throw nếu cần đăng nhập lại */
export async function getIdToken(): Promise<string> {
  const t = getStoredToken()
  if (t) return t
  throw Object.assign(new Error('Phiên đăng nhập hết hạn — vui lòng đăng nhập lại'), { appStatus: 401, needLogin: true })
}

export function getEmailFromToken(): string | null {
  const t = getStoredToken()
  if (!t) return null
  return decodeJwt(t)?.email || null
}

/**
 * Khởi tạo GIS + render nút "Đăng nhập với Google" vào element.
 * callback nhận id_token khi user đăng nhập thành công.
 */
export async function renderSignInButton(
  el: HTMLElement,
  onCredential: (idToken: string) => void
): Promise<void> {
  await loadGis()
  if (!window.google) throw new Error('GIS chưa sẵn sàng')
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resp: { credential: string }) => {
      setToken(resp.credential)
      onCredential(resp.credential)
    },
    auto_select: false,
    use_fedcm_for_prompt: true,
  })
  window.google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    width: 320,
    text: 'signin_with',
    shape: 'rectangular',
    locale: 'vi',
  })
  // One Tap (không bắt buộc) — bỏ qua lỗi nếu bị chặn
  try { window.google.accounts.id.prompt() } catch { /* noop */ }
}

export function signOut() {
  clearToken()
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    try { window.google.accounts.id.disableAutoSelect() } catch { /* noop */ }
  }
}
