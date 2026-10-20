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

const variantSchema = new mongoose.Schema({
    menuItem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true }, // Thuộc món ăn nào
    group_name: { type: String, required: true, trim: true }, // Tên nhóm biến thể (Size, Độ ngọt, Topping,...)
    name: { type: String, required: true, trim: true }, // Tên biến thể cụ thể (Size L, Ít đá, Thêm trân châu,...)
    extra_price: { type: Number, default: 0, min: 0 }, // Giá phụ thu cộng thêm vào món
    cost_price: { type: Number, default: 0, min: 0 }, // Giá vốn nguyên liệu phụ thu (cho P&L)
    allowMultiple: { type: Boolean, default: false }, // Cho phép chọn nhiều option hay chọn đơn (Radio vs Checkbox)
    status: { 
        type: String, 
        enum: ['Available', 'Out_of_stock', 'Archived'], 
        default: 'Available' 
    } // Trạng thái: Có sẵn, Hết hàng, Lưu trữ
}, schemaOptions);

module.exports = mongoose.models.Variant || mongoose.model('Variant', variantSchema);