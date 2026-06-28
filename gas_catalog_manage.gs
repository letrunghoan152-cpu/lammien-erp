/**
 * gas_catalog_manage.gs — Phase 4: Quản lý danh mục
 * Studio LẠM MIÊN
 *
 * catalog.manageList · services.upsert · addons.upsert · vouchers.upsert · vouchers.apply
 * Các stub cùng tên trong gas_Code.gs đã được gỡ. Nhớ invalidateBootstrap() sau khi sửa.
 */

// ─── catalog.manageList — gộp services + addons + vouchers cho trang /catalog ──
// 1 round-trip. Trả đầy đủ field cho người có quyền; strip lương/giá nhập cho người không.

function actionCatalogManageList(p, u, perms) {
  requirePermission(perms, 'service_catalog.view')
  var canSalary  = perms.has('salary.manage_config')
  var canCost    = perms.has('addon.view_cost_price')
  var canSvc     = perms.has('service_catalog.manage')
  var canAddon   = perms.has('addon.manage_all')
  var canAddonMua = perms.has('addon.manage_mua_product')
  var canVoucher = perms.has('voucher.manage')
  var canViewVoucher = perms.has('voucher.view')

  var services = getAllRows('SERVICE_CATALOG').map(function (r) {
    var s = {
      service_id:       r[COL.SERVICE_CATALOG.service_id],
      name:             r[COL.SERVICE_CATALOG.name],
      description:      r[COL.SERVICE_CATALOG.description] || '',
      suggested_price:  Number(r[COL.SERVICE_CATALOG.suggested_price]) || 0,
      duration_minutes: Number(r[COL.SERVICE_CATALOG.duration_minutes]) || 0,
      includes_print:   r[COL.SERVICE_CATALOG.includes_print] === true || r[COL.SERVICE_CATALOG.includes_print] === 'TRUE',
      print_spec:       r[COL.SERVICE_CATALOG.print_spec] || '',
      sample_photo_urls: parseList(r[COL.SERVICE_CATALOG.sample_photo_urls]),
      cover_photo_url:  r[COL.SERVICE_CATALOG.cover_photo_url] || null,
      is_active:        r[COL.SERVICE_CATALOG.is_active] === true || r[COL.SERVICE_CATALOG.is_active] === 'TRUE',
      default_photographer_salary:  Number(r[COL.SERVICE_CATALOG.default_photographer_salary]) || 0,
      default_mua_salary:           Number(r[COL.SERVICE_CATALOG.default_mua_salary]) || 0,
      default_hau_ky_rate_per_file: Number(r[COL.SERVICE_CATALOG.default_hau_ky_rate_per_file]) || 0,
      default_support_salary:       Number(r[COL.SERVICE_CATALOG.default_support_salary]) || 0,
      default_sale_commission_pct:  Number(r[COL.SERVICE_CATALOG.default_sale_commission_pct]) || 0,
    }
    return canSalary ? s : stripSalaryFields(s, perms)
  })

  var addons = getAllRows('ADDON_CATALOG').map(function (r) {
    var o = {
      addon_id:         r[COL.ADDON_CATALOG.addon_id],
      name:             r[COL.ADDON_CATALOG.name],
      category:         r[COL.ADDON_CATALOG.category],
      sell_price:       Number(r[COL.ADDON_CATALOG.sell_price]) || 0,
      commission_type:  r[COL.ADDON_CATALOG.commission_type] || 'NONE',
      commission_value: Number(r[COL.ADDON_CATALOG.commission_value]) || 0,
      commission_role:  r[COL.ADDON_CATALOG.commission_role] || null,
      is_active:        r[COL.ADDON_CATALOG.is_active] === true || r[COL.ADDON_CATALOG.is_active] === 'TRUE',
    }
    if (canCost) o.cost_price = Number(r[COL.ADDON_CATALOG.cost_price]) || 0
    return o
  })

  var vouchers = []
  if (canViewVoucher) {
    vouchers = getAllRows('VOUCHER').map(function (r) {
      return {
        voucher_id:  r[COL.VOUCHER.voucher_id],
        code:        r[COL.VOUCHER.code],
        type:        r[COL.VOUCHER.type],
        value:       Number(r[COL.VOUCHER.value]) || 0,
        valid_from:  fmtCell(r[COL.VOUCHER.valid_from]).slice(0, 10),
        valid_until: fmtCell(r[COL.VOUCHER.valid_until]).slice(0, 10),
        max_uses:    r[COL.VOUCHER.max_uses] === '' ? null : Number(r[COL.VOUCHER.max_uses]),
        used_count:  Number(r[COL.VOUCHER.used_count]) || 0,
      }
    })
  }

  return jsonOk({
    services: services,
    addons: addons,
    vouchers: vouchers,
    can: {
      services: canSvc,
      addons: canAddon,
      addon_mua: canAddonMua,
      vouchers: canVoucher,
      cost: canCost,
      salary: canSalary,
    },
  })
}

