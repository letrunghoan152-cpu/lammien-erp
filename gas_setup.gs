/**
 * gas_setup.gs — Chạy 1 lần để khởi tạo toàn bộ Google Sheets
 * Studio LẠM MIÊN — Phase 1
 *
 * Cách dùng:
 *   1. Mở Google Apps Script (script.google.com)
 *   2. Paste toàn bộ file này vào 1 tab .gs mới
 *   3. Chọn hàm `setupAll` → Run
 *   4. Cấp quyền nếu được hỏi
 *   5. Kiểm tra Google Sheets — tất cả tab phải xuất hiện với headers
 *
 * Script này idempotent: chạy lại không làm mất dữ liệu hiện có.
 * Chỉ tạo sheet/cột nếu chưa tồn tại.
 */

// ─── Entry point ──────────────────────────────────────────────────────────────

function setupAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  Logger.log('=== BẮT ĐẦU SETUP STUDIO LẠM MIÊN ===')

  setupSheet_ORDER(ss)
  setupSheet_CONCEPT(ss)
  setupSheet_CUSTOMERS(ss)
  setupSheet_SERVICE_CATALOG(ss)
  setupSheet_ADDON_CATALOG(ss)
  setupSheet_ORDER_ADDON(ss)
  setupSheet_VOUCHER(ss)
  setupSheet_LOCATIONS(ss)
  setupSheet_USERS(ss)
  setupSheet_ROLES(ss)
  setupSheet_ROLE_PERMISSIONS(ss)
  setupSheet_HAU_KY_TASK(ss)
  setupSheet_ALBUM(ss)
  setupSheet_SHIPPING(ss)
  setupSheet_SALARY(ss)
  setupSheet_BONUS_PENALTY(ss)
  setupSheet_ORDER_HISTORY(ss)
  setupSheet_NOTIFICATIONS(ss)
  setupSheet_SETTINGS(ss)

  seedRoles(ss)
  seedRolePermissions(ss)
  seedSettings(ss)
  seedLocations(ss)

  Logger.log('=== SETUP HOÀN TẤT ===')
  SpreadsheetApp.getUi().alert('✅ Setup hoàn tất!\n\nĐã tạo đủ 19 tab.\nKiểm tra các tab ROLES, ROLE_PERMISSIONS, SETTINGS, LOCATIONS để xác nhận seed data.')
}

// ─── Helper tạo sheet ─────────────────────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    Logger.log('Tạo mới sheet: ' + name)
  } else {
    Logger.log('Sheet đã tồn tại, bỏ qua tạo mới: ' + name)
  }
  return sheet
}

function setHeaders(sheet, headers) {
  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
  // Chỉ ghi headers nếu hàng đầu tiên còn trống
  if (existing[0] === '' || existing[0] === null) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#e8ecdf')
    sheet.setFrozenRows(1)
    Logger.log('  → Đã ghi headers')
  } else {
    Logger.log('  → Headers đã có, bỏ qua')
  }
}

// ─── Định nghĩa từng Sheet ────────────────────────────────────────────────────

function setupSheet_ORDER(ss) {
  const sheet = getOrCreateSheet(ss, 'ORDER')
  setHeaders(sheet, [
    'order_id',            // A — ORD-YYYYMM-NNN
    'version',             // B — optimistic lock counter
    'customer_id',         // C — FK → CUSTOMERS
    'customer_name',       // D — snapshot tại thời điểm tạo
    'customer_phone',      // E — snapshot
    'location_id',         // F — FK → LOCATIONS
    'sale_staff_id',       // G — FK → USERS
    'sale_channel',        // H — ONLINE | OFFLINE
    'shoot_date',          // I — yyyy-MM-dd
    'arrival_time',        // J — HH:mm
    'makeup_start',        // K — HH:mm
    'makeup_duration',     // L — phút
    'shoot_start',         // M — HH:mm (tự tính)
    'shoot_duration',      // N — phút
    'estimated_end',       // O — HH:mm (tự tính)
    'status',              // P — enum trạng thái
    'delivery_type',       // Q — DIGITAL | PRINT (lock sau DA_CHUP)
    'order_voucher_id',    // R — FK → VOUCHER (nullable)
    'raw_link',            // S — Photographer upload sau buổi chụp
    'total_price',         // T
    'deposit_amount',      // U
    'remaining_amount',    // V
    'payment_status',      // W — CHUA_COC | DA_COC | DA_THANH_TOAN | HOAN_COC
    'cancel_reason',       // X — customer | force_majeure (nullable)
    'notes',               // Y
    'created_at',          // Z
    'updated_at'           // AA
  ])
}

