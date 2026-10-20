// Chuyển hướng và gọi hàm Controller Thanh toán hóa đơn (Payments)
var express = require('express');
var router = express.Router();

const cashierCtrl = require('../controllers/cashierController');

/**
 * =========================================================================
 * PAYMENTS (THANH TOÁN HÓA ĐƠN & XỬ LÝ TIỀN MẶT / CHUYỂN KHOẢN)
 * =========================================================================
 */

// POST http://localhost:4000/payments hoặc /api/payments
// Thanh toán đơn hàng: { order_id, cashier_id, payment_method, amount_paid, voucher_code, loyalty_points_used }
router.post('/', cashierCtrl.processPayment);

module.exports = router;
