# LẠM MIÊN Studio — Tổng hợp dự án

> Cập nhật: 2026-06-27 · Trạng thái: **Phase 2 hoàn tất & đã deploy production**

Hệ thống web app quản lý vận hành studio ảnh đa cơ sở, thay thế quy trình nhập liệu thủ công trên Google Sheets.

---

## 1. Tech stack

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | **Next.js 15.5.19** (App Router, TypeScript) | CSS thuần — **không Tailwind** (design system theo PRD Section 15); pin 15.5.19 vá CVE-2025-66478 |
| API / backend | **Google Apps Script** (Web App) | 1 endpoint `/exec`, phân biệt qua `action`; luôn trả HTTP 200 + envelope `{ok,data|status,error}` |
| Database | **Google Sheets** (19 tab) | Bound với Apps Script project |
| Auth | **Google Identity Services** (id_token) — **redirect mode** | Verify token qua `tokeninfo`, map email → USERS |
| Hosting | **Vercel** (Git integration auto-deploy) | Domain `erp.lammienstudio.com` |

---

## 2. Hạ tầng & liên kết quan trọng

| Thành phần | Giá trị |
|---|---|
| **Web app (production)** | https://erp.lammienstudio.com |
| **GitHub repo** | https://github.com/letrunghoan152-cpu/lammien-erp |
| **Vercel project** | `lammien-erp` (team `lammienstudio-s-projects`) |
| **GAS Web App URL** | `https://script.google.com/macros/s/AKfycby9N_1vIr0cFQOpnDVFcHd8TtKD6-ttZWTdc_FWTeIhBGBseByP2Mqs1WDF1ACqtR-ZBg/exec` |
| **Apps Script project ID** | `1i9tGruhvngXIfGOHc4cqMc5Alxiglvr6SnpJxL0iemzPkQvb25Xf88Lq` |
| **Google Sheet (DB) ID** | `1dw60mjD8JNhNhePJy6hCZW20AcZigPTNY4Kc76PbExg` |
| **OAuth Client ID** | `631056678139-tk5mniou65g7ib6qqkr9g7r5fddsqime.apps.googleusercontent.com` |
| **GCP project** | `nice-virtue-498916-e8` ("My Project 94364") |
| **Tài khoản Google chủ** | `letrunghoan152@gmail.com` (Manager) |
| **Repo cũ giữ nguyên** | `lammienstudio` — webapp **chọn ảnh** (tích hợp qua webhook), **KHÔNG đụng tới** |

### Env vars (Vercel — cả production/preview/development)
- `NEXT_PUBLIC_GAS_URL` = GAS Web App URL ở trên
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = OAuth Client ID ở trên

### OAuth Client config
- **Authorized JavaScript origins:** `https://erp.lammienstudio.com`, `http://localhost:3000`
- **Authorized redirect URIs:** `https://erp.lammienstudio.com/api/auth/callback`, `http://localhost:3000/api/auth/callback`
- **Consent screen:** External, publishing status = **Testing** (chủ sở hữu vẫn đăng nhập được)

---

## 3. Trạng thái theo Phase (theo PRD Section 14)

| Phase | Module | Trạng thái |
|---|---|---|
| 1 | Sheets restructure + CSDL (19 tab, seed RBAC/settings/locations, auth, utils) | ✅ Hoàn tất |
| **2** | **Order Hub + Booking Form** | ✅ **Hoàn tất & deploy** |
| 3 | Phân quyền + Quản lý nhân sự (UI) | ⏳ Stub (router GAS có, trang frontend là placeholder) |
| 4 | Danh mục dịch vụ + Add-on + Voucher (quản lý) | ⏳ Stub (read đã có cho Booking Form) |
| 5 | Lương + Thưởng/Phạt | ⏳ Stub |
| 6 | Hậu kỳ Tracker + tích hợp webapp chọn ảnh | ⏳ Stub |
| 7 | Finance + Dashboard + CRM | ⏳ Stub |

---

## 4. Cấu trúc code

