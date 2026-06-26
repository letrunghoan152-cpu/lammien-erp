// lib/status.ts — map trạng thái → nhãn + màu token (PRD Section 15.6)

export type OrderStatus =
  | 'TIEP_NHAN' | 'BAO_GIA' | 'DAT_COC' | 'LEN_LICH' | 'TAM_DUNG'
  | 'DA_CHUP' | 'CHON_ANH' | 'HAU_KY' | 'DUYET_ANH'
  | 'GIAO_FILE' | 'CHO_IN' | 'DANG_GIAO' | 'GIAO_HANG' | 'HUY'

type StatusMeta = { label: string; color: string; dashed?: boolean }

// color = giá trị HEX fallback (dùng cho pill background = color + '22', text = color)
export const STATUS_META: Record<string, StatusMeta> = {
  TIEP_NHAN: { label: 'Tiếp nhận', color: '#5f6857' },
  BAO_GIA:   { label: 'Báo giá', color: '#a9802f' },
  DAT_COC:   { label: 'Đặt cọc', color: '#3f7e93' },
  LEN_LICH:  { label: 'Lên lịch', color: '#3f7e93' },
  TAM_DUNG:  { label: 'Tạm dừng', color: '#a9802f', dashed: true },
  DA_CHUP:   { label: 'Đã chụp + Thu tiền', color: '#5e7d3e' },
  CHON_ANH:  { label: 'Chọn ảnh', color: '#6c71c4' },
  HAU_KY:    { label: 'Hậu kỳ', color: '#3f7e93' },
  DUYET_ANH: { label: 'Duyệt ảnh', color: '#a9802f' },
  GIAO_FILE: { label: 'Giao file', color: '#6d8150' },
  CHO_IN:    { label: 'Chờ in', color: '#a9802f' },
  DANG_GIAO: { label: 'Đang giao', color: '#3f7e93' },
  GIAO_HANG: { label: 'Giao hàng', color: '#6d8150' },
  HUY:       { label: 'Hủy', color: '#8b9282' },
}

export const PAYMENT_META: Record<string, StatusMeta> = {
  CHUA_COC:      { label: 'Chưa cọc', color: '#5f6857' },
  DA_COC:        { label: 'Đã cọc', color: '#a9802f' },
  DA_THANH_TOAN: { label: 'Đã thanh toán', color: '#5e7d3e' },
  HOAN_COC:      { label: 'Hoàn cọc', color: '#3f7e93' },
}

export function statusLabel(s: string): string {
  return STATUS_META[s]?.label || s
}
export function paymentLabel(s: string): string {
  return PAYMENT_META[s]?.label || s
}

/** style inline cho .pill: nền = màu + '22', chữ = màu */
export function pillStyle(meta?: StatusMeta): React.CSSProperties {
  const color = meta?.color || '#5f6857'
  return { background: color + '22', color }
}

export const SALE_CHANNELS = [
  { value: 'ONLINE', label: 'Online (FB/IG/Zalo)' },
  { value: 'OFFLINE', label: 'Offline (tại cửa hàng)' },
]

export const CUSTOMER_SOURCES = ['Facebook', 'Instagram', 'Zalo', 'Giới thiệu', 'Walk-in', 'Khác']

export const CANCEL_REASONS = [
  { value: 'customer', label: 'KH chủ động hủy (không hoàn cọc)' },
  { value: 'force_majeure', label: 'Bất khả kháng (hoàn cọc)' },
]
