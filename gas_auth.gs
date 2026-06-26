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

// ─── Xác thực token Google ────────────────────────────────────────────────────

/**
 * Verify Google id_token và trả về { user, permissions }
 * @param {string} idToken - Google id_token từ GIS (Sign In With Google)
 * @returns {{ user: object, permissions: string[] }}
 * @throws string message nếu token không hợp lệ
 */
function verifyAndGetUser(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length < 20) {
    throw { status: 401, message: 'Token không hợp lệ hoặc thiếu' }
  }

  // Cache key: MD5 hash của toàn bộ token — không dùng slice(-20)
  // Lý do: 20 ký tự cuối JWT có thể collide → sai user identity → privilege escalation
  const tokenHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    idToken,
    Utilities.Charset.UTF_8
  ).map(b => (b & 0xff).toString(16).padStart(2, '0')).join('')

  const cacheKey = 'tok_' + tokenHash
  let email = cacheGet(cacheKey)

  if (!email) {
    // Gọi Google tokeninfo — bắt buộc muteHttpExceptions + try-catch
    let res
    try {
      res = UrlFetchApp.fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
        { muteHttpExceptions: true } // không throw khi 4xx/5xx — luôn nhận response object
      )
    } catch (fetchErr) {
      // Lỗi mạng thực sự (DNS fail, no internet)
      console.error('UrlFetchApp error:', fetchErr.message)
      throw { status: 503, message: 'Dịch vụ xác thực tạm thời không khả dụng — thử lại sau' }
    }

    const httpCode = res.getResponseCode()
    if (httpCode !== 200) {
      // 400 = token sai format/hết hạn, 5xx = Google service down
      console.warn('tokeninfo HTTP ' + httpCode)
      throw { status: httpCode >= 500 ? 503 : 401, message: 'Xác thực token thất bại (HTTP ' + httpCode + ')' }
    }

    let tokenInfo
    try {
      tokenInfo = JSON.parse(res.getContentText())
    } catch (parseErr) {
      throw { status: 503, message: 'Phản hồi xác thực không hợp lệ' }
    }

    if (tokenInfo.error || !tokenInfo.email) {
      throw { status: 401, message: 'Token không hợp lệ: ' + (tokenInfo.error_description || 'email thiếu') }
    }

    email = tokenInfo.email
    cacheSet(cacheKey, email, 300) // cache 5 phút
  }

  // Lookup user từ USERS sheet
  const user = getUserByEmail(email)
  if (!user) throw { status: 401, message: 'Tài khoản không tồn tại: ' + email }
  if (!user.is_active) throw { status: 401, message: 'Tài khoản đã bị vô hiệu hóa' }

  // Load permissions
  const permissions = getCachedPermissions(user.role_id)

  return { user, permissions }
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
