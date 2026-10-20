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

const categorySchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Thuộc chi nhánh (null nếu dùng chung)
    name: { type: String, required: true, trim: true }, // Tên danh mục (Khai vị, Món chính, Đồ uống,...)
    description: { type: String, default: '' }, // Mô tả ngắn về danh mục
    icon: { type: String, default: null }, // Biểu tượng icon đại diện
    displayOrder: { type: Number, default: 0 }, // Thứ tự ưu tiên hiển thị trên Menu
    status: { type: String, enum: ['Active', 'Inactive', 'Archived'], default: 'Active' } // Trạng thái
}, schemaOptions);

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);