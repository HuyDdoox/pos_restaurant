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

const tableSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh sở hữu bàn
    tableNumber: { type: String, required: true, trim: true }, // Tên / Số bàn hiển thị (VD: Bàn 01, VIP 01)
    max_capacity: { type: Number, required: true, min: 1, default: 4 }, // Sức chứa tối đa (số người ngồi)
    current_pax: { type: Number, default: 0 },
    merged_with: { type: String, default: null },
    zone: { type: String, default: 'Tầng 1', trim: true }, // Khu vực đặt bàn: Tầng 1, Tầng 2, Sân vườn, Phòng VIP
    status: { 
        type: String, 
        enum: ['Available', 'Occupied', 'Waiting_Payment', 'Reserved', 'Archived', 'Locked', 'Maintenance'], 
        default: 'Available' 
    }, // Trạng thái bàn: Trống (Available), Đang có khách (Occupied), Chờ thanh toán (Waiting_Payment), Đã đặt (Reserved)
    currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null } // Đơn hàng hiện tại đang mở của bàn
}, schemaOptions);

module.exports = mongoose.models.Table || mongoose.model('Table', tableSchema);