```
PRD_LamMien_Studio.md          # Spec gốc (nguồn chân lý nghiệp vụ)
PROJECT_STATUS.md              # File này

# ── Google Apps Script (.gs) — paste vào Apps Script editor ──────────
gas_setup.gs        # P1 — tạo 19 sheet + seed roles/permissions/settings/locations
gas_columns.gs      # P1 — hằng số index cột (COL.*)
gas_utils.gs        # P1 — envelope, cache, lock, id, history, notification
gas_auth.gs         # P1 — verify id_token, permission, strip field theo quyền
gas_Code.gs         # P1/P2 — doPost router + doGet (kèm one-time init) + webhook + notifications
gas_workflow.gs     # P2 — map 14 trạng thái + allowed_transitions
gas_orders.gs       # P2 — orders.* (list/get/create/update/status/HK/raw/addon/history)
gas_customers.gs    # P2 — customers.* (search/get/upsert)
gas_calendar.gs     # P2 — calendar.getDay/checkConflict + staff.available
gas_catalog.gs      # P2 — services/addons/vouchers/locations .list (read cho form)
gas_seed_dev.gs     # Seed Manager + dữ liệu mẫu (đã chạy)

# ── Next.js frontend ─────────────────────────────────────────────────
app/
  globals.css                    # Design system (token + class chung)
  layout.tsx, page.tsx
  login/page.tsx                 # Đăng nhập Google (redirect mode)
  api/auth/callback/route.ts     # Nhận credential redirect từ Google → lưu token → /orders
  (dashboard)/
    layout.tsx                   # Guard + app shell (sidebar + main)
    orders/page.tsx              # Order Hub (danh sách + lọc + phân trang)
    orders/new/page.tsx          # Booking Form (multi-concept, validation)
    orders/[id]/page.tsx         # Chi tiết đơn + status transition
    {dashboard,calendar,hau-ky,finance,catalog,crm,salary,users,settings}  # placeholder
components/   # Avatar, StatusPill, Modal, Lightbox, Sidebar, Toast, AuthProvider, ...
lib/          # gasApi, auth (GIS), cache, format, status, types, roles, booking, useGasData
```

---

## 5. GAS API — endpoint đã implement (Phase 2)

**Đầy đủ:** `auth.verify` · `settings.get/update` · `orders.list/get/create/update/updateStatus/updateStatusHK/overrideDeliveryType/uploadRawLink/addMuaAddon/history` · `customers.search/get/upsert` · `calendar.getDay/checkConflict` · `staff.available` · `services.list` · `addons.list/listMuaProducts` · `vouchers.list` · `locations.list` · `notifications.list/markRead`

**Stub (Phase 3–7):** `services.upsert`, `addons.upsert`, `vouchers.upsert/apply`, `hauky.*`, `albums.*`, `shipping.*`, `finance.*`, `salary.*`, `bonus_penalty.upsert`, `users.*`, `roles.*`, `permissions.update`

**Webhook (machine-to-machine):** `webhook/photo-selected`, `webhook/photo-approved` (verify bằng `webhook_secret` trong SETTINGS — **hiện đang rỗng, cần đặt khi tích hợp webapp chọn ảnh**)

---

## 6. Luồng đăng nhập (redirect mode)

```
Nút "Đăng nhập bằng Google" (GIS, ux_mode: redirect)
  → chuyển hẳn sang accounts.google.com → user đăng nhập + 2FA
  → Google POST { credential, g_csrf_token } tới /api/auth/callback
  → route handler: kiểm tra g_csrf_token (double-submit) → lưu id_token vào sessionStorage → redirect /orders
  → AuthProvider trên /orders đọc token → gọi auth.verify → có user+permissions → render
```

> **Vì sao redirect thay vì popup:** popup trả credential qua `window.postMessage` bị COOP của `accounts.google.com` chặn; One Tap cần FedCM (nhiều trình duyệt tắt). Redirect không dính cả hai → chạy mọi trình duyệt. Trang cũng set header `Cross-Origin-Opener-Policy: same-origin-allow-popups`.

**Tài khoản đăng nhập được (seed mẫu):** Manager = `letrunghoan152@gmail.com`. Các role khác seed email mẫu (`sale@/photo@/mua@/hauky@/support@example.com`) — đổi sang email Google thật trong sheet USERS khi thêm nhân sự thật.

---

## 7. Dữ liệu mẫu đã seed (gas_seed_dev.gs)

- **USERS:** 6 tài khoản (manager/sale/photographer/mua/hau_ky/support)
- **LOCATIONS:** `loc_001` (Cơ sở 1), `loc_002` (Cơ sở 2)
- **SERVICE_CATALOG:** Family Outdoor, Portrait Studio, Wedding Album
- **ADDON_CATALOG:** In ảnh 20x30 (PRINT), Làm nail / Lens mắt (MUA_PRODUCT), Hoa cầm tay (GOODS)
- **VOUCHER:** `CONCEPT2_20` (-20%), `GIAM500K` (-500k)
- + ROLES, ROLE_PERMISSIONS, SETTINGS (seed bởi setupAll)

---

## 8. Nhật ký triển khai & sự cố đã xử lý

