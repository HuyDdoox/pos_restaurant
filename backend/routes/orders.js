// Chuyển hướng và gọi hàm Controller Đơn hàng (Orders)
var express = require('express');
var router = express.Router();

const orderCtrl = require('../controllers/orderController');

/**
 * =========================================================================
 * ORDERS (QUẢN LÝ ĐƠN HÀNG NHÀ HÀNG)
 * =========================================================================
 */

// GET http://localhost:4000/orders hoặc /api/orders
// Lấy danh sách toàn bộ đơn hàng
router.get('/', orderCtrl.getAllOrders);

// GET http://localhost:4000/orders/:id
// Lấy chi tiết đơn hàng kèm danh sách món
router.get('/:id', orderCtrl.getOrderById);

// POST http://localhost:4000/orders
// Tạo đơn hàng mới: { table_id, cashier_id, waiter_id, items: [ { menu_item_id, quantity, price, note } ] }
router.post('/', orderCtrl.createOrder);

// PUT & PATCH http://localhost:4000/orders/:id
// Cập nhật đơn hàng (thêm món, sửa thông tin đơn, cập nhật thanh toán)
router.put('/:id', orderCtrl.updateOrder);
router.patch('/:id', orderCtrl.updateOrder);

// DELETE http://localhost:4000/orders/:id
router.delete('/:id', orderCtrl.deleteOrder);

module.exports = router;
