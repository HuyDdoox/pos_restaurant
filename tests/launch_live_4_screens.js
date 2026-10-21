/**
 * KHỞI ĐỘNG CÙNG LÚC 4 CỬA SỔ TRÌNH DUYỆT ĐỘC LẬP (LIVE WORKSPACE)
 * Phân hệ:
 *   1. Khách hàng (Mobile View - Góc Trái)
 *   2. Nhà bếp KDS (Góc Giữa Trên)
 *   3. Phục vụ Waiter (Góc Giữa Dưới)
 *   4. Thu ngân Cashier (Góc Phải)
 */

const { chromium } = require('../frontend/node_modules/playwright');
const mongoose = require('../backend/node_modules/mongoose');
const os = require('os');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3000';

async function cleanTable1InMongo() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/restaurant_pos');
    }
    const db = mongoose.connection.db;
    const table1 = await db.collection('tables').findOne({ tableNumber: { $in: [1, '1', 'Bàn 1', 'Bàn 01'] } });
    if (table1) {
      await db.collection('tables').updateOne({ _id: table1._id }, { $set: { status: 'Available', currentOrder_id: null } });
      await db.collection('orders').deleteMany({ table_id: table1._id, paymentStatus: 'Unpaid' });
      console.log('✅ Bàn 1 đã được reset về Available sạch sẽ');
    }
  } catch (err) {
    console.warn('⚠️ Cảnh báo kết nối Mongo:', err.message);
  }
}

async function launchRoleWindow(title, url, roleName, username, posX, posY, width, height, isMobile = false) {
  const profileDir = path.join(os.tmpdir(), `foodhub_pw_${roleName || 'customer'}`);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    viewport: isMobile ? { width: 390, height: 844 } : null,
    userAgent: isMobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' : undefined,
    args: [
      `--window-position=${posX},${posY}`,
      `--window-size=${width},${height}`
    ]
  });

  if (roleName) {
    await context.addInitScript(({ role, user }) => {
      const userObj = {
        id: '6ad' + role.toLowerCase(),
        username: user,
        fullname: (role === 'Waiter' ? 'Nhân viên Phục vụ' : (role === 'Chef' ? 'Bếp trưởng' : 'Thu ngân')),
        role: role,
        status: 'Active'
      };
      localStorage.setItem('currentUser', JSON.stringify(userObj));
      localStorage.setItem('user', JSON.stringify(userObj));
      localStorage.setItem('token', 'live_token_' + role.toLowerCase());
      localStorage.setItem('access_token', 'live_token_' + role.toLowerCase());
    }, { role: roleName, user: username });
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log(`[🚀 MỞ MÀN HÌNH] ${title} -> (${posX}, ${posY}) kích thước ${width}x${height}`);
  return context;
}

async function main() {
  console.log('\n================================================================');
  console.log('🎯 ĐANG KHỞI CHẠY KHÔNG GIAN KIỂM THỬ 4 MÀN HÌNH ĐỒNG THỜI (LIVE)');
  console.log('================================================================\n');

  await cleanTable1InMongo();

  // 1. Khách hàng Bàn 1 (Góc Trái - Mobile View)
  await launchRoleWindow(
    '📱 1. KHÁCH HÀNG (MOBILE QR - BÀN 1)',
    `${BASE_URL}/views/customer/index.html?table=1`,
    null, null,
    0, 0, 420, 980, true
  );

  // 2. Nhà bếp KDS (Góc Giữa Trên)
  await launchRoleWindow(
    '👨‍🍳 2. NHÀ BẾP (KITCHEN KDS)',
    `${BASE_URL}/views/staff/kitchen.html`,
    'Chef', 'chef',
    430, 0, 750, 480, false
  );

  // 3. Phục vụ Waiter (Góc Giữa Dưới)
  await launchRoleWindow(
    '💁 3. PHỤC VỤ (WAITER)',
    `${BASE_URL}/views/staff/waiter.html`,
    'Waiter', 'waiter',
    430, 490, 750, 490, false
  );

  // 4. Thu ngân Cashier (Góc Phải)
  await launchRoleWindow(
    '💵 4. THU NGÂN (CASHIER)',
    `${BASE_URL}/views/staff/cashier.html`,
    'Cashier', 'cashier',
    1190, 0, 720, 980, false
  );

  console.log('\n================================================================');
  console.log('🎉 CẢ 4 CỬA SỔ ĐÃ ĐƯỢC BẬT LÊN MÀN HÌNH CỦA BẠN!');
  console.log('👉 Bây giờ bạn có thể tự do bấm chọn món bên Khách và quan sát!');
  console.log('⚠️  Cửa sổ sẽ giữ mở liên tục. Khi nào test xong chỉ cần đóng trình duyệt.');
  console.log('================================================================\n');

  await new Promise(() => {});
}

main().catch(console.error);
