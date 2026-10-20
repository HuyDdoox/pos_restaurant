const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Models
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const Variant = require('../models/Variant');
const Table = require('../models/Table');
const Order = require('../models/Order');
const OrderDetail = require('../models/OrderDetail');
const Payment = require('../models/Payment');
const CashTransaction = require('../models/CashTransaction');
const LossReport = require('../models/LossReport');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_pos';

async function seedData() {
    console.log('🚀 Kết nối tới MongoDB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Đã kết nối cơ sở dữ liệu thành công!');

    // 1. DỌN SẠCH DỮ LIỆU CŨ & TEST RÁC
    console.log('🧹 Bắt đầu dọn sạch dữ liệu cũ và dữ liệu test...');
    await MenuItem.deleteMany({});
    await Category.deleteMany({});
    await Ingredient.deleteMany({});
    await Recipe.deleteMany({});
    await Variant.deleteMany({});
    await Order.deleteMany({});
    await OrderDetail.deleteMany({});
    await Payment.deleteMany({});
    await CashTransaction.deleteMany({});
    await LossReport.deleteMany({});
    
    // Đặt lại trạng thái tất cả bàn về Trống (Available)
    await Table.updateMany({}, { $set: { status: 'Available', currentOrderId: null } });
    console.log('✅ Đã làm sạch toàn bộ dữ liệu menu cũ, đơn hàng test và đưa sơ đồ bàn về Available!');

    // 2. TẠO 7 DANH MỤC CHUẨN NHÀ HÀNG ÂU (WESTERN CATEGORIES)
    console.log('📦 Đang tạo danh mục món Âu chuẩn...');
    const categoriesData = [
        {
            name: 'Khai Vị & Salad',
            icon: 'fa-bowl-food',
            description: 'Các món khai vị tinh tế và salad tươi giòn đánh thức vị giác ẩm thực Âu',
            displayOrder: 1,
            status: 'Active'
        },
        {
            name: 'Bò & Cừu Nướng',
            icon: 'fa-drumstick-bite',
            description: 'Bò bít tết hảo hạng và sườn cừu nướng than hoa thảo mộc châu Âu',
            displayOrder: 2,
            status: 'Active'
        },
        {
            name: 'Hải Sản Châu Âu',
            icon: 'fa-shrimp',
            description: 'Tôm hùm đút lò phô mai và cá hồi Na Uy tươi áp chảo bơ chanh',
            displayOrder: 3,
            status: 'Active'
        },
        {
            name: 'Mì Ý & Pizza',
            icon: 'fa-pizza-slice',
            description: 'Mì Ý truyền thống Roma và Pizza nướng củi ủ men thủ công 48h',
            displayOrder: 4,
            status: 'Active'
        },
        {
            name: 'Tráng Miệng',
            icon: 'fa-ice-cream',
            description: 'Tiramisu Mascarpone, Lava chocolate béo ngậy và Panna Cotta dâu rừng',
            displayOrder: 5,
            status: 'Active'
        },
        {
            name: 'Rượu Vang & Đồ Uống',
            icon: 'fa-wine-glass',
            description: 'Vang Pháp, New Zealand thượng hạng, cocktail cổ điển và nước ép tươi',
            displayOrder: 6,
            status: 'Active'
        },
        {
            name: 'Combo Tiệc Âu',
            icon: 'fa-boxes-stacked',
            description: 'Set thực đơn tiệc Âu kết hợp hoàn hảo từ khai vị đến tráng miệng với giá ưu đãi',
            displayOrder: 7,
            status: 'Active'
        }
    ];

    const catMap = {};
    for (const cat of categoriesData) {
        const doc = await Category.create(cat);
        catMap[cat.name] = doc._id;
        console.log(`   + Danh mục: ${cat.name} (${cat.icon}) [ID: ${doc._id}]`);
    }

    // 3. TẠO NGUYÊN LIỆU KHO THỰC TẾ (40 INGREDIENTS VỚI GIÁ VỐN & TỒN KHO THẬT)
    console.log('🥩 Đang tạo 40 nguyên liệu kho ẩm thực Âu thực tế...');
    const ingredientsData = [
        // Thịt & Hải sản cao cấp
        { name: 'Thăn nội bò Úc (Tenderloin)', unit: 'kg', cost_price: 480000, stock_quantity: 15.0, min_threshold: 3.0 },
        { name: 'Thăn lưng bò Mỹ (Prime Ribeye)', unit: 'kg', cost_price: 520000, stock_quantity: 18.0, min_threshold: 3.0 },
        { name: 'Sườn cừu New Zealand (Lamb Chops)', unit: 'kg', cost_price: 420000, stock_quantity: 12.0, min_threshold: 2.0 },
        { name: 'Phi lê cá hồi tươi Na Uy', unit: 'kg', cost_price: 450000, stock_quantity: 14.0, min_threshold: 3.0 },
        { name: 'Tôm hùm bông tươi sống', unit: 'kg', cost_price: 750000, stock_quantity: 10.0, min_threshold: 2.0 },
        { name: 'Vẹm xanh New Zealand', unit: 'kg', cost_price: 220000, stock_quantity: 16.0, min_threshold: 4.0 },
        { name: 'Tôm sú biển tươi', unit: 'kg', cost_price: 260000, stock_quantity: 15.0, min_threshold: 3.0 },
        { name: 'Mực ống tươi', unit: 'kg', cost_price: 210000, stock_quantity: 12.0, min_threshold: 3.0 },
        { name: 'Ức gà tươi CP', unit: 'kg', cost_price: 85000, stock_quantity: 20.0, min_threshold: 5.0 },
        { name: 'Thịt xông khói Pancetta/Bacon', unit: 'kg', cost_price: 220000, stock_quantity: 15.0, min_threshold: 3.0 },
        
        // Phô mai & Chế phẩm bơ sữa châu Âu
        { name: 'Phô mai Mozzarella Pháp', unit: 'kg', cost_price: 180000, stock_quantity: 25.0, min_threshold: 5.0 },
        { name: 'Phô mai Parmesan Grana Padano', unit: 'kg', cost_price: 380000, stock_quantity: 8.0, min_threshold: 2.0 },
        { name: 'Phô mai xanh Gorgonzola Ý', unit: 'kg', cost_price: 420000, stock_quantity: 5.0, min_threshold: 1.0 },
        { name: 'Phô mai Ricotta tươi', unit: 'kg', cost_price: 240000, stock_quantity: 6.0, min_threshold: 1.0 },
        { name: 'Phô mai Mascarpone Ý', unit: 'kg', cost_price: 260000, stock_quantity: 10.0, min_threshold: 2.0 },
        { name: 'Kem béo Whipping Cream Tatua', unit: 'lít', cost_price: 135000, stock_quantity: 30.0, min_threshold: 5.0 },
        { name: 'Bơ lạt tự nhiên Anchor', unit: 'kg', cost_price: 190000, stock_quantity: 20.0, min_threshold: 4.0 },
        
        // Tinh bột, Mì, Bột
        { name: 'Mì Ý Barilla Spaghetti', unit: 'g', cost_price: 70, stock_quantity: 25000, min_threshold: 5000 },
        { name: 'Bột mì Ý Semolina (Đế Pizza)', unit: 'kg', cost_price: 65000, stock_quantity: 40.0, min_threshold: 10.0 },
        { name: 'Khoai tây tươi Đà Lạt', unit: 'kg', cost_price: 30000, stock_quantity: 50.0, min_threshold: 10.0 },
        { name: 'Bánh mì Baguette Pháp', unit: 'ổ', cost_price: 15000, stock_quantity: 30, min_threshold: 5 },
        { name: 'Bánh quy Savoiardi Ý', unit: 'gói', cost_price: 75000, stock_quantity: 20, min_threshold: 4 },
        
        // Rau củ quả & Thảo mộc tươi
        { name: 'Bí đỏ hạt đậu Đà Lạt', unit: 'kg', cost_price: 25000, stock_quantity: 35.0, min_threshold: 5.0 },
        { name: 'Xà lách Romaine hữu cơ', unit: 'kg', cost_price: 45000, stock_quantity: 20.0, min_threshold: 4.0 },
        { name: 'Cà chua Pelati nguyên trái Ý', unit: 'hộp', cost_price: 110000, stock_quantity: 15, min_threshold: 3 },
        { name: 'Măng tây xanh loại 1', unit: 'kg', cost_price: 110000, stock_quantity: 15.0, min_threshold: 3.0 },
        { name: 'Lá hương thảo Rosemary tươi', unit: 'g', cost_price: 300, stock_quantity: 1500, min_threshold: 200 },
        { name: 'Cỏ xạ hương Thyme tươi', unit: 'g', cost_price: 350, stock_quantity: 1200, min_threshold: 200 },
        { name: 'Nấm mỡ tươi Đà Lạt', unit: 'kg', cost_price: 95000, stock_quantity: 12.0, min_threshold: 2.0 },
        { name: 'Dâu tây tươi Đà Lạt', unit: 'kg', cost_price: 180000, stock_quantity: 10.0, min_threshold: 2.0 },
        { name: 'Cam sành hữu cơ', unit: 'kg', cost_price: 35000, stock_quantity: 30.0, min_threshold: 5.0 },
        { name: 'Bưởi hồng da xanh', unit: 'kg', cost_price: 55000, stock_quantity: 25.0, min_threshold: 5.0 },
        
        // Gia vị, Sốt & Đồ uống
        { name: 'Sốt nấm Truffle đen Ý', unit: 'hũ', cost_price: 650000, stock_quantity: 6, min_threshold: 1 },
        { name: 'Mật ong hoa rừng tự nhiên', unit: 'chai', cost_price: 150000, stock_quantity: 10, min_threshold: 2 },
        { name: 'Trứng gà tươi sạch', unit: 'quả', cost_price: 3500, stock_quantity: 200, min_threshold: 30 },
        { name: 'Dầu ô liu Extra Virgin', unit: 'lít', cost_price: 240000, stock_quantity: 15.0, min_threshold: 3.0 },
        { name: 'Socola đen 70% Callebaut Bỉ', unit: 'kg', cost_price: 360000, stock_quantity: 8.0, min_threshold: 2.0 },
        { name: 'Vang đỏ Bordeaux Cabernet Sauvignon', unit: 'chai', cost_price: 280000, stock_quantity: 36, min_threshold: 6 },
        { name: 'Vang trắng Sauvignon Blanc Marlborough', unit: 'chai', cost_price: 250000, stock_quantity: 30, min_threshold: 6 },
        { name: 'Rượu Rum Bacardi Carta Blanca', unit: 'chai', cost_price: 320000, stock_quantity: 12, min_threshold: 2 }
    ];

    const ingMap = {};
    for (const ing of ingredientsData) {
        const doc = await Ingredient.create({ ...ing, status: 'Active' });
        ingMap[ing.name] = doc;
    }
    console.log(`✅ Đã tạo ${Object.keys(ingMap).length} nguyên liệu kho chính xác!`);

    // 4. TẠO 20 MÓN ĂN ÂU ĐỘC LẬP (REALISTIC WESTERN DISHES)
    console.log('🍽️ Đang tạo các món ăn Âu với mô tả, hình ảnh và giá niêm yết chuẩn...');
    const dishesData = [
        // KHAI VỊ & SALAD
        {
            category_id: catMap['Khai Vị & Salad'],
            name: 'Súp kem bí đỏ bánh mì bơ tỏi',
            base_price: 95000,
            cost_price: 28000,
            image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&auto=format&fit=crop&q=80',
            description: 'Bí đỏ hạt đậu Đà Lạt nướng thơm ngọt xay mịn cùng kem béo whipping Tatua New Zealand, dùng kèm bánh mì bơ tỏi nướng giòn rụm.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Bí đỏ hạt đậu Đà Lạt', qty: 0.2, unit: 'kg' },
                { ing: 'Kem béo Whipping Cream Tatua', qty: 0.05, unit: 'lít' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.015, unit: 'kg' },
                { ing: 'Bánh mì Baguette Pháp', qty: 0.25, unit: 'ổ' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.01, unit: 'lít' }
            ]
        },
        {
            category_id: catMap['Khai Vị & Salad'],
            name: 'Salad Caesar ức gà nướng',
            base_price: 145000,
            cost_price: 45000,
            image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&auto=format&fit=crop&q=80',
            description: 'Xà lách Romaine hữu cơ tươi giòn quyện sốt Caesar béo ngậy, ức gà tẩm thảo mộc nướng than mọng nước, phô mai Parmesan bào lát và bánh mì croutons vàng giòn.',
            station: 'cold',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Xà lách Romaine hữu cơ', qty: 0.12, unit: 'kg' },
                { ing: 'Ức gà tươi CP', qty: 0.1, unit: 'kg' },
                { ing: 'Phô mai Parmesan Grana Padano', qty: 0.015, unit: 'kg' },
                { ing: 'Bánh mì Baguette Pháp', qty: 0.25, unit: 'ổ' },
                { ing: 'Thịt xông khói Pancetta/Bacon', qty: 0.02, unit: 'kg' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.015, unit: 'lít' }
            ]
        },
        {
            category_id: catMap['Khai Vị & Salad'],
            name: 'Bò Tartare kiểu Pháp cổ điển',
            base_price: 185000,
            cost_price: 62000,
            image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
            description: 'Thăn nội bò Úc tươi cắt hạt lựu ướp thảo mộc Pháp, nụ bạch hoa, dầu ô liu nguyên chất, lòng đỏ trứng gà ta béo ngậy ăn kèm lát bánh mì sấy giòn.',
            station: 'cold',
            isPopular: false,
            status: 'Available',
            recipes: [
                { ing: 'Thăn nội bò Úc (Tenderloin)', qty: 0.1, unit: 'kg' },
                { ing: 'Trứng gà tươi sạch', qty: 1, unit: 'quả' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.015, unit: 'lít' },
                { ing: 'Bánh mì Baguette Pháp', qty: 0.3, unit: 'ổ' }
            ]
        },
        {
            category_id: catMap['Khai Vị & Salad'],
            name: 'Vẹm xanh New Zealand sốt vang trắng',
            base_price: 195000,
            cost_price: 68000,
            image: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800&auto=format&fit=crop&q=80',
            description: 'Vẹm xanh New Zealand thịt dày béo ngậy hấp cùng rượu vang trắng Marlborough, bơ Pháp, tỏi băm và ngò tây thơm nồng quyến rũ.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Vẹm xanh New Zealand', qty: 0.25, unit: 'kg' },
                { ing: 'Vang trắng Sauvignon Blanc Marlborough', qty: 0.06, unit: 'chai' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.02, unit: 'kg' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.01, unit: 'lít' }
            ]
        },

        // BÒ & CỪU NƯỚNG
        {
            category_id: catMap['Bò & Cừu Nướng'],
            name: 'Bò bít tết Thăn nội Úc sốt tiêu đen',
            base_price: 395000,
            cost_price: 135000,
            image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
            description: 'Phần thịt mềm và nạc nhất của bò Úc áp chảo bơ tỏi và hương thảo rosemary, dùng kèm khoai tây nghiền mịn, măng tây nướng và sốt tiêu đen Phú Quốc.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Thăn nội bò Úc (Tenderloin)', qty: 0.2, unit: 'kg' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.025, unit: 'kg' },
                { ing: 'Lá hương thảo Rosemary tươi', qty: 5, unit: 'g' },
                { ing: 'Măng tây xanh loại 1', qty: 0.05, unit: 'kg' },
                { ing: 'Khoai tây tươi Đà Lạt', qty: 0.12, unit: 'kg' },
                { ing: 'Kem béo Whipping Cream Tatua', qty: 0.02, unit: 'lít' }
            ]
        },
        {
            category_id: catMap['Bò & Cừu Nướng'],
            name: 'Thăn lưng bò Mỹ nướng sốt nấm Truffle',
            base_price: 485000,
            cost_price: 168000,
            image: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80',
            description: 'Thăn lưng bò Mỹ vân mỡ cẩm thạch hoàn hảo nướng than hoa thơm lừng, rưới sốt nấm Truffle đen quý phái, dùng kèm khoai tây múi cau chiên bơ tỏi.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Thăn lưng bò Mỹ (Prime Ribeye)', qty: 0.25, unit: 'kg' },
                { ing: 'Nấm mỡ tươi Đà Lạt', qty: 0.06, unit: 'kg' },
                { ing: 'Sốt nấm Truffle đen Ý', qty: 0.03, unit: 'hũ' },
                { ing: 'Kem béo Whipping Cream Tatua', qty: 0.03, unit: 'lít' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.02, unit: 'kg' },
                { ing: 'Khoai tây tươi Đà Lạt', qty: 0.1, unit: 'kg' }
            ]
        },
        {
            category_id: catMap['Bò & Cừu Nướng'],
            name: 'Sườn cừu New Zealand nướng thảo mộc Pháp',
            base_price: 425000,
            cost_price: 145000,
            image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80',
            description: 'Sườn cừu non New Zealand tẩm lớp thảo mộc Rosemary, Thyme đút lò vàng ươm mọng nước, dùng kèm sốt vang đỏ Bordeaux cô đặc và khoai tây nghiền.',
            station: 'hot',
            isPopular: false,
            status: 'Available',
            recipes: [
                { ing: 'Sườn cừu New Zealand (Lamb Chops)', qty: 0.3, unit: 'kg' },
                { ing: 'Lá hương thảo Rosemary tươi', qty: 8, unit: 'g' },
                { ing: 'Cỏ xạ hương Thyme tươi', qty: 5, unit: 'g' },
                { ing: 'Vang đỏ Bordeaux Cabernet Sauvignon', qty: 0.04, unit: 'chai' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.02, unit: 'kg' },
                { ing: 'Khoai tây tươi Đà Lạt', qty: 0.1, unit: 'kg' }
            ]
        },

        // HẢI SẢN CHÂU ÂU
        {
            category_id: catMap['Hải Sản Châu Âu'],
            name: 'Cá hồi Na Uy áp chảo sốt bơ chanh',
            base_price: 325000,
            cost_price: 110000,
            image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
            description: 'Phi lê cá hồi Na Uy tươi da giòn thịt mềm ngọt béo ngậy, phủ sốt bơ chanh vàng thơm thanh mát, dùng cùng măng tây xào bơ tỏi.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Phi lê cá hồi tươi Na Uy', qty: 0.18, unit: 'kg' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.025, unit: 'kg' },
                { ing: 'Măng tây xanh loại 1', qty: 0.06, unit: 'kg' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.015, unit: 'lít' },
                { ing: 'Vang trắng Sauvignon Blanc Marlborough', qty: 0.02, unit: 'chai' }
            ]
        },
        {
            category_id: catMap['Hải Sản Châu Âu'],
            name: 'Tôm hùm bông nướng phô mai Thermidor',
            base_price: 580000,
            cost_price: 198000,
            image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&auto=format&fit=crop&q=80',
            description: 'Nửa con tôm hùm bông tươi sống đút lò phô mai Mozzarella Pháp kéo sợi béo ngậy, sốt kem nấm mỡ và vang trắng hoàng gia.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Tôm hùm bông tươi sống', qty: 0.35, unit: 'kg' },
                { ing: 'Phô mai Mozzarella Pháp', qty: 0.06, unit: 'kg' },
                { ing: 'Kem béo Whipping Cream Tatua', qty: 0.04, unit: 'lít' },
                { ing: 'Nấm mỡ tươi Đà Lạt', qty: 0.04, unit: 'kg' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.02, unit: 'kg' },
                { ing: 'Vang trắng Sauvignon Blanc Marlborough', qty: 0.03, unit: 'chai' }
            ]
        },

        // MÌ Ý & PIZZA
        {
            category_id: catMap['Mì Ý & Pizza'],
            name: 'Mì Ý Carbonara chuẩn Ý',
            base_price: 165000,
            cost_price: 52000,
            image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&auto=format&fit=crop&q=80',
            description: 'Mì Barilla Spaghetti sốt lòng đỏ trứng gà tươi hòa quyện phô mai Parmesan bào nhuyễn và thịt xông khói Pancetta giòn rụm, chuẩn vị Roma cổ điển.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Mì Ý Barilla Spaghetti', qty: 100, unit: 'g' },
                { ing: 'Thịt xông khói Pancetta/Bacon', qty: 0.05, unit: 'kg' },
                { ing: 'Trứng gà tươi sạch', qty: 2, unit: 'quả' },
                { ing: 'Phô mai Parmesan Grana Padano', qty: 0.03, unit: 'kg' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.01, unit: 'lít' }
            ]
        },
        {
            category_id: catMap['Mì Ý & Pizza'],
            name: 'Mì Ý hải sản sốt cà chua Marinara',
            base_price: 215000,
            cost_price: 72000,
            image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
            description: 'Mì Ý dai ngon kết hợp tôm sú biển tươi, mực ống giòn ngọt và vẹm xanh New Zealand trong sốt cà chua Pelati nguyên trái Ý thơm lá húng quế Basil.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Mì Ý Barilla Spaghetti', qty: 100, unit: 'g' },
                { ing: 'Tôm sú biển tươi', qty: 0.06, unit: 'kg' },
                { ing: 'Mực ống tươi', qty: 0.06, unit: 'kg' },
                { ing: 'Vẹm xanh New Zealand', qty: 0.08, unit: 'kg' },
                { ing: 'Cà chua Pelati nguyên trái Ý', qty: 0.05, unit: 'hộp' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.015, unit: 'lít' }
            ]
        },
        {
            category_id: catMap['Mì Ý & Pizza'],
            name: 'Pizza 4 loại phô mai mật ong rừng',
            base_price: 245000,
            cost_price: 82000,
            image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
            description: 'Đế bánh thủ công ủ men 48h nướng củi giòn xốp, ngập tràn 4 loại phô mai thượng hạng (Mozzarella, Gorgonzola, Parmesan, Ricotta) chấm mật ong hoa rừng ngọt dịu.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Bột mì Ý Semolina (Đế Pizza)', qty: 0.15, unit: 'kg' },
                { ing: 'Phô mai Mozzarella Pháp', qty: 0.08, unit: 'kg' },
                { ing: 'Phô mai xanh Gorgonzola Ý', qty: 0.025, unit: 'kg' },
                { ing: 'Phô mai Parmesan Grana Padano', qty: 0.02, unit: 'kg' },
                { ing: 'Phô mai Ricotta tươi', qty: 0.025, unit: 'kg' },
                { ing: 'Mật ong hoa rừng tự nhiên', qty: 0.04, unit: 'chai' }
            ]
        },
        {
            category_id: catMap['Mì Ý & Pizza'],
            name: 'Pizza bò băm nướng sốt BBQ',
            base_price: 225000,
            cost_price: 76000,
            image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800&auto=format&fit=crop&q=80',
            description: 'Đế bánh nướng củi giòn tan, phủ đầy thịt bò băm tẩm ướp sốt BBQ hun khói đậm đà, hành tây nướng ngọt và phô mai Mozzarella kéo sợi.',
            station: 'hot',
            isPopular: false,
            status: 'Available',
            recipes: [
                { ing: 'Bột mì Ý Semolina (Đế Pizza)', qty: 0.15, unit: 'kg' },
                { ing: 'Thăn nội bò Úc (Tenderloin)', qty: 0.08, unit: 'kg' },
                { ing: 'Phô mai Mozzarella Pháp', qty: 0.07, unit: 'kg' },
                { ing: 'Dầu ô liu Extra Virgin', qty: 0.01, unit: 'lít' }
            ]
        },

        // TRÁNG MIỆNG
        {
            category_id: catMap['Tráng Miệng'],
            name: 'Tiramisu phô mai Mascarpone',
            base_price: 95000,
            cost_price: 30000,
            image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&auto=format&fit=crop&q=80',
            description: 'Tiramisu mềm mịn béo ngậy từ phô mai Mascarpone cao cấp, bánh Savoiardi ngấm đẫm cà phê Espresso và chút hương nồng ấm của rượu Rum, rắc bột cacao nguyên chất.',
            station: 'cold',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Phô mai Mascarpone Ý', qty: 0.07, unit: 'kg' },
                { ing: 'Bánh quy Savoiardi Ý', qty: 0.08, unit: 'gói' },
                { ing: 'Rượu Rum Bacardi Carta Blanca', qty: 0.015, unit: 'chai' },
                { ing: 'Trứng gà tươi sạch', qty: 1, unit: 'quả' }
            ]
        },
        {
            category_id: catMap['Tráng Miệng'],
            name: 'Bánh Lava socola nóng chảy kèm kem vani',
            base_price: 105000,
            cost_price: 34000,
            image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80',
            description: 'Bánh nướng ngoài xốp giòn trong chứa dòng socola Callebaut 70% Bỉ ấm nóng tan chảy, ăn kèm viên kem vani Pháp mát lạnh và dâu tây tươi.',
            station: 'hot',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Socola đen 70% Callebaut Bỉ', qty: 0.05, unit: 'kg' },
                { ing: 'Bơ lạt tự nhiên Anchor', qty: 0.025, unit: 'kg' },
                { ing: 'Trứng gà tươi sạch', qty: 1, unit: 'quả' },
                { ing: 'Dâu tây tươi Đà Lạt', qty: 0.03, unit: 'kg' }
            ]
        },
        {
            category_id: catMap['Tráng Miệng'],
            name: 'Panna Cotta dâu tây rừng',
            base_price: 85000,
            cost_price: 26000,
            image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&auto=format&fit=crop&q=80',
            description: 'Kem sữa tươi Tatua New Zealand nấu vani tự nhiên đông mịn mướt mượt, rưới đẫm sốt dâu tây rừng chua ngọt dịu mát sảng khoái.',
            station: 'cold',
            isPopular: false,
            status: 'Available',
            recipes: [
                { ing: 'Kem béo Whipping Cream Tatua', qty: 0.08, unit: 'lít' },
                { ing: 'Dâu tây tươi Đà Lạt', qty: 0.04, unit: 'kg' }
            ]
        },

        // RƯỢU VANG & ĐỒ UỐNG
        {
            category_id: catMap['Rượu Vang & Đồ Uống'],
            name: 'Rượu vang đỏ Bordeaux Cabernet Sauvignon',
            base_price: 160000,
            cost_price: 50000,
            image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80',
            description: 'Vang đỏ vùng Bordeaux danh tiếng nước Pháp với nốt hương quả mọng đen, vani gỗ sồi, vị chát tannin êm mượt hòa quyện hoàn hảo cùng bò bít tết và thịt cừu.',
            station: 'bar',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Vang đỏ Bordeaux Cabernet Sauvignon', qty: 0.2, unit: 'chai' }
            ]
        },
        {
            category_id: catMap['Rượu Vang & Đồ Uống'],
            name: 'Rượu vang trắng Sauvignon Blanc Marlborough',
            base_price: 150000,
            cost_price: 48000,
            image: 'https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=800&auto=format&fit=crop&q=80',
            description: 'Vang trắng trứ danh vùng Marlborough New Zealand ngát hương chanh leo, bưởi hồng và chất vị khoáng tươi mới sảng khoái, lý tưởng khi dùng cùng hải sản.',
            station: 'bar',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Vang trắng Sauvignon Blanc Marlborough', qty: 0.2, unit: 'chai' }
            ]
        },
        {
            category_id: catMap['Rượu Vang & Đồ Uống'],
            name: 'Nước ép cam bưởi hồng nha đam tươi',
            base_price: 65000,
            cost_price: 20000,
            image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=800&auto=format&fit=crop&q=80',
            description: 'Nước ép cam sành và bưởi hồng da xanh nguyên chất giàu vitamin C thanh nhiệt cơ thể, kết hợp thạch nha đam tươi giòn sần sật mát lạnh.',
            station: 'bar',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Cam sành hữu cơ', qty: 0.2, unit: 'kg' },
                { ing: 'Bưởi hồng da xanh', qty: 0.15, unit: 'kg' }
            ]
        },
        {
            category_id: catMap['Rượu Vang & Đồ Uống'],
            name: 'Cocktail Mojito chanh bạc hà chuẩn vị',
            base_price: 95000,
            cost_price: 28000,
            image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
            description: 'Cocktail kinh điển giải nhiệt với rượu Rum Bacardi Carta Blanca, chanh tươi và lá bạc hà tươi giã tay thơm nồng, hòa cùng bọt soda mát lạnh sảng khoái.',
            station: 'bar',
            isPopular: true,
            status: 'Available',
            recipes: [
                { ing: 'Rượu Rum Bacardi Carta Blanca', qty: 0.06, unit: 'chai' }
            ]
        }
    ];

    const dishMap = {};
    for (const d of dishesData) {
        const doc = await MenuItem.create({
            category_id: d.category_id,
            name: d.name,
            base_price: d.base_price,
            cost_price: d.cost_price,
            image: d.image,
            description: d.description,
            station: d.station,
            isPopular: d.isPopular,
            is_combo: false,
            status: d.status
        });
        dishMap[d.name] = doc;
        console.log(`   + Món: ${d.name} (${d.base_price.toLocaleString('vi-VN')}đ) [Trạm: ${d.station}]`);

        // Lưu công thức định lượng (Recipes)
        for (const rec of d.recipes) {
            const ingObj = ingMap[rec.ing];
            if (ingObj) {
                await Recipe.create({
                    menuItem_id: doc._id,
                    ingredient_id: ingObj._id,
                    quantity_required: rec.qty,
                    unit: rec.unit,
                    status: 'Active'
                });
            }
        }
    }
    console.log(`✅ Đã tạo thành công ${Object.keys(dishMap).length} món ăn và gắn toàn bộ công thức định lượng chuẩn xác!`);

    // 5. TẠO CÁC BIẾN THỂ MÓN ĂN (VARIANTS)
    console.log('✨ Đang tạo biến thể món ăn (Độ chín, Sốt lựa chọn, Kích thước, Loại mì, Quy cách phục vụ)...');
    const steakVariants = [
        // Độ chín
        { group: 'Độ chín (Doneness)', name: 'Tái vừa (Medium Rare) - Khuyên dùng', extra_price: 0, cost_price: 0 },
        { group: 'Độ chín (Doneness)', name: 'Tái (Rare)', extra_price: 0, cost_price: 0 },
        { group: 'Độ chín (Doneness)', name: 'Vừa chín tới (Medium)', extra_price: 0, cost_price: 0 },
        { group: 'Độ chín (Doneness)', name: 'Chín kĩ (Well Done)', extra_price: 0, cost_price: 0 },
        // Nước sốt
        { group: 'Nước sốt (Sauce)', name: 'Sốt tiêu đen Phú Quốc truyền thống', extra_price: 0, cost_price: 0 },
        { group: 'Nước sốt (Sauce)', name: 'Sốt nấm Truffle đen quý phái', extra_price: 35000, cost_price: 12000 },
        { group: 'Nước sốt (Sauce)', name: 'Sốt vang đỏ Pháp cô đặc', extra_price: 30000, cost_price: 10000 },
        { group: 'Nước sốt (Sauce)', name: 'Sốt phô mai béo cay Gorgonzola', extra_price: 25000, cost_price: 8000 },
        // Ăn kèm
        { group: 'Món ăn kèm (Side Dish)', name: 'Khoai tây nghiền bơ Pháp', extra_price: 0, cost_price: 0 },
        { group: 'Món ăn kèm (Side Dish)', name: 'Măng tây áp chảo bơ tỏi', extra_price: 25000, cost_price: 8000 },
        { group: 'Món ăn kèm (Side Dish)', name: 'Khoai tây múi cau chiên bơ', extra_price: 20000, cost_price: 6000 }
    ];

    // Gắn variants cho Thăn nội bò Úc & Thăn lưng bò Mỹ
    const steakItems = [dishMap['Bò bít tết Thăn nội Úc sốt tiêu đen'], dishMap['Thăn lưng bò Mỹ nướng sốt nấm Truffle']];
    for (const steak of steakItems) {
        if (!steak) continue;
        for (const v of steakVariants) {
            await Variant.create({
                menuItem_id: steak._id,
                group_name: v.group,
                name: v.name,
                extra_price: v.extra_price,
                cost_price: v.cost_price,
                allowMultiple: false,
                status: 'Available'
            });
        }
    }

    // Biến thể cho Sườn cừu New Zealand
    const lamb = dishMap['Sườn cừu New Zealand nướng thảo mộc Pháp'];
    if (lamb) {
        const lambVars = [
            { group: 'Độ chín (Doneness)', name: 'Chín vừa mọng nước (Medium)', extra_price: 0, cost_price: 0 },
            { group: 'Độ chín (Doneness)', name: 'Chín kỹ thơm giòn (Well Done)', extra_price: 0, cost_price: 0 },
            { group: 'Nước sốt (Sauce)', name: 'Sốt vang đỏ thảo mộc Thyme', extra_price: 0, cost_price: 0 },
            { group: 'Nước sốt (Sauce)', name: 'Sốt tiêu đen Phú Quốc', extra_price: 0, cost_price: 0 }
        ];
        for (const v of lambVars) {
            await Variant.create({
                menuItem_id: lamb._id,
                group_name: v.group,
                name: v.name,
                extra_price: v.extra_price,
                cost_price: v.cost_price,
                allowMultiple: false,
                status: 'Available'
            });
        }
    }

    // Biến thể cho Pizza (Size & Viền)
    const pizzas = [dishMap['Pizza 4 loại phô mai mật ong rừng'], dishMap['Pizza bò băm nướng sốt BBQ']];
    for (const p of pizzas) {
        if (!p) continue;
        const pizzaVars = [
            { group: 'Kích cỡ bánh (Size)', name: 'Tiêu chuẩn (Size M - 22cm)', extra_price: 0, cost_price: 0 },
            { group: 'Kích cỡ bánh (Size)', name: 'Lớn tiệc tùng (Size L - 30cm)', extra_price: 60000, cost_price: 22000 },
            { group: 'Viền bánh (Crust)', name: 'Đế nướng củi mỏng giòn', extra_price: 0, cost_price: 0 },
            { group: 'Viền bánh (Crust)', name: 'Viền phô mai xúc xích đút lò', extra_price: 35000, cost_price: 12000 }
        ];
        for (const v of pizzaVars) {
            await Variant.create({
                menuItem_id: p._id,
                group_name: v.group,
                name: v.name,
                extra_price: v.extra_price,
                cost_price: v.cost_price,
                allowMultiple: false,
                status: 'Available'
            });
        }
    }

    // Biến thể cho Mì Ý (Loại sợi)
    const pastas = [dishMap['Mì Ý Carbonara chuẩn Ý'], dishMap['Mì Ý hải sản sốt cà chua Marinara']];
    for (const pas of pastas) {
        if (!pas) continue;
        const pastaVars = [
            { group: 'Loại mì Ý (Pasta Type)', name: 'Mì sợi tròn Barilla Spaghetti', extra_price: 0, cost_price: 0 },
            { group: 'Loại mì Ý (Pasta Type)', name: 'Mì sợi dẹt to bản Fettuccine', extra_price: 0, cost_price: 0 },
            { group: 'Loại mì Ý (Pasta Type)', name: 'Mì ống sọc Penne Rigate', extra_price: 0, cost_price: 0 }
        ];
        for (const v of pastaVars) {
            await Variant.create({
                menuItem_id: pas._id,
                group_name: v.group,
                name: v.name,
                extra_price: v.extra_price,
                cost_price: v.cost_price,
                allowMultiple: false,
                status: 'Available'
            });
        }
    }

    // Biến thể cho Rượu vang (Quy cách phục vụ Ly vs Chai)
    const redWine = dishMap['Rượu vang đỏ Bordeaux Cabernet Sauvignon'];
    if (redWine) {
        await Variant.create({
            menuItem_id: redWine._id,
            group_name: 'Quy cách phục vụ',
            name: '1 Ly tiêu chuẩn (150ml)',
            extra_price: 0,
            cost_price: 0,
            allowMultiple: false,
            status: 'Available'
        });
        await Variant.create({
            menuItem_id: redWine._id,
            group_name: 'Quy cách phục vụ',
            name: '1 Chai nguyên bản (750ml)',
            extra_price: 620000,
            cost_price: 200000,
            allowMultiple: false,
            status: 'Available'
        });
    }

    const whiteWine = dishMap['Rượu vang trắng Sauvignon Blanc Marlborough'];
    if (whiteWine) {
        await Variant.create({
            menuItem_id: whiteWine._id,
            group_name: 'Quy cách phục vụ',
            name: '1 Ly tiêu chuẩn (150ml)',
            extra_price: 0,
            cost_price: 0,
            allowMultiple: false,
            status: 'Available'
        });
        await Variant.create({
            menuItem_id: whiteWine._id,
            group_name: 'Quy cách phục vụ',
            name: '1 Chai nguyên bản (750ml)',
            extra_price: 570000,
            cost_price: 180000,
            allowMultiple: false,
            status: 'Available'
        });
    }

    // Biến thể cho Nước ép (Mức đá & Độ ngọt)
    const juice = dishMap['Nước ép cam bưởi hồng nha đam tươi'];
    if (juice) {
        const juiceVars = [
            { group: 'Mức đá', name: 'Đá riêng', extra_price: 0 },
            { group: 'Mức đá', name: 'Ít đá', extra_price: 0 },
            { group: 'Mức đá', name: 'Không đá', extra_price: 0 },
            { group: 'Độ ngọt', name: 'Ngọt thanh tự nhiên (100% không thêm đường)', extra_price: 0 },
            { group: 'Độ ngọt', name: 'Ngọt dịu (30% đường mía)', extra_price: 0 }
        ];
        for (const v of juiceVars) {
            await Variant.create({
                menuItem_id: juice._id,
                group_name: v.group,
                name: v.name,
                extra_price: v.extra_price,
                cost_price: 0,
                allowMultiple: false,
                status: 'Available'
            });
        }
    }
    console.log('✅ Đã tạo xong toàn bộ biến thể món ăn cao cấp!');

    // 6. TẠO 3 COMBO ĐẠI TIỆC MÓN ÂU (AUTHENTIC SET COMBOS VỚI HÌNH ẢNH TOÀN BÀN TIỆC)
    console.log('🎁 Đang tạo 3 Combo đại tiệc món Âu với hình ảnh bàn tiệc tráng lệ và món con liên kết...');

    // COMBO 1: Combo Hẹn Hò Lãng Mạn (2 người)
    // Bao gồm: 2 Súp bí đỏ + 1 Salad Caesar + 2 Bò bít tết thăn Úc + 2 Tiramisu + 2 Ly vang đỏ
    const combo1Items = [
        {
            menuItem_id: dishMap['Súp kem bí đỏ bánh mì bơ tỏi']._id.toString(),
            name: 'Súp kem bí đỏ bánh mì bơ tỏi',
            variant_id: null,
            variant_name: '',
            quantity: 2,
            item_unit_price: 95000,
            original_price: 190000
        },
        {
            menuItem_id: dishMap['Salad Caesar ức gà nướng']._id.toString(),
            name: 'Salad Caesar ức gà nướng',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 145000,
            original_price: 145000
        },
        {
            menuItem_id: dishMap['Bò bít tết Thăn nội Úc sốt tiêu đen']._id.toString(),
            name: 'Bò bít tết Thăn nội Úc sốt tiêu đen',
            variant_id: null,
            variant_name: 'Tái vừa (Medium Rare)',
            quantity: 2,
            item_unit_price: 395000,
            original_price: 790000
        },
        {
            menuItem_id: dishMap['Tiramisu phô mai Mascarpone']._id.toString(),
            name: 'Tiramisu phô mai Mascarpone',
            variant_id: null,
            variant_name: '',
            quantity: 2,
            item_unit_price: 95000,
            original_price: 190000
        },
        {
            menuItem_id: dishMap['Rượu vang đỏ Bordeaux Cabernet Sauvignon']._id.toString(),
            name: 'Rượu vang đỏ Bordeaux Cabernet Sauvignon',
            variant_id: null,
            variant_name: '1 Ly tiêu chuẩn (150ml)',
            quantity: 2,
            item_unit_price: 160000,
            original_price: 320000
        }
    ];

    const combo1 = await MenuItem.create({
        category_id: catMap['Combo Tiệc Âu'],
        name: 'Combo Hẹn Hò Lãng Mạn (2 người)',
        base_price: 890000,
        cost_price: 340000,
        image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&auto=format&fit=crop&q=80',
        description: 'Set tiệc tối lãng mạn dưới ánh nến dành riêng cho 2 người gồm: 2 Súp kem bí đỏ, 1 Salad Caesar gà nướng, 2 Thăn bò Úc áp chảo sốt tiêu đen, 2 Tiramisu và 2 ly rượu vang đỏ Bordeaux Pháp hảo hạng.',
        station: 'hot',
        isPopular: true,
        is_combo: true,
        serving_size: '2 người',
        combo_items: combo1Items,
        status: 'Available'
    });
    console.log(`   + Combo: ${combo1.name} (${combo1.base_price.toLocaleString('vi-VN')}đ) - ${combo1Items.length} món con`);

    // COMBO 2: Combo Gia Đình Châu Âu (3-4 người)
    // Bao gồm: 1 Bò Tartare + 1 Salad Caesar + 1 Pizza 4 phô mai + 1 Mì Ý hải sản + 1 Sườn cừu nướng + 4 Nước ép
    const combo2Items = [
        {
            menuItem_id: dishMap['Bò Tartare kiểu Pháp cổ điển']._id.toString(),
            name: 'Bò Tartare kiểu Pháp cổ điển',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 185000,
            original_price: 185000
        },
        {
            menuItem_id: dishMap['Salad Caesar ức gà nướng']._id.toString(),
            name: 'Salad Caesar ức gà nướng',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 145000,
            original_price: 145000
        },
        {
            menuItem_id: dishMap['Pizza 4 loại phô mai mật ong rừng']._id.toString(),
            name: 'Pizza 4 loại phô mai mật ong rừng',
            variant_id: null,
            variant_name: 'Lớn tiệc tùng (Size L - 30cm)',
            quantity: 1,
            item_unit_price: 305000,
            original_price: 305000
        },
        {
            menuItem_id: dishMap['Mì Ý hải sản sốt cà chua Marinara']._id.toString(),
            name: 'Mì Ý hải sản sốt cà chua Marinara',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 215000,
            original_price: 215000
        },
        {
            menuItem_id: dishMap['Sườn cừu New Zealand nướng thảo mộc Pháp']._id.toString(),
            name: 'Sườn cừu New Zealand nướng thảo mộc Pháp',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 425000,
            original_price: 425000
        },
        {
            menuItem_id: dishMap['Nước ép cam bưởi hồng nha đam tươi']._id.toString(),
            name: 'Nước ép cam bưởi hồng nha đam tươi',
            variant_id: null,
            variant_name: '',
            quantity: 4,
            item_unit_price: 65000,
            original_price: 260000
        }
    ];

    const combo2 = await MenuItem.create({
        category_id: catMap['Combo Tiệc Âu'],
        name: 'Combo Gia Đình Châu Âu (3-4 người)',
        base_price: 1290000,
        cost_price: 480000,
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
        description: 'Đại tiệc sum họp gia đình với đĩa sườn cừu New Zealand nướng thảo mộc đút lò, Pizza 4 loại phô mai mật ong rừng size L, Mì Ý hải sản Marinara, Bò Tartare Pháp, Salad Caesar và 4 ly nước ép cam bưởi tươi thanh mát.',
        station: 'hot',
        isPopular: true,
        is_combo: true,
        serving_size: '3-4 người',
        combo_items: combo2Items,
        status: 'Available'
    });
    console.log(`   + Combo: ${combo2.name} (${combo2.base_price.toLocaleString('vi-VN')}đ) - ${combo2Items.length} món con`);

    // COMBO 3: Combo Hải Sản Hoàng Gia (4-5 người)
    // Bao gồm: 2 Tôm hùm đút lò Thermidor + 2 Cá hồi áp chảo bơ chanh + 1 Thố vẹm xanh sốt vang + 1 Mì Ý Carbonara + 2 Bánh Lava socola + 1 Chai vang trắng New Zealand
    const combo3Items = [
        {
            menuItem_id: dishMap['Tôm hùm bông nướng phô mai Thermidor']._id.toString(),
            name: 'Tôm hùm bông nướng phô mai Thermidor',
            variant_id: null,
            variant_name: '',
            quantity: 2,
            item_unit_price: 580000,
            original_price: 1160000
        },
        {
            menuItem_id: dishMap['Cá hồi Na Uy áp chảo sốt bơ chanh']._id.toString(),
            name: 'Cá hồi Na Uy áp chảo sốt bơ chanh',
            variant_id: null,
            variant_name: '',
            quantity: 2,
            item_unit_price: 325000,
            original_price: 650000
        },
        {
            menuItem_id: dishMap['Vẹm xanh New Zealand sốt vang trắng']._id.toString(),
            name: 'Vẹm xanh New Zealand sốt vang trắng',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 195000,
            original_price: 195000
        },
        {
            menuItem_id: dishMap['Mì Ý Carbonara chuẩn Ý']._id.toString(),
            name: 'Mì Ý Carbonara chuẩn Ý',
            variant_id: null,
            variant_name: '',
            quantity: 1,
            item_unit_price: 165000,
            original_price: 165000
        },
        {
            menuItem_id: dishMap['Bánh Lava socola nóng chảy kèm kem vani']._id.toString(),
            name: 'Bánh Lava socola nóng chảy kèm kem vani',
            variant_id: null,
            variant_name: '',
            quantity: 2,
            item_unit_price: 105000,
            original_price: 210000
        },
        {
            menuItem_id: dishMap['Rượu vang trắng Sauvignon Blanc Marlborough']._id.toString(),
            name: 'Rượu vang trắng Sauvignon Blanc Marlborough (Chai)',
            variant_id: null,
            variant_name: '1 Chai nguyên bản (750ml)',
            quantity: 1,
            item_unit_price: 720000,
            original_price: 720000
        }
    ];

    const combo3 = await MenuItem.create({
        category_id: catMap['Combo Tiệc Âu'],
        name: 'Combo Hải Sản Hoàng Gia (4-5 người)',
        base_price: 1790000,
        cost_price: 680000,
        image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
        description: 'Bữa tiệc hải sản Âu thịnh soạn chuẩn 5 sao gồm 2 phần tôm hùm đút lò phô mai Thermidor vàng óng, 2 đĩa cá hồi Na Uy áp chảo sốt bơ chanh, thố vẹm xanh New Zealand hấp vang trắng, mì Ý Carbonara, 2 bánh Lava socola ấm nóng và 1 chai rượu vang trắng Sauvignon Blanc Marlborough ướp lạnh.',
        station: 'hot',
        isPopular: true,
        is_combo: true,
        serving_size: '4-5 người',
        combo_items: combo3Items,
        status: 'Available'
    });
    console.log(`   + Combo: ${combo3.name} (${combo3.base_price.toLocaleString('vi-VN')}đ) - ${combo3Items.length} món con`);

    console.log('\n======================================================');
    console.log('🎉 TOÀN BỘ DỮ LIỆU NHÀ HÀNG MÓN ÂU ĐÃ ĐƯỢC SEED HOÀN TẤT 100%!');
    console.log('======================================================');
    console.log(`- 7 Danh mục chuẩn phong cách ẩm thực Âu`);
    console.log(`- 40 Nguyên liệu kho với giá vốn & định lượng chính xác`);
    console.log(`- 20 Món ăn độc lập với công thức nấu, trạm bếp & ảnh sắc nét`);
    console.log(`- 3 Combo đại tiệc với ảnh đại tiệc toàn cảnh & danh sách món con`);
    console.log(`- Hàng chục biến thể món ăn (độ chín steak, sốt, size pizza, loại mì, vang ly/chai)`);
    console.log(`- Toàn bộ sơ đồ bàn sạch sẽ, sẵn sàng vận hành GO-LIVE!\n`);

    await mongoose.disconnect();
}

seedData().catch(err => {
    console.error('❌ Lỗi khi thực hiện seed dữ liệu:', err);
    process.exit(1);
});
