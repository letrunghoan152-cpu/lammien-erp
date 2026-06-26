/**
 * gas_catalog.gs — Read handlers cho danh mục (cần cho Booking Form Phase 2)
 * Studio LẠM MIÊN
 *
 * services.list, addons.list, addons.listMuaProducts, vouchers.list, locations.list
 * (services.upsert / addons.upsert / vouchers.upsert vẫn là stub Phase 4)
 */

// ─── services.list ────────────────────────────────────────────────────────────

function actionServicesList(p, u, perms) {
  requirePermission(perms, 'service_catalog.view')
  var includeInactive = p.include_inactive === 'true' || p.include_inactive === true
  var canSalary = perms.has('salary.manage_config')

  var services = getAllRows('SERVICE_CATALOG')
    .filter(function (r) {
      var active = r[COL.SERVICE_CATALOG.is_active] === true || r[COL.SERVICE_CATALOG.is_active] === 'TRUE'
      return includeInactive || active
    })
    .map(function (r) {
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

  return jsonOk({ services: services })
}

// ─── addons.list ──────────────────────────────────────────────────────────────

function actionAddonsList(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var canCost = perms.has('addon.view_cost_price')
  var addons = getAllRows('ADDON_CATALOG')
    .filter(function (r) { return r[COL.ADDON_CATALOG.is_active] === true || r[COL.ADDON_CATALOG.is_active] === 'TRUE' })
    .map(function (r) { return addonRowToObj(r, canCost) })
  return jsonOk({ addons: addons })
}

function actionAddonsListMuaProducts(p, u, perms) {
  requirePermission(perms, 'order.add_mua_addon')
  var addons = getAllRows('ADDON_CATALOG')
    .filter(function (r) {
      var active = r[COL.ADDON_CATALOG.is_active] === true || r[COL.ADDON_CATALOG.is_active] === 'TRUE'
      return active && r[COL.ADDON_CATALOG.category] === 'MUA_PRODUCT'
    })
    .map(function (r) { return addonRowToObj(r, perms.has('addon.view_cost_price')) })
  return jsonOk({ addons: addons })
}

function addonRowToObj(r, canCost) {
  var o = {
    addon_id:         r[COL.ADDON_CATALOG.addon_id],
    name:             r[COL.ADDON_CATALOG.name],
    category:         r[COL.ADDON_CATALOG.category],
    sell_price:       Number(r[COL.ADDON_CATALOG.sell_price]) || 0,
    commission_type:  r[COL.ADDON_CATALOG.commission_type] || 'NONE',
    commission_value: Number(r[COL.ADDON_CATALOG.commission_value]) || 0,
    commission_role:  r[COL.ADDON_CATALOG.commission_role] || null,
  }
  if (canCost) o.cost_price = Number(r[COL.ADDON_CATALOG.cost_price]) || 0
  return o
}

// ─── vouchers.list ────────────────────────────────────────────────────────────

function actionVouchersList(p, u, perms) {
  requirePermission(perms, 'voucher.view')
  var today = todayVN()
  var onlyValid = p.only_valid === 'true' || p.only_valid === true
  var vouchers = getAllRows('VOUCHER').map(function (r) {
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
  }).filter(function (v) {
    if (!onlyValid) return true
    if (v.valid_from && today < v.valid_from) return false
    if (v.valid_until && today > v.valid_until) return false
    if (v.max_uses !== null && v.used_count >= v.max_uses) return false
    return true
  })
  return jsonOk({ vouchers: vouchers })
}

// ─── locations.list (bổ sung — cần cho dropdown cơ sở khắp hệ thống) ──────────

function actionLocationsList(p, u, perms) {
  // Mọi user đã xác thực đều được xem danh sách cơ sở (chỉ tên/địa chỉ)
  var includeInactive = p.include_inactive === 'true' || p.include_inactive === true
  var locations = getAllRows('LOCATIONS')
    .filter(function (r) {
      var active = r[COL.LOCATIONS.is_active] === true || r[COL.LOCATIONS.is_active] === 'TRUE'
      return includeInactive || active
    })
    .map(function (r) {
      return {
        location_id: r[COL.LOCATIONS.location_id],
        name:        r[COL.LOCATIONS.name],
        address:     r[COL.LOCATIONS.address] || '',
        phone:       r[COL.LOCATIONS.phone] || '',
        is_active:   r[COL.LOCATIONS.is_active] === true || r[COL.LOCATIONS.is_active] === 'TRUE',
      }
    })
  return jsonOk({ locations: locations })
}
