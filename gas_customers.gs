/**
 * gas_customers.gs — Handlers cho Customers & CRM (Phase 2 core)
 * Studio LẠM MIÊN
 *
 * customers.search, customers.get, customers.upsert
 */

function rowToCustomer(row) {
  return {
    customer_id: row[COL.CUSTOMERS.customer_id],
    name:        row[COL.CUSTOMERS.name],
    phone:       String(row[COL.CUSTOMERS.phone] || ''),
    email:       row[COL.CUSTOMERS.email] || '',
    source:      row[COL.CUSTOMERS.source] || '',
    tags:        parseList(row[COL.CUSTOMERS.tags]),
    notes:       row[COL.CUSTOMERS.notes] || '',
    avatar_url:  row[COL.CUSTOMERS.avatar_url] || null,
    created_at:  fmtCell(row[COL.CUSTOMERS.created_at]),
  }
}

// ─── customers.search ─────────────────────────────────────────────────────────

function actionCustomersSearch(p, u, perms) {
  requirePermission(perms, 'crm.view_edit')
  var phone = (p.phone || '').toString().replace(/\s/g, '')
  var name = (p.name || '').toString().toLowerCase().trim()
  if (!phone && !name) return jsonOk({ customers: [] })

  var rows = getAllRows('CUSTOMERS')
  var orders = getAllRows('ORDER')

  var matches = rows.filter(function (r) {
    if (phone && String(r[COL.CUSTOMERS.phone]).indexOf(phone) !== -1) return true
    if (name && String(r[COL.CUSTOMERS.name] || '').toLowerCase().indexOf(name) !== -1) return true
    return false
  }).slice(0, 10)

  var out = matches.map(function (r) {
    var c = rowToCustomer(r)
    var cOrders = orders.filter(function (o) { return o[COL.ORDER.customer_id] === c.customer_id })
    c.order_count = cOrders.length
    var lastDate = ''
    cOrders.forEach(function (o) {
      var sd = fmtCell(o[COL.ORDER.shoot_date]).slice(0, 10)
      if (sd > lastDate) lastDate = sd
    })
    c.last_order_date = lastDate || null
    return c
  })
  return jsonOk({ customers: out })
}

// ─── customers.get ────────────────────────────────────────────────────────────

function actionCustomersGet(p, u, perms) {
  requirePermission(perms, 'crm.view_edit')
  var customerId = p.customer_id
  if (!customerId) return jsonError(400, 'Thiếu customer_id')
  var row = getAllRows('CUSTOMERS').find(function (r) { return r[COL.CUSTOMERS.customer_id] === customerId })
  if (!row) return jsonError(404, 'Không tìm thấy khách hàng')

  var customer = rowToCustomer(row)
  var svc = serviceMap()
  var concepts = getAllRows('CONCEPT')

  var orders = getAllRows('ORDER')
    .filter(function (o) { return o[COL.ORDER.customer_id] === customerId })
    .map(function (o) {
      return {
        order_id: o[COL.ORDER.order_id],
        shoot_date: fmtCell(o[COL.ORDER.shoot_date]).slice(0, 10),
        status: o[COL.ORDER.status],
        total_price: Number(o[COL.ORDER.total_price]) || 0,
      }
    })
    .sort(function (a, b) { return b.shoot_date > a.shoot_date ? 1 : -1 })

  var totalSpent = orders.reduce(function (s, o) { return s + o.total_price }, 0)

  return jsonOk({ customer: customer, orders: orders, order_count: orders.length, total_spent: totalSpent })
}

// ─── customers.upsert ─────────────────────────────────────────────────────────

function actionCustomersUpsert(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var data = parseJsonParam(p, 'data') || p
  if (!data.name) return jsonError(400, 'Thiếu tên khách hàng')
  if (!data.phone) return jsonError(400, 'Thiếu số điện thoại')

  return withLock(function () {
    var sheet = getSheet('CUSTOMERS')
    var rows = sheet.getDataRange().getValues()
    // Tìm theo customer_id (nếu có) hoặc phone
    for (var i = 1; i < rows.length; i++) {
      var match = (data.customer_id && rows[i][COL.CUSTOMERS.customer_id] === data.customer_id) ||
                  (!data.customer_id && String(rows[i][COL.CUSTOMERS.phone]) === String(data.phone))
      if (match) {
        if (data.name !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.name + 1).setValue(data.name)
        if (data.phone !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.phone + 1).setValue(data.phone)
        if (data.email !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.email + 1).setValue(data.email)
        if (data.source !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.source + 1).setValue(data.source)
        if (data.tags !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.tags + 1).setValue(serializeList(data.tags))
        if (data.notes !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.notes + 1).setValue(data.notes)
        if (data.avatar_url !== undefined) sheet.getRange(i + 1, COL.CUSTOMERS.avatar_url + 1).setValue(data.avatar_url || '')
        _customerAvatarMap = null; cacheDel('map_avatars')
        return jsonOk({ customer_id: rows[i][COL.CUSTOMERS.customer_id] })
      }
    }
    // Tạo mới
    var customerId = generateId('cus')
    appendRow('CUSTOMERS', [
      customerId, data.name, data.phone, data.email || '', data.source || '',
      serializeList(data.tags || []), data.notes || '', data.avatar_url || '', nowVN()
    ])
    _customerAvatarMap = null
    return jsonOk({ customer_id: customerId })
  })
}