function setupSheet_CONCEPT(ss) {
  const sheet = getOrCreateSheet(ss, 'CONCEPT')
  setHeaders(sheet, [
    'concept_id',                  // A
    'order_id',                    // B — FK → ORDER
    'concept_index',               // C — 1, 2, 3...
    'service_id',                  // D — FK → SERVICE_CATALOG
    'custom_price',                // E — giá báo KH
    'voucher_id',                  // F — FK → VOUCHER (bắt buộc nếu index >= 2)
    'assigned_photographer_id',    // G — FK → USERS (nullable)
    'assigned_mua_id',             // H — FK → USERS (nullable)
    'assigned_hau_ky_id',          // I — FK → USERS (nullable)
    'assigned_support_id',         // J — FK → USERS (nullable)
    'reference_photo_urls',        // K — comma-separated URLs (tối đa 10)
    'notes'                        // L
  ])
}

function setupSheet_CUSTOMERS(ss) {
  const sheet = getOrCreateSheet(ss, 'CUSTOMERS')
  setHeaders(sheet, [
    'customer_id',   // A
    'name',          // B
    'phone',         // C — unique key
    'email',         // D — nullable
    'source',        // E — Facebook | Instagram | Zalo | Giới thiệu | Walk-in | Khác
    'tags',          // F — comma-separated: "VIP,Gia đình"
    'notes',         // G
    'avatar_url',    // H — nullable
    'created_at'     // I
  ])
}

function setupSheet_SERVICE_CATALOG(ss) {
  const sheet = getOrCreateSheet(ss, 'SERVICE_CATALOG')
  setHeaders(sheet, [
    'service_id',                    // A
    'name',                          // B
    'description',                   // C
    'suggested_price',               // D
    'duration_minutes',              // E
    'includes_print',                // F — TRUE | FALSE
    'print_spec',                    // G — nullable
    'sample_photo_urls',             // H — comma-separated, tối đa 6
    'cover_photo_url',               // I — nullable (ảnh bìa chính)
    'default_photographer_salary',   // J — FIXED amount
    'default_mua_salary',            // K — FIXED amount
    'default_hau_ky_rate_per_file',  // L — VND/file
    'default_support_salary',        // M — FIXED amount
    'default_sale_commission_pct',   // N — % hoa hồng
    'is_active'                      // O — TRUE | FALSE
  ])
}

function setupSheet_ADDON_CATALOG(ss) {
  const sheet = getOrCreateSheet(ss, 'ADDON_CATALOG')
  setHeaders(sheet, [
    'addon_id',          // A
    'name',              // B
    'category',          // C — PRINT | MUA_PRODUCT | GOODS
    'cost_price',        // D — giá nhập (Manager only)
    'sell_price',        // E — giá bán mặc định
    'commission_type',   // F — PERCENT | FIXED | NONE
    'commission_value',  // G
    'commission_role',   // H — SALE | MUA | null
    'is_active'          // I
  ])
}

function setupSheet_ORDER_ADDON(ss) {
  const sheet = getOrCreateSheet(ss, 'ORDER_ADDON')
  setHeaders(sheet, [
    'order_addon_id',    // A
    'order_id',          // B — FK → ORDER
    'addon_catalog_id',  // C — FK → ADDON_CATALOG
    'quantity',          // D
    'catalog_price',     // E — giá lúc thêm vào
    'actual_price',      // F — Sale có thể sửa
    'commission_amount'  // G — tự tính
  ])
}