// ─── services.upsert ──────────────────────────────────────────────────────────

function actionServicesUpsert(p, u, perms) {
  requirePermission(perms, 'service_catalog.manage')
  var d = parseJsonParam(p, 'data') || p
  var name = (d.name || '').toString().trim()
  if (!name) return jsonError(400, 'Thiếu tên dịch vụ')

  return withLock(function () {
    var sheet = getSheet('SERVICE_CATALOG')
    var rows = sheet.getDataRange().getValues()
    var row = [
      d.service_id || '',
      name,
      d.description || '',
      Number(d.suggested_price) || 0,
      Number(d.duration_minutes) || 0,
      d.includes_print === true || d.includes_print === 'true' || d.includes_print === '1',
      d.print_spec || '',
      serializeList(d.sample_photo_urls || []),
      d.cover_photo_url || '',
      Number(d.default_photographer_salary) || 0,
      Number(d.default_mua_salary) || 0,
      Number(d.default_hau_ky_rate_per_file) || 0,
      Number(d.default_support_salary) || 0,
      Number(d.default_sale_commission_pct) || 0,
      d.is_active === false || d.is_active === '0' || d.is_active === 'false' ? false : true,
    ]

    if (d.service_id) {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.SERVICE_CATALOG.service_id] === d.service_id) {
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
          invalidateBootstrap(); _serviceMap = null
          return jsonOk({ service_id: d.service_id })
        }
      }
      return jsonError(404, 'Không tìm thấy dịch vụ')
    }

    var id = generateId('svc')
    row[COL.SERVICE_CATALOG.service_id] = id
    appendRow('SERVICE_CATALOG', row)
    invalidateBootstrap(); _serviceMap = null
    return jsonOk({ service_id: id })
  })
}

// ─── addons.upsert ────────────────────────────────────────────────────────────
// addon.manage_all = mọi add-on. addon.manage_mua_product = chỉ loại MUA_PRODUCT.

function actionAddonsUpsert(p, u, perms) {
  var d = parseJsonParam(p, 'data') || p
  var category = (d.category || '').toString().trim()
  if (!perms.has('addon.manage_all')) {
    requirePermission(perms, 'addon.manage_mua_product')
    if (category !== 'MUA_PRODUCT') return jsonError(403, 'Bạn chỉ được quản lý add-on loại MUA Product')
  }
  var name = (d.name || '').toString().trim()
  if (!name) return jsonError(400, 'Thiếu tên add-on')
  if (!category) return jsonError(400, 'Thiếu loại add-on')

  return withLock(function () {
    var sheet = getSheet('ADDON_CATALOG')
    var rows = sheet.getDataRange().getValues()
    var row = [
      d.addon_id || '',
      name,
      category,
      Number(d.cost_price) || 0,
      Number(d.sell_price) || 0,
      d.commission_type || 'NONE',
      Number(d.commission_value) || 0,
      d.commission_role || '',
      d.is_active === false || d.is_active === '0' || d.is_active === 'false' ? false : true,
    ]

    if (d.addon_id) {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.ADDON_CATALOG.addon_id] === d.addon_id) {
          // Khi sửa: nếu không có quyền manage_all, không cho đổi sang loại khác MUA_PRODUCT
          if (!perms.has('addon.manage_all') && rows[i][COL.ADDON_CATALOG.category] !== 'MUA_PRODUCT') {
            return jsonError(403, 'Bạn chỉ được sửa add-on loại MUA Product')
          }
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
          invalidateBootstrap()
          return jsonOk({ addon_id: d.addon_id })
        }
      }
      return jsonError(404, 'Không tìm thấy add-on')
    }

    var id = generateId('adn')
    row[COL.ADDON_CATALOG.addon_id] = id
    appendRow('ADDON_CATALOG', row)
    invalidateBootstrap()
    return jsonOk({ addon_id: id })
  })
}

// ─── vouchers.upsert ──────────────────────────────────────────────────────────

