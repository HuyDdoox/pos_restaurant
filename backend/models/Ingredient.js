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

const ingredientSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh quản lý kho
    name: { type: String, required: true, trim: true }, // Tên nguyên liệu (Thịt bò, Sữa chua, Đường cát,...)
    stock_quantity: { type: Number, required: true, default: 0 }, // Số lượng tồn kho thực tế
    unit: { type: String, required: true, trim: true }, // Đơn vị tính: kg, g, lít, ml, lon, con, gói,...
    cost_price: { type: Number, default: 0, min: 0 }, // Giá nhập/vốn trên 1 đơn vị tính (để tính giá thành món và thiệt hại thất thoát)
    min_threshold: { type: Number, default: 5, min: 0 }, // Ngưỡng tối thiểu kích hoạt cảnh báo "Kho sắp hết" trên Admin
    status: { 
        type: String, 
        enum: ['Active', 'Out_of_stock', 'Archived'], 
        default: 'Active' 
    } // Trạng thái: Đang dùng, Hết kho, Lưu trữ
}, schemaOptions);

module.exports = mongoose.models.Ingredient || mongoose.model('Ingredient', ingredientSchema);