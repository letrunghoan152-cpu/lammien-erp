/**
 * gas_admin.gs — Phase 3: Nhân sự + Vai trò + Phân quyền (RBAC) + Cơ sở
 * Studio LẠM MIÊN
 *
 * users.list/upsert · roles.list/upsert · permissions.update · locations.upsert
 * Các stub cùng tên trong gas_Code.gs đã được gỡ.
 */

// ─── Permission catalog (nhãn tiếng Việt + nhóm) — nguồn cho UI ma trận quyền ──

var PERMISSION_CATALOG = [
  { key: 'order.view_all',           label: 'Xem tất cả đơn',            group: 'Đơn hàng' },
  { key: 'order.view_own',           label: 'Xem đơn của mình',          group: 'Đơn hàng' },
  { key: 'order.create_edit',        label: 'Tạo / sửa đơn',             group: 'Đơn hàng' },
  { key: 'order.upload_raw_link',    label: 'Upload link ảnh raw',       group: 'Đơn hàng' },
  { key: 'order.add_mua_addon',      label: 'Thêm add-on MUA vào đơn',   group: 'Đơn hàng' },
  { key: 'order.update_status_hk',   label: 'Chuyển trạng thái (Hậu kỳ)', group: 'Đơn hàng' },
  { key: 'order.view_financial',     label: 'Xem tài chính đơn',         group: 'Đơn hàng' },
  { key: 'calendar.view_all',        label: 'Xem lịch tất cả',           group: 'Lịch' },
  { key: 'calendar.view_own',        label: 'Xem lịch của mình',         group: 'Lịch' },
  { key: 'service_catalog.manage',   label: 'Quản lý dịch vụ',           group: 'Danh mục' },
  { key: 'service_catalog.view',     label: 'Xem dịch vụ',               group: 'Danh mục' },
  { key: 'addon.manage_all',         label: 'Quản lý mọi add-on',        group: 'Danh mục' },
  { key: 'addon.manage_mua_product', label: 'Quản lý add-on MUA',        group: 'Danh mục' },
  { key: 'addon.view_cost_price',    label: 'Xem giá nhập add-on',       group: 'Danh mục' },
  { key: 'voucher.manage',           label: 'Quản lý voucher',           group: 'Danh mục' },
  { key: 'voucher.view',             label: 'Xem voucher',               group: 'Danh mục' },
  { key: 'hau_ky.view_all',          label: 'Xem mọi task hậu kỳ',       group: 'Hậu kỳ & Giao hàng' },
  { key: 'hau_ky.assign_update',     label: 'Cập nhật tiến độ hậu kỳ',   group: 'Hậu kỳ & Giao hàng' },
  { key: 'album.manage',             label: 'Quản lý album',             group: 'Hậu kỳ & Giao hàng' },
  { key: 'album.view',               label: 'Xem album',                 group: 'Hậu kỳ & Giao hàng' },
  { key: 'shipping.update',          label: 'Cập nhật giao hàng',        group: 'Hậu kỳ & Giao hàng' },
  { key: 'finance.view_all',         label: 'Xem tài chính toàn bộ',     group: 'Tài chính & Lương' },
  { key: 'finance.view_own_order',   label: 'Xem tài chính đơn mình',    group: 'Tài chính & Lương' },
  { key: 'salary.view_all',          label: 'Xem lương tất cả',          group: 'Tài chính & Lương' },
  { key: 'salary.view_own',          label: 'Xem lương của mình',        group: 'Tài chính & Lương' },
  { key: 'salary.manage_config',     label: 'Quản lý cấu hình lương / nhân sự', group: 'Tài chính & Lương' },
  { key: 'bonus_penalty.manage',     label: 'Quản lý thưởng / phạt',     group: 'Tài chính & Lương' },
  { key: 'crm.view_edit',            label: 'CRM (xem / sửa KH)',        group: 'Khác' },
  { key: 'dashboard.finance',        label: 'Dashboard tài chính',       group: 'Khác' },
  { key: 'dashboard.marketing',      label: 'Dashboard marketing',       group: 'Khác' },
  { key: 'role.manage',              label: 'Quản lý phân quyền (chỉ Manager)', group: 'Hệ thống' },
  { key: 'role.create',              label: 'Tạo vai trò mới (chỉ Manager)',    group: 'Hệ thống' },
]

// Quyền chỉ Manager được giữ — không thể cấp cho vai trò khác (PRD Section 10.1)
var MANAGER_ONLY_PERMS = ['role.manage', 'role.create']

// ─── roles.list — vai trò + catalog + ma trận quyền ───────────────────────────

