// Chuyển hướng và gọi hàm Controller Món ăn (Menu Items)
var express = require('express');
var router = express.Router();

const menuCtrl = require('../controllers/menuController');

/**
 * =========================================================================
 * MENU ITEMS (QUẢN LÝ MÓN ĂN TRONG THỰC ĐƠN)
 * =========================================================================
 */

// GET http://localhost:4000/menu hoặc /api/menu (hỗ trợ query category, search, status)
// Lấy danh sách tất cả món ăn
router.get('/', menuCtrl.getAllMenuItems);

// GET http://localhost:4000/menu/:id
// Lấy thông tin chi tiết một món ăn theo ID
router.get('/:id', menuCtrl.getMenuItemById);

// POST http://localhost:4000/menu
// Thêm món ăn mới vào thực đơn: { name, price, category_id, image, description, status }
router.post('/', menuCtrl.createMenuItem);

// PUT & PATCH http://localhost:4000/menu/:id
// Cập nhật thông tin món ăn
router.put('/:id', menuCtrl.updateMenuItem);
router.patch('/:id', menuCtrl.updateMenuItem);

// PATCH http://localhost:4000/menu/:id/toggle-status hoặc /status
// Bật/tắt trạng thái món (Còn hàng / Tạm hết)
router.patch(['/:id/toggle-status', '/:id/status'], menuCtrl.toggleMenuItemStatus);

// DELETE http://localhost:4000/menu/:id
// Xóa món ăn khỏi thực đơn
router.delete('/:id', menuCtrl.deleteMenuItem);

module.exports = router;
