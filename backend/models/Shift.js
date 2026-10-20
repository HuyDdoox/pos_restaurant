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

const shiftSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh làm việc
    cashier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Thu ngân phụ trách ca
    startTime: { type: Date, required: true, default: Date.now }, // Thời điểm mở ca
    endTime: { type: Date, default: null }, // Thời điểm chốt ca
    startingCash: { type: Number, required: true, default: 0, min: 0 }, // Tiền mặt ban đầu trong két khi mở ca
    endingCash: { type: Number, default: 0 }, // Số dư tiền két lý thuyết (startingCash + tiền bán mặt - chi két)
    actualCash: { type: Number, default: 0 }, // Tiền mặt thực tế thu ngân đếm được khi kết ca
    difference: { type: Number, default: 0 }, // Chênh lệch tiền két (thừa / thiếu)
    status: { 
        type: String, 
        enum: ['Open', 'Active', 'Closed', 'Archived'], 
        default: 'Open' 
    }, // Trạng thái ca: Đang mở (Open/Active), Đã đóng (Closed), Lưu trữ (Archived)
    notes: { type: String, default: '' } // Ghi chú kết ca hoặc giải trình chênh lệch
}, schemaOptions);

module.exports = mongoose.models.Shift || mongoose.model('Shift', shiftSchema);