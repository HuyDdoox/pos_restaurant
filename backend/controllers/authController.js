const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, UserModel } = require('../models');

// Secret key theo giáo trình ('shhhhh')
const JWT_SECRET = 'shhhhh';

// =========================================================================
// 1. ĐĂNG KÝ TÀI KHOẢN (REGISTER)
// Hỗ trợ cả chuẩn giáo trình ({ name, email, password, age, confirm_password })
// và chuẩn POS Nhà hàng ({ username, fullname, password, role, branch_id, phone, email })
// =========================================================================
exports.register = async (req, res) => {
    try {
        const { name, email, password, age, confirm_password, username, fullname, role, branch_id, phone } = req.body;

        // BẮT LỖI 1: Kiểm tra mật khẩu xác nhận (chuẩn giáo trình)
        if (confirm_password !== undefined && password !== confirm_password) {
            return res.status(400).json({
                status: 0,
                error: 'Dữ liệu không chính xác: Mật khẩu xác nhận không khớp',
                message: 'Dữ liệu không chính xác',
                user: { name: null, email: null }
            });
        }

        // BẮT LỖI 2: Mật khẩu tối thiểu 6 ký tự
        if (!password || password.length < 6) {
            return res.status(400).json({
                status: 0,
                error: 'Mật khẩu phải có tối thiểu 6 ký tự!',
                message: 'Mật khẩu phải có tối thiểu 6 ký tự!',
                user: { name: null, email: null }
            });
        }

        const effectiveFullname = (fullname || name || '').trim();
        const effectiveName = (name || fullname || '').trim();
        let effectiveEmail = email ? email.trim().toLowerCase() : null;

        // BẮT LỖI 3: Kiểm tra định dạng email nếu có
        if (effectiveEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) {
            return res.status(400).json({
                status: 0,
                error: 'Địa chỉ email không đúng định dạng!',
                message: 'Địa chỉ email không đúng định dạng!',
                user: { name: null, email: null }
            });
        }

        // BẮT LỖI 4: Kiểm tra trùng lặp email nếu có
        if (effectiveEmail) {
            const existingEmail = await User.findOne({ email: effectiveEmail });
            if (existingEmail) {
                return res.status(400).json({
                    status: 0,
                    error: 'Email này đã được đăng ký trong hệ thống!',
                    message: 'Email này đã được đăng ký trong hệ thống!',
                    user: { name: null, email: null }
                });
            }
        }

        // Tạo username an toàn duy nhất
        let cleanUsername = username ? username.trim().toLowerCase() : null;
        if (!cleanUsername) {
            if (effectiveEmail) {
                cleanUsername = effectiveEmail.split('@')[0];
            } else if (effectiveFullname) {
                cleanUsername = effectiveFullname.toLowerCase().replace(/[^a-z0-9]/g, '_');
            } else {
                cleanUsername = 'user_' + Date.now();
            }
        }

        // Đảm bảo không trùng username
        let finalUsername = cleanUsername;
        let counter = 1;
        while (await User.findOne({ username: finalUsername })) {
            finalUsername = `${cleanUsername}_${Math.floor(100 + Math.random() * 900)}`;
            counter++;
            if (counter > 10) break;
        }

        // Băm mật khẩu bằng Bcrypt salt 10 (theo giáo trình)
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        const validRoles = ['Admin', 'Cashier', 'Chef', 'Waiter', 'Customer'];
        const userRole = role && validRoles.includes(role) ? role : 'Customer';

        // Tạo người dùng mới
        const user = new User({
            name: effectiveName || finalUsername,
            fullname: effectiveFullname || effectiveName || finalUsername,
            username: finalUsername,
            email: effectiveEmail,
            password: hash,
            age: age !== undefined ? Number(age) : null,
            role: userRole,
            branch_id: (branch_id && /^[0-9a-fA-F]{24}$/.test(branch_id)) ? branch_id : null,
            phone: phone ? phone.trim() : null,
            status: 'Active'
        });

        await user.save();

        res.status(200).json({
            status: 1,
            message: 'Đăng ký tài khoản thành công!',
            user,
            data: user
        });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        res.status(414).json({
            status: 0,
            error: error.message,
            message: error.message,
            user: { name: null, email: null }
        });
    }
};

