const mongoose = require('mongoose');
const { Order, OrderDetail, Table, MenuItem, AuditLog, Customer, Voucher } = require('../models');

// ==========================================
// 1. QUẢN LÝ ĐƠN HÀNG (ORDERS)
// ==========================================

// Lấy danh sách đơn hàng
exports.getAllOrders = async (req, res) => {
    try {
        const { paymentStatus, status, table_id, branch_id } = req.query;
        let filter = {};

        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (status) filter.status = status;
        if (table_id) filter.table_id = table_id;
        if (branch_id) filter.branch_id = branch_id;

        const orders = await Order.find(filter)
            .populate('table_id', 'tableNumber zone')
            .populate('waiter_id', 'fullname username')
            .sort({ createdAt: -1 });

        res.json({ status: 1, message: "Lấy danh sách đơn hàng thành công", data: orders });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy đơn hàng", err: error.message });
    }
};

// Chi tiết 1 đơn hàng (kèm các món chi tiết)
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('table_id', 'tableNumber zone')
            .populate('waiter_id', 'fullname');

        if (!order) return res.status(404).json({ status: 0, message: "Không tìm thấy đơn hàng" });

        const details = await OrderDetail.find({ order_id: order._id })
            .populate('menuItem_id', 'name image base_price station');

        res.json({
            status: 1,
            message: "Lấy chi tiết đơn hàng thành công",
            data: {
                ...order.toJSON(),
                items: details
            }
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy chi tiết", err: error.message });
    }
};

