const mongoose = require('mongoose');
const { Voucher, Customer, Feedback, AuditLog } = require('../models');

// ==========================================
// 1. QUẢN LÝ VOUCHERS & KHUYẾN MÃI
// ==========================================

// Lấy danh sách vouchers (GET /api/vouchers)
exports.getAllVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.status(200).json({ status: 1, message: "Lấy danh sách vouchers thành công", data: vouchers });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy danh sách voucher", err: error.message });
    }
};

// Tạo Voucher mới (POST /api/vouchers)
exports.createVoucher = async (req, res) => {
    try {
        const { code, name, type, value, maxDiscount, minOrderValue, usageLimit, startDate, endDate, status } = req.body;

        if (!code || !code.trim()) {
            return res.status(400).json({ status: 0, message: "Mã Voucher không được để trống!" });
        }

        const cleanCode = code.trim().toUpperCase();

        // 409: Kiểm tra trùng mã Voucher
        const exists = await Voucher.findOne({ code: cleanCode });
        if (exists) {
            return res.status(409).json({ status: 0, message: `Mã Voucher [${cleanCode}] đã tồn tại trong hệ thống!` });
        }

        const voucher = await Voucher.create({
            code: cleanCode,
            name: name ? name.trim() : cleanCode,
            type: type || 'percentage',
            value: Number(value) || 0,
            maxDiscount: (maxDiscount && !isNaN(maxDiscount)) ? Number(maxDiscount) : null,
            minOrderValue: (minOrderValue && !isNaN(minOrderValue)) ? Number(minOrderValue) : 0,
            usageLimit: (usageLimit && !isNaN(usageLimit)) ? Number(usageLimit) : 100,
            startDate: startDate || new Date(),
            endDate: endDate || null,
            status: status || 'Active'
        });

        res.status(201).json({ status: 1, message: "Tạo Voucher thành công!", data: voucher });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo voucher", err: error.message });
    }
};

// Cập nhật Voucher (PUT /api/vouchers/:id)
exports.updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID voucher không hợp lệ!" });
        }

        const voucher = await Voucher.findById(id);
        if (!voucher) return res.status(404).json({ status: 0, message: "Không tìm thấy voucher để cập nhật!" });

        const { code, name, type, value, maxDiscount, minOrderValue, usageLimit, startDate, endDate, status } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng mã với voucher khác
        if (code && code.trim()) {
            const cleanCode = code.trim().toUpperCase();
            const duplicate = await Voucher.findOne({ code: cleanCode, _id: { $ne: id } });
            if (duplicate) {
                return res.status(409).json({ status: 0, message: `Mã Voucher [${cleanCode}] đã được sử dụng!` });
            }
            updateData.code = cleanCode;
        }

        if (name !== undefined) updateData.name = name.trim();
        if (type !== undefined) updateData.type = type;
        if (value !== undefined) updateData.value = Number(value);
        if (maxDiscount !== undefined) updateData.maxDiscount = Number(maxDiscount);
        if (minOrderValue !== undefined) updateData.minOrderValue = Number(minOrderValue);
        if (usageLimit !== undefined) updateData.usageLimit = Number(usageLimit);
        if (startDate !== undefined) updateData.startDate = startDate;
        if (endDate !== undefined) updateData.endDate = endDate;
        if (status !== undefined) updateData.status = status;

        const updated = await Voucher.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: 1, message: "Cập nhật voucher thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật", err: error.message });
    }
};

// Xóa Voucher (DELETE /api/vouchers/:id)
exports.deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID voucher không hợp lệ!" });
        }

        const deleted = await Voucher.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy voucher!" });

        res.status(200).json({ status: 1, message: "Xóa voucher thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa", err: error.message });
    }
};

// ==========================================
// 2. QUẢN LÝ KHÁCH HÀNG VIP & TÍCH ĐIỂM (LOYALTY)
// ==========================================

