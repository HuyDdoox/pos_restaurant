const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    customer: './src/customer.ts', // Phân hệ khách hàng (Trang chủ)
    kitchen:  './src/kitchen.ts',  // Phân hệ bếp
    waiter:   './src/waiter.ts',   // Phân hệ phục vụ
    cashier:  './src/cashier.ts',  // Phân hệ thu ngân
    admin:    './src/admin.ts',    // Phân hệ quản trị
    login:    './src/login.ts',    // Phân hệ đăng nhập
  },
  module: {
    rules: [
      { 
        test: /\.tsx?$/, 
        use: 'ts-loader', 
        exclude: /node_modules/ 
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js', // Sẽ xuất ra các file tương ứng: customer.js, kitchen.js...
    path: path.resolve(__dirname, 'public/js'),
  },
};