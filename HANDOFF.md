# LẠM MIÊN Studio — HANDOFF (tiếp tục ở chat mới)

> Cập nhật: 2026-06-28 · Đọc file này + `PRD_LamMien_Studio.md` là nắm toàn bộ. Mở chat mới, dán đường dẫn file này để tiếp tục.

Hệ thống quản lý vận hành studio ảnh đa cơ sở. **Next.js (Vercel) + Google Apps Script + Google Sheets + Google OAuth (GIS redirect).** CSS thuần, tông olive, **không Tailwind**.

---

## 1. Trạng thái hiện tại

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 1 | Sheets + CSDL (19 tab, RBAC seed, auth, utils) | ✅ |
| 2 | Order Hub + Booking Form | ✅ deploy |
| 3 | Phân quyền (RBAC) + Nhân sự + Cơ sở + Cài đặt | ✅ deploy |
| **4** | **Danh mục dịch vụ + Add-on + Voucher (quản lý)** | ✅ code (chờ deploy) |
| **5** | **Lương + Thưởng/Phạt** | ✅ code (chờ deploy) |
| 6 | Hậu kỳ Tracker + tích hợp webapp chọn ảnh | ⏳ stub |
| 7 | Finance + Dashboard + CRM | ⏳ stub |

**Đã chạy production**, đăng nhập OK cho mọi nhân sự. Việc tiếp theo: **Phase 6**.

### Mới (chat này, chưa deploy lúc viết — build & syntax-check OK)
- **Sửa "hết phiên đăng nhập"** (2 nguyên nhân):
  1. Google id_token chỉ sống 1h, không refresh → GAS giờ đổi id_token lấy **session token HMAC sống 7 ngày, tự gia hạn trượt** (`gas_auth.gs`: `mintSessionToken/verifySessionToken`; secret tự sinh & lưu ở Script Property `SESSION_SECRET`). Token mới đẩy về client qua `envelope.session`; client lưu ở **localStorage** (`lib/auth.ts` `getAuthToken/getStoredSession/hasCredential`, `lib/gasApi.ts`).
  2. `invalidateCache('all')` gọi `sessionStorage.clear()` → **xoá luôn token** → báo hết phiên ngay sau khi lưu. Đã đổi để chừa key `lm_session`/`gis_id_token` (`lib/cache.ts`).
- **Phase 4**: `gas_catalog_manage.gs` — `catalog.manageList` · `services.upsert` · `addons.upsert` · `vouchers.upsert` · `vouchers.apply` (mặc định chỉ báo giá; `commit=true` mới tăng `used_count` trong LockService — **orders.create chưa tự tăng used_count**). UI `app/(dashboard)/catalog/page.tsx` (3 tab).
- **Phase 5**: `gas_salary.gs` — `salary.list` (tính live theo kỳ) · `salary.compute` (snapshot+khoá vào SALARY) · `bonus_penalty.list/upsert`. Lương theo PRD §9 (concept hệ số 1.0/0.5, hậu kỳ rate×file, add-on theo commission_role, thưởng−phạt). UI `app/(dashboard)/salary/page.tsx`. **Lưu ý**: kỳ = tháng `shoot_date`; chỉ tính đơn `STATUS_ORDER_INDEX>=4` & ≠HUY.

---

## 2. Hạ tầng & liên kết (QUAN TRỌNG — cần để vận hành/deploy)

| Mục | Giá trị |
|---|---|
| Web app | https://erp.lammienstudio.com |
| GitHub | https://github.com/letrunghoan152-cpu/lammien-erp (HEAD `c7a893a`) |
| Vercel project | `lammien-erp` (team `lammienstudio-s-projects`) — Git integration auto-deploy |
| **GAS Web App URL** (`/exec`) | `https://script.google.com/macros/s/AKfycby9N_1vIr0cFQOpnDVFcHd8TtKD6-ttZWTdc_FWTeIhBGBseByP2Mqs1WDF1ACqtR-ZBg/exec` |
| **GAS deployment ID** (để `clasp redeploy` giữ nguyên URL) | `AKfycby9N_1vIr0cFQOpnDVFcHd8TtKD6-ttZWTdc_FWTeIhBGBseByP2Mqs1WDF1ACqtR-ZBg` (đang `@5`) |
| Apps Script project ID | `1i9tGruhvngXIfGOHc4cqMc5Alxiglvr6SnpJxL0iemzPkQvb25Xf88Lq` |
| Google Sheet (DB) ID | `1dw60mjD8JNhNhePJy6hCZW20AcZigPTNY4Kc76PbExg` |
| OAuth Client ID | `631056678139-tk5mniou65g7ib6qqkr9g7r5fddsqime.apps.googleusercontent.com` |
| GCP project | `nice-virtue-498916-e8` ("My Project 94364") |
| Tài khoản chủ / Manager | `letrunghoan152@gmail.com` |
| Thư mục Next.js (local) | `/Users/macbook/Documents/LammienStudio_ManagerApp` |
| Thư mục clasp (local, đã link) | `/Users/macbook/Documents/lammien-gas-deploy` |
| INIT_KEY (cho `?init` / `?keepalive`) | `lammien_init_8472` |
| Repo **KHÔNG đụng tới** | `lammienstudio` (webapp chọn ảnh, tích hợp qua webhook) |

