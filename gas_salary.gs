/**
 * gas_salary.gs — Phase 5: Lương + Thưởng/Phạt
 * Studio LẠM MIÊN — nguồn: PRD Section 9
 *
 * salary.list (tính live theo kỳ) · salary.compute (chốt/snapshot vào SALARY) ·
 * bonus_penalty.list · bonus_penalty.upsert
 *
 * Quy ước (PRD 9.1):
 *   - Chỉ tính đơn ở trạng thái "ĐÃ CHỤP+" (STATUS_ORDER_INDEX >= 4), bỏ HUY.
 *   - Kỳ lương = tháng của shoot_date (YYYY-MM).
 *   - Concept: photographer/mua/support/sale theo hệ số (concept 1 = 1.0, concept 2+ = 0.5).
 *   - Hậu kỳ: rate/file × tổng file (HAU_KY_TASK.photo_count, task DONE) — KHÔNG áp hệ số.
 *     Nguồn nhận lương = CONCEPT.assigned_hau_ky_id (không phải HAU_KY_TASK.assigned_editor).
 *   - Add-on: dùng ORDER_ADDON.commission_amount đã tính sẵn, gán theo ADDON_CATALOG.commission_role.
 *   - Bonus/Penalty: BONUS_PENALTY theo tháng của date.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodOf(v) {
  return fmtCell(v).slice(0, 7) // 'YYYY-MM'
}

function isSalaryCountedStatus(status) {
  if (status === 'HUY') return false
  var idx = STATUS_ORDER_INDEX[status]
  return idx !== undefined && idx >= 4 && idx < 99
}

// Lương 1 concept assignment cho 1 vai trò (photographer/mua/support/sale).
function conceptEarning(user, roleKey, conceptIndex, customPrice, svc) {
  var factor = Number(conceptIndex) >= 2 ? 0.5 : 1.0
  var rateType, rateValue

  // Override per-person nếu nhân sự có cấu hình lương concept riêng
  if (user && user.concept_rate_value && user.concept_rate_type) {
    rateType = user.concept_rate_type
    rateValue = Number(user.concept_rate_value) || 0
  } else if (roleKey === 'sale') {
    // Sale không có default_sale_salary → dùng % hoa hồng trên giá concept
    rateType = 'PERCENT'
    rateValue = svc ? (Number(svc.default_sale_commission_pct) || 0) : 0
  } else {
    rateType = 'FIXED'
    rateValue = svc ? (Number(svc['default_' + roleKey + '_salary']) || 0) : 0
  }

  var earn = (rateType === 'PERCENT')
    ? (Number(customPrice) || 0) * rateValue / 100 * factor
    : rateValue * factor
  return Math.round(earn)
}

// ─── Core: tính lương toàn bộ nhân sự cho 1 kỳ ─────────────────────────────────

function computeSalaryForPeriod(period) {
  // Build lookup maps
  var usersById = {}
  getAllRows('USERS').forEach(function (r) {
    usersById[r[COL.USERS.user_id]] = {
      user_id:              r[COL.USERS.user_id],
      name:                 r[COL.USERS.name],
      role_id:              r[COL.USERS.role_id],
      is_active:            r[COL.USERS.is_active] === true || r[COL.USERS.is_active] === 'TRUE',
      base_salary:          Number(r[COL.USERS.base_salary]) || 0,
      concept_rate_type:    r[COL.USERS.concept_rate_type] || '',
      concept_rate_value:   Number(r[COL.USERS.concept_rate_value]) || 0,
      hau_ky_rate_per_file: Number(r[COL.USERS.hau_ky_rate_per_file]) || 0,
    }
  })

  var svcById = {}
  getAllRows('SERVICE_CATALOG').forEach(function (r) {
    svcById[r[COL.SERVICE_CATALOG.service_id]] = {
      name:                         r[COL.SERVICE_CATALOG.name],
      default_photographer_salary:  Number(r[COL.SERVICE_CATALOG.default_photographer_salary]) || 0,
      default_mua_salary:           Number(r[COL.SERVICE_CATALOG.default_mua_salary]) || 0,
      default_support_salary:       Number(r[COL.SERVICE_CATALOG.default_support_salary]) || 0,
      default_sale_commission_pct:  Number(r[COL.SERVICE_CATALOG.default_sale_commission_pct]) || 0,
      default_hau_ky_rate_per_file: Number(r[COL.SERVICE_CATALOG.default_hau_ky_rate_per_file]) || 0,
    }
  })

  var addonRoleById = {}
  getAllRows('ADDON_CATALOG').forEach(function (r) {
    addonRoleById[r[COL.ADDON_CATALOG.addon_id]] = (r[COL.ADDON_CATALOG.commission_role] || '').toString().toUpperCase()
  })

  // Đơn đủ điều kiện trong kỳ
  var orders = {} // order_id -> { sale_staff_id }
  getAllRows('ORDER').forEach(function (r) {
    if (!isSalaryCountedStatus(r[COL.ORDER.status])) return
    if (periodOf(r[COL.ORDER.shoot_date]) !== period) return
    orders[r[COL.ORDER.order_id]] = { sale_staff_id: r[COL.ORDER.sale_staff_id] }
  })

  // Concepts theo đơn
  var conceptsByOrder = {}
  getAllRows('CONCEPT').forEach(function (r) {
    var oid = r[COL.CONCEPT.order_id]
    if (!orders[oid]) return
    if (!conceptsByOrder[oid]) conceptsByOrder[oid] = []
    conceptsByOrder[oid].push({
      concept_index:            Number(r[COL.CONCEPT.concept_index]) || 1,
      service_id:               r[COL.CONCEPT.service_id],
      custom_price:             Number(r[COL.CONCEPT.custom_price]) || 0,
      assigned_photographer_id: r[COL.CONCEPT.assigned_photographer_id] || '',
      assigned_mua_id:          r[COL.CONCEPT.assigned_mua_id] || '',
      assigned_hau_ky_id:       r[COL.CONCEPT.assigned_hau_ky_id] || '',
      assigned_support_id:      r[COL.CONCEPT.assigned_support_id] || '',
    })
  })

  // Accumulator — init cho MỌI nhân sự active (để ai cũng hiện base + thưởng/phạt)
  var acc = {}
  function ensure(staffId) {
    if (!staffId) return null
    if (!acc[staffId]) {
      var us = usersById[staffId]
      if (!us) return null
      acc[staffId] = {
        staff_id: staffId, name: us.name, role_id: us.role_id,
        base_salary: us.base_salary, concept_total: 0, hk_file_total: 0,
        addon_total: 0, bonus_total: 0, penalty_total: 0, lines: [],
      }
    }
    return acc[staffId]
  }
  Object.keys(usersById).forEach(function (id) { if (usersById[id].is_active) ensure(id) })

  function addLine(staffId, kind, label, amount) {
    var a = ensure(staffId)
    if (!a || !amount) return
    if (kind === 'concept') a.concept_total += amount
    else if (kind === 'hauky') a.hk_file_total += amount
    else if (kind === 'addon') a.addon_total += amount
    a.lines.push({ kind: kind, label: label, amount: amount })
  }

  // [A] Lương concept (photographer/mua/support/sale)
  Object.keys(conceptsByOrder).forEach(function (oid) {
    var saleId = orders[oid].sale_staff_id
    conceptsByOrder[oid].forEach(function (c) {
      var svc = svcById[c.service_id]
      var svcName = svc ? svc.name : c.service_id
      var roleAssign = [
        { role: 'photographer', id: c.assigned_photographer_id },
        { role: 'mua',          id: c.assigned_mua_id },
        { role: 'support',      id: c.assigned_support_id },
      ]
      roleAssign.forEach(function (ra) {
        if (!ra.id || !usersById[ra.id]) return
        var earn = conceptEarning(usersById[ra.id], ra.role, c.concept_index, c.custom_price, svc)
        addLine(ra.id, 'concept', ROLE_VI(ra.role) + ' • ' + svcName + ' (concept ' + c.concept_index + ', đơn ' + oid + ')', earn)
      })
      // Sale hoa hồng concept (order-level)
      if (saleId && usersById[saleId]) {
        var saleEarn = conceptEarning(usersById[saleId], 'sale', c.concept_index, c.custom_price, svc)
        addLine(saleId, 'concept', 'Sale • ' + svcName + ' (concept ' + c.concept_index + ', đơn ' + oid + ')', saleEarn)
      }
    })
  })

  // [Hậu kỳ] rate/file × tổng file (task DONE) → CONCEPT.assigned_hau_ky_id của concept 1
  getAllRows('HAU_KY_TASK').forEach(function (r) {
    if (r[COL.HAU_KY_TASK.status] !== 'DONE') return
    var oid = r[COL.HAU_KY_TASK.order_id]
    if (!orders[oid] || !conceptsByOrder[oid]) return
    var concept1 = conceptsByOrder[oid].filter(function (c) { return c.concept_index === 1 })[0] || conceptsByOrder[oid][0]
    if (!concept1) return
    var editorId = concept1.assigned_hau_ky_id
    if (!editorId || !usersById[editorId]) return
    var svc = svcById[concept1.service_id]
    var rate = usersById[editorId].hau_ky_rate_per_file || (svc ? svc.default_hau_ky_rate_per_file : 0)
    var files = Number(r[COL.HAU_KY_TASK.photo_count]) || 0
    var earn = Math.round(rate * files)
    addLine(editorId, 'hauky', 'Hậu kỳ • ' + files + ' file × ' + rate + 'đ (đơn ' + oid + ')', earn)
  })

  // [B] Hoa hồng add-on (theo commission_role: SALE → sale_staff_id, MUA → mua concept 1)
  getAllRows('ORDER_ADDON').forEach(function (r) {
    var oid = r[COL.ORDER_ADDON.order_id]
    if (!orders[oid]) return
    var comm = Number(r[COL.ORDER_ADDON.commission_amount]) || 0
    if (!comm) return
    var role = addonRoleById[r[COL.ORDER_ADDON.addon_catalog_id]] || ''
    var staffId = ''
    if (role === 'SALE') staffId = orders[oid].sale_staff_id
    else if (role === 'MUA') {
      var c1 = (conceptsByOrder[oid] || []).filter(function (c) { return c.concept_index === 1 })[0] || (conceptsByOrder[oid] || [])[0]
      staffId = c1 ? c1.assigned_mua_id : ''
    }
    if (staffId && usersById[staffId]) addLine(staffId, 'addon', 'Hoa hồng add-on (đơn ' + oid + ')', comm)
  })

  // [C][D] Thưởng / Phạt theo tháng của date
  getAllRows('BONUS_PENALTY').forEach(function (r) {
    if (periodOf(r[COL.BONUS_PENALTY.date]) !== period) return
    var staffId = r[COL.BONUS_PENALTY.staff_id]
    var a = ensure(staffId)
    if (!a) return
    var amount = Number(r[COL.BONUS_PENALTY.amount]) || 0
    var type = r[COL.BONUS_PENALTY.type]
    var note = r[COL.BONUS_PENALTY.note] || ''
    if (type === 'PENALTY') {
      a.penalty_total += amount
      a.lines.push({ kind: 'penalty', label: 'Phạt: ' + note, amount: -amount })
    } else {
      a.bonus_total += amount
      a.lines.push({ kind: 'bonus', label: 'Thưởng: ' + note, amount: amount })
    }
  })

  // Tổng + sắp xếp
  var out = Object.keys(acc).map(function (id) {
    var a = acc[id]
    a.gross_total = a.base_salary + a.concept_total + a.hk_file_total + a.addon_total + a.bonus_total - a.penalty_total
    return a
  })
  out.sort(function (x, y) { return (x.name || '').localeCompare(y.name || '') })
  return out
}

function ROLE_VI(roleKey) {
  return { photographer: 'Photographer', mua: 'MUA', support: 'Support', sale: 'Sale', hau_ky: 'Hậu kỳ' }[roleKey] || roleKey
}

// ─── salary.list — bảng lương kỳ (tính live, không ghi) ────────────────────────

function actionSalaryList(p, u, perms) {
  var canAll = perms.has('salary.view_all')
  if (!canAll) requirePermission(perms, 'salary.view_own')
  var period = (p.period || todayVN().slice(0, 7)).toString().slice(0, 7)

  var all = computeSalaryForPeriod(period)
  var rows = canAll ? all : all.filter(function (r) { return r.staff_id === u.user_id })

  // Map period đã chốt (lock) để UI biết
  var locked = {}
  getAllRows('SALARY').forEach(function (r) {
    if (r[COL.SALARY.period] === period && (r[COL.SALARY.is_locked] === true || r[COL.SALARY.is_locked] === 'TRUE')) {
      locked[r[COL.SALARY.staff_id]] = true
    }
  })
  rows.forEach(function (r) { r.is_locked = !!locked[r.staff_id] })

  return jsonOk({
    period: period,
    salary: rows,
    can_manage: perms.has('salary.manage_config'),
    can_bonus: perms.has('bonus_penalty.manage'),
    can_view_all: canAll,
  })
}

// ─── salary.compute — chốt lương kỳ (snapshot vào SALARY, đặt is_locked) ────────

function actionSalaryCompute(p, u, perms) {
  requirePermission(perms, 'salary.manage_config')
  var period = (p.period || '').toString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(period)) return jsonError(400, 'Kỳ lương không hợp lệ (YYYY-MM)')
  var lock = p.lock === true || p.lock === 'true'

  return withLock(function () {
    var rows = computeSalaryForPeriod(period)
    var sheet = getSheet('SALARY')
    var existing = sheet.getDataRange().getValues()

    rows.forEach(function (r) {
      var foundRow = -1
      for (var i = 1; i < existing.length; i++) {
        if (existing[i][COL.SALARY.staff_id] === r.staff_id && existing[i][COL.SALARY.period] === period) {
          foundRow = i + 1; break
        }
      }
      // Không ghi đè kỳ đã khoá
      if (foundRow > 0 && (existing[foundRow - 1][COL.SALARY.is_locked] === true || existing[foundRow - 1][COL.SALARY.is_locked] === 'TRUE')) return

      var rowArr = [
        foundRow > 0 ? existing[foundRow - 1][COL.SALARY.salary_id] : generateId('sal'),
        r.staff_id, period, r.base_salary, r.concept_total, r.hk_file_total,
        r.addon_total, r.bonus_total, r.penalty_total, r.gross_total,
        lock, lock ? nowVN() : '', lock ? u.user_id : '',
      ]
      if (foundRow > 0) sheet.getRange(foundRow, 1, 1, rowArr.length).setValues([rowArr])
      else sheet.appendRow(rowArr)
    })

    return jsonOk({ period: period, count: rows.length, locked: lock, salary: rows })
  })
}

// ─── bonus_penalty.list ────────────────────────────────────────────────────────

function actionBonusPenaltyList(p, u, perms) {
  requirePermission(perms, 'bonus_penalty.manage')
  var period = (p.period || '').toString().slice(0, 7)

  var names = {}
  var staff = []
  getAllRows('USERS').forEach(function (r) {
    names[r[COL.USERS.user_id]] = r[COL.USERS.name]
    if (r[COL.USERS.is_active] === true || r[COL.USERS.is_active] === 'TRUE') {
      staff.push({ user_id: r[COL.USERS.user_id], name: r[COL.USERS.name] })
    }
  })

  var items = getAllRows('BONUS_PENALTY')
    .map(function (r) {
      return {
        bp_id:      r[COL.BONUS_PENALTY.bp_id],
        staff_id:   r[COL.BONUS_PENALTY.staff_id],
        staff_name: names[r[COL.BONUS_PENALTY.staff_id]] || r[COL.BONUS_PENALTY.staff_id],
        type:       r[COL.BONUS_PENALTY.type],
        amount:     Number(r[COL.BONUS_PENALTY.amount]) || 0,
        note:       r[COL.BONUS_PENALTY.note] || '',
        date:       fmtCell(r[COL.BONUS_PENALTY.date]).slice(0, 10),
        order_id:   r[COL.BONUS_PENALTY.order_id] || '',
      }
    })
    .filter(function (it) { return !period || it.date.slice(0, 7) === period })
    .sort(function (a, b) { return b.date > a.date ? 1 : -1 })

  return jsonOk({ items: items, staff: staff })
}

// ─── bonus_penalty.upsert (thêm/sửa/xoá — chỉ Manager) ─────────────────────────

function actionBonusPenaltyUpsert(p, u, perms) {
  requirePermission(perms, 'bonus_penalty.manage')
  var d = parseJsonParam(p, 'data') || p

  // Xoá
  if (d.bp_id && (d._delete === true || d._delete === 'true')) {
    return withLock(function () {
      var sheet = getSheet('BONUS_PENALTY')
      var rows = sheet.getDataRange().getValues()
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.BONUS_PENALTY.bp_id] === d.bp_id) {
          sheet.deleteRow(i + 1)
          return jsonOk({ deleted: d.bp_id })
        }
      }
      return jsonError(404, 'Không tìm thấy bản ghi')
    })
  }

  var staffId = (d.staff_id || '').toString().trim()
  var type = (d.type || '').toString().trim().toUpperCase()
  var amount = Number(d.amount) || 0
  if (!staffId) return jsonError(400, 'Phải chọn nhân sự')
  if (type !== 'BONUS' && type !== 'PENALTY') return jsonError(400, 'Loại phải là BONUS hoặc PENALTY')
  if (amount <= 0) return jsonError(400, 'Số tiền phải > 0')
  if (!getUserById(staffId)) return jsonError(404, 'Nhân sự không tồn tại')

  var date = (d.date || todayVN()).toString().slice(0, 10)

  return withLock(function () {
    var sheet = getSheet('BONUS_PENALTY')
    var rows = sheet.getDataRange().getValues()
    var row = [d.bp_id || '', staffId, type, amount, d.note || '', date, d.order_id || '', u.user_id]

    if (d.bp_id) {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.BONUS_PENALTY.bp_id] === d.bp_id) {
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
          return jsonOk({ bp_id: d.bp_id })
        }
      }
      return jsonError(404, 'Không tìm thấy bản ghi')
    }

    var id = generateId('bp')
    row[COL.BONUS_PENALTY.bp_id] = id
    appendRow('BONUS_PENALTY', row)
    return jsonOk({ bp_id: id })
  })
}
