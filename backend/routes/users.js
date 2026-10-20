// Chuyển hướng và gọi hàm Controller Quản lý người dùng & Nhân sự
var express = require('express');
var router = express.Router();

const userCtrl = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middlewares/auth');

/**
 * =========================================================================
 * USERS (QUẢN LÝ NHÂN VIÊN & PHÂN QUYỀN TÀI KHOẢN)
 * =========================================================================
 */

// GET http://localhost:4000/users hoặc /api/users
// Trả về danh sách tất cả nhân viên / người dùng
router.get('/', userCtrl.getAllUsers);

// GET http://localhost:4000/users/:id hoặc /api/users/:id
// Lấy chi tiết thông tin 1 người dùng theo ID
router.get('/:id', userCtrl.getUserById);

// POST http://localhost:4000/users hoặc /api/users (Chỉ Admin)
// Body: { username, password, fullname, role, branch_id, phone, email }
router.post('/', verifyToken, checkRole('Admin'), userCtrl.createUser);

// PUT http://localhost:4000/users/:id hoặc /api/users/:id (Chỉ Admin)
// Body: { fullname, role, branch_id, phone, email, status }
router.put('/:id', verifyToken, checkRole('Admin'), userCtrl.updateUser);

// PATCH http://localhost:4000/users/:id/lock hoặc /status (Chỉ Admin)
// Khóa hoặc mở khóa tài khoản
router.patch(['/:id/lock', '/:id/status'], verifyToken, checkRole('Admin'), userCtrl.toggleLockUser);

// DELETE http://localhost:4000/users/:id hoặc /api/users/:id (Chỉ Admin)
// Xóa tài khoản nhân viên
router.delete('/:id', verifyToken, checkRole('Admin'), userCtrl.deleteUser);

module.exports = router;
