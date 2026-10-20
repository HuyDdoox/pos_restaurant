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

const variantRecipeSchema = new mongoose.Schema({
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Variant', required: true }, // Biến thể món ăn (VD: Thêm 1 phần phô mai, Size Lớn...)
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true }, // Nguyên liệu tương ứng
    ingredientName: { type: String, default: '' }, // Tên nguyên liệu lưu kèm để truy xuất nhanh
    quantity: { type: Number, required: true, min: 0 }, // Định lượng nguyên liệu phụ thu (VD: +150g, +50ml)
    unit: { type: String, required: true, trim: true }, // Đơn vị tính: g, kg, ml, lít, cái...
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' } // Trạng thái
}, schemaOptions);

module.exports = mongoose.models.VariantRecipe || mongoose.model('VariantRecipe', variantRecipeSchema);
