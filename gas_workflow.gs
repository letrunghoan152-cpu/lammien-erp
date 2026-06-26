/**
 * gas_workflow.gs — Định nghĩa workflow trạng thái đơn + transition rules
 * Studio LẠM MIÊN — Phase 2
 *
 * Nguồn: PRD Section 3.1 / 3.2 / 15.13
 */

// Tất cả trạng thái hợp lệ
var ORDER_STATUSES = [
  'TIEP_NHAN', 'BAO_GIA', 'DAT_COC', 'LEN_LICH', 'TAM_DUNG',
  'DA_CHUP', 'CHON_ANH', 'HAU_KY', 'DUYET_ANH',
  'GIAO_FILE', 'CHO_IN', 'DANG_GIAO', 'GIAO_HANG', 'HUY'
]

// Trạng thái ≤ LEN_LICH (delivery_type còn được recompute)
var STATUS_ORDER_INDEX = {
  TIEP_NHAN: 0, BAO_GIA: 1, DAT_COC: 2, LEN_LICH: 3, TAM_DUNG: 3,
  DA_CHUP: 4, CHON_ANH: 5, HAU_KY: 6, DUYET_ANH: 7,
  GIAO_FILE: 8, CHO_IN: 8, DANG_GIAO: 9, GIAO_HANG: 10, HUY: 99
}

/**
 * Transition map cho orders.updateStatus (transition thường, cần order.create_edit).
 * KHÔNG bao gồm transition của Hậu Kỳ (DUYET_ANH → GIAO_FILE/CHO_IN) — cái đó qua updateStatusHK.
 */
var TRANSITIONS = {
  TIEP_NHAN: ['BAO_GIA', 'HUY'],
  BAO_GIA:   ['DAT_COC', 'HUY'],
  DAT_COC:   ['LEN_LICH', 'HUY'],
  LEN_LICH:  ['TAM_DUNG', 'DA_CHUP', 'HUY'],
  TAM_DUNG:  ['LEN_LICH', 'DA_CHUP', 'HUY'],
  DA_CHUP:   ['CHON_ANH'],            // CHON_ANH thường tới qua webhook chọn ảnh, nhưng cho phép thủ công
  CHON_ANH:  ['HAU_KY'],
  HAU_KY:    ['DUYET_ANH'],
  DUYET_ANH: [],                       // → GIAO_FILE/CHO_IN qua updateStatusHK
  GIAO_FILE: [],                       // terminal
  CHO_IN:    ['DANG_GIAO'],
  DANG_GIAO: ['GIAO_HANG'],
  GIAO_HANG: [],                       // terminal
  HUY:       []                        // terminal
}

// Transition cần mở modal xác nhận ở frontend (Section 15.13)
var TRANSITIONS_NEED_CONFIRM = { HUY: true, DA_CHUP: true }

/**
 * Tính danh sách transition hợp lệ cho 1 đơn theo trạng thái + quyền user.
 * Trả về mảng { to, label, kind: 'primary'|'ghost'|'danger', needsConfirm, hk }
 */
function getAllowedTransitions(status, permissions, roleId) {
  var out = []
  var canEdit = permissions.has('order.create_edit') || roleId === 'manager'
  var canHK = permissions.has('order.update_status_hk') || roleId === 'manager'

  if (canEdit) {
    (TRANSITIONS[status] || []).forEach(function (to) {
      out.push({
        to: to,
        label: STATUS_LABELS[to] || to,
        kind: to === 'HUY' ? 'danger' : 'primary',
        needsConfirm: !!TRANSITIONS_NEED_CONFIRM[to],
        hk: false
      })
    })
  }

  // Hậu Kỳ transition: DUYET_ANH → (tự quyết theo delivery_type)
  if (canHK && status === 'DUYET_ANH') {
    out.push({
      to: 'AUTO_HK',
      label: 'Hoàn tất duyệt ảnh',
      kind: 'primary',
      needsConfirm: false,
      hk: true
    })
  }

  return out
}

var STATUS_LABELS = {
  TIEP_NHAN: 'Tiếp nhận', BAO_GIA: 'Báo giá', DAT_COC: 'Đặt cọc',
  LEN_LICH: 'Lên lịch', TAM_DUNG: 'Tạm dừng', DA_CHUP: 'Đã chụp + Thu tiền',
  CHON_ANH: 'Chọn ảnh', HAU_KY: 'Hậu kỳ', DUYET_ANH: 'Duyệt ảnh',
  GIAO_FILE: 'Giao file', CHO_IN: 'Chờ in', DANG_GIAO: 'Đang giao',
  GIAO_HANG: 'Giao hàng', HUY: 'Hủy'
}
