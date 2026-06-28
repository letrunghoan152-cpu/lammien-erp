/**
 * gas_utils.gs — Helpers dùng chung toàn bộ GAS
 * Studio LẠM MIÊN
 *
 * Bao gồm:
 *   - Response envelope (jsonOk, jsonError)
 *   - CacheService wrapper
 *   - LockService wrapper
 *   - ID generator
 *   - Sheet accessor
 *   - Timestamp + date helpers
 *   - Array helpers cho comma-separated fields
 */

// ─── Response Envelope ────────────────────────────────────────────────────────
// GAS Web App LUÔN trả HTTP 200. Lỗi nghiệp vụ nhúng vào JSON body.
// Client phải đọc body.ok để biết thành công hay thất bại.

// Token session mới cần đẩy về client (cấp mới / gia hạn). doPost gán trước khi route;
// jsonOk tự kèm vào envelope. GAS chạy mới mỗi request nên biến này an toàn theo từng lần gọi.
var _SESSION_REFRESH = null

function jsonOk(data) {
  var env = { ok: true, data: data }
  if (_SESSION_REFRESH) env.session = _SESSION_REFRESH
  return ContentService
    .createTextOutput(JSON.stringify(env))
    .setMimeType(ContentService.MimeType.JSON)
}

function jsonError(appStatus, message) {
  // appStatus: 400 (bad request), 401 (unauth), 403 (forbidden),
  //            409 (conflict), 503 (service unavailable)
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, status: appStatus, error: message }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─── Sheet Accessor ───────────────────────────────────────────────────────────

var _ss = null
function getSpreadsheet() {
  if (!_ss) _ss = SpreadsheetApp.getActiveSpreadsheet()
  return _ss
}

function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name)
  if (!sheet) throw new Error('Sheet không tồn tại: ' + name)
  return sheet
}

function getAllRows(sheetName) {
  const sheet = getSheet(sheetName)
  const data = sheet.getDataRange().getValues()
  return data.slice(1) // bỏ header row
}

function appendRow(sheetName, rowArray) {
  getSheet(sheetName).appendRow(rowArray)
}

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateOrderId() {
  const now = new Date()
  const ym = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyyMM')
  const sheet = getSheet('ORDER')
  const lastRow = sheet.getLastRow()
  // Đếm số đơn trong tháng hiện tại để tạo sequence
  let seq = 1
  if (lastRow > 1) {
    const orders = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    const monthOrders = orders.filter(r => r[0].toString().includes('ORD-' + ym))
    seq = monthOrders.length + 1
  }
  return 'ORD-' + ym + '-' + String(seq).padStart(3, '0')
}

function generateId(prefix) {
  // prefix: 'cpt', 'cus', 'svc', 'adn', 'vch', 'tsk', 'alb', 'shp', 'ntf'...
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ─── Timestamp ────────────────────────────────────────────────────────────────

function nowVN() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss")
}

function todayVN() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd')
}

// ─── CacheService Wrapper ─────────────────────────────────────────────────────

var _scriptCache = null
function getCache() {
  if (!_scriptCache) _scriptCache = CacheService.getScriptCache()
  return _scriptCache
}

function cacheGet(key) {
  const val = getCache().get(key)
  if (!val) return null
  try { return JSON.parse(val) } catch (e) { return val }
}

function cacheSet(key, value, ttlSeconds) {
  getCache().put(key, JSON.stringify(value), ttlSeconds || 300)
}

function cacheDel(key) {
  getCache().remove(key)
}

// ─── LockService Wrapper ──────────────────────────────────────────────────────

/**
 * Chạy fn() trong ScriptLock. Tự release khi xong hoặc lỗi.
 * @param {Function} fn - hàm cần chạy trong lock
 * @param {number} waitMs - ms chờ lấy lock (default 10000 = 10s)
 */
function withLock(fn, waitMs) {
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(waitMs || 10000)
  } catch (e) {
    throw new Error('Hệ thống đang bận — thử lại sau vài giây')
  }
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// ─── SETTINGS Reader ──────────────────────────────────────────────────────────