// Tạo đơn hàng mới (từ Phục Vụ hoặc Khách quét QR)
exports.createOrder = async (req, res) => {
    try {
        const { table_id, waiter_id, branch_id, customerInfo, items, notes } = req.body;

        // BẮT LỖI 2: Kiểm tra bàn ăn (nếu có truyền table_id)
        let targetTable = null;
        if (table_id) {
            if (!mongoose.Types.ObjectId.isValid(table_id)) {
                return res.status(400).json({ status: 0, message: "Mã bàn (table_id) không đúng định dạng!" });
            }
            targetTable = await Table.findById(table_id);
            if (!targetTable || targetTable.status === 'Archived') {
                return res.status(404).json({ status: 0, message: "Bàn ăn không tồn tại hoặc đã ngừng hoạt động!" });
            }
        }

        // Cho phép mở bàn / tạo đơn trước khi gọi món (nếu items rỗng hoặc undefined)
        if (!items || !Array.isArray(items) || items.length === 0) {
            const newOrder = await Order.create({
                table_id: table_id || null,
                waiter_id: waiter_id || (req.user ? req.user.id : null),
                branch_id: branch_id || null,
                customerInfo: customerInfo || (targetTable ? `Khách bàn ${targetTable.tableNumber}` : 'Khách tại bàn'),
                subtotal: 0,
                totalAmount: 0,
                notes: notes || '',
                status: req.body.status || 'In_Progress',
                paymentStatus: req.body.paymentStatus || 'Unpaid'
            });

            if (table_id) {
                await Table.findByIdAndUpdate(table_id, {
                    status: 'Occupied',
                    currentOrderId: newOrder._id
                });
            }

            return res.status(201).json({
                status: 1,
                message: "Tạo đơn hàng thành công!",
                data: newOrder
            });
        }

        // BẮT LỖI 3: Kiểm tra định dạng ID các món ăn
        const itemIds = items.map(it => it.menuItem_id).filter(id => id && mongoose.Types.ObjectId.isValid(id));
        if (itemIds.length !== items.length) {
            return res.status(400).json({ status: 0, message: "Có món ăn mang mã định danh (menuItem_id) không hợp lệ!" });
        }

        // BẮT LỖI 4 & BẢO MẬT: Tra cứu thông tin món trong DB và tính giá Server-side
        const menuItemsFromDB = await MenuItem.find({ _id: { $in: itemIds } });
        const menuMap = new Map();
        menuItemsFromDB.forEach(m => menuMap.set(m._id.toString(), m));

        let calculatedSubtotal = 0;
        const validatedDetails = [];

        for (const it of items) {
            const dish = menuMap.get(it.menuItem_id.toString());
            if (!dish) {
                return res.status(404).json({ status: 0, message: `Món ăn có mã [${it.menuItem_id}] không tồn tại trên thực đơn!` });
            }

            // Kiểm tra trạng thái món (Out_of_stock hoặc Archived)
            if (dish.status === 'Out_of_stock') {
                return res.status(400).json({ status: 0, message: `Món [${dish.name}] hiện đã hết hàng, vui lòng chọn món khác!` });
            }
            if (dish.status === 'Archived') {
                return res.status(400).json({ status: 0, message: `Món [${dish.name}] đã ngừng phục vụ!` });
            }

            const qty = Math.max(1, parseInt(it.quantity) || 1);
            
            // KIỂM TRA FLASH SALE GIỜ VÀNG
            const now = new Date();
            let unitPrice = Number(dish.base_price || 0);

            if (dish.is_flash_sale && 
                dish.sale_price > 0 && 
                dish.flash_sale_start && 
                dish.flash_sale_end &&
                now >= new Date(dish.flash_sale_start) && 
                now <= new Date(dish.flash_sale_end)) {
                
                const remainingLimit = dish.flash_sale_limit > 0 ? (dish.flash_sale_limit - (dish.flash_sale_sold || 0)) : 999999;
                if (remainingLimit >= qty) {
                    unitPrice = Number(dish.sale_price);
                    // Cập nhật số suất đã bán
                    dish.flash_sale_sold = (dish.flash_sale_sold || 0) + qty;
                    await dish.save();
                }
            }

            // Cộng thêm phụ thu từ các biến thể đã chọn
            let variantIds = [];
            let variantNames = [];
            if (it.variants_selected && Array.isArray(it.variants_selected)) {
                for (const vItem of it.variants_selected) {
                    if (typeof vItem === 'object' && vItem._id) {
                        variantIds.push(vItem._id);
                        if (vItem.extra_price) unitPrice += Number(vItem.extra_price);
                        if (vItem.name) variantNames.push(vItem.name);
                    } else if (mongoose.Types.ObjectId.isValid(vItem)) {
                        variantIds.push(vItem);
                    }
                }
            } else if (it.variant_id && mongoose.Types.ObjectId.isValid(it.variant_id)) {
                variantIds.push(it.variant_id);
            }

            // Nếu client truyền đơn giá đã có phụ thu và lớn hơn giá base
            if (it.price && Number(it.price) > unitPrice) {
                unitPrice = Number(it.price);
            }

            const unitCost = Number(dish.cost_price || 0);
            calculatedSubtotal += unitPrice * qty;

            const combinedNote = [it.variantNote, it.note, it.notes, variantNames.join(', ')].filter(Boolean).join(' | ');

            validatedDetails.push({
                menuItem_id: dish._id,
                variants_selected: variantIds,
                variantNote: combinedNote || (dish.is_combo ? 'Set Menu' : ''),
                notes: combinedNote || (dish.is_combo ? 'Set Menu' : ''),
                quantity: qty,
                priceAtOrder: unitPrice,
                costAtOrder: unitCost,
                is_combo: Boolean(dish.is_combo),
                combo_items: (dish.is_combo && Array.isArray(dish.combo_items)) ? dish.combo_items : [],
                station: dish.station || it.station || 'hot',
                status: it.status || 'Pending'
            });
        }

        // Kiểm tra bàn này đã có đơn mở chưa (để gộp món gọi thêm vào cùng 1 đơn)
        let activeOrder = null;
        if (table_id) {
            activeOrder = await Order.findOne({
                table_id,
                paymentStatus: 'Unpaid',
                status: { $nin: ['Completed', 'Cancelled'] }
            });
        }

        // Tích hợp chiết khấu hội viên / khuyến mãi
        const discountType = req.body.discountType || 'none';
        const discountPercent = Number(req.body.discountPercent) || 0;
        let discountAmount = Number(req.body.discountAmount) || 0;
        const discountReason = req.body.discountReason || null;
        const voucherCode = req.body.voucherCode || null;
        const customerPhone = req.body.customerPhone || null;

        if (discountType === 'percent' && discountPercent > 0) {
            discountAmount = Math.round((calculatedSubtotal * discountPercent) / 100);
        }
        const finalTotal = Math.max(0, calculatedSubtotal - discountAmount);

        if (activeOrder) {
            // Đã có đơn đang mở -> Gộp các món mới vào đơn hiện tại
            const detailDocs = validatedDetails.map(it => ({
                ...it,
                order_id: activeOrder._id
            }));
            await OrderDetail.insertMany(detailDocs);

            activeOrder.subtotal = (Number(activeOrder.subtotal) || 0) + calculatedSubtotal;
            if (activeOrder.discountType === 'percent' && activeOrder.discountPercent > 0) {
                activeOrder.discountAmount = Math.round((activeOrder.subtotal * activeOrder.discountPercent) / 100);
                activeOrder.totalAmount = Math.max(0, activeOrder.subtotal - activeOrder.discountAmount);
            } else if (discountType === 'percent' && discountPercent > 0) {
                activeOrder.discountType = 'percent';
                activeOrder.discountPercent = discountPercent;
                activeOrder.discountReason = discountReason;
                activeOrder.discountAmount = Math.round((activeOrder.subtotal * discountPercent) / 100);
                activeOrder.totalAmount = Math.max(0, activeOrder.subtotal - activeOrder.discountAmount);
            } else {
                activeOrder.totalAmount = (Number(activeOrder.totalAmount) || 0) + calculatedSubtotal;
            }

            if (notes) {
                activeOrder.notes = activeOrder.notes ? `${activeOrder.notes}; ${notes}` : notes;
            }
            if (customerInfo && (!activeOrder.customerInfo || activeOrder.customerInfo.startsWith('Khách bàn'))) {
                activeOrder.customerInfo = customerInfo;
            }
            await activeOrder.save();

            // Tích điểm hội viên nếu có SĐT
            if (customerPhone) {
                try {
                    const cust = await Customer.findOne({ phone: String(customerPhone).trim() });
                    if (cust) {
                        const pointsGained = Math.floor(calculatedSubtotal / 10000);
                        cust.points = (Number(cust.points) || 0) + pointsGained;
                        cust.totalSpent = (Number(cust.totalSpent) || 0) + calculatedSubtotal;
                        cust.lastVisit = new Date();
                        if (cust.totalSpent >= 10000000) cust.tier = 'Diamond';
                        else if (cust.totalSpent >= 4000000) cust.tier = 'Gold';
                        else if (cust.totalSpent >= 1500000) cust.tier = 'Silver';
                        await cust.save();
                    }
                } catch (e) {}
            }

            return res.status(200).json({
                status: 1,
                message: "Đã thêm món vào đơn hàng hiện tại của bàn thành công!",
                data: activeOrder
            });
        }

        // Tích điểm hội viên cho đơn mới
        if (customerPhone) {
            try {
                const cust = await Customer.findOne({ phone: String(customerPhone).trim() });
                if (cust) {
                    const pointsGained = Math.floor(finalTotal / 10000);
                    cust.points = (Number(cust.points) || 0) + pointsGained;
                    cust.totalSpent = (Number(cust.totalSpent) || 0) + finalTotal;
                    cust.lastVisit = new Date();
                    if (cust.totalSpent >= 10000000) cust.tier = 'Diamond';
                    else if (cust.totalSpent >= 4000000) cust.tier = 'Gold';
                    else if (cust.totalSpent >= 1500000) cust.tier = 'Silver';
                    await cust.save();
                }
            } catch (errCust) {
                console.warn('Lỗi tích điểm hội viên:', errCust.message);
            }
        }

        // 1. Tạo bản ghi Order mới với tổng tiền tính toán từ Server
        const newOrder = await Order.create({
            table_id: table_id || null,
            waiter_id: waiter_id || (req.user ? req.user.id : null),
            branch_id: branch_id || null,
            customerInfo: customerInfo || (targetTable ? `Khách bàn ${targetTable.tableNumber}` : 'Khách tại bàn'),
            subtotal: calculatedSubtotal,
            discountType,
            discountPercent,
            discountAmount,
            discountReason,
            voucherCode,
            totalAmount: finalTotal,
            notes: notes || '',
            status: req.body.status || 'In_Progress',
            paymentStatus: 'Unpaid'
        });

        // 2. Tạo các OrderDetail cho từng món
        const detailDocs = validatedDetails.map(it => ({
            ...it,
            order_id: newOrder._id
        }));
        await OrderDetail.insertMany(detailDocs);

        // 3. Cập nhật trạng thái Bàn thành Occupied
        if (table_id) {
            await Table.findByIdAndUpdate(table_id, {
                status: 'Occupied',
                currentOrderId: newOrder._id
            });
        }

        res.status(201).json({
            status: 1,
            message: "Tạo đơn hàng thành công!",
            data: newOrder
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo đơn hàng", err: error.message });
    }
};

// Cập nhật đơn hàng (áp dụng giảm giá, voucher, VAT, cập nhật trạng thái đơn)
exports.updateOrder = async (req, res) => {
    try {
        const updated = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ status: 0, message: "Không tìm thấy đơn hàng" });

        // Tự động giải phóng bàn ăn khi đơn chuyển sang Hoàn thành (Completed) hoặc Hủy (Cancelled)
        if (updated.status === 'Completed' || updated.status === 'Cancelled') {
            if (updated.table_id) {
                await Table.findByIdAndUpdate(updated.table_id, {
                    status: 'Available',
                    currentOrderId: null
                });
            }
        }

        // Tự động tăng lượt sử dụng voucher khi đơn thanh toán thành công
        if ((updated.status === 'Completed' || updated.paymentStatus === 'Paid') && updated.voucherCode) {
            try {
                await Voucher.findOneAndUpdate(
                    { code: updated.voucherCode.trim().toUpperCase() },
                    { $inc: { usedCount: 1 } }
                );
            } catch (vErr) {
                console.warn("Không thể cập nhật usedCount cho voucher:", vErr.message);
            }
        }

        res.json({ status: 1, message: "Cập nhật đơn hàng thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật đơn hàng", err: error.message });
    }
};

