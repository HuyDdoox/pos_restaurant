
# SKILLS & STANDARD OPERATING PROCEDURES (SOP)

## Kỹ năng 1: Khởi tạo Mongoose Model

Khi được yêu cầu tạo Model, hãy tuân thủ cấu trúc sau:

1. Require `mongoose` và `Schema`.
2. Khai báo schema với các thuộc tính cơ bản (`type`, `required`, `default`).
3. Dùng khóa ngoại thì khai báo `type: Schema.ObjectId, ref: 'ten_bang'`.
4. Xuất module: `module.exports = mongoose.models.tên || mongoose.model('tên', schema);`

## Kỹ năng 2: Viết RESTful API cơ bản

Khi được yêu cầu viết API CRUD (Thêm, Sửa, Xóa, Lấy danh sách):

1. Import Model tương ứng.
2. Viết router tương ứng (`router.get`, `router.post`, `router.put`, `router.delete`).
3. Nhận dữ liệu từ `req.body` (POST/PUT), `req.params` hoặc `req.query` (GET/DELETE).
4. Xử lý qua `try-catch`, trả về `res.json({ status: 1, message: "Thành công" })` nếu bắt được lỗi trả về `status: 0`.

## Kỹ năng 3: Upload File

Khi tạo tính năng upload:

- Phải import và cấu hình `multer` với `diskStorage`.
- Đường dẫn lưu mặc định: `./public/images/`.
