# WORKSPACE RULES & BEHAVIORAL PROTOCOL

## 1. PHÂN ĐỊNH RÕ GIỮA TRẢ LỜI CÂU HỎI VÀ THỰC HIỆN HÀNH ĐỘNG
- **Trường hợp là câu hỏi, giải thích, tư vấn kỹ thuật:**
  - AI phải trả lời trực tiếp, rõ ràng, phân tích đầy đủ ngay cho người dùng (KHÔNG cần chờ duyệt).

- **Trường hợp là hành động can thiệp (Tạo/sửa/xóa file, cài thư viện, chạy lệnh sửa đổi hệ thống...):**
  1. AI phải giải thích rõ mục tiêu và liệt kê chi tiết các file sẽ tạo hoặc chỉnh sửa.
  2. AI phải trình bày kế hoạch từng bước cụ thể.
  3. AI phải DỪNG LẠI và chờ người dùng duyệt (bấm/gõ: OK, Duyệt, Làm đi...).
  4. Tuyệt đối KHÔNG tự ý sửa code hay chạy lệnh thay đổi nếu người dùng chưa đồng ý.

## 2. NGUYÊN TẮC BẢO TOÀN DỮ LIỆU & CODE (INTEGRITY)
- Bảo toàn toàn bộ comment, docstring và cấu trúc code hiện có nếu không liên quan đến yêu cầu thay đổi.
- Luôn kiểm tra kỹ tác động phụ trước khi đề xuất giải pháp.
