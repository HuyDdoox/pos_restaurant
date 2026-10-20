// Chuyển hướng và xử lý Upload ảnh qua Multer
var express = require('express');
var router = express.Router();

const upload = require('../middlewares/upload');

/**
 * =========================================================================
 * UPLOAD HÌNH ẢNH (MULTER DISK STORAGE)
 * =========================================================================
 */

// POST http://localhost:4000/upload hoặc /api/upload (Tải lên 1 ảnh - hàm upload.single)
router.post(['/', '/upload'], upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 0, message: "Không tìm thấy tệp ảnh tải lên!", url: "" });
        }
        const fileUrl = `/images/${req.file.filename}`;
        res.status(200).json({ 
            status: 1, 
            message: "Tải ảnh lên thành công!", 
            url: fileUrl, 
            filename: req.file.filename 
        });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Lỗi tải ảnh", err: err.message });
    }
});

// POST http://localhost:4000/upload/multiple hoặc /api/uploads (Tải lên nhiều ảnh - hàm upload.array)
router.post(['/multiple', '/uploads'], upload.array('image', 9), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ status: 0, message: "Không có tệp ảnh nào được chọn!", urls: [] });
        }
        const urls = req.files.map(f => `/images/${f.filename}`);
        res.status(200).json({ 
            status: 1, 
            message: `Tải thành công ${urls.length} ảnh!`, 
            urls 
        });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Lỗi tải nhiều ảnh", err: err.message });
    }
});

module.exports = router;
