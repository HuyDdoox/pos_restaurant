const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_pos';

const newVariantsData = [
    // 1. Súp kem bí đỏ bánh mì bơ tỏi
    {
        dishName: 'Súp kem bí đỏ bánh mì bơ tỏi',
        variants: [
            { group_name: 'Khẩu phần ăn', name: 'Khẩu phần tiêu chuẩn (Chén vừa 250ml)', extra_price: 0, allowMultiple: false },
            { group_name: 'Khẩu phần ăn', name: 'Khẩu phần lớn tiệc tùng (Thố 450ml)', extra_price: 45000, allowMultiple: false },
            { group_name: 'Món ăn kèm', name: 'Thêm bánh mì bơ tỏi nướng giòn rụm (2 lát)', extra_price: 15000, allowMultiple: true },
            { group_name: 'Món ăn kèm', name: 'Thêm nấm Truffle đen quý phái xắt lát', extra_price: 35000, allowMultiple: true }
        ]
    },
    // 2. Salad Caesar ức gà nướng
    {
        dishName: 'Salad Caesar ức gà nướng',
        variants: [
            { group_name: 'Cách phục vụ sốt', name: 'Trộn sẵn sốt Caesar đều vị', extra_price: 0, allowMultiple: false },
            { group_name: 'Cách phục vụ sốt', name: 'Sốt Caesar để riêng chén nhỏ', extra_price: 0, allowMultiple: false },
            { group_name: 'Topping thêm', name: 'Thêm ức gà nướng thảo mộc (100g)', extra_price: 35000, allowMultiple: true },
            { group_name: 'Topping thêm', name: 'Thêm thịt ba rọi xông khói giòn rụm', extra_price: 25000, allowMultiple: true },
            { group_name: 'Topping thêm', name: 'Thêm phô mai Parmesan Ý bào mỏng', extra_price: 20000, allowMultiple: true }
        ]
    },
    // 3. Bò Tartare kiểu Pháp cổ điển
    {
        dishName: 'Bò Tartare kiểu Pháp cổ điển',
        variants: [
            { group_name: 'Khẩu vị & Mức cay', name: 'Vị chuẩn Pháp nguyên bản (Khuyên dùng)', extra_price: 0, allowMultiple: false },
            { group_name: 'Khẩu vị & Mức cay', name: 'Thêm mù tạt vàng Dijon cay nồng', extra_price: 0, allowMultiple: false },
            { group_name: 'Khẩu vị & Mức cay', name: 'Ít tiêu cay, vị dịu thanh', extra_price: 0, allowMultiple: false },
            { group_name: 'Ăn kèm thượng hạng', name: 'Thêm trứng cá chuồn Masago Nhật', extra_price: 30000, allowMultiple: true },
            { group_name: 'Ăn kèm thượng hạng', name: 'Thêm bánh mì nướng bơ tỏi kiểu Pháp', extra_price: 15000, allowMultiple: true }
        ]
    },
    // 4. Vẹm xanh New Zealand sốt vang trắng
    {
        dishName: 'Vẹm xanh New Zealand sốt vang trắng',
        variants: [
            { group_name: 'Hương vị sốt', name: 'Sốt vang trắng bơ kem tỏi thơm lừng (Nguyên bản)', extra_price: 0, allowMultiple: false },
            { group_name: 'Hương vị sốt', name: 'Sốt cà chua cay Marinara đậm đà kiểu Ý', extra_price: 0, allowMultiple: false },
            { group_name: 'Món ăn kèm', name: 'Bánh mì Baguette nướng giòn chấm sốt (1 ổ)', extra_price: 15000, allowMultiple: true },
            { group_name: 'Món ăn kèm', name: 'Thêm phô mai Mozzarella đút lò phủ vẹm', extra_price: 25000, allowMultiple: true }
        ]
    },
    // 5. Cá hồi Na Uy áp chảo sốt bơ chanh
    {
        dishName: 'Cá hồi Na Uy áp chảo sốt bơ chanh',
        variants: [
            { group_name: 'Độ chín cá hồi', name: 'Vừa chín tới mọng nước (Medium - Khuyên dùng)', extra_price: 0, allowMultiple: false },
            { group_name: 'Độ chín cá hồi', name: 'Chín kỹ giòn mặt (Well Done)', extra_price: 0, allowMultiple: false },
            { group_name: 'Loại nước sốt', name: 'Sốt bơ chanh vàng kiểu Pháp thanh mát', extra_price: 0, allowMultiple: false },
            { group_name: 'Loại nước sốt', name: 'Sốt kem nấm Truffle béo ngậy quý phái', extra_price: 30000, allowMultiple: false },
            { group_name: 'Loại nước sốt', name: 'Sốt Teriyaki gừng tỏi Nhật Bản', extra_price: 20000, allowMultiple: false },
            { group_name: 'Rau củ ăn kèm', name: 'Khoai tây nghiền bơ mịn màng', extra_price: 0, allowMultiple: false },
            { group_name: 'Rau củ ăn kèm', name: 'Măng tây xanh áp chảo bơ tỏi Pháp', extra_price: 25000, allowMultiple: false }
        ]
    },
    // 6. Tôm hùm bông nướng phô mai Thermidor
    {
        dishName: 'Tôm hùm bông nướng phô mai Thermidor',
        variants: [
            { group_name: 'Quy cách phục vụ', name: 'Nửa con tiêu chuẩn (350g - Giá gốc)', extra_price: 0, allowMultiple: false },
            { group_name: 'Quy cách phục vụ', name: 'Nguyên con tiệc hoàng gia (700g)', extra_price: 490000, allowMultiple: false },
            { group_name: 'Kiểu nướng', name: 'Nướng phô mai Thermidor vàng óng đút lò', extra_price: 0, allowMultiple: false },
            { group_name: 'Kiểu nướng', name: 'Nướng bơ tỏi ớt thảo mộc thơm nồng', extra_price: 0, allowMultiple: false }
        ]
    },
    // 7. Tiramisu phô mai Mascarpone
    {
        dishName: 'Tiramisu phô mai Mascarpone',
        variants: [
            { group_name: 'Kèm thêm', name: 'Thêm 1 viên kem vani Madagascar nguyên chất', extra_price: 25000, allowMultiple: true },
            { group_name: 'Kèm thêm', name: 'Rắc thêm bột ca cao Bỉ thượng hạng', extra_price: 10000, allowMultiple: true }
        ]
    },
    // 8. Bánh Lava socola nóng chảy kèm kem vani
    {
        dishName: 'Bánh Lava socola nóng chảy kèm kem vani',
        variants: [
            { group_name: 'Hương vị kem dùng kèm', name: 'Kem vani Madagascar truyền thống', extra_price: 0, allowMultiple: false },
            { group_name: 'Hương vị kem dùng kèm', name: 'Kem trà xanh Matcha Nhật Bản thanh dịu', extra_price: 10000, allowMultiple: false },
            { group_name: 'Hương vị kem dùng kèm', name: 'Kem dâu tây rừng chua ngọt mát lạnh', extra_price: 10000, allowMultiple: false },
            { group_name: 'Topping thêm', name: 'Thêm 1 viên kem tươi tự chọn', extra_price: 25000, allowMultiple: true },
            { group_name: 'Topping thêm', name: 'Thêm sốt socola Bỉ ấm nóng đặc sánh', extra_price: 15000, allowMultiple: true }
        ]
    },
    // 9. Panna Cotta dâu tây rừng
    {
        dishName: 'Panna Cotta dâu tây rừng',
        variants: [
            { group_name: 'Sốt hoa quả tự chọn', name: 'Sốt dâu tây rừng Đà Lạt (Nguyên bản)', extra_price: 0, allowMultiple: false },
            { group_name: 'Sốt hoa quả tự chọn', name: 'Sốt chanh leo nhiệt đới chua thanh', extra_price: 0, allowMultiple: false },
            { group_name: 'Sốt hoa quả tự chọn', name: 'Sốt xoài cát bơ thơm ngọt dịu', extra_price: 0, allowMultiple: false },
            { group_name: 'Topping thêm', name: 'Hạnh nhân lát nướng bơ thơm giòn', extra_price: 10000, allowMultiple: true },
            { group_name: 'Topping thêm', name: 'Thêm dâu tây tươi cắt lát', extra_price: 15000, allowMultiple: true }
        ]
    },
    // 10. Cocktail Mojito chanh bạc hà chuẩn vị
    {
        dishName: 'Cocktail Mojito chanh bạc hà chuẩn vị',
        variants: [
            { group_name: 'Nồng độ cồn', name: 'Cocktail Rum Bacardi có cồn (Chuẩn vị 5 sao)', extra_price: 0, allowMultiple: false },
            { group_name: 'Nồng độ cồn', name: 'Mocktail Virgin Mojito không cồn (Thanh mát)', extra_price: 0, allowMultiple: false },
            { group_name: 'Hương vị tự chọn', name: 'Chanh tươi lá bạc hà truyền thống', extra_price: 0, allowMultiple: false },
            { group_name: 'Hương vị tự chọn', name: 'Mojito Dâu tây đỏ tươi mát', extra_price: 15000, allowMultiple: false },
            { group_name: 'Hương vị tự chọn', name: 'Mojito Chanh leo nhiệt đới sảng khoái', extra_price: 15000, allowMultiple: false },
            { group_name: 'Mức đá & Đường', name: 'Tiêu chuẩn quán (Đá vừa, ngọt thanh)', extra_price: 0, allowMultiple: false },
            { group_name: 'Mức đá & Đường', name: 'Ít đá, ít ngọt (Healthy)', extra_price: 0, allowMultiple: false },
            { group_name: 'Mức đá & Đường', name: 'Không đá (Ướp lạnh phục vụ ngay)', extra_price: 0, allowMultiple: false }
        ]
    }
];

