/**
 * gas_Code.gs — Entry point GAS Web App
 * Studio LẠM MIÊN
 *
 * Deploy settings (Apps Script → Deploy → New deployment):
 *   Execute as:    Me (your Google account)
 *   Who has access: Anyone
 *
 * Sau khi deploy: copy Web App URL → dán vào .env.local của Next.js
 *   NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/YOUR_ID/exec
 *
 * File này chứa:
 *   - doPost()       : entry point, auth, routing
 *   - doGet()        : keepAlive ping (không cần auth)
 *   - setupKeepAlive(): tạo Time-Trigger ping mỗi 4 phút (chạy 1 lần)
 *   - action handlers: auth.verify, settings.get
 *   - webhook handlers: photo-selected, photo-approved
 */

// ─── Entry Points ─────────────────────────────────────────────────────────────

var INIT_KEY = 'lammien_init_8472'  // one-time setup key (xoá sau khi init xong nếu muốn)

function doGet(e) {
  // ── One-time headless setup: GET ?init=<INIT_KEY> → chạy setupAll + seedDevData ──
  if (e && e.parameter && e.parameter.init === INIT_KEY) {
    try {
      setupAll()
      seedDevData()
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, init: 'done', ts: nowVN() }))
        .setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message || err) }))
        .setMimeType(ContentService.MimeType.JSON)
    }
  }
  // ── One-time: bật keep-alive trigger (chống cold start) qua GET ?keepalive=<KEY> ──
  if (e && e.parameter && e.parameter.keepalive === INIT_KEY) {
    try {
      setupKeepAlive()
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, keepalive: 'enabled (mỗi 4 phút)', ts: nowVN() }))
        .setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message || err) }))
        .setMimeType(ContentService.MimeType.JSON)
    }
  }
  // Dùng để warm GAS (keepAlive ping từ frontend khi mount login page)
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'LamMien Studio API', ts: nowVN() }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const params = e.parameter || {}
    const action = params.action || ''

    // ── Webhook endpoints (không dùng Google OAuth) ───────────────────────────
    if (action === 'webhook/photo-selected') return handleWebhookPhotoSelected(params)
    if (action === 'webhook/photo-approved') return handleWebhookPhotoApproved(params)

    // ── Authenticated endpoints ───────────────────────────────────────────────
    const idToken = params.token
    if (!idToken) return jsonError(401, 'Thiếu token xác thực')

    let user, permissions
    try {
      const auth = verifyAndGetUser(idToken)
      user = auth.user
      permissions = auth.permissions
    } catch (authErr) {
      const status = authErr.status || 401
      return jsonError(status, authErr.message || 'Xác thực thất bại')
    }

    // ── Route đến handler ────────────────────────────────────────────────────
    return route(action, params, user, permissions)

  } catch (err) {
    // Lỗi không lường trước — không để crash trả HTML
    console.error('doPost unhandled error:', err.message || err)
    return jsonError(500, 'Lỗi hệ thống: ' + (err.message || 'Unknown error'))
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

function route(action, params, user, permissions) {
  try {
    switch (action) {

      // Auth & Session
      case 'auth.verify':       return actionAuthVerify(user, permissions)
      case 'settings.get':      return actionSettingsGet(user, permissions)
      case 'settings.update':   return actionSettingsUpdate(params, user, permissions)

      // Orders
      case 'orders.list':             return actionOrdersList(params, user, permissions)
      case 'orders.get':              return actionOrdersGet(params, user, permissions)
      case 'orders.create':           return actionOrdersCreate(params, user, permissions)
      case 'orders.update':           return actionOrdersUpdate(params, user, permissions)
      case 'orders.updateStatus':     return actionOrdersUpdateStatus(params, user, permissions)
      case 'orders.updateStatusHK':   return actionOrdersUpdateStatusHK(params, user, permissions)
      case 'orders.overrideDeliveryType': return actionOrdersOverrideDeliveryType(params, user, permissions)
      case 'orders.uploadRawLink':    return actionOrdersUploadRawLink(params, user, permissions)
      case 'orders.addMuaAddon':      return actionOrdersAddMuaAddon(params, user, permissions)
      case 'orders.history':          return actionOrdersHistory(params, user, permissions)

      // Customers
      case 'customers.search': return actionCustomersSearch(params, user, permissions)
      case 'customers.get':    return actionCustomersGet(params, user, permissions)
      case 'customers.upsert': return actionCustomersUpsert(params, user, permissions)

      // Calendar
      case 'calendar.getDay':       return actionCalendarGetDay(params, user, permissions)
      case 'calendar.checkConflict': return actionCalendarCheckConflict(params, user, permissions)
      case 'staff.available':        return actionStaffAvailable(params, user, permissions)

      // Catalog
      case 'services.list':   return actionServicesList(params, user, permissions)
      case 'services.upsert': return actionServicesUpsert(params, user, permissions)
      case 'addons.list':            return actionAddonsList(params, user, permissions)
      case 'addons.listMuaProducts': return actionAddonsListMuaProducts(params, user, permissions)
      case 'addons.upsert':          return actionAddonsUpsert(params, user, permissions)
      case 'vouchers.list':   return actionVouchersList(params, user, permissions)
      case 'vouchers.upsert': return actionVouchersUpsert(params, user, permissions)
      case 'vouchers.apply':  return actionVouchersApply(params, user, permissions)
      case 'locations.list':   return actionLocationsList(params, user, permissions)
      case 'locations.upsert': return actionLocationsUpsert(params, user, permissions)
      case 'bootstrap':        return actionBootstrap(params, user, permissions)

      // Hậu Kỳ & Album
      case 'hauky.list':        return actionHaukyList(params, user, permissions)
      case 'hauky.update':      return actionHaukyUpdate(params, user, permissions)
      case 'hauky.notifyReady': return actionHaukyNotifyReady(params, user, permissions)
      case 'albums.list':       return actionAlbumsList(params, user, permissions)
      case 'albums.upsert':     return actionAlbumsUpsert(params, user, permissions)
      case 'shipping.list':     return actionShippingList(params, user, permissions)
      case 'shipping.update':   return actionShippingUpdate(params, user, permissions)

      // Tài chính & Lương
      case 'finance.income':        return actionFinanceIncome(params, user, permissions)
      case 'finance.expense':       return actionFinanceExpense(params, user, permissions)
      case 'finance.debt':          return actionFinanceDebt(params, user, permissions)
      case 'salary.list':           return actionSalaryList(params, user, permissions)
      case 'salary.compute':        return actionSalaryCompute(params, user, permissions)
      case 'bonus_penalty.upsert':  return actionBonusPenaltyUpsert(params, user, permissions)

      // Nhân sự & Phân quyền
      case 'users.list':          return actionUsersList(params, user, permissions)
      case 'users.upsert':        return actionUsersUpsert(params, user, permissions)
      case 'roles.list':          return actionRolesList(params, user, permissions)
      case 'roles.upsert':        return actionRolesUpsert(params, user, permissions)
      case 'permissions.update':  return actionPermissionsUpdate(params, user, permissions)

      // Notifications
      case 'notifications.list':     return actionNotificationsList(params, user, permissions)
      case 'notifications.markRead': return actionNotificationsMarkRead(params, user, permissions)

      default:
        return jsonError(400, 'Action không tồn tại: ' + action)
    }
  } catch (err) {
    // Lỗi có status (từ requirePermission, checkOrderVersion, withLock...)
    if (err.status) return jsonError(err.status, err.message)
    if (err.isConflict) return jsonError(409, 'Đơn hàng vừa được người khác cập nhật — vui lòng tải lại')
    console.error('route error [' + action + ']:', err.message || err)
    return jsonError(500, 'Lỗi xử lý: ' + (err.message || 'Unknown'))
  }
}

// ─── Auth & Session Handlers ──────────────────────────────────────────────────

function actionAuthVerify(user, permissions) {
  // Trả về user info + danh sách permissions để client cache trong sessionStorage
  return jsonOk({
    user: {
      user_id:             user.user_id,
      name:                user.name,
      email:               user.email,
      role_id:             user.role_id,
      location_ids:        user.location_ids,
      default_location_id: user.default_location_id,
    },
    permissions: Array.from(permissions),
  })
}

function actionSettingsGet(user, permissions) {
  const s = getSettings()
  // Không trả webhook_secret ra client
  const safe = Object.assign({}, s)
  delete safe.webhook_secret
  return jsonOk(safe)
}

function actionSettingsUpdate(params, user, permissions) {
  // Chỉ Manager (hard-check, không dùng ROLE_PERMISSIONS)
  if (user.role_id !== 'manager') return jsonError(403, 'Chỉ Manager được cập nhật cài đặt')

  const key = params.key
  const value = params.value
  if (!key) return jsonError(400, 'Thiếu key')

  const sheet = getSheet('SETTINGS')
  const rows = sheet.getDataRange().getValues()
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.SETTINGS.key] === key) {
      sheet.getRange(i + 1, COL.SETTINGS.value + 1).setValue(value)
      invalidateSettings()
      return jsonOk({ key, value })
    }
  }
  // Key chưa tồn tại → thêm mới
  appendRow('SETTINGS', [key, value, ''])
  invalidateSettings()
  return jsonOk({ key, value })
}