function actionVouchersUpsert(p, u, perms) {
  requirePermission(perms, 'voucher.manage')
  var d = parseJsonParam(p, 'data') || p
  var code = (d.code || '').toString().trim().toUpperCase()
  var type = (d.type || '').toString().trim()
  if (!code) return jsonError(400, 'Thiếu mã voucher')
  if (type !== 'PERCENT' && type !== 'FIXED_AMOUNT') return jsonError(400, 'Loại voucher không hợp lệ')
  var value = Number(d.value) || 0
  if (value <= 0) return jsonError(400, 'Giá trị voucher phải > 0')
  if (type === 'PERCENT' && value > 100) return jsonError(400, '% giảm không được vượt 100')

  return withLock(function () {
    var sheet = getSheet('VOUCHER')
    var rows = sheet.getDataRange().getValues()

    // Mã voucher phải duy nhất
    for (var k = 1; k < rows.length; k++) {
      if (String(rows[k][COL.VOUCHER.code]).toUpperCase() === code &&
          rows[k][COL.VOUCHER.voucher_id] !== d.voucher_id) {
        return jsonError(409, 'Mã voucher đã tồn tại: ' + code)
      }
    }

    var maxUses = (d.max_uses === '' || d.max_uses === null || d.max_uses === undefined) ? '' : Number(d.max_uses)

    if (d.voucher_id) {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][COL.VOUCHER.voucher_id] === d.voucher_id) {
          var row = [
            d.voucher_id, code, type, value,
            d.valid_from || '', d.valid_until || '', maxUses,
            Number(rows[i][COL.VOUCHER.used_count]) || 0,  // giữ nguyên used_count khi sửa
            rows[i][COL.VOUCHER.created_by] || u.user_id,
          ]
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
          invalidateBootstrap()
          return jsonOk({ voucher_id: d.voucher_id })
        }
      }
      return jsonError(404, 'Không tìm thấy voucher')
    }

    var id = generateId('vch')
    appendRow('VOUCHER', [id, code, type, value, d.valid_from || '', d.valid_until || '', maxUses, 0, u.user_id])
    invalidateBootstrap()
    return jsonOk({ voucher_id: id })
  })
}

// ─── vouchers.apply — kiểm tra hợp lệ + tính giảm giá (báo giá) ────────────────
// Mặc định CHỈ kiểm tra + tính tiền giảm (không tăng used_count) — dùng cho booking
// form xem trước. Nếu gửi commit=true thì tăng used_count trong LockService (chốt dùng).

function actionVouchersApply(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var code = (p.code || '').toString().trim().toUpperCase()
  var voucherId = (p.voucher_id || '').toString().trim()
  var base = Number(p.base) || 0
  var commit = p.commit === true || p.commit === 'true'
  if (!code && !voucherId) return jsonError(400, 'Thiếu mã voucher')

  var today = todayVN()

  function findRow(rows) {
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i]
      if ((voucherId && r[COL.VOUCHER.voucher_id] === voucherId) ||
          (!voucherId && String(r[COL.VOUCHER.code]).toUpperCase() === code)) {
        return { idx: i, row: r }
      }
    }
    return null
  }

  function validate(r) {
    var vfrom = fmtCell(r[COL.VOUCHER.valid_from]).slice(0, 10)
    var vuntil = fmtCell(r[COL.VOUCHER.valid_until]).slice(0, 10)
    if (vfrom && today < vfrom) return 'Voucher chưa đến ngày áp dụng'
    if (vuntil && today > vuntil) return 'Voucher đã hết hạn'
    var maxUses = r[COL.VOUCHER.max_uses]
    var used = Number(r[COL.VOUCHER.used_count]) || 0
    if (maxUses !== '' && maxUses !== null && used >= Number(maxUses)) return 'Voucher đã hết lượt sử dụng'
    return null
  }

  function discountOf(r) {
    var type = r[COL.VOUCHER.type]
    var val = Number(r[COL.VOUCHER.value]) || 0
    if (type === 'PERCENT') return Math.round(base * val / 100)
    return Math.min(val, base) // FIXED_AMOUNT
  }

  if (!commit) {
    var rows = getAllRows('VOUCHER')
    // getAllRows bỏ header → bù index +1 để khớp tìm kiếm
    var found = null
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      if ((voucherId && r[COL.VOUCHER.voucher_id] === voucherId) ||
          (!voucherId && String(r[COL.VOUCHER.code]).toUpperCase() === code)) { found = r; break }
    }
    if (!found) return jsonError(404, 'Không tìm thấy voucher: ' + (code || voucherId))
    var err = validate(found)
    if (err) return jsonError(400, err)
    return jsonOk({
      voucher_id: found[COL.VOUCHER.voucher_id],
      code: found[COL.VOUCHER.code],
      type: found[COL.VOUCHER.type],
      value: Number(found[COL.VOUCHER.value]) || 0,
      discount_amount: discountOf(found),
    })
  }

  // commit = true → tăng used_count an toàn
  return withLock(function () {
    var sheet = getSheet('VOUCHER')
    var rows = sheet.getDataRange().getValues()
    var hit = findRow(rows)
    if (!hit) return jsonError(404, 'Không tìm thấy voucher')
    var err = validate(hit.row)
    if (err) return jsonError(400, err)
    var newUsed = (Number(hit.row[COL.VOUCHER.used_count]) || 0) + 1
    sheet.getRange(hit.idx + 1, COL.VOUCHER.used_count + 1).setValue(newUsed)
    invalidateBootstrap()
    return jsonOk({
      voucher_id: hit.row[COL.VOUCHER.voucher_id],
      code: hit.row[COL.VOUCHER.code],
      type: hit.row[COL.VOUCHER.type],
      value: Number(hit.row[COL.VOUCHER.value]) || 0,
      discount_amount: discountOf(hit.row),
      used_count: newUsed,
    })
  })
}
