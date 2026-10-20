const mongoose = require('mongoose');

// Cấu hình Schema: Tự động tạo createdAt, updatedAt và map _id thành id cho Frontend
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

const branchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true }, // Tên chi nhánh (VD: Chi nhánh Quận 1)
    address: { type: String, required: true, trim: true }, // Địa chỉ cụ thể
    phone: { type: String, default: null, trim: true }, // Số điện thoại liên hệ chi nhánh
    status: { type: String, enum: ['Active', 'Inactive', 'Archived'], default: 'Active' } // Trạng thái hoạt động
}, schemaOptions);

module.exports = mongoose.models.Branch || mongoose.model('Branch', branchSchema);