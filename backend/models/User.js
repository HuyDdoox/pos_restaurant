const mongoose = require('mongoose');

const schemaOptions = { 
    timestamps: true, 
    toJSON: { 
        virtuals: true, 
        transform: (doc, ret) => { 
            ret.id = ret._id; 
            delete ret.__v; 
            delete ret.password; // Bảo mật: Không bao giờ trả mật khẩu về cho client
        } 
    } 
};

const userSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Chi nhánh làm việc (null nếu là Tổng quản lý)
    username: { type: String, unique: true, trim: true, lowercase: true }, // Tên đăng nhập duy nhất
    password: { type: String, required: true }, // Mật khẩu đã băm (Bcrypt hash)
    fullname: { type: String, trim: true }, // Họ và tên đầy đủ
    name: { type: String, default: null, trim: true }, // Tương thích giáo trình (name)
    age: { type: Number, default: null }, // Tương thích giáo trình (age)
    phone: { type: String, default: null, trim: true }, // Số điện thoại nhân viên
    email: { type: String, default: null, trim: true, lowercase: true }, // Địa chỉ email
    role: { 
        type: String, 
        enum: ['Admin', 'Cashier', 'Waiter', 'Chef', 'Customer'], 
        default: 'Customer' 
    }, // Vai trò: Quản trị viên (Admin), Thu ngân (Cashier), Phục vụ (Waiter), Đầu bếp (Chef), Khách hàng (Customer)
    status: { 
        type: String, 
        enum: ['Active', 'Inactive', 'Locked', 'Archived'], 
        default: 'Active' 
    }, // Trạng thái: Đang làm việc (Active), Tạm ngưng (Inactive), Bị khóa (Locked), Đã xóa (Archived)
    lock_reason: { type: String, default: null }, // Lý do khóa tài khoản (lưu lịch sử kiểm toán)
    lastLogin: { type: Date, default: null } // Thời điểm đăng nhập gần nhất
}, schemaOptions);

// Tự động đồng bộ name <-> fullname và username nếu chưa có
userSchema.pre('validate', function(next) {
    if (!this.fullname && this.name) {
        this.fullname = this.name;
    }
    if (!this.name && this.fullname) {
        this.name = this.fullname;
    }
    if (!this.username) {
        if (this.email) {
            this.username = this.email.split('@')[0] + '_' + Math.floor(1000 + Math.random() * 9000);
        } else if (this.fullname) {
            this.username = this.fullname.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(1000 + Math.random() * 9000);
        } else {
            this.username = 'user_' + Date.now();
        }
    }
    if (typeof next === 'function') next();
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = UserModel;
module.exports.UserModel = UserModel;