// ─── Webhook Handlers ─────────────────────────────────────────────────────────

function handleWebhookPhotoSelected(params) {
  const secret = params.webhook_secret || params.secret
  const expectedSecret = getSetting('webhook_secret', '')

  if (!expectedSecret || secret !== expectedSecret) {
    return jsonError(401, 'Webhook secret không hợp lệ')
  }

  const { order_id, selected_count, selected_at, idempotency_key } = params

  if (!order_id) return jsonError(400, 'Thiếu order_id')
  if (!idempotency_key) return jsonError(400, 'Thiếu idempotency_key — webapp phải gửi kèm key duy nhất cho mỗi sự kiện')

  // Idempotency check
  const idemKey = 'idem_' + idempotency_key
  if (cacheGet(idemKey)) {
    return jsonOk({ idempotent: true, message: 'Sự kiện này đã được xử lý' })
  }

  // Defense-in-depth: check HAU_KY_TASK đã tồn tại chưa
  const existingTask = getAllRows('HAU_KY_TASK').find(r => r[COL.HAU_KY_TASK.order_id] === order_id)
  if (existingTask) {
    cacheSet(idemKey, '1', 86400)
    return jsonOk({ idempotent: true, task_id: existingTask[COL.HAU_KY_TASK.task_id] })
  }

  return withLock(function() {
    // 1. Cập nhật ORDER status
    const orderRows = getSheet('ORDER').getDataRange().getValues()
    let orderRowIdx = -1
    let orderRow = null
    for (let i = 1; i < orderRows.length; i++) {
      if (orderRows[i][COL.ORDER.order_id] === order_id) {
        orderRowIdx = i + 1
        orderRow = orderRows[i]
        break
      }
    }
    if (orderRowIdx === -1) return jsonError(404, 'Không tìm thấy đơn: ' + order_id)

    getSheet('ORDER').getRange(orderRowIdx, COL.ORDER.status + 1).setValue('CHON_ANH')
    getSheet('ORDER').getRange(orderRowIdx, COL.ORDER.updated_at + 1).setValue(nowVN())
    logHistory(order_id, 'webhook', 'STATUS_CHANGE', 'status', orderRow[COL.ORDER.status], 'CHON_ANH')

    // 2. Tạo HAU_KY_TASK
    // Tìm assigned_hau_ky_id từ concept 1
    const concepts = getAllRows('CONCEPT').filter(r => r[COL.CONCEPT.order_id] === order_id)
    const concept1 = concepts.find(c => Number(c[COL.CONCEPT.concept_index]) === 1)
    const assignedHauKyId = concept1 ? concept1[COL.CONCEPT.assigned_hau_ky_id] : ''

    const taskId = generateId('tsk')
    appendRow('HAU_KY_TASK', [
      taskId,
      order_id,
      assignedHauKyId || '', // assigned_editor = CONCEPT.assigned_hau_ky_id
      assignedHauKyId ? 'INTERNAL' : '',
      parseInt(selected_count) || 0,
      '', // deadline — Manager set sau
      'PENDING',
      '',
      nowVN(),
    ])

    // 3. Tạo notifications
    if (assignedHauKyId) {
      createNotifications([assignedHauKyId], 'PHOTO_SELECTED', order_id,
        'KH đã chọn ảnh xong — đơn ' + order_id + '. Vào hệ thống nhận task hậu kỳ.')
    }

    // Đánh dấu idempotency
    cacheSet(idemKey, '1', 86400)

    return jsonOk({ task_id: taskId, assigned_hau_ky_id: assignedHauKyId || null })
  })
}

