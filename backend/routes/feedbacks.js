// Chuyển hướng và gọi hàm Controller Đánh giá & Phản hồi khách hàng
var express = require('express');
var router = express.Router();

const extraCtrl = require('../controllers/extraController');

/**
 * =========================================================================
 * FEEDBACKS (Ý KIẾN ĐÁNH GIÁ & PHẢN HỒI DỊCH VỤ CỦA KHÁCH)
 * =========================================================================
 */

// GET http://localhost:4000/feedbacks hoặc /api/feedbacks
// Lấy danh sách đánh giá của khách
router.get('/', extraCtrl.getAllFeedbacks);

// POST http://localhost:4000/feedbacks
// Gửi đánh giá phản hồi: { order_id, rating, comment, customer_name }
router.post('/', extraCtrl.createFeedback);

module.exports = router;
