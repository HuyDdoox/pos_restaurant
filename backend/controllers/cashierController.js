const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Shift, Payment, Order, Table, CashTransaction, AuditLog, User } = require('../models');

// Helper an toàn trích xuất ID thu ngân từ JWT token hoặc body
const getCashierId = async (req) => {
    if (req.user && req.user.id) return req.user.id;
    if (req.headers && req.headers['authorization']) {
        try {
            const token = req.headers['authorization'].split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
            if (decoded && decoded.id) return decoded.id;
        } catch (e) {}
    }
    if (req.body && req.body.cashier_id && mongoose.Types.ObjectId.isValid(req.body.cashier_id)) {
        return req.body.cashier_id;
    }
    try {
        const defaultUser = await User.findOne({ role: { $in: ['Cashier', 'Admin'] } });
        if (defaultUser) return defaultUser._id;
    } catch (e) {}
    return null;
};

// ==========================================
// 1. QUẢN LÝ CA LÀM VIỆC (SHIFTS)
// ==========================================

// Lấy thông tin ca làm việc đang mở hiện tại (GET /api/shifts/current)
exports.getCurrentShift = async (req, res) => {
    try {
        const shift = await Shift.findOne({ status: 'Open' })
            .populate('cashier_id', 'fullname username')
            .sort({ createdAt: -1 });

        if (!shift) {
            return res.status(200).json({ status: 1, message: "Hiện không có ca nào đang mở", data: null });
        }
        res.status(200).json({ status: 1, message: "Lấy ca làm việc thành công", data: shift });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy ca", err: error.message });
    }
};

// Lấy chi tiết ca làm việc theo ID (GET /api/shifts/:id)
exports.getShiftById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "ID ca làm việc không hợp lệ!" });
        }
        const shift = await Shift.findById(id).populate('cashier_id', 'fullname username');
        if (!shift) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy ca làm việc!" });
        }
        res.status(200).json({ status: 1, message: "Lấy ca làm việc thành công", data: shift });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy ca", err: error.message });
    }
};

// Lấy danh sách tất cả ca làm việc (GET /api/shifts)
exports.getAllShifts = async (req, res) => {
    try {
        const shifts = await Shift.find().populate('cashier_id', 'fullname username').sort({ createdAt: -1 });
        res.status(200).json({ status: 1, message: "Lấy danh sách ca làm việc thành công", data: shifts });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy danh sách ca", err: error.message });
    }
};

// Mở ca làm việc mới (POST /api/shifts/open)
exports.openShift = async (req, res) => {
    try {
        const { startingCash, branch_id } = req.body;

        if (startingCash === undefined || isNaN(startingCash) || Number(startingCash) < 0) {
            return res.status(400).json({ status: 0, message: "Tiền mặt đầu ca phải là số dương hợp lệ!" });
        }

        // 400: Kiểm tra xem có ca nào đang mở chưa
        const activeShift = await Shift.findOne({ status: 'Open' });
        if (activeShift) {
            return res.status(400).json({ status: 0, message: "Đang có ca làm việc chưa chốt sổ! Vui lòng đóng ca cũ trước." });
        }

        const cashierId = await getCashierId(req);
        if (!cashierId) {
            return res.status(400).json({ status: 0, message: "Thiếu thông tin định danh thu ngân (vui lòng đăng nhập hoặc truyền cashier_id)!" });
        }

        const newShift = await Shift.create({
            cashier_id: cashierId,
            branch_id: branch_id || null,
            startTime: new Date(),
            startingCash: Number(startingCash) || 0,
            status: 'Open'
        });

        // Ghi Audit Log
        await AuditLog.create({
            category: 'financial',
            actor: req.user ? req.user.username : 'Thu ngân',
            action: 'Mở ca làm việc',
            detail: `Mở ca mới với tiền ban đầu: ${Number(startingCash).toLocaleString('vi-VN')} đ`
        }).catch(() => {});

        res.status(201).json({ status: 1, message: "Mở ca làm việc thành công!", data: newShift });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi mở ca", err: error.message });
    }
};

