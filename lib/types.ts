// lib/types.ts — kiểu dữ liệu khớp response GAS Phase 2

export interface AuthUser {
  user_id: string
  name: string
  email: string
  role_id: string
  location_ids: string[]
  default_location_id: string | null
}

export interface OrderListItem {
  order_id: string
  version: number
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_avatar_url: string | null
  location_id: string
  location_name: string
  sale_staff_id: string
  shoot_date: string
  arrival_time: string
  status: string
  delivery_type: string | null
  total_price?: number
  deposit_amount?: number
  remaining_amount?: number
  payment_status?: string
}

export interface OrdersListResponse {
  orders: OrderListItem[]
  total: number
  hasMore: boolean
  limit: number
  offset: number
}

export interface ServiceLite {
  service_id: string
  name: string
  cover_photo_url: string | null
  sample_photo_urls: string[]
  duration_minutes: number
  includes_print?: boolean
  description?: string
}

export interface Concept {
  concept_id: string
  concept_index: number
  service_id: string
  service: ServiceLite | null
  custom_price?: number
  voucher_id: string | null
  assigned_photographer_id: string | null
  assigned_mua_id: string | null
  assigned_hau_ky_id: string | null
  assigned_support_id: string | null
  photographer_name: string | null
  mua_name: string | null
  hau_ky_name: string | null
  support_name: string | null
  reference_photo_urls: string[]
  notes: string
}

export interface OrderAddon {
  order_addon_id: string
  addon_catalog_id: string
  quantity: number
  catalog_price: number
  actual_price: number
  commission_amount: number
}

export interface OrderDetail {
  order_id: string
  version: number
  customer_id: string
  customer_name: string
  customer_phone: string
  location_id: string
  location_name: string
  sale_staff_id: string
  sale_name: string | null
  sale_channel: string
  shoot_date: string
  arrival_time: string
  makeup_start: string
  makeup_duration: number
  shoot_start: string
  shoot_duration: number
  estimated_end: string
  status: string
  delivery_type: string | null
  order_voucher_id: string | null
  raw_link: string | null
  total_price?: number
  deposit_amount?: number
  remaining_amount?: number
  payment_status?: string
  cancel_reason: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface AllowedTransition {
  to: string
  label: string
  kind: 'primary' | 'ghost' | 'danger'
  needsConfirm: boolean
  hk: boolean
}

export interface OrderGetResponse {
  order: OrderDetail
  concepts: Concept[]
  addons: OrderAddon[]
  customer_avatar_url: string | null
  allowed_transitions: AllowedTransition[]
}

export interface CustomerSearchItem {
  customer_id: string
  name: string
  phone: string
  email: string
  source: string
  tags: string[]
  avatar_url: string | null
  order_count: number
  last_order_date: string | null
}

export interface Service extends ServiceLite {
  suggested_price: number
  print_spec: string
  is_active: boolean
  default_photographer_salary?: number
  default_mua_salary?: number
  default_hau_ky_rate_per_file?: number
  default_support_salary?: number
  default_sale_commission_pct?: number
}

export interface Voucher {
  voucher_id: string
  code: string
  type: 'PERCENT' | 'FIXED_AMOUNT'
  value: number
  valid_from: string
  valid_until: string
  max_uses: number | null
  used_count: number
}

export interface Location {
  location_id: string
  name: string
  address: string
  phone: string
  is_active: boolean
}

export interface StaffAvailable {
  user_id: string
  name: string
  role_id: string
  busy: boolean
  busy_with: string | null
}

export interface AddonCatalog {
  addon_id: string
  name: string
  category: string
  sell_price: number
  commission_type: string
  commission_value: number
  commission_role: string | null
  cost_price?: number
  is_active?: boolean
}

// ── Phase 4: Quản lý danh mục ──
export interface CatalogManageResponse {
  services: Service[]
  addons: AddonCatalog[]
  vouchers: Voucher[]
  can: {
    services: boolean
    addons: boolean
    addon_mua: boolean
    vouchers: boolean
    cost: boolean
    salary: boolean
  }
}

// ── Phase 5: Lương + Thưởng/Phạt ──
export interface SalaryLine { kind: string; label: string; amount: number }
export interface SalaryRow {
  staff_id: string
  name: string
  role_id: string
  base_salary: number
  concept_total: number
  hk_file_total: number
  addon_total: number
  bonus_total: number
  penalty_total: number
  gross_total: number
  is_locked?: boolean
  lines: SalaryLine[]
}
export interface SalaryListResponse {
  period: string
  salary: SalaryRow[]
  can_manage: boolean
  can_bonus: boolean
  can_view_all: boolean
}
export interface BonusPenalty {
  bp_id: string
  staff_id: string
  staff_name?: string
  type: 'BONUS' | 'PENALTY'
  amount: number
  note: string
  date: string
  order_id: string
}
export interface BonusPenaltyListResponse {
  items: BonusPenalty[]
  staff: { user_id: string; name: string }[]
}

export interface Notif {
  notif_id: string
  type: string
  order_id: string
  message: string
  is_read: boolean
  created_at: string
}

// ── Phase 3: Admin (nhân sự / vai trò / phân quyền) ──
export interface AdminUser {
  user_id: string
  name: string
  email: string
  role_id: string
  role_name: string
  location_ids: string[]
  location_names: string[]
  default_location_id: string | null
  is_active: boolean
  base_salary: number
  concept_rate_type: string
  concept_rate_value: number
  hau_ky_rate_per_file: number
}
export interface RoleItem { role_id: string; role_name: string; is_system?: boolean }
export interface PermissionItem { key: string; label: string; group: string }
export interface RolesListResponse {
  roles: RoleItem[]
  permissions: PermissionItem[]
  matrix: Record<string, Record<string, boolean>>
}
export interface UsersListResponse { users: AdminUser[]; roles: RoleItem[]; locations: Location[] }

export interface OrderHistoryItem {
  history_id: string
  changed_by: string
  changed_by_name: string
  changed_at: string
  action: string
  field_name: string
  old_value: string
  new_value: string
}
