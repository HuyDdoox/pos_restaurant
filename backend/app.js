require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');

const connectDB = require('./config/db');
connectDB();


// // --- THÊM ĐOẠN NÀY ĐỂ TEST DB XUẤT HIỆN ---
// const Branch = require('./models/Branch');
// const testTaoChiNhanh = async () => {
//     // Đếm xem có chi nhánh nào chưa, chưa có thì tạo
//     const count = await Branch.countDocuments();
//     if (count === 0) {
//         await Branch.create({
//             name: 'Chi nhánh Trung tâm',
//             address: '123 Đường ABC, Quận 1'
//         });
//         console.log('🎉 Đã tạo dữ liệu mẫu, hãy refresh lại MongoDB Compass!');
//     }
// };
// testTaoChiNhanh();
// // ------------------------------------------


// Khai báo các Router tài nguyên (Chuẩn module hóa NodeJS theo giáo trình cô dạy)
var indexRouter = require('./routes/index');
var authRouter = require('./routes/auth');
var usersRouter = require('./routes/users');
var categoriesRouter = require('./routes/categories');
var menuRouter = require('./routes/menu');
var variantsRouter = require('./routes/variants');
var branchesRouter = require('./routes/branches');
var tablesRouter = require('./routes/tables');
var ordersRouter = require('./routes/orders');
var orderDetailsRouter = require('./routes/orderDetails');
var inventoryRouter = require('./routes/inventory');
var recipesRouter = require('./routes/recipes');
var lossReportsRouter = require('./routes/lossReports');
var shiftsRouter = require('./routes/shifts');
var paymentsRouter = require('./routes/payments');
var cashTransactionsRouter = require('./routes/cashTransactions');
var vouchersRouter = require('./routes/vouchers');
var customersRouter = require('./routes/customers');
var feedbacksRouter = require('./routes/feedbacks');
var auditLogsRouter = require('./routes/auditLogs');
var uploadRouter = require('./routes/upload');
var apiRouter = require('./routes/api');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images'))); // Đường dẫn truy cập trực tiếp file ảnh upload

// Log hiển thị ra Terminal mỗi khi có Client kết nối tới (theo phong cách cô dạy)
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || 'Direct / Terminal';
  console.log(`📡 [CLIENT KẾT NỐI] ${new Date().toLocaleTimeString()} | ${req.method} ${req.originalUrl} | Nguồn: ${origin}`);
  next();
});

// Gắn các router vào ứng dụng (chuẩn cô dạy)
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/categories', categoriesRouter);
app.use('/menu', menuRouter);
app.use('/variants', variantsRouter);
app.use('/branches', branchesRouter);
app.use('/tables', tablesRouter);
app.use('/orders', ordersRouter);
app.use('/order-details', orderDetailsRouter);
app.use('/inventory', inventoryRouter);
app.use('/recipes', recipesRouter);
app.use('/loss-reports', lossReportsRouter);
app.use('/shifts', shiftsRouter);
app.use('/payments', paymentsRouter);
app.use('/cash-transactions', cashTransactionsRouter);
app.use('/vouchers', vouchersRouter);
app.use('/customers', customersRouter);
app.use('/feedbacks', feedbacksRouter);
app.use('/audit-logs', auditLogsRouter);
app.use('/upload', uploadRouter);

// Mount toàn bộ RESTful API qua tiền tố /api phục vụ Frontend & Mobile App
app.use('/api', apiRouter);

// Xử lý 404 cho riêng nhánh /api
app.use('/api', function(req, res, next) {
  res.status(404).json({
    status: 0,
    message: `Đường dẫn API [${req.method} ${req.originalUrl}] không tồn tại trên hệ thống!`
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler (API friendly)
app.use(function(err, req, res, next) {
  if (req.originalUrl.startsWith('/api') || req.accepts('json')) {
      return res.status(err.status || 500).json({
          status: 0,
          message: err.message || 'Lỗi máy chủ nội bộ (Internal Server Error)',
          error: req.app.get('env') === 'development' ? err : {}
      });
  }
  
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
