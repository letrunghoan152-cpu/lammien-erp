// lib/status.ts — map trạng thái → nhãn + màu token (PRD Section 15.6)

export type OrderStatus =
  | 'TIEP_NHAN' | 'BAO_GIA' | 'DAT_COC' | 'LEN_LICH' | 'TAM_DUNG'
  | 'DA_CHUP' | 'CHON_ANH' | 'HAU_KY' | 'DUYET_ANH'
  | 'GIAO_FILE' | 'CHO_IN' | 'DANG_GIAO' | 'GIAO_HANG' | 'HUY'

type StatusMeta = { label: string; color: string; dashed?: boolean }

// color = HEX (đã làm sáng cho nền tối — theo design); pill: nền = color+'26', chữ = color
export const STATUS_META: Record<string, StatusMeta> = {
  TIEP_NHAN: { label: 'Tiếp nhận', color: '#9aa08d' },
  BAO_GIA:   { label: 'Báo giá', color: '#d2a857' },
  DAT_COC:   { label: 'Đặt cọc', color: '#5fa6bd' },
  LEN_LICH:  { label: 'Lên lịch', color: '#5fa6bd' },
  TAM_DUNG:  { label: 'Tạm dừng', color: '#d2a857', dashed: true },
  DA_CHUP:   { label: 'Đã chụp + Thu tiền', color: '#8fb45f' },
  CHON_ANH:  { label: 'Chọn ảnh', color: '#9b9fe0' },
  HAU_KY:    { label: 'Hậu kỳ', color: '#5fa6bd' },
  DUYET_ANH: { label: 'Duyệt ảnh', color: '#d2a857' },
  GIAO_FILE: { label: 'Giao file', color: '#93ab6e' },
  CHO_IN:    { label: 'Chờ in', color: '#d2a857' },
  DANG_GIAO: { label: 'Đang giao', color: '#5fa6bd' },
  GIAO_HANG: { label: 'Giao hàng', color: '#93ab6e' },
  HUY:       { label: 'Hủy', color: '#8b9282' },
}

export const PAYMENT_META: Record<string, StatusMeta> = {
  CHUA_COC:      { label: 'Chưa cọc', color: '#9aa08d' },
  DA_COC:        { label: 'Đã cọc', color: '#d2a857' },
  DA_THANH_TOAN: { label: 'Đã thanh toán', color: '#8fb45f' },
  HOAN_COC:      { label: 'Hoàn cọc', color: '#5fa6bd' },
}

export function statusLabel(s: string): string {
  return STATUS_META[s]?.label || s
}
export function paymentLabel(s: string): string {
  return PAYMENT_META[s]?.label || s
}

/** style inline cho .pill: nền = màu + '26', chữ = màu */
export function pillStyle(meta?: StatusMeta): React.CSSProperties {
  const color = meta?.color || '#9aa08d'
  return { background: color + '26', color }
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
