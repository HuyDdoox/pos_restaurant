// Chuyển hướng và gọi hàm Controller Xác thực tài khoản (Auth)
var express = require('express');
var router = express.Router();

const authCtrl = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

/**
 * =========================================================================
 * AUTHENTICATION (XÁC THỰC TÀI KHOẢN & PHÂN QUYỀN RBAC)
 * =========================================================================
 */

// POST http://localhost:4000/auth/register hoặc /api/auth/register
// Body: { username, password, fullname, role, branch_id, phone, email }
router.post(['/register', '/'], authCtrl.register);

// POST http://localhost:4000/auth/login hoặc /api/auth/login
// Body: { username, password } hoặc { email, password }
router.post('/login', authCtrl.login);

// POST http://localhost:4000/auth/refresh-token hoặc /api/auth/refresh-token
// Body: { refresh_token }
router.post('/refresh-token', authCtrl.refreshToken);

// GET http://localhost:4000/auth/me hoặc /api/auth/me (Yêu cầu Header: Authorization: Bearer <token>)
router.get('/me', verifyToken, authCtrl.getMe);

module.exports = router;
