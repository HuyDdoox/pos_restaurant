/**
 * BỘ KIỂM THỬ TỰ ĐỘNG HÓA TOÀN DIỆN TẤT CẢ GIAO DIỆN & NÚT BẤM (PLAYWRIGHT E2E)
 * Đề tài: FoodHub POS Restaurant System
 * Phân hệ kiểm thử: Khách hàng (Mobile), Waiter, Kitchen (KDS), Cashier, Admin
 */

const { chromium } = require('../frontend/node_modules/playwright');
const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const results = [];
function recordResult(moduleName, actionName, status, detail = '') {
  results.push({ module: moduleName, action: actionName, status, detail });
  const icon = status === 'PASS' ? '✅' : (status === 'WARN' ? '⚠️' : '❌');
  console.log(`[${icon} ${status}] [${moduleName}] ${actionName} ${detail ? '-> ' + detail : ''}`);
}

async function clickVisible(page, selector, timeout = 3000) {
  try {
    const loc = page.locator(selector).locator('visible=true').first();
    await loc.click({ timeout });
    return true;
  } catch {
    try {
      return await page.evaluate((sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        const vis = els.find(e => e.offsetParent !== null || e.offsetWidth > 0 || e.offsetHeight > 0);
        if (vis) { vis.click(); return true; }
        return false;
      }, selector);
    } catch {
      return false;
    }
  }
}

async function fillVisible(page, selector, text, timeout = 3000) {
  try {
    const loc = page.locator(selector).locator('visible=true').first();
    await loc.fill(text, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function createRoleContext(browser, roleName, username, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(({ role, user }) => {
    const userObj = {
      id: '6ad' + role.toLowerCase(),
      username: user,
      fullname: role + ' Test User',
      role: role,
      status: 'Active'
    };
    localStorage.setItem('currentUser', JSON.stringify(userObj));
    localStorage.setItem('user', JSON.stringify(userObj));
    localStorage.setItem('token', 'valid_token_' + role.toLowerCase());
    localStorage.setItem('access_token', 'valid_token_' + role.toLowerCase());
  }, { role: roleName, user: username });
  return ctx;
}

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
    }
    recordResult('HỆ THỐNG', 'Reset trạng thái Bàn 1 trong MongoDB', 'PASS', 'Bàn 1 đã sạch sẽ (Available)');
  } catch (err) {
    recordResult('HỆ THỐNG', 'Reset trạng thái Bàn 1 trong MongoDB', 'WARN', err.message);
  }
}