// Đóng ca làm việc & Chốt két (POST /api/shifts/:id/close)
exports.closeShift = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID ca làm việc không hợp lệ!" });
        }

        const shift = await Shift.findById(id);
        if (!shift) return res.status(404).json({ status: 0, message: "Không tìm thấy ca làm việc!" });

        if (shift.status === 'Closed') {
            return res.status(400).json({ status: 0, message: "Ca làm việc này đã được chốt đóng trước đó!" });
        }

        const { actualCash, notes } = req.body;
        if (actualCash === undefined || isNaN(actualCash) || Number(actualCash) < 0) {
            return res.status(400).json({ status: 0, message: "Số tiền mặt thực tế kiểm đếm phải là một số hợp lệ!" });
        }

        // 1. Tính tổng tiền thu/chi két phát sinh trong ca
        const cashTxs = await CashTransaction.find({ 
            $or: [
                { shift_id: shift._id },
                { shift_id: shift._id.toString() }
            ]
        });
        let cashInTotal = 0;
        let cashOutTotal = 0;
        cashTxs.forEach(tx => {
            if (tx.type === 'in' || tx.type === 'CASH_IN') cashInTotal += Number(tx.amount || 0);
            if (tx.type === 'out' || tx.type === 'CASH_OUT') cashOutTotal += Number(tx.amount || 0);
        });

        // 2. Tính tổng tiền mặt thu từ các hóa đơn bán hàng trong ca (Payment Cash)
        const cashPayments = await Payment.find({
            createdAt: { $gte: shift.startTime },
            payment_method: 'Cash',
            status: 'Completed'
        });
        const cashSalesTotal = cashPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        // 3. Cập nhật kết ca chuẩn công thức kế toán:
        // endingCash = Tiền đầu ca + Doanh số tiền mặt + Nạp két - Chi két
        shift.endTime = new Date();
        shift.actualCash = Number(actualCash);
        shift.endingCash = (shift.startingCash || 0) + cashSalesTotal + cashInTotal - cashOutTotal;
        shift.difference = shift.actualCash - shift.endingCash;
        shift.notes = notes ? notes.trim() : '';
        shift.status = 'Closed';
        await shift.save();

        // Ghi Audit Log
        await AuditLog.create({
            category: 'financial',
            actor: req.user ? req.user.username : 'Thu ngân',
            action: 'Chốt ca làm việc',
            detail: `Kết thúc ca. Tiền đếm: ${shift.actualCash.toLocaleString('vi-VN')} đ (Bán mặt: ${cashSalesTotal.toLocaleString('vi-VN')} đ, Lệch: ${shift.difference.toLocaleString('vi-VN')} đ)`,
            severity: shift.difference !== 0 ? 'warning' : 'info'
        }).catch(() => {});

        res.status(200).json({ 
            status: 1, 
            message: "Đóng ca làm việc và chốt sổ thành công!", 
            data: {
                ...shift.toJSON(),
                breakdown: {
                    startingCash: shift.startingCash,
                    cashSalesTotal,
                    cashInTotal,
                    cashOutTotal,
                    endingCash: shift.endingCash,
                    actualCash: shift.actualCash,
                    difference: shift.difference
                }
            } 
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi đóng ca", err: error.message });
    }
};

// ==========================================
// 2. THANH TOÁN HÓA ĐƠN (PAYMENTS)
// ==========================================

