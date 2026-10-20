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

const auditLogSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh ghi nhận
    timestamp: { type: Date, default: Date.now, index: true }, // Thời điểm phát sinh sự kiện
    category: { 
        type: String, 
        enum: ['financial', 'order', 'inventory', 'security', 'system'], 
        required: true,
        index: true
    }, // Phân loại: Tài chính (financial), Đơn hàng/Hủy món (order), Kho hàng (inventory), Bảo mật/Khóa TK (security), Hệ thống (system)
    actor: { type: String, required: true, trim: true }, // Nhân viên / Người dùng thực hiện thao tác
    action: { type: String, required: true, trim: true }, // Tên hành động nghiệp vụ
    detail: { type: String, required: true, trim: true }, // Nội dung chi tiết được ghi vết
    severity: { 
        type: String, 
        enum: ['info', 'warning', 'danger'], 
        default: 'info' 
    } // Mức độ nghiêm trọng: Thông tin (info), Cảnh báo (warning), Nguy hiểm/Khẩn cấp (danger)
}, schemaOptions);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
