# PRD — Hệ thống Quản lý Studio LẠM MIÊN
**Phiên bản:** 1.1  
**Ngày:** 2026-06-26  
**Loại hình:** Studio chụp ảnh chân dung & gia đình — đa cơ sở (hiện tại: 2)  
**Database:** Google Sheets (via Google Sheets API + Apps Script)  
**Frontend:** React / Next.js  

---

## 1. Tổng quan

Hệ thống web app quản lý toàn bộ vận hành studio, thay thế quy trình nhập liệu thủ công trên Google Sheets. Dữ liệu vẫn lưu trên Google Sheets làm backend, frontend là React app kết nối qua Google Apps Script API.

### Mục tiêu
- Chuẩn hóa quy trình từ booking đến giao hàng
- Sắp xếp công việc từng nhân sự đầy đủ và chi tiết, dễ dàng thao tác và theo dõi
- Phân quyền truy cập theo vai trò nhân sự
- Tự động tính lương theo đầu việc
- Track tài chính: doanh thu, chi phí, lợi nhuận từng đơn — theo cơ sở và tổng hợp
- Quản lý đa cơ sở: lịch, nhân sự, tài chính tách biệt hoặc tổng hợp theo nhu cầu

---

## 2. Nhân sự & Vai trò

| Vai trò | Mô tả |
|---|---|
| **Quản lý (Manager)** | Full access toàn hệ thống |
| **Sale** | Tạo đơn, booking, CRM, thấy lương của mình |
| **Marketing** | CRM, báo cáo nguồn khách |
| **Photographer** | Lịch chụp được assign, đơn của mình, lương của mình |
| **Makeup Artist (MUA)** | Lịch làm được assign, đơn của mình, quản lý MUA Products, lương của mình |
| **Hậu Kỳ (Editor)** | Quản lý album, theo dõi tiến độ hậu kỳ, nhận và bàn giao file ảnh |
| **Support** | Xem lịch chụp toàn hệ thống, theo dõi tiến độ hậu kỳ và album, giao hàng và theo dõi tiến độ ship ảnh đến nhà khách |

---

## 3. Workflow & Trạng thái đơn hàng

### 3.1 Luồng chính

```
TIẾP NHẬN → BÁO GIÁ → ĐẶT CỌC → LÊN LỊCH ⇄ TẠM DỪNG → ĐÃ CHỤP+THU TIỀN → CHỌN ẢNH → HẬU KỲ → DUYỆT ẢNH (KH)
                                      ↓                                                                        ↓
                                     HỦY                                              [Gói digital]    [Gói có in ấn]
                                                                                           ↓                   ↓
                                                                                     GIAO FILE       CHỜ IN → SHIP → GIAO HÀNG
```

### 3.2 Mô tả từng trạng thái

| Trạng thái | Mô tả | Người thực hiện |
|---|---|---|
| **TIẾP NHẬN** | Khách liên hệ qua Facebook/Instagram | Sale |
| **BÁO GIÁ** | Đã báo giá, tạo đơn (form validation) | Sale |
| **ĐẶT CỌC** | Khách đã đặt cọc | Sale |
| **LÊN LỊCH** | Đã xác nhận lịch chụp | Sale / Manager |
| **TẠM DỪNG** | Dời lịch (sự cố kỹ thuật, thời tiết) | Manager |
| **ĐÃ CHỤP + THU TIỀN** | Buổi chụp hoàn tất. Thu tiền còn lại → Sale/Manager đối soát xác nhận | Photographer (chụp) + Sale/Manager (đối soát thu tiền) |
| **CHỌN ẢNH** | KH chọn ảnh raw trên webapp. Khi xong, webapp hiển thị xác nhận "Đã chọn ảnh xong" → Hậu Kỳ nhận thông báo tự động trên web app | KH tự thao tác (webapp) |
| **HẬU KỲ** | Hậu kỳ edit ảnh đã được KH chọn (nội bộ hoặc outsource) | Hậu Kỳ được assign |
| **DUYỆT ẢNH** | KH xem lại ảnh đã edit và duyệt trên webapp chọn ảnh | KH tự thao tác (webapp) |
| **GIAO FILE** | Giao file digital qua Drive (gói không có in ấn) — đơn hoàn tất | Support / Hậu Kỳ |
| **CHỜ IN** | Gói có in ấn: file đang được gửi đi in | Hậu Kỳ |
| **ĐANG GIAO** | Sản phẩm in xong, đang ship đến khách (có mã vận đơn) | Support |
| **GIAO HÀNG** | Đã giao toàn bộ sản phẩm in ấn + thu tiền còn lại — đơn hoàn tất | Support |
| **HỦY** | Hủy (xem 3.3) | Manager |

### 3.3 Trạng thái hủy

| Loại hủy | Nguyên nhân | Hoàn cọc | Lương |
|---|---|---|---|
| `HỦY_KHÁCH` | KH chủ động hủy | Không | = 0 |
| `HỦY_BẤT_KHẢ_KHÁNG` | Thời tiết, thiết bị, bất khả kháng | Có | = 0 |

> Kỹ thuật: 1 trạng thái `HỦY` + field `cancel_reason` (enum: `customer` \| `force_majeure`). Logic hoàn cọc tự động theo reason.

### 3.4 Rule lương theo trạng thái

| Trạng thái đơn | Lương được tính? |
|---|---|
| Đã ĐÃ CHỤP + THU TIỀN | ✅ Luôn được tính (thu tiền bắt buộc sau khi chụp) |
| TẠM DỪNG (dời lịch) | ⏳ Chưa tính, chờ chụp lại |
| HỦY (bất kỳ loại) | ❌ Không tính lương concept |

**Rule lương add-on khi đơn bị huỷ:**

| Loại add-on | Trạng thái khi huỷ | Lương |
|---|---|---|
| `MUA_PRODUCT` (nails, lens...) | Dịch vụ đã thực hiện trước khi huỷ | ✅ MUA vẫn nhận lương khoán — đã làm rồi |
| `MUA_PRODUCT` | Dịch vụ chưa thực hiện | ❌ Không tính |
| `PRINT` | Chưa gửi đi in | ❌ Sale không có commission |
| `PRINT` | Đã gửi đi in (đơn vị in đã nhận) | ✅ Xử lý theo thực tế, Manager quyết định |

> Để xác định "đã thực hiện chưa", hệ thống dùng trạng thái đơn: nếu đơn đã qua ĐÃ CHỤP thì MUA_PRODUCT coi là đã thực hiện.

---

## 4. Đa Cơ Sở

### 4.1 Nguyên tắc thiết kế

Hệ thống **không giới hạn số cơ sở**. "2 cơ sở" là trạng thái hiện tại, không phải giới hạn kỹ thuật.

Khi mở thêm cơ sở mới: Manager vào phần Cài đặt → thêm 1 dòng vào bảng LOCATIONS. Toàn bộ hệ thống (dropdown chọn cơ sở, bộ lọc calendar, báo cáo tài chính) **tự động cập nhật** vì đều đọc dữ liệu từ bảng này, không hardcode tên cơ sở ở bất kỳ đâu trong code.

> **Yêu cầu với developer:** Mọi chỗ cần chọn hoặc lọc theo cơ sở phải đọc dynamic từ bảng LOCATIONS — không được viết cứng "Cơ sở 1", "Cơ sở 2" vào code.

### 4.2 Data model

```
LOCATION
 ├── location_id
 ├── name           (vd: "Cơ sở Quận 1", "Cơ sở Bình Thạnh")
 ├── address
 ├── phone
 └── is_active      (boolean — ẩn cơ sở tạm đóng mà không xóa dữ liệu)
```

### 4.3 Ảnh hưởng lên các module

| Module | Thay đổi |
|---|---|
| **Đơn hàng** | Mỗi đơn thuộc 1 cơ sở (`location_id`) — bắt buộc chọn khi tạo |
| **Calendar** | Lọc lịch theo cơ sở. Mỗi cơ sở có slot riêng, tránh double-booking độc lập |
| **Nhân sự** | Mỗi nhân sự có `location_ids[]` — danh sách cơ sở được phép làm việc. Có thể là 1 hoặc nhiều cơ sở |
| **Tài chính** | Dashboard xem riêng từng cơ sở hoặc tổng hợp cả 2 |
| **Chi phí** | Chi phí gắn với `location_id` để tính lợi nhuận đúng theo cơ sở |
| **Lương** | Tính theo đơn được assign, không phân biệt cơ sở |

### 4.4 Nhân sự làm nhiều cơ sở

```
USERS
 ├── user_id
 ├── name
 ├── email              (Google account — dùng để map OAuth token)
 ├── role_id            (FK → ROLES)
 ├── location_ids       (danh sách cơ sở — lưu dạng chuỗi phân cách phẩy: "loc_001,loc_002")
 ├── default_location_id  (cơ sở hiển thị mặc định khi đăng nhập vào Calendar)
 ├── is_active          (boolean)
 │
 ├── [Cấu hình lương — tách thành cột riêng, không dùng JSON blob]
 ├── base_salary              (lương cứng tháng, nullable = không có lương cứng)
 ├── concept_rate_type        (FIXED | PERCENT | null = dùng default từ SERVICE_CATALOG)
 │                             Áp dụng cho: Photographer, MUA, Support, Sale
 ├── concept_rate_value       (giá trị tương ứng type, null = dùng default từ SERVICE_CATALOG)
 │                             Áp dụng cho: Photographer, MUA, Support, Sale
 └── hau_ky_rate_per_file     (VND/file — override per-person cho Hậu Kỳ, null = dùng SERVICE_CATALOG.default_hau_ky_rate_per_file)
```

**Quy ước lưu trữ mảng trong Google Sheets:**
```
location_ids  → chuỗi phân cách phẩy: "loc_001,loc_002"
GAS parse:      row.location_ids.split(',').filter(Boolean)
GAS serialize:  ids.join(',')
```
Áp dụng cho mọi field dạng array trong toàn bộ hệ thống.

**Rule double-booking xuyên cơ sở:**

> Khi assign nhân sự vào 1 đơn, hệ thống kiểm tra toàn bộ đơn của người đó **ở tất cả cơ sở** trong cùng khung giờ — không chỉ cơ sở hiện tại.

> **⚠️ Quan trọng — Hậu Kỳ được miễn double-booking check tại giờ chụp:** Hậu Kỳ không có mặt tại buổi chụp — họ làm việc hậu kỳ sau khi có raw_link. Do đó `assigned_hau_ky_id` **không tham gia vào `calendar.checkConflict`**. Một Hậu Kỳ có thể được assign vào nhiều đơn cùng ngày mà không bị chặn. Double-booking check chỉ áp dụng cho: `assigned_photographer_id`, `assigned_mua_id`, `assigned_support_id`.

```
Ví dụ:
  Photographer A làm được cả 2 cơ sở.
  10:00 — Cơ sở 1: A đang được assign đơn #001
  → Không thể assign A vào đơn #002 ở Cơ sở 2 lúc 10:00
  → Hệ thống báo lỗi: "Photographer A đã có lịch tại Cơ sở 1 lúc 10:00"
```

**Calendar view cho nhân sự nhiều cơ sở:**
- Mặc định hiển thị `default_location_id`
- Có thể switch tab xem từng cơ sở hoặc xem tất cả gộp lại
- Màu sắc phân biệt cơ sở trên cùng 1 calendar

### 4.5 Phân quyền theo cơ sở (tuỳ chọn)

Manager có thể giới hạn nhân sự chỉ thấy dữ liệu cơ sở trong `location_ids[]` của họ, hoặc cho phép xem tất cả. Cấu hình qua `ROLE_PERMISSIONS` như các quyền khác.

---

### 4.6 Khách hàng (CUSTOMERS)

```
CUSTOMERS
 ├── customer_id       (UUID hoặc auto-increment)
 ├── name
 ├── phone             (unique — dùng làm key nhận diện KH quay lại)
 ├── email             (nullable)
 ├── source            (Facebook | Instagram | Zalo | Giới thiệu | Walk-in | Khác)
 ├── tags              (vd: "VIP", "Gia đình", "Chụp nhiều lần")
 ├── notes
 ├── avatar_url        (nullable — link ảnh đại diện KH, dùng Google Drive share link hoặc URL ảnh trực tiếp)
 │                      Hiển thị: thẻ đơn hàng (40×40px tròn), calendar slot, hồ sơ CRM
 │                      Nếu null → hiển thị initials avatar (chữ cái đầu tên KH, nền màu brand)
 └── created_at
```

> Khi Sale tạo đơn mới: nhập SĐT → hệ thống tìm trong CUSTOMERS. Nếu đã có → hiện thông tin, hỏi "Đây có phải KH này không?". Nếu chưa có → tạo bản ghi CUSTOMERS mới tự động. ORDER lưu `customer_id` FK để liên kết lịch sử.

---

## 5. Đơn hàng & Multi-concept

### 5.1 Cấu trúc đơn

Một đơn hàng (Order) có thể chứa nhiều concept (buổi chụp cùng ngày).

```
ORDER
 ├── order_id                 (định dạng: ORD-YYYYMM-NNN, vd: ORD-202607-001)
 ├── version                  (integer, bắt đầu = 1, tăng +1 mỗi lần ghi — dùng cho optimistic locking)
 ├── customer_id              (FK → CUSTOMERS)
 ├── Thông tin KH (snapshot tại thời điểm tạo đơn: tên, SĐT)
 │
 ├── location_id              (cơ sở thực hiện buổi chụp — bắt buộc)
 │
 ├── Sale
 │    ├── sale_staff_id       (nhân viên Sale phụ trách)
 │    └── sale_channel        (ONLINE | OFFLINE)
 │                             ONLINE = Facebook/Instagram/Zalo
 │                             OFFLINE = KH đến trực tiếp tại cửa hàng
 │
 ├── Lịch buổi chụp
 │    ├── shoot_date          (ngày chụp)
 │    ├── arrival_time        (giờ KH có mặt — chọn từ khung giờ cố định, có thể chỉnh)
 │    ├── makeup_start        (giờ bắt đầu makeup — mốc tính lịch)
 │    ├── makeup_duration     (thời gian makeup ước tính, phút)
 │    ├── shoot_start         (giờ bắt đầu chụp = makeup_start + makeup_duration)
 │    ├── shoot_duration      (thời gian chụp ước tính, phút — tổng các concept)
 │    └── estimated_end       (giờ kết thúc dự kiến = shoot_start + shoot_duration)
 │
 ├── Trạng thái (workflow)
 ├── delivery_type            (AUTO: DIGITAL | PRINT — tự tính từ service + add-on; lock sau LÊN LỊCH)
 ├── order_voucher_id         (nullable — voucher áp cho toàn đơn, độc lập với concept)
 ├── raw_link                 (link Drive ảnh gốc — Photographer upload sau buổi chụp)
 │
 ├── Tài chính
 │    ├── total_price         (tổng đơn sau voucher)
 │    ├── deposit_amount      (số tiền đã cọc)
 │    ├── remaining_amount    (= total_price − deposit_amount, cập nhật khi thu tiền)
 │    └── payment_status      (CHUA_COC | DA_COC | DA_THANH_TOAN | HOAN_COC)
 │
 ├── Concept[] (1 hoặc nhiều)
 ├── Addon[] (dịch vụ phát sinh)
 └── Ghi chú
```

