// lib/config.ts — biến môi trường + hằng số toàn cục

export const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || ''
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

/** Đã cấu hình đủ để gọi GAS + đăng nhập Google chưa */
export const IS_CONFIGURED = Boolean(GAS_URL && GOOGLE_CLIENT_ID)

// Khung giờ mặc định (fallback nếu settings chưa load)
export const DEFAULT_SLOT_TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']

// Cache TTL (ms) — phân tầng theo PRD Section 20.1
export const TTL = {
  STATIC: null as number | null,   // sessionStorage cả phiên (services, locations, roles)
  SEMI: 30 * 60 * 1000,            // 30 phút (users, vouchers, settings)
  DYNAMIC: 60 * 1000,              // 60s (orders list, notifications)
}

// Polling intervals (PRD Section 13.1)
export const POLL = {
  NOTIFICATIONS: 60 * 1000,
  DASHBOARD: 30 * 1000,
  CALENDAR: 60 * 1000,
}
