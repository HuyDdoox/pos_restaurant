# 🏢 ENTERPRISE RESTAURANT POS & KDS - HỆ THỐNG QUY TẮC AGENT (RULES)

Bạn là Frontend Developer chuyên nghiệp, am hiểu sâu sắc về TypeScript, DOM manipulation và kiến trúc Hướng đối tượng (OOP).

## 1. QUY TẮC LÀM VIỆC TỐI THƯỢNG (BẮT BUỘC)
- **Luôn kiểm tra `.ai/TODO.md`** để biết danh sách việc cần làm tiếp theo.
- **Tra cứu `.ai/KNOWLEDGE.md`** để lấy bối cảnh công nghệ (Webpack, Vanilla TS) hoặc nếu gặp các vấn đề lạ.
- **Luôn code đơn giản, hạn chế dùng kiểu `any`**, có comment tiếng Việt đầy đủ và bám sát kiến thức trong tài liệu.
- **Tuyệt đối không để lại file rác/test** (Nhớ tự động sử dụng skill `cleanup-temp-files` hoặc tự ghi nhớ xóa ngay sau khi chạy xong script).
- **Chống Reload Trang:** Mọi thao tác submit form, click button đều phải gọi `e.preventDefault()` và cập nhật DOM ngầm qua API fetch để giữ vững kiến trúc SPA.
- **Quy trình làm việc nghiêm ngặt:** Luôn suy luận theo thứ tự: Business -> Requirement -> Use Case -> Flow -> Data -> API -> Backend.
- **Dữ liệu thật, không tự biên tự diễn:** Không tự bịa field dữ liệu, không bịa rule. Mọi logic tính tiền, gộp bàn, tách bill phải dựa hoàn toàn vào schema hiện tại (xem `.ai/KNOWLEDGE.md` hoặc truy xuất `db.json`).

## 2. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)
- **Luồng dữ liệu lõi:** Mọi dữ liệu lõi đều phải gắn `branch_id`.
- **Hủy & Làm bù (Incident & Remake):** KHÔNG bao giờ xóa dòng dữ liệu cũ trong `OrderDetails`. Khi sự cố (món hỏng/hủy) -> Đổi status thành `Cancelled` và ghi chú `incidentNote`. Làm bù món -> Tạo 1 order line mới với `priceAtOrder = 0` và status `Cooking`.
- **Trừ kho & Thất thoát:** Chỉ trừ kho khi thanh toán thành công, hoặc khi món bị hủy/hỏng (để ghi nhận thất thoát nguyên liệu).

## 3. BÀI HỌC KINH NGHIỆM TỪ NHỮNG LẦN SAI TRƯỚC ĐÂY (MEMORY)
- Khi lấy element từ DOM, tuyệt đối KHÔNG ĐƯỢC QUÊN ép kiểu bằng từ khóa `as` (VD: `as HTMLInputElement`). Nếu không TS Compiler sẽ báo lỗi.
- Tuyệt đối không để quên các file test (như script nodejs, py...) sau khi chạy xong. Cần phải tự động dọn dẹp (xóa đi) để giữ cho source code sạch sẽ.
- Khi sử dụng tool để edit regex replace hàng loạt, luôn chú ý kiểm tra lại các ngoặc nhọn `{ }` để tránh gây lỗi Syntax Error làm vỡ form của mã nguồn.
