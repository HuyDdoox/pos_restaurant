const jwt = require('jsonwebtoken');

// 1. Middleware kiểm tra Token đăng nhập (JWT)
const verifyToken = (req, res, next) => {
    try {
        // Lấy token từ header Authorization: "Bearer <token>"
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ status: 0, message: "Vui lòng đăng nhập để tiếp tục!" });
        }

        // Xác thực token (hỗ trợ cả secret giáo trình 'shhhhh' và process.env.JWT_SECRET)
        let decodedUser;
        try {
            decodedUser = jwt.verify(token, 'shhhhh');
        } catch (e) {
            const secretKey = process.env.JWT_SECRET || 'supersecretkey';
            decodedUser = jwt.verify(token, secretKey);
        }
        req.user = decodedUser.user || decodedUser;
        next();
    } catch (error) {
        return res.status(500).json({ status: 0, message: "Lỗi xác thực người dùng", err: error.message });
    }
};

// 2. Middleware phân quyền theo vai trò (RBAC: Admin, Cashier, Waiter, Chef)
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                status: 0, 
                message: `Quyền truy cập bị từ chối! Yêu cầu vai trò: [${allowedRoles.join(', ')}]` 
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    checkRole
};
