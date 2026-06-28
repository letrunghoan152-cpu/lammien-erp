// lib/cache.ts — wrapper sessionStorage (PRD Section 20.1)
// localStorage không khả dụng trong môi trường artifact → dùng sessionStorage.

type Entry = { data: unknown; expires: number | null }

export const cache = {
  get<T = unknown>(key: string): T | null {
    if (typeof window === 'undefined') return null
    try {
      const item = sessionStorage.getItem(key)
      if (!item) return null
      const { data, expires } = JSON.parse(item) as Entry
      if (expires && Date.now() > expires) {
        sessionStorage.removeItem(key)
        return null
      }
      return data as T
    } catch {
      return null
    }
  },

  set(key: string, data: unknown, ttlMs: number | null = null): void {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(key, JSON.stringify({ data, expires: ttlMs ? Date.now() + ttlMs : null }))
    } catch {
      /* quota / private mode — bỏ qua */
    }
  },

  del(key: string): void {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(key)
  },

  /** Xoá mọi key bắt đầu bằng prefix (vd invalidate 'orders.list') */
  delPrefix(prefix: string): void {
    if (typeof window === 'undefined') return
    const toDel: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(prefix)) toDel.push(k)
    }
    toDel.forEach((k) => sessionStorage.removeItem(k))
  },
}

// Khoá KHÔNG được xoá khi invalidate 'all' — nếu xoá sẽ mất credential → báo "hết phiên"
// ngay sau khi lưu (lm_session vốn ở localStorage, gis_id_token phòng trường hợp fallback).
const PROTECTED_KEYS = ['lm_session', 'gis_id_token']

/** Invalidate cache theo nhóm dữ liệu sau mutation */
export function invalidateCache(group: 'orders' | 'customers' | 'calendar' | 'services' | 'notifications' | 'all') {
  if (group === 'all') {
    if (typeof window === 'undefined') return
    const toDel: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && PROTECTED_KEYS.indexOf(k) === -1) toDel.push(k)
    }
    toDel.forEach((k) => sessionStorage.removeItem(k))
    return
  }
  cache.delPrefix(group)
}