var _settingsCache = null

function getSettings() {
  const cached = cacheGet('_settings')
  if (cached) return cached

  const rows = getAllRows('SETTINGS')
  const settings = {}
  rows.forEach(function(row) {
    if (row[COL.SETTINGS.key]) {
      settings[row[COL.SETTINGS.key]] = row[COL.SETTINGS.value]
    }
  })
  cacheSet('_settings', settings, 600) // TTL 10 phút
  return settings
}

function getSetting(key, defaultValue) {
  const s = getSettings()
  return (s[key] !== undefined && s[key] !== '') ? s[key] : (defaultValue !== undefined ? defaultValue : null)
}

function invalidateSettings() {
  cacheDel('_settings')
}

// ─── Array helpers (comma-separated fields) ───────────────────────────────────

function parseList(str) {
  if (!str || str === '') return []
  return str.toString().split(',').map(s => s.trim()).filter(Boolean)
}

function serializeList(arr) {
  if (!Array.isArray(arr)) return ''
  return arr.filter(Boolean).join(',')
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function paginate(arr, limit, offset) {
  const lim = Math.min(parseInt(limit) || 50, 200) // max 200 rows/request
  const off = parseInt(offset) || 0
  return {
    items: arr.slice(off, off + lim),
    total: arr.length,
    hasMore: (off + lim) < arr.length,
    limit: lim,
    offset: off,
  }
}

// ─── Optimistic Lock Check ────────────────────────────────────────────────────

/**
 * Kiểm tra version của ORDER trước khi ghi.
 * @returns {object} { rowIndex, rowData } nếu version khớp
 * @throws nếu không tìm thấy order hoặc version conflict
 */
function checkOrderVersion(orderId, clientVersion) {
  const sheet = getSheet('ORDER')
  const rows = sheet.getDataRange().getValues()
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.ORDER.order_id] === orderId) {
      const serverVersion = Number(rows[i][COL.ORDER.version])
      const cv = Number(clientVersion)
      if (serverVersion !== cv) {
        throw { isConflict: true, serverVersion, clientVersion: cv }
      }
      return { rowIndex: i + 1, rowData: rows[i] } // rowIndex = 1-based (Sheets)
    }
  }
  throw new Error('Không tìm thấy đơn hàng: ' + orderId)
}

// ─── ORDER_HISTORY Logger ─────────────────────────────────────────────────────

function logHistory(orderId, changedBy, action, fieldName, oldValue, newValue) {
  appendRow('ORDER_HISTORY', [
    generateId('hst'),
    orderId,
    changedBy,
    nowVN(),
    action,
    fieldName || '',
    oldValue !== undefined ? String(oldValue) : '',
    newValue !== undefined ? String(newValue) : '',
  ])
}

// ─── Notification Creator ─────────────────────────────────────────────────────

function createNotification(userId, type, orderId, message) {
  const expiryDays = parseInt(getSetting('notification_expiry_days', 30))
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiryDays)

  appendRow('NOTIFICATIONS', [
    generateId('ntf'),
    userId,
    type,
    orderId || '',
    message,
    false,
    nowVN(),
    Utilities.formatDate(expiresAt, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'),
  ])
}

/**
 * Gửi notification đến nhiều user, với STAFF_ASSIGNED dedup rule:
 * chỉ tạo 1 notification STAFF_ASSIGNED per (user_id, order_id)
 */
function createNotifications(userIds, type, orderId, message) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]

  uniqueUserIds.forEach(function(userId) {
    if (type === 'STAFF_ASSIGNED') {
      // Dedup: kiểm tra đã có chưa
      const existing = getAllRows('NOTIFICATIONS').find(function(row) {
        return row[COL.NOTIFICATIONS.user_id] === userId
          && row[COL.NOTIFICATIONS.order_id] === orderId
          && row[COL.NOTIFICATIONS.type] === 'STAFF_ASSIGNED'
      })
      if (existing) return // skip
    }
    createNotification(userId, type, orderId, message)
  })
}
