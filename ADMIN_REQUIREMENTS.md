# 🛡️ ADMIN SYSTEM - BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Dự án:** Restaurant POS  
**Phân hệ:** Quản trị viên (Admin System)  
**Vai trò thiết kế:** Senior System Analyst  
**Mục đích tài liệu:** Tài liệu này đóng vai trò là "bộ não" ghi nhớ các quy tắc nghiệp vụ, logic và luồng người dùng cốt lõi của phân hệ Quản trị (Admin Dashboard).  
**Nguyên tắc tuân thủ (Strict Compliance):** Mọi tác vụ phát triển code, xây dựng logic hay thiết kế UI/UX cho phân hệ Quản trị từ nay về sau **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy tắc trong tài liệu này. Không được phép tự ý thay đổi hay chế cháo (fabricate) logic khác.

---

## 1. NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

### 1.1. Quản lý Thực đơn & Biến thể (Menu & Variants CRUD)
*   **Quy tắc:** Admin là người duy nhất có quyền kiểm soát toàn diện cây thư mục danh mục và món ăn.
*   **Hành động:** 
    *   Thêm, Sửa thông tin cơ bản (Hình ảnh, Tên, Giá bán).
    *   Cấu hình Biến thể (Variants) như Size (L, M, S) hoặc Topping (Thêm trân châu, phô mai).
*   **Soft Delete (Xóa mềm):** Khi một món không còn kinh doanh, Admin **KHÔNG** xóa vĩnh viễn khỏi CSDL (để bảo toàn lịch sử hóa đơn). Thay vào đó, hệ thống thực hiện **Xóa mềm (Ngừng bán)** bằng cách thay đổi trạng thái bản ghi thành `Archived` hoặc `Inactive`.

### 1.2. Quản lý Kho & Định lượng (Inventory & Recipes)
*   **Quy tắc Nguyên liệu (Ingredients):** Admin khai báo danh sách các nguyên liệu thô đầu vào (như Thịt bò, Gạo, Đường, Trứng) kèm đơn vị tính.
*   **Quy tắc Định lượng (Recipes):** Admin thiết lập công thức tiêu hao cho từng món ăn. (Ví dụ: 1 phần Cơm chiên sẽ trừ 0.2kg Gạo, 1 quả Trứng trong kho). Điều này hỗ trợ tính toán giá vốn và cảnh báo nhập hàng.

### 1.3. Quản lý Nhân sự & Phân quyền (RBAC - Role-Based Access Control)
*   **Quy tắc:** Mọi tài khoản nhân viên đều do Admin sinh ra và quản lý tập trung.
*   **Vai trò (Roles):** Cấp phát đúng quyền hạn cho 4 cấp độ: Admin (Quản trị), Cashier (Thu ngân), Waiter (Phục vụ), Chef (Bếp).
*   **Khóa tài khoản (Locking):** Khi nhân sự nghỉ việc hoặc vi phạm, Admin tiến hành vô hiệu hóa tài khoản và **BẮT BUỘC** phải nhập `lock_reason` (lý do khóa) để lưu vết kiểm toán (Audit Trail).

### 1.4. Báo cáo & Kiểm soát Thất thoát (Reporting & Loss Control)
*   **Doanh thu:** Xem các biểu đồ trực quan thống kê dòng tiền theo Ngày, Tuần, Tháng hoặc theo từng Ca làm việc (Shifts) của thu ngân.
*   **Báo cáo Thất thoát:** Một màn hình cực kỳ quan trọng dùng để đối soát tài chính dựa trên các sự cố do Phục vụ/Bếp báo cáo (món ăn bị hủy, rơi vỡ, nấu hỏng). Admin dựa vào đây để truy cứu trách nhiệm và tính toán chi phí hao hụt.

---

## 2. LUỒNG NGHIỆP VỤ QUẢN TRỊ (USER FLOW)

Dưới đây là hành trình tiêu chuẩn của Admin khi vận hành hệ thống:

*   **Bước 1: Entry (Xác thực quyền cao nhất)**
    *   Đăng nhập hệ thống bằng tài khoản quyền Admin.

*   **Bước 2: Xây dựng nền tảng dữ liệu (Setup Flow)**
    *   Vào tab **Nguyên liệu**: Tạo danh sách nguyên liệu thô.
    *   Vào tab **Thực đơn**: Tạo Danh mục -> Tạo Món ăn -> Gắn Biến thể -> Gắn Công thức định lượng (Recipes).

*   **Bước 3: Vận hành Nhân sự (HR Flow)**
    *   Vào tab **Nhân viên**: Tạo tài khoản cho nhân sự mới, cấp Role tương ứng.
    *   Khóa tài khoản nhân sự nghỉ việc (có ghi chú `lock_reason`).

*   **Bước 4: Kiểm soát & Đánh giá (Audit Flow)**
    *   Cuối ngày/Cuối tuần, truy cập tab **Báo cáo**.
    *   Check chéo Doanh thu hệ thống với số liệu Thu ngân nộp lên.
    *   Mở **Báo cáo Thất thoát** để xem các món bị Cancelled trong ngày và quyết định hướng xử lý.

---
*Tài liệu được cập nhật và duy trì bởi Antigravity (AI System Analyst).*
