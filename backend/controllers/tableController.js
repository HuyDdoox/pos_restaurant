const mongoose = require('mongoose');
const { Table, Order } = require('../models');

// 1. Lấy danh sách bàn (lọc theo chi nhánh, khu vực/zone, trạng thái)
exports.getAllTables = async (req, res) => {
    try {
        const { branch_id, zone, status } = req.query;
        let filter = {};

        if (status) {
            filter.status = status;
        } else {
            filter.status = { $ne: 'Archived' };
        }

        if (branch_id) filter.$or = [{ branch_id }, { branch_id: null }];
        if (zone) filter.zone = zone;

        const tables = await Table.find(filter)
            .populate('currentOrderId', 'totalAmount status createdAt')
            .sort({ tableNumber: 1 });

        // 200: Thành công
        res.status(200).json({ status: 1, message: "Lấy sơ đồ bàn thành công", data: tables });
    } catch (error) {
        // 500: Lỗi Server
        res.status(500).json({ status: 0, message: "Lỗi lấy sơ đồ bàn", err: error.message });
    }
};

// 2. Chi tiết 1 bàn kèm đơn hàng hiện tại
exports.getTableById = async (req, res) => {
    try {
        const { id } = req.params;

        // 400: Kiểm tra định dạng ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID bàn ăn không hợp lệ!" });
        }

        const table = await Table.findById(id).populate('currentOrderId');
        // 404: Không tìm thấy
        if (!table) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy bàn ăn!" });
        }

        res.status(200).json({ status: 1, message: "Lấy chi tiết bàn thành công", data: table });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi máy chủ", err: error.message });
    }
};

// 3. Tạo bàn mới
exports.createTable = async (req, res) => {
    try {
        const { tableNumber, max_capacity, zone, branch_id, status } = req.body;

        // 400: Kiểm tra số bàn
        if (tableNumber === undefined || tableNumber === null || String(tableNumber).trim() === '') {
            return res.status(400).json({ status: 0, message: "Số bàn (mã bàn) không được để trống!" });
        }

        const cleanTableNumber = String(tableNumber).trim();

        // 409: Kiểm tra trùng số bàn
        const duplicateTable = await Table.findOne({ tableNumber: cleanTableNumber });
        if (duplicateTable) {
            return res.status(409).json({ status: 0, message: `Bàn [${cleanTableNumber}] đã tồn tại trong sơ đồ!` });
        }

        const newTable = await Table.create({
            tableNumber: cleanTableNumber,
            max_capacity: (max_capacity && !isNaN(max_capacity)) ? Number(max_capacity) : 4,
            zone: zone ? zone.trim() : 'Tầng 1',
            branch_id: branch_id || null,
            status: status || 'Available'
        });

        // 201: Tạo thành công
        res.status(201).json({ status: 1, message: "Tạo bàn mới thành công!", data: newTable });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo bàn", err: error.message });
    }
};

// 4. Cập nhật thông tin / trạng thái bàn
exports.updateTable = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID bàn ăn không hợp lệ!" });
        }

        const table = await Table.findById(id);
        if (!table) return res.status(404).json({ status: 0, message: "Không tìm thấy bàn để cập nhật!" });

        const { tableNumber, max_capacity, zone, branch_id, status } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng số bàn (loại trừ chính id đang sửa)
        if (tableNumber !== undefined && tableNumber !== null && String(tableNumber).trim() !== '') {
            const cleanNumber = String(tableNumber).trim();
            const duplicate = await Table.findOne({ tableNumber: cleanNumber, _id: { $ne: id } });
            if (duplicate) {
                return res.status(409).json({ status: 0, message: `Số bàn [${cleanNumber}] đã được sử dụng!` });
            }
            updateData.tableNumber = cleanNumber;
        }

        if (max_capacity !== undefined) updateData.max_capacity = Number(max_capacity);
        if (zone !== undefined) updateData.zone = zone.trim();
        if (branch_id !== undefined) updateData.branch_id = branch_id;
        if (status !== undefined) updateData.status = status;
        if (req.body.current_pax !== undefined) updateData.current_pax = Number(req.body.current_pax);
        if (req.body.merged_with !== undefined) updateData.merged_with = req.body.merged_with;
        if (req.body.currentOrderId !== undefined) updateData.currentOrderId = req.body.currentOrderId;

        const updated = await Table.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: 1, message: "Cập nhật bàn thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật bàn", err: error.message });
    }
};

