const mongoose = require('mongoose');
const { Customer } = require('../models');

async function seedCustomers() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/restaurant_pos');
        console.log('Connected to MongoDB');

        const customers = [
            {
                name: 'Nguyễn Văn Nam',
                phone: '0901234567',
                email: 'nam.nguyen@gmail.com',
                tier: 'Gold',
                points: 350,
                totalSpent: 4250000,
                notes: 'Khách VIP thân thiết, thích ngồi bàn gần cửa sổ'
            },
            {
                name: 'Lê Hoàng Long',
                phone: '0988888888',
                email: 'long.le@gmail.com',
                tier: 'Diamond',
                points: 890,
                totalSpent: 12500000,
                notes: 'Khách Kim Cương VIP, chuộng bò Wagyu và hải sản cao cấp'
            },
            {
                name: 'Trần Thị Mai',
                phone: '0912345678',
                email: 'mai.tran@gmail.com',
                tier: 'Silver',
                points: 180,
                totalSpent: 1800000,
                notes: 'Hội viên Bạc tích cực, thích tráng miệng kem và cocktail'
            },
            {
                name: 'Phạm Thu Hà',
                phone: '0933221100',
                email: 'ha.pham@gmail.com',
                tier: 'Bronze',
                points: 50,
                totalSpent: 750000,
                notes: 'Hội viên Đồng mới gia nhập'
            }
        ];

        for (const c of customers) {
            await Customer.findOneAndUpdate(
                { phone: c.phone },
                { $set: c },
                { upsert: true, new: true }
            );
            console.log(`✓ Đã nạp hội viên: ${c.name} - SĐT: ${c.phone} [${c.tier}]`);
        }

        console.log('===> ĐÃ SEED HỘI VIÊN MẪU THÀNH CÔNG! <===');
        process.exit(0);
    } catch (err) {
        console.error('Lỗi khi seed customers:', err);
        process.exit(1);
    }
}

seedCustomers();
