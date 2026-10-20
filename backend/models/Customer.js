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

const customerSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh đăng ký
    name: { type: String, required: true, trim: true }, // Họ và tên khách hàng
    phone: { type: String, required: true, unique: true, trim: true }, // Số điện thoại (Khóa nhận diện hội viên)
    email: { type: String, default: null, trim: true, lowercase: true }, // Email liên hệ
    tier: { 
        type: String, 
        enum: ['Bronze', 'Silver', 'Gold', 'Diamond'], 
        default: 'Bronze' 
    }, // Hạng thành viên: Đồng (Bronze), Bạc (Silver), Vàng (Gold), Kim Cương (Diamond)
    points: { type: Number, default: 0, min: 0 }, // Điểm thưởng tích lũy hiện có
    totalSpent: { type: Number, default: 0, min: 0 }, // Tổng số tiền đã chi tiêu tại nhà hàng (VNĐ)
    registeredAt: { type: Date, default: Date.now }, // Ngày gia nhập chương trình hội viên
    lastVisit: { type: Date, default: Date.now }, // Lần ghé thăm / ăn gần nhất
    notes: { type: String, default: '' } // Ghi chú sở thích khách hàng (VD: Bàn view đẹp, Dị ứng hải sản...)
}, schemaOptions);

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
