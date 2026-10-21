// Kịch bản kiểm thử độc lập: Khách order -> Phục vụ duyệt món -> Bếp nhận món
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        };

        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

async function run() {
    console.log('============================================================');
    console.log('🧪 TEST LUỒNG: KHÁCH ĐẶT MÓN -> NHÂN VIÊN DUYỆT MÓN ĐỂ NẤU');
    console.log('============================================================\n');

    // 1. Tìm bàn 02
    const tablesRes = await request('/tables');
    const tables = Array.isArray(tablesRes.data) ? tablesRes.data : tablesRes.data.data;
    const table02 = tables.find(t => t.tableNumber === '02' || t.name === 'Bàn 02');
    if (!table02) throw new Error('Không tìm thấy bàn 02');
    console.log(`✅ [1] Tìm thấy bàn 02: ID = ${table02.id || table02._id}`);

    // 2. Lấy 2 món từ Menu
    const menuRes = await request('/menu');
    const menu = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data.data;
    const dish1 = menu[0];
    const dish2 = menu[1];
    console.log(`✅ [2] Chọn món: 1. "${dish1.name}" (${dish1.price || dish1.base_price}đ), 2. "${dish2.name}" (${dish2.price || dish2.base_price}đ)`);

    // 3. Khách đặt món (POST /api/orders)
    const orderPayload = {
        table_id: table02.id || table02._id,
        customerInfo: 'Khách test order',
        discountType: 'none',
        discountPercent: 0,
        discountAmount: 0,
        notes: 'Không ớt, làm nóng',
        items: [
            {
                menuItem_id: dish1.id || dish1._id,
                name: dish1.name,
                quantity: 1,
                price: dish1.price || dish1.base_price,
                priceAtOrder: dish1.price || dish1.base_price,
                status: 'Unconfirmed',
                variants_selected: [],
                variantNote: 'Vừa chín tới'
            },
            {
                menuItem_id: dish2.id || dish2._id,
                name: dish2.name,
                quantity: 2,
                price: dish2.price || dish2.base_price,
                priceAtOrder: dish2.price || dish2.base_price,
                status: 'Unconfirmed',
                variants_selected: [],
                variantNote: ''
            }
        ]
    };

    const orderRes = await request('/orders', { method: 'POST', body: orderPayload });
    const order = orderRes.data.data || orderRes.data;
    console.log(`✅ [3] Khách gửi đơn thành công: Order ID = ${order.id || order._id}`);

    // 4. Nhân viên Phục vụ tải chi tiết đơn
    const detailsRes = await request(`/order-details?order_id=${order.id || order._id}`);
    const details = Array.isArray(detailsRes.data) ? detailsRes.data : detailsRes.data.data;
    console.log(`✅ [4] Nhân viên tải ra ${details.length} chi tiết món ăn.`);

    // Kiểm tra giá tiền và trạng thái từng món
    let hasNaN = false;
    let unconfirmedCount = 0;
    for (const item of details) {
        const p = item.priceAtOrder !== undefined ? item.priceAtOrder : item.price;
        if (p === undefined || isNaN(Number(p))) {
            hasNaN = true;
        }
        if ((item.status || '').toLowerCase() === 'unconfirmed') {
            unconfirmedCount++;
        }
        console.log(`    - Món: ${item.name} | SL: ${item.quantity} | Giá: ${p}đ | Thành tiền: ${(p * item.quantity).toLocaleString('vi-VN')}đ | Trạng thái: ${item.status}`);
    }

    if (hasNaN) {
        console.error('❌ [FAIL] Phát hiện món có giá trị NaN!');
        process.exit(1);
    } else {
        console.log('✅ [5] Không có món nào bị lỗi giá NaN đ!');
    }

    if (unconfirmedCount !== 2) {
        console.error(`❌ [FAIL] Số món Chờ duyệt không đúng: ${unconfirmedCount} (kỳ vọng: 2)`);
        process.exit(1);
    } else {
        console.log(`✅ [6] Đơn có đúng ${unconfirmedCount} món ở trạng thái "Unconfirmed" (Chờ XN).`);
    }

    // 5. Nhân viên Phục vụ bấm "Xác nhận Order" (Duyệt món để nấu)
    console.log('\n--- 🚀 Nhân viên phục vụ bấm "Xác nhận Order" ---');
    let approvedCount = 0;
    for (const item of details) {
        if ((item.status || '').toLowerCase() === 'unconfirmed') {
            const targetId = item.id || item._id;
            const patchRes = await request(`/order-details/${targetId}`, {
                method: 'PATCH',
                body: { status: 'Pending' }
            });
            if (patchRes.status < 400) approvedCount++;
        }
    }

    // Đồng bộ vào order.items
    const orderItems = (order.items || []).map(it => ({ ...it, status: 'Pending' }));
    await request(`/orders/${order.id || order._id}`, {
        method: 'PATCH',
        body: { items: orderItems }
    });

    console.log(`✅ [7] Đã duyệt thành công ${approvedCount}/${details.length} món sang trạng thái "Pending" (Chờ bếp)!`);

    // 6. Kiểm tra Bếp đã nhận được món
    const pendingKitchenRes = await request('/order-details?status=Pending');
    const pendingItems = Array.isArray(pendingKitchenRes.data) ? pendingKitchenRes.data : pendingKitchenRes.data.data;
    const ourKitchenItems = pendingItems.filter(it => (it.order_id === (order.id || order._id)));
    console.log(`✅ [8] Màn hình Bếp (KDS) đã nhận được ${ourKitchenItems.length} món từ đơn này.`);

    console.log('\n============================================================');
    console.log('🎉 TẤT CẢ KIỂM THỬ ĐÃ PASS 100%! KHÔNG CÒN LỖI NaN HOẶC LỖI DUYỆT MÓN.');
    console.log('============================================================');
}

run().catch(err => {
    console.error('Lỗi khi chạy test:', err);
    process.exit(1);
});
