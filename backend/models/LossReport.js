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

const lossReportSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh lập báo cáo
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true }, // Nguyên liệu bị thất thoát / kiểm kê
    ingredientName: { type: String, required: true, trim: true }, // Tên nguyên liệu
    systemStock: { type: Number, required: true, default: 0 }, // Số lượng tồn kho trên phần mềm trước kiểm kê
    actualStock: { type: Number, required: true, default: 0 }, // Số lượng tồn kho thực tế đếm được
    lossAmount: { type: Number, required: true, default: 0 }, // Số lượng thất thoát / chênh lệch (systemStock - actualStock)
    lossCost: { type: Number, required: true, default: 0 }, // Tổng giá trị thiệt hại tài chính (VNĐ)
    unit: { type: String, default: '' }, // Đơn vị tính: kg, g, lít,...
    reason: { type: String, required: true, trim: true }, // Lý do thất thoát (Hết hạn, ôi thiu, vỡ/đổ, chênh lệch kiểm kê...)
    isAbnormal: { type: Boolean, default: false }, // Đánh dấu thất thoát bất thường (chênh lệch lớn cần Admin lưu ý)
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // Nhân viên / Quản lý kiểm kê
}, schemaOptions);

module.exports = mongoose.models.LossReport || mongoose.model('LossReport', lossReportSchema);