> `delivery_type` được hệ thống tự xác định: nếu bất kỳ concept nào có `includes_print = true`, hoặc có add-on loại `PRINT/PRINT_ALBUM/CANVAS/FRAME` → `PRINT`. Còn lại → `DIGITAL`.
> **Lock rule:** `delivery_type` chỉ được recompute khi đơn ở trạng thái ≤ LÊN LỊCH. Sau khi đơn chuyển sang ĐÃ CHỤP+THU TIỀN, giá trị bị lock — không tự động thay đổi dù có thêm add-on sau đó. Mục đích: tránh làm thay đổi workflow đang chạy.

> **⚠️ Cảnh báo khi thêm PRINT addon sau lock point:**  
> Nếu Sale hoặc MUA thêm ORDER_ADDON loại `PRINT/PRINT_ALBUM/CANVAS/FRAME` vào đơn đã qua ĐÃ CHỤP (tức `delivery_type` đã lock tại DIGITAL), GAS phải trả thêm:
> ```json
> { "ok": true, "data": { "addon_id": "..." }, "warning": "DELIVERY_TYPE_MISMATCH" }
> ```
> Frontend hiển thị **banner `--amber`** ngay trên chi tiết đơn: `"⚠️ Đơn đang theo luồng DIGITAL nhưng vừa thêm sản phẩm in ấn — cần Manager xác nhận đổi sang luồng IN ẤN để tránh giao sai quy trình."`
>
> Manager xử lý bằng endpoint `orders.overrideDeliveryType` (xem Section 16.2). Workflow sẽ không bị routing sai tại `orders.updateStatusHK` nếu Manager đã override trước.

> **Null safety cho `delivery_type`:** `orders.updateStatusHK` phải check `delivery_type` không null trước khi route. Nếu null (do lỗi dữ liệu hoặc migration): trả `jsonError(400, 'delivery_type không xác định — Manager cần kiểm tra đơn này')` thay vì route sai.

> `shoot_start` và `estimated_end` tự tính, dùng để hiển thị trên Calendar và cảnh báo double-booking. `shoot_duration` được gợi ý tự động từ `duration_minutes` của các concept được chọn.

### 5.2 Concept

```
CONCEPT
 ├── concept_id         (primary key — auto-increment)
 ├── order_id           (FK → ORDER)
 ├── concept_index      (1, 2, 3...)
 ├── service_id         (FK → SERVICE_CATALOG)
 ├── custom_price       (giá báo cho KH — linh hoạt)
 ├── voucher_id         (FK → VOUCHER, bắt buộc nếu concept_index >= 2)
 ├── assigned_photographer_id  (FK → USERS, nullable)
 ├── assigned_mua_id           (FK → USERS, nullable)
 ├── assigned_hau_ky_id        (FK → USERS, nullable)
 ├── assigned_support_id       (FK → USERS, nullable)
 ├── reference_photo_urls      (nullable — link ảnh tham khảo/moodboard do Sale hoặc KH cung cấp)
 │                              Lưu dạng chuỗi phân cách phẩy, tối đa 10 ảnh
 │                              vd: "https://drive.google.com/…,https://pin.it/…"
 │                              Hiển thị: gallery nhỏ trong chi tiết đơn; Photographer thấy khi chuẩn bị buổi chụp
 └── notes
```

> **Lý do tách assigned_staff thành 4 cột riêng thay vì array**: mỗi concept chỉ có 1 Photographer, 1 MUA, 1 Hậu Kỳ, 1 Support — dùng 4 cột nullable rõ ràng hơn, dễ query và kiểm tra double-booking hơn là parse array. `assigned_hau_ky_id` cũng là căn cứ để GAS xác định "own" khi Hậu Kỳ gọi `order.view_own`.

### 5.3 Rule concept

| Concept | Giá | Lương nhân sự |
|---|---|---|
| Concept 1 | Theo báo giá | 100% lương mặc định danh mục |
| Concept 2, 3... | Giá gốc − Voucher | 50% lương mặc định (bất kể thay người) |

> Nhân sự concept 2, 3 có thể khác concept 1. Lương vẫn = 50% mặc định.

---

### 5.4 Form Validation (thay thế Approval flow)

Không có bước duyệt đơn bởi Manager. Thay vào đó, form tạo đơn có validation nghiêm ngặt:

- **Required fields**: tên KH, SĐT, **cơ sở** (bắt buộc chọn 1 trong 2), ngày chụp, dịch vụ, giá báo, số tiền cọc
- **Format validation**: SĐT đúng định dạng, ngày không được ở quá khứ, cọc ≤ tổng giá
- **Business rules**: concept 2+ bắt buộc chọn voucher, assigned staff không được trùng lịch — double-booking kiểm tra **xuyên tất cả cơ sở** (nhân sự làm nhiều nơi vẫn bị chặn nếu trùng giờ)
- **Hành vi**: điền sai → hiển thị lỗi cụ thể, không cho submit. Điền đúng → tạo đơn ngay.

---

### 5.5 Định nghĩa "own" theo vai trò cho `order.view_own`

GAS xác định đơn "của mình" khác nhau theo role, bằng cách join vào bảng CONCEPT:

| Vai trò | Điều kiện "own" |
|---|---|
| **Sale** | `ORDER.sale_staff_id = current_user_id` |
| **Photographer** | Có ít nhất 1 CONCEPT trong đơn với `assigned_photographer_id = current_user_id` |
| **MUA** | Có ít nhất 1 CONCEPT trong đơn với `assigned_mua_id = current_user_id` |
| **Hậu Kỳ** | Có ít nhất 1 CONCEPT trong đơn với `assigned_hau_ky_id = current_user_id` |
| **Support** | Có ít nhất 1 CONCEPT trong đơn với `assigned_support_id = current_user_id` |

**GAS query mẫu (Photographer):**
```javascript
// Lấy tất cả order_id mà user được assign là Photographer
const conceptSheet = ss.getSheetByName('CONCEPT')
const concepts = conceptSheet.getDataRange().getValues()
const myOrderIds = new Set(
  concepts
    .filter(row => row[COL.assigned_photographer_id] === currentUserId)
    .map(row => row[COL.order_id])
)
// Filter ORDER sheet theo myOrderIds
```

**Field filtering — `order.view_own` cho Photographer & MUA:**

Khi Photographer hoặc MUA gọi `orders.get`, GAS trả về **phiên bản rút gọn** — bỏ các field tài chính nhạy cảm. Quyền `order.view_financial` kiểm soát điều này:

| Field | Cần `order.view_financial`? |
|---|---|
| `total_price`, `deposit_amount`, `remaining_amount`, `payment_status` | ✅ Có |
| `order_voucher_id`, `raw_link`, `notes` | ❌ Không — trả về bình thường |
| Tên KH, SĐT, lịch chụp, concept info | ❌ Không — cần để làm việc |

GAS check: nếu user có `order.view_financial` → trả full; nếu không → strip financial fields trước khi trả về.

---

## 6. Danh mục dịch vụ (Service Catalog)

Mỗi concept chụp được chọn từ danh mục dịch vụ.

```
SERVICE_CATALOG
 ├── service_id                   (primary key — auto-increment hoặc slug, vd: "family-outdoor")
 ├── name                         (vd: "Family Outdoor", "Portrait Studio")
 ├── description
 ├── suggested_price              (giá tham khảo — báo giá thực tế linh hoạt)
 ├── duration_minutes             (thời gian chụp ước tính)
 ├── includes_print               (boolean — gói có in ấn không)
 ├── print_spec                   (mô tả sản phẩm in nếu includes_print = true)
 ├── sample_photo_urls            (danh sách link ảnh mẫu/portfolio — lưu dạng chuỗi phân cách phẩy, tối đa 6 ảnh)
 │                                 vd: "https://drive.google.com/…,https://drive.google.com/…"
 │                                 GAS parse: row.sample_photo_urls?.split(',').filter(Boolean) ?? []
 │                                 Dùng để: hiển thị thumbnail khi Sale chọn dịch vụ, hiển thị trên lịch chụp
 ├── cover_photo_url              (1 ảnh đại diện chính — thumbnail chính cho service card; nullable)
 │                                 = ảnh đầu tiên trong sample_photo_urls nếu không set riêng
 ├── is_active                    (boolean — ẩn dịch vụ không còn bán)
 │
 ├── [Lương mặc định — cột phẳng, không JSON blob]
 ├── default_photographer_salary     (số tiền FIXED — lương mặc định Photographer/concept)
 ├── default_mua_salary              (số tiền FIXED — lương mặc định MUA/concept)
 ├── default_hau_ky_rate_per_file    (số tiền FIXED — lương mặc định Hậu Kỳ/file ảnh, vd: 12000)
 ├── default_support_salary          (số tiền FIXED — lương mặc định Support/concept)
 └── default_sale_commission_pct     (% hoa hồng Sale trên custom_price của concept)
```

> Lý do dùng cột phẳng thay vì JSON blob: SUMIFS và các công thức Sheets có thể đọc trực tiếp; dễ debug khi xem Sheets thủ công; GAS không cần parse JSON.

> `includes_print` quyết định workflow của đơn sau DUYỆT ẢNH. Nếu `false` → chuyển sang GIAO FILE. Nếu `true` → CHỜ IN → ĐANG GIAO → GIAO HÀNG. Ngoài ra, đơn cũng tự động có in ấn nếu KH thêm add-on loại `PRINT` hoặc `PRINT_ALBUM/CANVAS/FRAME`.

---

## 7. Add-on Items (Dịch vụ phát sinh)

### 7.1 Phân loại

| Loại | Ví dụ | Quản lý bởi | Lương kèm |
|---|---|---|---|
| `PRINT` | In ảnh các kích cỡ | Manager | Sale nhận % trên giá bán thực tế |
| `MUA_PRODUCT` | Nails, lens, tóc kẹp | MUA Artist | MUA nhận khoán cố định / sản phẩm |
| `GOODS` | Hoa, props | Manager | Không |

### 7.2 Data model

```
ADDON_CATALOG
 ├── name
 ├── category           (PRINT | MUA_PRODUCT | GOODS)
 ├── cost_price         (giá nhập — chỉ Manager thấy)
 ├── sell_price         (giá bán mặc định)
 ├── commission_type    (PERCENT | FIXED | NONE)
 ├── commission_value   (vd: 10 cho 10%, hoặc 50000 cho khoán)
 └── commission_role    (SALE | MUA | null)
```

### 7.3 Add-on trong đơn hàng

```
ORDER_ADDON
 ├── order_addon_id     (primary key — auto-increment)
 ├── order_id           (FK → ORDER)
 ├── addon_catalog_id   (FK → ADDON_CATALOG)
 ├── quantity
 ├── catalog_price      (giá mặc định lúc thêm vào)
 ├── actual_price       (giá Sale nhập — có thể khác catalog_price)
 └── commission_amount  (tự tính: actual_price × % hoặc khoán × qty)
```

> Sale được phép sửa `actual_price`. Commission tính trên `actual_price`. Manager thấy chênh lệch giữa `catalog_price` và `actual_price`.

### 7.4 Tổng đơn hàng

```
Tổng đơn = Σ custom_price (các concept)
         + Σ actual_price × quantity (add-ons)
         − Voucher concept 2+ (nếu có nhiều concept)
         − Voucher đơn hàng (áp dụng linh hoạt, không phụ thuộc số concept)
         ─────────────────────────────────────────
         − Đã cọc
         = Còn lại (thu tại buổi chụp)
```

**Hai loại voucher trong đơn:**

| Loại | Gắn vào | Điều kiện | Ai áp dụng |
|---|---|---|---|
| **Voucher concept** | Từng concept (index ≥ 2) | Bắt buộc khi có concept 2+ | Sale chọn khi tạo đơn |
| **Voucher đơn hàng** | Toàn bộ đơn | Không giới hạn — tuỳ thời điểm | Manager/Sale áp theo chính sách |

> `order_voucher_id` đã được định nghĩa trong ORDER model (Section 5.1), tách biệt với `voucher_id` ở cấp concept.

---

## 8. Voucher

```
VOUCHER
 ├── code
 ├── type               (PERCENT | FIXED_AMOUNT)
 ├── value              (vd: 20 cho 20%, hoặc 500000 cho 500k)
 ├── valid_from
 ├── valid_until
 ├── max_uses           (số lần dùng tối đa, null = không giới hạn)
 ├── used_count
 └── created_by         (Manager)
```

> Chỉ Manager tạo/vô hiệu hóa voucher. Áp dụng cho concept 2+ trong đơn.

---

## 9. Module Lương

### 9.1 Cấu trúc tính lương

Mỗi vai trò có cơ chế lương khác nhau:

| Vai trò | Lương cứng | Concept | % Add-on | Thưởng (Manager điền) |
|---|---|---|---|---|
| **Manager** | ✅ (tuỳ) | ✅ (tuỳ) | — | ✅ |
| **Sale** | ✅ | ✅ | ✅ (PRINT) | ✅ |
| **Marketing** | ✅ | ❌ (không đi chụp, không assign concept) | — | ✅ |
| **Photographer** | ✅ (tuỳ) | ✅ | — | ✅ |
| **MUA** | ✅ (tuỳ) | ✅ | ✅ (khoán/sp) | ✅ |
| **Hậu Kỳ** | ✅ (Manager setup) | ✅ (rate/file × tổng file DONE, không áp hệ số concept) | — | ✅ (Manager setup) |
| **Support** | ✅ (tuỳ) | ✅ | — | ✅ |

> **Marketing**: Lương = `base_salary + thưởng − phạt`. Không có lương concept vì Marketing không được assign vào buổi chụp. Nếu Manager muốn thưởng doanh số theo tháng → dùng BONUS.

```
Lương tháng =

  [Base] Lương cứng
         USERS.base_salary (Manager set cho từng người, kể cả chính mình)

+ [A] Lương theo đơn hàng (các đơn ở trạng thái ĐÃ CHỤP+)

      ── Photographer / MUA / Support / Sale ──
      Mỗi concept assignment:
        rate_type  = USERS.concept_rate_type  ?? "FIXED"
        rate_value = USERS.concept_rate_value ?? SERVICE_CATALOG.default_{role}_salary
        (vd: role=photographer → SERVICE_CATALOG.default_photographer_salary)

        Nếu FIXED:   lương = rate_value × hệ_số_concept
        Nếu PERCENT: lương = concept.custom_price × rate_value% × hệ_số_concept
        (hệ số: concept 1 = 1.0 | concept 2+ = 0.5)

      ── Hậu Kỳ (cơ chế khác — tính theo tổng số file thực hiện) ──
        rate_per_file  = USERS.hau_ky_rate_per_file
                         ?? SERVICE_CATALOG.default_hau_ky_rate_per_file
        total_files    = Σ HAU_KY_TASK.photo_count
                         (tổng tất cả task có status = DONE trong kỳ)

        lương_file = rate_per_file × total_files

      Không áp hệ_số_concept (0.5) — Hậu Kỳ được tính đều theo số file thực tế.

+ [B] Lương add-on (các đơn đã ĐÃ CHỤP+)
      - Sale:  Σ (actual_price × %) từ PRINT items
      - MUA:   Σ (khoán × quantity) từ MUA_PRODUCT items

+ [C] Thưởng — Manager điền tự do (BONUS)

− [D] Phạt — Manager điền tự do (PENALTY)

= Tổng lương tháng
```

**Logic ưu tiên lương (override):**

```
Photographer / MUA / Support / Sale:
  USERS.concept_rate_value có giá trị?
    ├── Có → dùng rate của nhân sự đó (bỏ qua SERVICE_CATALOG)
    └── Không → dùng SERVICE_CATALOG.default_{role}_salary

Hậu Kỳ:
  USERS.hau_ky_rate_per_file có giá trị?
    ├── Có → dùng rate riêng của người đó (vd: 15.000đ/file)
    └── Không → dùng SERVICE_CATALOG.default_hau_ky_rate_per_file (vd: 12.000đ/file)
```

