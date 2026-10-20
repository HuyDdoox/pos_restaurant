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

server.post(['/api/orders', '/orders'], (req, res) => {
    const db = router.db;
    const body = req.body || {};
    const newId = new Date().getTime().toString(16) + Math.random().toString(16).substring(2, 8);
    
    // Format order items
    const rawItems = body.items || [];
    const menuItems = db.get('menu').value() || [];
    const formattedItems = rawItems.map(it => {
        const dish = menuItems.find(m => (m._id === it.menuItem_id || m.id === it.menuItem_id));
        return {
            menuItem_id: it.menuItem_id,
            name: dish ? dish.name : (it.name || 'Món ăn'),
            image: dish ? dish.image : '',
            quantity: it.quantity,
            price: it.price,
            variants_selected: it.variants_selected || [],
            variantNote: it.variantNote || '',
            status: 'Pending',
            createdAt: new Date().toISOString()
        };
    });

    const order = {
        _id: newId,
        id: newId,
        table_id: body.table_id || '6ad6529312edf05c3d3ae3fa',
        customerInfo: body.customerInfo || 'Khách vãng lai',
        customerPhone: body.customerPhone || null,
        status: body.status || 'In_Progress',
        paymentStatus: body.paymentStatus || 'unpaid',
        discountType: body.discountType || 'none',
        discountPercent: body.discountPercent || 0,
        discountAmount: body.discountAmount || 0,
        discountReason: body.discountReason || null,
        notes: body.notes || '',
        items: formattedItems,
        total: (rawItems || []).reduce((s, it) => s + (it.price * it.quantity), 0) - (body.discountAmount || 0),
        totalAmount: (rawItems || []).reduce((s, it) => s + (it.price * it.quantity), 0) - (body.discountAmount || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Save order
    const orders = db.get('orders').value();
    if (orders) {
        orders.push(order);
    } else {
        db.set('orders', [order]).value();
    }

    // Save order-details for tracking
    const orderDetails = db.get('order-details').value() || [];
    formattedItems.forEach(fi => {
        const odId = new Date().getTime().toString(16) + Math.random().toString(16).substring(2, 8);
        orderDetails.push({
            _id: odId,
            id: odId,
            order_id: order._id,
            menuItem_id: fi.menuItem_id,
            name: fi.name,
            quantity: fi.quantity,
            price: fi.price,
            status: 'Pending',
            variantNote: fi.variantNote,
            variants_selected: fi.variants_selected,
            createdAt: new Date().toISOString()
        });
    });

    // Update table status to occupied
    if (order.table_id) {
        const table = db.get('tables').find({ _id: order.table_id }).value() || db.get('tables').find({ id: order.table_id }).value();
        if (table) {
            table.status = 'occupied';
            table.currentOrder_id = order._id;
        }
    }

    db.write();

    return res.status(201).json({
        status: 1,
        message: 'Đặt món thành công',
        data: order
    });
});

server.post(['/api/customers', '/customers'], (req, res) => {
    const db = router.db;
    const body = req.body || {};
    const newId = new Date().getTime().toString(16) + Math.random().toString(16).substring(2, 8);
    const customer = {
        _id: newId,
        id: newId,
        name: body.name || 'Khách Hàng',
        phone: body.phone,
        email: body.email || null,
        tier: body.tier || 'Bronze',
        points: body.points || 0,
        totalSpent: body.totalSpent || 0,
        registeredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const customers = db.get('customers').value() || [];
    customers.push(customer);
    db.write();

    return res.status(201).json({
        status: 1,
        message: 'Đăng ký thành viên thành công',
        data: customer
    });
});

// ========================================================
// 3. API PREFIX STRIPPER (Preserves all query parameters)
// ========================================================
server.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
        req.url = req.url.substring(4); // removes '/api' but preserves path & query string (?q=..., etc.)
    } else if (req.url === '/api') {
        req.url = '/';
    }
    next();
});

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