// ==========================================
// 2. QUẢN LÝ BẾP KDS & CHI TIẾT MÓN (ORDER DETAILS)
// ==========================================

// Lấy danh sách chi tiết món (OrderDetails) hỗ trợ lọc theo order_id, status
exports.getAllOrderDetails = async (req, res) => {
    try {
        const { order_id, status, station } = req.query;
        let filter = {};
        if (order_id) {
            if (mongoose.Types.ObjectId.isValid(order_id)) {
                filter.order_id = new mongoose.Types.ObjectId(order_id);
            } else {
                filter.order_id = order_id;
            }
        }
        if (status) {
            if (status.includes(',')) {
                const list = status.split(',').map(s => s.trim());
                filter.status = { $in: list.map(s => new RegExp(`^${s}$`, 'i')) };
            } else {
                filter.status = new RegExp(`^${status}$`, 'i');
            }
        }
        if (station && station !== 'all') filter.station = station;

        const details = await OrderDetail.find(filter)
            .populate({
                path: 'order_id',
                select: 'table_id customerInfo createdAt notes',
                populate: { path: 'table_id', select: 'tableNumber zone status' }
            })
            .populate('menuItem_id', 'name image station base_price')
            .sort({ createdAt: -1 });

        res.json({ status: 1, message: "Lấy chi tiết đơn hàng thành công", data: details });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi chi tiết", err: error.message });
    }
};