function handleWebhookPhotoApproved(params) {
  const secret = params.webhook_secret || params.secret
  const expectedSecret = getSetting('webhook_secret', '')

  if (!expectedSecret || secret !== expectedSecret) {
    return jsonError(401, 'Webhook secret không hợp lệ')
  }

  const { order_id, approved_at, idempotency_key } = params
  if (!order_id) return jsonError(400, 'Thiếu order_id')
  if (!idempotency_key) return jsonError(400, 'Thiếu idempotency_key')

  const idemKey = 'idem_' + idempotency_key
  if (cacheGet(idemKey)) {
    return jsonOk({ idempotent: true, message: 'Sự kiện này đã được xử lý' })
  }

  return withLock(function() {
    const orderRows = getSheet('ORDER').getDataRange().getValues()
    let orderRowIdx = -1, orderRow = null
    for (let i = 1; i < orderRows.length; i++) {
      if (orderRows[i][COL.ORDER.order_id] === order_id) {
        orderRowIdx = i + 1; orderRow = orderRows[i]; break
      }
    }
    if (orderRowIdx === -1) return jsonError(404, 'Không tìm thấy đơn: ' + order_id)

    const prevStatus = orderRow[COL.ORDER.status]
    getSheet('ORDER').getRange(orderRowIdx, COL.ORDER.status + 1).setValue('DUYET_ANH')
    getSheet('ORDER').getRange(orderRowIdx, COL.ORDER.updated_at + 1).setValue(nowVN())
    logHistory(order_id, 'webhook', 'STATUS_CHANGE', 'status', prevStatus, 'DUYET_ANH')

    // Notify Hậu Kỳ + Manager
    const concepts = getAllRows('CONCEPT').filter(r => r[COL.CONCEPT.order_id] === order_id)
    const hauKyIds = [...new Set(concepts.map(c => c[COL.CONCEPT.assigned_hau_ky_id]).filter(Boolean))]
    const sale = orderRow[COL.ORDER.sale_staff_id]
    const allUsers = getAllRows('USERS')
    const managerIds = allUsers
      .filter(r => r[COL.USERS.role_id] === 'manager' && r[COL.USERS.is_active])
      .map(r => r[COL.USERS.user_id])

    createNotifications([...hauKyIds, ...managerIds, sale].filter(Boolean),
      'PHOTO_APPROVED', order_id,
      'KH đã duyệt ảnh — đơn ' + order_id + '. Tiến hành bước tiếp theo.')

    cacheSet(idemKey, '1', 86400)
    return jsonOk({ status: 'DUYET_ANH' })
  })
}