> Manager set `default_hau_ky_rate_per_file` trong SERVICE_CATALOG cho từng loại dịch vụ (vd: Family Outdoor = 12.000đ/file, Portrait Studio = 15.000đ/file). Override per-person qua `USERS.hau_ky_rate_per_file` nếu muốn trả khác mức mặc định.

> Manager có quyền chỉnh cấu hình lương của tất cả nhân sự kể cả bản thân trong phần Quản lý nhân sự.

**Nguồn tính lương Hậu Kỳ — quy tắc rõ ràng:**

| Tình huống | Lương tính cho ai |
|---|---|
| `CONCEPT.assigned_hau_ky_id` được set lúc booking, không đổi | Người có `assigned_hau_ky_id` trong CONCEPT |
| Manager đổi `HAU_KY_TASK.assigned_editor` sang người khác | Lương vẫn tính cho `CONCEPT.assigned_hau_ky_id` — **không tự chuyển** |
| Manager muốn trả cho người thực tế làm | Dùng BONUS cho người mới, và/hoặc tạo PENALTY cho người cũ nếu cần |

> Nguyên tắc: **CONCEPT là nguồn tính lương duy nhất.** HAU_KY_TASK.assigned_editor chỉ điều phối công việc và quyền xem order, không ảnh hưởng lương. Nếu cần đổi người nhận lương, Manager cập nhật `CONCEPT.assigned_hau_ky_id` trực tiếp.

### 9.2 Thưởng / Phạt

```
BONUS_PENALTY
 ├── staff_id
 ├── type               (BONUS | PENALTY)
 ├── amount
 ├── note               (ghi chú điều kiện, lý do)
 ├── date
 ├── order_id           (optional — gắn với đơn cụ thể hoặc không)
 └── created_by         (Manager)
```

> Chỉ Manager tạo/sửa/xóa. Nhân sự chỉ thấy kết quả trong bảng lương của mình.

### 9.3 Kỳ lương

- Lương lock khi đơn chuyển sang **ĐÃ CHỤP + THU TIỀN**
- Tổng hợp theo tháng (hoặc kỳ Manager chốt)
- Thưởng/phạt cộng trừ vào kỳ tương ứng

---

## 10. Phân quyền chi tiết

### 10.1 Cơ chế phân quyền động (Dynamic RBAC)

Hệ thống phân quyền **không cố định** — Manager có toàn quyền kiểm soát:

- **Tích/bỏ tích thủ công** từng ô quyền cho từng vai trò bất kỳ lúc nào
- **Tạo vai trò mới** (ví dụ: "Kế toán", "Thực tập", "Cộng tác viên") và tự phân quyền
- **Xóa hoặc ẩn** vai trò không còn dùng

Dữ liệu phân quyền lưu trong 2 tab Google Sheets:

```
ROLES
 ├── role_id
 ├── role_name     (tên vai trò: "Sale", "Hậu Kỳ", hoặc vai trò Manager tạo mới)
 ├── is_system     (boolean — vai trò hệ thống mặc định, không được xóa)
 └── created_by

ROLE_PERMISSIONS
 ├── role_id
 ├── permission_key   (mã quyền, vd: "order.view_all", "finance.view")
 └── granted          (boolean — Manager tích = true, bỏ tích = false)
```

> **Ngoại lệ duy nhất:** Quyền `role.manage` (quản lý phân quyền) và `role.create` (tạo vai trò mới) **chỉ dành cho Manager**, không thể trao cho vai trò khác — để tránh leo thang quyền hạn.

---

### 10.2 Cấu hình mặc định (Manager có thể thay đổi)

Bảng dưới là cấu hình khởi đầu khi cài đặt hệ thống. Manager có thể chỉnh từng ô bất kỳ lúc nào.

| Quyền (permission_key) | Manager | Sale | Marketing | Photographer | MUA | Hậu Kỳ | Support |
|---|---|---|---|---|---|---|---|
| `order.view_all` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `order.view_own` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `order.create_edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `order.upload_raw_link` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `order.add_mua_addon` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `order.update_status_hk` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `order.view_financial` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `calendar.view_all` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `calendar.view_own` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `service_catalog.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `service_catalog.view` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `addon.manage_all` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `addon.manage_mua_product` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `order.add_mua_addon` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `addon.view_cost_price` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `voucher.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `voucher.view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `finance.view_all` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `finance.view_own_order` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `hau_ky.view_all` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `hau_ky.assign_update` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `album.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `album.view` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `shipping.update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `salary.view_all` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `salary.view_own` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `salary.manage_config` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `bonus_penalty.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `crm.view_edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `dashboard.finance` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `dashboard.marketing` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `role.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `role.create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **`service_catalog.view` — Photographer, MUA, Hậu Kỳ, Support được cấp quyền này** để xem ảnh mẫu (`cover_photo_url`, `sample_photo_urls`) và thông tin kỹ thuật dịch vụ (tên, mô tả, thời gian). GAS **không trả `cost_price`, `default_salary` fields** cho các role này — chỉ Manager và Sale thấy giá + lương mặc định. Strip logic tương tự `order.view_financial`.

> **Avatar KH (`customer_avatar_url`) — không cần `crm.view_edit`:** `orders.get` và `calendar.getDay` tự động bundle `customer_avatar_url` vào response cho **mọi role có `order.view_own` hoặc `calendar.view_own`**. Đây là display field (không phải CRM data), nên không cần quyền riêng. Nếu KH chưa có avatar → GAS trả `null`, frontend render initials fallback.

> **Moodboard (`reference_photo_urls`) — không cần quyền riêng:** `CONCEPT.reference_photo_urls` được trả về cùng dữ liệu concept trong `orders.get`. Mọi role có `order.view_own` đều thấy moodboard của đơn mình được assign. Photographer và MUA thấy moodboard để chuẩn bị buổi chụp; Hậu Kỳ thấy để đối chiếu khi edit.

> **Phân biệt `addon.manage_mua_product` vs `order.add_mua_addon`:**
> - `addon.manage_mua_product` → MUA được sửa ADDON_CATALOG: thêm/sửa/ẩn sản phẩm trong danh mục (nail, lens, tóc kẹp...).
> - `order.add_mua_addon` → MUA được thêm ORDER_ADDON vào đơn hàng cụ thể trong buổi chụp (ghi nhận KH đã dùng dịch vụ gì). GAS kiểm tra: addon phải là MUA_PRODUCT và MUA phải có `assigned_mua_id` trong một concept của đơn.
>
> **Phân biệt `order.update_status_hk`:** Quyền này chỉ cho phép Hậu Kỳ thực hiện đúng 2 transition: `DUYET_ANH → GIAO_FILE` và `DUYET_ANH → CHO_IN`. GAS hard-check — mọi transition khác bị từ chối.
>
> **`order.upload_raw_link`:** Photographer chỉ được ghi vào field `raw_link` trên đơn họ được assign. GAS kiểm tra: (1) user phải là `assigned_photographer_id` trong ít nhất 1 concept của đơn; (2) `ORDER.status` phải thuộc `{LEN_LICH, TAM_DUNG, DA_CHUP}` — không cho upload khi đơn ở trạng thái trước lịch (BÁO_GIÁ, ĐẶT_CỌC) hoặc đã kết thúc (HUY, GIAO_HANG...).
>
> **`order.view_financial`:** Nếu thiếu quyền này, GAS tự strip các field `total_price`, `deposit_amount`, `remaining_amount`, `payment_status` khỏi response của `orders.get`. Photographer và MUA không cần biết tiền KH đóng.
>
> **`album.view` vs `album.manage`:** `album.view` chỉ cho phép đọc danh sách album và thông tin spec (dùng cho Support khi chuẩn bị giao hàng). `album.manage` cho phép tạo/sửa album và upload `edited_link` (dành cho Hậu Kỳ). Support mặc định có `album.view`, không có `album.manage`.

---

## 11. Danh sách Module

### Module 1 — Order Hub
Trung tâm toàn hệ thống. Mỗi đơn hiển thị: trạng thái, timeline, nhân sự assigned, tài chính tóm tắt, add-ons, ghi chú.

### Module 2 — Booking & Calendar
- Form tạo đơn với validation chuẩn
- Calendar view: lịch chụp theo ngày/tuần/tháng
- Xem slot còn trống, tránh double-booking
- Thu cọc và ghi nhận

#### Hệ thống khung giờ cố định

Studio vận hành theo 6 khung giờ mặc định:

| Slot | Giờ KH có mặt |
|---|---|
| Slot 1 | 08:00 |
| Slot 2 | 10:00 |
| Slot 3 | 12:00 |
| Slot 4 | 14:00 |
| Slot 5 | 16:00 |
| Slot 6 | 18:00 |

**Cách hoạt động:**
- Khi tạo đơn, Sale chọn slot từ dropdown — `arrival_time` điền tự động
- Nếu cần điều chỉnh, Sale nhập giờ tay thay thế (override)
- Calendar hiển thị từng slot trong ngày, màu sắc theo trạng thái:

| Màu | Trạng thái |
|---|---|
| ⬜ Trắng | Trống |
| 🟡 Vàng | Đã đặt (chưa chụp) |
| 🔵 Xanh dương | Đang chụp |
| 🟢 Xanh lá | Đã hoàn thành |

- Cảnh báo nếu `estimated_end` của đơn mới chồng lấn `arrival_time` của đơn tiếp theo

#### Cảnh báo deadline hậu kỳ

Hệ thống tự động kiểm tra và gửi cảnh báo đến **Manager + Hậu Kỳ phụ trách** trong 2 trường hợp:

| Tình huống | Điều kiện kích hoạt cảnh báo |
|---|---|
| **Chậm gửi link ảnh gốc** | Đơn đã qua trạng thái ĐÃ CHỤP+THU TIỀN nhưng `raw_link` (ảnh raw) trên ORDER chưa được upload sau X giờ/ngày |
| **Trễ deadline trả ảnh hậu kỳ** | `HAU_KY_TASK.deadline` đã qua nhưng `status` vẫn chưa là `DONE` |

Ngưỡng cảnh báo X do Manager cấu hình trong Cài đặt hệ thống (mặc định gợi ý: 24h cho link ảnh gốc, 0h cho deadline hậu kỳ).

**Cấu hình slot** (Manager có thể thêm/bỏ/sửa giờ trong phần Cài đặt hệ thống):

### Module 3 — Danh mục dịch vụ
- Quản lý các concept/gói chụp
- Giá tham khảo + bảng lương mặc định theo role
- Thêm/sửa/ẩn dịch vụ

### Module 4 — Add-on & Voucher
- Danh mục add-on (PRINT, MUA_PRODUCT, GOODS)
- Quản lý voucher: tạo, giới hạn dùng, hết hạn
- Theo dõi giá nhập/giá bán/lợi nhuận add-on

### Module 5 — Hậu Kỳ & Album

#### 5A. Tiến độ hậu kỳ

Mỗi đơn sau khi KH chọn ảnh xong (CHỌN ẢNH → HẬU KỲ) sẽ tạo ra 1 task hậu kỳ:

```
HAU_KY_TASK
 ├── task_id            (primary key — auto-increment)
 ├── order_id           (FK → ORDER)
 ├── assigned_editor    (nội bộ: staff_id | outsource: tên/liên hệ)
 ├── editor_type        (INTERNAL | OUTSOURCE)
 ├── photo_count        (số ảnh KH chọn cần edit)
 ├── deadline
 ├── status             (PENDING | IN_PROGRESS | REVIEW | DONE)
 ├── notes
 └── updated_at
```

> `raw_link` (ảnh gốc Photographer upload) nằm trên **ORDER**, không phải HAU_KY_TASK. Lý do: Photographer upload raw ngay sau buổi chụp, lúc đó HAU_KY_TASK chưa được tạo (chỉ tạo sau khi KH chọn ảnh xong). Hậu Kỳ đọc `raw_link` từ ORDER khi nhận task.

```
```

Trạng thái hậu kỳ:

| Trạng thái | Mô tả |
|---|---|
| `PENDING` | Chờ nhận việc (KH vừa chọn ảnh xong) |
| `IN_PROGRESS` | Đang edit |
| `REVIEW` | Đã edit xong, chờ duyệt nội bộ |
| `DONE` | Duyệt xong, sẵn sàng giao KH |

#### 5A.1 Luồng hoàn chỉnh: Photographer → Hậu Kỳ → KH duyệt

```
1. [Sau buổi chụp] Photographer gọi orders.uploadRawLink
   → raw_link ghi vào ORDER
   → Notification RAW_UPLOADED → Manager + Sale

2. [Sale/Manager] Xác nhận thu tiền → ORDER status = ĐÃ CHỤP+THU TIỀN
   ⚠️ Nếu ORDER.raw_link còn trống: GAS trả thêm { warning: "Chưa có link ảnh raw từ Photographer" }
      → Frontend hiển thị cảnh báo màu --amber nhưng vẫn cho phép chuyển trạng thái

3. [KH] Vào webapp chọn ảnh → chọn xong
   → webapp gọi POST /webhook/photo-selected
   → GAS: ORDER = CHỌN_ANH, tạo HAU_KY_TASK
        assigned_editor = CONCEPT.assigned_hau_ky_id của concept 1 (auto-populate)
        editor_type = INTERNAL (nếu assigned_hau_ky_id có giá trị, nếu không = null và Manager assign sau)
   → Notification PHOTO_SELECTED → Hậu Kỳ assigned (từ assigned_hau_ky_id)

4. [Hậu Kỳ] Nhận task, đọc raw_link từ ORDER, edit ảnh
   → Cập nhật HAU_KY_TASK.status: PENDING → IN_PROGRESS → REVIEW → DONE
   → Upload edited_link vào ALBUM
   → Gọi hauky.notifyReady
   → Notification HK_READY_FOR_REVIEW → Manager + Sale

5. [Manager/Sale] Gửi link webapp cho KH vào duyệt
   → KH duyệt trên webapp
   → webapp gọi POST /webhook/photo-approved
   → GAS: ORDER = DUYỆT_ANH
   → Notification PHOTO_APPROVED → Hậu Kỳ + Manager

6. [Hậu Kỳ] Gọi orders.updateStatusHK
   → DUYỆT_ANH → GIAO_FILE (digital) hoặc CHO_IN (có in ấn)
```

#### 5A.2 Chi tiết tích hợp webhook — webapp chọn ảnh

Webapp chọn ảnh (hệ thống hiện có, kết nối Drive) tích hợp với ERP theo cơ chế sau:

**Luồng kỹ thuật:**

```
KH chọn ảnh xong trên webapp
  → webapp gọi GAS endpoint: POST /webhook/photo-selected
  → Payload: { order_id, selected_count, selected_at, idempotency_key }
  → GAS xử lý (xem chi tiết idempotency bên dưới):
       1. Kiểm tra idempotency_key — nếu đã xử lý rồi → trả { ok: true, idempotent: true }, dừng
       2. Cập nhật ORDER.status = "CHỌN ẢNH" (nếu chưa)
       3. Tạo bản ghi HAU_KY_TASK mới với status = PENDING
       4. Tạo NOTIFICATION cho Hậu Kỳ được assign (hoặc tất cả Hậu Kỳ nếu chưa assign)
       5. Lưu idempotency_key vào CacheService (TTL 24h)
  → ERP webapp: Hậu Kỳ thấy thông báo mới khi polling NOTIFICATIONS
```

**GAS endpoint bảo mật:**
- Webapp chọn ảnh gửi kèm `webhook_secret` (shared secret key, cấu hình trong SETTINGS)
- GAS kiểm tra secret trước khi xử lý — không yêu cầu Google OAuth vì đây là machine-to-machine call

