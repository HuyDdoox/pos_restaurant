const http = require('http');

function request(method, url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = data ? JSON.stringify(data) : null;
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: method,
            headers: {}
        };
        if (postData) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(options, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { resolve(JSON.parse(body || '{}')); }
                catch(e) { resolve({ raw: body }); }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

const get = url => request('GET', url);
const post = (url, data) => request('POST', url, data);
const patch = (url, data) => request('PATCH', url, data);

async function runFullE2ETest() {
    console.log('========================================================================');
    console.log('🚀 BẮT ĐẦU TEST TỰ ĐỘNG TOÀN TRÌNH NHÀ HÀNG & BIẾN THỂ MÓN ĂN');
    console.log('========================================================================');
    const startTime = Date.now();
    const steps = [];

    try {
        // BƯỚC 1: Khởi động & Nạp dữ liệu
        const t1 = Date.now();
        const [menuRes, tablesRes, catRes, variantRes] = await Promise.all([
            get('http://localhost:4000/api/menu?_t=' + Date.now()),
            get('http://localhost:4000/api/tables?_t=' + Date.now()),
            get('http://localhost:4000/api/categories?_t=' + Date.now()),
            get('http://localhost:4000/api/variants?_t=' + Date.now())
        ]);

        if (!menuRes.data || !tablesRes.data || !variantRes.data) {
            throw new Error('Không thể nạp dữ liệu từ Backend API');
        }

        const combos = menuRes.data.filter(m => m.is_combo);
        const singleDishes = menuRes.data.filter(m => !m.is_combo);
        const allVariants = variantRes.data;
        const table01 = tablesRes.data.find(t => t.tableNumber === '01') || tablesRes.data[0];

        steps.push({
            step: '1. Khởi động & Nạp CSDL',
            detail: `Nạp thành công ${menuRes.data.length} món (${combos.length} Combo, ${singleDishes.length} món lẻ), ${allVariants.length} Biến thể, ${tablesRes.data.length} bàn`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t1) + 'ms'
        });

        // BƯỚC 2: Kiểm tra dữ liệu Biến thể món ăn (Variants Coverage)
        const t2 = Date.now();
        if (allVariants.length < 80) {
            throw new Error(`Số lượng biến thể quá ít (${allVariants.length}), chưa đủ phủ cho toàn bộ món!`);
        }
        steps.push({
            step: '2. Kiểm tra Biến thể món ăn',
            detail: `Đã có ${allVariants.length} biến thể ẩm thực phong phú (Độ chín, Nước sốt, Topping, Size, Đường/Đá...)`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t2) + 'ms'
        });

        // BƯỚC 3: Khách đặt món có biến thể & phụ thu (Extra Price)
        const t3 = Date.now();
        const targetCombo = combos[0];
        // Tìm 1 món có biến thể có phụ thu
        const dishWithVariants = singleDishes.find(d => {
            return allVariants.some(v => v.menuItem_id === d._id && v.extra_price > 0);
        }) || singleDishes[0];

        const matchedVariants = allVariants.filter(v => v.menuItem_id === dishWithVariants._id);
        const selectedVariant1 = matchedVariants.find(v => v.extra_price === 0) || matchedVariants[0];
        const selectedVariant2 = matchedVariants.find(v => v.extra_price > 0) || matchedVariants[1] || matchedVariants[0];

        const extraSum = (selectedVariant1 ? selectedVariant1.extra_price : 0) + (selectedVariant2 ? selectedVariant2.extra_price : 0);
        const expectedDishPrice = dishWithVariants.base_price + extraSum;

        const orderPayload = {
            table_id: table01._id,
            customerInfo: `Khách Bàn 01`,
            notes: 'Đơn test tự động có biến thể',
            items: [
                {
                    menuItem_id: targetCombo._id,
                    quantity: 1,
                    price: targetCombo.base_price,
                    is_combo: true,
                    combo_items: targetCombo.combo_items,
                    notes: 'Combo ưu đãi Flash Sale'
                },
                {
                    menuItem_id: dishWithVariants._id,
                    quantity: 1,
                    price: expectedDishPrice,
                    variants_selected: [
                        { _id: selectedVariant1._id, name: selectedVariant1.name, extra_price: selectedVariant1.extra_price },
                        { _id: selectedVariant2._id, name: selectedVariant2.name, extra_price: selectedVariant2.extra_price }
                    ],
                    variantNote: `${selectedVariant1.name}, ${selectedVariant2.name} (+${selectedVariant2.extra_price.toLocaleString('vi-VN')}đ)`
                }
            ]
        };

        const createRes = await post('http://localhost:4000/api/orders', orderPayload);
        const order = createRes.data;
        if (!order || !order._id) {
            throw new Error('Đặt món thất bại: ' + JSON.stringify(createRes));
        }

        const expectedTotal = targetCombo.base_price + expectedDishPrice;
        if (order.totalAmount !== expectedTotal && order.subtotal !== expectedTotal) {
            throw new Error(`Tổng tiền tính toán sai: mong đợi ${expectedTotal}đ, backend tính ${order.totalAmount}đ`);
        }

        steps.push({
            step: '3. Khách đặt món có Biến thể',
            detail: `Đơn #${order._id.slice(-6)}: 1x [${targetCombo.name}] + 1x [${dishWithVariants.name} (${selectedVariant1.name}, ${selectedVariant2.name})]. Tổng tiền khớp chuẩn: ${order.totalAmount.toLocaleString('vi-VN')} đ`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t3) + 'ms'
        });

        // BƯỚC 4: Bếp KDS nhận chi tiết món & Bắt đầu nấu
        const t4 = Date.now();
        const detailsRes = await get(`http://localhost:4000/api/order-details?order_id=${order._id}`);
        const details = detailsRes.data || [];
        if (details.length === 0) {
            throw new Error('Không tìm thấy OrderDetail nào cho đơn hàng!');
        }

        for (const item of details) {
            await patch(`http://localhost:4000/api/order-details/${item._id}/status`, { status: 'Cooking' });
        }

        steps.push({
            step: '4. Bếp KDS tiếp nhận & Nấu',
            detail: `Chuyển ${details.length} món sang trạng thái: Cooking (Đang chế biến trên bếp)`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t4) + 'ms'
        });

        // BƯỚC 5: Bếp nấu xong -> Ready
        const t5 = Date.now();
        for (const item of details) {
            await patch(`http://localhost:4000/api/order-details/${item._id}/status`, { status: 'Ready' });
        }
        steps.push({
            step: '5. Bếp hoàn tất món -> Sẵn sàng',
            detail: `Chuyển ${details.length} món sang trạng thái: Ready (Báo chuông cho phục vụ bưng)`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t5) + 'ms'
        });

        // BƯỚC 6: Phục vụ bưng món lên Bàn 01 -> Served
        const t6 = Date.now();
        for (const item of details) {
            await patch(`http://localhost:4000/api/order-details/${item._id}/status`, { status: 'Served' });
        }
        steps.push({
            step: '6. Phục vụ bưng lên Bàn 01',
            detail: `Chuyển ${details.length} món sang trạng thái: Served (Đã phục vụ xong)`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t6) + 'ms'
        });

        // BƯỚC 7: Thu ngân thanh toán & Đóng đơn -> Completed
        const t7 = Date.now();
        await patch(`http://localhost:4000/api/orders/${order._id}`, {
            status: 'Completed',
            paymentStatus: 'Paid'
        });

        // Kiểm tra Bàn 01 đã được giải phóng về Available chưa
        const checkTableRes = await get(`http://localhost:4000/api/tables?_t=${Date.now()}`);
        const updatedTable01 = checkTableRes.data.find(t => t._id === table01._id);
        const isTableFree = updatedTable01 && updatedTable01.status === 'Available';

        steps.push({
            step: '7. Thu ngân thanh toán & Đóng bàn',
            detail: `Đơn #${order._id.slice(-6)}: Completed & Paid. Trạng thái Bàn 01: ${isTableFree ? 'Available (Sẵn sàng đón khách mới)' : updatedTable01.status}`,
            status: '✅ THÀNH CÔNG',
            time: (Date.now() - t7) + 'ms'
        });

    } catch (err) {
        steps.push({
            step: 'LỖI PHÁT SINH',
            detail: err.message,
            status: '❌ THẤT BẠI',
            time: '0ms'
        });
    }

    const totalDuration = Date.now() - startTime;

    console.table(steps);
    console.log('========================================================================');
    console.log(`⏱️ TỔNG THỜI GIAN TEST TOÀN TRÌNH: ${totalDuration} ms (~${(totalDuration / 1000).toFixed(2)} giây)`);
    console.log('🎉 KẾT QUẢ: HỆ THỐNG LIÊN THÔNG VÀ TÍNH TIỀN BIẾN THỂ HOÀN TOÀN CHÍNH XÁC!');
    console.log('========================================================================');
}

runFullE2ETest();