// Đổi trạng thái bàn (PATCH /api/tables/:id/status)
exports.changeTableStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID bàn ăn không hợp lệ!" });
        }

        const table = await Table.findById(id);
        if (!table) return res.status(404).json({ status: 0, message: "Không tìm thấy bàn!" });

        const { status } = req.body;
        let newStatus;
        if (status) {
            newStatus = status;
        } else {
            // Tự động toggle: Nếu Available -> Maintenance (tạm khóa sửa chữa)
            newStatus = table.status === 'Available' ? 'Maintenance' : 'Available';
        }

        table.status = newStatus;
        await table.save();

        res.status(200).json({ status: 1, message: `Bàn [${table.tableNumber}] chuyển sang trạng thái: [${newStatus}]`, data: table });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi đổi trạng thái bàn", err: error.message });
    }
};

// 5. Chuyển bàn / Đổi bàn (Nghiệp vụ cốt lõi của Thu Ngân & Waiter)
exports.transferTable = async (req, res) => {
    try {
        const srcId = req.body.sourceTableId || req.body.fromTableId || req.body.from_table_id;
        const tgtId = req.body.targetTableId || req.body.toTableId || req.body.to_table_id;

        if (!srcId || !tgtId) {
            return res.status(400).json({ status: 0, message: "Vui lòng chọn đầy đủ bàn nguồn và bàn đích!" });
        }

        if (!mongoose.Types.ObjectId.isValid(srcId) || !mongoose.Types.ObjectId.isValid(tgtId)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID bàn không hợp lệ!" });
        }

        const sourceTable = await Table.findById(srcId);
        const targetTable = await Table.findById(tgtId);

        if (!sourceTable || !targetTable) {
            return res.status(404).json({ status: 0, message: "Bàn nguồn hoặc bàn đích không tồn tại!" });
        }

        // Bàn đích phải đang trống
        if (targetTable.status !== 'Available') {
            return res.status(400).json({ status: 0, message: `Bàn đích [${targetTable.tableNumber}] hiện không trống (đang ${targetTable.status})!` });
        }

        // Tìm đơn hàng chưa thanh toán của bàn nguồn
        const order = await Order.findOne({ 
            table_id: sourceTable._id, 
            paymentStatus: 'Unpaid',
            status: { $nin: ['Completed', 'Cancelled'] }
        });

        if (!order) {
            return res.status(400).json({ status: 0, message: "Bàn nguồn hiện không có đơn hàng nào đang phục vụ!" });
        }

        // Chuyển đơn sang bàn đích
        order.table_id = targetTable._id;
        order.transferredFromTable = sourceTable.tableNumber;
        await order.save();

        // Cập nhật trạng thái 2 bàn
        sourceTable.status = 'Available';
        sourceTable.currentOrderId = null;
        await sourceTable.save();

        targetTable.status = 'Occupied';
        targetTable.currentOrderId = order._id;
        await targetTable.save();

        res.status(200).json({
            status: 1,
            message: `Chuyển đơn từ [${sourceTable.tableNumber}] sang [${targetTable.tableNumber}] thành công!`,
            data: { order, sourceTable, targetTable }
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi chuyển bàn", err: error.message });
    }
};

// 6. Xóa bàn
exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID bàn ăn không hợp lệ!" });
        }

        const deleted = await Table.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy bàn!" });

        res.status(200).json({ status: 1, message: "Xóa bàn thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa bàn", err: error.message });
    }
};
