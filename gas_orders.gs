/**
 * gas_orders.gs — Handlers cho Orders (Phase 2)
 * Studio LẠM MIÊN
 *
 * Implement đầy đủ:
 *   orders.list, orders.get, orders.create, orders.update,
 *   orders.updateStatus, orders.updateStatusHK, orders.overrideDeliveryType,
 *   orders.uploadRawLink, orders.addMuaAddon, orders.history
 *
 * Các stub cùng tên trong gas_Code.gs đã được gỡ bỏ.
 */

// ─── Row ↔ Object mappers ─────────────────────────────────────────────────────

function rowToOrder(row) {
  return {
    order_id:         row[COL.ORDER.order_id],
    version:          Number(row[COL.ORDER.version]) || 1,
    customer_id:      row[COL.ORDER.customer_id],
    customer_name:    row[COL.ORDER.customer_name],
    customer_phone:   row[COL.ORDER.customer_phone],
    location_id:      row[COL.ORDER.location_id],
    sale_staff_id:    row[COL.ORDER.sale_staff_id],
    sale_channel:     row[COL.ORDER.sale_channel],
    shoot_date:       fmtCell(row[COL.ORDER.shoot_date]),
    arrival_time:     fmtTimeCell(row[COL.ORDER.arrival_time]),
    makeup_start:     fmtTimeCell(row[COL.ORDER.makeup_start]),
    makeup_duration:  Number(row[COL.ORDER.makeup_duration]) || 0,
    shoot_start:      fmtTimeCell(row[COL.ORDER.shoot_start]),
    shoot_duration:   Number(row[COL.ORDER.shoot_duration]) || 0,
    estimated_end:    fmtTimeCell(row[COL.ORDER.estimated_end]),
    status:           row[COL.ORDER.status],
    delivery_type:    row[COL.ORDER.delivery_type] || null,
    order_voucher_id: row[COL.ORDER.order_voucher_id] || null,
    raw_link:         row[COL.ORDER.raw_link] || null,
    total_price:      Number(row[COL.ORDER.total_price]) || 0,
    deposit_amount:   Number(row[COL.ORDER.deposit_amount]) || 0,
    remaining_amount: Number(row[COL.ORDER.remaining_amount]) || 0,
    payment_status:   row[COL.ORDER.payment_status] || 'CHUA_COC',
    cancel_reason:    row[COL.ORDER.cancel_reason] || null,
    notes:            row[COL.ORDER.notes] || '',
    created_at:       fmtCell(row[COL.ORDER.created_at]),
    updated_at:       fmtCell(row[COL.ORDER.updated_at]),
  }
}

function rowToConcept(row) {
  return {
    concept_id:               row[COL.CONCEPT.concept_id],
    order_id:                 row[COL.CONCEPT.order_id],
    concept_index:            Number(row[COL.CONCEPT.concept_index]) || 1,
    service_id:               row[COL.CONCEPT.service_id],
    custom_price:             Number(row[COL.CONCEPT.custom_price]) || 0,
    voucher_id:               row[COL.CONCEPT.voucher_id] || null,
    assigned_photographer_id: row[COL.CONCEPT.assigned_photographer_id] || null,
    assigned_mua_id:          row[COL.CONCEPT.assigned_mua_id] || null,
    assigned_hau_ky_id:       row[COL.CONCEPT.assigned_hau_ky_id] || null,
    assigned_support_id:      row[COL.CONCEPT.assigned_support_id] || null,
    reference_photo_urls:     parseList(row[COL.CONCEPT.reference_photo_urls]),
    notes:                    row[COL.CONCEPT.notes] || '',
  }
}

function rowToOrderAddon(row) {
  return {
    order_addon_id:    row[COL.ORDER_ADDON.order_addon_id],
    order_id:          row[COL.ORDER_ADDON.order_id],
    addon_catalog_id:  row[COL.ORDER_ADDON.addon_catalog_id],
    quantity:          Number(row[COL.ORDER_ADDON.quantity]) || 1,
    catalog_price:     Number(row[COL.ORDER_ADDON.catalog_price]) || 0,
    actual_price:      Number(row[COL.ORDER_ADDON.actual_price]) || 0,
    commission_amount: Number(row[COL.ORDER_ADDON.commission_amount]) || 0,
  }
}

// Chuẩn hóa cell ngày/giờ về string (Sheets có thể trả Date object)
function fmtCell(v) {
  if (v === '' || v === null || v === undefined) return ''
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss")
  }
  return String(v)
}
function fmtTimeCell(v) {
  if (v === '' || v === null || v === undefined) return ''
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'HH:mm')
  }
  return String(v)
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

function findOrderRowById(orderId) {
  var sheet = getSheet('ORDER')
  var rows = sheet.getDataRange().getValues()
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][COL.ORDER.order_id] === orderId) {
      return { sheet: sheet, rowIndex: i + 1, row: rows[i] }
    }
  }
  return null
}

function getConceptsByOrder(orderId) {
  return getAllRows('CONCEPT')
    .filter(function (r) { return r[COL.CONCEPT.order_id] === orderId })
    .map(rowToConcept)
    .sort(function (a, b) { return a.concept_index - b.concept_index })
}

function getAddonsByOrder(orderId) {
  return getAllRows('ORDER_ADDON')
    .filter(function (r) { return r[COL.ORDER_ADDON.order_id] === orderId })
    .map(rowToOrderAddon)
}

// Map user_id → name (cache nhẹ trong 1 request)
var _userNameMap = null
function userNameMap() {
  if (_userNameMap) return _userNameMap
  _userNameMap = {}
  getAllRows('USERS').forEach(function (r) {
    _userNameMap[r[COL.USERS.user_id]] = r[COL.USERS.name]
  })
  return _userNameMap
}