**⚠️ Idempotency — bắt buộc để tránh HAU_KY_TASK nhân đôi:**

Webapp chọn ảnh **phải** gửi kèm `idempotency_key` trong mọi request. Giá trị gợi ý: `SHA256(order_id + event_type + selected_at)` — đảm bảo cùng sự kiện luôn có cùng key. Khi retry do timeout, key giữ nguyên.

```javascript
// GAS — xử lý webhook với idempotency check
function handlePhotoSelected(payload) {
  const { order_id, selected_count, selected_at, idempotency_key } = payload

  // Bắt buộc: kiểm tra idempotency_key trước mọi thao tác ghi
  if (!idempotency_key) return jsonError(400, 'Missing idempotency_key')

  const idemCache = CacheService.getScriptCache()
  const idemCacheKey = 'idem_' + idempotency_key
  if (idemCache.get(idemCacheKey)) {
    // Request này đã được xử lý thành công trước đó — trả về OK, không làm gì thêm
    return jsonOk({ idempotent: true, message: 'Already processed' })
  }

  // Kiểm tra thêm: HAU_KY_TASK có tồn tại chưa (defense-in-depth)
  const existingTask = findHauKyTaskByOrderId(order_id)
  if (existingTask) {
    idemCache.put(idemCacheKey, '1', 86400) // cache 24h
    return jsonOk({ idempotent: true, task_id: existingTask.task_id })
  }

  // Xử lý bình thường
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    updateOrderStatus(order_id, 'CHON_ANH')
    const task = createHauKyTask({ order_id, photo_count: selected_count })
    createNotificationPhotoSelected(order_id)
    idemCache.put(idemCacheKey, '1', 86400) // đánh dấu đã xử lý thành công
    return jsonOk({ task_id: task.task_id })
  } finally {
    lock.releaseLock()
  }
}
```

**Khi KH duyệt ảnh xong (DUYỆT ẢNH):**
```
webapp gọi: POST /webhook/photo-approved
  → Payload: { order_id, approved_at, idempotency_key }
  → GAS kiểm tra idempotency_key trước → nếu đã xử lý → trả OK ngay
  → Nếu chưa: cập nhật ORDER.status = "DUYỆT ẢNH"
  → Tạo NOTIFICATION PHOTO_APPROVED → Hậu Kỳ + Manager
  → Lưu idempotency_key vào cache 24h
```

> **Phía webapp chọn ảnh (yêu cầu với developer webapp):** Khi gửi webhook, nếu nhận HTTP timeout hoặc connection error, **phải retry** với **cùng `idempotency_key`**. Không được generate key mới khi retry. Retry tối đa 3 lần với exponential backoff (1s, 2s, 4s).

#### 5B. Quản lý Album & In ấn

Mỗi đơn có thể có nhiều album (tương ứng từng concept hoặc từng sản phẩm in ấn):

```
ALBUM
 ├── album_id           (primary key — auto-increment)
 ├── order_id           (FK → ORDER)
 ├── concept_id         (FK → CONCEPT, album thuộc concept nào)
 ├── album_type         (DIGITAL | PRINT_ALBUM | CANVAS | FRAME)
 ├── spec               (kích thước, số trang, chất liệu...)
 ├── edited_link        (link Drive file ảnh đã edit hoàn chỉnh — Hậu Kỳ upload khi DONE)
 ├── print_status       (PENDING | PRINTING | READY_TO_SHIP)
 └── notes
```

#### 5C. Tracking Giao Hàng (Print Orders)

Áp dụng cho các album có `album_type` ≠ DIGITAL. Mỗi album in ấn có thêm block giao hàng:

```
SHIPPING
 ├── album_id
 ├── order_id
 │
 ├── Thông tin khách hàng nhận hàng
 │    ├── recipient_name      (tên người nhận — mặc định lấy từ KH đặt đơn, có thể thay)
 │    ├── recipient_phone     (SĐT người nhận)
 │    └── shipping_address    (địa chỉ giao hàng chi tiết)
 │
 ├── shipping_status    (PENDING | READY | SHIPPING | DELIVERED)
 ├── carrier            (đơn vị vận chuyển: Giao Hàng Nhanh, GHTK, nội bộ...)
 ├── tracking_number    (mã vận đơn)
 ├── shipped_at         (ngày gửi đi)
 ├── delivered_at       (ngày giao thành công)
 ├── remaining_amount   (số tiền còn lại cần thu khi giao)
 ├── payment_status     (UNPAID | PAID)
 ├── payment_collected_at
 └── notes              (ghi chú giao hàng)
```

> `recipient_name` và `recipient_phone` mặc định tự điền từ thông tin KH của đơn hàng. Support có thể chỉnh lại nếu người nhận khác người đặt (ví dụ: giao cho người thân).

Trạng thái giao hàng:

| Trạng thái | Mô tả | Người cập nhật |
|---|---|---|
| `PENDING` | Đang in, chưa sẵn sàng giao | Hậu Kỳ |
| `READY` | In xong, chờ giao / gửi | Support |
| `SHIPPING` | Đang trên đường giao (có mã vận đơn) | Support |
| `DELIVERED` | Đã giao thành công + đã thu tiền | Support |

**Rule thanh toán khi giao hàng:**
- `remaining_amount` = tổng đơn in − số tiền đã thu trước (nếu có)
- Khi Support đánh dấu `DELIVERED` → bắt buộc xác nhận `payment_status = PAID`
- Nếu chưa thu được tiền → không thể chuyển sang DELIVERED, dùng ghi chú

**Đồng bộ ngược về ORDER:**
Khi SHIPPING chuyển sang `DELIVERED` + `payment_status = PAID` → GAS tự động cập nhật ORDER:
- `ORDER.payment_status` = `Đã thanh toán đủ`
- `ORDER.remaining_amount` = `0`
- `ORDER.status` = `GIAO HÀNG` (trạng thái cuối của đơn in ấn)

#### 5D. Quyền truy cập Hậu Kỳ & Support

| Hành động | Hậu Kỳ | Support |
|---|---|---|
| Xem tất cả task hậu kỳ | ✅ | ✅ |
| Cập nhật tiến độ edit | ✅ | ❌ |
| Quản lý album (tạo, sửa spec) | ✅ | ❌ |
| Cập nhật print_status | ✅ | ❌ |
| Xem danh sách giao hàng | ✅ | ✅ |
| Cập nhật shipping_status, tracking | ❌ | ✅ |
| Xác nhận thu tiền khi giao | ❌ | ✅ |
| Xem lịch deadline | ✅ | ✅ |

### Module 6 — Lương
- Bảng lương theo tháng từng nhân sự
- Chi tiết: lương concept + commission add-on + thưởng − phạt
- Quản lý thưởng/phạt với ghi chú
- Chốt lương theo kỳ

**Schema bảng SALARY:**
```
SALARY
 ├── salary_id          (primary key — auto-increment)
 ├── staff_id           (FK → USERS)
 ├── period             (YYYY-MM — kỳ lương, vd: "2026-06")
 ├── base_salary        (lương cứng kỳ đó — snapshot tại thời điểm chốt)
 ├── concept_total      (tổng lương từ các concept trong kỳ — Photographer/MUA/Support/Sale)
 ├── hk_file_total      (tổng lương file Hậu Kỳ trong kỳ: rate_per_file × Σ photo_count của tất cả task DONE. Chỉ có giá trị nếu role = Hậu Kỳ, các role khác = 0)
 ├── addon_total        (tổng commission add-on trong kỳ)
 ├── bonus_total        (tổng BONUS trong kỳ)
 ├── penalty_total      (tổng PENALTY trong kỳ)
 ├── gross_total        (= base + concept_total + hk_file_total + addon_total + bonus − penalty)
 ├── is_locked          (boolean — Manager chốt lương, không tính lại được)
 ├── locked_at          (timestamp)
 └── locked_by          (user_id Manager)
```

> Khi Manager "chốt lương" (`is_locked = true`): bản ghi bị freeze, mọi đơn phát sinh sau thời điểm chốt sẽ vào kỳ tiếp theo. Không thể chỉnh sửa SALARY đã lock.

### Module 7 — Tài chính

**7.1 Bảng Thu (Thu nhập)**
- Doanh thu từ đơn hàng hoàn thành theo tháng
- Lọc: theo cơ sở / kênh bán / nhân sự / dịch vụ
- Tổng thu thực tế (đã thu đủ) vs. tổng theo hợp đồng

**7.2 Bảng Chi (Chi phí)**
- Nhập chi phí thủ công: nguyên vật liệu, vận hành, lương, khác
- Phân loại: cơ sở vật chất, marketing, nhân sự, khác
- Lọc theo cơ sở / tháng / loại chi phí

**7.3 Bảng Công Nợ (Phải thu)**
- Danh sách đơn hàng còn nợ tiền (`remaining_amount > 0`)
- Thông tin: tên khách, số tiền còn nợ, ngày dự kiến thu, trạng thái
- Cảnh báo khoản nợ quá hạn
- Lọc theo cơ sở / trạng thái công nợ

**7.4 Tổng hợp**
- Lợi nhuận = Tổng Thu − Tổng Chi − Tổng Lương
- **Lọc theo cơ sở**: xem riêng Cơ sở 1 / Cơ sở 2 / Tổng hợp cả 2

### Module 8 — CRM
- Hồ sơ khách hàng: lịch sử đơn, tổng chi tiêu
- **Số lần sử dụng dịch vụ**: tổng số đơn hàng đã hoàn thành, phân loại theo từng loại dịch vụ (Portrait, Family, Concept...)
- Nguồn khách (Facebook, Instagram, giới thiệu...)
- Tag, ghi chú để remarketing

### Module 9 — Dashboard

**9.1 Tổng quan Manager**
- Doanh thu, lợi nhuận, công nợ, đơn theo trạng thái
- **Bộ lọc cơ sở**: xem từng cơ sở riêng hoặc tổng hợp; nhân sự chỉ thấy cơ sở được phân quyền
- Marketing: nguồn khách, tỷ lệ chuyển đổi (có thể lọc theo cơ sở)

**9.2 Lịch chụp hôm nay**
- Danh sách tất cả đơn có `shoot_date = today`, hiển thị theo giờ
- Thông tin: tên khách, cơ sở, giờ có mặt, nhân sự phụ trách

**9.3 Lịch chụp chưa phân công**
- Danh sách đơn đã lên lịch (`shoot_date` có giá trị, trạng thái ≥ LÊN LỊCH) nhưng còn thiếu ít nhất một trong ba vị trí: Photographer, Makeup Artist, Hậu Kỳ
- Hiển thị rõ vị trí nào đang bị trống
- Sắp xếp ưu tiên theo ngày chụp gần nhất

**9.4 Cảnh báo trễ deadline**
- **Gửi link ảnh gốc trễ**: đơn đã qua trạng thái ĐÃ CHỤP nhưng Photographer chưa gửi link raw sau `X` ngày
- **Hậu kỳ trễ**: task hậu kỳ đã quá `hk_deadline` mà chưa hoàn thành
- **In ảnh / giao hàng trễ**: đơn in ảnh đã xác nhận đặt in nhưng chưa chuyển sang ĐANG GIAO sau `Y` ngày
- Mỗi cảnh báo hiển thị: tên đơn, tên khách, nhân sự phụ trách, số ngày trễ

### Module 10 — Nhân sự & Phân quyền
- Quản lý tài khoản, vai trò, cơ sở chính (`default_location_id`)
- Lịch làm việc theo cơ sở
- Cấu hình phân quyền động (RBAC): tích/bỏ tích từng quyền, tạo vai trò mới
- Cấu hình cơ sở: thêm/sửa thông tin cơ sở
- **Thay đổi logo website**: Manager upload logo mới, áp dụng cho toàn bộ giao diện webapp

---

## 12. Google Sheets — Cấu trúc tab (database)

| Tab hiện có | Tương ứng module | Ghi chú |
|---|---|---|
| GD Chính | Order Hub | Cần thêm cột trạng thái chi tiết |
| Chờ Duyệt | → bỏ | Thay bằng form validation |
| BÁO CÁO | Finance Dashboard | Giữ nguyên, tính bằng SUMIFS |
| Dashboard | Dashboard | Mở rộng |
| CRM | CRM | Giữ nguyên |
| HẬU KỲ | Hậu Kỳ Tracker — tiến độ task | Mở rộng: thêm editor_type, photo_count, deadline |
| CHI PHÍ | Finance | Giữ nguyên |
| CSDL | Service Catalog + Add-on + Voucher | Tách thành nhiều tab con |
| HuongDan | — | Docs nội bộ |

**Tab cần thêm mới:**

| Tab mới | Mục đích |
|---|---|
| CONCEPT | Chi tiết từng concept trong đơn |
| ADDON_CATALOG | Danh mục add-on (Print, MUA Product, Goods) |
| ORDER_ADDON | Add-on từng đơn |
| VOUCHER | Danh mục voucher |
| SALARY | Tổng hợp lương theo kỳ |
| BONUS_PENALTY | Thưởng/phạt nhân sự |
| ALBUM | Quản lý album từng đơn (type, spec, print_status) |
| SHIPPING | Tracking giao hàng + thanh toán đơn in ấn |
| USERS | Tài khoản nhân sự: user_id, email, role_id, location_ids[], default_location_id, base_salary, concept_rate_type, concept_rate_value (Photographer/MUA/Support/Sale), hau_ky_rate_per_file (Hậu Kỳ), is_active |
| LOCATIONS | Danh sách cơ sở (tên, địa chỉ, SĐT) |
| ROLES | Danh sách vai trò (mặc định + vai trò Manager tạo mới) |
| ROLE_PERMISSIONS | Ma trận quyền: role_id × permission_key × granted (Manager tích thủ công) |
| CUSTOMERS | Hồ sơ khách hàng (nhận diện qua SĐT, link với nhiều ORDER) |
| ORDER_HISTORY | Audit log: mọi thay đổi ORDER (ai, lúc nào, field nào, giá trị cũ/mới) |
| NOTIFICATIONS | Thông báo nội bộ (polling-based, lưu per-user) |
| SETTINGS | Cấu hình hệ thống: slot times, deadline threshold, logo URL, webhook secret |

---

## 13. Tech Stack đề xuất

| Layer | Công nghệ | Lý do |
|---|---|---|
| Frontend | React (Next.js) | Claude generate tốt nhất; dễ deploy |
| API layer | Google Apps Script | Không cần server riêng, kết nối thẳng Sheets |
| Database | Google Sheets | Giữ nguyên, xem trực tiếp được |
| Auth | Google OAuth | Đăng nhập bằng tài khoản Google |
| Webapp chọn ảnh | Hệ thống hiện có (kết nối Drive) | Giữ nguyên, tích hợp qua webhook GAS |

### 13.1 Giới hạn GAS & chiến lược xử lý

**Concurrency:** GAS không xử lý song song — requests xếp hàng chờ. Với 6 nhân sự đồng thời, có thể gây lag 1–3s. Giảm thiểu bằng cách:
- Mọi **write** operation dùng `LockService.getScriptLock()` (GAS built-in) để tránh race condition khi 2 người ghi cùng lúc
- Không để UI poll liên tục — polling interval tối thiểu **30 giây** cho dashboard, **60 giây** cho lịch

**ROLE_PERMISSIONS cache:**
- Fetch toàn bộ ROLE_PERMISSIONS **1 lần duy nhất** khi user đăng nhập → lưu trong React Context
- Không fetch lại trừ khi: user làm mới trang, hoặc Manager thay đổi phân quyền (trigger invalidate)
- Tránh check quyền bằng cách gọi GAS mỗi route — làm chậm toàn bộ navigation