// ─── Keep-Alive ───────────────────────────────────────────────────────────────

/**
 * Chạy 1 lần để tạo trigger warm GAS mỗi 4 phút.
 * Sau khi chạy, kiểm tra Apps Script → Triggers để xác nhận.
 */
function setupKeepAlive() {
  // Xóa trigger cũ nếu có
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'keepAlive') {
      ScriptApp.deleteTrigger(t)
    }
  })
  // GAS chỉ cho everyMinutes(1|5|10|15|30). Dùng 1 phút để LUÔN warm (ưu tiên ổn định).
  ScriptApp.newTrigger('keepAlive')
    .timeBased()
    .everyMinutes(1)
    .create()
  Logger.log('keepAlive trigger đã được tạo — chạy mỗi 1 phút')
}

function keepAlive() {
  // Không làm gì — chỉ cần GAS instance thức dậy
  // Chi phí: <1ms/lần × 360 lần/ngày = <6 giây runtime/ngày (quota: 90 phút/ngày)
}

// ─── Placeholder handlers (Phase 2+) ─────────────────────────────────────────
// Các handlers dưới đây trả stub để router không crash.
// Sẽ được implement đầy đủ trong Phase 2 → Phase 7.

// ── Orders / Customers / Calendar / services.list ──
//    Implement đầy đủ trong gas_orders.gs, gas_customers.gs, gas_calendar.gs, gas_catalog.gs
//    (các stub Phase 2 trước đây đã được gỡ bỏ để tránh trùng tên hàm)

