// Chuyển hướng và gọi hàm Controller Quản lý kho & Nguyên vật liệu
var express = require('express');
var router = express.Router();

const invCtrl = require('../controllers/inventoryController');

/**
 * =========================================================================
 * INVENTORY (KHO HÀNG & NGUYÊN VẬT LIỆU)
 * =========================================================================
 */

// GET http://localhost:4000/inventory hoặc /api/inventory
// Lấy danh sách toàn bộ nguyên liệu tồn kho
router.get('/', invCtrl.getAllIngredients);

// POST http://localhost:4000/inventory
// Thêm nguyên liệu mới: { name, unit, current_stock, min_limit, cost_per_unit }
router.post('/', invCtrl.createIngredient);

// PUT http://localhost:4000/inventory/:id
// Cập nhật thông tin nguyên vật liệu
router.put('/:id', invCtrl.updateIngredient);

// DELETE http://localhost:4000/inventory/:id
// Xóa nguyên liệu khỏi hệ thống
router.delete('/:id', invCtrl.deleteIngredient);

module.exports = router;
