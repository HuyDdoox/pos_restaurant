const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, AuditLog } = require('../models');

// 1. Lấy danh sách tất cả nhân viên (Hỗ trợ lọc, tìm kiếm theo tên/SĐT/username)
exports.getAllUsers = async (req, res) => {
    try {
        const { role, status, branch_id, q } = req.query;
        let filter = {};

        if (role) filter.role = role;
        if (status) filter.status = status;
        if (branch_id) filter.branch_id = branch_id;
        if (q) {
            filter.$or = [
                { fullname: { $regex: q, $options: 'i' } },
                { username: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password')
            .populate('branch_id', 'name address')
            .sort({ createdAt: -1 });

        // 200: Xử lý thành công
        res.status(200).json({ status: 1, message: "Lấy danh sách người dùng thành công", data: users });
    } catch (error) {
        // 500: Lỗi Server
        res.status(500).json({ status: 0, message: "Lỗi lấy danh sách người dùng", err: error.message });
    }
};

// 2. Lấy thông tin 1 nhân viên theo ID
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        // 400: Kiểm tra định dạng ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID người dùng không hợp lệ!" });
        }

        const user = await User.findById(id).select('-password').populate('branch_id', 'name address');
        // 404: Không tìm thấy
        if (!user) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy người dùng!" });
        }

        // 200: Thành công
        res.status(200).json({ status: 1, message: "Lấy chi tiết thành công", data: user });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi máy chủ", err: error.message });
    }
};

// 3. Admin tạo nhân viên mới
exports.createUser = async (req, res) => {
    try {
        const { username, password, fullname, role, branch_id, phone, email, status } = req.body;

        // 400: Kiểm tra các trường bắt buộc
        if (!username || !password || !fullname) {
            return res.status(400).json({ status: 0, message: "Họ tên, tên đăng nhập và mật khẩu là bắt buộc!" });
        }

        const cleanUsername = username.toLowerCase().trim();

        // 409: Kiểm tra trùng tên đăng nhập
        const exists = await User.findOne({ username: cleanUsername });
        if (exists) {
            return res.status(409).json({ status: 0, message: "Tên đăng nhập đã tồn tại trong hệ thống!" });
        }

        // 409: Kiểm tra trùng số điện thoại
        if (phone) {
            const existingPhone = await User.findOne({ phone: phone.trim() });
            if (existingPhone) {
                return res.status(409).json({ status: 0, message: "Số điện thoại này đã được đăng ký!" });
            }
        }

        // Băm mật khẩu bằng Bcrypt
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = await User.create({
            username: cleanUsername,
            password: hashedPassword,
            fullname: fullname.trim(),
            role: role || 'Waiter',
            branch_id: branch_id || null,
            phone: phone ? phone.trim() : null,
            email: email ? email.trim().toLowerCase() : null,
            status: status || 'Active'
        });

        // Ghi log kiểm toán
        await AuditLog.create({
            category: 'security',
            actor: req.user ? req.user.username : 'Admin',
            action: 'Tạo tài khoản mới',
            detail: `Tạo tài khoản [${cleanUsername}] vai trò ${role}`
        }).catch(() => {});

        // 201: Tạo mới thành công
        res.status(201).json({ status: 1, message: "Tạo nhân viên thành công!", data: newUser });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo nhân viên", err: error.message });
    }
};

// 4. Cập nhật thông tin nhân viên
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        // 400: Kiểm tra định dạng ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID người dùng không hợp lệ!" });
        }

        // 404: Kiểm tra sự tồn tại
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy người dùng để cập nhật!" });
        }

        const { fullname, role, branch_id, phone, email, password, status, username } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng username nếu có cập nhật (loại trừ chính ID đang cập nhật)
        if (username) {
            const cleanUsername = username.toLowerCase().trim();
            const duplicateUsername = await User.findOne({ username: cleanUsername, _id: { $ne: id } });
            if (duplicateUsername) {
                return res.status(409).json({ status: 0, message: "Tên đăng nhập đã thuộc về người dùng khác!" });
            }
            updateData.username = cleanUsername;
        }

        // 409: Kiểm tra trùng số điện thoại
        if (phone) {
            const duplicatePhone = await User.findOne({ phone: phone.trim(), _id: { $ne: id } });
            if (duplicatePhone) {
                return res.status(409).json({ status: 0, message: "Số điện thoại đã thuộc về người dùng khác!" });
            }
            updateData.phone = phone.trim();
        }

        if (fullname !== undefined) updateData.fullname = fullname.trim();
        if (role !== undefined) updateData.role = role;
        if (branch_id !== undefined) updateData.branch_id = branch_id || null;
        if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;
        if (status !== undefined) updateData.status = status;

        // Nếu có đổi mật khẩu thì băm lại
        if (password && password.trim()) {
            if (password.length < 6) {
                return res.status(400).json({ status: 0, message: "Mật khẩu mới phải có tối thiểu 6 ký tự!" });
            }
            updateData.password = bcrypt.hashSync(password, 10);
        }

        const updated = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
            .select('-password')
            .populate('branch_id', 'name address');

        // 200: Cập nhật thành công
        res.status(200).json({ status: 1, message: "Cập nhật thông tin thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật", err: error.message });
    }
};

// 5. Khóa hoặc Mở khóa tài khoản nhân viên (Hỗ trợ Toggle thông minh theo cô dạy)
exports.toggleLockUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID người dùng không hợp lệ!" });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ status: 0, message: "Không tìm thấy người dùng" });

        const { reason, status } = req.body;
        let isLocking;

        if (status !== undefined) {
            isLocking = (status === 'Locked' || status === false || status === 'false');
        } else {
            // Tự động toggle: Nếu đang Active -> Khóa, nếu đang Locked -> Mở
            isLocking = user.status !== 'Locked';
        }

        // BRD 1.3: Bắt buộc phải có lock_reason khi khóa tài khoản
        if (isLocking && (!reason || !reason.trim())) {
            return res.status(400).json({ 
                status: 0, 
                message: "Bắt buộc phải nhập lý do khóa tài khoản (lock_reason) để lưu vết kiểm toán theo quy định!" 
            });
        }

        user.status = isLocking ? 'Locked' : 'Active';
        user.lock_reason = isLocking ? reason.trim() : null;
        await user.save();

        // Ghi log kiểm toán
        await AuditLog.create({
            category: 'security',
            actor: req.user ? req.user.username : 'Admin',
            action: isLocking ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
            detail: `${isLocking ? 'Khóa' : 'Mở khóa'} tài khoản [${user.username}]. Lý do: ${user.lock_reason || 'Bình thường'}`,
            severity: isLocking ? 'warning' : 'info'
        }).catch(() => {});

        res.status(200).json({ 
            status: 1, 
            message: `Đã ${isLocking ? 'khóa' : 'mở khóa'} tài khoản thành công!`, 
            data: user 
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi đổi trạng thái khóa", err: error.message });
    }
};

// 6. Xóa nhân viên
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID người dùng không hợp lệ!" });
        }

        const deleted = await User.findByIdAndDelete(id).select('-password');
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy người dùng" });

        res.status(200).json({ status: 1, message: "Xóa nhân viên thành công!", data: deleted });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa", err: error.message });
    }
};
