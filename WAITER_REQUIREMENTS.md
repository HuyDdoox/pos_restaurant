# 🍽️ WAITER SYSTEM - BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Dự án:** Restaurant POS  
**Phân hệ:** Phục vụ (Waiter System)  
**Vai trò thiết kế:** Senior System Analyst  
**Mục đích tài liệu:** Tài liệu này đóng vai trò là "bộ não" ghi nhớ các quy tắc nghiệp vụ, logic và luồng người dùng cốt lõi của phân hệ Phục vụ (Waiter).  
**Nguyên tắc tuân thủ (Strict Compliance):** Mọi tác vụ phát triển code, xây dựng logic hay thiết kế UI/UX cho phân hệ Phục vụ từ nay về sau **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy tắc trong tài liệu này. Không được phép tự ý thay đổi hay chế cháo (fabricate) logic khác.

---

## 1. NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

### 1.1. Xác nhận Order (Kiểm duyệt đơn hàng)
*   **Quy tắc:** Tiếp nhận đơn hàng do khách vừa đặt ở trạng thái chờ (`Pending`). Phục vụ có quyền kiểm soát trước khi đẩy xuống bếp.
*   **Hành động:** Phục vụ kiểm tra, điều chỉnh số lượng, thêm ghi chú (Ví dụ: ít đá, không hành), hoặc xóa món nếu khách đổi ý.
*   **System Logic:** Chỉ sau khi Phục vụ bấm nút **"Gửi Bếp"**, hệ thống mới đẩy trạng thái bản ghi `OrderDetails` sang **`Cooking`** để Bếp bắt đầu chế biến.

### 1.2. Bưng bê và Trả món (Serving)
*   **Quy tắc:** Hệ thống tự động nổ thông báo (Push Notification) đến thiết bị Phục vụ khi Bếp báo nấu xong (trạng thái `Ready`).
*   **Hành động:** Nhân viên bưng món từ quầy ra bàn cho khách và bấm xác nhận **"Đã mang ra bàn"**.
*   **System Logic:** Trạng thái món ăn chuyển sang **`Served`**.

### 1.3. Quản lý Sự cố & Hủy món (Incident Handling)
*   **Quy tắc:** Xử lý các tình huống như rơi vỡ, bếp nấu hỏng, hoặc khách phàn nàn muốn hủy.
*   **Hành động:** Phục vụ thao tác bấm **"Báo sự cố"** và **BẮT BUỘC** nhập lý do sự cố.
*   **System Logic:**
    1. Đổi trạng thái món ăn đó thành **`Cancelled`** và hệ thống tự động loại bỏ tiền của món đó khỏi tổng hóa đơn.
    2. Nếu nhà hàng quyết định bù món cho khách, hệ thống tự động sinh ra một bản ghi `OrderDetails` mới với giá **0đ**, trạng thái **`Cooking`** để Bếp nhận lệnh nấu lại.

### 1.4. Quản lý Menu (Khóa món hết hàng)
*   **Quy tắc:** Khi phát hiện hết nguyên liệu tại quầy hoặc Bếp báo ra.
*   **Hành động:** Nhân viên thao tác bấm **"Báo hết hàng"**.
*   **System Logic:** Hệ thống lập tức làm xám và khóa (Disable) món đó trên giao diện ứng dụng điện thoại của Khách hàng để chặn các lượt order tiếp theo.

### 1.5. Điều phối Bàn (Table Management)
*   **Quy tắc:** Hỗ trợ các nghiệp vụ nâng cao liên quan đến sắp xếp chỗ ngồi của khách.
*   **Hành động:**
    1. **Gộp bàn (Merge):** Thay đổi, chỉnh sửa liên kết các bàn lại với nhau để phục vụ nhóm khách đông.
    2. **Chuyển bàn (Switch):** Chuyển toàn bộ dữ liệu đơn hàng từ bàn hiện tại sang một bàn khác khi khách có yêu cầu đổi chỗ.

---

## 2. LUỒNG NGHIỆP VỤ PHỤC VỤ (USER FLOW)

Dưới đây là luồng vận hành chuẩn (Standard Operating Procedure) của nhân viên Phục vụ:

*   **Bước 1: Tiếp nhận và Duyệt món**
    *   Hệ thống báo có Order mới (Pending) từ bàn của khách.
    *   Phục vụ ra bàn xác nhận lại, cập nhật ghi chú (nếu có) và bấm **"Gửi Bếp"**.

*   **Bước 2: Phục vụ món ăn**
    *   Hệ thống nổ thông báo: *"Món [Tên Món] của [Bàn X] đã sẵn sàng!"* (Ready).
    *   Mang món ra bàn và bấm nút **"Đã mang ra bàn"**. (Trạng thái chuyển thành Served).

*   **Bước 3: Xử lý phát sinh (Tùy chọn)**
    *   Nếu có sự cố rơi vỡ/hỏng: Bấm **"Báo sự cố"** -> Nhập lý do -> Hủy tiền hoặc Bù món 0đ.
    *   Nếu khách muốn đổi bàn/ghép bàn: Dùng tính năng **"Chuyển bàn"** hoặc **"Gộp bàn"**.
    *   Nếu hết nguyên liệu: Bấm **"Báo hết hàng"** để khóa món ngay lập tức.

---
*Tài liệu được cập nhật và duy trì bởi Antigravity (AI System Analyst).*