async function seedRichVariants() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    let addedCount = 0;
    for (const group of newVariantsData) {
        const dish = await db.collection('menuitems').findOne({ name: group.dishName });
        if (!dish) {
            console.log(`⚠️ Không tìm thấy món: ${group.dishName}`);
            continue;
        }

        for (const v of group.variants) {
            // Check if variant with same name and dish already exists
            const existing = await db.collection('variants').findOne({
                menuItem_id: dish._id,
                name: v.name
            });

            if (!existing) {
                await db.collection('variants').insertOne({
                    menuItem_id: dish._id,
                    group_name: v.group_name,
                    name: v.name,
                    extra_price: v.extra_price || 0,
                    cost_price: Math.round((v.extra_price || 0) * 0.35),
                    allowMultiple: v.allowMultiple || false,
                    status: 'Available',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    __v: 0
                });
                addedCount++;
            }
        }
        console.log(`✓ Đã nạp biến thể cho món: ${group.dishName}`);
    }

    const totalVariants = await db.collection('variants').countDocuments();
    console.log(`===============================================`);
    console.log(`🎉 ĐÃ THÊM THÀNH CÔNG ${addedCount} BIẾN THỂ MỚI!`);
    console.log(`📊 TỔNG SỐ BIẾN THỂ TRONG CSDL: ${totalVariants}`);
    console.log(`===============================================`);

    await mongoose.disconnect();
}

seedRichVariants();