**Env vars Vercel (cả 3 môi trường):** `NEXT_PUBLIC_GAS_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

**OAuth:** consent screen **In production** (published) → mọi tài khoản Google qua được bước đăng nhập; GAS chặn người ngoài theo bảng USERS. Auth dùng **GIS redirect mode** → POST credential về `/api/auth/callback`. Keep-alive trigger **1 phút** đang chạy (hết cold start).

---

## 3. Lệnh deploy (đã có sẵn môi trường)

> ⚠️ **Node chỉ nằm ở `/opt/homebrew/bin`** — mọi lệnh phải `export PATH="/opt/homebrew/bin:$PATH"` trước.

**Frontend (Next.js):**
```bash
cd /Users/macbook/Documents/LammienStudio_ManagerApp
export PATH="/opt/homebrew/bin:$PATH"
npm run build                                  # kiểm tra TS
git add -A && git commit -m "..." && git push  # Vercel tự deploy
# hoặc deploy tay: vercel --prod --yes
```

**Backend (GAS) — giữ NGUYÊN /exec URL:**
```bash
export PATH="/opt/homebrew/bin:$PATH"
cp /Users/macbook/Documents/LammienStudio_ManagerApp/gas_*.gs /Users/macbook/Documents/lammien-gas-deploy/
cd /Users/macbook/Documents/lammien-gas-deploy
clasp push --force
clasp redeploy AKfycby9N_1vIr0cFQOpnDVFcHd8TtKD6-ttZWTdc_FWTeIhBGBseByP2Mqs1WDF1ACqtR-ZBg -d "mô tả"
```
- Syntax-check trước: copy `gas_X.gs` → `gas_X.js` rồi `node --check`.
- Nếu **thêm scope GAS mới** → mở `/exec` bằng tài khoản chủ, Authorize lại.
- Chạy lại khởi tạo (nếu cần): `GET <GAS_URL>?init=lammien_init_8472`.

---

## 4. Cấu trúc code

```
PRD_LamMien_Studio.md   # Spec gốc (nghiệp vụ — nguồn chân lý)
HANDOFF.md              # File này

# GAS backend (.gs) — paste vào Apps Script / push qua clasp
gas_setup.gs       gas_columns.gs   gas_utils.gs   gas_auth.gs
gas_Code.gs        # doPost router + doGet(?init/?keepalive) + webhook + notifications + keepAlive
gas_workflow.gs    # 14 trạng thái + getAllowedTransitions
gas_orders.gs      gas_customers.gs  gas_calendar.gs
gas_catalog.gs     # services/addons/vouchers/locations .list + bootstrap (cache)
gas_admin.gs       # Phase 3: users/roles/permissions/locations.upsert + PERMISSION_CATALOG
gas_seed_dev.gs    # seed Manager + dữ liệu mẫu (đã chạy)

# Next.js
app/
  globals.css                       # design system (token + class)
  login/page.tsx                    # GIS redirect mode
  api/auth/callback/route.ts        # nhận credential redirect → lưu token → /orders
  (dashboard)/layout.tsx            # guard + shell
  (dashboard)/orders/{page,[id]/page,new/page}.tsx
  (dashboard)/users/page.tsx        # Phase 3 — Nhân sự/Phân quyền/Cơ sở
  (dashboard)/settings/page.tsx     # Phase 3 — Cài đặt
  (dashboard)/{dashboard,calendar,hau-ky,finance,catalog,crm,salary}/page.tsx  # placeholder
