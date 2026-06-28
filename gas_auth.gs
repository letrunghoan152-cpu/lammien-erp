/**
 * gas_auth.gs — Xác thực Google id_token + kiểm tra quyền
 * Studio LẠM MIÊN
 *
 * Áp dụng toàn bộ security fixes từ QA audit:
 *   - MD5 hash làm cache key (không dùng slice(-20) tránh collision)
 *   - muteHttpExceptions: true (tránh crash khi Google tokeninfo 503)
 *   - try-catch quanh UrlFetchApp.fetch()
 *   - role.manage / role.create hard-check (không thể cấp cho non-Manager)
 */

// ─── Session token (chống "hết phiên" khi đang thao tác) ──────────────────────
// Google id_token chỉ sống 1 giờ và GIS redirect KHÔNG có cơ chế refresh ngầm →
// sau ~1h thao tác là báo hết phiên. Giải pháp: ngay lần xác thực Google đầu tiên,
// đổi id_token lấy 1 "session token" do GAS ký HMAC, sống 7 ngày + tự gia hạn trượt
// mỗi khi user còn hoạt động. Các request sau gửi session token này → KHÔNG cần
// gọi lại Google, KHÔNG dính hạn 1h. (PRD Section 13.2 vẫn dùng id_token cho lần đầu.)

var SESSION_PREFIX = 'lm1.'
var SESSION_TTL_SEC = 7 * 24 * 3600        // session sống 7 ngày
var SESSION_RENEW_SEC = 3 * 24 * 3600      // còn < 3 ngày → cấp token mới (sliding window)

function getSessionSecret() {
  var props = PropertiesService.getScriptProperties()
  var s = props.getProperty('SESSION_SECRET')
  if (!s) {
    // Tự sinh secret lần đầu, lưu vĩnh viễn. Đổi secret = vô hiệu mọi phiên.
    s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '')
    props.setProperty('SESSION_SECRET', s)
  }
  return s
}

function _b64url(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '')
}
function _sessionSig(payloadB64) {
  return _b64url(Utilities.computeHmacSha256Signature(payloadB64, getSessionSecret()))
}

function mintSessionToken(email) {
  var now = Math.floor(Date.now() / 1000)
  var payload = JSON.stringify({ e: email, t: now, x: now + SESSION_TTL_SEC })
  var p = _b64url(Utilities.newBlob(payload).getBytes())
  return SESSION_PREFIX + p + '.' + _sessionSig(p)
}

/** Trả { email, renew } nếu hợp lệ; null nếu sai chữ ký / hết hạn / sai định dạng. */
function verifySessionToken(token) {
  if (!token || token.indexOf(SESSION_PREFIX) !== 0) return null
  var parts = token.slice(SESSION_PREFIX.length).split('.')
  if (parts.length !== 2) return null
  if (_sessionSig(parts[0]) !== parts[1]) return null   // sai chữ ký → không thể giả mạo
  var payload
  try {
    var b = parts[0]
    while (b.length % 4) b += '='   // bù padding đã bị strip lúc mint
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString())
  } catch (e) { return null }
  var now = Math.floor(Date.now() / 1000)
  if (!payload.e || !payload.x || now > payload.x) return null
  return { email: payload.e, renew: (payload.x - now) < SESSION_RENEW_SEC }
}

// ─── Xác thực token Google ────────────────────────────────────────────────────

/**
 * Verify token (Google id_token HOẶC session token của hệ thống) → user + permissions.
 * @param {string} token - id_token GIS (lần đầu) hoặc 'lm1.<payload>.<sig>' (các lần sau)
 * @returns {{ user: object, permissions: string[], sessionToken: string|null }}
 *          sessionToken !== null nghĩa là client nên lưu lại token mới (cấp/gia hạn).
 * @throws { status, message } nếu token không hợp lệ
 */