**Cold start:** GAS có thể mất 5–10s cho request đầu tiên sau thời gian không hoạt động. Đây là hành vi bình thường, không phải bug. Frontend hiển thị `.shimmer` trong thời gian này.

**Quota Sheets API:** 300 read/write requests/phút. Với 6 user, polling 30s = ~12 req/phút — an toàn. Tránh fetch toàn bộ tab lớn (ORDER, CONCEPT) mỗi lần — luôn filter theo điều kiện cụ thể từ GAS.

### 13.2 Bảo mật GAS API

> **Yêu cầu bắt buộc:** GAS phải deploy với chế độ `Execute as: Me` + `Who has access: Anyone` (để Next.js gọi được), NHƯNG phải tự verify quyền trong code — không tin tưởng frontend.

**Luồng xác thực:**

```
Frontend (Next.js)
  → Google Identity Services (GIS) trả về id_token (JWT, không phải access_token)
  → Mỗi GAS request gửi kèm: { token: id_token, action: "...", ...data }

GAS (doPost)
  → Bước 1: Kiểm tra CacheService — token đã verify trong 5 phút qua chưa?
       Có → dùng cached email (bỏ qua HTTP call)
       Không → gọi: fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + token)
               (~50–100ms, designed cho use case này)
  → Bước 2: Từ email → lookup USERS sheet → lấy role_id
  → Bước 3: getRolePermissions(role_id) — cache trong CacheService 5 phút
  → Bước 4: Kiểm tra permission → thực thi action
```

```javascript
function doPost(e) {
  const idToken = e.parameter.token
  if (!idToken) return jsonError(401, 'Missing token')

  // ── Cache key: dùng MD5 hash của toàn bộ token, không slice ──────────────
  // ❌ KHÔNG dùng: idToken.slice(-20) — 20 ký tự cuối không đủ entropy,
  //    có thể collide giữa các user → sai identity → privilege escalation
  // ✅ DÙNG: MD5 digest → 32 hex chars → collision probability cực thấp
  const tokenHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, idToken)
    .map(b => (b & 0xff).toString(16).padStart(2, '0')).join('')
  const cacheKey = 'token_' + tokenHash

  const cache = CacheService.getScriptCache()
  let email = cache.get(cacheKey)

  if (!email) {
    // ── Bọc UrlFetchApp trong try-catch + muteHttpExceptions ──────────────
    // ❌ KHÔNG gọi bare: UrlFetchApp.fetch(url)
    //    → Google tokeninfo 503 hoặc timeout → GAS ném exception →
    //      trả về HTML error page → frontend JSON.parse crash → màn trắng
    // ✅ DÙNG: muteHttpExceptions: true → luôn nhận response object, không throw
    let res
    try {
      res = UrlFetchApp.fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
        { muteHttpExceptions: true }
      )
    } catch (fetchErr) {
      // Lỗi mạng thực sự (DNS fail, no connection) — không phải HTTP error
      console.error('UrlFetchApp error:', fetchErr.message)
      return jsonError(503, 'Auth service temporarily unavailable')
    }

    const httpCode = res.getResponseCode()
    if (httpCode !== 200) {
      // Google tokeninfo trả 400 (token sai), 403, 5xx (service down)
      console.error('tokeninfo HTTP ' + httpCode + ' for token hash ' + tokenHash)
      return jsonError(httpCode >= 500 ? 503 : 401, 'Token verification failed')
    }

    let info
    try {
      info = JSON.parse(res.getContentText())
    } catch (parseErr) {
      return jsonError(503, 'Auth service returned invalid response')
    }

    if (info.error || !info.email) return jsonError(401, 'Invalid token')

    email = info.email
    cache.put(cacheKey, email, 300) // cache 5 phút với key an toàn
  }

  const user = getUserByEmail(email)
  if (!user || !user.is_active) return jsonError(401, 'User not found or inactive')

  const permissions = getCachedPermissions(user.role_id) // cache riêng 5 phút
  // kiểm tra permission → thực thi action
}
```

> **Lưu ý**: Dùng `id_token` (từ Google Identity Services / Sign In With Google), **không** dùng `access_token`. `id_token` là JWT có thể verify bằng endpoint tokeninfo của Google — đây là phương thức chính thức cho server-side verification.

**Quyền `role.manage` và `role.create`** phải được hard-check trong GAS code (không chỉ trong ROLE_PERMISSIONS) — để tránh trường hợp ai đó tự cấp quyền này cho mình qua Sheets.

**Webhook endpoints** (từ webapp chọn ảnh): verify bằng `webhook_secret` từ SETTINGS thay vì OAuth.

---

## 14. Thứ tự xây dựng

| Phase | Module | Lý do ưu tiên |
|---|---|---|
| **Phase 1** | Google Sheets restructure + CSDL | Nền tảng dữ liệu đúng trước khi build UI |
| **Phase 2** | Order Hub + Booking Form (validation) | Xương sống, mọi thứ phụ thuộc |
| **Phase 3** | Phân quyền + User management | Cần thiết trước khi deploy cho team |
| **Phase 4** | Danh mục dịch vụ + Add-on + Voucher | Hoàn thiện tạo đơn |
| **Phase 5** | Lương + Thưởng/Phạt | Nghiệp vụ quan trọng nhưng không block vận hành |
| **Phase 6** | Hậu kỳ Tracker + tích hợp webapp chọn ảnh | Mở rộng sau khi core ổn định |
| **Phase 7** | Finance + Dashboard + CRM | Báo cáo và phân tích |

---

## 15. Quy chuẩn UX/UI

> **Nguồn chân lý**: `app/globals.css` (design tokens + class dùng chung).  
> **Quy tắc bắt buộc**: Luôn dùng token/class có sẵn — không hard-code màu, không thêm framework CSS (không Tailwind).

---

### 15.1 Nguyên tắc cốt lõi

1. **Light theme, tông olive** — brand `#6d8150`. Nền xám rất nhạt, panel trắng.
2. **CSS design tokens** — viết style mới phải tái dùng `var(--…)` và class `.card/.btn/.input/.pill…`, không đặt hex cứng.
3. **Full-width fluid** — vùng nội dung chiếm trọn bề ngang (`.main` không giới hạn max-width); bảng rộng **phải vừa trong khung riêng** — bọc `overflow-x: auto` bên trong `.card`, cuộn ngang trong khung đó, không được tràn ra ngoài layout trang.
4. **Tinh giản, ít chuyển động** — hiệu ứng nhẹ bằng CSS transition; tôn trọng `prefers-reduced-motion`.
5. **Tiếng Việt** toàn bộ nhãn, thông báo, nút.

---

### 15.2 Design Tokens (biến CSS)

| Nhóm | Biến | Giá trị | Dùng cho |
|---|---|---|---|
| Nền | `--bg` | `#f5f6f4` | nền trang |
| | `--panel` | `#ffffff` | thẻ/card, input |
| | `--panel-2` | `#f4f5f2` | hover, header bảng, note-box |
| | `--panel-3` | `#eaece7` | nav active, scrollbar |
| Viền | `--line` | `#e3e6e0` | viền chuẩn |
| | `--line-soft` | `#eef0ec` | viền nhạt (ô bảng) |
| Chữ | `--text` | `#1f2418` | chữ chính |
| | `--muted` | `#5f6857` | chữ phụ/label |
| | `--muted-2` | `#8b9282` | placeholder, icon |
| Brand | `--brand` | `#6d8150` | nút chính, focus, nhấn mạnh |
| | `--brand-600` | `#5c6e43` | hover nút |
| | `--brand-700` | `#4d5c38` | pressed state nút, text link đậm |
| | `--brand-soft` | `rgba(109,129,80,.14)` | nền nhạt brand, focus ring |
| Mở rộng | `--purple` | `#6c71c4` | trạng thái CHỌN ẢNH |
| Ngữ nghĩa | `--red` / `--red-soft` | `#c0503f` / `rgba(192,80,63,.12)` | lỗi, huỷ, công nợ |
| | `--green` | `#5e7d3e` | thành công, doanh thu |
| | `--amber` | `#a9802f` | chờ/cảnh báo |
| | `--blue` | `#3f7e93` | thông tin |
| Bo góc | `--radius` / `--radius-sm` | `14px` / `10px` | card / input |
| Đổ bóng | `--shadow-sm` / `--shadow` | nhẹ / nổi | card / popover |

**Quy tắc màu trạng thái**: vàng = chờ (`--amber`), xanh dương = đã chốt (`--blue`), xanh brand = hoàn tất (`--brand`), xám = huỷ (`--muted-2`), đỏ = lỗi/huỷ/công nợ (`--red`).

---

### 15.3 Typography

- Font: **Plus Jakarta Sans** → Inter → system. Cỡ gốc `14px`, line-height `1.55`.
- `.h1` — tiêu đề trang: `22px / 800 / letter-spacing -.3px`.
- `.sub` — mô tả dưới tiêu đề: màu `--muted`.
- `.label` — nhãn field: `13px / 600`.
- Header bảng (`th`): `11.5px`, in hoa, letter-spacing `.05em`, màu `--muted`.

---

### 15.4 Components & Class chuẩn

| Class | Công dụng | Biến thể |
|---|---|---|
| `.card` | Khối nội dung: panel trắng, bo `--radius`, shadow nhẹ, padding 20px | — |
| `.btn` | Nút chính (nền brand, chữ trắng, min-height 42) | `.ghost` (viền nhạt), `.danger` (đỏ nhạt) |
| `.input` | Input/select/textarea (height 44, focus ring brand) | `textarea.input` cao tự do |
| `.pill` | Nhãn tròn nhỏ (status/badge) | tô màu qua inline `background/color` |
| `.field` `.label` `.err` | Khối form: spacing + nhãn + dòng lỗi | — |
| `.detail-grid` | Lưới chi tiết trái rộng (1.35fr) / phải (1fr); gập 1 cột ≤860px | — |
| `.finance-box` | Khung tài chính: viền brand + gradient brand mờ | `.finance-row` (label↔value) |
| `.note-box` | Hộp ghi chú nền xám, `white-space: pre-wrap` | — |
| `.row` | Flex ngang, `gap: 12px`, `align-items: center` — dùng cho thanh lọc, inline actions | — |
| `.tag` | Label nhỏ dạng pill bo `--radius-sm`, nền `--panel-2`, chữ `--muted` — dùng cho CRM tags (VIP, Gia đình…) | `.tag.active` nền `--brand-soft` chữ `--brand` |
| `.modal` | Overlay dialog: backdrop `rgba(0,0,0,.35)`, panel trắng bo `--radius`, max-width 480px, padding 24px. Dùng thay `confirm()` native cho mọi thao tác phá huỷ | `.modal.sm` (max-width 360px) cho confirm đơn giản |
| `.toast` | Thông báo nổi góc dưới-phải: nền `--text`, chữ trắng, bo `--radius-sm`, auto-dismiss 3s. Dùng sau hành động thành công (✓) | `.toast.error` nền `--red` |
| `.shimmer` | Skeleton loading (gradient quét) | — |
| `.press` | Micro-press: `scale(.96)` khi `:active` | — |
| `.anim-fade-in` `.anim-scale-in` `.anim-slide-right` | Animation vào (.2s) | tắt khi reduced-motion |

**Nút**: hành động chính = `.btn`; phụ/huỷ = `.btn.ghost`; xoá/nguy hiểm = `.btn.danger`. Luôn có `disabled` khi đang xử lý (`opacity .45`).

**Select**: `select.input` có mũi tên SVG tuỳ biến qua `appearance: none` + `background-image` — không dùng arrow mặc định của browser.

---

### 15.5 Layout & App Shell

- **Shell**: `grid 240px / minmax(0,1fr)` — sidebar cố định + nội dung co giãn.
- **Sidebar** (`.sidebar`): trắng, sticky full-height, `.brand` trên cùng, `.nav` dọc. Nav link: hover `--panel-2`; active `--panel-3`.
- **Main** (`.main`): padding `28px 32px`, `width:100%`, `min-width:0`.
- **Auth** (`.center`): canh giữa màn, nền có 2 vầng sáng radial brand/blue.

**Cấu trúc trang chuẩn:**
```jsx
<div>
  <h1 className="h1">Tên trang</h1>
  {/* thanh lọc / nút hành động */}
  {/* nội dung trong .card */}
</div>
```

---

### 15.6 Trạng thái đơn hàng — Màu chuẩn

Pill tô `background = màu + '22'`, `color = màu`. Map đầy đủ 14 trạng thái theo Section 3.2:

| Trạng thái (key) | Nhãn hiển thị | Token màu | Hex fallback |
|---|---|---|---|
| `TIEP_NHAN` | Tiếp nhận | `--muted` | `#5f6857` |
| `BAO_GIA` | Báo giá | `--amber` | `#a9802f` |
| `DAT_COC` | Đặt cọc | `--blue` | `#3f7e93` |
| `LEN_LICH` | Lên lịch | `--blue` | `#3f7e93` |
| `TAM_DUNG` | Tạm dừng | `--amber` | `#a9802f` |
| `DA_CHUP` | Đã chụp + Thu tiền | `--green` | `#5e7d3e` |
| `CHON_ANH` | Chọn ảnh | `--purple` | `#6c71c4` |
| `HAU_KY` | Hậu kỳ | `--blue` | `#3f7e93` |
| `DUYET_ANH` | Duyệt ảnh | `--amber` | `#a9802f` |
| `GIAO_FILE` | Giao file | `--brand` | `#6d8150` |
| `CHO_IN` | Chờ in | `--amber` | `#a9802f` |
| `DANG_GIAO` | Đang giao | `--blue` | `#3f7e93` |
| `GIAO_HANG` | Giao hàng | `--brand` | `#6d8150` |
| `HUY` | Hủy | `--muted-2` | `#8b9282` |

> **Quy tắc phân biệt cùng màu**: LÊN LỊCH và ĐẶT CỌC đều dùng `--blue` nhưng có thể phân biệt bằng icon nhỏ. TẠM DỪNG dùng `--amber` như BÁO GIÁ nhưng pill thêm border-style dashed.

**Trạng thái tài chính** (`payment_status`): `CHUA_COC` / `DA_COC` / `DA_THANH_TOAN` / `HOAN_COC`

| payment_status | Màu |
|---|---|
| `CHUA_COC` | `--muted` |
| `DA_COC` | `--amber` |
| `DA_THANH_TOAN` | `--green` |
| `HOAN_COC` | `--blue` |

---

### 15.7 Định dạng dữ liệu

- **Tiền**: `2.250.000 đ` — dùng helper `money()`: `(Number(n)||0).toLocaleString('vi-VN') + ' đ'`. Luôn có hậu tố ` đ`, phân tách dấu chấm.
- **Ngày giờ**: `dd/MM/yyyy HH:mm` theo giờ Việt Nam GMT+7 (`fmtDate()`). Nhập liệu: `<input type="datetime-local">` ↔ ISO qua `toLocalInput`/`fromLocalInput`.
- **Số tiền còn lại**: đơn HUỶ → `0`; ngược lại `max(total − paid, 0)`. Tô `--red` khi > 0, `--muted` khi = 0.
- **Giá trị rỗng**: hiển thị `—` (em dash), không để trống ô.

---

### 15.8 UX Patterns bắt buộc

