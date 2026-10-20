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

const voucherSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh áp dụng (null nếu toàn chuỗi)
    code: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true, 
        uppercase: true 
    }, // Mã khuyến mãi duy nhất (VD: VIP10, GIAM50K, CHAOHAN2026)
    name: { type: String, required: true, trim: true }, // Tên chương trình ưu đãi
    type: { 
        type: String, 
        enum: ['percentage', 'fixed'], 
        required: true 
    }, // Hình thức giảm: Phần trăm (percentage) hoặc Số tiền cố định (fixed)
    value: { type: Number, required: true, min: 1 }, // Giá trị giảm (% hoặc số tiền VNĐ)
    maxDiscount: { type: Number, default: null, min: 0 }, // Số tiền giảm tối đa (áp dụng cho loại percentage)
    minOrderValue: { type: Number, default: 0, min: 0 }, // Giá trị đơn hàng tối thiểu để được áp mã
    usageLimit: { type: Number, default: 100, min: 1 }, // Giới hạn tổng số lượt sử dụng
    usedCount: { type: Number, default: 0, min: 0 }, // Số lượt khách đã áp dụng mã thực tế
    startDate: { type: String, default: null }, // Ngày bắt đầu hiệu lực (YYYY-MM-DD)
    endDate: { type: String, default: null }, // Ngày kết thúc hiệu lực (YYYY-MM-DD)
    status: { 
        type: String, 
        enum: ['Active', 'Inactive', 'Archived'], 
        default: 'Active' 
    } // Trạng thái: Đang chạy (Active), Tạm ngưng (Inactive), Lưu trữ (Archived)
}, schemaOptions);

module.exports = mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema);
