# 📱 CUSTOMER SYSTEM - BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Dự án:** Restaurant POS  
**Phân hệ:** Khách hàng (Customer Web App / E-Menu)  
**Vai trò thiết kế:** Senior System Analyst  
**Mục đích tài liệu:** Tài liệu này đóng vai trò là "bộ não" ghi nhớ các quy tắc nghiệp vụ, logic và luồng người dùng cốt lõi của phân hệ Khách hàng (Self-ordering).  
**Nguyên tắc tuân thủ (Strict Compliance):** Mọi tác vụ phát triển code, xây dựng logic hay thiết kế UI/UX cho phân hệ Khách hàng từ nay về sau **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy tắc trong tài liệu này. Không được phép tự ý thay đổi hay chế cháo (fabricate) logic khác.

---

## 1. NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

### 1.1. No-Login Access (Trải nghiệm không rào cản)
*   **Quy tắc:** Mục tiêu tối thượng là khách hàng có thể xem thực đơn và đặt món ngay tại bàn mà **không bắt buộc phải đăng nhập** hay tạo tài khoản.
*   **System Logic:** Hệ thống nhận diện khách hàng thông qua hành vi quét mã QR tại bàn (hoặc chọn bàn giả lập). Tham số `tableId` sẽ được ghi nhận tự động và lưu trữ tạm thời vào bộ nhớ cục bộ của trình duyệt (LocalStorage/SessionStorage).

### 1.2. Hiển thị Menu & Kiểm soát Tồn kho (Live Inventory)
*   **Quy tắc:** Khách hàng được tự do lướt xem Danh mục (Categories) và Danh sách món (MenuItems).
*   **Logic Hết hàng (Out of Stock):** 
    *   Hệ thống phải kiểm tra trạng thái món theo thời gian thực (nhận tín hiệu từ Bếp/Quầy).
    *   Nếu món chuyển sang trạng thái `Out_of_stock`, giao diện **TỰ ĐỘNG** chuyển hình ảnh món đó sang màu xám đen (Grayscale), hiển thị nhãn "Hết hàng" và **vô hiệu hóa (Disable) nút "Thêm"**.

### 1.3. Trải nghiệm Thêm vào giỏ (Seamless Add-to-cart)
*   **Quy tắc:** Khi khách bấm chọn món, tùy chỉnh (Ví dụ: ít đá, nhiều đường) và bấm "Thêm vào giỏ".
*   **Phản hồi (Feedback):** Giao diện tuyệt đối không được chuyển trang hay reload. Thay vào đó, lập tức hiển thị **Toast Notification** (Thông báo nhanh góc màn hình) báo hiệu thành công, giữ cho luồng chọn món của khách mượt mà không bị gián đoạn.

### 1.4. Giao diện Giỏ hàng (Live Cart 70/30)
*   **Quy tắc UX/UI:** Khi xem Giỏ hàng (Checkout), tỷ lệ chia màn hình chuẩn là **70%** (cho việc hiển thị chi tiết danh sách món đã chọn, kèm nút tăng giảm số lượng) và **30%** (cho panel chốt đơn, hiển thị Tổng tiền và Nút xác nhận).

### 1.5. Cơ chế Chống Spam (Anti-Spam Checkout)
*   **Quy tắc:** Đề phòng khách hàng nhấn đúp hoặc cố tình spam nút đặt hàng.
*   **System Logic:** Ngay khi khách bấm **"Xác nhận đặt món"**:
    1. Lập tức **khóa nút (Disable/Loading)**.
    2. Gọi API để sinh ra bản ghi lưu vào bảng `Orders` và `OrderDetails` với trạng thái ban đầu là **`Pending`**.
    3. Trả về thành công, sau đó hệ thống sẽ dọn dẹp sạch giỏ hàng (Clear Cart) trên giao diện hiện tại.

---

## 2. LUỒNG NGHIỆP VỤ KHÁCH HÀNG (USER FLOW)

Dưới đây là hành trình tiêu chuẩn (Customer Journey) của thực khách khi sử dụng E-Menu:

*   **Bước 1: Entry (Đầu vào)**
    *   Khách ngồi vào bàn, dùng điện thoại quét mã QR dán trên mặt bàn.
    *   Trình duyệt mở ra, hệ thống ngầm lưu `tableId` = (Ví dụ: T005).

*   **Bước 2: Browsing & Add to Cart (Lựa chọn & Đặt giỏ)**
    *   Khách lướt xem danh mục và các món ăn hấp dẫn (đầy đủ màu sắc). Các món hết hàng tự động bị mờ xám.
    *   Khách bấm nút "(+)" hoặc "Thêm", chỉnh sửa ghi chú (nếu thích), sau đó bỏ vào giỏ. Toast báo thành công nổi lên rồi biến mất nhanh.

*   **Bước 3: Checkout (Chốt đơn)**
    *   Khách bấm vào biểu tượng Giỏ hàng, màn hình chuyển sang layout 70/30 (Bên trái: Danh sách món, Bên phải: Tổng tiền).
    *   Khách rà soát lại lần cuối rồi bấm **"Xác nhận đặt món"**. Nút xoay loading (chống spam).

*   **Bước 4: Outcome (Hoàn tất)**
    *   Màn hình hiển thị "Đặt món thành công! Vui lòng đợi trong giây lát".
    *   Đơn hàng được đẩy sang thiết bị của Phục vụ (trạng thái Pending). Giỏ hàng trên máy khách trở về số 0. Khách cất điện thoại chờ thức ăn ra.

---
*Tài liệu được cập nhật và duy trì bởi Antigravity (AI System Analyst).*