// Lấy danh sách khách hàng VIP (GET /api/customers)
exports.getAllCustomers = async (req, res) => {
    try {
        const { q, tier } = req.query;
        let filter = {};
        if (tier) filter.tier = tier;
        if (q) {
            filter.$or = [
                { name: { $regex: q.trim(), $options: 'i' } },
                { phone: { $regex: q.trim(), $options: 'i' } },
                { email: { $regex: q.trim(), $options: 'i' } }
            ];
        }

        const customers = await Customer.find(filter).sort({ points: -1, createdAt: -1 });
        res.status(200).json({ status: 1, message: "Lấy danh sách khách hàng VIP thành công", data: customers });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// Thêm khách hàng mới (POST /api/customers)
exports.createCustomer = async (req, res) => {
    try {
        const { name, phone, email, tier, points, totalSpent, notes } = req.body;

        if (!phone || !phone.trim()) {
            return res.status(400).json({ status: 0, message: "Số điện thoại hội viên là bắt buộc!" });
        }

        const cleanPhone = phone.trim();

        // 409: Kiểm tra trùng SĐT khách hàng
        const exists = await Customer.findOne({ phone: cleanPhone });
        if (exists) {
            return res.status(409).json({ status: 0, message: `Số điện thoại [${cleanPhone}] đã được đăng ký hội viên!` });
        }

        const cust = await Customer.create({
            name: name ? name.trim() : 'Khách hàng',
            phone: cleanPhone,
            email: email ? email.trim().toLowerCase() : null,
            tier: tier || 'Bronze',
            points: Number(points) || 0,
            totalSpent: Number(totalSpent) || 0,
            notes: notes ? notes.trim() : ''
        });

        res.status(201).json({ status: 1, message: "Thêm hội viên VIP thành công!", data: cust });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo hội viên", err: error.message });
    }
};

// Cập nhật thông tin hội viên (PUT /api/customers/:id)
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID khách hàng không hợp lệ!" });
        }

        const cust = await Customer.findById(id);
        if (!cust) return res.status(404).json({ status: 0, message: "Không tìm thấy khách hàng!" });

        const { name, phone, email, tier, notes } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng SĐT với khách khác
        if (phone && phone.trim()) {
            const cleanPhone = phone.trim();
            const duplicate = await Customer.findOne({ phone: cleanPhone, _id: { $ne: id } });
            if (duplicate) {
                return res.status(409).json({ status: 0, message: `Số điện thoại [${cleanPhone}] đã thuộc về hội viên khác!` });
            }
            updateData.phone = cleanPhone;
        }

        if (name !== undefined) updateData.name = name.trim();
        if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;
        if (tier !== undefined) updateData.tier = tier;
        if (notes !== undefined) updateData.notes = notes.trim();

        const updated = await Customer.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: 1, message: "Cập nhật hội viên thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// Điều chỉnh điểm tích lũy thủ công (POST /api/customers/:id/adjust-points)
exports.adjustCustomerPoints = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID khách hàng không hợp lệ!" });
        }

        const { type, points, reason } = req.body; // type: 'add' | 'subtract'
        const cust = await Customer.findById(id);
        if (!cust) return res.status(404).json({ status: 0, message: "Không tìm thấy khách hàng" });

        const p = Number(points) || 0;
        const oldPoints = cust.points || 0;
        cust.points = type === 'add' ? oldPoints + p : Math.max(0, oldPoints - p);
        await cust.save();

        // Ghi Audit Log
        await AuditLog.create({
            category: 'financial',
            actor: req.user ? req.user.username : 'Admin',
            action: 'Điều chỉnh điểm VIP',
            detail: `${type === 'add' ? 'Cộng' : 'Trừ'} ${p} điểm cho khách [${cust.name}]. Lý do: ${reason || 'Thao tác thủ công'}`
        }).catch(() => {});

        res.status(200).json({ status: 1, message: "Điều chỉnh điểm hội viên thành công!", data: cust });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi điều chỉnh điểm", err: error.message });
    }
};

// Xóa khách hàng (DELETE /api/customers/:id)
exports.deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID khách hàng không hợp lệ!" });
        }

        const deleted = await Customer.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy khách hàng" });

        res.status(200).json({ status: 1, message: "Xóa hội viên thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// ==========================================
// 3. ĐÁNH GIÁ PHẢN HỒI (FEEDBACKS)
// ==========================================

// Gửi đánh giá phản hồi (POST /api/feedbacks)
exports.createFeedback = async (req, res) => {
    try {
        const { tableId, tableName, orderId, rating, tags, comment } = req.body;
        const fb = await Feedback.create({
            tableId,
            tableName: tableName || 'Bàn',
            orderId,
            rating: (rating && !isNaN(rating)) ? Number(rating) : 5,
            tags: tags || [],
            comment: comment ? comment.trim() : ''
        });
        res.status(201).json({ status: 1, message: "Cảm ơn quý khách đã gửi đánh giá!", data: fb });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lưu feedback", err: error.message });
    }
};

// Lấy danh sách đánh giá (GET /api/feedbacks)
exports.getAllFeedbacks = async (req, res) => {
    try {
        const list = await Feedback.find().sort({ createdAt: -1 });
        res.status(200).json({ status: 1, message: "Lấy đánh giá thành công", data: list });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// ==========================================
// 4. NHẬT KÝ KIỂM TOÁN (AUDIT LOGS)
// ==========================================

// Lấy nhật ký kiểm toán (GET /api/audit-logs)
exports.getAllAuditLogs = async (req, res) => {
    try {
        const { category, q } = req.query;
        let filter = {};
        if (category && category !== 'all') filter.category = category;
        if (q) {
            filter.$or = [
                { action: { $regex: q.trim(), $options: 'i' } },
                { actor: { $regex: q.trim(), $options: 'i' } },
                { detail: { $regex: q.trim(), $options: 'i' } }
            ];
        }

        const logs = await AuditLog.find(filter).sort({ timestamp: -1, createdAt: -1 }).limit(200);
        res.status(200).json({ status: 1, message: "Lấy nhật ký kiểm toán thành công", data: logs });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// Ghi nhật ký kiểm toán (POST /api/audit-logs)
exports.createAuditLog = async (req, res) => {
    try {
        const { category, actor, action, detail, severity } = req.body;
        const log = await AuditLog.create({
            category: category || 'system',
            actor: actor || (req.user ? req.user.username : 'Hệ thống'),
            action: action || 'Thao tác hệ thống',
            detail: detail || '',
            severity: severity || 'info'
        });
        res.status(201).json({ status: 1, message: "Ghi nhật ký thành công", data: log });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};
