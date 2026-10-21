/**
 * =========================================================================
 * FAST AUTOMATED SYSTEM INTEGRATION TEST (Node.js)
 * Kịch bản kiểm thử toàn trình đa phân hệ (Khách hàng -> Phục vụ -> Bếp -> Thu ngân -> Admin)
 * =========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
let passCount = 0;
let failCount = 0;
const results = [];

function recordResult(moduleName, featureName, isPass, detail = '') {
    if (isPass) {
        passCount++;
        results.push({ module: moduleName, feature: featureName, status: 'PASSED', detail });
        console.log(`  ✅ [PASS] [${moduleName}] ${featureName} ${detail ? '(' + detail + ')' : ''}`);
    } else {
        failCount++;
        results.push({ module: moduleName, feature: featureName, status: 'FAILED', detail });
        console.error(`  ❌ [FAIL] [${moduleName}] ${featureName} - ${detail}`);
    }
}

function request(method, pathName, body = null, headers = {}) {
    return new Promise((resolve) => {
        const url = new URL(pathName, BASE_URL);
        const postData = body ? JSON.stringify(body) : '';
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        if (postData) {
            reqHeaders['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: reqHeaders,
                timeout: 5000
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    let json = null;
                    try {
                        json = JSON.parse(data);
                    } catch (_) {
                        json = data;
                    }
                    resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
                });
            }
        );

        req.on('error', (err) => {
            resolve({ statusCode: 500, error: err.message, body: null });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ statusCode: 408, error: 'Request Timeout', body: null });
        });

        if (postData) req.write(postData);
        req.end();
    });
}

async function runAllTests() {
    console.log('\n============================================================');
    console.log('🚀 BẮT ĐẦU CHẠY KỊCH BẢN KIỂM THỬ TỰ ĐỘNG HỆ THỐNG FOODHUB POS');
    console.log('============================================================\n');

    const startTime = Date.now();

    // -----------------------------------------------------------------
    // PHẦN 1: KIỂM THỬ XÁC THỰC, PHÂN QUYỀN VÀ ĐĂNG XUẤT (AUTH & LOGOUT)
    // -----------------------------------------------------------------
    console.log('--- 1. KIỂM THỬ ĐĂNG NHẬP, PHÂN QUYỀN & ĐĂNG XUẤT ---');
    
    // 1.1 Đăng nhập Admin
    const loginAdmin = await request('POST', '/api/login', { username: 'admin_hcm', password: '123' });
    // Nếu pass '123' sai, thử '123456'
    let adminToken = '';
    const adminRes = (loginAdmin.statusCode === 200) ? loginAdmin : await request('POST', '/api/login', { username: 'admin_hcm', password: '123456' });
    if (adminRes.statusCode === 200 && adminRes.body?.user?.role === 'Admin') {
        adminToken = adminRes.body.access_token;
        recordResult('Auth', 'Đăng nhập Quản trị viên (Admin)', true, `User: ${adminRes.body.user.fullname}`);
    } else {
        recordResult('Auth', 'Đăng nhập Quản trị viên (Admin)', false, `Status: ${adminRes.statusCode}`);
    }

    // 1.2 Đăng nhập Waiter
    const waiterRes = await request('POST', '/api/login', { username: 'waiter_nhat', password: '123456' });
    if (waiterRes.statusCode === 200 && waiterRes.body?.user?.role === 'Waiter') {
        recordResult('Auth', 'Đăng nhập Nhân viên phục vụ (Waiter)', true, `User: ${waiterRes.body.user.fullname}`);
    } else {
        recordResult('Auth', 'Đăng nhập Nhân viên phục vụ (Waiter)', false, `Status: ${waiterRes.statusCode}`);
    }

    // 1.3 Đăng nhập Chef/Kitchen
    const chefRes = await request('POST', '/api/login', { username: 'chef_wong', password: '123456' });
    if (chefRes.statusCode === 200 && (chefRes.body?.user?.role === 'Chef' || chefRes.body?.user?.role === 'Kitchen')) {
        recordResult('Auth', 'Đăng nhập Bếp trưởng (Chef/Kitchen)', true, `User: ${chefRes.body.user.fullname}`);
    } else {
        recordResult('Auth', 'Đăng nhập Bếp trưởng (Chef/Kitchen)', false, `Status: ${chefRes.statusCode}`);
    }

    // 1.4 Đăng nhập Cashier
    const cashierRes = await request('POST', '/api/login', { username: 'cashier_lan', password: '123456' });
    if (cashierRes.statusCode === 200 && cashierRes.body?.user?.role === 'Cashier') {
        recordResult('Auth', 'Đăng nhập Thu ngân (Cashier)', true, `User: ${cashierRes.body.user.fullname}`);
    } else {
        recordResult('Auth', 'Đăng nhập Thu ngân (Cashier)', false, `Status: ${cashierRes.statusCode}`);
    }

    // 1.5 Kiểm tra từ chối mật khẩu sai
    const badLogin = await request('POST', '/api/login', { username: 'admin_hcm', password: 'wrongpassword' });
    recordResult('Auth', 'Từ chối mật khẩu không đúng', badLogin.statusCode === 401, `Status code: ${badLogin.statusCode}`);

    // 1.6 Kiểm tra tích hợp nút Đăng xuất trên cả 4 giao diện nhân viên
    const staffDir = path.resolve(__dirname, '../frontend/public/views/staff');
    const cashierHtml = fs.readFileSync(path.join(staffDir, 'cashier.html'), 'utf8');
    const adminHtml = fs.readFileSync(path.join(staffDir, 'admin.html'), 'utf8');
    const kitchenHtml = fs.readFileSync(path.join(staffDir, 'kitchen.html'), 'utf8');
    const waiterHtml = fs.readFileSync(path.join(staffDir, 'waiter.html'), 'utf8');

    const cashierHasLogout = cashierHtml.includes('logout()');
    const adminHasLogout = adminHtml.includes('logout()');
    const kitchenHasLogout = kitchenHtml.includes('logout()');
    const waiterHasLogout = waiterHtml.includes('logout()');

    recordResult('Logout', 'Nút đăng xuất trên trang Thu ngân (Cashier)', cashierHasLogout);
    recordResult('Logout', 'Nút đăng xuất trên trang Quản trị (Admin)', adminHasLogout);
    recordResult('Logout', 'Nút đăng xuất trên trang Bếp KDS (Kitchen)', kitchenHasLogout);
    recordResult('Logout', 'Nút đăng xuất trên trang Phục vụ (Waiter)', waiterHasLogout);

    // -----------------------------------------------------------------
    // PHẦN 2: PHÂN HỆ KHÁCH HÀNG (CUSTOMER - XEM MENU, CHỌN BÀN, ĐẶT MÓN)
    // -----------------------------------------------------------------
    console.log('\n--- 2. KIỂM THỬ PHÂN HỆ KHÁCH HÀNG (CUSTOMER) ---');

    // 2.1 Tải danh mục thực đơn
    const catRes = await request('GET', '/api/categories');
    const categories = Array.isArray(catRes.body) ? catRes.body : (catRes.body?.data || []);
    recordResult('Customer', 'Tải danh mục thực đơn', catRes.statusCode === 200 && categories.length > 0, `${categories.length} danh mục`);

    // 2.2 Tải món ăn
    const menuRes = await request('GET', '/api/menu');
    const menuItems = Array.isArray(menuRes.body) ? menuRes.body : (menuRes.body?.data || []);
    recordResult('Customer', 'Tải danh sách món ăn', menuRes.statusCode === 200 && menuItems.length > 0, `${menuItems.length} món ăn`);

    // 2.3 Chọn bàn kiểm thử (Bàn 02)
    const tablesRes = await request('GET', '/api/tables');
    const tables = Array.isArray(tablesRes.body) ? tablesRes.body : (tablesRes.body?.data || []);
    const targetTable = tables.find(t => t.tableNumber === '02' || t.tableNumber === '2') || tables[1] || tables[0];
    const testTableId = targetTable.id || targetTable._id;
    recordResult('Customer', `Chọn bàn đặt món (${targetTable.tableNumber})`, !!targetTable, `Table ID: ${testTableId}`);

    // 2.4 Khách đặt món qua web/QR
    const dish1 = menuItems[0];
    const dish2 = menuItems[1] || menuItems[0];
    const orderPayload = {
        table_id: testTableId,
        customerInfo: `Khách Bàn ${targetTable.tableNumber}`,
        customerPhone: '0912345678',
        discountType: 'none',
        discountPercent: 0,
        discountAmount: 0,
        notes: 'Test đơn tự động - ít cay',
        items: [
            {
                menuItem_id: dish1.id || dish1._id,
                name: dish1.name,
                quantity: 2,
                price: dish1.price || 50000,
                variants_selected: [],
                variantNote: 'Bản chuẩn'
            },
            {
                menuItem_id: dish2.id || dish2._id,
                name: dish2.name,
                quantity: 1,
                price: dish2.price || 80000,
                variants_selected: [],
                variantNote: 'Không hành'
            }
        ]
    };

    const placeOrderRes = await request('POST', '/api/orders', orderPayload);
    const createdOrder = placeOrderRes.body?.data || placeOrderRes.body;
    const createdOrderId = createdOrder?._id || createdOrder?.id;

    recordResult('Customer', 'Gửi lệnh đặt món (POST /api/orders)', placeOrderRes.statusCode === 201 || placeOrderRes.statusCode === 200, `Order ID: ${createdOrderId}`);

    // 2.5 Kiểm tra trạng thái món sau khi khách đặt phải là 'Unconfirmed' (Chờ nhân viên duyệt)
    const checkDetailsRes = await request('GET', `/api/order-details?order_id=${createdOrderId}`);
    const details = Array.isArray(checkDetailsRes.body) ? checkDetailsRes.body : (checkDetailsRes.body?.data || []);
    const allUnconfirmed = details.length > 0 && details.every(d => (d.status || '').toLowerCase() === 'unconfirmed');
    recordResult('Customer', 'Món mới đặt ở trạng thái Chờ duyệt (Unconfirmed)', allUnconfirmed, `${details.length} món`);

    // 2.6 Kiểm tra bàn chuyển sang trạng thái Occupied
    const updatedTableRes = await request('GET', `/api/tables/${testTableId}`);
    const updatedTable = updatedTableRes.body?.data || updatedTableRes.body;
    const isOccupied = (updatedTable?.status || '').toLowerCase() === 'occupied';
    recordResult('Customer', 'Bàn chuyển sang Đang có khách (Occupied)', isOccupied, `Status: ${updatedTable?.status}`);

    // -----------------------------------------------------------------
    // PHẦN 3: PHÂN HỆ PHỤC VỤ (WAITER - LOAD ĐƠN & DUYỆT MÓN ĐỂ NẤU)
    // -----------------------------------------------------------------
    console.log('\n--- 3. KIỂM THỬ PHÂN HỆ PHỤC VỤ (WAITER) ---');

    // 3.1 Nhân viên load đơn mở của bàn
    const waiterOrdersRes = await request('GET', `/api/orders?table_id=${testTableId}&status=In_Progress&status=Waiting_Payment`);
    const waiterOrders = Array.isArray(waiterOrdersRes.body) ? waiterOrdersRes.body : (waiterOrdersRes.body?.data || []);
    const loadedActiveOrder = waiterOrders.find(o => (o.id || o._id) === createdOrderId) || waiterOrders[waiterOrders.length - 1];
    recordResult('Waiter', 'Load chính xác đơn hàng khách vừa đặt', !!loadedActiveOrder && (loadedActiveOrder.id || loadedActiveOrder._id) === createdOrderId);

    // 3.2 Nhân viên duyệt món để chuyển xuống bếp ("Duyệt món để nấu")
    let approvedCount = 0;
    for (const item of details) {
        const itemId = item.id || item._id;
        const patchRes = await request('PATCH', `/api/order-details/${itemId}`, { status: 'Pending' });
        if (patchRes.statusCode === 200) approvedCount++;
    }
    recordResult('Waiter', 'Duyệt món để nấu (chuyển Unconfirmed -> Pending)', approvedCount === details.length, `Đã duyệt ${approvedCount}/${details.length} món`);

    // -----------------------------------------------------------------
    // PHẦN 4: PHÂN HỆ BẾP (KITCHEN / KDS - NHẬN MÓN, NẤU & HOÀN THÀNH)
    // -----------------------------------------------------------------
    console.log('\n--- 4. KIỂM THỬ PHÂN HỆ BẾP (KITCHEN / KDS) ---');

    // 4.1 Bếp tải hàng đợi món chờ nấu
    const kitchenQueueRes = await request('GET', '/api/order-details?status=Pending');
    const kitchenPending = Array.isArray(kitchenQueueRes.body) ? kitchenQueueRes.body : (kitchenQueueRes.body?.data || []);
    const hasOurDishes = kitchenPending.some(d => (d.order_id === createdOrderId));
    recordResult('Kitchen', 'Bếp nhận món trong hàng đợi chờ nấu (status=Pending)', hasOurDishes, `Hàng đợi: ${kitchenPending.length} món`);

    // 4.2 Bếp chuyển món sang Đang nấu (Cooking)
    const testDetailId = details[0]?.id || details[0]?._id;
    const startCookRes = await request('PATCH', `/api/order-details/${testDetailId}`, { status: 'Cooking' });
    recordResult('Kitchen', 'Bếp bấm Bắt đầu nấu (Pending -> Cooking)', startCookRes.statusCode === 200, `Item ID: ${testDetailId}`);

    // 4.3 Bếp nấu xong -> Báo sẵn sàng (Ready)
    const finishCookRes = await request('PATCH', `/api/order-details/${testDetailId}`, { status: 'Ready' });
    recordResult('Kitchen', 'Bếp nấu xong món (Cooking -> Ready)', finishCookRes.statusCode === 200, `Món sẵn sàng bưng`);

    // Cập nhật tất cả các món còn lại sang Ready để phục vụ và tính tiền
    for (let i = 1; i < details.length; i++) {
        const id = details[i].id || details[i]._id;
        await request('PATCH', `/api/order-details/${id}`, { status: 'Ready' });
    }

    // -----------------------------------------------------------------
    // PHẦN 5: PHỤC VỤ TRẢ MÓN (WAITER - SERVE DISHES)
    // -----------------------------------------------------------------
    console.log('\n--- 5. KIỂM THỬ PHỤC VỤ TRẢ MÓN (WAITER SERVE) ---');

    // 5.1 Phục vụ kiểm tra khay món chờ bưng (status=Ready)
    const readyTrayRes = await request('GET', '/api/order-details?status=Ready');
    const readyTray = Array.isArray(readyTrayRes.body) ? readyTrayRes.body : (readyTrayRes.body?.data || []);
    recordResult('Waiter', 'Khay món sẵn sàng bưng ra bàn (status=Ready)', readyTray.length > 0, `${readyTray.length} món sẵn sàng`);

    // 5.2 Phục vụ bưng món lên bàn (Ready -> Served)
    let servedCount = 0;
    for (const item of details) {
        const id = item.id || item._id;
        const res = await request('PATCH', `/api/order-details/${id}`, { status: 'Served' });
        if (res.statusCode === 200) servedCount++;
    }
    recordResult('Waiter', 'Bưng món lên bàn phục vụ (Ready -> Served)', servedCount === details.length, `Đã phục vụ ${servedCount} món`);

    // -----------------------------------------------------------------
    // PHẦN 6: PHÂN HỆ THU NGÂN (CASHIER - MỞ CA, HÓA ĐƠN & THANH TOÁN)
    // -----------------------------------------------------------------
    console.log('\n--- 6. KIỂM THỬ PHÂN HỆ THU NGÂN (CASHIER) ---');

    // 6.1 Kiểm tra ca làm việc hiện tại
    const shiftRes = await request('GET', '/api/shifts/current');
    recordResult('Cashier', 'Kiểm tra thông tin ca làm việc (Shifts)', shiftRes.statusCode === 200);

    // 6.2 Thu ngân lấy danh sách hóa đơn chưa thanh toán
    const unpaidRes = await request('GET', '/api/orders?paymentStatus=Unpaid&paymentStatus=unpaid');
    const unpaidList = Array.isArray(unpaidRes.body) ? unpaidRes.body : (unpaidRes.body?.data || []);
    const foundUnpaid = unpaidList.some(o => (o.id || o._id) === createdOrderId);
    recordResult('Cashier', 'Tìm thấy hóa đơn chưa thanh toán của bàn', foundUnpaid, `Tổng hóa đơn chưa trả: ${unpaidList.length}`);

    // 6.3 Thu ngân thanh toán hóa đơn
    const payRes = await request('PATCH', `/api/orders/${createdOrderId}`, {
        paymentStatus: 'Paid',
        status: 'Completed',
        paymentMethod: 'Cash',
        paidAt: new Date().toISOString()
    });
    recordResult('Cashier', 'Thanh toán hóa đơn hoàn tất (PATCH /api/orders)', payRes.statusCode === 200, `Hóa đơn: ${createdOrderId}`);

    // 6.4 Thu ngân giải phóng bàn (chuyển về Available)
    const freeTableRes = await request('PATCH', `/api/tables/${testTableId}`, {
        status: 'Available',
        currentOrder_id: null
    });
    recordResult('Cashier', 'Giải phóng bàn đón khách mới (Occupied -> Available)', freeTableRes.statusCode === 200);

    // -----------------------------------------------------------------
    // PHẦN 7: PHÂN HỆ QUẢN TRỊ (ADMIN - THỰC ĐƠN, DANH MỤC, NGƯỜI DÙNG)
    // -----------------------------------------------------------------
    console.log('\n--- 7. KIỂM THỬ PHÂN HỆ QUẢN TRỊ (ADMIN) ---');

    // 7.1 Admin tạo món ăn mới
    const newDishData = {
        name: 'Món Test Admin ' + Date.now(),
        category_id: categories[0]?.id || categories[0]?._id || 'cat_01',
        price: 99000,
        status: 'Available',
        description: 'Món thử nghiệm tự động bởi script test',
        createdAt: new Date().toISOString()
    };
    const createDishRes = await request('POST', '/api/menu', newDishData);
    const createdDish = createDishRes.body?.data || createDishRes.body;
    const testDishId = createdDish?.id || createdDish?._id;
    recordResult('Admin', 'Thêm món ăn mới vào thực đơn (POST /api/menu)', createDishRes.statusCode === 201 || createDishRes.statusCode === 200, `Dish ID: ${testDishId}`);

    // 7.2 Admin chỉnh sửa món ăn
    if (testDishId) {
        const updateDishRes = await request('PATCH', `/api/menu/${testDishId}`, { price: 109000 });
        recordResult('Admin', 'Cập nhật giá món ăn (PATCH /api/menu/:id)', updateDishRes.statusCode === 200, 'Giá mới: 109.000đ');

        // 7.3 Admin xóa mềm món ăn (Soft Delete)
        const deleteDishRes = await request('PATCH', `/api/menu/${testDishId}`, {
            status: 'Archived',
            deletedAt: new Date().toISOString()
        });
        recordResult('Admin', 'Ẩn / Xóa mềm món ăn (status=Archived)', deleteDishRes.statusCode === 200);
    }

    // 7.4 Admin xem danh sách người dùng hệ thống
    const usersRes = await request('GET', '/api/users');
    const users = Array.isArray(usersRes.body) ? usersRes.body : (usersRes.body?.data || []);
    recordResult('Admin', 'Quản lý tài khoản người dùng (GET /api/users)', usersRes.statusCode === 200 && users.length > 0, `${users.length} tài khoản`);

    // 7.5 Admin ghi nhận nhật ký kiểm toán (Audit Log)
    const auditRes = await request('POST', '/api/audit-logs', {
        id: `LOG_${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: 'SYSTEM_TEST',
        actor: 'AutoTester',
        action: 'RUN_INTEGRATION_TEST',
        detail: 'Kiểm thử toàn trình tự động kết thúc thành công',
        severity: 'info'
    });
    recordResult('Admin', 'Ghi nhật ký kiểm toán hệ thống (Audit Logs)', auditRes.statusCode === 201 || auditRes.statusCode === 200);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n============================================================');
    console.log(`📊 BÁO CÁO KẾT QUẢ KIỂM THỬ TOÀN DIỆN (${duration}s)`);
    console.log(`   TỔNG SỐ TEST: ${passCount + failCount}`);
    console.log(`   ✅ PASSED:    ${passCount}`);
    console.log(`   ❌ FAILED:    ${failCount}`);
    console.log(`   TỶ LỆ ĐẠT:    ${Math.round((passCount / (passCount + failCount)) * 100)}%`);
    console.log('============================================================\n');

    process.exit(failCount === 0 ? 0 : 1);
}

runAllTests();