| Tình huống | Chuẩn xử lý |
|---|---|
| **Ghi đè đồng thời** (nhiều người sửa 1 đơn) | Gửi kèm `current_version`; nhận 409 → báo *"Đơn vừa bị người khác sửa — đang tải lại…"* rồi `router.refresh()`. Không ghi đè im lặng. |
| **Đang tải** | Dùng `.shimmer` skeleton, hoặc text *"Đang …"* + nút `disabled`. |
| **Rỗng dữ liệu** | Empty state có hướng dẫn — **không** để trang trắng. |
| **Lỗi schema/dữ liệu** | Hiển thị `.card.note-box` giải thích nguyên nhân + cách khắc phục + `error.message`. |
| **Thao tác phá huỷ** (xoá, huỷ đơn, chốt lương) | Mở `.modal.sm` với tiêu đề, mô tả rõ hậu quả, và 2 nút: `.btn.danger` xác nhận + `.btn.ghost` huỷ bỏ. **Không dùng `confirm()` native** — không style được, không mobile-friendly. |
| **Phản hồi sau hành động** | Hiện `.toast` góc dưới-phải ("✓ Đã lưu", "✓ Đã cập nhật trạng thái"…) — tự ẩn sau 3 giây. Đồng thời cập nhật state tại chỗ rồi `router.refresh()`. Lỗi: `.toast.error` ("Không thể lưu — thử lại"). |
| **Warning không block** (vd: DA_CHUP khi thiếu raw_link) | Banner `--amber` ngay trên nội dung chính: icon ⚠️ + text giải thích + nút vẫn hoạt động. Không dùng modal. |

---

### 15.9 Quy ước Form

- Mỗi field: `.label` + `.input`. Khối: `.field` (margin-bottom 16) hoặc grid 2 cột.
- Lỗi: dòng `.err` (đỏ) hoặc `.note-box` màu `--red` ngay dưới form.
- Nút submit `.btn` có nhãn động: `"Tạo đơn"` ⇄ `"Đang tạo…"`, `disabled` khi busy.
- Select có placeholder `— Chọn … —` làm option rỗng đầu tiên.
- Tự điền thông minh: chọn gói → tự fill giá (`applied_price = base_price`).

---

### 15.10 Responsive & Accessibility

- **Bảng rộng**: bọc `overflow-x:auto` trong `.card`, không phá layout trang.
- **`.detail-grid`** tự gập 1 cột ở `≤860px`.
- **Reduced motion**: mọi `.anim-*` và `.shimmer` tự tắt khi `prefers-reduced-motion: reduce`.
- Tương phản chữ: `--text` trên nền sáng; `--muted` chỉ cho thông tin phụ.
- Vùng bấm: nút `min-height 42`, input `44` — đủ lớn cho cảm ứng.

---

### 15.11 Sidebar Nav — Items theo vai trò

Sidebar chỉ render menu item khi user có permission tương ứng:

| Menu item | Icon | Hiển thị cho |
|---|---|---|
| Tổng quan | 📊 | Manager, Sale, Support |
| Đơn hàng | 📋 | Manager, Sale, Support, Photographer, MUA |
| Lịch chụp | 📅 | Tất cả (mỗi role thấy scope riêng) |
| Hậu Kỳ | 🎨 | Manager, Hậu Kỳ, Support |
| Tài chính | 💰 | Manager |
| Danh mục | 📦 | Manager, Sale (view only) |
| CRM | 👥 | Manager, Sale, Marketing, Support |
| Lương | 💳 | Tất cả (mỗi role thấy scope riêng) |
| Nhân sự | 👤 | Manager |
| Cài đặt | ⚙️ | Manager |

**App shell đầy đủ:**
```
┌─────────────────────────────────────────────┐
│ .sidebar (240px)     │ .main (flex-1)        │
│                      │                       │
│ [Logo / tên studio]  │ [.h1 tên trang]       │
│                      │ [thanh lọc / actions] │
│ .nav                 │ [.card nội dung]      │
│  ├ Menu item 1       │                       │
│  ├ Menu item 2       │                       │
│  └ ...               │                       │
│                      │                       │
│ [Avatar + tên user]  │                       │
│ [🔔 badge notif]     │                       │
└─────────────────────────────────────────────┘
```

Notification bell đặt ở **bottom sidebar** cạnh avatar, không ở top header — giữ header gọn, bell luôn trong tầm mắt.

---

### 15.12 Notification Bell & Panel

**Vị trí:** Bottom sidebar, row với avatar user.

```
[Ảnh đại diện] Tên nhân sự    [🔔 3]
```

- Badge số lượng: nền `--red`, chữ trắng, min-width 18px
- Click bell → mở panel dropdown (`.card`, width 340px, max-height 480px, `overflow-y: auto`, shadow nổi)

**Panel layout:**
```
┌─ Thông báo ──────────────── [Đọc tất cả] ─┐
│ ● [RAW_UPLOADED] Đơn ORD-xxx              │
│   Photographer A đã upload ảnh raw        │
│   2 phút trước                            │
├────────────────────────────────────────────┤
│ ○ [STAFF_ASSIGNED] Bạn được assign        │
│   Đơn ORD-yyy — Buổi chụp 28/06 10:00    │
│   1 giờ trước                            │
└────────────────────────────────────────────┘
```

- Chưa đọc: background `--brand-soft`, dấu `●` màu `--brand`
- Đã đọc: background `--panel`, dấu `○` màu `--muted-2`
- Click item → navigate đến đơn liên quan + mark read
- "Đọc tất cả" → gọi `notifications.markRead` cho toàn bộ

---

### 15.13 Status Transition UI — Pattern chuẩn

Đây là interaction quan trọng nhất. Áp dụng nhất quán trên trang chi tiết đơn hàng:

**Action bar cố định dưới cùng trang đơn:**
```
┌──────────────────────────────────────────────────────┐
│  Trạng thái: [● Lên lịch]    [TẠM DỪNG] [ĐÃ CHỤP →] │
└──────────────────────────────────────────────────────┘
```

- Chỉ hiển thị **transitions hợp lệ** từ trạng thái hiện tại
- Nút chính (transition tiếp theo) = `.btn`; nút nhánh (TẠM DỪNG, HỦY) = `.btn.ghost` hoặc `.btn.danger`
- GAS trả về danh sách `allowed_transitions[]` dựa trên `ORDER.status` + `user.permissions` → frontend render dynamic

**Transition cần xác nhận (mở `.modal.sm`):**

| Transition | Lý do cần modal |
|---|---|
| → HỦY | Không thể hoàn tác, cần chọn lý do hủy |
| → ĐÃ CHỤP+THU TIỀN | Xác nhận số tiền thu thực tế |
| Chốt lương | Không thể mở lại |

**Transition có warning (banner `--amber`, không block):**

| Transition | Warning |
|---|---|
| → ĐÃ CHỤP khi thiếu `raw_link` | "⚠️ Photographer chưa upload link ảnh raw" |
| → LÊN LỊCH khi thiếu Photographer assign | "⚠️ Chưa phân công Photographer" |

---

### 15.14 Form Patterns nâng cao

#### Customer Phone Lookup
```
[SĐT] [0901234567         ] [🔍]
       ↓ (khi nhập ≥ 9 số)
       ┌─────────────────────────────┐
       │ ✓ Nguyễn Văn A — 0901234567│
       │   3 đơn · Lần cuối 15/06   │
       │ [Chọn KH này] [KH mới]     │
       └─────────────────────────────┘
```
- Tự tìm khi nhập đủ 9–10 số (debounce 400ms)
- Nếu tìm thấy → hiện `.card` inline với info KH
- Nếu không → tự tạo bản ghi mới khi submit

#### Multi-concept
```
─── Concept 1 ─────────────────────── [✕ xoá] ──
   Dịch vụ: [Family Outdoor ▾]  Giá: [3.500.000]
   Photographer: [Chọn... ▾]  MUA: [Chọn... ▾]

─── Concept 2 ─── (giảm 50%) ────────────────────
   Dịch vụ: [Portrait Studio ▾]  Giá: [1.800.000]
   Voucher: [Chọn voucher... ▾]  ← bắt buộc
   ⚠️ Concept này tính lương 50%

[+ Thêm concept]
```
- Concept 2+ hiển thị badge "giảm 50%" màu `--amber`
- Field voucher highlight `--red` nếu chưa chọn khi submit
- Nút "✕ xoá" chỉ hiện khi đơn chưa qua LÊN LỊCH

#### Photographer Upload Raw Link
```
[📎 Upload link ảnh raw]
─────────────────────────────────────────
Link Google Drive:
[https://drive.google.com/...          ]
                              [Xác nhận]

Sau khi xác nhận:
✓ Đã lưu — [🔗 Xem ảnh raw]
```
- Input text (paste URL Drive) + nút Xác nhận
- Sau submit: hiện link có thể click, nút đổi thành "Cập nhật link"
- Toast: "✓ Đã thông báo Manager và Sale"

---

### 15.15 Responsive & Mobile

**Breakpoints:**

| Breakpoint | Layout |
|---|---|
| `> 1024px` | Full — sidebar 240px cố định + main |
| `768px – 1024px` | Sidebar thu 60px (icon only, không label) |
| `< 768px` | Sidebar ẩn; hamburger `☰` ở top-left; slide-in overlay khi bật |

**Mobile sidebar (< 768px):**
- Top bar: `[☰]  [Logo]  [🔔 3]`
- Sidebar là overlay toàn chiều cao, đóng khi click ngoài hoặc click item nav
- `.main` padding thu về `16px`

**Skeleton loading — layout per trang:**

| Trang | Skeleton |
|---|---|
| Danh sách đơn | 5 dòng row, mỗi dòng 4 block shimmer: pill + text dài + text ngắn + số tiền |
| Chi tiết đơn | Block header shimmer + 2 cột `.detail-grid` shimmer |
| Calendar | Grid 6 cột shimmer ngày |
| Dashboard | 4 stat card shimmer + 1 chart block |
| Hậu Kỳ task list | 3 card shimmer dọc |

> GAS cold start 5–10s: hiện skeleton + text nhỏ "Đang kết nối…" màu `--muted-2` dưới skeleton. Không hiện spinner đơn độc — người dùng thấy layout trước, data fill vào sau.

---

### 15.17 Tích hợp Link Ảnh — Photo Integration

Ba loại ảnh được tích hợp vào hệ thống, hiển thị theo ngữ cảnh:

#### A. Ảnh mẫu dịch vụ (`SERVICE_CATALOG.sample_photo_urls` + `cover_photo_url`)

**Khi Sale chọn dịch vụ trong form tạo đơn:**
```
─── Concept 1 ─────────────────────────────────────
  Dịch vụ: [                          ▾]
            ┌──────────────────────────────────────┐
            │ [🖼] Family Outdoor       3.500.000đ │  ← cover_photo_url (32×32px)
            │ [🖼] Portrait Studio      2.800.000đ │
            │ [🖼] Couple Outdoor       3.000.000đ │
            └──────────────────────────────────────┘

  Sau khi chọn → hiện thumbnail gallery nhỏ ngay dưới dropdown:
  [ảnh 1] [ảnh 2] [ảnh 3]  (+2 ảnh nữa)   ← sample_photo_urls, tối đa 3 hiện, click xem thêm
```

- Thumbnail trong dropdown: `32×32px`, bo tròn `--radius-sm`, `object-fit: cover`
- Gallery dưới dropdown: `64×64px` mỗi ảnh, click → mở lightbox toàn màn hình
- Lightbox: overlay `rgba(0,0,0,.8)`, ảnh lớn giữa màn, nút `←` `→` duyệt, `✕` đóng
- Nếu `cover_photo_url` null → hiện icon `🖼` màu `--muted-2`

**Trong danh mục dịch vụ (Module 3 — Manager quản lý):**
```
┌──────────────────┐  ┌──────────────────┐
│  [ảnh bìa 160px] │  │  [ảnh bìa 160px] │
│  Family Outdoor  │  │  Portrait Studio │
│  3.500.000đ      │  │  2.800.000đ      │
│  [Sửa] [Ảnh]    │  │  [Sửa] [Ảnh]    │
└──────────────────┘  └──────────────────┘
```
- Card grid 3–4 cột, ảnh bìa `160px` chiều cao, `object-fit: cover`
- Nút "Ảnh" → mở panel upload: paste URL Drive hoặc URL ảnh, tối đa 6 ảnh/dịch vụ

---

#### B. Avatar KH (`CUSTOMERS.avatar_url`)

**Render avatar — component dùng chung `.avatar`:**
```css
.avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.avatar.lg { width: 52px; height: 52px; font-size: 18px; }
```

**Initials fallback** khi `avatar_url` null:
```javascript
// helper: lấy 1–2 chữ cái đầu từ tên KH
function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('')
}
// vd: "Nguyễn Thị Mai" → "NM", "Lan" → "L"
```

**Hiển thị theo ngữ cảnh:**

| Vị trí | Kích thước | Ghi chú |
|---|---|---|
| Thẻ đơn hàng (danh sách) | `36×36px` | Cạnh trái tên KH |
| Chi tiết đơn hàng | `52×52px` (`.avatar.lg`) | Header đơn, cạnh tên + SĐT |
| Calendar slot | `28×28px` | Trong ô lịch, góc phải slot |
| Hồ sơ CRM | `80×80px` | Đầu trang hồ sơ KH |
| Phone lookup autocomplete | `32×32px` | Trong kết quả gợi ý |

**Upload avatar trong CRM:** Sale paste URL (Google Drive, Facebook profile pic, hoặc ảnh trực tiếp) vào field avatar trong hồ sơ KH.

---

#### C. Ảnh tham khảo / Moodboard (`CONCEPT.reference_photo_urls`)

**Trong form tạo đơn — field per concept:**
```
─── Concept 1 ─── Family Outdoor ──────────────────
  ...
  Ảnh tham khảo (moodboard):
  [+ Thêm link ảnh]
  ┌──────┐ ┌──────┐ ┌──────┐
  │ 🖼 1 │ │ 🖼 2 │ │  +  │   ← thumbnail 56×56px, click để xoá hoặc thêm
  └──────┘ └──────┘ └──────┘
  Nhập URL ảnh (Pinterest, Google Drive, Instagram...):
  [https://pin.it/...                    ] [Thêm]
```

- Input paste URL, click "Thêm" → ảnh xuất hiện dưới dạng thumbnail 56×56px
- Hover thumbnail → hiện `✕` để xoá
- Tối đa 10 ảnh/concept; vượt quá → disable nút "Thêm"

**Trong chi tiết đơn — Photographer / MUA xem trước buổi chụp:**
```
┌─ Concept 1: Family Outdoor ─────────────────────────────┐
│  📋 Ghi chú: chụp ngoài trời, trang phục tự nhiên       │
│                                                          │
│  🎨 Moodboard:                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│  │ ảnh1 │ │ ảnh2 │ │ ảnh3 │ │ ảnh4 │  → click lightbox │
│  └──────┘ └──────┘ └──────┘ └──────┘                   │
└─────────────────────────────────────────────────────────┘
```
- Thumbnail `72×72px`, `object-fit: cover`, bo `--radius-sm`
- Click → lightbox fullscreen (dùng chung component lightbox với ảnh mẫu dịch vụ)
- Nếu không có ảnh tham khảo → ẩn block hoàn toàn (không hiện tiêu đề rỗng)

**Trong Calendar — hiện khi hover/click slot:**
```
┌─ 10:00 — ORD-202607-003 ───────────────┐
│ [NM] Nguyễn Thị Mai                    │  ← avatar KH
│ Family Outdoor · Cơ sở Quận 1          │
│ [🖼] [🖼] [🖼]  ← 3 ảnh tham khảo đầu  │
│ Photographer: A · MUA: B               │
└────────────────────────────────────────┘
```
- Ảnh tham khảo trên calendar: thumbnail `28×28px`, tối đa 3 hiện, còn lại `+N`
- Chỉ hiện khi `reference_photo_urls` có giá trị — không chiếm space nếu không có

