# Studio LẠM MIÊN — Hệ thống quản lý

Web app quản lý vận hành studio ảnh đa cơ sở. **Frontend:** Next.js (App Router, TypeScript, CSS thuần — không Tailwind). **Backend:** Google Apps Script + Google Sheets. **Auth:** Google OAuth (id_token).

> Trạng thái: **Phase 2 hoàn tất** — Order Hub + Booking Form. Xem [Phạm vi](#phạm-vi-theo-phase).

---

## 1. Cấu trúc thư mục

```
PRD_LamMien_Studio.md         # Spec gốc (nguồn chân lý nghiệp vụ)

# ── Google Apps Script backend (.gs) ──────────────────────────────
gas_setup.gs        # Phase 1 — tạo 19 sheet + seed roles/permissions/settings/locations
gas_columns.gs      # Phase 1 — hằng số index cột (COL.*)
gas_utils.gs        # Phase 1 — envelope, cache, lock, id, history, notification
gas_auth.gs         # Phase 1 — verify id_token, permission, field-stripping
gas_Code.gs         # Phase 1 — doPost router + auth/settings/webhook/notifications
gas_workflow.gs     # Phase 2 — map trạng thái + allowed_transitions
gas_orders.gs       # Phase 2 — orders.* (list/get/create/update/status/raw/addon/history)
gas_customers.gs    # Phase 2 — customers.* (search/get/upsert)
gas_calendar.gs     # Phase 2 — calendar.getDay / checkConflict / staff.available
gas_catalog.gs      # Phase 2 — services/addons/vouchers/locations .list (read cho form)
gas_seed_dev.gs     # Tuỳ chọn — seed Manager + dữ liệu mẫu để test ngay

# ── Next.js frontend ──────────────────────────────────────────────
app/
  globals.css                 # Design system (PRD Section 15) — token + class chung
  layout.tsx, page.tsx        # Root + điều hướng
  login/page.tsx              # Đăng nhập Google
  (dashboard)/
    layout.tsx                # Guard + app shell (sidebar + main)
    orders/page.tsx           # Order Hub (danh sách + lọc + phân trang)
    orders/new/page.tsx       # Booking Form (multi-concept, validation)
    orders/[id]/page.tsx      # Chi tiết đơn + status transition
    {calendar,hau-ky,...}     # Placeholder các module Phase 3–7
components/                   # Avatar, StatusPill, Modal, Lightbox, Sidebar, Toast…
lib/                          # gasApi, auth (GIS), cache, format, status, types, hooks
```

---

## 2. Cài đặt Backend (Google Apps Script)

1. Mở [script.google.com](https://script.google.com) → tạo project gắn với 1 Google Sheet mới.
2. Tạo các file `.gs` tương ứng và **paste nội dung từng file `gas_*.gs`** vào (giữ nguyên tên hoặc gộp tùy ý — tất cả dùng chung global scope).
3. Chạy hàm **`setupAll`** một lần → tạo 19 tab + seed roles/permissions/settings/locations.
4. (Khuyến nghị để test) Sửa `MANAGER_EMAIL` trong `gas_seed_dev.gs` thành email Google của bạn → chạy **`seedDevData`** để có tài khoản Manager + dịch vụ/add-on/voucher mẫu.
5. Vào **SETTINGS** sheet → đặt `webhook_secret` (chuỗi bí mật cho webhook chọn ảnh).
6. **Deploy** → New deployment → *Web app*:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy **Web App URL**.
7. (Khuyến nghị) Chạy **`setupKeepAlive`** một lần để tạo trigger chống cold start (ping mỗi 4 phút).

> Mọi `write` đều dùng `LockService`; auth verify id_token qua Google `tokeninfo` (cache 5 phút); GAS luôn trả HTTP 200 với envelope `{ ok, data | status, error }`.

## 3. Cài đặt Frontend (Next.js)

```bash
npm install
cp .env.local.example .env.local      # rồi điền 2 biến bên dưới
npm run dev                            # http://localhost:3000
```

`.env.local`:
```
NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/XXXX/exec
NEXT_PUBLIC_GOOGLE_CLIENT_ID=XXXX.apps.googleusercontent.com
```

**Google OAuth Client ID** (Google Cloud Console → Credentials → OAuth client ID → *Web application*):
- *Authorized JavaScript origins*: `http://localhost:3000` (+ domain production).

Build production: `npm run build && npm start`.

---

## 4. Phạm vi theo Phase

| Phase | Trạng thái | Nội dung |
|---|---|---|
| 1 | ✅ | Sheets restructure + CSDL (19 tab, RBAC seed, auth, utils) |
| **2** | ✅ **(bản này)** | **Order Hub + Booking Form**: orders/customers/calendar backend, danh mục read, app shell, đăng nhập, danh sách/chi tiết/tạo đơn, status transition, raw link, moodboard |
| 3–7 | ⏳ stub | Phân quyền UI, danh mục manage, lương, hậu kỳ, finance, dashboard, CRM (router GAS đã có stub; trang frontend là placeholder) |

### Endpoint GAS đã implement đầy đủ ở Phase 2
`orders.list/get/create/update/updateStatus/updateStatusHK/overrideDeliveryType/uploadRawLink/addMuaAddon/history` · `customers.search/get/upsert` · `calendar.getDay/checkConflict` · `staff.available` · `services.list` · `addons.list/listMuaProducts` · `vouchers.list` · `locations.list` (bổ sung).

### Đã tuân thủ PRD
- Multi-concept + voucher concept 2+ bắt buộc; tổng đơn theo Section 7.4; `delivery_type` tự tính + lock sau LÊN LỊCH.
- Double-booking xuyên cơ sở cho Photographer/MUA/Support (Hậu Kỳ được miễn).
- Optimistic locking qua `version` → 409; optimistic UI + rollback; field-stripping tài chính/lương theo quyền.
- Audit log `ORDER_HISTORY`; notification `STAFF_ASSIGNED`/`RAW_UPLOADED` (dedup).
- Design system Section 15: token CSS, `.card/.btn/.input/.pill/.modal/.toast/.shimmer`, avatar initials, lightbox, responsive sidebar.