function setupSheet_VOUCHER(ss) {
  const sheet = getOrCreateSheet(ss, 'VOUCHER')
  setHeaders(sheet, [
    'voucher_id',   // A
    'code',         // B — unique
    'type',         // C — PERCENT | FIXED_AMOUNT
    'value',        // D — 20 (cho 20%) hoặc 500000
    'valid_from',   // E — yyyy-MM-dd
    'valid_until',  // F — yyyy-MM-dd
    'max_uses',     // G — nullable = không giới hạn
    'used_count',   // H
    'created_by'    // I — FK → USERS
  ])
}

function setupSheet_LOCATIONS(ss) {
  const sheet = getOrCreateSheet(ss, 'LOCATIONS')
  setHeaders(sheet, [
    'location_id',  // A
    'name',         // B — vd: "Cơ sở Quận 1"
    'address',      // C
    'phone',        // D
    'is_active'     // E — TRUE | FALSE
  ])
}

function setupSheet_USERS(ss) {
  const sheet = getOrCreateSheet(ss, 'USERS')
  setHeaders(sheet, [
    'user_id',                // A
    'name',                   // B
    'email',                  // C — Google account (OAuth key)
    'role_id',                // D — FK → ROLES
    'location_ids',           // E — comma-separated: "loc_001,loc_002"
    'default_location_id',    // F — FK → LOCATIONS
    'is_active',              // G — TRUE | FALSE
    'base_salary',            // H — nullable
    'concept_rate_type',      // I — FIXED | PERCENT | null
    'concept_rate_value',     // J — nullable (dùng SERVICE_CATALOG default nếu null)
    'hau_ky_rate_per_file'    // K — nullable (chỉ dùng cho role Hậu Kỳ)
  ])
}

function setupSheet_ROLES(ss) {
  const sheet = getOrCreateSheet(ss, 'ROLES')
  setHeaders(sheet, [
    'role_id',    // A
    'role_name',  // B
    'is_system',  // C — TRUE = không được xóa
    'created_by'  // D — "system" hoặc user_id Manager
  ])
}

function setupSheet_ROLE_PERMISSIONS(ss) {
  const sheet = getOrCreateSheet(ss, 'ROLE_PERMISSIONS')
  setHeaders(sheet, [
    'role_id',         // A
    'permission_key',  // B
    'granted'          // C — TRUE | FALSE
  ])
}

function setupSheet_HAU_KY_TASK(ss) {
  const sheet = getOrCreateSheet(ss, 'HAU_KY_TASK')
  setHeaders(sheet, [
    'task_id',          // A
    'order_id',         // B — FK → ORDER
    'assigned_editor',  // C — staff_id (INTERNAL) hoặc tên/liên hệ (OUTSOURCE)
    'editor_type',      // D — INTERNAL | OUTSOURCE
    'photo_count',      // E — số ảnh KH chọn
    'deadline',         // F — yyyy-MM-dd
    'status',           // G — PENDING | IN_PROGRESS | REVIEW | DONE
    'notes',            // H
    'updated_at'        // I
  ])
}

function setupSheet_ALBUM(ss) {
  const sheet = getOrCreateSheet(ss, 'ALBUM')
  setHeaders(sheet, [
    'album_id',      // A
    'order_id',      // B — FK → ORDER
    'concept_id',    // C — FK → CONCEPT
    'album_type',    // D — DIGITAL | PRINT_ALBUM | CANVAS | FRAME
    'spec',          // E — kích thước, số trang...
    'edited_link',   // F — Drive link ảnh đã edit (Hậu Kỳ upload)
    'print_status',  // G — PENDING | PRINTING | READY_TO_SHIP
    'notes'          // H
  ])
}