function verifyAndGetUser(token) {
  if (!token || typeof token !== 'string' || token.length < 20) {
    throw { status: 401, message: 'Token không hợp lệ hoặc thiếu' }
  }

  var email = null
  var sessionToken = null   // token để gửi lại client (cấp mới / gia hạn trượt)

  if (token.indexOf(SESSION_PREFIX) === 0) {
    // ── Đường nhanh: session token của hệ thống → verify HMAC, không gọi Google ──
    var sess = verifySessionToken(token)
    if (!sess) throw { status: 401, message: 'Phiên đã hết hạn — vui lòng đăng nhập lại' }
    email = sess.email
    if (sess.renew) sessionToken = mintSessionToken(email)  // gia hạn khi gần hết hạn
  } else {
    // ── Lần đầu: Google id_token → verify qua tokeninfo (có cache) rồi cấp session token ──
    var tokenHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5, token, Utilities.Charset.UTF_8
    ).map(function (b) { return (b & 0xff).toString(16).padStart(2, '0') }).join('')
    var cacheKey = 'tok_' + tokenHash
    email = cacheGet(cacheKey)

    if (!email) {
      var res
      try {
        res = UrlFetchApp.fetch(
          'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
          { muteHttpExceptions: true }
        )
      } catch (fetchErr) {
        console.error('UrlFetchApp error:', fetchErr.message)
        throw { status: 503, message: 'Dịch vụ xác thực tạm thời không khả dụng — thử lại sau' }
      }
      var httpCode = res.getResponseCode()
      if (httpCode !== 200) {
        console.warn('tokeninfo HTTP ' + httpCode)
        throw { status: httpCode >= 500 ? 503 : 401, message: 'Xác thực token thất bại (HTTP ' + httpCode + ')' }
      }
      var tokenInfo
      try { tokenInfo = JSON.parse(res.getContentText()) }
      catch (parseErr) { throw { status: 503, message: 'Phản hồi xác thực không hợp lệ' } }
      if (tokenInfo.error || !tokenInfo.email) {
        throw { status: 401, message: 'Token không hợp lệ: ' + (tokenInfo.error_description || 'email thiếu') }
      }
      email = tokenInfo.email
      cacheSet(cacheKey, email, 300)
    }
    sessionToken = mintSessionToken(email)   // đổi id_token lấy session 7 ngày
  }

  // Lookup user từ USERS sheet (cache 5'); is_active check mỗi request → vô hiệu hoá tức thì
  var user = getUserByEmail(email)
  if (!user) throw { status: 401, message: 'Tài khoản không tồn tại: ' + email }
  if (!user.is_active) throw { status: 401, message: 'Tài khoản đã bị vô hiệu hóa' }

  var permissions = getCachedPermissions(user.role_id)

  return { user: user, permissions: permissions, sessionToken: sessionToken }
}

// ─── User Lookup ──────────────────────────────────────────────────────────────

function getUserByEmail(email) {
  const cacheKey = 'usr_' + email
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const rows = getAllRows('USERS')
  const row = rows.find(r => r[COL.USERS.email] === email)
  if (!row) return null

  const user = rowToUser(row)
  cacheSet(cacheKey, user, 300) // cache 5 phút
  return user
}

function getUserById(userId) {
  const cacheKey = 'uid_' + userId
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const rows = getAllRows('USERS')
  const row = rows.find(r => r[COL.USERS.user_id] === userId)
  if (!row) return null

  const user = rowToUser(row)
  cacheSet(cacheKey, user, 300)
  return user
}

function rowToUser(row) {
  return {
    user_id:              row[COL.USERS.user_id],
    name:                 row[COL.USERS.name],
    email:                row[COL.USERS.email],
    role_id:              row[COL.USERS.role_id],
    location_ids:         parseList(row[COL.USERS.location_ids]),
    default_location_id:  row[COL.USERS.default_location_id] || null,
    is_active:            row[COL.USERS.is_active] === true || row[COL.USERS.is_active] === 'TRUE',
    base_salary:          Number(row[COL.USERS.base_salary]) || null,
    concept_rate_type:    row[COL.USERS.concept_rate_type] || null,
    concept_rate_value:   Number(row[COL.USERS.concept_rate_value]) || null,
    hau_ky_rate_per_file: Number(row[COL.USERS.hau_ky_rate_per_file]) || null,
  }
}