1. **Môi trường:** cài Node (Homebrew, chỉ trên `/opt/homebrew/bin`), npm.
2. **Bảo mật Next:** nâng `next` 15.1.6 → **15.5.19** (vá CVE-2025-66478).
3. **GitHub:** cài `gh`, đăng nhập, **force-push thay thế hoàn toàn** repo `lammien-erp` (ERP cũ Supabase đã bị thay); repo `lammienstudio` (webapp chọn ảnh) giữ nguyên.
4. **Vercel:** repo đã nối Git integration → push tự động deploy; set 2 env var; domain `erp.lammienstudio.com` đã gắn sẵn.
5. **GAS deploy (qua clasp):** bật Apps Script API → `clasp create --type sheets` (tạo Sheet + script) → push 12 file → deploy Web App (execute as me / anyone) → cấp quyền OAuth scopes (spreadsheets, external_request, scriptapp) → chạy `setupAll`+`seedDevData` headless qua `doGet ?init=...`.
6. **OAuth:** Google Cloud bật bắt buộc 2SV (24/06/2026) → user bật 2SV → cấu hình consent screen (External) + tạo OAuth Client (Web) + JS origins.
7. **Bug "kẹt màn login":** nguyên nhân COOP chặn `postMessage` của popup + FedCM bị tắt → **chuyển sang redirect mode** (`/api/auth/callback` + redirect URIs + header COOP). Đây là trạng thái hiện tại.

**Git history:** `e791f00` (Phase 2) → `90c8e14` (COOP/FedCM fix) → `c0705dc` (redirect mode).

---

## 9. Quy trình cập nhật về sau

**Sửa frontend (Next.js):**
```bash
# trong thư mục dự án
npm run build          # kiểm tra lỗi TS
git add -A && git commit -m "..." && git push    # Vercel tự deploy
# hoặc deploy tay: vercel --prod
```

**Sửa backend GAS:** sửa file `gas_*.gs` local → push qua clasp → tạo version deploy mới:
```bash
# thư mục clasp: /Users/macbook/Documents/lammien-gas-deploy  (đã link sẵn .clasp.json)
cp gas_*.gs /Users/macbook/Documents/lammien-gas-deploy/   # nếu sửa ở repo chính
cd /Users/macbook/Documents/lammien-gas-deploy
clasp push --force
clasp create-deployment --description "..."     # tạo version mới
# LƯU Ý: Web App URL gắn với deployment. Nếu muốn giữ nguyên URL, dùng:
#   clasp redeploy <DEPLOYMENT_ID> --description "..."   (cập nhật deployment hiện tại)
```
> Nếu thêm scope mới trong code GAS → cần cấp quyền lại (mở `/exec` bằng tài khoản chủ và Authorize).

**Chạy lại khởi tạo dữ liệu (nếu cần):** `GET <GAS_URL>/exec?init=lammien_init_8472` (one-time; an toàn — chỉ seed khi sheet rỗng).

---

## 10. Việc còn lại / Next steps

- [ ] **Xác nhận đăng nhập production** chạy thông (test cuối cùng phía user).
- [ ] Đặt `webhook_secret` trong sheet SETTINGS trước khi nối webapp chọn ảnh.
- [ ] Cập nhật LOCATIONS (tên/địa chỉ/SĐT thật) và thêm USERS thật (email Google của nhân sự).
- [ ] Cân nhắc **Publish app** trên OAuth consent khi mở cho nhiều người (hiện Testing — chủ vẫn dùng được).
- [ ] (Tùy chọn) Giữ đăng nhập quá 1 giờ: thêm cơ chế session/refresh token (đã có ý tưởng từ các file patch tham khảo, chưa áp).
- [ ] **Phase 3–7:** phân quyền UI, danh mục quản lý, lương, hậu kỳ/album/shipping, finance/dashboard/CRM.

---

## 11. Lưu ý bảo mật

- GAS tự verify `id_token` qua Google `tokeninfo` + check USERS — **không tin frontend**; phân quyền theo ROLE_PERMISSIONS; `role.manage`/`role.create` hard-check chỉ Manager.
- `/api/auth/callback` kiểm tra `g_csrf_token` (double-submit cookie) chống CSRF.
- `webhook_secret` dùng cho webhook M2M (chưa đặt).
- `.env.local`, `.vercel`, `node_modules`, `.next` đều đã gitignore — **không commit secret**.
- `INIT_KEY` (`lammien_init_8472`) trong `gas_Code.gs` chỉ để chạy setup 1 lần; có thể xoá nhánh init trong `doGet` sau khi đã khởi tạo xong.
```