function setupSheet_SHIPPING(ss) {
  const sheet = getOrCreateSheet(ss, 'SHIPPING')
  setHeaders(sheet, [
    'shipping_id',           // A
    'album_id',              // B — FK → ALBUM
    'order_id',              // C — FK → ORDER
    'recipient_name',        // D — default từ KH, có thể đổi
    'recipient_phone',       // E
    'shipping_address',      // F
    'shipping_status',       // G — PENDING | READY | SHIPPING | DELIVERED
    'carrier',               // H — đơn vị vận chuyển
    'tracking_number',       // I — mã vận đơn (nullable)
    'shipped_at',            // J — timestamp
    'delivered_at',          // K — timestamp
    'remaining_amount',      // L — tiền cần thu khi giao
    'payment_status',        // M — UNPAID | PAID
    'payment_collected_at',  // N — timestamp
    'notes'                  // O
  ])
}

function setupSheet_SALARY(ss) {
  const sheet = getOrCreateSheet(ss, 'SALARY')
  setHeaders(sheet, [
    'salary_id',      // A
    'staff_id',       // B — FK → USERS
    'period',         // C — YYYY-MM
    'base_salary',    // D — snapshot tại thời điểm chốt
    'concept_total',  // E — Photographer/MUA/Support/Sale
    'hk_file_total',  // F — chỉ Hậu Kỳ (rate × Σ photo_count)
    'addon_total',    // G — commission add-on
    'bonus_total',    // H
    'penalty_total',  // I
    'gross_total',    // J — tổng
    'is_locked',      // K — TRUE = đã chốt, không tính lại
    'locked_at',      // L — timestamp
    'locked_by'       // M — user_id Manager
  ])
}

function setupSheet_BONUS_PENALTY(ss) {
  const sheet = getOrCreateSheet(ss, 'BONUS_PENALTY')
  setHeaders(sheet, [
    'bp_id',      // A
    'staff_id',   // B — FK → USERS
    'type',       // C — BONUS | PENALTY
    'amount',     // D
    'note',       // E — lý do
    'date',       // F — yyyy-MM-dd
    'order_id',   // G — nullable (gắn với đơn cụ thể)
    'created_by'  // H — FK → USERS (Manager)
  ])
}

function setupSheet_ORDER_HISTORY(ss) {
  const sheet = getOrCreateSheet(ss, 'ORDER_HISTORY')
  setHeaders(sheet, [
    'history_id',   // A
    'order_id',     // B — FK → ORDER
    'changed_by',   // C — user_id
    'changed_at',   // D — timestamp GMT+7
    'action',       // E — STATUS_CHANGE | FIELD_UPDATE | STAFF_ASSIGN | PAYMENT | CANCEL
    'field_name',   // F — nullable
    'old_value',    // G — nullable
    'new_value'     // H — nullable
  ])
}

function setupSheet_NOTIFICATIONS(ss) {
  const sheet = getOrCreateSheet(ss, 'NOTIFICATIONS')
  setHeaders(sheet, [
    'notif_id',   // A
    'user_id',    // B — FK → USERS (người nhận)
    'type',       // C — DEADLINE_RAW | DEADLINE_HK | DEADLINE_SHIP | PHOTO_SELECTED | PHOTO_APPROVED | RAW_UPLOADED | STAFF_ASSIGNED | HK_READY_FOR_REVIEW | INFO
    'order_id',   // D — nullable
    'message',    // E — tiếng Việt
    'is_read',    // F — FALSE mặc định
    'created_at', // G
    'expires_at'  // H — nullable
  ])
}

function setupSheet_SETTINGS(ss) {
  const sheet = getOrCreateSheet(ss, 'SETTINGS')
  setHeaders(sheet, [
    'key',          // A
    'value',        // B
    'description'   // C
  ])
}

// ─── Seed data ────────────────────────────────────────────────────────────────

