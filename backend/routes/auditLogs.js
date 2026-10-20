// Chuyển hướng và gọi hàm Controller Nhật ký kiểm toán hệ thống (Audit Logs)
var express = require('express');
var router = express.Router();

const extraCtrl = require('../controllers/extraController');

/**
 * =========================================================================
 * AUDIT LOGS (NHẬT KÝ THAO TÁC HỆ THỐNG & BẢO MẬT)
 * =========================================================================
 */

// GET http://localhost:4000/audit-logs hoặc /api/audit-logs
// Lấy danh sách nhật ký hành động hệ thống
router.get('/', extraCtrl.getAllAuditLogs);

// POST http://localhost:4000/audit-logs
// Ghi nhận nhật ký mới: { user_id, action, target, metadata }
router.post('/', extraCtrl.createAuditLog);

module.exports = router;