var _locationNameMap = null
function locationNameMap() {
  if (_locationNameMap) return _locationNameMap
  _locationNameMap = {}
  getAllRows('LOCATIONS').forEach(function (r) {
    _locationNameMap[r[COL.LOCATIONS.location_id]] = r[COL.LOCATIONS.name]
  })
  return _locationNameMap
}

var _serviceMap = null
function serviceMap() {
  if (_serviceMap) return _serviceMap
  _serviceMap = {}
  getAllRows('SERVICE_CATALOG').forEach(function (r) {
    _serviceMap[r[COL.SERVICE_CATALOG.service_id]] = {
      service_id:       r[COL.SERVICE_CATALOG.service_id],
      name:             r[COL.SERVICE_CATALOG.name],
      description:      r[COL.SERVICE_CATALOG.description],
      duration_minutes: Number(r[COL.SERVICE_CATALOG.duration_minutes]) || 0,
      includes_print:   r[COL.SERVICE_CATALOG.includes_print] === true || r[COL.SERVICE_CATALOG.includes_print] === 'TRUE',
      cover_photo_url:  r[COL.SERVICE_CATALOG.cover_photo_url] || null,
      sample_photo_urls: parseList(r[COL.SERVICE_CATALOG.sample_photo_urls]),
    }
  })
  return _serviceMap
}

var _customerAvatarMap = null
function customerAvatarMap() {
  if (_customerAvatarMap) return _customerAvatarMap
  _customerAvatarMap = {}
  getAllRows('CUSTOMERS').forEach(function (r) {
    _customerAvatarMap[r[COL.CUSTOMERS.customer_id]] = r[COL.CUSTOMERS.avatar_url] || null
  })
  return _customerAvatarMap
}

// ─── "own" filtering ──────────────────────────────────────────────────────────

// Trả về Set<order_id> mà user được assign (qua CONCEPT) hoặc là Sale phụ trách
function getOwnOrderIds(userId, roleId) {
  var ids = new Set()
  if (roleId === 'sale') {
    getAllRows('ORDER').forEach(function (r) {
      if (r[COL.ORDER.sale_staff_id] === userId) ids.add(r[COL.ORDER.order_id])
    })
    return ids
  }
  var col = {
    photographer: COL.CONCEPT.assigned_photographer_id,
    mua:          COL.CONCEPT.assigned_mua_id,
    hau_ky:       COL.CONCEPT.assigned_hau_ky_id,
    support:      COL.CONCEPT.assigned_support_id,
  }[roleId]
  if (col !== undefined) {
    getAllRows('CONCEPT').forEach(function (r) {
      if (r[col] === userId) ids.add(r[COL.CONCEPT.order_id])
    })
  }
  // Support + manager cũng có thể view_all (xử lý ở caller)
  return ids
}

// ─── orders.list ──────────────────────────────────────────────────────────────

function actionOrdersList(p, u, perms) {
  var viewAll = perms.has('order.view_all')
  var viewOwn = perms.has('order.view_own')
  if (!viewAll && !viewOwn) throw { status: 403, message: 'Không có quyền xem đơn hàng' }

  var rows = getAllRows('ORDER')

  // Filter "own" nếu không có view_all
  var ownIds = null
  if (!viewAll) ownIds = getOwnOrderIds(u.user_id, u.role_id)

  var status = p.status || ''
  var locationId = p.location_id || ''
  var dateFrom = p.date_from || ''
  var dateTo = p.date_to || ''
  var q = (p.q || '').toString().toLowerCase().trim()

  var locNames = locationNameMap()
  var avatars = customerAvatarMap()

  var filtered = rows.filter(function (r) {
    if (ownIds && !ownIds.has(r[COL.ORDER.order_id])) return false
    if (status && r[COL.ORDER.status] !== status) return false
    if (locationId && r[COL.ORDER.location_id] !== locationId) return false
    var sd = fmtCell(r[COL.ORDER.shoot_date]).slice(0, 10)
    if (dateFrom && sd && sd < dateFrom) return false
    if (dateTo && sd && sd > dateTo) return false
    if (q) {
      var hay = (r[COL.ORDER.order_id] + ' ' + r[COL.ORDER.customer_name] + ' ' + r[COL.ORDER.customer_phone]).toLowerCase()
      if (hay.indexOf(q) === -1) return false
    }
    return true
  })

  // Sắp xếp: shoot_date desc rồi created_at desc
  filtered.sort(function (a, b) {
    var sa = fmtCell(a[COL.ORDER.shoot_date]), sb = fmtCell(b[COL.ORDER.shoot_date])
    if (sa !== sb) return sb > sa ? 1 : -1
    var ca = fmtCell(a[COL.ORDER.created_at]), cb = fmtCell(b[COL.ORDER.created_at])
    return cb > ca ? 1 : -1
  })

  var page = paginate(filtered, p.limit, p.offset)

  var canFinancial = perms.has('order.view_financial')
  var items = page.items.map(function (r) {
    var o = {
      order_id:        r[COL.ORDER.order_id],
      version:         Number(r[COL.ORDER.version]) || 1,
      customer_id:     r[COL.ORDER.customer_id],
      customer_name:   r[COL.ORDER.customer_name],
      customer_phone:  r[COL.ORDER.customer_phone],
      customer_avatar_url: avatars[r[COL.ORDER.customer_id]] || null,
      location_id:     r[COL.ORDER.location_id],
      location_name:   locNames[r[COL.ORDER.location_id]] || r[COL.ORDER.location_id],
      sale_staff_id:   r[COL.ORDER.sale_staff_id],
      shoot_date:      fmtCell(r[COL.ORDER.shoot_date]).slice(0, 10),
      arrival_time:    fmtTimeCell(r[COL.ORDER.arrival_time]),
      status:          r[COL.ORDER.status],
      delivery_type:   r[COL.ORDER.delivery_type] || null,
    }
    if (canFinancial) {
      o.total_price = Number(r[COL.ORDER.total_price]) || 0
      o.deposit_amount = Number(r[COL.ORDER.deposit_amount]) || 0
      o.remaining_amount = Number(r[COL.ORDER.remaining_amount]) || 0
      o.payment_status = r[COL.ORDER.payment_status] || 'CHUA_COC'
    }
    return o
  })

  return jsonOk({
    orders: items, total: page.total, hasMore: page.hasMore,
    limit: page.limit, offset: page.offset
  })
}

