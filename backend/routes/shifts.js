// Chuyển hướng và gọi hàm Controller Quản lý ca làm việc (Shifts)
var express = require('express');
var router = express.Router();

const cashierCtrl = require('../controllers/cashierController');

/**
 * =========================================================================
 * SHIFTS (MỞ / ĐÓNG CA LÀM VIỆC & QUẢN LÝ TIỀN ĐẦU/CUỐI CA)
 * =========================================================================
 */

// GET http://localhost:4000/api/shifts
// Lấy danh sách tất cả các ca
router.get('/', cashierCtrl.getAllShifts);

// GET http://localhost:4000/shifts/current hoặc /api/shifts/current
// Lấy ca làm việc hiện tại đang mở của thu ngân
router.get('/current', cashierCtrl.getCurrentShift);

// GET http://localhost:4000/shifts/:id hoặc /api/shifts/:id
// Lấy thông tin chi tiết một ca làm việc
router.get('/:id', cashierCtrl.getShiftById);

// POST http://localhost:4000/shifts/open hoặc /api/shifts/open (hoặc POST /shifts)
// Mở ca làm việc mới: { cashier_id, startingCash, note }
router.post(['/open', '/'], cashierCtrl.openShift);

// POST http://localhost:4000/shifts/:id/close
// Đóng ca làm việc và kết toán tiền thực tế: { endingCash, actualCash, note }
router.post('/:id/close', cashierCtrl.closeShift);

module.exports = router;
