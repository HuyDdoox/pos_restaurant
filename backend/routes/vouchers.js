// Chuyển hướng và gọi hàm Controller Khuyến mãi & Voucher
var express = require('express');
var router = express.Router();

const extraCtrl = require('../controllers/extraController');

/**
 * =========================================================================
 * VOUCHERS (QUẢN LÝ MÃ KHUYẾN MÃI & GIẢM GIÁ)
 * =========================================================================
 */

// GET http://localhost:4000/vouchers hoặc /api/vouchers
// Lấy danh sách toàn bộ mã giảm giá
router.get('/', extraCtrl.getAllVouchers);

// POST http://localhost:4000/vouchers
// Tạo mã voucher mới: { code, discount_type, value, min_order, max_discount, valid_until }
router.post('/', extraCtrl.createVoucher);

// PUT http://localhost:4000/vouchers/:id
// Cập nhật thông tin mã voucher
router.put('/:id', extraCtrl.updateVoucher);

// DELETE http://localhost:4000/vouchers/:id
// Xóa voucher
router.delete('/:id', extraCtrl.deleteVoucher);

module.exports = router;
