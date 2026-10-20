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

const recipeSchema = new mongoose.Schema({
    menuItem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true }, // Thuộc món ăn nào
    ingredient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true }, // Nguyên liệu tương ứng
    quantity_required: { type: Number, required: true, min: 0 }, // Định lượng tiêu hao khi hoàn thành 1 phần ăn
    unit: { type: String, default: '' }, // Đơn vị tính định lượng (g, ml, con,...)
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' } // Trạng thái công thức
}, schemaOptions);

module.exports = mongoose.models.Recipe || mongoose.model('Recipe', recipeSchema);