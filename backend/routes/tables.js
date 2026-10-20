// Chuyển hướng và gọi hàm Controller Bàn ăn (Tables)
var express = require('express');
var router = express.Router();

const tableCtrl = require('../controllers/tableController');

/**
 * =========================================================================
 * TABLES (SƠ ĐỒ BÀN ĂN & ĐIỀU PHỐI KHÁCH)
 * =========================================================================
 */

// GET http://localhost:4000/tables hoặc /api/tables
// Lấy sơ đồ toàn bộ bàn ăn
router.get('/', tableCtrl.getAllTables);

// POST http://localhost:4000/tables/transfer
// Chuyển bàn / Ghép bàn: { fromTableId, toTableId, note }
router.post('/transfer', tableCtrl.transferTable);

// GET http://localhost:4000/tables/:id
// Lấy chi tiết thông tin bàn ăn
router.get('/:id', tableCtrl.getTableById);

// POST http://localhost:4000/tables
// Thêm bàn mới: { code, name, capacity, area, branch_id }
router.post('/', tableCtrl.createTable);

// PUT http://localhost:4000/tables/:id
// Cập nhật thông tin bàn ăn
router.put('/:id', tableCtrl.updateTable);
router.patch('/:id', tableCtrl.updateTable);

// PATCH http://localhost:4000/tables/:id/status
// Thay đổi trạng thái bàn ăn (Available | Occupied | Reserved)
router.patch('/:id/status', tableCtrl.changeTableStatus);

// DELETE http://localhost:4000/tables/:id
// Xóa bàn ăn
router.delete('/:id', tableCtrl.deleteTable);

module.exports = router;