// Thu ngân thực hiện thanh toán hóa đơn (POST /api/payments)
exports.processPayment = async (req, res) => {
    try {
        const { order_id, payment_method, amount, customerCash, changeAmount } = req.body;

        if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
            return res.status(400).json({ status: 0, message: "Mã hóa đơn (order_id) không hợp lệ!" });
        }

        const order = await Order.findById(order_id);
        if (!order) return res.status(404).json({ status: 0, message: "Không tìm thấy hóa đơn cần thanh toán!" });

        // 400: Kiểm tra hóa đơn đã thanh toán chưa
        if (order.paymentStatus === 'Paid') {
            return res.status(400).json({ status: 0, message: "Đơn hàng này đã được thanh toán trước đó!" });
        }

        const cashierId = await getCashierId(req);
        if (!cashierId) {
            return res.status(400).json({ status: 0, message: "Thiếu thông tin thu ngân thực hiện thanh toán!" });
        }

        const payMethod = payment_method || 'Cash';
        let normalizedMethod = payMethod;
        if (payMethod === 'Transfer') normalizedMethod = 'Bank_Transfer';
        if (payMethod === 'Card') normalizedMethod = 'Credit_Card';

        const paidAmount = (amount && !isNaN(amount)) ? Number(amount) : order.totalAmount;
        const customerPaid = (customerCash && !isNaN(customerCash)) ? Number(customerCash) : paidAmount;
        const change = (changeAmount !== undefined && !isNaN(changeAmount)) 
            ? Number(changeAmount) 
            : Math.max(0, customerPaid - paidAmount);

        // 1. Tạo bản ghi Payment
        const payment = await Payment.create({
            order_id: order._id,
            cashier_id: cashierId,
            branch_id: order.branch_id || null,
            payment_method: normalizedMethod,
            amount: paidAmount,
            customerCash: customerPaid,
            changeAmount: change,
            status: 'Completed'
        });

        // 2. Cập nhật Order sang Completed & Paid
        order.paymentStatus = 'Paid';
        order.status = 'Completed';
        order.paymentMethod = normalizedMethod;
        await order.save();

        // 3. Giải phóng bàn ăn Table -> Available
        if (order.table_id) {
            await Table.findByIdAndUpdate(order.table_id, {
                status: 'Available',
                currentOrderId: null
            });
        }

        // Ghi Audit Log nếu có chiết khấu
        if (order.discountAmount > 0) {
            await AuditLog.create({
                category: 'financial',
                actor: req.user ? req.user.username : 'Thu ngân',
                action: 'Thanh toán hóa đơn có chiết khấu',
                detail: `Hóa đơn #${order._id} giảm ${order.discountAmount.toLocaleString('vi-VN')} đ. Thu thực: ${order.totalAmount.toLocaleString('vi-VN')} đ`
            }).catch(() => {});
        }

        res.status(200).json({
            status: 1,
            message: "Thanh toán hóa đơn thành công! Bàn đã được dọn sạch.",
            data: { payment, order }
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi thanh toán", err: error.message });
    }
};

// ==========================================
// 3. PHIẾU THU / CHI TIỀN KÉT (CASH IN / OUT)
// ==========================================

// Lấy danh sách phiếu thu/chi trong ca (GET /api/cash-transactions)
exports.getCashTransactions = async (req, res) => {
    try {
        const { shift_id } = req.query;
        let filter = {};
        if (shift_id) {
            if (!mongoose.Types.ObjectId.isValid(shift_id)) {
                return res.status(400).json({ status: 0, message: "Định dạng shift_id không hợp lệ!" });
            }
            filter.shift_id = shift_id;
        }

        const list = await CashTransaction.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ status: 1, message: "Lấy phiếu thu/chi thành công", data: list });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy phiếu thu chi", err: error.message });
    }
};

// Lập phiếu Thu / Chi tiền mặt (POST /api/cash-transactions)
exports.createCashTransaction = async (req, res) => {
    try {
        const { shift_id, type, amount, reason, branch_id } = req.body;

        if (amount === undefined || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ status: 0, message: "Số tiền thu/chi phải lớn hơn 0!" });
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({ status: 0, message: "Vui lòng nhập lý do thu / chi quỹ két!" });
        }

        const cleanType = (type === 'in' || type === 'CASH_IN') ? 'in' : 'out';

        const tx = await CashTransaction.create({
            branch_id: branch_id || null,
            shift_id: (shift_id && mongoose.Types.ObjectId.isValid(shift_id)) ? shift_id : null,
            type: cleanType,
            amount: Number(amount),
            reason: reason.trim(),
            createdBy: req.user ? req.user.username : 'Thu ngân',
            performedBy: req.user ? req.user.fullname : 'Thu ngân'
        });

        // Ghi Audit Log
        const isOut = cleanType === 'out';
        await AuditLog.create({
            category: 'financial',
            actor: req.user ? req.user.username : 'Thu ngân',
            action: isOut ? 'Chi tiền két (Cash Out)' : 'Nạp tiền két (Cash In)',
            detail: `${isOut ? 'Xuất két' : 'Nạp két'}: ${Number(amount).toLocaleString('vi-VN')} đ. Lý do: ${reason.trim()}`,
            severity: isOut ? 'warning' : 'info'
        }).catch(() => {});

        res.status(201).json({
            status: 1,
            message: `Lập phiếu ${isOut ? 'CHI' : 'THU'} tiền két thành công!`,
            data: tx
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lập phiếu", err: error.message });
    }
};
