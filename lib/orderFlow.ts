// lib/orderFlow.ts — pipeline trạng thái đơn (workflow thật 14 trạng thái → các mốc timeline)

export interface PipelineStep { key: string; label: string; icon: string; statuses: string[] }

// 9 mốc chính; bước cuối "Giao hàng" gộp nhánh digital (GIAO_FILE) và in ấn (CHỜ IN→ĐANG GIAO→GIAO HÀNG)
export const PIPELINE: PipelineStep[] = [
  { key: 'tiep_nhan', label: 'Tiếp nhận', icon: '📥', statuses: ['TIEP_NHAN'] },
  { key: 'bao_gia',   label: 'Báo giá',   icon: '💬', statuses: ['BAO_GIA'] },
  { key: 'dat_coc',   label: 'Đặt cọc',   icon: '💵', statuses: ['DAT_COC'] },
  { key: 'len_lich',  label: 'Lên lịch',  icon: '📅', statuses: ['LEN_LICH', 'TAM_DUNG'] },
  { key: 'da_chup',   label: 'Đã chụp',   icon: '📷', statuses: ['DA_CHUP'] },
  { key: 'chon_anh',  label: 'Chọn ảnh',  icon: '🖼', statuses: ['CHON_ANH'] },
  { key: 'hau_ky',    label: 'Hậu kỳ',    icon: '🎨', statuses: ['HAU_KY'] },
  { key: 'duyet_anh', label: 'Duyệt ảnh', icon: '✅', statuses: ['DUYET_ANH'] },
  { key: 'giao_hang', label: 'Giao hàng', icon: '📦', statuses: ['GIAO_FILE', 'CHO_IN', 'DANG_GIAO', 'GIAO_HANG'] },
]

const STEP_OF: Record<string, number> = {}
PIPELINE.forEach((s, i) => s.statuses.forEach((st) => { STEP_OF[st] = i }))

export const LAST_STEP = PIPELINE.length - 1

export function statusToStep(status: string): number {
  return STEP_OF[status] ?? 0
}
export function isCancelled(status: string): boolean { return status === 'HUY' }
export function isPaused(status: string): boolean { return status === 'TAM_DUNG' }
/** Đơn coi như hoàn tất khi đã giao file / giao hàng */
export function isCompleted(status: string): boolean { return status === 'GIAO_FILE' || status === 'GIAO_HANG' }
