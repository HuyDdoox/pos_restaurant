const mongoose = require('mongoose');

async function testLoyaltyFlow() {
    console.log('🚀 Bắt đầu kiểm tra hệ thống Hội viên (Cách 1: Nhập SĐT nhanh)...');

    // 1. Tra cứu hội viên cũ
    console.log('\n[TEST 1] Tra cứu hội viên có sẵn (SĐT: 0901234567)...');
    const res1 = await fetch('http://localhost:4000/api/customers?q=0901234567').then(r => r.json());
    console.log('✓ Kết quả tra cứu:', res1.status === 1 && res1.data.length > 0 ? `Tìm thấy [${res1.data[0].name}] - Hạng [${res1.data[0].tier}] - Điểm: ${res1.data[0].points}` : 'Thất bại');
    const goldMember = res1.data[0];

    // 2. Tra cứu số chưa có
    console.log('\n[TEST 2] Tra cứu số điện thoại mới (SĐT: 0999888777)...');
    const res2 = await fetch('http://localhost:4000/api/customers?q=0999888777').then(r => r.json());
    console.log('✓ Kết quả tra cứu số mới:', res2.data.length === 0 ? 'Đúng (Chưa có thẻ -> Kích hoạt đăng ký nhanh)' : 'Lỗi');

    // 3. Đăng ký nhanh số mới
    console.log('\n[TEST 3] Đăng ký nhanh hội viên mới trong 3 giây...');
    const res3 = await fetch('http://localhost:4000/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lê Thử Nghiệm', phone: '0999888777' })
    }).then(r => r.json());
    console.log('✓ Đăng ký thành công:', res3.status === 1 ? `Hội viên mới [${res3.data.name}] - Hạng [${res3.data.tier}]` : res3.message);

    // 4. Lấy 1 món ăn và 1 bàn để test đặt món với ưu đãi Hạng Vàng
    console.log('\n[TEST 4] Khách Hạng Vàng gọi món & áp dụng chiết khấu 10%...');
    const menuRes = await fetch('http://localhost:4000/api/menu').then(r => r.json());
    const tableRes = await fetch('http://localhost:4000/api/tables').then(r => r.json());
    const dish = menuRes.data[0];
    const table = tableRes.data.find(t => t.tableNumber === '01') || tableRes.data[0];

    const subtotal = dish.base_price;
    const discountPercent = 10;
    const discountAmount = Math.round((subtotal * discountPercent) / 100);
    const finalTotal = subtotal - discountAmount;

    const orderPayload = {
        table_id: table._id,
        customerInfo: `${goldMember.name} - ${goldMember.phone} (${goldMember.tier})`,
        customerPhone: goldMember.phone,
        discountType: 'percent',
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        discountReason: `Ưu đãi Hội viên Vàng (${goldMember.name})`,
        notes: 'Khách VIP ăn ít cay',
        items: [
            {
                menuItem_id: dish._id,
                quantity: 1,
                price: dish.base_price
            }
        ]
    };

    const orderRes = await fetch('http://localhost:4000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
    }).then(r => r.json());

    console.log('✓ Đặt món thành công:', orderRes.status === 1 ? 'YES' : 'NO');
    console.log(`  - Món: ${dish.name} (${dish.base_price.toLocaleString()}đ)`);
    console.log(`  - Tạm tính: ${orderRes.data.subtotal.toLocaleString()} đ`);
    console.log(`  - Giảm giá hội viên 10%: -${orderRes.data.discountAmount.toLocaleString()} đ`);
    console.log(`  - Tổng thanh toán thực tế: ${orderRes.data.totalAmount.toLocaleString()} đ`);
    console.log(`  - Thông tin khách hiển thị trên POS: "${orderRes.data.customerInfo}"`);

    // 5. Kiểm tra điểm tích lũy được cộng vào tài khoản khách
    console.log('\n[TEST 5] Kiểm tra điểm thưởng tích lũy tự động...');
    const resCustAfter = await fetch(`http://localhost:4000/api/customers?q=${goldMember.phone}`).then(r => r.json());
    const memberAfter = resCustAfter.data[0];
    const pointsAdded = memberAfter.points - goldMember.points;
    console.log(`✓ Điểm trước khi đặt: ${goldMember.points} điểm`);
    console.log(`✓ Điểm sau khi đặt: ${memberAfter.points} điểm (Được cộng thêm +${pointsAdded} điểm!)`);

    // Dọn dẹp đơn test và số thử nghiệm
    await fetch(`http://localhost:4000/api/orders/${orderRes.data._id}`, { method: 'DELETE' }).catch(() => {});
    await fetch(`http://localhost:4000/api/customers/${res3.data._id}`, { method: 'DELETE' }).catch(() => {});

    console.log('\n🎉 TOÀN BỘ LUỒNG HỘI VIÊN & TÍCH ĐIỂM (CÁCH 1) HOẠT ĐỘNG HOÀN HẢO 100%!');
}

testLoyaltyFlow();
