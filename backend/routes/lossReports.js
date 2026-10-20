// Chuyển hướng và gọi hàm Controller Báo cáo thất thoát / Hao hụt kho
var express = require('express');
var router = express.Router();

const invCtrl = require('../controllers/inventoryController');

/**
 * =========================================================================
 * LOSS REPORTS (BÁO CÁO THẤT THOÁT, HƯ HỎNG & TIÊU HAO NGUYÊN VẬT LIỆU)
 * =========================================================================
 */

// GET http://localhost:4000/loss-reports hoặc /api/loss-reports
// Lấy danh sách báo cáo hao hụt kho
router.get('/', invCtrl.getLossReports);

// POST http://localhost:4000/loss-reports
// Tạo báo cáo hao hụt nguyên liệu: { ingredient_id, quantity, reason, reported_by }
router.post('/', invCtrl.createLossReport);

module.exports = router;
