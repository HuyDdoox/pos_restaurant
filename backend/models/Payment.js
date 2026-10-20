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

const paymentSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, // Đơn hàng thanh toán
    cashier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Thu ngân thực hiện giao dịch
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh phát sinh giao dịch
    payment_method: { 
        type: String, 
        enum: ['Cash', 'Credit_Card', 'Bank_Transfer', 'E_Wallet'], 
        required: true 
    }, // Phương thức: Tiền mặt, Thẻ tín dụng, Chuyển khoản QR, Ví điện tử
    amount: { type: Number, required: true, min: 0 }, // Tổng số tiền đã thanh toán cho hóa đơn
    customerCash: { type: Number, default: 0, min: 0 }, // Tiền mặt khách đưa (dành cho thanh toán Tiền mặt)
    changeAmount: { type: Number, default: 0, min: 0 }, // Tiền thừa thối lại cho khách
    status: { 
        type: String, 
        enum: ['Completed', 'Failed', 'Refunded', 'Archived'], 
        default: 'Completed' 
    } // Trạng thái giao dịch: Hoàn thành, Thất bại, Hoàn tiền, Lưu trữ
}, schemaOptions);

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);