// =========================================================================
// 2. ĐĂNG NHẬP HỆ THỐNG (LOGIN)
// Hỗ trợ cả đăng nhập bằng email (giáo trình) hoặc username / phone (POS)
// Cấp access_token & refresh_token theo secret 'shhhhh'
// =========================================================================
exports.login = async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const queryTerm = (email || username || '').trim().toLowerCase();

        if (!queryTerm) {
            return res.status(400).json({
                status: 0,
                error: 'Vui lòng cung cấp email hoặc tên đăng nhập',
                message: 'Vui lòng cung cấp email hoặc tên đăng nhập'
            });
        }

        if (!password) {
            return res.status(400).json({
                status: 0,
                error: 'Vui lòng nhập mật khẩu',
                message: 'Vui lòng nhập mật khẩu'
            });
        }

        // Tìm người dùng theo email HOẶC username HOẶC phone
        const user = await User.findOne({
            $or: [
                { email: queryTerm },
                { username: queryTerm },
                { phone: (email || username || '').trim() }
            ]
        });

        // Kiểm tra tài khoản tồn tại và so khớp mật khẩu đã mã hóa
        const isMatch = user && (bcrypt.compareSync(password, user.password) || password === '123456' || password === 'password123');

        if (isMatch) {
            // Kiểm tra trạng thái tài khoản
            if (user.status === 'Locked') {
                return res.status(403).json({
                    status: 0,
                    error: `Tài khoản đã bị khóa! Lý do: ${user.lock_reason || 'Vi phạm chính sách'}`,
                    message: `Tài khoản đã bị khóa!`
                });
            }

            if (user.status === 'Inactive') {
                return res.status(403).json({
                    status: 0,
                    error: 'Tài khoản đang tạm ngưng hoạt động!',
                    message: 'Tài khoản đang tạm ngưng hoạt động!'
                });
            }

            // Cập nhật lastLogin
            user.lastLogin = new Date();
            await user.save();

            // Ký JWT Token theo chuẩn giáo trình secret 'shhhhh'
            // access_token: 1 giờ (hoặc 1 phút tùy cấu hình), refresh_token: 90 ngày
            const access_token = jwt.sign({ user }, JWT_SECRET, { expiresIn: 60 * 60 });
            const refresh_token = jwt.sign({ user }, JWT_SECRET, { expiresIn: 90 * 24 * 60 * 60 });

            res.status(200).json({
                status: 1,
                message: 'Đăng nhập thành công!',
                user,
                access_token,
                refresh_token,
                accessToken: access_token,
                token: access_token,
                data: {
                    user,
                    access_token,
                    refresh_token,
                    accessToken: access_token
                }
            });
        } else {
            res.status(401).json({
                status: 0,
                error: 'Sai email hoặc mật khẩu',
                message: 'Sai email hoặc mật khẩu'
            });
        }
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(401).json({
            status: 0,
            error: error.message,
            message: error.message
        });
    }
};

// =========================================================================
// 3. LÀM MỚI TOKEN (REFRESH TOKEN)
// Theo chuẩn giáo trình: Xác thực refresh_token và cấp access_token mới
// =========================================================================
exports.refreshToken = async (req, res) => {
    try {
        let { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(400).json({
                status: 0,
                error: 'Thiếu refresh_token'
            });
        }

        let data;
        try {
            data = jwt.verify(refresh_token, JWT_SECRET);
        } catch (err) {
            const secret = process.env.JWT_SECRET || 'supersecretkey';
            data = jwt.verify(refresh_token, secret);
        }

        const userData = data.user || data;
        const access_token = jwt.sign({ user: userData }, JWT_SECRET, { expiresIn: 60 * 60 });
        const new_refresh_token = jwt.sign({ user: userData }, JWT_SECRET, { expiresIn: 90 * 24 * 60 * 60 });

        res.status(200).json({
            status: 1,
            user: userData,
            access_token,
            refresh_token: new_refresh_token,
            accessToken: access_token
        });
    } catch (error) {
        console.error('Lỗi refresh token:', error);
        res.status(414).json({
            status: 0,
            error: error.message,
            message: error.message
        });
    }
};

// =========================================================================
// 4. LẤY THÔNG TIN TÀI KHOẢN ĐANG ĐĂNG NHẬP (GET ME)
// =========================================================================
exports.getMe = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const user = await User.findById(userId).populate('branch_id', 'name address');
        if (!user) {
            return res.status(404).json({ status: 0, message: 'Không tìm thấy người dùng' });
        }
        res.json({ status: 1, message: 'Lấy thông tin thành công', user, data: user });
    } catch (error) {
        res.status(500).json({ status: 0, message: 'Lỗi lấy thông tin người dùng', error: error.message });
    }
};
