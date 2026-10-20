// Chuyển hướng và gọi hàm Controller Quản lý Khách hàng
var express = require('express');
var router = express.Router();

const extraCtrl = require('../controllers/extraController');

/**
 * =========================================================================
 * CUSTOMERS (KHÁCH HÀNG THÂN THIẾT & ĐIỂM TÍCH LŨY)
 * =========================================================================
 */

// GET http://localhost:4000/customers hoặc /api/customers
// Lấy danh sách khách hàng
router.get('/', extraCtrl.getAllCustomers);

// POST http://localhost:4000/customers
// Thêm khách hàng mới: { fullname, phone, email }
router.post('/', extraCtrl.createCustomer);

// PUT http://localhost:4000/customers/:id
// Cập nhật thông tin khách hàng
router.put('/:id', extraCtrl.updateCustomer);

// POST http://localhost:4000/customers/:id/adjust-points
// Cộng / trừ điểm tích lũy: { pointsDelta, reason }
router.post('/:id/adjust-points', extraCtrl.adjustCustomerPoints);

// DELETE http://localhost:4000/customers/:id
// Xóa khách hàng
router.delete('/:id', extraCtrl.deleteCustomer);

module.exports = router;
