# PROJECT TASK TRACKING (TYPESCRIPT)

## Cấu hình ban đầu (Setup)

- [X] Cấu hình `tsconfig.json` (`rootDir: src`, `outDir: public/js`, bật `experimentalDecorators`).
- [X] Cấu hình `webpack.config.js` để bundle file `.ts`.
- [X] Khởi tạo file `db.json` và chạy lệnh `json-server`.

## Xây dựng Kiểu dữ liệu (Models/Types)

- [X] Định nghĩa `Interface` / `Type` cho dữ liệu Sản phẩm (Laptop, Hoa, v.v.).
- [X] Định nghĩa các `Enum` cần thiết (Màu sắc, Trạng thái).

## Xử lý Giao diện & Logic (DOM & Logic)

- [X] Hàm render danh sách sản phẩm ra HTML.
- [X] Form thêm mới sản phẩm (ép kiểu DOM, lấy value).
- [X] Xử lý Validate form bằng Property / Method Decorators.

## Tương tác API & Module hóa

- [X] Tách code thành các file module riêng biệt (`base.ts`, `api.ts`, `app.ts`).
- [X] Viết hàm `fetch` lấy dữ liệu từ `json-server` đổ ra giao diện.
- [X] Chạy lệnh build Webpack (`npm run build`) để kiểm tra lỗi.
