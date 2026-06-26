/**
 * gas_columns.gs — Hằng số index cột cho từng Sheet
 * Studio LẠM MIÊN
 *
 * Quy ước: index bắt đầu từ 0 (tương thích với getValues()[row][COL.X])
 * Khi thêm/bỏ cột, chỉ cần cập nhật file này — không đụng đến logic business.
 *
 * Cách dùng:
 *   const rows = sheet.getDataRange().getValues()
 *   rows.slice(1).forEach(row => {
 *     const orderId = row[COL.ORDER.order_id]
 *     const status  = row[COL.ORDER.status]
 *   })
 */

const COL = {

  ORDER: {
    order_id:         0,  // A
    version:          1,  // B
    customer_id:      2,  // C
    customer_name:    3,  // D
    customer_phone:   4,  // E
    location_id:      5,  // F
    sale_staff_id:    6,  // G
    sale_channel:     7,  // H
    shoot_date:       8,  // I
    arrival_time:     9,  // J
    makeup_start:     10, // K
    makeup_duration:  11, // L
    shoot_start:      12, // M
    shoot_duration:   13, // N
    estimated_end:    14, // O
    status:           15, // P
    delivery_type:    16, // Q
    order_voucher_id: 17, // R
    raw_link:         18, // S
    total_price:      19, // T
    deposit_amount:   20, // U
    remaining_amount: 21, // V
    payment_status:   22, // W
    cancel_reason:    23, // X
    notes:            24, // Y
    created_at:       25, // Z
    updated_at:       26, // AA
  },

  CONCEPT: {
    concept_id:                 0,  // A
    order_id:                   1,  // B
    concept_index:              2,  // C
    service_id:                 3,  // D
    custom_price:               4,  // E
    voucher_id:                 5,  // F
    assigned_photographer_id:   6,  // G
    assigned_mua_id:            7,  // H
    assigned_hau_ky_id:         8,  // I
    assigned_support_id:        9,  // J
    reference_photo_urls:       10, // K
    notes:                      11, // L
  },

  CUSTOMERS: {
    customer_id:  0, // A
    name:         1, // B
    phone:        2, // C
    email:        3, // D
    source:       4, // E
    tags:         5, // F
    notes:        6, // G
    avatar_url:   7, // H
    created_at:   8, // I
  },

  SERVICE_CATALOG: {
    service_id:                   0,  // A
    name:                         1,  // B
    description:                  2,  // C
    suggested_price:              3,  // D
    duration_minutes:             4,  // E
    includes_print:               5,  // F
    print_spec:                   6,  // G
    sample_photo_urls:            7,  // H
    cover_photo_url:              8,  // I
    default_photographer_salary:  9,  // J
    default_mua_salary:           10, // K
    default_hau_ky_rate_per_file: 11, // L
    default_support_salary:       12, // M
    default_sale_commission_pct:  13, // N
    is_active:                    14, // O
  },

  ADDON_CATALOG: {
    addon_id:         0, // A
    name:             1, // B
    category:         2, // C
    cost_price:       3, // D
    sell_price:       4, // E
    commission_type:  5, // F
    commission_value: 6, // G
    commission_role:  7, // H
    is_active:        8, // I
  },

  ORDER_ADDON: {
    order_addon_id:   0, // A
    order_id:         1, // B
    addon_catalog_id: 2, // C
    quantity:         3, // D
    catalog_price:    4, // E
    actual_price:     5, // F
    commission_amount:6, // G
  },

  VOUCHER: {
    voucher_id:  0, // A
    code:        1, // B
    type:        2, // C
    value:       3, // D
    valid_from:  4, // E
    valid_until: 5, // F
    max_uses:    6, // G
    used_count:  7, // H
    created_by:  8, // I
  },

  LOCATIONS: {
    location_id: 0, // A
    name:        1, // B
    address:     2, // C
    phone:       3, // D
    is_active:   4, // E
  },

  USERS: {
    user_id:              0,  // A
    name:                 1,  // B
    email:                2,  // C
    role_id:              3,  // D
    location_ids:         4,  // E — comma-separated
    default_location_id:  5,  // F
    is_active:            6,  // G
    base_salary:          7,  // H
    concept_rate_type:    8,  // I
    concept_rate_value:   9,  // J
    hau_ky_rate_per_file: 10, // K
  },

  ROLES: {
    role_id:    0, // A
    role_name:  1, // B
    is_system:  2, // C
    created_by: 3, // D
  },

  ROLE_PERMISSIONS: {
    role_id:        0, // A
    permission_key: 1, // B
    granted:        2, // C
  },

  HAU_KY_TASK: {
    task_id:         0, // A
    order_id:        1, // B
    assigned_editor: 2, // C
    editor_type:     3, // D
    photo_count:     4, // E
    deadline:        5, // F
    status:          6, // G
    notes:           7, // H
    updated_at:      8, // I
  },

  ALBUM: {
    album_id:     0, // A
    order_id:     1, // B
    concept_id:   2, // C
    album_type:   3, // D
    spec:         4, // E
    edited_link:  5, // F
    print_status: 6, // G
    notes:        7, // H
  },

  SHIPPING: {
    shipping_id:          0,  // A
    album_id:             1,  // B
    order_id:             2,  // C
    recipient_name:       3,  // D
    recipient_phone:      4,  // E
    shipping_address:     5,  // F
    shipping_status:      6,  // G
    carrier:              7,  // H
    tracking_number:      8,  // I
    shipped_at:           9,  // J
    delivered_at:         10, // K
    remaining_amount:     11, // L
    payment_status:       12, // M
    payment_collected_at: 13, // N
    notes:                14, // O
  },

  SALARY: {
    salary_id:     0,  // A
    staff_id:      1,  // B
    period:        2,  // C
    base_salary:   3,  // D
    concept_total: 4,  // E
    hk_file_total: 5,  // F
    addon_total:   6,  // G
    bonus_total:   7,  // H
    penalty_total: 8,  // I
    gross_total:   9,  // J
    is_locked:     10, // K
    locked_at:     11, // L
    locked_by:     12, // M
  },

  BONUS_PENALTY: {
    bp_id:      0, // A
    staff_id:   1, // B
    type:       2, // C
    amount:     3, // D
    note:       4, // E
    date:       5, // F
    order_id:   6, // G
    created_by: 7, // H
  },

  ORDER_HISTORY: {
    history_id:  0, // A
    order_id:    1, // B
    changed_by:  2, // C
    changed_at:  3, // D
    action:      4, // E
    field_name:  5, // F
    old_value:   6, // G
    new_value:   7, // H
  },

  NOTIFICATIONS: {
    notif_id:   0, // A
    user_id:    1, // B
    type:       2, // C
    order_id:   3, // D
    message:    4, // E
    is_read:    5, // F
    created_at: 6, // G
    expires_at: 7, // H
  },

  SETTINGS: {
    key:         0, // A
    value:       1, // B
    description: 2, // C
  },
}
