const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

const PORT = 3000;

server.use(middlewares);
server.use(jsonServer.bodyParser);

// ========================================================
// 1. CUSTOM AUTH ROUTES (LOGIN, REGISTER, REFRESH-TOKEN)
// ========================================================
server.post(['/api/login', '/login'], (req, res) => {
    const { username, email, password } = req.body;
    const db = router.db;
    const users = db.get('users').value() || [];

    const loginId = (username || email || '').trim().toLowerCase();
    const user = users.find(u => 
        (u.username && u.username.toLowerCase() === loginId) ||
        (u.email && u.email.toLowerCase() === loginId) ||
        (u.phone && u.phone === loginId)
    );

    if (user) {
        // Plain text check or standard demo password '123456'
        const isMatch = user.password === password || password === '123456' || (user.password && user.password.startsWith('$2b$'));
        if (isMatch) {
            return res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công qua JSON-Server!',
                user: {
                    id: user.id || user._id,
                    username: user.username,
                    fullname: user.fullname,
                    role: user.role,
                    email: user.email,
                    branch_id: user.branch_id
                },
                access_token: 'mock-jwt-token-m208-' + Date.now(),
                refresh_token: 'mock-refresh-token-m208-' + Date.now()
            });
        }
    }

    return res.status(401).json({
        success: false,
        error: 'Sai tài khoản hoặc mật khẩu!'
    });
});

server.post(['/api/register', '/register'], (req, res) => {
    const { username, password, fullname, name, role, email, phone } = req.body;
    const db = router.db;
    const users = db.get('users').value() || [];

    const exists = users.some(u => u.username === username || (email && u.email === email));
    if (exists) {
        return res.status(400).json({ error: 'Tài khoản hoặc email đã tồn tại!' });
    }

    const newUser = {
        id: 'U_' + Date.now(),
        _id: '6ad' + Date.now().toString(16).padEnd(21, '0'),
        username,
        password: password || '123456',
        fullname: fullname || name || username,
        role: role || 'Waiter',
        email: email || '',
        phone: phone || '',
        status: 'Active',
        createdAt: new Date().toISOString()
    };

    db.get('users').push(newUser).write();
    return res.status(200).json({ success: true, user: newUser });
});

server.post(['/api/refresh-token', '/refresh-token'], (req, res) => {
    return res.status(200).json({
        access_token: 'mock-refreshed-jwt-token-' + Date.now(),
        refresh_token: 'mock-refreshed-refresh-token-' + Date.now()
    });
});

// ========================================================
// 2. SPECIAL ROUTES (SHIFTS & TABLE OPERATIONS)
// ========================================================
server.get(['/api/shifts/current', '/shifts/current'], (req, res) => {
    const db = router.db;
    const shifts = db.get('shifts').value() || [];
    const openShift = shifts.find(s => s.status === 'OPEN' || s.status === 'open') || shifts[shifts.length - 1];
    return res.status(200).json({
        status: 1,
        message: 'Lấy ca hiện tại thành công',
        data: openShift || null
    });
});

server.post(['/api/shifts/start', '/shifts/start'], (req, res) => {
    const db = router.db;
    const newShift = {
        id: 'SHIFT_' + Date.now(),
        _id: '6ad' + Date.now().toString(16).padEnd(21, '0'),
        shiftCode: 'CA-' + Date.now().toString().slice(-4),
        openedAt: new Date().toISOString(),
        openingCash: req.body.openingCash || 500000,
        status: 'OPEN',
        cashier_id: req.body.cashier_id || 'U_CASHIER'
    };
    db.get('shifts').push(newShift).write();
    return res.status(200).json({ status: 1, data: newShift });
});

server.post(['/api/shifts/end', '/shifts/end'], (req, res) => {
    const db = router.db;
    const shifts = db.get('shifts').value() || [];
    if (shifts.length > 0) {
        const last = shifts[shifts.length - 1];
        last.status = 'CLOSED';
        last.closedAt = new Date().toISOString();
        last.closingCashActual = req.body.closingCashActual || last.openingCash;
        db.write();
        return res.status(200).json({ status: 1, data: last });
    }
    return res.status(200).json({ status: 1, data: null });
});

server.post(['/api/orders/transfer-table', '/orders/transfer-table'], (req, res) => {
    return res.status(200).json({ status: 1, message: 'Chuyển bàn thành công' });
});

server.post(['/api/orders/merge-tables', '/orders/merge-tables'], (req, res) => {
    return res.status(200).json({ status: 1, message: 'Gộp bàn thành công' });
});

server.put(['/api/tables/:id/status', '/tables/:id/status'], (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const db = router.db;
    const table = db.get('tables').find({ id }).value() || db.get('tables').find({ _id: id }).value();
    if (table) {
        table.status = status;
        db.write();
        return res.status(200).json({ status: 1, message: 'Cập nhật trạng thái bàn thành công', data: table });
    }
    return res.status(200).json({ status: 1, message: 'Cập nhật trạng thái thành công' });
});

// ========================================================
// 3. API REWRITER FOR STANDARD JSON-SERVER ROUTES
// ========================================================
server.use(jsonServer.rewriter({
    '/api/menu': '/menu',
    '/api/menu/*': '/menu/$1',
    '/api/categories': '/categories',
    '/api/categories/*': '/categories/$1',
    '/api/orders': '/orders',
    '/api/orders/*': '/orders/$1',
    '/api/order-details': '/order-details',
    '/api/order-details/*': '/order-details/$1',
    '/api/tables': '/tables',
    '/api/tables/*': '/tables/$1',
    '/api/shifts': '/shifts',
    '/api/shifts/*': '/shifts/$1',
    '/api/variants': '/variants',
    '/api/variants/*': '/variants/$1',
    '/api/users': '/users',
    '/api/users/*': '/users/$1',
    '/api/branches': '/branches',
    '/api/branches/*': '/branches/$1',
    '/api/inventory': '/inventory',
    '/api/inventory/*': '/inventory/$1',
    '/api/recipes': '/recipes',
    '/api/recipes/*': '/recipes/$1',
    '/api/cash-transactions': '/cash-transactions',
    '/api/cash-transactions/*': '/cash-transactions/$1',
    '/api/feedbacks': '/feedbacks',
    '/api/feedbacks/*': '/feedbacks/$1',
    '/api/vouchers': '/vouchers',
    '/api/vouchers/*': '/vouchers/$1',
    '/api/customers': '/customers',
    '/api/customers/*': '/customers/$1',
    '/api/audit-logs': '/audit-logs',
    '/api/audit-logs/*': '/audit-logs/$1'
}));

// Use standard JSON Server router
server.use(router);

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 JSON-SERVER (MÔN TSC) ĐANG CHẠY TẠI: http://localhost:${PORT}`);
    console.log(`📦 DATABASE FILE: ${path.join(__dirname, 'db.json')}`);
    console.log(`🌐 CỔNG TÁCH BIỆT:`);
    console.log(`   - JSON-Server : http://localhost:${PORT}`);
    console.log(`   - Frontend Web: http://localhost:5000`);
    console.log(`   - Backend Node: http://localhost:4000 (Không cần bật)`);
    console.log(`=======================================================`);
});
