# 🍳 KITCHEN DISPLAY SYSTEM (KDS) - BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Dự án:** Restaurant POS  
**Phân hệ:** Nhà Bếp (Kitchen Display System - KDS)  
**Vai trò thiết kế:** Senior System Analyst  
**Mục đích tài liệu:** Tài liệu này đóng vai trò là "bộ não" ghi nhớ các quy tắc nghiệp vụ, logic và luồng người dùng cốt lõi của phân hệ KDS.  
**Nguyên tắc tuân thủ (Strict Compliance):** Mọi tác vụ phát triển code, xây dựng logic hay thiết kế UI/UX cho phân hệ KDS từ nay về sau **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy tắc trong tài liệu này. Không được phép tự ý thay đổi hay chế cháo (fabricate) logic khác ngoài các quy định dưới đây.

---

## 1. NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

### 1.1. Item Grouping (Gom nhóm đơn hàng)
*   **Quy tắc:** Đơn hàng (Order) đổ về KDS phải được **gom nhóm theo Món ăn (Dish)** thay vì hiển thị rời rạc theo từng Bàn (Table).
*   **Mục đích:** Tối ưu hóa mẻ nấu, giúp đầu bếp dễ dàng chế biến số lượng lớn cùng một món cho nhiều bàn trong một lần thao tác.

### 1.2. FIFO (First In, First Out - Vào trước ra trước)
*   **Quy tắc:** Hệ thống hiển thị danh sách món ăn phải ưu tiên tuân thủ nguyên tắc thời gian.
*   **Logic hiển thị:** Các món được order trước (thời gian ghi nhận order sớm nhất) phải được **ưu tiên đẩy lên trên cùng** để đảm bảo khách đến trước được phục vụ trước.

### 1.3. SLA Timeout (Cảnh báo vượt quá thời gian cam kết)
*   **Quy tắc:** Mỗi thẻ món ăn phải đi kèm một đồng hồ đếm ngược (Countdown Timer) tính từ lúc order được đẩy xuống bếp.
*   **Cảnh báo:** Nếu vượt quá thời gian quy định (Ví dụ: SLA = **5 phút**) mà món ăn đó chưa được nhận nấu (chưa chuyển trạng thái), thẻ món ăn đó phải **tự động chớp đỏ** để cảnh báo thị giác cho toàn bộ khu bếp.

### 1.4. Inventory Sync (Đồng bộ tồn kho tức thời)
*   **Quy tắc:** Trên mỗi thẻ món ăn hoặc giao diện quản lý nhanh của KDS phải có nút **"Báo hết hàng" (Out of Stock)**.
*   **Tác động hệ thống:** Khi đầu bếp bấm nút này, hệ thống phải **lập tức khóa món đó trên toàn bộ menu** hiển thị của Khách hàng (Menu điện tử) và của Nhân viên phục vụ (Waiter app) thuộc nhánh (Branch) đó, ngăn chặn việc tiếp tục nhận order không thể phục vụ.

---

## 2. LUỒNG NGHIỆP VỤ BẾP (USER FLOW)

Dưới đây là luồng vận hành chuẩn (Standard Operating Procedure) của Đầu bếp trên hệ thống KDS:

*   **Bước 1: Xác thực**
    *   Người dùng đăng nhập vào hệ thống bằng tài khoản được cấp quyền **Chef**.

*   **Bước 2: Giám sát chờ xử lý (Pending View)**
    *   Màn hình KDS hiển thị các thẻ món ăn đang ở trạng thái chờ.
    *   Mỗi thẻ món ăn **BẮT BUỘC** hiển thị đủ 3 luồng thông tin:
        1.  **Số lượng tổng:** Tổng số phần cần nấu của món đó ở mẻ hiện tại.
        2.  **Số bàn:** Danh sách các bàn đang đợi món (Ví dụ: Bàn 1, Bàn 5, Bàn 12).
        3.  **Ghi chú:** Các tùy chỉnh của khách (Ví dụ: không hành, ít cay) hoặc sự cố ghi nhận.

*   **Bước 3: Tiếp nhận chế biến (Start Cooking)**
    *   Đầu bếp bấm nút **"Nhận nấu"** trên thẻ món ăn.
    *   **System Logic:** Hệ thống chuyển trạng thái bản ghi tương ứng trong bảng `OrderDetails` sang **`'Cooking'`**.

*   **Bước 4: Hoàn tất chế biến (Mark as Ready)**
    *   Sau khi món ăn được nấu xong và đặt lên quầy chờ phục vụ, Đầu bếp bấm nút **"Đã nấu xong"** (hoặc "Hoàn thành").
    *   **System Logic:**
        1.  Chuyển trạng thái bản ghi `OrderDetails` sang **`'Ready'`**.
        2.  Hệ thống lập tức kích hoạt **Thông báo đẩy (Push Notification)** đến máy POS hoặc thiết bị cầm tay của Nhân viên phục vụ (Waiter) để thông báo món đã sẵn sàng mang ra bàn.

---
*Tài liệu được cập nhật và duy trì bởi Antigravity (AI System Analyst).*
