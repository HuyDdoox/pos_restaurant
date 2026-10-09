# 💵 CASHIER SYSTEM - BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Dự án:** Restaurant POS  
**Phân hệ:** Thu ngân (Cashier System)  
**Vai trò thiết kế:** Senior System Analyst  
**Mục đích tài liệu:** Tài liệu này đóng vai trò là "bộ não" ghi nhớ các quy tắc nghiệp vụ, logic và luồng người dùng cốt lõi của phân hệ Thu ngân (Cashier).  
**Nguyên tắc tuân thủ (Strict Compliance):** Mọi tác vụ phát triển code, xây dựng logic hay thiết kế UI/UX cho phân hệ Thu ngân từ nay về sau **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy tắc trong tài liệu này. Không được phép tự ý thay đổi hay chế cháo (fabricate) logic khác.

---

## 1. NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

### 1.1. Quản lý Ca làm việc (Shifts Management)
*   **Mở ca (Clock-in):** Khi bắt đầu ca, nhân viên thu ngân **bắt buộc** phải nhập số tiền mặt có sẵn trong két (`startingCash`).
*   **Đóng ca (Clock-out):** Khi kết thúc ca, hệ thống yêu cầu nhập số tiền thu thực tế đếm được (`endingCash`) để chốt sổ, tự động tính toán độ chênh lệch (nếu có).

### 1.2. Quản lý Sơ đồ bàn (Chiếm 60% diện tích màn hình)
*   **Quy tắc:** Hệ thống hiển thị bản đồ bàn ăn trực quan và phải cập nhật trạng thái theo thời gian thực.
*   **Mã màu quy chuẩn:**
    *   **Màu Xanh (Empty):** Bàn trống, sẵn sàng đón khách.
    *   **Màu Đỏ (Occupied/Serving):** Bàn đang có khách, đang phục vụ món.
    *   **Màu Vàng (Waiting for Payment):** Bàn đã yêu cầu tính tiền.

### 1.3. Xử lý Chi tiết Hóa đơn (Chiếm 40% diện tích màn hình)
*   **Quy tắc:** Khi thu ngân click vào một bàn Đang có khách (Màu Đỏ) hoặc Chờ thanh toán (Màu Vàng), màn hình bên phải (40%) sẽ tự động tải và hiển thị toàn bộ danh sách món ăn của bàn đó kèm Tổng tiền (`totalAmount`).
*   **Nghiệp vụ nâng cao:** 
    *   **Tách hóa đơn (Split Bill):** Cho phép chọn từng món riêng lẻ để khách thanh toán riêng (Share tiền).
    *   **Gộp hóa đơn (Merge Bill):** Cho phép tính tổng tiền của nhiều bàn lại với nhau (khi một người trả chung cho cả nhóm).

### 1.4. Thanh toán Đa phương thức (Multi-payment Methods)
*   **Quy tắc In tạm tính:** Trước khi thu tiền, hệ thống hỗ trợ in Bill tạm tính (Pre-receipt) để đưa khách đối chiếu.
*   **Tiền mặt (Cash):** Khi thanh toán bằng tiền mặt, popup thanh toán yêu cầu thu ngân nhập "Số tiền khách đưa", hệ thống sẽ **tự động tính ra "Số tiền thối lại" (Change)** để tránh sai sót.
*   **Chuyển khoản (Bank Transfer):** Nếu khách chọn chuyển khoản, hệ thống tự động sinh ra một **Mã QR động (Dynamic QR)** chứa sẵn số tài khoản của nhà hàng kèm chính xác Số tiền cần thanh toán để khách quét.

### 1.5. Giải phóng Bàn (Table Reset)
*   **Quy tắc:** Nghiệp vụ cuối cùng khép lại một vòng đời của luồng phục vụ.
*   **System Logic:** Ngay khi Thu ngân bấm "Xác nhận thanh toán", hệ thống thực hiện đồng thời 2 việc:
    1. Cập nhật trạng thái Order thành **`Paid`** (Đã thanh toán).
    2. Lập tức **Reset (giải phóng) bàn đó về lại Màu Xanh** (Trống) trên sơ đồ để lễ tân/phục vụ biết có thể đón khách mới.

---

## 2. LUỒNG NGHIỆP VỤ THU NGÂN (USER FLOW)

Dưới đây là luồng vận hành chuẩn (Standard Operating Procedure) của nhân viên Thu ngân:

*   **Bước 1: Bắt đầu làm việc**
    *   Đăng nhập hệ thống bằng tài khoản Cashier.
    *   Popup hiện lên bắt buộc nhập Tiền đầu ca (Starting Cash).

*   **Bước 2: Giám sát sơ đồ bàn**
    *   Nhìn sơ đồ bên trái (60% màn hình).
    *   Thấy bàn nhấp nháy Màu Vàng (Khách gọi thanh toán) -> Click vào bàn đó.

*   **Bước 3: Xử lý Bill**
    *   Màn hình bên phải (40%) hiện chi tiết các món.
    *   Bấm "In tạm tính" đưa Waiter mang ra cho khách xem trước.
    *   Xử lý Tách/Gộp bill nếu khách có yêu cầu đặc biệt.

*   **Bước 4: Thanh toán & Giải phóng bàn**
    *   Bấm nút **"Thanh toán"**.
    *   Chọn phương thức: Tiền mặt (nhập tiền khách đưa để tính tiền thừa) hoặc Chuyển khoản (Hiện mã QR).
    *   Bấm **"Xác nhận hoàn tất"**.
    *   Hệ thống lưu lịch sử đơn hàng, cập nhật doanh thu và trả bàn về Màu Xanh.

*   **Bước 5: Kết thúc ca**
    *   Bấm nút Đóng ca cuối ngày.
    *   Nhập Tiền thực tế (Ending Cash) và in báo cáo Z-Report.

---
*Tài liệu được cập nhật và duy trì bởi Antigravity (AI System Analyst).*