function seedRoles(ss) {
  const sheet = ss.getSheetByName('ROLES')
  const existing = sheet.getDataRange().getValues()
  if (existing.length > 1) {
    Logger.log('ROLES đã có dữ liệu, bỏ qua seed')
    return
  }

  const roles = [
    ['manager',    'Quản lý',         true,  'system'],
    ['sale',       'Sale',            true,  'system'],
    ['marketing',  'Marketing',       true,  'system'],
    ['photographer','Photographer',   true,  'system'],
    ['mua',        'Makeup Artist',   true,  'system'],
    ['hau_ky',     'Hậu Kỳ',         true,  'system'],
    ['support',    'Support',         true,  'system'],
  ]
  sheet.getRange(2, 1, roles.length, 4).setValues(roles)
  Logger.log('Seed ROLES: ' + roles.length + ' vai trò')
}

function seedRolePermissions(ss) {
  const sheet = ss.getSheetByName('ROLE_PERMISSIONS')
  const existing = sheet.getDataRange().getValues()
  if (existing.length > 1) {
    Logger.log('ROLE_PERMISSIONS đã có dữ liệu, bỏ qua seed')
    return
  }

  // [permission_key, manager, sale, marketing, photographer, mua, hau_ky, support]
  const matrix = [
    ['order.view_all',              true,  true,  false, false, false, false, true ],
    ['order.view_own',              true,  true,  false, true,  true,  true,  true ],
    ['order.create_edit',           true,  true,  false, false, false, false, false],
    ['order.upload_raw_link',       true,  false, false, true,  false, false, false],
    ['order.add_mua_addon',         true,  false, false, false, true,  false, false],
    ['order.update_status_hk',      true,  false, false, false, false, true,  false],
    ['order.view_financial',        true,  true,  false, false, false, false, false],
    ['calendar.view_all',           true,  true,  false, false, false, true,  true ],
    ['calendar.view_own',           true,  true,  false, true,  true,  true,  true ],
    ['service_catalog.manage',      true,  false, false, false, false, false, false],
    ['service_catalog.view',        true,  true,  false, true,  true,  true,  true ],
    ['addon.manage_all',            true,  false, false, false, false, false, false],
    ['addon.manage_mua_product',    true,  false, false, false, true,  false, false],
    ['addon.view_cost_price',       true,  false, false, false, false, false, false],
    ['voucher.manage',              true,  false, false, false, false, false, false],
    ['voucher.view',                true,  true,  false, false, false, false, false],
    ['finance.view_all',            true,  false, false, false, false, false, false],
    ['finance.view_own_order',      true,  true,  false, false, false, false, false],
    ['hau_ky.view_all',             true,  false, false, false, false, true,  true ],
    ['hau_ky.assign_update',        true,  false, false, false, false, true,  false],
    ['album.manage',                true,  false, false, false, false, true,  false],
    ['album.view',                  true,  false, false, false, false, true,  true ],
    ['shipping.update',             true,  false, false, false, false, false, true ],
    ['salary.view_all',             true,  false, false, false, false, false, false],
    ['salary.view_own',             true,  true,  true,  true,  true,  true,  true ],
    ['salary.manage_config',        true,  false, false, false, false, false, false],
    ['bonus_penalty.manage',        true,  false, false, false, false, false, false],
    ['crm.view_edit',               true,  true,  true,  false, false, false, true ],
    ['dashboard.finance',           true,  false, false, false, false, false, false],
    ['dashboard.marketing',         true,  false, true,  false, false, false, false],
    ['role.manage',                 true,  false, false, false, false, false, false],
    ['role.create',                 true,  false, false, false, false, false, false],
  ]

  const roleOrder = ['manager', 'sale', 'marketing', 'photographer', 'mua', 'hau_ky', 'support']
  const rows = []

  matrix.forEach(function(row) {
    const permKey = row[0]
    roleOrder.forEach(function(roleId, i) {
      rows.push([roleId, permKey, row[i + 1]])
    })
  })

  sheet.getRange(2, 1, rows.length, 3).setValues(rows)
  Logger.log('Seed ROLE_PERMISSIONS: ' + rows.length + ' dòng (' + matrix.length + ' quyền × ' + roleOrder.length + ' vai trò)')
}

