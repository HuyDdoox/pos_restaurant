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


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

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

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler (API friendly)
app.use(function(err, req, res, next) {
  if (req.originalUrl.startsWith('/api') || req.accepts('json')) {
      return res.status(err.status || 500).json({
          success: false,
          message: err.message || 'Internal Server Error',
          error: req.app.get('env') === 'development' ? err : {}
      });
  }
  
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