function actionRolesList(p, u, perms) {
  requirePermission(perms, 'role.manage')

  var roles = getAllRows('ROLES').map(function (r) {
    return {
      role_id:   r[COL.ROLES.role_id],
      role_name: r[COL.ROLES.role_name],
      is_system: r[COL.ROLES.is_system] === true || r[COL.ROLES.is_system] === 'TRUE',
    }
  })

  // ma trận: { role_id: { perm_key: bool } }
  var matrix = {}
  roles.forEach(function (r) { matrix[r.role_id] = {} })
  getAllRows('ROLE_PERMISSIONS').forEach(function (row) {
    var rid = row[COL.ROLE_PERMISSIONS.role_id]
    var key = row[COL.ROLE_PERMISSIONS.permission_key]
    var granted = row[COL.ROLE_PERMISSIONS.granted] === true || row[COL.ROLE_PERMISSIONS.granted] === 'TRUE'
    if (!matrix[rid]) matrix[rid] = {}
    matrix[rid][key] = granted
  })

  return jsonOk({ roles: roles, permissions: PERMISSION_CATALOG, matrix: matrix })
}

// ─── roles.upsert — tạo / đổi tên vai trò ──────────────────────────────────────

function actionRolesUpsert(p, u, perms) {
  requirePermission(perms, 'role.create')
  var data = parseJsonParam(p, 'data') || p
  var name = (data.role_name || '').toString().trim()
  if (!name) return jsonError(400, 'Thiếu tên vai trò')

  return withLock(function () {
    var sheet = getSheet('ROLES')
    var rows = sheet.getDataRange().getValues()

    // Sửa tên vai trò có sẵn
    if (data.role_id) {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.ROLES.role_id] === data.role_id) {
          if (rows[i][COL.ROLES.is_system] === true || rows[i][COL.ROLES.is_system] === 'TRUE') {
            return jsonError(400, 'Không thể đổi tên vai trò hệ thống')
          }
          sheet.getRange(i + 1, COL.ROLES.role_name + 1).setValue(name)
          return jsonOk({ role_id: data.role_id, role_name: name })
        }
      }
      return jsonError(404, 'Không tìm thấy vai trò')
    }

    // Tạo vai trò mới
    var roleId = generateId('role')
    appendRow('ROLES', [roleId, name, false, u.user_id])
    // seed ROLE_PERMISSIONS = false cho mọi key (để hiện đủ trong ma trận)
    PERMISSION_CATALOG.forEach(function (perm) {
      appendRow('ROLE_PERMISSIONS', [roleId, perm.key, false])
    })
    return jsonOk({ role_id: roleId, role_name: name })
  })
}

// ─── permissions.update — bật / tắt 1 ô quyền ──────────────────────────────────

function actionPermissionsUpdate(p, u, perms) {
  requirePermission(perms, 'role.manage')
  var roleId = p.role_id
  var key = p.permission_key
  var granted = p.granted === true || p.granted === 'true'
  if (!roleId || !key) return jsonError(400, 'Thiếu role_id hoặc permission_key')

  // Hard-check: role.manage / role.create chỉ Manager (PRD Section 10.1)
  if (MANAGER_ONLY_PERMS.indexOf(key) !== -1 && roleId !== 'manager') {
    return jsonError(403, 'Quyền này chỉ dành cho Manager, không thể cấp cho vai trò khác')
  }

  return withLock(function () {
    var sheet = getSheet('ROLE_PERMISSIONS')
    var rows = sheet.getDataRange().getValues()
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][COL.ROLE_PERMISSIONS.role_id] === roleId && rows[i][COL.ROLE_PERMISSIONS.permission_key] === key) {
        sheet.getRange(i + 1, COL.ROLE_PERMISSIONS.granted + 1).setValue(granted)
        invalidatePermissionsCache(roleId)
        return jsonOk({ role_id: roleId, permission_key: key, granted: granted })
      }
    }
    // chưa có dòng → thêm
    appendRow('ROLE_PERMISSIONS', [roleId, key, granted])
    invalidatePermissionsCache(roleId)
    return jsonOk({ role_id: roleId, permission_key: key, granted: granted })
  })
}

// ─── users.list — nhân sự + roles + locations cho form ─────────────────────────

function actionUsersList(p, u, perms) {
  requirePermission(perms, 'salary.manage_config')

  var roleNames = {}
  getAllRows('ROLES').forEach(function (r) { roleNames[r[COL.ROLES.role_id]] = r[COL.ROLES.role_name] })
  var locNames = locationNameMap()

  var users = getAllRows('USERS').map(function (r) {
    return {
      user_id:             r[COL.USERS.user_id],
      name:                r[COL.USERS.name],
      email:               r[COL.USERS.email],
      role_id:             r[COL.USERS.role_id],
      role_name:           roleNames[r[COL.USERS.role_id]] || r[COL.USERS.role_id],
      location_ids:        parseList(r[COL.USERS.location_ids]),
      location_names:      parseList(r[COL.USERS.location_ids]).map(function (id) { return locNames[id] || id }),
      default_location_id: r[COL.USERS.default_location_id] || null,
      is_active:           r[COL.USERS.is_active] === true || r[COL.USERS.is_active] === 'TRUE',
      base_salary:         Number(r[COL.USERS.base_salary]) || 0,
      concept_rate_type:   r[COL.USERS.concept_rate_type] || '',
      concept_rate_value:  Number(r[COL.USERS.concept_rate_value]) || 0,
      hau_ky_rate_per_file: Number(r[COL.USERS.hau_ky_rate_per_file]) || 0,
    }
  })

  var roles = getAllRows('ROLES').map(function (r) {
    return { role_id: r[COL.ROLES.role_id], role_name: r[COL.ROLES.role_name] }
  })
  var locations = getAllRows('LOCATIONS')
    .filter(function (r) { return r[COL.LOCATIONS.is_active] === true || r[COL.LOCATIONS.is_active] === 'TRUE' })
    .map(function (r) { return { location_id: r[COL.LOCATIONS.location_id], name: r[COL.LOCATIONS.name] } })

  return jsonOk({ users: users, roles: roles, locations: locations })
}