components/  components/orders/{OrderSlidePanel,OrderTimeline,OrderActions}.tsx  + Avatar/StatusPill/Modal/Lightbox/Sidebar/Toast/AuthProvider/...
lib/  gasApi auth cache config format status types roles booking orderFlow useBootstrap useGasData
```

---

## 5. GAS endpoint

**Đã implement đầy đủ:** `auth.verify` · `settings.get/update` · `bootstrap` · `orders.list/get/create/update/updateStatus/updateStatusHK/overrideDeliveryType/uploadRawLink/addMuaAddon/history` · `customers.search/get/upsert` · `calendar.getDay/checkConflict` · `staff.available` · `services.list` · `addons.list/listMuaProducts` · `vouchers.list` · `locations.list/upsert` · `users.list/upsert` · `roles.list/upsert` · `permissions.update` · `notifications.list/markRead`

**Còn STUB (làm ở Phase 4–7):** `services.upsert` · `addons.upsert` · `vouchers.upsert/apply` · `hauky.list/update/notifyReady` · `albums.list/upsert` · `shipping.list/update` · `finance.income/expense/debt` · `salary.list/compute` · `bonus_penalty.upsert`

> **Phase 4 cần làm:** `services.upsert` (kèm cover/sample photo + lương mặc định), `addons.upsert`, `vouchers.upsert`, `vouchers.apply` (increment used_count với LockService) → bỏ stub trong `gas_Code.gs`, viết trong file mới (vd `gas_catalog_manage.gs`) + UI trang `/catalog` (đang placeholder). Nhớ gọi `invalidateBootstrap()` sau khi sửa danh mục.

---

## 6. Quy ước & "bẫy" đã biết (đọc kỹ kẻo mất thời gian)

- **GAS luôn trả HTTP 200**; lỗi nằm trong body `{ok:false,status,error}`. Client `lib/gasApi.ts` đọc body, không đọc HTTP status. CORS đã OK (`access-control-allow-origin:*`).
- **Optimistic locking:** mọi `orders.update*` gửi `version`; lệch → 409 → toast + reload.
- **Strip field theo quyền:** `order.view_financial` (ẩn tài chính), `salary.manage_config` (ẩn lương mặc định dịch vụ), `addon.view_cost_price` (ẩn giá nhập).
- **Quyền cache theo phiên** (sessionStorage + GAS CacheService 5'): đổi phân quyền → có hiệu lực khi user đăng nhập lại / refresh.
- **`clasp redeploy <ID>`** (không phải `create-deployment`) để giữ nguyên `/exec` URL. `everyMinutes()` chỉ nhận 1/5/10/15/30.
- **Next pin `15.5.19`** (vá CVE-2025-66478) — đừng hạ.
- **Browser automation trên trang Google (script.google.com, console.cloud.google.com):** screenshot/read_page hay timeout (document_idle) → dùng `javascript_tool`. Nút Material đôi khi cần `element.click()` (JS) thay vì click toạ độ; chip/checkbox cần set value bằng native setter + dispatch event, hoặc trusted CDP click. Toạ độ map 1:1 với CSS px trên console.
- **Workflow thật 14 trạng thái** (không phải 6): xem `gas_workflow.gs` TRANSITIONS + `lib/orderFlow.ts` PIPELINE. UI đổi trạng thái dùng `allowed_transitions` động (đừng hardcode).
- **Design system:** chỉ dùng `var(--…)` + class trong `globals.css` (PRD Section 15). Tông olive `--brand #6d8150`.

---

## 7. Dữ liệu mẫu (đã seed — `gas_seed_dev.gs`)
USERS: manager(`letrunghoan152@gmail.com`)+sale/photographer/mua/hau_ky/support(email mẫu). LOCATIONS: loc_001/loc_002. SERVICE_CATALOG: Family Outdoor / Portrait Studio / Wedding Album. ADDON: In ảnh 20x30(PRINT), Nail/Lens(MUA_PRODUCT), Hoa(GOODS). VOUCHER: CONCEPT2_20(-20%), GIAM500K(-500k).

---

## 8. Việc còn lại
- [ ] **Deploy Phase 4-5 + fix session**: push GAS (`clasp push --force` + `redeploy`) và git push frontend. Backward-compatible (deploy thứ tự nào trước cũng OK). Không thêm scope mới (PropertiesService/Utilities không cần authorize lại).
- [ ] Phase 6: Hậu kỳ/Album/Shipping + webhook chọn ảnh (đặt `webhook_secret` trong SETTINGS). Khi đó `salary` mới có `hk_file_total` (cần HAU_KY_TASK status DONE + photo_count).
- [ ] (tuỳ) Tăng `VOUCHER.used_count` ngay trong `orders.create` để enforce `max_uses` ở lúc tạo đơn (hiện chỉ `vouchers.apply?commit=true`).
- [ ] Phase 7: Finance + Dashboard + CRM.
- [ ] Cập nhật thông tin thật: LOCATIONS (địa chỉ/SĐT), thêm USERS nhân sự thật.

---

## 9. Lịch sử commit gần đây
`e791f00` Phase 2 → `90c8e14` fix COOP/FedCM → `c0705dc` redirect-mode auth → `e9243cf` perf (keepalive+bootstrap+SWR) → `7e4e96e` instant transition → `b2cc3f2` redesign Orders (panel+timeline) → `c7a893a` **Phase 3 (HEAD)**.