function actionServicesUpsert(p, u, perms) {
  requirePermission(perms, 'service_catalog.manage')
  return jsonOk({ _note: 'Phase 3 — chưa implement' })
}
// actionAddonsList / actionAddonsListMuaProducts → implement trong gas_catalog.gs
function actionAddonsUpsert(p, u, perms) {
  requirePermission(perms, 'addon.manage_all')
  return jsonOk({ _note: 'Phase 4 — chưa implement' })
}
// actionVouchersList → implement trong gas_catalog.gs
function actionVouchersUpsert(p, u, perms) {
  requirePermission(perms, 'voucher.manage')
  return jsonOk({ _note: 'Phase 4 — chưa implement' })
}
function actionVouchersApply(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  return jsonOk({ _note: 'Phase 4 — chưa implement' })
}
function actionHaukyList(p, u, perms) {
  requirePermission(perms, 'hau_ky.view_all')
  return jsonOk({ tasks: [], _note: 'Phase 6 — chưa implement' })
}
function actionHaukyUpdate(p, u, perms) {
  requirePermission(perms, 'hau_ky.assign_update')
  return jsonOk({ _note: 'Phase 6 — chưa implement' })
}
function actionHaukyNotifyReady(p, u, perms) {
  requirePermission(perms, 'hau_ky.assign_update')
  return jsonOk({ _note: 'Phase 6 — chưa implement' })
}
function actionAlbumsList(p, u, perms) {
  requirePermission(perms, perms.has('album.manage') ? 'album.manage' : 'album.view')
  return jsonOk({ albums: [], _note: 'Phase 6 — chưa implement' })
}
function actionAlbumsUpsert(p, u, perms) {
  requirePermission(perms, 'album.manage')
  return jsonOk({ _note: 'Phase 6 — chưa implement' })
}
function actionShippingList(p, u, perms) {
  requirePermission(perms, 'shipping.update')
  return jsonOk({ shipping: [], _note: 'Phase 6 — chưa implement' })
}
function actionShippingUpdate(p, u, perms) {
  requirePermission(perms, 'shipping.update')
  return jsonOk({ _note: 'Phase 6 — chưa implement' })
}
function actionFinanceIncome(p, u, perms) {
  requirePermission(perms, 'finance.view_all')
  return jsonOk({ _note: 'Phase 7 — chưa implement' })
}
function actionFinanceExpense(p, u, perms) {
  requirePermission(perms, 'finance.view_all')
  return jsonOk({ _note: 'Phase 7 — chưa implement' })
}
function actionFinanceDebt(p, u, perms) {
  requirePermission(perms, 'finance.view_all')
  return jsonOk({ _note: 'Phase 7 — chưa implement' })
}
function actionSalaryList(p, u, perms) {
  requirePermission(perms, perms.has('salary.view_all') ? 'salary.view_all' : 'salary.view_own')
  return jsonOk({ salary: [], _note: 'Phase 5 — chưa implement' })
}
function actionSalaryCompute(p, u, perms) {
  requirePermission(perms, 'salary.manage_config')
  return jsonOk({ _note: 'Phase 5 — chưa implement' })
}
function actionBonusPenaltyUpsert(p, u, perms) {
  requirePermission(perms, 'bonus_penalty.manage')
  return jsonOk({ _note: 'Phase 5 — chưa implement' })
}
// actionUsersList / actionUsersUpsert / actionRolesList / actionRolesUpsert
// / actionPermissionsUpdate → implement đầy đủ trong gas_admin.gs (Phase 3)

function actionNotificationsList(p, u, perms) {
  // Không cần permission riêng — mọi user đều nhận notification của mình
  const rows = getAllRows('NOTIFICATIONS')
  const userNotifs = rows
    .filter(r => r[COL.NOTIFICATIONS.user_id] === u.user_id && !r[COL.NOTIFICATIONS.is_read])
    .map(r => ({
      notif_id:   r[COL.NOTIFICATIONS.notif_id],
      type:       r[COL.NOTIFICATIONS.type],
      order_id:   r[COL.NOTIFICATIONS.order_id],
      message:    r[COL.NOTIFICATIONS.message],
      is_read:    r[COL.NOTIFICATIONS.is_read],
      created_at: r[COL.NOTIFICATIONS.created_at],
    }))
    .sort((a, b) => b.created_at > a.created_at ? 1 : -1)
    .slice(0, 50)
  return jsonOk({ notifications: userNotifs })
}
function actionNotificationsMarkRead(p, u, perms) {
  const notifId = p.notif_id // null = đọc tất cả
  const sheet = getSheet('NOTIFICATIONS')
  const rows = sheet.getDataRange().getValues()
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.NOTIFICATIONS.user_id] !== u.user_id) continue
    if (notifId && rows[i][COL.NOTIFICATIONS.notif_id] !== notifId) continue
    sheet.getRange(i + 1, COL.NOTIFICATIONS.is_read + 1).setValue(true)
  }
  return jsonOk({ ok: true })
}
