/**
 * gas_calendar.gs — Handlers cho Calendar & Scheduling (Phase 2)
 * Studio LẠM MIÊN
 *
 * calendar.getDay, calendar.checkConflict, staff.available
 */

// ─── calendar.getDay ──────────────────────────────────────────────────────────

function actionCalendarGetDay(p, u, perms) {
  var viewAll = perms.has('calendar.view_all')
  var viewOwn = perms.has('calendar.view_own')
  if (!viewAll && !viewOwn) throw { status: 403, message: 'Không có quyền xem lịch' }

  var date = p.date || todayVN()
  var locationId = p.location_id || ''

  var slotTimes = parseList(getSetting('slot_times', '08:00,10:00,12:00,14:00,16:00,18:00'))

  var ownIds = (!viewAll) ? getOwnOrderIds(u.user_id, u.role_id) : null

  var orders = getAllRows('ORDER').filter(function (r) {
    if (r[COL.ORDER.status] === 'HUY') return false
    if (fmtCell(r[COL.ORDER.shoot_date]).slice(0, 10) !== date) return false
    if (locationId && r[COL.ORDER.location_id] !== locationId) return false
    if (ownIds && !ownIds.has(r[COL.ORDER.order_id])) return false
    return true
  })

  var avatars = customerAvatarMap()
  var locNames = locationNameMap()
  var names = userNameMap()
  var svc = serviceMap()
  var allConcepts = getAllRows('CONCEPT')

  var bookings = orders.map(function (r) {
    var orderId = r[COL.ORDER.order_id]
    var concepts = allConcepts.filter(function (c) { return c[COL.CONCEPT.order_id] === orderId })
    var c1 = concepts.find(function (c) { return Number(c[COL.CONCEPT.concept_index]) === 1 }) || concepts[0]
    var refPhotos = []
    concepts.forEach(function (c) {
      parseList(c[COL.CONCEPT.reference_photo_urls]).forEach(function (url) { if (refPhotos.length < 3) refPhotos.push(url) })
    })
    var svcObj = c1 ? svc[c1[COL.CONCEPT.service_id]] : null
    return {
      order_id: orderId,
      customer_name: r[COL.ORDER.customer_name],
      customer_avatar_url: avatars[r[COL.ORDER.customer_id]] || null,
      location_id: r[COL.ORDER.location_id],
      location_name: locNames[r[COL.ORDER.location_id]] || r[COL.ORDER.location_id],
      arrival_time: fmtTimeCell(r[COL.ORDER.arrival_time]),
      estimated_end: fmtTimeCell(r[COL.ORDER.estimated_end]),
      status: r[COL.ORDER.status],
      service_name: svcObj ? svcObj.name : null,
      photographer_name: c1 && c1[COL.CONCEPT.assigned_photographer_id] ? (names[c1[COL.CONCEPT.assigned_photographer_id]] || null) : null,
      mua_name: c1 && c1[COL.CONCEPT.assigned_mua_id] ? (names[c1[COL.CONCEPT.assigned_mua_id]] || null) : null,
      concept_reference_photos: refPhotos,
    }
  })

  // Gom theo slot (theo arrival_time)
  var slots = slotTimes.map(function (t) {
    return { time: t, bookings: bookings.filter(function (b) { return b.arrival_time === t }) }
  })
  // booking ngoài slot cố định (giờ custom)
  var custom = bookings.filter(function (b) { return slotTimes.indexOf(b.arrival_time) === -1 })

  return jsonOk({ date: date, location_id: locationId || null, slots: slots, custom_bookings: custom })
}

// ─── calendar.checkConflict ───────────────────────────────────────────────────

function actionCalendarCheckConflict(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var date = p.shoot_date || p.date
  if (!date) return jsonError(400, 'Thiếu ngày chụp')

  var staffIds = []
  ;['photographer_id', 'mua_id', 'support_id'].forEach(function (k) {
    if (p[k]) staffIds.push(p[k])
  })
  // hỗ trợ truyền mảng staff_ids
  var arr = parseJsonParam(p, 'staff_ids')
  if (Array.isArray(arr)) staffIds = staffIds.concat(arr)

  var makeupStart = p.makeup_start || p.arrival_time
  var endTime = p.estimated_end
  // nếu không có estimated_end, tính từ makeup_duration + shoot_duration
  if (!endTime && p.makeup_duration !== undefined) {
    var ss = addMinutesToTime(makeupStart, Number(p.makeup_duration) || 0)
    endTime = addMinutesToTime(ss, Number(p.shoot_duration) || 0)
  }
  var startMin = minutesOf(makeupStart)
  var endMin = minutesOf(endTime)

  var conflicts = checkDoubleBooking(staffIds, date, startMin, endMin, p.exclude_order_id || null)
  return jsonOk({ conflict: conflicts.length > 0, conflicts: conflicts })
}

// ─── staff.available ──────────────────────────────────────────────────────────
// Trả về danh sách nhân sự (cho dropdown phân công) + cờ trùng lịch nếu có khung giờ

function actionStaffAvailable(p, u, perms) {
  requirePermission(perms, 'order.create_edit')
  var locationId = p.location_id || ''
  var roleFilter = p.role_id || ''  // photographer | mua | hau_ky | support
  var date = p.shoot_date || p.date || ''
  var makeupStart = p.makeup_start || p.arrival_time || ''
  var endTime = p.estimated_end || ''
  if (!endTime && p.makeup_duration !== undefined) {
    var ss = addMinutesToTime(makeupStart, Number(p.makeup_duration) || 0)
    endTime = addMinutesToTime(ss, Number(p.shoot_duration) || 0)
  }
  var startMin = minutesOf(makeupStart)
  var endMin = minutesOf(endTime)

  var roles = roleFilter ? [roleFilter] : ['photographer', 'mua', 'hau_ky', 'support']

  var users = getAllRows('USERS').filter(function (r) {
    var active = r[COL.USERS.is_active] === true || r[COL.USERS.is_active] === 'TRUE'
    if (!active) return false
    if (roles.indexOf(r[COL.USERS.role_id]) === -1) return false
    if (locationId) {
      var locs = parseList(r[COL.USERS.location_ids])
      if (locs.indexOf(locationId) === -1) return false
    }
    return true
  })

  // tính trùng lịch (chỉ với role tham gia chụp; hau_ky luôn available)
  var conflictMap = {}
  if (date && startMin !== null && endMin !== null) {
    var allIds = users
      .filter(function (r) { return r[COL.USERS.role_id] !== 'hau_ky' })
      .map(function (r) { return r[COL.USERS.user_id] })
    var conflicts = checkDoubleBooking(allIds, date, startMin, endMin, p.exclude_order_id || null)
    conflicts.forEach(function (c) { conflictMap[c.staff_id] = c })
  }

  var out = users.map(function (r) {
    var id = r[COL.USERS.user_id]
    return {
      user_id: id,
      name: r[COL.USERS.name],
      role_id: r[COL.USERS.role_id],
      busy: !!conflictMap[id],
      busy_with: conflictMap[id] ? conflictMap[id].order_id : null,
    }
  })

  return jsonOk({ staff: out })
}