// ─── orders.get ───────────────────────────────────────────────────────────────

function actionOrdersGet(p, u, perms) {
  var viewAll = perms.has('order.view_all')
  var viewOwn = perms.has('order.view_own')
  if (!viewAll && !viewOwn) throw { status: 403, message: 'Không có quyền xem đơn hàng' }

  var orderId = p.order_id
  if (!orderId) return jsonError(400, 'Thiếu order_id')

  var found = findOrderRowById(orderId)
  if (!found) return jsonError(404, 'Không tìm thấy đơn: ' + orderId)

  var order = rowToOrder(found.row)
  var concepts = getConceptsByOrder(orderId)

  // Kiểm tra quyền "own" nếu không có view_all
  if (!viewAll) {
    var conceptRows = concepts // already objects
    var isOwn = isOwnOrder(order, conceptRows, u.user_id, u.role_id)
    if (!isOwn) return jsonError(403, 'Đơn này không thuộc phạm vi của bạn')
  }

  var svcMap = serviceMap()
  var names = userNameMap()

  var conceptsOut = concepts.map(function (c) {
    var svc = svcMap[c.service_id] || null
    return {
      concept_id:               c.concept_id,
      concept_index:            c.concept_index,
      service_id:               c.service_id,
      service:                  svc,  // {name, cover_photo_url, sample_photo_urls, duration_minutes...}
      custom_price:             c.custom_price,
      voucher_id:               c.voucher_id,
      assigned_photographer_id: c.assigned_photographer_id,
      assigned_mua_id:          c.assigned_mua_id,
      assigned_hau_ky_id:       c.assigned_hau_ky_id,
      assigned_support_id:      c.assigned_support_id,
      photographer_name:        c.assigned_photographer_id ? (names[c.assigned_photographer_id] || c.assigned_photographer_id) : null,
      mua_name:                 c.assigned_mua_id ? (names[c.assigned_mua_id] || c.assigned_mua_id) : null,
      hau_ky_name:              c.assigned_hau_ky_id ? (names[c.assigned_hau_ky_id] || c.assigned_hau_ky_id) : null,
      support_name:             c.assigned_support_id ? (names[c.assigned_support_id] || c.assigned_support_id) : null,
      reference_photo_urls:     c.reference_photo_urls,
      notes:                    c.notes,
    }
  })

  var addons = getAddonsByOrder(orderId)

  // strip financial cho từng concept? custom_price là financial — strip nếu thiếu quyền
  if (!perms.has('order.view_financial')) {
    conceptsOut.forEach(function (c) { delete c.custom_price })
    addons = []  // giá addon là financial
  }

  var orderOut = stripFinancialFields(order, perms)
  orderOut.location_name = locationNameMap()[order.location_id] || order.location_id
  orderOut.sale_name = order.sale_staff_id ? (names[order.sale_staff_id] || order.sale_staff_id) : null

  var avatars = customerAvatarMap()

  return jsonOk({
    order: orderOut,
    concepts: conceptsOut,
    addons: addons,
    customer_avatar_url: avatars[order.customer_id] || null,
    allowed_transitions: getAllowedTransitions(order.status, perms, u.role_id),
  })
}

// ─── orders.history ───────────────────────────────────────────────────────────

function actionOrdersHistory(p, u, perms) {
  requirePermission(perms, 'order.view_all')
  var orderId = p.order_id
  if (!orderId) return jsonError(400, 'Thiếu order_id')
  var names = userNameMap()
  var hist = getAllRows('ORDER_HISTORY')
    .filter(function (r) { return r[COL.ORDER_HISTORY.order_id] === orderId })
    .map(function (r) {
      return {
        history_id: r[COL.ORDER_HISTORY.history_id],
        changed_by: r[COL.ORDER_HISTORY.changed_by],
        changed_by_name: names[r[COL.ORDER_HISTORY.changed_by]] || r[COL.ORDER_HISTORY.changed_by],
        changed_at: fmtCell(r[COL.ORDER_HISTORY.changed_at]),
        action:     r[COL.ORDER_HISTORY.action],
        field_name: r[COL.ORDER_HISTORY.field_name],
        old_value:  r[COL.ORDER_HISTORY.old_value],
        new_value:  r[COL.ORDER_HISTORY.new_value],
      }
    })
    .sort(function (a, b) { return b.changed_at > a.changed_at ? 1 : -1 })
  return jsonOk({ history: hist })
}

// ─── Tổng đơn + delivery_type ─────────────────────────────────────────────────

function computeVoucherDiscount(voucherId, base) {
  if (!voucherId) return 0
  var v = getAllRows('VOUCHER').find(function (r) { return r[COL.VOUCHER.voucher_id] === voucherId })
  if (!v) return 0
  var type = v[COL.VOUCHER.type]
  var val = Number(v[COL.VOUCHER.value]) || 0
  if (type === 'PERCENT') return Math.round(base * val / 100)
  return Math.min(val, base) // FIXED_AMOUNT
}

/**
 * Tính total_price từ concepts + addons + vouchers.
 * concepts: [{ custom_price, concept_index, voucher_id }]
 * addons:   [{ actual_price, quantity }]
 */
