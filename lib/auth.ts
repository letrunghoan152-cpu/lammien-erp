// lib/auth.ts — Google Identity Services (Sign In With Google) → id_token (JWT)
// PRD Section 13.2: dùng id_token, KHÔNG dùng access_token.

import { GOOGLE_CLIENT_ID } from './config'

const TOKEN_KEY = 'gis_id_token'
// Session token do GAS cấp (sống 7 ngày, tự gia hạn). Lưu localStorage để:
//  1) sống sót qua sessionStorage.clear() khi invalidateCache('all') (tránh "hết phiên" sau khi lưu)
//  2) sống qua reload/đóng tab → không phải đăng nhập lại liên tục
const SESSION_KEY = 'lm_session'

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { /* private mode */ }
  try { return sessionStorage.getItem(k) } catch { return null }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); return } catch { /* fallback */ }
  try { sessionStorage.setItem(k, v) } catch { /* noop */ }
}
function lsDel(k: string) {
  try { localStorage.removeItem(k) } catch { /* noop */ }
  try { sessionStorage.removeItem(k) } catch { /* noop */ }
}

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

let _gisInit = false

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

// ─── Session token (lm1.<payload>.<sig>) do GAS cấp ───────────────────────────

export function setSession(token: string) {
  if (typeof window !== 'undefined' && token) lsSet(SESSION_KEY, token)
}
export function clearSession() {
  if (typeof window !== 'undefined') lsDel(SESSION_KEY)
}

/** Đọc exp (giây) từ payload session token; null nếu lỗi */
function sessionExp(token: string): number | null {
  try {
    let p = token.slice('lm1.'.length).split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    while (p.length % 4) p += '='   // bù padding đã bị strip lúc mint
    return (JSON.parse(atob(p)).x as number) || null
  } catch { return null }
}

/** Session token còn hạn thì trả về, ngược lại xoá + null */
export function getStoredSession(): string | null {
  if (typeof window === 'undefined') return null
  const t = lsGet(SESSION_KEY)
  if (!t) return null
  const x = sessionExp(t)
  if (!x || Date.now() / 1000 > x) { clearSession(); return null }
  return t
}

/** Có credential nào để gọi GAS không (session token hoặc id_token mới đăng nhập) */
export function hasCredential(): boolean {
  return !!(getStoredSession() || getStoredToken())
}

/**
 * Lấy token để gửi GAS: ưu tiên session token (7 ngày, không dính hạn 1h của Google);
 * fallback id_token (ngay sau đăng nhập, trước khi đổi lấy session). Throw nếu hết cả hai.
 */
export async function getAuthToken(): Promise<string> {
  const s = getStoredSession()
  if (s) return s
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
 * Khởi tạo GIS + render nút "Đăng nhập với Google" vào element — DÙNG ux_mode 'redirect'.
 *
 * Vì sao redirect thay vì popup:
 *   - Popup trả credential qua window.postMessage → bị COOP của accounts.google.com chặn.
 *   - One Tap dùng FedCM → nhiều trình duyệt tắt FedCM → lỗi.
 *   Redirect chuyển hẳn sang Google rồi POST credential về /api/auth/callback → chạy mọi nơi.
 */
export async function renderSignInButton(el: HTMLElement): Promise<void> {
  await loadGis()
  if (!window.google) throw new Error('GIS chưa sẵn sàng')
  const loginUri = window.location.origin + '/api/auth/callback'
  if (!_gisInit) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: 'redirect',     // KHÔNG popup → không dính COOP/FedCM
      login_uri: loginUri,     // Google POST credential tới đây
      auto_select: false,
    })
    _gisInit = true
  }
  window.google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    width: 320,
    text: 'signin_with',
    shape: 'rectangular',
    locale: 'vi',
  })
}

export function signOut() {
  clearToken()
  clearSession()
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    try { window.google.accounts.id.disableAutoSelect() } catch { /* noop */ }
  }
}