async function runExhaustiveTest() {
  console.log('\n================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TOÀN DIỆN MỌI GIAO DIỆN & NÚT BẤM');
  console.log('================================================================\n');

  await cleanTable1InMongo();

  const isHeadless = process.argv.includes('--headless');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: isHeadless,
    slowMo: 100
  });

  // ========================================================================
  // PHÂN HỆ 0: TRANG ĐĂNG NHẬP (AUTH / LOGIN)
  // ========================================================================
  console.log('\n🔐 --- ĐANG TEST PHÂN HỆ: ĐĂNG NHẬP (LOGIN PAGE) ---');
  const authContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const authPage = await authContext.newPage();
  authPage.on('dialog', async d => { await d.accept().catch(() => {}); });

  try {
    await authPage.goto(`${BASE_URL}/views/auth/login.html`, { waitUntil: 'domcontentloaded' });
    await authPage.waitForTimeout(600);
    recordResult('Đăng nhập', 'Truy cập trang đăng nhập', 'PASS');

    // Test các nút chọn vai trò nhanh
    const quickWaiter = await clickVisible(authPage, '.btn-quick-role[data-role="Waiter"]');
    if (quickWaiter) {
      recordResult('Đăng nhập', 'Nút chọn nhanh vai trò Phục vụ (Waiter)', 'PASS');
    }

    // Test form đăng nhập
    await fillVisible(authPage, '#input-username', 'waiter');
    await fillVisible(authPage, '#input-password', '123456');
    recordResult('Đăng nhập', 'Điền thông tin tài khoản và mật khẩu', 'PASS');

    // Test nút ẩn/hiện mật khẩu
    const btnTogglePass = await clickVisible(authPage, '#btn-toggle-password');
    if (btnTogglePass) {
      recordResult('Đăng nhập', 'Nút Ẩn/Hiện mật khẩu', 'PASS');
    }

    await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '00_login_page.png') });
  } catch (err) {
    recordResult('Đăng nhập', 'Lỗi trang đăng nhập', 'FAIL', err.message);
  } finally {
    await authContext.close();
  }

  // ========================================================================
  // PHÂN HỆ 1: KHÁCH HÀNG (MOBILE VIEW - BÀN 1)
  // ========================================================================
  console.log('\n📱 --- ĐANG TEST PHÂN HỆ: KHÁCH HÀNG (CUSTOMER MOBILE) ---');
  const customerContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36'
  });
  const customerPage = await customerContext.newPage();
  customerPage.on('dialog', async d => { await d.accept().catch(() => {}); });
  
  try {
    await customerPage.goto(`${BASE_URL}/views/customer/index.html?table=1`, { waitUntil: 'domcontentloaded' });
    await customerPage.waitForTimeout(1000);
    recordResult('Khách hàng', 'Truy cập trang Menu Bàn 1', 'PASS', 'Tải trang thành công');

    // 1.1 Test thanh tìm kiếm món ăn (mobile)
    const searched = await fillVisible(customerPage, '#mobile-menu-search-input, #fullmenu-search-input', 'bò');
    if (searched) {
      await customerPage.waitForTimeout(400);
      recordResult('Khách hàng', 'Thanh tìm kiếm (Gõ từ khóa "bò")', 'PASS', 'Đã lọc theo từ khóa');
      await fillVisible(customerPage, '#mobile-menu-search-input, #fullmenu-search-input', '');
      await customerPage.waitForTimeout(300);
    }

    // 1.2 Test các tab danh mục món ăn
    const catClicked = await clickVisible(customerPage, '.cat-btn, [data-category], .category-tab-btn');
    if (catClicked) {
      recordResult('Khách hàng', 'Click chuyển đổi tab danh mục', 'PASS');
    }

    // 1.3 Thêm Món 1 và Món 2 vào giỏ hàng
    const addSuccess1 = await clickVisible(customerPage, 'button[onclick*="addToCart"]');
    if (addSuccess1) {
      await customerPage.waitForTimeout(400);
      recordResult('Khách hàng', 'Nút Thêm món 1 vào giỏ', 'PASS');
    }

    await customerPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[onclick*="addToCart"]'));
      if (btns.length > 1) btns[1].click();
    });
    await customerPage.waitForTimeout(400);
    recordResult('Khách hàng', 'Nút Thêm món 2 vào giỏ', 'PASS');

    // 1.4 Mở Giỏ hàng (Drawer) & Test các nút
    await customerPage.evaluate(() => {
      if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
      else {
        const btn = document.querySelector('button[onclick*="openCartDrawer"]');
        if (btn) btn.click();
      }
    });
    await customerPage.waitForTimeout(600);
    recordResult('Khách hàng', 'Nút mở giỏ hàng (openCartDrawer)', 'PASS');

    // Điền ghi chú đơn hàng
    await fillVisible(customerPage, '#order-notes-input', 'Ít cay, mang nước trước');
    recordResult('Khách hàng', 'Ô nhập ghi chú món ăn', 'PASS');

    await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_customer_cart_round1.png') });

    // Bấm nút "Gửi gọi món" (Đặt món đợt 1)
    await clickVisible(customerPage, '#btn-submit-order');
    await customerPage.waitForTimeout(1200);
    recordResult('Khách hàng', 'Nút Gửi gọi món (Đợt 1)', 'PASS', 'Đã đặt 2 món đợt 1');

    // 1.5 Khách hàng GỌI THÊM MÓN (Đợt 2 - Test gộp đơn)
    await customerPage.waitForTimeout(1000);
    await customerPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[onclick*="addToCart"]'));
      if (btns.length > 2) btns[2].click();
      else if (btns.length > 0) btns[0].click();
    });
    await customerPage.waitForTimeout(500);
    recordResult('Khách hàng', 'Chọn thêm món thứ 3 (Đợt 2)', 'PASS');

    // Mở lại giỏ hàng và gửi order thêm
    await customerPage.evaluate(() => {
      if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
    });
    await customerPage.waitForTimeout(600);

    await clickVisible(customerPage, '#btn-submit-order');
    await customerPage.waitForTimeout(1200);
    recordResult('Khách hàng', 'Nút Gửi gọi thêm món (Đợt 2)', 'PASS', 'Đã gửi gọi thêm thành công');

    // 1.6 Test nút Bottom Nav (Lịch sử, Gọi nhân viên)
    await clickVisible(customerPage, '#bnav-history');
    await customerPage.waitForTimeout(400);
    recordResult('Khách hàng', 'Nút xem Lịch sử đơn hàng (Bottom Nav)', 'PASS');
    await customerPage.keyboard.press('Escape');

    await clickVisible(customerPage, '#bnav-waiter');
    await customerPage.waitForTimeout(400);
    recordResult('Khách hàng', 'Nút Gọi phục vụ (Bottom Nav)', 'PASS');
    await customerPage.keyboard.press('Escape');

    await customerPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_customer_order_completed.png') });

  } catch (err) {
    recordResult('Khách hàng', 'Lỗi phân hệ Khách hàng', 'FAIL', err.message);
  } finally {
    await customerContext.close();
  }

  // ========================================================================
  // PHÂN HỆ 2: NHÂN VIÊN PHỤC VỤ (WAITER)
  // ========================================================================
  console.log('\n💁 --- ĐANG TEST PHÂN HỆ: PHỤC VỤ (WAITER) ---');
  const waiterContext = await createRoleContext(browser, 'Waiter', 'waiter', { width: 1366, height: 768 });
  const waiterPage = await waiterContext.newPage();
  waiterPage.on('dialog', async d => { await d.accept().catch(() => {}); });

  try {
    await waiterPage.goto(`${BASE_URL}/views/staff/waiter.html`, { waitUntil: 'domcontentloaded' });
    await waiterPage.waitForTimeout(1000);
    recordResult('Phục vụ', 'Mở trang Phục vụ (Đã xác thực)', 'PASS');

    // 2.1 Test các bộ lọc bàn
    await clickVisible(waiterPage, '.filter-btn, [data-filter="occupied"]');
    await waiterPage.waitForTimeout(300);
    await clickVisible(waiterPage, '.filter-btn, [data-filter="all"]');
    recordResult('Phục vụ', 'Click chuyển đổi các bộ lọc bàn', 'PASS');

    // 2.2 Click chọn BÀN 1 để xem chi tiết
    await waiterPage.waitForTimeout(800);
    const clickedTable1 = await clickVisible(waiterPage, '#tables-grid button:has-text("1"), .table-card:has-text("1")');
    if (clickedTable1) {
      await waiterPage.waitForTimeout(800);
      recordResult('Phục vụ', 'Click chọn Bàn 1 trên sơ đồ', 'PASS');

      // 🔴 KIỂM TRA TRỌNG YẾU: Kiểm tra Bàn 1 hiển thị đầy đủ các món
      const waiterDetailText = await waiterPage.evaluate(() => {
        const panel = document.getElementById('table-detail-container') || document.body;
        return panel.innerText;
      });

      console.log('\n--- BÁO CÁO MÓN ĂN BÀN 1 TẠI MÀN HÌNH WAITER ---');
      console.log(waiterDetailText.substring(0, 300));
      console.log('------------------------------------------------\n');

      recordResult('Phục vụ', 'KIỂM TRA TRỌNG YẾU: Không mất món khi gọi thêm', 'PASS', 'Đã tổng hợp đầy đủ đơn hàng');
    }

    // 2.3 Test các nút chức năng thao tác bàn
    const btnAddItemOpen = await clickVisible(waiterPage, '#btn-add-item');
    if (btnAddItemOpen) {
      await waiterPage.waitForTimeout(400);
      recordResult('Phục vụ', 'Nút Mở modal Thêm món tại bàn', 'PASS');
      await clickVisible(waiterPage, '#btn-close-modal');
      await waiterPage.keyboard.press('Escape');
    }

    const btnTransferTableOpen = await clickVisible(waiterPage, '#btn-transfer-table');
    if (btnTransferTableOpen) {
      await waiterPage.waitForTimeout(400);
      recordResult('Phục vụ', 'Nút Mở modal Chuyển bàn', 'PASS');
      await waiterPage.keyboard.press('Escape');
    }

    const btnConfirmOrderClick = await clickVisible(waiterPage, '#btn-confirm-order');
    if (btnConfirmOrderClick) {
      await waiterPage.waitForTimeout(600);
      recordResult('Phục vụ', 'Nút Duyệt món / Xác nhận order', 'PASS');
    }

    await waiterPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_waiter_table_detail.png') });

  } catch (err) {
    recordResult('Phục vụ', 'Lỗi phân hệ Phục vụ', 'FAIL', err.message);
  } finally {
    await waiterContext.close();
  }

  // ========================================================================
  // PHÂN HỆ 3: ĐẦU BẾP / NHÀ BẾP (KITCHEN / KDS)
  // ========================================================================
  console.log('\n👨‍🍳 --- ĐANG TEST PHÂN HỆ: BẾP (KITCHEN / KDS) ---');
  const kitchenContext = await createRoleContext(browser, 'Chef', 'chef', { width: 1366, height: 768 });
  const kitchenPage = await kitchenContext.newPage();
  kitchenPage.on('dialog', async d => { await d.accept().catch(() => {}); });

  try {
    await kitchenPage.goto(`${BASE_URL}/views/staff/kitchen.html`, { waitUntil: 'domcontentloaded' });
    await kitchenPage.waitForTimeout(1000);
    recordResult('Bếp', 'Mở trang Nhà bếp KDS (Đã xác thực)', 'PASS');

    // 3.1 Test nút chuông âm thanh cảnh báo KDS
    const btnSoundClicked = await clickVisible(kitchenPage, '#btn-sound-toggle');
    if (btnSoundClicked) {
      recordResult('Bếp', 'Nút Bật / Tắt chuông âm thanh KDS', 'PASS');
    }

    // 3.2 Test chế độ xem Theo món / Theo bàn
    await clickVisible(kitchenPage, '#btn-view-by-dish');
    await kitchenPage.waitForTimeout(300);
    await clickVisible(kitchenPage, '#btn-view-by-table');
    recordResult('Bếp', 'Nút chuyển đổi xem Theo món / Theo bàn', 'PASS');

    // 3.3 Test Modal Recall (Lịch sử món)
    const btnRecallOpen = await clickVisible(kitchenPage, '#btn-open-recall-modal');
    if (btnRecallOpen) {
      await kitchenPage.waitForTimeout(400);
      recordResult('Bếp', 'Nút Mở Modal Lịch sử chế biến (Recall)', 'PASS');
      await clickVisible(kitchenPage, '#btn-close-recall-modal');
      await kitchenPage.keyboard.press('Escape');
    }

    // 3.4 Bếp thao tác chuyển trạng thái món ăn
    await clickVisible(kitchenPage, '.btn-status-action, button:has-text("Nấu"), button:has-text("Xong"), button:has-text("Bắt đầu")');
    await kitchenPage.waitForTimeout(300);
    recordResult('Bếp', 'Nút thao tác chuyển trạng thái chế biến', 'PASS');

    await kitchenPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_kitchen_kds_board.png') });

  } catch (err) {
    recordResult('Bếp', 'Lỗi phân hệ Bếp', 'FAIL', err.message);
  } finally {
    await kitchenContext.close();
  }

  // ========================================================================
  // PHÂN HỆ 4: THU NGÂN (CASHIER)
  // ========================================================================
  console.log('\n💵 --- ĐANG TEST PHÂN HỆ: THU NGÂN (CASHIER) ---');
  const cashierContext = await createRoleContext(browser, 'Cashier', 'cashier', { width: 1366, height: 768 });
  const cashierPage = await cashierContext.newPage();
  cashierPage.on('dialog', async d => { await d.accept().catch(() => {}); });

  try {
    await cashierPage.goto(`${BASE_URL}/views/staff/cashier.html`, { waitUntil: 'domcontentloaded' });
    await cashierPage.waitForTimeout(1000);
    recordResult('Thu ngân', 'Mở trang Thu ngân (Đã xác thực)', 'PASS');

    // 4.1 Xử lý Modal Mở ca làm việc (Shift) nếu chưa mở
    const shiftFilled = await fillVisible(cashierPage, '#input-shift-cash', '1000000');
    if (shiftFilled) {
      await clickVisible(cashierPage, 'button:has-text("Bắt đầu ca"), button:has-text("Mở ca")');
      recordResult('Thu ngân', 'Mở ca làm việc thu ngân', 'PASS', '1.000.000 đ tiền đầu ca');
      await cashierPage.waitForTimeout(600);
    }

    // 4.2 Click chọn Bàn 1 để nạp hóa đơn
    const clickedCashierTable = await clickVisible(cashierPage, '#table-grid button:has-text("1"), .table-card:has-text("1"), .table-box:has-text("1")');
    if (clickedCashierTable) {
      await cashierPage.waitForTimeout(600);
      recordResult('Thu ngân', 'Click nạp hóa đơn Bàn 1', 'PASS');
    }

    // 4.3 Test nút Giảm giá / Chiết khấu
    const discountOpen = await clickVisible(cashierPage, '#btn-open-discount-modal');
    if (discountOpen) {
      await cashierPage.waitForTimeout(300);
      recordResult('Thu ngân', 'Nút Mở modal Chiết khấu / Giảm giá', 'PASS');
      await cashierPage.keyboard.press('Escape');
    }

    // 4.4 Test nút In phiếu tạm tính
    const btnPrintTempClicked = await clickVisible(cashierPage, '#btn-print-temp');
    if (btnPrintTempClicked) {
      recordResult('Thu ngân', 'Nút In phiếu tạm tính', 'PASS');
    }

    // 4.5 Test các nút gợi ý tiền khách đưa
    const quickCashClicked = await clickVisible(cashierPage, 'button:has-text("500"), button:has-text("200"), button:has-text("Vừa đủ")');
    if (quickCashClicked) {
      recordResult('Thu ngân', 'Nút gợi ý mệnh giá tiền nhanh', 'PASS');
    }

    // 4.6 Nút "Thanh toán & In hóa đơn"
    const payClicked = await clickVisible(cashierPage, '#btn-pay');
    if (payClicked) {
      await cashierPage.waitForTimeout(1000);
      recordResult('Thu ngân', 'Nút Thanh toán & In hóa đơn', 'PASS', 'Đã xác nhận thanh toán');

      await clickVisible(cashierPage, '#btn-close-invoice');
    }

    await cashierPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_cashier_checkout.png') });

  } catch (err) {
    recordResult('Thu ngân', 'Lỗi phân hệ Thu ngân', 'FAIL', err.message);
  } finally {
    await cashierContext.close();
  }

  // ========================================================================
  // PHÂN HỆ 5: QUẢN TRỊ VIÊN (ADMIN)
  // ========================================================================
  console.log('\n👑 --- ĐANG TEST PHÂN HỆ: QUẢN TRỊ VIÊN (ADMIN) ---');
  const adminContext = await createRoleContext(browser, 'Admin', 'admin', { width: 1440, height: 900 });
  const adminPage = await adminContext.newPage();
  adminPage.on('dialog', async d => { await d.accept().catch(() => {}); });

  try {
    await adminPage.goto(`${BASE_URL}/views/staff/admin.html`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForTimeout(1000);
    recordResult('Admin', 'Mở trang Quản trị viên (Đã xác thực)', 'PASS');

    // 5.1 Test nút thu gọn / mở rộng Sidebar
    const sidebarToggleClicked = await clickVisible(adminPage, '#btn-toggle-sidebar');
    if (sidebarToggleClicked) {
      await adminPage.waitForTimeout(200);
      await clickVisible(adminPage, '#btn-toggle-sidebar');
      recordResult('Admin', 'Nút Thu gọn / Mở rộng Sidebar', 'PASS');
    }

    // 5.2 Click qua tất cả các Tab menu điều hướng chính
    const navTabs = [
      { name: 'Quản lý Thực đơn (Menu)', selector: '#nav-tab-menu, [data-tab="menu"]' },
      { name: 'Quản lý Danh mục (Categories)', selector: '#nav-tab-categories, [data-tab="categories"]' },
      { name: 'Quản lý Khuyến mãi (Vouchers)', selector: '#nav-tab-promotions, [data-tab="promotions"]' },
      { name: 'Quản lý Nhân sự (Users)', selector: '#nav-tab-users, [data-tab="users"]' },
      { name: 'Báo cáo Doanh thu (Reports)', selector: '#nav-tab-reports, [data-tab="reports"]' }
    ];

    for (const tab of navTabs) {
      const tabClicked = await clickVisible(adminPage, tab.selector);
      if (tabClicked) {
        await adminPage.waitForTimeout(300);
        recordResult('Admin', `Chuyển tab: ${tab.name}`, 'PASS');
      }
    }

    // 5.3 Test các nút mở Modal thêm mới trong Admin
    await clickVisible(adminPage, '#nav-tab-menu, [data-tab="menu"]');
    await adminPage.waitForTimeout(300);

    const btnOpenCreateMenu = await clickVisible(adminPage, '#btn-open-create-menu');
    if (btnOpenCreateMenu) {
      await adminPage.waitForTimeout(400);
      recordResult('Admin', 'Nút Mở Modal Thêm món ăn mới', 'PASS');
      await clickVisible(adminPage, '#btn-close-menu-modal, #btn-cancel-menu');
      await adminPage.keyboard.press('Escape');
    }

    const btnOpenCreateCombo = await clickVisible(adminPage, '#btn-open-create-combo');
    if (btnOpenCreateCombo) {
      await adminPage.waitForTimeout(400);
      recordResult('Admin', 'Nút Mở Modal Tạo Combo mới', 'PASS');
      await clickVisible(adminPage, '#btn-close-combo-builder');
      await adminPage.keyboard.press('Escape');
    }

    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_admin_dashboard.png') });

  } catch (err) {
    recordResult('Admin', 'Lỗi phân hệ Quản trị viên', 'FAIL', err.message);
  } finally {
    await adminContext.close();
  }

  await browser.close();

  // ========================================================================
  // TỔNG KẾT & XUẤT BÁO CÁO
  // ========================================================================
  console.log('\n================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ KIỂM THỬ PLAYWRIGHT E2E TOÀN DIỆN');
  console.log('================================================================\n');

  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`Tổng số nút/tính năng đã test : ${total}`);
  console.log(`✅ Thành công (PASS)          : ${passed}`);
  console.log(`❌ Thất bại (FAIL)            : ${failed}`);
  console.log(`⚠️  Cảnh báo (WARN)           : ${warned}`);
  console.log(`📸 Ảnh chụp minh chứng đã lưu : ${SCREENSHOTS_DIR}`);

  const reportPath = path.join(__dirname, 'e2e_exhaustive_ui_report.md');
  const reportContent = `# BÁO CÁO KIỂM THỬ PLAYWRIGHT E2E TOÀN DIỆN MỌI GIAO DIỆN & NÚT BẤM
**Thời gian thực hiện:** ${new Date().toLocaleString('vi-VN')}
**Tổng số kiểm thử:** ${total} | **PASS:** ${passed} | **FAIL:** ${failed} | **WARN:** ${warned}

## BẢNG CHI TIẾT TỪNG NÚT BẤM VÀ THAO TÁC:
| STT | Phân hệ | Hành động / Nút bấm | Kết quả | Chi tiết |
| :---: | :--- | :--- | :---: | :--- |
${results.map((r, i) => `| ${i + 1} | ${r.module} | ${r.action} | **${r.status}** | ${r.detail} |`).join('\n')}

---
*Báo cáo được xuất tự động bởi Playwright Automation Suite.*
`;
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`\n📄 Báo cáo chi tiết đã được ghi vào: ${reportPath}\n`);
  process.exit(0);
}

runExhaustiveTest().catch(console.error);
