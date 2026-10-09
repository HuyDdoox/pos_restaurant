---
name: frontend-standards
description: >-
  Kích hoạt skill này khi được yêu cầu viết mã nguồn TypeScript, thao tác với Giao diện (DOM), định nghĩa Class (OOP), sử dụng Decorator, gọi API fetch hoặc cấu hình Webpack.
---

# KỸ NĂNG VÀ TIÊU CHUẨN THỰC THI (FRONTEND STANDARDS)

Đây là kim chỉ nam cho mọi dòng code bạn viết trong dự án này.

## Kỹ năng 1: Thao tác với DOM (Giao diện)
Khi cần lấy dữ liệu từ form hoặc can thiệp vào HTML:
1. LUÔN LUÔN ép kiểu (Type Casting) bằng từ khóa `as`.
   - Ví dụ ô nhập liệu: `document.querySelector('input[name="ten"]') as HTMLInputElement;`
   - Ví dụ thẻ div: `document.getElementById('app') as HTMLDivElement;`
2. Lấy giá trị thì dùng `.value`, kiểm tra checkbox dùng `.checked`.
3. Gắn sự kiện ưu tiên dùng `.addEventListener('click', ...)` để tránh đè event.

## Kỹ năng 2: Khai báo Lớp (OOP Class) & Kế thừa
Khi được yêu cầu viết Class:
1. Định nghĩa thuộc tính với mức độ truy cập rõ ràng: `public`, `private`, `protected`.
2. Truyền tham số khởi tạo qua `constructor()`.
3. Nếu kế thừa từ class cha (extends), BẮT BUỘC phải gọi `super()` bên trong `constructor` của class con trước khi dùng `this`.

## Kỹ năng 3: Viết Decorators
Khi được yêu cầu sử dụng Decorator để kiểm tra/thêm tính năng:
- **Class Decorator:** Viết hàm nhận tham số `constructor`, trả về một class mới extends constructor cũ.
- **Property Decorator:** Thường dùng để validate (VD: kiểm tra độ dài chuỗi). Nhớ dùng `Object.defineProperty` để thiết lập `get` và `set`.
- **Áp dụng:** Đặt tên decorator bắt đầu bằng `@` ngay phía trên Class, Property hoặc Method.

## Kỹ năng 4: Gọi API với Fetch
- Dùng `async/await` kết hợp `fetch()` và `.json()` để lấy dữ liệu.
- Bắt buộc xử lý lỗi qua khối `try...catch`.
- Định nghĩa rõ kiểu dữ liệu trả về thông qua Interface (TypeScript) thay vì dùng `any`.
- Các hằng số URL nên được truy xuất từ `config.ts` hoặc các biến tĩnh liên quan.

## Kỹ năng 5: Đóng gói với Webpack
- Mọi module được viết trong thư mục `src/` phải được export/import đúng chuẩn ES Module.
- Khi viết code xong, phải đảm bảo có thể chạy lệnh `npm run build` (lệnh gọi Webpack) để xuất file ra thư mục đích mà không bị lỗi TypeScript.
