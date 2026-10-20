/**
 * =========================================================================
 * BỘ ĐIỀU HƯỚNG TỔNG HỢP API ROUTER (RESTful Web Service)
 * Theo chuẩn thiết kế Modular Routers giảng dạy môn NodeJS & RESTful API
 * =========================================================================
 */
var express = require('express');
var router = express.Router();

// Khai báo các Resource Router con đã tách nhỏ theo từng phân hệ
const uploadRouter = require('./upload');
const authRouter = require('./auth');
const usersRouter = require('./users');
const categoriesRouter = require('./categories');
const menuRouter = require('./menu');
const variantsRouter = require('./variants');
const branchesRouter = require('./branches');
const tablesRouter = require('./tables');
const ordersRouter = require('./orders');
const orderDetailsRouter = require('./orderDetails');
const inventoryRouter = require('./inventory');
const recipesRouter = require('./recipes');
const lossReportsRouter = require('./lossReports');
const shiftsRouter = require('./shifts');
const paymentsRouter = require('./payments');
const cashTransactionsRouter = require('./cashTransactions');
const vouchersRouter = require('./vouchers');
const customersRouter = require('./customers');
const feedbacksRouter = require('./feedbacks');
const auditLogsRouter = require('./auditLogs');

// 0. Upload Router
router.use('/', uploadRouter);

// 1. Phân hệ Xác thực & Phân quyền (Auth)
const authCtrl = require('../controllers/authController');
router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/refresh-token', authCtrl.refreshToken);
router.use('/auth', authRouter);

// 2. Phân hệ Quản lý Người dùng & Nhân viên (Users)
router.use('/users', usersRouter);

// 3. Phân hệ Thực đơn, Danh mục & Biến thể món (Categories, Menu, Variants)
router.use(['/categories', '/Categories'], categoriesRouter);
router.use(['/menu', '/MenuItems'], menuRouter);
router.use(['/variants', '/Variants'], variantsRouter);
router.use(['/branches', '/Branches'], branchesRouter);

// 4. Phân hệ Sơ đồ bàn ăn & Điều phối (Tables)
router.use(['/tables', '/Tables'], tablesRouter);

// 5. Phân hệ Đơn hàng & KDS Bếp (Orders & OrderDetails)
router.use(['/orders', '/Orders'], ordersRouter);
router.use(['/order-details', '/OrderDetails'], orderDetailsRouter);

// 6. Phân hệ Kho hàng, Định lượng & Báo cáo hao hụt (Inventory, Recipes, Loss Reports)
router.use(['/inventory', '/Ingredients'], inventoryRouter);
router.use(['/recipes', '/Recipes'], recipesRouter);
router.use(['/variant-recipes', '/VariantRecipes'], recipesRouter);
router.use(['/loss-reports', '/LossReports'], lossReportsRouter);

// 7. Phân hệ Thu ngân, Ca làm việc & Thanh toán (Shifts, Payments, Cash Transactions)
router.use(['/shifts', '/Shifts'], shiftsRouter);
router.use(['/payments', '/Payments'], paymentsRouter);
router.use(['/cash-transactions', '/CashTransactions'], cashTransactionsRouter);

// 8. Phân hệ Marketing, Chăm sóc khách hàng & Audit (Vouchers, Customers, Feedbacks, Audit Logs)
router.use(['/vouchers', '/Vouchers'], vouchersRouter);
router.use(['/customers', '/Customers'], customersRouter);
router.use(['/feedbacks', '/Feedbacks'], feedbacksRouter);
router.use(['/audit-logs', '/AuditLogs'], auditLogsRouter);

module.exports = router;
