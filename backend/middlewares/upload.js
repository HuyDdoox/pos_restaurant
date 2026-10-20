const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đường dẫn lưu trữ hình ảnh tải lên: public/images
const uploadDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ tệp trên đĩa cứng (DiskStorage)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Đặt tên tệp duy nhất để tránh bị trùng đè file
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${file.fieldname}-${uniqueSuffix}-${basename}${ext}`);
    }
});

// Kiểm tra định dạng tệp tải lên (chỉ cho phép hình ảnh)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận tệp hình ảnh (.jpg, .png, .webp, .gif)!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Giới hạn kích thước tối đa: 5MB
    },
    fileFilter: fileFilter
});

module.exports = upload;
