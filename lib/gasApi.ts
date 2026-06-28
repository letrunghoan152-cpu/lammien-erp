// lib/gasApi.ts — wrapper gọi GAS Web App (PRD Section 20.4)
// QUAN TRỌNG: GAS luôn trả HTTP 200 → lỗi nằm trong body.ok / body.status,
// KHÔNG dùng res.status để detect lỗi.

import { GAS_URL } from './config'
import { getAuthToken, setSession } from './auth'

export interface GasError extends Error {
  appStatus?: number
  needLogin?: boolean
}

type Params = Record<string, unknown>

function serializeParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'object') out[k] = JSON.stringify(v)
    else out[k] = String(v)
  }
  return out
}

/**
 * Gọi 1 action GAS. Trả về `data` (đã unwrap khỏi envelope).
 * Throw GasError với .appStatus khi body.ok === false.
 */
export async function gasApi<T = any>(action: string, params: Params = {}): Promise<T> {
  if (!GAS_URL) {
    throw Object.assign(new Error('Chưa cấu hình NEXT_PUBLIC_GAS_URL'), { appStatus: 0 }) as GasError
  }
  const token = await getAuthToken()

  let res: Response
  try {
    res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, action, ...serializeParams(params) }),
    })
  } catch (networkErr) {
    throw Object.assign(new Error('Lỗi mạng — kiểm tra kết nối'), { appStatus: -1, cause: networkErr }) as GasError
  }

  let body: any
  try {
    body = await res.json()
  } catch {
    // GAS trả HTML (thường do lỗi deploy / quyền) thay vì JSON
    throw Object.assign(new Error('GAS trả về dữ liệu không hợp lệ (kiểm tra deploy/quyền)'), { appStatus: 502 }) as GasError
  }

  // GAS đính kèm session token mới (cấp lần đầu / gia hạn trượt) → lưu lại để dùng tiếp.
  if (body && body.session) setSession(body.session)

  if (!body || body.ok !== true) {
    const err: GasError = Object.assign(new Error(body?.error || 'Lỗi GAS không xác định'), {
      appStatus: body?.status ?? 500,
    })
    if (err.appStatus === 401) err.needLogin = true
    throw err
  }
  return body.data as T
}

/** Ping warm GAS (doGet) — gọi khi mount login để tránh cold start. Không throw. */
export async function gasPing(): Promise<void> {
  if (!GAS_URL) return
  try {
    await fetch(GAS_URL, { method: 'GET' })
  } catch {
    /* noop */
  }
}
