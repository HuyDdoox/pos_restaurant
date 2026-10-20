const mongoose = require('mongoose');

const schemaOptions = { 
    timestamps: true, 
    toJSON: { 
        virtuals: true, 
        transform: (doc, ret) => { 
            ret.id = ret._id; 
            delete ret.__v; 
        } 
    } 
};

const menuItemSchema = new mongoose.Schema({
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }, // Khóa ngoại danh mục
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh áp dụng
    name: { type: String, required: true, trim: true }, // Tên món ăn / đồ uống
    base_price: { type: Number, required: true, min: 0 }, // Giá bán niêm yết
    cost_price: { type: Number, default: 0, min: 0 }, // Giá vốn ước tính (dùng tính lãi lỗ P&L)
    image: { type: String, default: null }, // Đường dẫn hình ảnh món ăn
    description: { type: String, default: '' }, // Mô tả chi tiết món ăn
    station: { 
        type: String, 
        enum: ['hot', 'cold', 'bar', 'general'], 
        default: 'hot' 
    }, // Trạm chế biến KDS: Bếp nóng (hot), Bếp nguội (cold), Quầy Bar (bar)
    isPopular: { type: Boolean, default: false }, // Đánh dấu món bán chạy (Best Seller)
    // --- COMBO FLASH SALE ---
    is_combo: { type: Boolean, default: false }, // Có phải là Combo nhiều món không
    serving_size: { type: String, default: null }, // Quy mô khẩu phần (VD: '2 người', '3-4 người', 'Gia đình 4-6 người')
    combo_items: [mongoose.Schema.Types.Mixed], // Danh sách các món thành phần trong Combo (kèm biến thể, số lượng)
    // --- FLASH SALE GIỜ VÀNG ---
    is_flash_sale: { type: Boolean, default: false }, // Đang bật Flash Sale
    sale_price: { type: Number, default: 0, min: 0 }, // Giá Flash Sale giờ vàng
    flash_sale_start: { type: Date, default: null }, // Thời điểm bắt đầu
    flash_sale_end: { type: Date, default: null }, // Thời điểm kết thúc
    flash_sale_limit: { type: Number, default: 0, min: 0 }, // Số lượng suất tối đa bán giá Flash Sale (0: không giới hạn)
    flash_sale_sold: { type: Number, default: 0, min: 0 }, // Số lượng suất đã bán được
    status: { 
        type: String, 
        enum: ['Available', 'Out_of_stock', 'Archived'], 
        default: 'Available' 
    } // Trạng thái: Có sẵn (Available), Tạm hết (Out_of_stock), Lưu trữ/Xóa mềm (Archived)
}, schemaOptions);

module.exports = mongoose.models.MenuItem || mongoose.model('MenuItem', menuItemSchema);