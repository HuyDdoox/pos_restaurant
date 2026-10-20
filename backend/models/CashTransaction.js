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

const cashTransactionSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh phát sinh phiếu
    shift_id: { type: mongoose.Schema.Types.Mixed, default: null }, // ID ca làm việc tương ứng (ObjectId hoặc String)
    type: { 
        type: String, 
        enum: ['in', 'out', 'CASH_IN', 'CASH_OUT'], 
        required: true 
    }, // Phân loại: Thu vào két (in / CASH_IN) hoặc Chi ra từ két (out / CASH_OUT)
    amount: { type: Number, required: true, min: 1 }, // Số tiền thực hiện giao dịch (VNĐ)
    reason: { type: String, required: true, trim: true }, // Lý do thu chi (VD: Mua đá lạnh gấp, nạp thêm tiền lẻ thối, tạm ứng...)
    createdBy: { type: String, default: 'Thu ngân', trim: true }, // Người lập phiếu
    performedBy: { type: String, default: 'Thu ngân', trim: true } // Người thực hiện nhận/chi tiền
}, schemaOptions);

module.exports = mongoose.models.CashTransaction || mongoose.model('CashTransaction', cashTransactionSchema);
