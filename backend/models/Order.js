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

const orderSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh tạo đơn
    table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null }, // Bàn phục vụ (null nếu mang đi)
    waiter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Nhân viên phục vụ phụ trách (null nếu khách tự quét QR)
    customerInfo: { type: String, default: 'Khách lẻ', trim: true }, // Thông tin khách / Nhận diện bàn
    
    // Tiền tệ & Chiết khấu
    subtotal: { type: Number, default: 0, min: 0 }, // Tiền món tạm tính trước chiết khấu
    discountType: { 
        type: String, 
        enum: ['none', 'percent', 'amount', 'voucher'], 
        default: 'none' 
    }, // Hình thức giảm giá
    discountPercent: { type: Number, default: 0, min: 0, max: 100 }, // % giảm giá nếu có
    discountAmount: { type: Number, default: 0, min: 0 }, // Tổng số tiền được giảm
    voucherCode: { type: String, default: null, trim: true }, // Mã voucher đã dùng
    discountReason: { type: String, default: null }, // Lý do giảm giá (VD: Thẻ VIP, Voucher Hè,...)
    
    // Phí dịch vụ & VAT
    serviceChargeRate: { type: Number, default: 0, min: 0 }, // Tỷ lệ phí phục vụ (VD: 0.05 = 5%)
    serviceChargeAmount: { type: Number, default: 0, min: 0 }, // Số tiền phí phục vụ
    vatRate: { type: Number, default: 0.08, min: 0 }, // Tỷ lệ thuế VAT (mặc định 8% = 0.08)
    vatAmount: { type: Number, default: 0, min: 0 }, // Số tiền thuế VAT
    
    // Tổng thanh toán thực tế
    totalAmount: { type: Number, required: true, default: 0, min: 0 }, // Tổng tiền khách cần trả cuối cùng
    
    // Trạng thái vận hành & Thanh toán
    status: { 
        type: String, 
        enum: ['Pending', 'In_Progress', 'Cooking', 'Served', 'Completed', 'Cancelled', 'Archived'], 
        default: 'In_Progress' 
    }, // Trạng thái đơn: Chờ xử lý, Đang phục vụ (In_Progress), Đang nấu, Đã lên món, Hoàn tất, Đã hủy
    paymentStatus: { 
        type: String, 
        enum: ['Unpaid', 'Paid', 'Refunded'], 
        default: 'Unpaid' 
    }, // Trạng thái thanh toán: Chưa thanh toán, Đã thanh toán, Hoàn tiền
    paymentMethod: { 
        type: String, 
        enum: ['Cash', 'Credit_Card', 'Bank_Transfer', 'E_Wallet', null], 
        default: null 
    }, // Phương thức thanh toán: Tiền mặt, Thẻ tín dụng, Chuyển khoản, Ví điện tử
    
    // Nghiệp vụ bàn
    splitFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }, // Đơn cha nếu được tạo từ tính năng Tách bàn/đơn
    transferredFromTable: { type: String, default: null }, // Ghi nhận bàn nguồn nếu vừa thực hiện Đổi bàn
    notes: { type: String, default: '' } // Ghi chú đặc biệt cho toàn bộ đơn hàng
}, schemaOptions);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);