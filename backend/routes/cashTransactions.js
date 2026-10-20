// Chuyển hướng và gọi hàm Controller Thu/Chi két tiền (Cash Transactions)
var express = require('express');
var router = express.Router();

const cashierCtrl = require('../controllers/cashierController');

/**
 * =========================================================================
 * CASH TRANSACTIONS (GIAO DỊCH NỘP / RÚT TIỀN KÉT CỦA THU NGÂN)
 * =========================================================================
 */

// GET http://localhost:4000/cash-transactions hoặc /api/cash-transactions
// Lấy danh sách phiếu thu/chi quỹ két
router.get('/', cashierCtrl.getCashTransactions);

// POST http://localhost:4000/cash-transactions
// Tạo phiếu thu tiền hoặc chi tiền két: { shift_id, type: 'In'|'Out', amount, reason, cashier_id }
router.post('/', cashierCtrl.createCashTransaction);

module.exports = router;
