// Chuyển hướng và gọi hàm Controller Chi tiết món & Hàng đợi KDS Bếp
var express = require('express');
var router = express.Router();

const orderCtrl = require('../controllers/orderController');

/**
 * =========================================================================
 * ORDER DETAILS & KDS BẾP (ĐIỀU PHỐI VÀ THEO DÕI NẤU MÓN)
 * =========================================================================
 */

// GET http://localhost:4000/order-details hoặc /api/order-details
router.get('/', orderCtrl.getAllOrderDetails);

// POST http://localhost:4000/order-details hoặc /api/order-details (Thêm món vào đơn)
router.post('/', orderCtrl.createOrderDetail);

// GET http://localhost:4000/order-details/kitchen-queue hoặc /api/order-details/kitchen-queue
// Lấy hàng đợi các món đang cần bếp nấu / đã nấu xong
router.get('/kitchen-queue', orderCtrl.getKitchenQueue);

// GET http://localhost:4000/order-details/:id
router.get('/:id', orderCtrl.getOrderDetailById);

// PATCH http://localhost:4000/order-details/:id/status
// Cập nhật trạng thái chế biến món (Pending -> Cooking -> Ready -> Served)
router.patch('/:id/status', orderCtrl.updateItemStatus);

// PATCH http://localhost:4000/order-details/:id/rush
// Đánh dấu giục bếp ưu tiên cho món ăn
router.patch('/:id/rush', orderCtrl.rushItem);

// POST http://localhost:4000/order-details/:id/cancel
// Hủy món ăn với lý do cụ thể
router.post('/:id/cancel', orderCtrl.cancelItem);

// PATCH/PUT http://localhost:4000/order-details/:id
// Cập nhật trạng thái hoặc thông tin món
router.patch('/:id', orderCtrl.updateOrderDetail);
router.put('/:id', orderCtrl.updateOrderDetail);

// DELETE http://localhost:4000/order-details/:id
router.delete('/:id', orderCtrl.deleteOrderDetail);

module.exports = router;
