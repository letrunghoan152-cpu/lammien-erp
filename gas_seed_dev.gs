/**
 * gas_seed_dev.gs — Seed dữ liệu mẫu để test ngay (CHẠY THỦ CÔNG 1 LẦN)
 * Studio LẠM MIÊN — Phase 2
 *
 * Cách dùng: sau khi chạy setupAll(), chạy seedDevData() để có:
 *   - 1 Manager account (đổi email thành tài khoản Google của bạn)
 *   - vài nhân sự mẫu (photographer, mua, sale, hau_ky, support)
 *   - vài dịch vụ + add-on + voucher mẫu
 *
 * ⚠️ Đổi MANAGER_EMAIL thành email Google THẬT của bạn trước khi chạy,
 *    nếu không sẽ không đăng nhập được.
 */

var MANAGER_EMAIL = 'letrunghoan152@gmail.com'  // ← ĐỔI thành email Google của Manager

function seedDevData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()

  // ── USERS ──
  var usersSheet = ss.getSheetByName('USERS')
  if (usersSheet.getLastRow() <= 1) {
    var users = [
      // user_id, name, email, role_id, location_ids, default_location_id, is_active, base_salary, concept_rate_type, concept_rate_value, hau_ky_rate_per_file
      ['usr_mgr',  'Quản lý',        MANAGER_EMAIL,        'manager',      'loc_001,loc_002', 'loc_001', true, 15000000, '',      '',     ''],
      ['usr_sale', 'Nhân viên Sale', 'sale@example.com',   'sale',         'loc_001,loc_002', 'loc_001', true, 6000000,  '',      '',     ''],
      ['usr_pho',  'Photographer A', 'photo@example.com',  'photographer', 'loc_001,loc_002', 'loc_001', true, 0,        'FIXED', 500000, ''],
      ['usr_mua',  'MUA B',          'mua@example.com',    'mua',          'loc_001',         'loc_001', true, 0,        'FIXED', 300000, ''],
      ['usr_hk',   'Hậu Kỳ C',       'hauky@example.com',  'hau_ky',       'loc_001,loc_002', 'loc_001', true, 0,        '',      '',     12000],
      ['usr_sup',  'Support D',      'support@example.com','support',      'loc_001,loc_002', 'loc_001', true, 5000000,  '',      '',     ''],
    ]
    usersSheet.getRange(2, 1, users.length, users[0].length).setValues(users)
    Logger.log('Seed USERS: ' + users.length + ' (Manager email = ' + MANAGER_EMAIL + ')')
  }

  // ── SERVICE_CATALOG ──
  var svcSheet = ss.getSheetByName('SERVICE_CATALOG')
  if (svcSheet.getLastRow() <= 1) {
    var services = [
      // service_id, name, description, suggested_price, duration_minutes, includes_print, print_spec, sample_photo_urls, cover_photo_url, def_pho, def_mua, def_hk_per_file, def_sup, def_sale_pct, is_active
      ['svc_family',  'Family Outdoor',  'Chụp gia đình ngoài trời', 3500000, 90,  false, '',                     '', '', 500000, 300000, 12000, 200000, 5, true],
      ['svc_portrait','Portrait Studio', 'Chụp chân dung studio',    2800000, 60,  false, '',                     '', '', 400000, 250000, 15000, 200000, 5, true],
      ['svc_wedding', 'Wedding Album',   'Chụp cưới có in album',    9000000, 180, true,  'Album 30x30, 20 trang','', '', 800000, 500000, 15000, 300000, 4, true],
    ]
    svcSheet.getRange(2, 1, services.length, services[0].length).setValues(services)
    Logger.log('Seed SERVICE_CATALOG: ' + services.length)
  }

  // ── ADDON_CATALOG ──
  var addonSheet = ss.getSheetByName('ADDON_CATALOG')
  if (addonSheet.getLastRow() <= 1) {
    var addons = [
      // addon_id, name, category, cost_price, sell_price, commission_type, commission_value, commission_role, is_active
      ['adn_print20', 'In ảnh 20x30',  'PRINT',       30000,  80000,  'PERCENT', 10, 'SALE', true],
      ['adn_nails',   'Làm nail',      'MUA_PRODUCT', 50000,  150000, 'FIXED',   50000, 'MUA', true],
      ['adn_lens',    'Lens mắt',      'MUA_PRODUCT', 40000,  120000, 'FIXED',   40000, 'MUA', true],
      ['adn_flower',  'Hoa cầm tay',   'GOODS',       80000,  200000, 'NONE',    0,  '',     true],
    ]
    addonSheet.getRange(2, 1, addons.length, addons[0].length).setValues(addons)
    Logger.log('Seed ADDON_CATALOG: ' + addons.length)
  }

  // ── VOUCHER ──
  var vchSheet = ss.getSheetByName('VOUCHER')
  if (vchSheet.getLastRow() <= 1) {
    var vouchers = [
      // voucher_id, code, type, value, valid_from, valid_until, max_uses, used_count, created_by
      ['vch_c2_20', 'CONCEPT2_20', 'PERCENT',      20,     '2026-01-01', '2026-12-31', '', 0, 'usr_mgr'],
      ['vch_500k',  'GIAM500K',    'FIXED_AMOUNT', 500000, '2026-01-01', '2026-12-31', 100, 0, 'usr_mgr'],
    ]
    vchSheet.getRange(2, 1, vouchers.length, vouchers[0].length).setValues(vouchers)
    Logger.log('Seed VOUCHER: ' + vouchers.length)
  }

  SpreadsheetApp.getUi().alert('✅ Seed dev data hoàn tất!\n\nManager email: ' + MANAGER_EMAIL +
    '\n\nNếu chưa đổi email → sửa MANAGER_EMAIL trong gas_seed_dev.gs rồi xóa dòng USERS và chạy lại.')
}