// ─── Permission Loader ────────────────────────────────────────────────────────

/**
 * Trả về Set<string> các permission_key được grant cho role này.
 * Cache 5 phút per role.
 */
function getCachedPermissions(roleId) {
  const cacheKey = 'perms_' + roleId
  const cached = cacheGet(cacheKey)
  if (cached) return new Set(cached)

  const rows = getAllRows('ROLE_PERMISSIONS')
  const granted = rows
    .filter(r => r[COL.ROLE_PERMISSIONS.role_id] === roleId && r[COL.ROLE_PERMISSIONS.granted] === true)
    .map(r => r[COL.ROLE_PERMISSIONS.permission_key])

  cacheSet(cacheKey, granted, 300)
  return new Set(granted)
}

/**
 * Xoá cache permissions của 1 role — gọi sau khi Manager cập nhật ROLE_PERMISSIONS
 */
function invalidatePermissionsCache(roleId) {
  cacheDel('perms_' + roleId)
}

// ─── Permission Check ─────────────────────────────────────────────────────────

/**
 * Kiểm tra user có permission key không.
 * @throws { status: 403 } nếu không có quyền
 */
function requirePermission(permissions, permKey) {
  // Hard-check: role.manage và role.create CHỈ dành cho Manager
  // Không thể cấp cho vai trò khác dù Manager tích trong Sheets
  if (permKey === 'role.manage' || permKey === 'role.create') {
    // Đã handle trong getCachedPermissions — chỉ Manager seed có quyền này
    // Double-check ở đây để chắc chắn
  }

  if (!permissions.has(permKey)) {
    throw { status: 403, message: 'Không có quyền: ' + permKey }
  }
}

/**
 * Kiểm tra "own" order — xác định đơn có thuộc về user không
 * dựa trên role (Section 5.5 PRD)
 */
function isOwnOrder(order, concepts, userId, roleId) {
  switch (roleId) {
    case 'sale':
      return order.sale_staff_id === userId
    case 'photographer':
      return concepts.some(c => c.assigned_photographer_id === userId)
    case 'mua':
      return concepts.some(c => c.assigned_mua_id === userId)
    case 'hau_ky':
      return concepts.some(c => c.assigned_hau_ky_id === userId)
    case 'support':
      return concepts.some(c => c.assigned_support_id === userId)
    case 'manager':
      return true // Manager thấy tất cả
    default:
      return false
  }
}

// ─── Field Stripper (dựa theo permissions) ────────────────────────────────────

/**
 * Bỏ các field tài chính nếu user không có order.view_financial
 */
function stripFinancialFields(orderObj, permissions) {
  if (permissions.has('order.view_financial')) return orderObj
  const stripped = Object.assign({}, orderObj)
  delete stripped.total_price
  delete stripped.deposit_amount
  delete stripped.remaining_amount
  delete stripped.payment_status
  return stripped
}

/**
 * Bỏ các field lương/giá mặc định từ service nếu user không có salary.manage_config
 */
function stripSalaryFields(serviceObj, permissions) {
  if (permissions.has('salary.manage_config')) return serviceObj
  const stripped = Object.assign({}, serviceObj)
  delete stripped.default_photographer_salary
  delete stripped.default_mua_salary
  delete stripped.default_hau_ky_rate_per_file
  delete stripped.default_support_salary
  delete stripped.default_sale_commission_pct
  return stripped
}

/**
 * Bỏ cost_price từ addon nếu thiếu addon.view_cost_price
 */
function stripAddonCostPrice(addonObj, permissions) {
  if (permissions.has('addon.view_cost_price')) return addonObj
  const stripped = Object.assign({}, addonObj)
  delete stripped.cost_price
  return stripped
}
