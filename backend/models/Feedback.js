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

const feedbackSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh nhận đánh giá
    tableId: { type: mongoose.Schema.Types.Mixed, default: null }, // ID bàn khách ngồi
    tableName: { type: String, default: '', trim: true }, // Tên bàn hiển thị (VD: Bàn 03)
    orderId: { type: mongoose.Schema.Types.Mixed, default: null }, // ID đơn hàng tương ứng
    rating: { type: Number, required: true, min: 1, max: 5, default: 5 }, // Đánh giá sao (1 - 5 sao)
    tags: [{ type: String, trim: true }], // Các tag khen/góp ý nhanh (VD: 'Món ăn ngon', 'Phục vụ chu đáo', 'Lên món nhanh')
    comment: { type: String, default: '', trim: true } // Ý kiến đóng góp chi tiết của khách hàng
}, schemaOptions);

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
