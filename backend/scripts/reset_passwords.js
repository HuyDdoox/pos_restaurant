const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/restaurant_pos';

async function resetAllPasswords() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    password: String,
    fullname: String,
    role: String,
    status: String,
    branch_id: mongoose.Schema.Types.ObjectId,
    phone: String,
    email: String
  }, { timestamps: true }));

  const hashedPassword = bcrypt.hashSync('123456', 10);

  // 1. Cập nhật mật khẩu tất cả tài khoản hiện có trong MongoDB thành 123456
  const updateRes = await User.updateMany({}, { $set: { password: hashedPassword, status: 'Active' } });
  console.log(`Đã cập nhật mật khẩu 123456 cho ${updateRes.modifiedCount} người dùng trong MongoDB.`);

  // 2. Đảm bảo đầy đủ các tài khoản demo chuẩn phục vụ test giao diện
  const demoAccounts = [
    { username: 'admin_hcm', fullname: 'Admin TP.HCM', role: 'Admin', email: 'admin_hcm@restaurant.com' },
    { username: 'admin_master_01', fullname: 'Tổng Quản Trị Hệ Thống', role: 'Admin', email: 'admin@restaurant.com' },
    { username: 'cashier_lan', fullname: 'Nguyễn Thị Lan (Thu ngân)', role: 'Cashier', email: 'lan_cashier@restaurant.com' },
    { username: 'cashier_pro_01', fullname: 'Trần Thị Thu Ngân', role: 'Cashier', email: 'cashier01@restaurant.com' },
    { username: 'chef_wong', fullname: 'Bếp trưởng Vương', role: 'Chef', email: 'wong_chef@restaurant.com' },
    { username: 'chef_master_01', fullname: 'Bếp Trưởng Gordon', role: 'Chef', email: 'chef01@restaurant.com' },
    { username: 'waiter_nhat', fullname: 'Trần Văn Nhật (Phục vụ)', role: 'Waiter', email: 'nhat_waiter@restaurant.com' },
    { username: 'waiter_pro_01', fullname: 'Nguyễn Văn Phục Vụ', role: 'Waiter', email: 'waiter01@restaurant.com' },
    { username: 'customer_vip_01', fullname: 'Khách Hàng Thân Thiết', role: 'Customer', email: 'vip01@restaurant.com' }
  ];

  for (const acc of demoAccounts) {
    const existing = await User.findOne({ username: acc.username });
    if (!existing) {
      await User.create({
        username: acc.username,
        password: hashedPassword,
        fullname: acc.fullname,
        role: acc.role,
        email: acc.email,
        status: 'Active'
      });
      console.log(`[+] Đã tạo mới tài khoản demo: ${acc.username} (${acc.role})`);
    } else {
      await User.updateOne({ username: acc.username }, { $set: { password: hashedPassword, status: 'Active' } });
      console.log(`[✔] Đã reset pass 123456 cho tài khoản: ${acc.username}`);
    }
  }

  const allUsers = await User.find({}, { username: 1, fullname: 1, role: 1, status: 1 }).lean();
  console.log('\n--- DANH SÁCH TOÀN BỘ TÀI KHOẢN HỆ THỐNG (MẬT KHẨU TẤT CẢ LÀ: 123456) ---');
  allUsers.forEach(u => {
    console.log(`- Username: ${u.username.padEnd(18)} | Role: ${u.role.padEnd(10)} | Tên: ${u.fullname}`);
  });

  await mongoose.disconnect();
  console.log('\nHoàn tất!');
}

resetAllPasswords().catch(err => {
  console.error(err);
  process.exit(1);
});