// ─── users.upsert — thêm / sửa nhân sự + cấu hình lương ────────────────────────

function actionUsersUpsert(p, u, perms) {
  requirePermission(perms, 'salary.manage_config')
  var data = parseJsonParam(p, 'data') || p

  var name = (data.name || '').toString().trim()
  var email = (data.email || '').toString().trim().toLowerCase()
  var roleId = (data.role_id || '').toString().trim()
  if (!name) return jsonError(400, 'Thiếu tên nhân sự')
  if (!email || email.indexOf('@') === -1) return jsonError(400, 'Email không hợp lệ')
  if (!roleId) return jsonError(400, 'Phải chọn vai trò')

  var row = [
    '', name, email, roleId,
    serializeList(data.location_ids || []),
    data.default_location_id || '',
    data.is_active === false ? false : true,
    Number(data.base_salary) || 0,
    data.concept_rate_type || '',
    data.concept_rate_value === '' || data.concept_rate_value === undefined ? '' : Number(data.concept_rate_value),
    data.hau_ky_rate_per_file === '' || data.hau_ky_rate_per_file === undefined ? '' : Number(data.hau_ky_rate_per_file),
  ]

  return withLock(function () {
    var sheet = getSheet('USERS')
    var rows = sheet.getDataRange().getValues()

    // Tìm theo user_id (sửa) hoặc email (tránh trùng)
    for (var i = 1; i < rows.length; i++) {
      var sameId = data.user_id && rows[i][COL.USERS.user_id] === data.user_id
      var sameEmail = !data.user_id && String(rows[i][COL.USERS.email]).toLowerCase() === email
      if (sameId || sameEmail) {
        if (!data.user_id && sameEmail) return jsonError(409, 'Email đã tồn tại: ' + email)
        // Khi sửa: nếu đổi email, đảm bảo không trùng người khác
        if (data.user_id) {
          for (var j = 1; j < rows.length; j++) {
            if (j !== i && String(rows[j][COL.USERS.email]).toLowerCase() === email) {
              return jsonError(409, 'Email đã thuộc nhân sự khác: ' + email)
            }
          }
        }
        var oldEmail = String(rows[i][COL.USERS.email]).toLowerCase()
        row[COL.USERS.user_id] = rows[i][COL.USERS.user_id]
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
        cacheDel('usr_' + oldEmail); cacheDel('usr_' + email); cacheDel('uid_' + row[COL.USERS.user_id]); cacheDel('map_users')
        return jsonOk({ user_id: row[COL.USERS.user_id] })
      }
    }

    // Tạo mới
    var userId = generateId('usr')
    row[COL.USERS.user_id] = userId
    appendRow('USERS', row)
    cacheDel('usr_' + email); cacheDel('map_users')
    return jsonOk({ user_id: userId })
  })
}

// ─── locations.upsert — thêm / sửa cơ sở (Manager) ─────────────────────────────

function actionLocationsUpsert(p, u, perms) {
  if (u.role_id !== 'manager') return jsonError(403, 'Chỉ Manager được quản lý cơ sở')
  var data = parseJsonParam(p, 'data') || p
  var name = (data.name || '').toString().trim()
  if (!name) return jsonError(400, 'Thiếu tên cơ sở')

  return withLock(function () {
    var sheet = getSheet('LOCATIONS')
    var rows = sheet.getDataRange().getValues()
    var newRow = [
      data.location_id || '', name, data.address || '', data.phone || '',
      data.is_active === false ? false : true,
    ]
    if (data.location_id) {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.LOCATIONS.location_id] === data.location_id) {
          sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow])
          invalidateBootstrap(); cacheDel('map_locs'); _locationNameMap = null
          return jsonOk({ location_id: data.location_id })
        }
      }
      return jsonError(404, 'Không tìm thấy cơ sở')
    }
    var locId = generateId('loc')
    newRow[COL.LOCATIONS.location_id] = locId
    appendRow('LOCATIONS', newRow)
    invalidateBootstrap(); _locationNameMap = null
    return jsonOk({ location_id: locId })
  })
}