function seedSettings(ss) {
  const sheet = ss.getSheetByName('SETTINGS')
  const existing = sheet.getDataRange().getValues()
  if (existing.length > 1) {
    Logger.log('SETTINGS đã có dữ liệu, bỏ qua seed')
    return
  }

  const settings = [
    ['slot_times',               '08:00,10:00,12:00,14:00,16:00,18:00', 'Khung giờ cố định (comma-separated HH:mm)'],
    ['deadline_raw_days',        '1',    'Số ngày sau ĐÃ CHỤP trước khi cảnh báo chậm gửi raw link'],
    ['deadline_hk_days',         '0',    'Cảnh báo ngay khi quá hk_deadline (0 = ngay lập tức)'],
    ['deadline_ship_days',       '3',    'Số ngày sau CHỜ IN trước khi cảnh báo chậm giao'],
    ['logo_url',                 '',     'URL logo webapp (Google Drive share link hoặc CDN URL)'],
    ['webhook_secret',           '',     'Shared secret cho webhook từ webapp chọn ảnh — ĐỔI NGAY SAU SETUP'],
    ['email_alerts_enabled',     'true', 'Bật/tắt email cảnh báo deadline'],
    ['email_alert_recipient',    '',     'Email nhận cảnh báo (Manager) — điền email của bạn'],
    ['notification_expiry_days', '30',   'Số ngày giữ notification chưa đọc'],
  ]
  sheet.getRange(2, 1, settings.length, 3).setValues(settings)
  Logger.log('Seed SETTINGS: ' + settings.length + ' key')
}

function seedLocations(ss) {
  const sheet = ss.getSheetByName('LOCATIONS')
  const existing = sheet.getDataRange().getValues()
  if (existing.length > 1) {
    Logger.log('LOCATIONS đã có dữ liệu, bỏ qua seed')
    return
  }

  // Placeholder — Manager tự cập nhật tên, địa chỉ, SĐT thực tế
  const locations = [
    ['loc_001', 'Cơ sở 1', '(Nhập địa chỉ)', '(Nhập SĐT)', true],
    ['loc_002', 'Cơ sở 2', '(Nhập địa chỉ)', '(Nhập SĐT)', true],
  ]
  sheet.getRange(2, 1, locations.length, 5).setValues(locations)
  Logger.log('Seed LOCATIONS: 2 cơ sở placeholder — Manager cập nhật thông tin thực tế')
}

// ─── Utility: Reset toàn bộ (CHỈ DÙNG KHI DEV/TEST) ─────────────────────────

/**
 * ⚠️ NGUY HIỂM — Xóa TOÀN BỘ dữ liệu (chỉ giữ headers)
 * CHỈ dùng khi cần reset môi trường test.
 * KHÔNG chạy trên dữ liệu thực.
 */
function DANGER_resetAllData() {
  const ui = SpreadsheetApp.getUi()
  const response = ui.alert(
    '⚠️ NGUY HIỂM',
    'Hành động này sẽ XÓA TOÀN BỘ dữ liệu (trừ headers) trên mọi sheet!\n\nChỉ dùng cho môi trường TEST.\n\nBạn chắc chắn?',
    ui.ButtonSet.YES_NO
  )
  if (response !== ui.Button.YES) return

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheetNames = [
    'ORDER','CONCEPT','CUSTOMERS','SERVICE_CATALOG','ADDON_CATALOG',
    'ORDER_ADDON','VOUCHER','LOCATIONS','USERS','ROLES','ROLE_PERMISSIONS',
    'HAU_KY_TASK','ALBUM','SHIPPING','SALARY','BONUS_PENALTY',
    'ORDER_HISTORY','NOTIFICATIONS','SETTINGS'
  ]
  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name)
    if (!sheet) return
    const lastRow = sheet.getLastRow()
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1)
    }
  })
  Logger.log('DANGER_resetAllData: đã xóa toàn bộ dữ liệu')
  ui.alert('✅ Đã reset. Chạy lại setupAll() để seed data mặc định.')
}
