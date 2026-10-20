const mongoose = require('mongoose');

const schemaOptions = { 
    timestamps: true, 
    toJSON: { 
        virtuals: true, 
        transform: (doc, ret) => { 
            ret.id = ret._id; 
            ret.notes = ret.variantNote || ret.notes || '';
            ret.variantNote = ret.variantNote || ret.notes || '';
            delete ret.__v; 
        } 
    },
    toObject: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.id = ret._id;
            ret.notes = ret.variantNote || ret.notes || '';
            ret.variantNote = ret.variantNote || ret.notes || '';
            delete ret.__v;
        }
    }
};

const orderDetailSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, // Thuộc đơn hàng nào
    menuItem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true }, // Món ăn tương ứng
    variants_selected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Variant' }], // Danh sách ID các biến thể đã chọn
    variantNote: { type: String, default: '' }, // Tóm tắt biến thể hoặc ghi chú món (VD: "Ít ngọt, Không hành")
    notes: { type: String, default: '' }, // Đồng bộ ghi chú món cho Frontend, KDS, Thu ngân
    quantity: { type: Number, required: true, min: 1, default: 1 }, // Số lượng phần ăn
    priceAtOrder: { type: Number, required: true, min: 0 }, // Đơn giá tại thời điểm gọi món (đã cộng biến thể nếu có)
    costAtOrder: { type: Number, default: 0, min: 0 }, // Giá vốn ước tính tại thời điểm gọi món (để phân tích P&L)
    
    // Combo thông tin thành phần
    is_combo: { type: Boolean, default: false },
    combo_items: [mongoose.Schema.Types.Mixed],
    
    // Quản lý vận hành Bếp (KDS) & Phục vụ
    status: { 
        type: String, 
        enum: ['Unconfirmed', 'Pending', 'Cooking', 'Ready', 'Served', 'Cancelled'], 
        default: 'Pending' 
    }, // Trạng thái: Chờ duyệt (Unconfirmed), Chờ nấu (Pending), Đang chế biến (Cooking), Nấu xong chờ bưng (Ready), Đã phục vụ (Served), Bị hủy (Cancelled)
    station: { 
        type: String, 
        enum: ['hot', 'cold', 'bar', 'general'], 
        default: 'hot' 
    }, // Phân tuyến trạm chế biến: Bếp nóng, Bếp lạnh, Quầy bar
    isRush: { type: Boolean, default: false }, // Đánh dấu món bị giục gấp (Rush Order)
    incidentNote: { type: String, default: null }, // Lý do nếu hủy món (VD: Khách đổi ý, Hết nguyên liệu, Nấu hỏng...)
    
    // Mốc thời gian SLA
    cookedAt: { type: Date, default: null }, // Thời điểm đầu bếp bấm hoàn thành món
    servedAt: { type: Date, default: null } // Thời điểm bồi bàn bấm đã bưng lên bàn
}, schemaOptions);

module.exports = mongoose.models.OrderDetail || mongoose.model('OrderDetail', orderDetailSchema);