// Thêm 1 món ăn vào đơn hàng (POST /api/order-details)
exports.createOrderDetail = async (req, res) => {
    try {
        const { 
            order_id, menuItem_id, quantity, priceAtOrder, 
            notes, variantNote, variants_selected, 
            status, incidentNote, is_combo, combo_items, station 
        } = req.body;

        if (!order_id || !menuItem_id) {
            return res.status(400).json({ status: 0, message: "order_id và menuItem_id là bắt buộc!" });
        }

        const dish = await MenuItem.findById(menuItem_id);
        if (!dish) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy món ăn trên thực đơn!" });
        }

        const qty = Math.max(1, parseInt(quantity) || 1);
        const finalPrice = priceAtOrder !== undefined ? Number(priceAtOrder) : Number(dish.base_price || 0);
        const finalCost = Number(dish.cost_price || 0);

        const newDetail = await OrderDetail.create({
            order_id,
            menuItem_id,
            quantity: qty,
            priceAtOrder: finalPrice,
            costAtOrder: finalCost,
            variantNote: variantNote || notes || '',
            notes: notes || variantNote || '',
            variants_selected: variants_selected || [],
            is_combo: Boolean(is_combo !== undefined ? is_combo : dish.is_combo),
            combo_items: (combo_items && Array.isArray(combo_items)) ? combo_items : ((dish.is_combo && Array.isArray(dish.combo_items)) ? dish.combo_items : []),
            station: station || dish.station || 'hot',
            status: status || 'Pending',
            incidentNote: incidentNote || null
        });

        // Tự động tính toán lại tổng tiền của Order
        const order = await Order.findById(order_id);
        if (order) {
            const activeItems = await OrderDetail.find({
                order_id: order._id,
                status: { $ne: 'Cancelled' }
            });
            const newSubtotal = activeItems.reduce((sum, it) => sum + (Number(it.priceAtOrder || 0) * Number(it.quantity || 1)), 0);
            order.subtotal = newSubtotal;
            order.totalAmount = newSubtotal;
            if (order.status === 'Pending' || !order.status) {
                order.status = 'In_Progress';
            }
            await order.save();
        }

        res.status(201).json({
            status: 1,
            message: "Thêm món vào đơn thành công!",
            data: newDetail
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi thêm món vào đơn", err: error.message });
    }
};

// Chi tiết 1 OrderDetail theo ID
exports.getOrderDetailById = async (req, res) => {
    try {
        const item = await OrderDetail.findById(req.params.id)
            .populate('order_id')
            .populate('menuItem_id');
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy chi tiết món" });
        res.json({ status: 1, message: "Thành công", data: item });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// Cập nhật OrderDetail (PATCH /api/order-details/:id)
exports.updateOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (updateData.status === 'Ready') updateData.cookedAt = new Date();
        if (updateData.status === 'Served') updateData.servedAt = new Date();

        const updated = await OrderDetail.findByIdAndUpdate(id, updateData, { new: true });
        if (!updated) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy chi tiết món" });
        }

        // Tự động tính lại tổng tiền Order nếu có thay đổi số lượng, giá hoặc hủy món
        if (updateData.quantity !== undefined || updateData.priceAtOrder !== undefined || updateData.status === 'Cancelled') {
            const order = await Order.findById(updated.order_id);
            if (order) {
                const activeItems = await OrderDetail.find({
                    order_id: order._id,
                    status: { $ne: 'Cancelled' }
                });
                const newSubtotal = activeItems.reduce((sum, it) => sum + (Number(it.priceAtOrder || 0) * Number(it.quantity || 1)), 0);
                order.subtotal = newSubtotal;
                order.totalAmount = newSubtotal;
                await order.save();
            }
        }

        res.json({
            status: 1,
            message: "Cập nhật chi tiết món thành công!",
            data: updated
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật chi tiết món", err: error.message });
    }
};

// Xóa 1 OrderDetail (DELETE /api/order-details/:id)
exports.deleteOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await OrderDetail.findByIdAndDelete(id);
        if (!item) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy chi tiết món" });
        }

        // Cập nhật lại tổng tiền đơn hàng
        const order = await Order.findById(item.order_id);
        if (order) {
            const activeItems = await OrderDetail.find({
                order_id: order._id,
                status: { $ne: 'Cancelled' }
            });
            const newSubtotal = activeItems.reduce((sum, it) => sum + (Number(it.priceAtOrder || 0) * Number(it.quantity || 1)), 0);
            order.subtotal = newSubtotal;
            order.totalAmount = newSubtotal;
            await order.save();
        }

        res.json({
            status: 1,
            message: "Xóa chi tiết món thành công!"
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa chi tiết món", err: error.message });
    }
};

// Lấy danh sách món đang chế biến cho Màn hình Bếp (KDS)
exports.getKitchenQueue = async (req, res) => {
    try {
        const { station } = req.query;
        let filter = { status: { $in: ['Pending', 'Cooking', 'Ready'] } };
        if (station && station !== 'all') filter.station = station;

        const queue = await OrderDetail.find(filter)
            .populate({
                path: 'order_id',
                select: 'table_id customerInfo createdAt notes',
                populate: { path: 'table_id', select: 'tableNumber zone status' }
            })
            .populate('menuItem_id', 'name image station')
            .sort({ isRush: -1, createdAt: 1 });

        res.json({ status: 1, message: "Lấy hàng đợi bếp thành công", data: queue });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi KDS", err: error.message });
    }
};

// Bếp cập nhật trạng thái món (Pending -> Cooking -> Ready -> Served)
exports.updateItemStatus = async (req, res) => {
    try {
        const { status } = req.body; // 'Cooking' | 'Ready' | 'Served' | 'Cancelled'
        const validStatuses = ['Pending', 'Cooking', 'Ready', 'Served', 'Cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ status: 0, message: `Trạng thái [${status}] không hợp lệ! Cho phép: ${validStatuses.join(', ')}` });
        }

        const item = await OrderDetail.findById(req.params.id);
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món" });

        item.status = status;
        if (status === 'Ready') item.cookedAt = new Date();
        if (status === 'Served') item.servedAt = new Date();
        await item.save();

        res.json({ status: 1, message: `Món đã chuyển trạng thái [${status}]`, data: item });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi đổi trạng thái món", err: error.message });
    }
};

// Giục bếp khẩn cấp cho món ăn (Rush Order)
exports.rushItem = async (req, res) => {
    try {
        const item = await OrderDetail.findById(req.params.id);
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món" });

        item.isRush = true;
        await item.save();

        res.json({ status: 1, message: "Đã đánh dấu giục bếp ưu tiên cao!", data: item });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// Hủy món do sự cố (Ghi nhận incidentNote và tự động trừ tiền khỏi hóa đơn theo BRD Waiter 1.3)
exports.cancelItem = async (req, res) => {
    try {
        const { incidentNote } = req.body;
        const item = await OrderDetail.findById(req.params.id);
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món" });

        if (item.status === 'Cancelled') {
            return res.status(400).json({ status: 0, message: "Món này đã bị hủy trước đó!" });
        }

        item.status = 'Cancelled';
        item.incidentNote = incidentNote || 'Khách hủy món';
        await item.save();

        // 1. Tự động tính toán lại hóa đơn Order (Trừ tiền món bị hủy)
        let order = await Order.findById(item.order_id);
        if (order) {
            const activeItems = await OrderDetail.find({
                order_id: order._id,
                status: { $ne: 'Cancelled' }
            });

            const newSubtotal = activeItems.reduce((sum, it) => sum + (Number(it.priceAtOrder || 0) * Number(it.quantity || 1)), 0);
            order.subtotal = newSubtotal;
            order.totalAmount = newSubtotal;

            // Nếu toàn bộ các món trong đơn đều bị hủy -> Chuyển đơn sang Cancelled và giải phóng bàn
            if (activeItems.length === 0) {
                order.status = 'Cancelled';
                if (order.table_id) {
                    await Table.findByIdAndUpdate(order.table_id, {
                        status: 'Available',
                        currentOrderId: null
                    });
                }
            }
            await order.save();
        }

        // 2. Ghi Audit Log kiểm toán
        await AuditLog.create({
            category: 'order',
            actor: req.user ? req.user.username : 'Nhân viên',
            action: 'Hủy món ăn',
            detail: `Hủy món phần #${item._id}. Lý do: ${item.incidentNote}. Hóa đơn mới: ${order ? order.totalAmount : 0}đ`,
            severity: 'danger'
        }).catch(() => {});

        res.json({ 
            status: 1, 
            message: "Đã hủy món thành công và tự động trừ tiền khỏi hóa đơn!", 
            data: { 
                item, 
                orderTotal: order ? order.totalAmount : 0, 
                orderStatus: order ? order.status : 'Cancelled' 
            } 
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi hủy món", err: error.message });
    }
};

// Xóa toàn bộ đơn hàng (DELETE /api/orders/:id)
exports.deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) return res.status(404).json({ status: 0, message: "Không tìm thấy đơn hàng" });
        await OrderDetail.deleteMany({ order_id: order._id });
        if (order.table_id) {
            await Table.findByIdAndUpdate(order.table_id, {
                status: 'Available',
                currentOrderId: null
            });
        }
        res.json({ status: 1, message: "Xóa đơn hàng thành công" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa đơn hàng", err: error.message });
    }
};
