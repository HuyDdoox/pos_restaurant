const jwt = require('jsonwebtoken');

const authen = async (req, res, next) => {
    try {
        if (req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                return res.status(401).json({ error: 'Token không hợp lệ' });
            }
            let data;
            try {
                data = jwt.verify(token, 'shhhhh');
            } catch (err) {
                const secret = process.env.JWT_SECRET || 'supersecretkey';
                data = jwt.verify(token, secret);
            }
            req.user = data.user || data;
            next();
        } else {
            return res.status(401).json({ error: 'Chưa cung cấp token xác thực (Authorization header)' });
        }
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }
};

module.exports = authen;