---

#### D. Endpoints cập nhật

| Endpoint | Thay đổi | Ai thấy ảnh |
|---|---|---|
| `services.list` | Trả `cover_photo_url`, `sample_photo_urls[]`, `name`, `description`, `duration_minutes`. Strip salary fields nếu thiếu `salary.manage_config` | Mọi role có `service_catalog.view` — **bao gồm Photographer, MUA, Hậu Kỳ, Support** |
| `services.upsert` | Nhận `cover_photo_url`, `sample_photo_urls` (comma-separated) | Manager only |
| `orders.get` | Bundle thêm `customer_avatar_url`, `concepts[].reference_photo_urls[]`, `concepts[].service.cover_photo_url`. Strip tài chính nếu thiếu `order.view_financial` | Mọi role có `order.view_own` — **bao gồm Photographer, MUA, Hậu Kỳ, Support** |
| `orders.create` / `orders.update` | Nhận `reference_photo_urls` per concept (comma-separated string) | `order.create_edit` |
| `customers.upsert` | Nhận thêm `avatar_url` | `crm.view_edit` |
| `customers.get` | Trả thêm `avatar_url` | `crm.view_edit` |
| `calendar.getDay` | Mỗi booking slot trả thêm `customer_avatar_url` (null-safe), `concept_reference_photos[]` (tối đa 3 URL) | Mọi role có `calendar.view_own` hoặc `calendar.view_all` — **bao gồm Photographer, MUA** |

---

### 15.16 Checklist khi tạo trang/màn hình mới

- [ ] Dùng `var(--…)` & class có sẵn, không hex/màu cứng mới.
- [ ] Tiêu đề `.h1`; nội dung trong `.card`; nút đúng biến thể.
- [ ] Tiền qua `money()`, ngày qua `fmtDate()` (GMT+7), rỗng = `—`.
- [ ] Trạng thái dùng token màu chuẩn (kể cả `--purple` cho CHỌN ẢNH), không tự định nghĩa.
- [ ] Có empty state + error card; không để trắng.
- [ ] Mutation kèm `version` → xử lý 409.
- [ ] Bảng có `overflow-x:auto`; layout full-width, `min-width:0`.
- [ ] Không thêm animation vi phạm reduced-motion.
- [ ] Thao tác phá huỷ dùng `.modal.sm`, không dùng `confirm()` native.
- [ ] Feedback thành công dùng `.toast`; warning không-block dùng banner `--amber`.
- [ ] Sidebar nav items render theo permission — không hard-code.
- [ ] Avatar KH dùng component `.avatar` + initials fallback khi `avatar_url` null.
- [ ] Ảnh mẫu dịch vụ: thumbnail trong dropdown + gallery dưới; click → lightbox.
- [ ] Moodboard concept: ẩn block hoàn toàn nếu `reference_photo_urls` rỗng.
- [ ] Mọi `<img>` phải có `onerror` fallback (ảnh Drive hết quyền / link chết → hiện placeholder icon `🖼`).

---

---

## 16. GAS API — Danh sách Endpoint

Tất cả request dùng `POST` tới 1 GAS Web App URL duy nhất, phân biệt action qua `action` parameter.

### 16.1 Auth & Session

| Action | Mô tả | Required permission |
|---|---|---|
| `auth.verify` | Verify Google token, trả về user info + permissions | — |
| `settings.get` | Lấy SETTINGS (slots, thresholds, logo) | — |

### 16.2 Orders

| Action | Mô tả | Required permission |
|---|---|---|
| `orders.list` | Danh sách đơn (filter: status, location, date range) | `order.view_all` hoặc `order.view_own` |
| `orders.get` | Chi tiết 1 đơn. Response bao gồm: concepts (kèm `reference_photo_urls`, `service.cover_photo_url`, `service.sample_photo_urls`), addons, `customer_avatar_url`. GAS tự strip financial fields nếu thiếu `order.view_financial`; strip salary fields nếu thiếu `salary.manage_config`. Không cần quyền riêng để xem ảnh — bundle tự động theo `order.view_own` | `order.view_all` hoặc `order.view_own` |
| `orders.create` | Tạo đơn mới | `order.create_edit` |
| `orders.update` | Sửa đơn (kèm `version` để optimistic lock) | `order.create_edit` |
| `orders.updateStatus` | Chuyển trạng thái đơn (toàn bộ transition) | `order.create_edit` |
| `orders.updateStatusHK` | Chuyển trạng thái đơn sau khi KH duyệt ảnh. GAS tự quyết target state dựa vào `ORDER.delivery_type`: nếu DIGITAL → chuyển sang GIAO_FILE; nếu PRINT → chuyển sang CHO_IN. Client chỉ gửi `{ order_id }` — không cần gửi `target_status`. GAS hard-check: (1) ORDER.status phải là DUYET_ANH; (2) `delivery_type` phải không null — nếu null trả 400 với message rõ ràng. Mọi trường hợp khác bị từ chối 400. | `order.update_status_hk` |
| `orders.overrideDeliveryType` | Manager ghi đè `delivery_type` sau lock point (khi phát hiện DELIVERY_TYPE_MISMATCH). Payload: `{ order_id, delivery_type: "PRINT"\|"DIGITAL" }`. GAS ghi vào ORDER + ghi ORDER_HISTORY. Chỉ Manager. | hardcoded Manager only |
| `orders.history` | Lấy audit log của 1 đơn | `order.view_all` |

**Optimistic locking — cơ chế:**
```
Client gửi: { action: "orders.update", order_id, version: 5, data: {...} }
GAS đọc ORDER hiện tại → nếu row.version != 5 → trả về HTTP 409
Nếu khớp → ghi dữ liệu mới + tăng version lên 6
```

### 16.3 Customers & CRM

| Action | Mô tả | Required permission |
|---|---|---|
| `customers.search` | Tìm KH theo SĐT / tên | `crm.view_edit` |
| `customers.get` | Hồ sơ KH + lịch sử đơn | `crm.view_edit` |
| `customers.upsert` | Tạo hoặc cập nhật KH | `order.create_edit` |

### 16.4 Calendar & Scheduling

| Action | Mô tả | Required permission |
|---|---|---|
| `calendar.getDay` | Lịch 1 ngày (tất cả slots, theo cơ sở) | `calendar.view_all` hoặc `calendar.view_own` |
| `calendar.checkConflict` | Kiểm tra double-booking trước khi assign | `order.create_edit` |
| `staff.available` | Danh sách nhân sự trống trong khung giờ | `order.create_edit` |

### 16.5 Catalog

| Action | Mô tả | Required permission |
|---|---|---|
| `services.list` | Danh mục dịch vụ. GAS tự strip `default_photographer_salary`, `default_mua_salary`, `default_hau_ky_rate_per_file`, `default_support_salary`, `default_sale_commission_pct` nếu role thiếu `salary.manage_config`. Trả đủ `cover_photo_url`, `sample_photo_urls`, `name`, `description`, `duration_minutes` cho mọi role có `service_catalog.view` | `service_catalog.view` |
| `services.upsert` | Thêm/sửa dịch vụ (bao gồm upload `cover_photo_url`, `sample_photo_urls`) | `service_catalog.manage` |
| `addons.list` | Danh mục add-on (toàn bộ loại) | `order.create_edit` |
| `addons.listMuaProducts` | Danh mục add-on loại `MUA_PRODUCT` (chỉ trả về items MUA cần chọn khi thêm vào đơn) | `order.add_mua_addon` |
| `addons.upsert` | Thêm/sửa add-on | `addon.manage_all` |
| `vouchers.list` | Danh sách voucher | `voucher.view` |
| `vouchers.upsert` | Tạo/vô hiệu voucher | `voucher.manage` |
| `vouchers.apply` | Áp voucher (check + increment used_count với LockService) | `order.create_edit` |

### 16.6 Hậu Kỳ & Album

| Action | Mô tả | Required permission |
|---|---|---|
| `hauky.list` | Danh sách task hậu kỳ | `hau_ky.view_all` |
| `hauky.update` | Cập nhật tiến độ hậu kỳ (status: PENDING→IN_PROGRESS→REVIEW→DONE, notes) | `hau_ky.assign_update` |
| `hauky.notifyReady` | Hậu Kỳ thông báo đã hoàn thành edit — tạo notification `HK_READY_FOR_REVIEW` đến Manager + Sale, để họ gửi link cho KH vào webapp duyệt. Yêu cầu `HAU_KY_TASK.status = DONE` và `ALBUM.edited_link` đã có. | `hau_ky.assign_update` |
| `orders.uploadRawLink` | Photographer upload raw_link vào ORDER sau buổi chụp. Tạo notification `RAW_UPLOADED` đến Manager + Sale. | `order.upload_raw_link` |
| `orders.addMuaAddon` | MUA thêm ORDER_ADDON loại `MUA_PRODUCT` vào đơn mình được assign. GAS hard-check: addon phải là MUA_PRODUCT, và user phải có `assigned_mua_id` trong một CONCEPT của đơn. | `order.add_mua_addon` |
| `albums.list` | Danh sách album của đơn (bao gồm spec, loại sản phẩm). Support dùng để xem thông tin giao hàng | `album.manage` hoặc `album.view` |
| `albums.upsert` | Tạo/sửa album, cập nhật edited_link | `album.manage` |
| `shipping.list` | Danh sách đơn giao hàng | `shipping.update` |
| `shipping.update` | Cập nhật tracking, xác nhận giao + thu tiền | `shipping.update` |

### 16.7 Tài chính & Lương

| Action | Mô tả | Required permission |
|---|---|---|
| `finance.income` | Bảng thu theo tháng/cơ sở | `finance.view_all` |
| `finance.expense` | Bảng chi theo tháng/cơ sở | `finance.view_all` |
| `finance.debt` | Bảng công nợ | `finance.view_all` |
| `salary.list` | Bảng lương tháng | `salary.view_all` hoặc `salary.view_own` |
| `salary.compute` | Tính lại lương tháng cho 1 nhân sự | `salary.manage_config` |
| `bonus_penalty.upsert` | Thêm thưởng/phạt | `bonus_penalty.manage` |

### 16.8 Nhân sự & Phân quyền

| Action | Mô tả | Required permission |
|---|---|---|
| `users.list` | Danh sách nhân sự | `salary.manage_config` |
| `users.upsert` | Thêm/sửa nhân sự, cập nhật lương config | `salary.manage_config` |
| `roles.list` | Danh sách vai trò | `role.manage` |
| `roles.upsert` | Tạo/sửa vai trò | `role.create` |
| `permissions.update` | Cập nhật ma trận quyền | `role.manage` |
| `settings.update` | Cập nhật SETTINGS (slots, threshold, logo) | hardcoded Manager only |

### 16.9 Webhook (machine-to-machine)

| Endpoint | Gọi bởi | Auth |
|---|---|---|
| `POST /webhook/photo-selected` | Webapp chọn ảnh | `webhook_secret` từ SETTINGS |
| `POST /webhook/photo-approved` | Webapp chọn ảnh | `webhook_secret` từ SETTINGS |

### 16.10 Notifications

| Action | Mô tả |
|---|---|
| `notifications.list` | Lấy thông báo chưa đọc của user hiện tại |
| `notifications.markRead` | Đánh dấu đã đọc |

---

## 17. Audit Log — ORDER_HISTORY

Mọi thay đổi quan trọng trên ORDER đều được ghi lại tự động bởi GAS.

```
ORDER_HISTORY
 ├── history_id
 ├── order_id
 ├── changed_by      (user_id)
 ├── changed_at      (timestamp GMT+7)
 ├── action          (STATUS_CHANGE | FIELD_UPDATE | STAFF_ASSIGN | PAYMENT | CANCEL)
 ├── field_name      (nullable — tên field bị thay đổi)
 ├── old_value       (nullable — giá trị cũ, dạng string)
 └── new_value       (nullable — giá trị mới, dạng string)
```

**Các sự kiện được log bắt buộc:**

| Sự kiện | action | Ghi chú |
|---|---|---|
| Chuyển trạng thái đơn | `STATUS_CHANGE` | old/new = tên trạng thái |
| Sửa giá concept | `FIELD_UPDATE` | field = "custom_price" |
| Assign/đổi nhân sự | `STAFF_ASSIGN` | old/new = staff_id |
| Thu tiền / cọc | `PAYMENT` | new_value = số tiền thu |
| Hủy đơn | `CANCEL` | new_value = cancel_reason |
| Sửa lương config | `FIELD_UPDATE` | ghi lại bởi Manager action |

> Nhân sự không thể xóa hay sửa ORDER_HISTORY. Tab này chỉ append — không có action update/delete.

---

## 18. Notification System

### 18.1 Cơ chế

Hệ thống dùng **polling-based in-app notification** — không cần WebSocket hay external service.

```
NOTIFICATIONS
 ├── notif_id
 ├── user_id         (người nhận)
 ├── type            (DEADLINE_RAW | DEADLINE_HK | DEADLINE_SHIP | PHOTO_SELECTED | PHOTO_APPROVED | RAW_UPLOADED | STAFF_ASSIGNED | HK_READY_FOR_REVIEW | INFO)
 ├── order_id        (nullable — liên kết đến đơn liên quan)
 ├── message         (nội dung hiển thị tiếng Việt)
 ├── is_read         (boolean)
 ├── created_at
 └── expires_at      (nullable — tự ẩn sau X ngày)
```

**Frontend polling:** mỗi 60 giây gọi `notifications.list` → hiển thị badge số lượng chưa đọc trên navbar.

### 18.2 Trigger tạo thông báo

| Trigger | Người nhận | Loại |
|---|---|---|
| Photographer chưa gửi `raw_link` sau X ngày | Manager + Photographer đó | `DEADLINE_RAW` |
| HAU_KY_TASK quá `deadline` chưa DONE | Manager + Hậu Kỳ assigned | `DEADLINE_HK` |
| Album in ấn chưa chuyển SHIPPING sau Y ngày | Manager + Support | `DEADLINE_SHIP` |
| Webhook `photo-selected` nhận được | Hậu Kỳ assigned (hoặc tất cả Hậu Kỳ nếu chưa assign) | `PHOTO_SELECTED` |
| Webhook `photo-approved` nhận được | Hậu Kỳ assigned + Manager | `PHOTO_APPROVED` |
| Photographer gọi `orders.uploadRawLink` thành công | Manager + Sale phụ trách đơn | `RAW_UPLOADED` |
| Sale/Manager assign nhân sự vào concept (`STAFF_ASSIGN` log) | Nhân sự vừa được assign (Photographer/MUA/Hậu Kỳ/Support). **Dedup rule:** GAS chỉ tạo 1 notification STAFF_ASSIGNED per (user_id, order_id) — nếu cùng người được assign vào nhiều concept của đơn, chỉ gửi 1 lần. | `STAFF_ASSIGNED` |
| Hậu Kỳ gọi `hauky.notifyReady` | Manager + Sale phụ trách đơn | `HK_READY_FOR_REVIEW` |

**GAS Time-Trigger** (cron): Một trigger chạy **mỗi 1 giờ** quét tất cả đơn đang active → tạo NOTIFICATIONS nếu phát hiện vi phạm deadline. Threshold X và Y lấy từ SETTINGS.

### 18.3 Email fallback