function computeOrderTotal(concepts, addons, orderVoucherId) {
  var subtotal = 0
  concepts.forEach(function (c) {
    var price = Number(c.custom_price) || 0
    subtotal += price
    // Voucher concept áp cho concept index >= 2
    if (Number(c.concept_index) >= 2 && c.voucher_id) {
      subtotal -= computeVoucherDiscount(c.voucher_id, price)
    }
  })
  ;(addons || []).forEach(function (a) {
    subtotal += (Number(a.actual_price) || 0) * (Number(a.quantity) || 1)
  })
  // Voucher đơn hàng
  if (orderVoucherId) {
    subtotal -= computeVoucherDiscount(orderVoucherId, subtotal)
  }
  return Math.max(subtotal, 0)
}

/**
 * Tính delivery_type từ concepts + addons.
 * PRINT nếu: bất kỳ concept includes_print, hoặc addon loại PRINT/PRINT_ALBUM/CANVAS/FRAME
 */
function computeDeliveryType(concepts, addons) {
  var svc = serviceMap()
  var hasPrint = concepts.some(function (c) {
    var s = svc[c.service_id]
    return s && s.includes_print
  })
  if (!hasPrint && addons && addons.length) {
    var catRows = getAllRows('ADDON_CATALOG')
    var catCategory = {}
    catRows.forEach(function (r) { catCategory[r[COL.ADDON_CATALOG.addon_id]] = r[COL.ADDON_CATALOG.category] })
    hasPrint = addons.some(function (a) {
      var cat = catCategory[a.addon_catalog_id]
      return cat === 'PRINT' || cat === 'PRINT_ALBUM' || cat === 'CANVAS' || cat === 'FRAME'
    })
  }
  return hasPrint ? 'PRINT' : 'DIGITAL'
}

function addonCommission(addonCatalogId, actualPrice, quantity) {
  var r = getAllRows('ADDON_CATALOG').find(function (x) { return x[COL.ADDON_CATALOG.addon_id] === addonCatalogId })
  if (!r) return 0
  var type = r[COL.ADDON_CATALOG.commission_type]
  var val = Number(r[COL.ADDON_CATALOG.commission_value]) || 0
  var qty = Number(quantity) || 1
  if (type === 'PERCENT') return Math.round((Number(actualPrice) || 0) * val / 100 * qty)
  if (type === 'FIXED') return val * qty
  return 0
}

// ─── Double-booking check (Section 4.4) ───────────────────────────────────────

