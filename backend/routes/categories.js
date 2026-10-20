// Chuyển hướng và gọi hàm Controller Danh mục món ăn
var express = require('express');
var router = express.Router();

const menuCtrl = require('../controllers/menuController');

/**
 * =========================================================================
 * CATEGORIES (QUẢN LÝ DANH MỤC THỰC ĐƠN)
 * =========================================================================
 */

// GET http://localhost:4000/categories hoặc /api/categories
// Lấy toàn bộ danh mục thực đơn
router.get('/', menuCtrl.getAllCategories);

// GET http://localhost:4000/categories/:id
// Lấy chi tiết 1 danh mục theo ID
router.get('/:id', menuCtrl.getCategoryById);

// POST http://localhost:4000/categories
// Thêm danh mục mới: { name, description, icon }
router.post('/', menuCtrl.createCategory);

// PUT http://localhost:4000/categories/:id
// Cập nhật thông tin danh mục
router.put('/:id', menuCtrl.updateCategory);

// PATCH http://localhost:4000/categories/:id/status
// Ẩn / Hiện danh mục
router.patch('/:id/status', menuCtrl.changeCategoryStatus);

// DELETE http://localhost:4000/categories/:id
// Xóa danh mục
router.delete('/:id', menuCtrl.deleteCategory);

module.exports = router;