Với cảnh báo `DEADLINE_RAW` và `DEADLINE_HK` quan trọng: GAS dùng `MailApp.sendEmail()` gửi thêm email đến Manager (email lấy từ USERS). Cấu hình bật/tắt trong SETTINGS (`email_alerts_enabled`).

### 18.4 Chiến lược cleanup (tăng trưởng dữ liệu)

**NOTIFICATIONS**: GAS cron chạy **mỗi ngày lúc 2:00 AM** xóa các thông báo đã đọc (`is_read = true`) hoặc đã qua `expires_at` quá 7 ngày. Thông báo chưa đọc giữ tối đa 30 ngày.

**ORDER_HISTORY**: Append-only, không xóa. Ước tính tăng trưởng: 50 đơn/tháng × 10 events = 500 rows/tháng → ~6.000 rows/năm. Google Sheets xử lý tốt đến ~500.000 rows, đủ dùng ~80 năm ở quy mô này. Khi cần archive: GAS có thể export rows cũ sang file Sheets mới theo năm.

---

## 19. SETTINGS — Danh sách key chuẩn

Tab SETTINGS lưu theo cấu trúc: `key | value | description`

| Key | Giá trị mặc định | Mô tả |
|---|---|---|
| `slot_times` | `08:00,10:00,12:00,14:00,16:00,18:00` | Khung giờ cố định (comma-separated) |
| `deadline_raw_days` | `1` | Số ngày sau ĐÃ CHỤP trước khi cảnh báo chậm gửi raw |
| `deadline_hk_days` | `0` | Cảnh báo ngay khi quá hk_deadline (0 = ngay lập tức) |
| `deadline_ship_days` | `3` | Số ngày sau CHỜ IN trước khi cảnh báo chậm giao |
| `logo_url` | `""` | URL logo webapp (Google Drive share link hoặc CDN URL) |
| `webhook_secret` | `""` | Shared secret cho webhook từ webapp chọn ảnh |
| `email_alerts_enabled` | `true` | Bật/tắt email cảnh báo |
| `email_alert_recipient` | `""` | Email nhận cảnh báo (Manager) |
| `notification_expiry_days` | `30` | Số ngày giữ notification chưa đọc |

> GAS đọc SETTINGS vào `CacheService` (cache 10 phút) để tránh đọc Sheets mỗi request. Khi Manager cập nhật qua `settings.update` → GAS xóa cache để giá trị mới có hiệu lực ngay.

---

## 20. Performance & Stability

> **Mục tiêu**: Mọi click chuột phản hồi trong vòng **150ms** (UI). Dữ liệu hiển thị trong vòng **1.5s** kể từ khi trang mở (stale-while-revalidate). GAS cold start không gây màn hình trắng.

---

### 20.1 Phân tầng dữ liệu — Cache TTL theo độ thay đổi

Không phải dữ liệu nào cũng cần fetch mới. Phân 4 tầng:

| Tầng | Dữ liệu | Cache phía client | Invalidate khi nào |
|---|---|---|---|
| **Static** | `SERVICE_CATALOG`, `ADDON_CATALOG`, `LOCATIONS`, `ROLES` | `sessionStorage` — cả session, không re-fetch | Manager cập nhật → xoá key, reload lần sau |
| **Semi-static** | `USERS`, `ROLE_PERMISSIONS`, `VOUCHERS`, `SETTINGS` | `sessionStorage` — TTL 30 phút | Mutation liên quan → xoá key |
| **Dynamic** | `ORDERS` list, `NOTIFICATIONS`, `HAU_KY_TASK` list | Memory (React state) — TTL 60s (stale-while-revalidate) | Mutation → invalidate ngay |
| **Real-time** | `calendar.checkConflict`, `orders.get` khi đang sửa | Không cache — luôn fresh | — |

**Triển khai client cache:**
```javascript
// lib/cache.js — wrapper đơn giản cho sessionStorage
const cache = {
  get: (key) => {
    const item = sessionStorage.getItem(key)
    if (!item) return null
    const { data, expires } = JSON.parse(item)
    if (expires && Date.now() > expires) { sessionStorage.removeItem(key); return null }
    return data
  },
  set: (key, data, ttlMs = null) => {
    sessionStorage.setItem(key, JSON.stringify({
      data,
      expires: ttlMs ? Date.now() + ttlMs : null
    }))
  },
  del: (key) => sessionStorage.removeItem(key)
}
```

> **Lưu ý:** `localStorage` không khả dụng trong môi trường Claude artifact. Dùng `sessionStorage` — tồn tại suốt tab, mất khi đóng tab.

---

### 20.2 GAS Cold Start — Giải pháp keep-alive

**Vấn đề:** GAS ngủ sau ~5 phút không dùng → request đầu tiên mỗi buổi sáng hoặc sau giờ nghỉ mất 5–10s.

**Giải pháp — GAS Time-Trigger ping:**

```javascript
// Trong GAS: tạo trigger chạy mỗi 4 phút
function setupKeepAlive() {
  ScriptApp.newTrigger('keepAlive')
    .timeBased().everyMinutes(4).create()
}

function keepAlive() {
  // Không làm gì — chỉ cần GAS thức dậy
  // Chi phí: ~1 GAS execution/4 phút = 360 executions/ngày
  // Quota GAS free: 90 phút/ngày runtime — keepAlive dùng < 1 giây/lần → an toàn
}
```

**Kết quả:** GAS luôn warm trong giờ làm việc. Cold start chỉ xảy ra nếu không ai dùng > 4 phút.

**Frontend fallback — khi vẫn bị cold start:**
```javascript
// Trang login: gọi auth.verify ngay khi mount (không đợi user click)
// → GAS warm trong lúc user điền form
useEffect(() => { gasApi.ping() }, [])
```

---

### 20.3 GAS Read Optimization — Không đọc toàn bộ Sheet

**Rule bắt buộc với mọi GAS function đọc Sheet:**

```javascript
// ❌ KHÔNG làm — chậm với sheet lớn
function getOrders() {
  return sheet.getDataRange().getValues() // đọc toàn bộ
}

// ✅ LÀM — filter ngay trong GAS, trả về ít row nhất có thể
function getOrders({ locationId, status, dateFrom, dateTo, limit = 50, offset = 0 }) {
  const data = sheet.getDataRange().getValues()
  return data
    .filter(row => {
      if (locationId && row[COL.location_id] !== locationId) return false
      if (status && row[COL.status] !== status) return false
      if (dateFrom && row[COL.shoot_date] < dateFrom) return false
      if (dateTo && row[COL.shoot_date] > dateTo) return false
      return true
    })
    .slice(offset, offset + limit) // phân trang server-side
}
```

**GAS CacheService — server-side cache cho data đọc nhiều:**

```javascript
// Cache ROLE_PERMISSIONS — đọc mỗi request auth
function getCachedPermissions(roleId) {
  const cache = CacheService.getScriptCache()
  const key = 'perms_' + roleId
  const cached = cache.get(key)
  if (cached) return JSON.parse(cached)
  const perms = readPermissionsFromSheet(roleId) // chỉ đọc 1 lần/5 phút/role
  cache.put(key, JSON.stringify(perms), 300)
  return perms
}

// Cache SETTINGS — đọc mỗi request
// Cache SERVICE_CATALOG — đọc khi tạo đơn
// Cache USERS list — đọc khi check double-booking
// TTL: SETTINGS = 600s, SERVICE_CATALOG = 1800s, USERS = 300s
```

**Batched response — `orders.get` trả về tất cả dữ liệu liên quan trong 1 call:**

```javascript
// 1 request thay vì 3
function getOrderFull(orderId) {
  return {
    order: readOrder(orderId),
    concepts: readConceptsByOrder(orderId),   // join trong GAS
    addons: readAddonsByOrder(orderId),        // join trong GAS
    hauky_task: readHauKyByOrder(orderId),     // join trong GAS
  }
  // Client nhận 1 response, không cần 3 round-trips
}
```

---

### 20.4 Optimistic UI — Click chuột phản hồi ngay lập tức

**Nguyên tắc:** Cập nhật UI **trước** khi GAS xác nhận. Rollback nếu server trả lỗi.

> ⚠️ **GAS luôn trả HTTP 200** cho mọi `doPost` — đây là giới hạn nền tảng của GAS Web Apps, không thể thay đổi. Không dùng `err.status` hay HTTP response code để detect lỗi. Mọi lỗi (conflict, permission denied, server error) phải được detect bằng cách **parse JSON body** trong phần `try` block. Fetch Promise chỉ reject khi có lỗi mạng thực sự (timeout, no connection).

**GAS Response Envelope — chuẩn bắt buộc cho mọi endpoint:**
```javascript
// GAS — mọi doPost phải trả về đúng format này
function jsonOk(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON)
}
function jsonError(appStatus, message) {
  // HTTP status luôn 200 — appStatus là mã lỗi nghiệp vụ trong body
  return ContentService.createTextOutput(JSON.stringify({ ok: false, status: appStatus, error: message }))
    .setMimeType(ContentService.MimeType.JSON)
}
// Dùng: return jsonError(409, 'Version conflict')
//       return jsonError(403, 'Permission denied')
//       return jsonError(400, 'Invalid status transition')
//       return jsonError(503, 'Auth service unavailable')
```

**Client gasApi wrapper — parse body, không parse HTTP status:**
```javascript
// lib/gasApi.js — wrapper dùng chung toàn app
async function gasApi(action, params = {}) {
  const token = await getIdToken() // Google Identity Services
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, action, ...params })
  })
  // HTTP status KHÔNG có ý nghĩa — GAS luôn 200
  const body = await res.json() // { ok, data } hoặc { ok, status, error }
  if (!body.ok) {
    const err = new Error(body.error || 'GAS error')
    err.appStatus = body.status // 409, 403, 400, 503...
    throw err
  }
  return body.data
}
```

**Optimistic update pattern — rollback dựa trên `err.appStatus`:**
```javascript
async function updateOrderStatus(orderId, newStatus) {
  // 1. Snapshot state cũ để rollback
  const prevOrders = orders

  // 2. Cập nhật UI ngay (0ms delay)
  setOrders(prev => prev.map(o =>
    o.order_id === orderId ? { ...o, status: newStatus } : o
  ))

  try {
    // 3. Gửi lên server (500–1500ms)
    await gasApi('orders.updateStatus', { order_id: orderId, status: newStatus, version: order.version })
    showToast('✓ Đã cập nhật trạng thái')
  } catch (err) {
    // 4. Rollback về state cũ
    setOrders(prevOrders)

    // 5. Phân loại lỗi từ appStatus trong body — KHÔNG từ HTTP status
    if (err.appStatus === 409) {
      showToast('Đơn vừa bị người khác sửa — đang tải lại…', 'error')
      invalidateCache('orders')
      router.refresh()
    } else if (err.appStatus === 403) {
      showToast('Không có quyền thực hiện thao tác này', 'error')
    } else if (err.appStatus === 503) {
      showToast('Dịch vụ xác thực tạm thời không khả dụng — thử lại', 'error')
    } else {
      showToast('Không thể cập nhật — thử lại', 'error')
    }
  }
}
```

**Các action dùng optimistic update:**

| Action | Optimistic | Rollback trigger |
|---|---|---|
| Chuyển trạng thái đơn | ✅ | 409, 403, network error |
| Upload raw_link | ✅ | lỗi bất kỳ |
| Mark notification đã đọc | ✅ | không rollback (low-stakes) |
| Cập nhật tiến độ hậu kỳ | ✅ | lỗi bất kỳ |
| Tạo đơn mới | ❌ không optimistic | cần server trả order_id mới |
| Chuyển trạng thái cần modal | ❌ không optimistic | cần user xác nhận trước |

---

### 20.5 Stale-While-Revalidate — Dữ liệu hiện ngay, cập nhật nền

Thay vì: **hiện skeleton → chờ fetch → hiện data**  
Dùng: **hiện data cũ ngay → fetch mới → swap khi có**

```javascript
// lib/useGasData.js — SWR-like hook không cần thư viện
function useGasData(action, params, ttlMs = 60_000) {
  const cacheKey = action + JSON.stringify(params)
  const [data, setData] = useState(() => cache.get(cacheKey)) // hiện data cũ ngay
  const [loading, setLoading] = useState(!data) // chỉ skeleton nếu không có cache

  useEffect(() => {
    gasApi(action, params).then(fresh => {
      setData(fresh)
      cache.set(cacheKey, fresh, ttlMs)
      setLoading(false)
    })
  }, [cacheKey])

  return { data, loading }
}

// Dùng:
const { data: orders, loading } = useGasData('orders.list', { status: 'active' })
// → orders hiện ngay từ cache, GAS fetch chạy nền, swap khi về
```

---

### 20.6 Phân trang (Pagination) — Tránh đọc toàn bộ ORDER

GAS trả về tối đa **50 rows/request** cho danh sách đơn. Client dùng infinite scroll hoặc nút "Tải thêm":

```javascript
// GAS endpoint: orders.list nhận thêm { limit, offset }
// Default: limit=50, offset=0

// Client state
const [orders, setOrders] = useState([])
const [offset, setOffset] = useState(0)
const [hasMore, setHasMore] = useState(true)

async function loadMore() {
  const result = await gasApi.orders.list({ ...filters, limit: 50, offset })
  setOrders(prev => [...prev, ...result.orders])
  setOffset(o => o + 50)
  setHasMore(result.orders.length === 50)
}
```

**Trang đơn mặc định filter 30 ngày gần nhất** — không load lịch sử toàn bộ trừ khi user chủ động mở rộng.

---

### 20.7 Code Splitting — Load theo role

Next.js lazy load từng module dựa trên permission, giảm bundle size:

```javascript
// Chỉ Photographer, MUA, Hậu Kỳ mới cần module Hậu Kỳ
const HauKyModule = dynamic(() => import('@/modules/HauKy'), {
  loading: () => <SkeletonCard />,
  ssr: false
})

// Chỉ Manager mới cần module Tài chính
const FinanceModule = dynamic(() => import('@/modules/Finance'), {
  loading: () => <SkeletonCard />,
  ssr: false
})
```

**Kết quả:** Bundle initial load giảm ~40% cho Photographer/MUA vì không tải code Tài chính, Nhân sự, Lương toàn hệ thống.

---

### 20.8 Debounce & Throttle — Không spam GAS

```javascript
// Tìm kiếm KH theo SĐT — debounce 400ms
const searchCustomer = useMemo(
  () => debounce((phone) => gasApi.customers.search({ phone }), 400),
  []
)

// Không gọi calendar.checkConflict mỗi keystroke khi nhập giờ
const checkConflict = useMemo(
  () => debounce((params) => gasApi.calendar.checkConflict(params), 600),
  []
)
```

---

### 20.9 Điểm target & Monitoring

| Metric | Target | Đo bằng |
|---|---|---|
| Time to Interactive (TTI) | < 2s (warm GAS) | Chrome DevTools |
| First Contentful Paint (FCP) | < 0.8s (từ cache) | Lighthouse |
| Click-to-feedback | < 150ms | Optimistic UI |
| GAS response time (warm) | < 600ms | Network tab |
| GAS response time (cold) | < 12s với skeleton | User experience |
| Order list load (50 rows) | < 1s | GAS logs |

**GAS execution log** — thêm timing vào mọi GAS function:
```javascript
function doPost(e) {
  const start = Date.now()
  // ... xử lý ...
  console.log(`[${action}] ${Date.now() - start}ms`) // xem trong GAS Executions tab
}
```

---

*Tài liệu này là nền tảng để build prompt cho Claude hoặc briefing cho developer. Mọi thay đổi nghiệp vụ cần cập nhật tại đây trước khi bắt đầu code.*