function minutesOf(hhmm) {
  if (!hhmm) return null
  var s = String(hhmm)
  var m = s.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/**
 * Kiểm tra trùng lịch cho danh sách staff trong 1 khung giờ, xuyên cơ sở.
 * Chỉ check photographer/mua/support (KHÔNG check hau_ky).
 * @param staffIds  mảng user_id cần kiểm tra
 * @param shootDate yyyy-MM-dd
 * @param startMin  phút bắt đầu (makeup_start hoặc arrival)
 * @param endMin    phút kết thúc (estimated_end)
 * @param excludeOrderId  bỏ qua đơn này (khi sửa)
 * @returns mảng conflict { staff_id, staff_name, order_id, time }
 */
function checkDoubleBooking(staffIds, shootDate, startMin, endMin, excludeOrderId) {
  var ids = new Set(staffIds.filter(Boolean))
  if (ids.size === 0) return []
  if (startMin === null || endMin === null) return []

  var conflicts = []
  var names = userNameMap()

  // Lấy các đơn cùng ngày (active, không HUY) trừ đơn đang sửa
  var orders = getAllRows('ORDER').filter(function (r) {
    if (r[COL.ORDER.order_id] === excludeOrderId) return false
    if (r[COL.ORDER.status] === 'HUY') return false
    return fmtCell(r[COL.ORDER.shoot_date]).slice(0, 10) === shootDate
  })
  var orderById = {}
  orders.forEach(function (r) { orderById[r[COL.ORDER.order_id]] = r })

  var concepts = getAllRows('CONCEPT').filter(function (c) {
    return orderById[c[COL.CONCEPT.order_id]]
  })

  concepts.forEach(function (c) {
    var oRow = orderById[c[COL.CONCEPT.order_id]]
    var oStart = minutesOf(fmtTimeCell(oRow[COL.ORDER.makeup_start])) || minutesOf(fmtTimeCell(oRow[COL.ORDER.arrival_time]))
    var oEnd = minutesOf(fmtTimeCell(oRow[COL.ORDER.estimated_end]))
    if (oStart === null || oEnd === null) return
    // overlap?
    if (startMin < oEnd && oStart < endMin) {
      ;['assigned_photographer_id', 'assigned_mua_id', 'assigned_support_id'].forEach(function (k) {
        var sid = c[COL.CONCEPT[k]]
        if (sid && ids.has(sid)) {
          conflicts.push({
            staff_id: sid,
            staff_name: names[sid] || sid,
            order_id: c[COL.CONCEPT.order_id],
            time: fmtTimeCell(oRow[COL.ORDER.arrival_time]),
          })
        }
      })
    }
  })
  // dedup
  var seen = {}
  return conflicts.filter(function (c) {
    var key = c.staff_id + '|' + c.order_id
    if (seen[key]) return false
    seen[key] = true
    return true
  })
}

// ─── orders.create ────────────────────────────────────────────────────────────

function parseJsonParam(p, key) {
  var raw = p[key]
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch (e) { return null }
}

function actionOrdersCreate(p, u, perms) {
  requirePermission(perms, 'order.create_edit')

  var data = parseJsonParam(p, 'data') || p
  var concepts = parseJsonParam(p, 'concepts') || data.concepts || []
  var addons = parseJsonParam(p, 'addons') || data.addons || []

  // ── Validation (Section 5.4) ──
  var errors = []
  if (!data.customer_name) errors.push('Thiếu tên khách hàng')
  if (!data.customer_phone) errors.push('Thiếu số điện thoại')
  else if (!/^0\d{8,10}$/.test(String(data.customer_phone).replace(/\s/g, ''))) errors.push('SĐT không đúng định dạng')
  if (!data.location_id) errors.push('Phải chọn cơ sở')
  if (!data.shoot_date) errors.push('Thiếu ngày chụp')
  else if (data.shoot_date < todayVN()) errors.push('Ngày chụp không được ở quá khứ')
  if (!concepts.length) errors.push('Đơn phải có ít nhất 1 concept')

  concepts.forEach(function (c, i) {
    if (!c.service_id) errors.push('Concept ' + (i + 1) + ': chưa chọn dịch vụ')
    if (c.custom_price === undefined || c.custom_price === '' || Number(c.custom_price) < 0) errors.push('Concept ' + (i + 1) + ': giá báo không hợp lệ')
    if ((i + 1) >= 2 && !c.voucher_id) errors.push('Concept ' + (i + 1) + ': bắt buộc chọn voucher (concept 2+)')
  })

  var deposit = Number(data.deposit_amount) || 0
  var total = computeOrderTotal(
    concepts.map(function (c, i) { return { custom_price: c.custom_price, concept_index: i + 1, voucher_id: c.voucher_id } }),
    addons,
    data.order_voucher_id
  )
  if (deposit < 0) errors.push('Tiền cọc không hợp lệ')
  if (deposit > total) errors.push('Tiền cọc không được lớn hơn tổng giá (' + total + ')')

  if (errors.length) return jsonError(400, errors.join('; '))

  // ── Tính giờ chụp ──
  var makeupStart = data.makeup_start || data.arrival_time || ''
  var makeupDur = Number(data.makeup_duration) || 0
  var svc = serviceMap()
  var shootDur = Number(data.shoot_duration) || concepts.reduce(function (s, c) {
    var sv = svc[c.service_id]; return s + (sv ? sv.duration_minutes : 0)
  }, 0)
  var shootStart = addMinutesToTime(makeupStart, makeupDur)
  var estimatedEnd = addMinutesToTime(shootStart, shootDur)

  // ── Double-booking check ──
  var staffIds = []
  concepts.forEach(function (c) {
    if (c.assigned_photographer_id) staffIds.push(c.assigned_photographer_id)
    if (c.assigned_mua_id) staffIds.push(c.assigned_mua_id)
    if (c.assigned_support_id) staffIds.push(c.assigned_support_id)
  })
  var startMin = minutesOf(makeupStart) || minutesOf(data.arrival_time)
  var endMin = minutesOf(estimatedEnd)
  if (startMin !== null && endMin !== null) {
    var conflicts = checkDoubleBooking(staffIds, data.shoot_date, startMin, endMin, null)
    if (conflicts.length) {
      var msg = conflicts.map(function (c) { return c.staff_name + ' đã có lịch (' + c.order_id + ' lúc ' + c.time + ')' }).join('; ')
      return jsonError(409, 'Trùng lịch: ' + msg)
    }
  }

  return withLock(function () {
    // ── Upsert customer theo phone ──
    var customerId = upsertCustomerByPhone(data.customer_name, data.customer_phone, data)

    var orderId = generateOrderId()
    var deliveryType = computeDeliveryType(
      concepts.map(function (c) { return { service_id: c.service_id } }), addons
    )
    var remaining = Math.max(total - deposit, 0)
    var paymentStatus = deposit <= 0 ? 'CHUA_COC' : (deposit >= total ? 'DA_THANH_TOAN' : 'DA_COC')
    var initialStatus = data.status || 'BAO_GIA'

    appendRow('ORDER', [
      orderId, 1, customerId, data.customer_name, data.customer_phone,
      data.location_id, data.sale_staff_id || u.user_id, data.sale_channel || 'ONLINE',
      data.shoot_date, data.arrival_time || '', makeupStart, makeupDur,
      shootStart, shootDur, estimatedEnd,
      initialStatus, deliveryType, data.order_voucher_id || '', '',
      total, deposit, remaining, paymentStatus, '', data.notes || '',
      nowVN(), nowVN()
    ])

    // ── Concepts ──
    var assignedSet = {}  // user_id → true (để gửi STAFF_ASSIGNED dedup)
    concepts.forEach(function (c, i) {
      var conceptId = generateId('cpt')
      appendRow('CONCEPT', [
        conceptId, orderId, i + 1, c.service_id, Number(c.custom_price) || 0,
        c.voucher_id || '',
        c.assigned_photographer_id || '', c.assigned_mua_id || '',
        c.assigned_hau_ky_id || '', c.assigned_support_id || '',
        serializeList(c.reference_photo_urls || []), c.notes || ''
      ]);
      [c.assigned_photographer_id, c.assigned_mua_id, c.assigned_hau_ky_id, c.assigned_support_id]
        .filter(Boolean).forEach(function (sid) { assignedSet[sid] = true })
    })

    // ── Addons ──
    ;(addons || []).forEach(function (a) {
      var comm = addonCommission(a.addon_catalog_id, a.actual_price, a.quantity)
      appendRow('ORDER_ADDON', [
        generateId('oad'), orderId, a.addon_catalog_id, Number(a.quantity) || 1,
        Number(a.catalog_price) || 0, Number(a.actual_price) || 0, comm
      ])
    })

    // ── History + notifications ──
    logHistory(orderId, u.user_id, 'FIELD_UPDATE', 'create', '', 'Tạo đơn ' + orderId)
    var assignedIds = Object.keys(assignedSet)
    if (assignedIds.length) {
      createNotifications(assignedIds, 'STAFF_ASSIGNED', orderId,
        'Bạn được phân công đơn ' + orderId + ' — chụp ' + data.shoot_date + ' ' + (data.arrival_time || ''))
    }

    invalidateOrderCaches()
    return jsonOk({ order_id: orderId, version: 1, total_price: total, delivery_type: deliveryType })
  })
}

function addMinutesToTime(hhmm, minutes) {
  var m = minutesOf(hhmm)
  if (m === null) return ''
  var total = m + (Number(minutes) || 0)
  var h = Math.floor(total / 60) % 24
  var mm = total % 60
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}

function invalidateOrderCaches() {
  _userNameMap = null; _locationNameMap = null; _serviceMap = null; _customerAvatarMap = null
}

// ─── orders.update ────────────────────────────────────────────────────────────

function actionOrdersUpdate(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var orderId = p.order_id
  if (!orderId) return jsonError(400, 'Thiếu order_id')
  var clientVersion = p.version
  var data = parseJsonParam(p, 'data') || {}

  return withLock(function () {
    var chk
    try { chk = checkOrderVersion(orderId, clientVersion) }
    catch (e) {
      if (e.isConflict) return jsonError(409, 'Đơn vừa bị người khác sửa — đang tải lại…')
      return jsonError(404, e.message || 'Không tìm thấy đơn')
    }
    var sheet = getSheet('ORDER')
    var rowIdx = chk.rowIndex
    var row = chk.rowData
    var status = row[COL.ORDER.status]

    // Các field cho phép sửa trực tiếp ở cấp ORDER
    var editable = {
      customer_name: COL.ORDER.customer_name,
      customer_phone: COL.ORDER.customer_phone,
      location_id: COL.ORDER.location_id,
      sale_channel: COL.ORDER.sale_channel,
      shoot_date: COL.ORDER.shoot_date,
      arrival_time: COL.ORDER.arrival_time,
      makeup_start: COL.ORDER.makeup_start,
      makeup_duration: COL.ORDER.makeup_duration,
      notes: COL.ORDER.notes,
      order_voucher_id: COL.ORDER.order_voucher_id,
    }
    Object.keys(editable).forEach(function (k) {
      if (data[k] !== undefined) {
        var oldV = row[editable[k]]
        sheet.getRange(rowIdx, editable[k] + 1).setValue(data[k])
        if (String(oldV) !== String(data[k])) {
          logHistory(orderId, u.user_id, 'FIELD_UPDATE', k, oldV, data[k])
        }
      }
    })

    // Recompute giờ nếu makeup thay đổi
    if (data.makeup_start !== undefined || data.makeup_duration !== undefined || data.shoot_duration !== undefined) {
      var ms = data.makeup_start !== undefined ? data.makeup_start : fmtTimeCell(row[COL.ORDER.makeup_start])
      var md = data.makeup_duration !== undefined ? Number(data.makeup_duration) : Number(row[COL.ORDER.makeup_duration]) || 0
      var sd = data.shoot_duration !== undefined ? Number(data.shoot_duration) : Number(row[COL.ORDER.shoot_duration]) || 0
      var ss = addMinutesToTime(ms, md)
      var ee = addMinutesToTime(ss, sd)
      sheet.getRange(rowIdx, COL.ORDER.shoot_start + 1).setValue(ss)
      sheet.getRange(rowIdx, COL.ORDER.shoot_duration + 1).setValue(sd)
      sheet.getRange(rowIdx, COL.ORDER.estimated_end + 1).setValue(ee)
    }

    // Bump version + updated_at
    var newVersion = (Number(row[COL.ORDER.version]) || 1) + 1
    sheet.getRange(rowIdx, COL.ORDER.version + 1).setValue(newVersion)
    sheet.getRange(rowIdx, COL.ORDER.updated_at + 1).setValue(nowVN())

    invalidateOrderCaches()
    return jsonOk({ order_id: orderId, version: newVersion })
  })
}

// ─── orders.updateStatus ──────────────────────────────────────────────────────

function actionOrdersUpdateStatus(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var orderId = p.order_id
  var newStatus = p.status
  var clientVersion = p.version
  if (!orderId || !newStatus) return jsonError(400, 'Thiếu order_id hoặc status')

  return withLock(function () {
    var chk
    try { chk = checkOrderVersion(orderId, clientVersion) }
    catch (e) {
      if (e.isConflict) return jsonError(409, 'Đơn vừa bị người khác sửa — đang tải lại…')
      return jsonError(404, e.message || 'Không tìm thấy đơn')
    }
    var sheet = getSheet('ORDER')
    var rowIdx = chk.rowIndex
    var row = chk.rowData
    var curStatus = row[COL.ORDER.status]

    // Validate transition
    var allowed = TRANSITIONS[curStatus] || []
    if (allowed.indexOf(newStatus) === -1) {
      return jsonError(400, 'Không thể chuyển từ ' + (STATUS_LABELS[curStatus] || curStatus) + ' sang ' + (STATUS_LABELS[newStatus] || newStatus))
    }

    var warning = null

    // Cảnh báo thiếu raw_link khi → DA_CHUP (không block)
    if (newStatus === 'DA_CHUP' && !row[COL.ORDER.raw_link]) {
      warning = 'Chưa có link ảnh raw từ Photographer'
    }

    // → HUY: xử lý cancel_reason + hoàn cọc
    if (newStatus === 'HUY') {
      var reason = p.cancel_reason || 'customer'
      sheet.getRange(rowIdx, COL.ORDER.cancel_reason + 1).setValue(reason)
      sheet.getRange(rowIdx, COL.ORDER.remaining_amount + 1).setValue(0)
      if (reason === 'force_majeure') {
        sheet.getRange(rowIdx, COL.ORDER.payment_status + 1).setValue('HOAN_COC')
      }
      logHistory(orderId, u.user_id, 'CANCEL', 'cancel_reason', '', reason)
    }

    // → DA_CHUP: ghi nhận thu tiền nếu có
    if (newStatus === 'DA_CHUP' && p.collected_amount !== undefined) {
      var collected = Number(p.collected_amount) || 0
      var total = Number(row[COL.ORDER.total_price]) || 0
      var deposit = Number(row[COL.ORDER.deposit_amount]) || 0
      var paid = deposit + collected
      sheet.getRange(rowIdx, COL.ORDER.deposit_amount + 1).setValue(paid)
      sheet.getRange(rowIdx, COL.ORDER.remaining_amount + 1).setValue(Math.max(total - paid, 0))
      sheet.getRange(rowIdx, COL.ORDER.payment_status + 1).setValue(paid >= total ? 'DA_THANH_TOAN' : 'DA_COC')
      logHistory(orderId, u.user_id, 'PAYMENT', 'collected', '', collected)
    }

    // Cập nhật status + version
    sheet.getRange(rowIdx, COL.ORDER.status + 1).setValue(newStatus)
    var newVersion = (Number(row[COL.ORDER.version]) || 1) + 1
    sheet.getRange(rowIdx, COL.ORDER.version + 1).setValue(newVersion)
    sheet.getRange(rowIdx, COL.ORDER.updated_at + 1).setValue(nowVN())
    logHistory(orderId, u.user_id, 'STATUS_CHANGE', 'status', curStatus, newStatus)

    invalidateOrderCaches()
    var resp = { order_id: orderId, version: newVersion, status: newStatus }
    if (warning) resp.warning = warning
    return jsonOk(resp)
  })
}

// ─── orders.updateStatusHK ────────────────────────────────────────────────────

function actionOrdersUpdateStatusHK(p, u, perms) {
  requirePermission(perms, 'order.update_status_hk')
  var orderId = p.order_id
  if (!orderId) return jsonError(400, 'Thiếu order_id')

  return withLock(function () {
    var found = findOrderRowById(orderId)
    if (!found) return jsonError(404, 'Không tìm thấy đơn: ' + orderId)
    var row = found.row
    var curStatus = row[COL.ORDER.status]
    if (curStatus !== 'DUYET_ANH') {
      return jsonError(400, 'Chỉ chuyển trạng thái này khi đơn đang ở DUYỆT ẢNH')
    }
    var deliveryType = row[COL.ORDER.delivery_type]
    if (!deliveryType) {
      return jsonError(400, 'delivery_type không xác định — Manager cần kiểm tra đơn này')
    }
    var target = deliveryType === 'PRINT' ? 'CHO_IN' : 'GIAO_FILE'
    found.sheet.getRange(found.rowIndex, COL.ORDER.status + 1).setValue(target)
    var newVersion = (Number(row[COL.ORDER.version]) || 1) + 1
    found.sheet.getRange(found.rowIndex, COL.ORDER.version + 1).setValue(newVersion)
    found.sheet.getRange(found.rowIndex, COL.ORDER.updated_at + 1).setValue(nowVN())
    logHistory(orderId, u.user_id, 'STATUS_CHANGE', 'status', curStatus, target)
    invalidateOrderCaches()
    return jsonOk({ order_id: orderId, version: newVersion, status: target })
  })
}

// ─── orders.overrideDeliveryType ──────────────────────────────────────────────

function actionOrdersOverrideDeliveryType(p, u, perms) {
  if (u.role_id !== 'manager') return jsonError(403, 'Chỉ Manager được override delivery_type')
  var orderId = p.order_id
  var dt = p.delivery_type
  if (!orderId || (dt !== 'PRINT' && dt !== 'DIGITAL')) return jsonError(400, 'Thiếu order_id hoặc delivery_type không hợp lệ')

  return withLock(function () {
    var found = findOrderRowById(orderId)
    if (!found) return jsonError(404, 'Không tìm thấy đơn: ' + orderId)
    var old = found.row[COL.ORDER.delivery_type]
    found.sheet.getRange(found.rowIndex, COL.ORDER.delivery_type + 1).setValue(dt)
    var newVersion = (Number(found.row[COL.ORDER.version]) || 1) + 1
    found.sheet.getRange(found.rowIndex, COL.ORDER.version + 1).setValue(newVersion)
    found.sheet.getRange(found.rowIndex, COL.ORDER.updated_at + 1).setValue(nowVN())
    logHistory(orderId, u.user_id, 'FIELD_UPDATE', 'delivery_type', old, dt)
    invalidateOrderCaches()
    return jsonOk({ order_id: orderId, version: newVersion, delivery_type: dt })
  })
}

// ─── orders.uploadRawLink ─────────────────────────────────────────────────────

function actionOrdersUploadRawLink(p, u, perms) {
  requirePermission(perms, 'order.upload_raw_link')
  var orderId = p.order_id
  var rawLink = p.raw_link
  if (!orderId || !rawLink) return jsonError(400, 'Thiếu order_id hoặc raw_link')

  return withLock(function () {
    var found = findOrderRowById(orderId)
    if (!found) return jsonError(404, 'Không tìm thấy đơn: ' + orderId)
    var row = found.row

    // (1) user phải là assigned_photographer trong ít nhất 1 concept
    var concepts = getConceptsByOrder(orderId)
    var isAssigned = concepts.some(function (c) { return c.assigned_photographer_id === u.user_id })
    if (u.role_id !== 'manager' && !isAssigned) {
      return jsonError(403, 'Bạn không phải Photographer được phân công đơn này')
    }
    // (2) status phải thuộc {LEN_LICH, TAM_DUNG, DA_CHUP}
    var st = row[COL.ORDER.status]
    if (['LEN_LICH', 'TAM_DUNG', 'DA_CHUP'].indexOf(st) === -1) {
      return jsonError(400, 'Chỉ upload link raw khi đơn đã lên lịch / tạm dừng / đã chụp')
    }

    var old = row[COL.ORDER.raw_link]
    found.sheet.getRange(found.rowIndex, COL.ORDER.raw_link + 1).setValue(rawLink)
    found.sheet.getRange(found.rowIndex, COL.ORDER.updated_at + 1).setValue(nowVN())
    logHistory(orderId, u.user_id, 'FIELD_UPDATE', 'raw_link', old, rawLink)

    // Notify Manager + Sale
    var sale = row[COL.ORDER.sale_staff_id]
    var managerIds = getAllRows('USERS')
      .filter(function (r) { return r[COL.USERS.role_id] === 'manager' && (r[COL.USERS.is_active] === true || r[COL.USERS.is_active] === 'TRUE') })
      .map(function (r) { return r[COL.USERS.user_id] })
    createNotifications([sale].concat(managerIds).filter(Boolean), 'RAW_UPLOADED', orderId,
      'Photographer đã upload ảnh raw cho đơn ' + orderId)

    return jsonOk({ order_id: orderId, raw_link: rawLink })
  })
}

// ─── orders.addMuaAddon ───────────────────────────────────────────────────────

function actionOrdersAddMuaAddon(p, u, perms) {
  requirePermission(perms, 'order.add_mua_addon')
  var orderId = p.order_id
  var addonCatalogId = p.addon_catalog_id
  if (!orderId || !addonCatalogId) return jsonError(400, 'Thiếu order_id hoặc addon_catalog_id')

  // addon phải là MUA_PRODUCT
  var cat = getAllRows('ADDON_CATALOG').find(function (r) { return r[COL.ADDON_CATALOG.addon_id] === addonCatalogId })
  if (!cat) return jsonError(404, 'Không tìm thấy add-on')
  if (cat[COL.ADDON_CATALOG.category] !== 'MUA_PRODUCT') return jsonError(400, 'Chỉ được thêm add-on loại MUA_PRODUCT')

  // user phải là assigned_mua trong 1 concept của đơn
  var concepts = getConceptsByOrder(orderId)
  var isMua = concepts.some(function (c) { return c.assigned_mua_id === u.user_id })
  if (u.role_id !== 'manager' && !isMua) return jsonError(403, 'Bạn không phải MUA được phân công đơn này')

  return withLock(function () {
    var found = findOrderRowById(orderId)
    if (!found) return jsonError(404, 'Không tìm thấy đơn: ' + orderId)

    var qty = Number(p.quantity) || 1
    var catalogPrice = Number(cat[COL.ADDON_CATALOG.sell_price]) || 0
    var actualPrice = p.actual_price !== undefined ? Number(p.actual_price) : catalogPrice
    var comm = addonCommission(addonCatalogId, actualPrice, qty)
    var addonId = generateId('oad')
    appendRow('ORDER_ADDON', [addonId, orderId, addonCatalogId, qty, catalogPrice, actualPrice, comm])

    // Cập nhật tổng đơn
    recomputeOrderTotal(found, orderId)

    // Cảnh báo DELIVERY_TYPE_MISMATCH: addon PRINT thêm vào đơn đã lock DIGITAL
    var resp = { addon_id: addonId }
    var st = found.row[COL.ORDER.status]
    var dt = found.row[COL.ORDER.delivery_type]
    if (STATUS_ORDER_INDEX[st] >= STATUS_ORDER_INDEX['DA_CHUP'] && dt === 'DIGITAL' &&
        ['PRINT', 'PRINT_ALBUM', 'CANVAS', 'FRAME'].indexOf(cat[COL.ADDON_CATALOG.category]) !== -1) {
      resp.warning = 'DELIVERY_TYPE_MISMATCH'
    }
    logHistory(orderId, u.user_id, 'FIELD_UPDATE', 'addon', '', 'Thêm MUA addon ' + cat[COL.ADDON_CATALOG.name])
    return jsonOk(resp)
  })
}

// Tính lại total_price/remaining sau khi thêm addon
function recomputeOrderTotal(found, orderId) {
  var concepts = getConceptsByOrder(orderId).map(function (c) {
    return { custom_price: c.custom_price, concept_index: c.concept_index, voucher_id: c.voucher_id }
  })
  var addons = getAddonsByOrder(orderId)
  var orderVoucher = found.row[COL.ORDER.order_voucher_id] || null
  var total = computeOrderTotal(concepts, addons, orderVoucher)
  var deposit = Number(found.row[COL.ORDER.deposit_amount]) || 0
  found.sheet.getRange(found.rowIndex, COL.ORDER.total_price + 1).setValue(total)
  found.sheet.getRange(found.rowIndex, COL.ORDER.remaining_amount + 1).setValue(Math.max(total - deposit, 0))
}

// ─── Customer upsert helper (dùng chung với customers.upsert) ──────────────────

function upsertCustomerByPhone(name, phone, data) {
  data = data || {}
  var rows = getAllRows('CUSTOMERS')
  var existing = rows.find(function (r) { return String(r[COL.CUSTOMERS.phone]) === String(phone) })
  if (existing) {
    return existing[COL.CUSTOMERS.customer_id]
  }
  var customerId = generateId('cus')
  appendRow('CUSTOMERS', [
    customerId, name, phone, data.email || '', data.source || '',
    serializeList(data.tags || []), data.notes || '', data.avatar_url || '', nowVN()
  ])
  _customerAvatarMap = null
  return customerId
}
