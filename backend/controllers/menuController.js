const mongoose = require('mongoose');
const { Category, MenuItem, Variant, Recipe } = require('../models');

// ==========================================
// 1. QUẢN LÝ DANH MỤC (CATEGORIES)
// ==========================================

// Lấy danh sách danh mục (GET /api/categories)
exports.getAllCategories = async (req, res) => {
    try {
        const { branch_id, status } = req.query;
        let filter = {};

        if (status) {
            filter.status = status;
        } else {
            filter.status = { $ne: 'Archived' };
        }

        if (branch_id) filter.$or = [{ branch_id }, { branch_id: null }];

        const categories = await Category.find(filter).sort({ displayOrder: 1, createdAt: 1 });
        // 200: Xử lý thành công
        res.status(200).json({ status: 1, message: "Lấy danh mục thành công", data: categories });
    } catch (error) {
        // 500: Lỗi Server
        res.status(500).json({ status: 0, message: "Lỗi lấy danh mục", err: error.message });
    }
};

// Lấy chi tiết 1 danh mục theo ID (GET /api/categories/:id)
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        // 400: Kiểm tra định dạng ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID danh mục không hợp lệ!" });
        }

        const category = await Category.findById(id);
        // 404: Không tìm thấy
        if (!category) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy danh mục!" });
        }

        res.status(200).json({ status: 1, message: "Lấy chi tiết danh mục thành công", data: category });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi máy chủ", err: error.message });
    }
};

// Tạo danh mục mới (POST /api/categories)
exports.createCategory = async (req, res) => {
    try {
        const { name, description, icon, displayOrder, branch_id, status } = req.body;

        // 400: Kiểm tra rỗng
        if (!name || !name.trim()) {
            return res.status(400).json({ status: 0, message: "Tên danh mục không được để trống!" });
        }

        const cleanName = name.trim();

        // 409: Kiểm tra trùng tên danh mục
        const existingCategory = await Category.findOne({ name: cleanName });
        if (existingCategory) {
            return res.status(409).json({ status: 0, message: "Tên danh mục đã tồn tại trong hệ thống!" });
        }

        const newCat = await Category.create({ 
            name: cleanName, 
            description: description ? description.trim() : '', 
            icon: icon || 'fa-utensils', 
            displayOrder: Number(displayOrder) || 0, 
            branch_id: branch_id || null,
            status: status || 'Active'
        });

        // 201: Tạo mới thành công
        res.status(201).json({ status: 1, message: "Tạo danh mục thành công!", data: newCat });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo danh mục", err: error.message });
    }
};

// Sửa danh mục (PUT /api/categories/:id)
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID danh mục không hợp lệ!" });
        }

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ status: 0, message: "Không tìm thấy danh mục để cập nhật!" });
        }

        const { name, description, icon, displayOrder, branch_id, status } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng tên với danh mục khác (loại trừ chính id đang sửa)
        if (name && name.trim()) {
            const cleanName = name.trim();
            const duplicate = await Category.findOne({ name: cleanName, _id: { $ne: id } });
            if (duplicate) {
                return res.status(409).json({ status: 0, message: "Tên danh mục đã được sử dụng bởi danh mục khác!" });
            }
            updateData.name = cleanName;
        }

        if (description !== undefined) updateData.description = description.trim();
        if (icon !== undefined) updateData.icon = icon;
        if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
        if (branch_id !== undefined) updateData.branch_id = branch_id;
        if (status !== undefined) updateData.status = status;

        const updated = await Category.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: 1, message: "Cập nhật danh mục thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật danh mục", err: error.message });
    }
};

// Đổi trạng thái ẩn / hiện danh mục (PATCH /api/categories/:id/status)
exports.changeCategoryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID danh mục không hợp lệ!" });
        }

        const cat = await Category.findById(id);
        if (!cat) return res.status(404).json({ status: 0, message: "Không tìm thấy danh mục!" });

        const { status } = req.body;
        let newStatus;
        if (status !== undefined) {
            newStatus = (status === 'Inactive' || status === 'Hidden' || status === false) ? 'Inactive' : 'Active';
        } else {
            // Tự động toggle
            newStatus = cat.status === 'Active' ? 'Inactive' : 'Active';
        }

        cat.status = newStatus;
        await cat.save();

        res.status(200).json({
            status: 1,
            message: `Danh mục hiện đang: ${newStatus === 'Active' ? 'Hiển thị' : 'Ẩn'}`,
            data: cat
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi đổi trạng thái danh mục", err: error.message });
    }
};

// Xóa danh mục (DELETE /api/categories/:id)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID danh mục không hợp lệ!" });
        }

        const deleted = await Category.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy danh mục!" });

        res.status(200).json({ status: 1, message: "Xóa danh mục thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa danh mục", err: error.message });
    }
};

// ==========================================
// 2. QUẢN LÝ MÓN ĂN (MENU ITEMS)
// ==========================================

// Lấy danh sách món ăn (GET /api/menu)
exports.getAllMenuItems = async (req, res) => {
    try {
        const { category_id, branch_id, station, status, q } = req.query;
        let filter = {};

        if (status) {
            filter.status = status;
        } else {
            filter.status = { $ne: 'Archived' };
        }

        if (category_id) filter.category_id = category_id;
        if (station) filter.station = station;
        if (branch_id) filter.$or = [{ branch_id }, { branch_id: null }];
        if (q) filter.name = { $regex: q.trim(), $options: 'i' };

        const items = await MenuItem.find(filter)
            .populate('category_id', 'name icon')
            .sort({ createdAt: -1 });

        res.status(200).json({ status: 1, message: "Lấy danh sách món ăn thành công", data: items });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy món ăn", err: error.message });
    }
};

// Lấy chi tiết 1 món ăn kèm biến thể và công thức (GET /api/menu/:id)
exports.getMenuItemById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID món ăn không hợp lệ!" });
        }

        const item = await MenuItem.findById(id).populate('category_id', 'name icon');
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món ăn!" });

        // Lấy danh sách biến thể theo món
        const variants = await Variant.find({ menuItem_id: item._id, status: { $ne: 'Archived' } });
        // Lấy công thức định lượng nguyên liệu
        const recipes = await Recipe.find({ menuItem_id: item._id, status: 'Active' })
            .populate('ingredient_id', 'name unit current_stock min_limit');

        res.status(200).json({
            status: 1,
            message: "Lấy chi tiết món thành công",
            data: {
                ...item.toJSON(),
                variants,
                recipes
            }
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy chi tiết", err: error.message });
    }
};

// Tạo món ăn mới (POST /api/menu)
exports.createMenuItem = async (req, res) => {
    try {
        const { 
            category_id, branch_id, name, base_price, cost_price, image, description, station, isPopular, status,
            is_combo, serving_size, combo_items,
            is_flash_sale, sale_price, flash_sale_start, flash_sale_end, flash_sale_limit, flash_sale_sold 
        } = req.body;

        // 400: Kiểm tra các trường bắt buộc
        if (!name || !name.trim()) {
            return res.status(400).json({ status: 0, message: "Tên món ăn không được để trống!" });
        }

        if (base_price === undefined || isNaN(base_price) || Number(base_price) < 0) {
            return res.status(400).json({ status: 0, message: "Giá bán của món phải là một số dương hợp lệ!" });
        }

        // Quy định: Mức giảm giá của Combo không được vượt quá 50% tổng giá mua lẻ
        if (Boolean(is_combo) && Array.isArray(combo_items) && combo_items.length > 0) {
            const retailTotal = combo_items.reduce((s, it) => s + (Number(it.original_price) || (Number(it.item_unit_price) * (Number(it.quantity) || 1)) || 0), 0);
            if (retailTotal > 0) {
                const diff = retailTotal - Number(base_price);
                const discountPct = (diff / retailTotal) * 100;
                if (discountPct > 50) {
                    return res.status(400).json({
                        status: 0,
                        message: `Mức giảm giá của Combo (${Math.round(discountPct)}%) không được vượt quá 50%! Giá bán tối thiểu từ ${Math.ceil(retailTotal * 0.5).toLocaleString('vi-VN')} đ`
                    });
                }
            }
        }

        if (!category_id) {
            return res.status(400).json({ status: 0, message: "Vui lòng chọn danh mục cho món ăn!" });
        }

        if (!mongoose.Types.ObjectId.isValid(category_id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID danh mục không hợp lệ!" });
        }

        // 404: Kiểm tra danh mục có tồn tại trong CSDL không
        const existingCategory = await Category.findById(category_id);
        if (!existingCategory) {
            return res.status(404).json({ status: 0, message: "Danh mục món ăn không tồn tại!" });
        }

        const cleanName = name.trim();

        // 409: Kiểm tra trùng tên món
        const duplicateItem = await MenuItem.findOne({ name: cleanName });
        if (duplicateItem) {
            return res.status(409).json({ status: 0, message: "Tên món ăn đã tồn tại trên menu!" });
        }

        const newItem = await MenuItem.create({
            category_id,
            branch_id: branch_id || null,
            name: cleanName,
            base_price: Number(base_price),
            cost_price: Number(cost_price) || 0,
            image: image || null,
            description: description ? description.trim() : '',
            station: station || 'hot',
            isPopular: isPopular || false,
            is_combo: Boolean(is_combo),
            serving_size: serving_size ? serving_size.trim() : null,
            combo_items: Array.isArray(combo_items) ? combo_items : [],
            is_flash_sale: Boolean(is_flash_sale),
            sale_price: Number(sale_price) || 0,
            flash_sale_start: flash_sale_start || null,
            flash_sale_end: flash_sale_end || null,
            flash_sale_limit: Number(flash_sale_limit) || 0,
            flash_sale_sold: Number(flash_sale_sold) || 0,
            status: status || 'Available'
        });

        // 201: Tạo thành công
        res.status(201).json({ status: 1, message: "Thêm món ăn mới thành công!", data: newItem });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo món ăn", err: error.message });
    }
};

// Cập nhật thông tin món ăn (PUT /api/menu/:id)
exports.updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID món ăn không hợp lệ!" });
        }

        const item = await MenuItem.findById(id);
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món ăn để cập nhật!" });

        const { category_id, branch_id, name, base_price, cost_price, image, description, station, isPopular, status } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng tên món với món khác
        if (name && name.trim()) {
            const cleanName = name.trim();
            const duplicate = await MenuItem.findOne({ name: cleanName, _id: { $ne: id } });
            if (duplicate) {
                return res.status(409).json({ status: 0, message: "Tên món ăn đã thuộc về món khác trên menu!" });
            }
            updateData.name = cleanName;
        }

        if (base_price !== undefined) {
            if (isNaN(base_price) || Number(base_price) < 0) {
                return res.status(400).json({ status: 0, message: "Giá bán phải là số dương hợp lệ!" });
            }
            updateData.base_price = Number(base_price);
        }

        if (cost_price !== undefined) updateData.cost_price = Number(cost_price);

        if (category_id !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(category_id)) {
                return res.status(400).json({ status: 0, message: "Định dạng ID danh mục không hợp lệ!" });
            }
            const catExists = await Category.findById(category_id);
            if (!catExists) return res.status(404).json({ status: 0, message: "Danh mục không tồn tại!" });
            updateData.category_id = category_id;
        }

        if (branch_id !== undefined) updateData.branch_id = branch_id;
        if (image !== undefined) updateData.image = image;
        if (description !== undefined) updateData.description = description.trim();
        if (station !== undefined) updateData.station = station;
        if (isPopular !== undefined) updateData.isPopular = isPopular;
        if (status !== undefined) updateData.status = status;

        // Combo & Flash Sale fields update
        if (req.body.is_combo !== undefined) updateData.is_combo = Boolean(req.body.is_combo);
        if (req.body.serving_size !== undefined) updateData.serving_size = req.body.serving_size ? req.body.serving_size.trim() : null;
        if (req.body.combo_items !== undefined) updateData.combo_items = Array.isArray(req.body.combo_items) ? req.body.combo_items : [];
        if (req.body.is_flash_sale !== undefined) updateData.is_flash_sale = Boolean(req.body.is_flash_sale);
        if (req.body.sale_price !== undefined) updateData.sale_price = Number(req.body.sale_price) || 0;
        if (req.body.flash_sale_start !== undefined) updateData.flash_sale_start = req.body.flash_sale_start;
        if (req.body.flash_sale_end !== undefined) updateData.flash_sale_end = req.body.flash_sale_end;
        if (req.body.flash_sale_limit !== undefined) updateData.flash_sale_limit = Number(req.body.flash_sale_limit) || 0;
        if (req.body.flash_sale_sold !== undefined) updateData.flash_sale_sold = Number(req.body.flash_sale_sold) || 0;

        // Quy định: Mức giảm giá của Combo không được vượt quá 50% tổng giá mua lẻ
        const isCombo = req.body.is_combo !== undefined ? Boolean(req.body.is_combo) : item.is_combo;
        const comboItems = req.body.combo_items !== undefined ? req.body.combo_items : item.combo_items;
        const targetPrice = updateData.base_price !== undefined ? Number(updateData.base_price) : item.base_price;

        if (isCombo && Array.isArray(comboItems) && comboItems.length > 0) {
            const retailTotal = comboItems.reduce((s, it) => s + (Number(it.original_price) || (Number(it.item_unit_price) * (Number(it.quantity) || 1)) || 0), 0);
            if (retailTotal > 0) {
                const diff = retailTotal - targetPrice;
                const discountPct = (diff / retailTotal) * 100;
                if (discountPct > 50) {
                    return res.status(400).json({
                        status: 0,
                        message: `Mức giảm giá của Combo (${Math.round(discountPct)}%) không được vượt quá 50%! Giá bán tối thiểu từ ${Math.ceil(retailTotal * 0.5).toLocaleString('vi-VN')} đ`
                    });
                }
            }
        }

        const updated = await MenuItem.findByIdAndUpdate(id, updateData, { new: true }).populate('category_id', 'name icon');
        res.status(200).json({ status: 1, message: "Cập nhật món ăn thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật", err: error.message });
    }
};

// Đổi nhanh trạng thái còn hàng / hết hàng (PATCH /api/menu/:id/toggle-status)
exports.toggleMenuItemStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID món ăn không hợp lệ!" });
        }

        const item = await MenuItem.findById(id);
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món ăn" });

        const { status } = req.body;
        let newStatus;
        if (status !== undefined) {
            newStatus = status;
        } else {
            // Tự động toggle
            newStatus = item.status === 'Available' ? 'Out_of_stock' : 'Available';
        }

        item.status = newStatus;
        await item.save();

        res.status(200).json({ 
            status: 1, 
            message: `Món đã chuyển sang trạng thái: "${item.status === 'Available' ? 'Có sẵn (Còn món)' : 'Tạm hết hàng'}"`, 
            data: item 
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi đổi trạng thái", err: error.message });
    }
};

// Xóa mềm món ăn (Soft Delete theo BRD 1.1: Chuyển sang Archived để bảo toàn lịch sử đơn hàng)
exports.deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID món ăn không hợp lệ!" });
        }

        if (req.query.permanent === 'true') {
            await MenuItem.findByIdAndDelete(id);
            await Variant.deleteMany({ menuItem_id: id });
            await Recipe.deleteMany({ menuItem_id: id });
            return res.status(200).json({ status: 1, message: "Đã xóa vĩnh viễn món ăn!" });
        }

        const item = await MenuItem.findByIdAndUpdate(id, { status: 'Archived' }, { new: true });
        if (!item) return res.status(404).json({ status: 0, message: "Không tìm thấy món ăn" });

        // Lưu trữ các biến thể liên quan sang Archived để bảo lưu lịch sử
        await Variant.updateMany({ menuItem_id: id }, { status: 'Archived' });

        res.status(200).json({ status: 1, message: "Xóa món ăn thành công (Đã chuyển sang trạng thái lưu trữ Archived)!", data: item });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa món ăn", err: error.message });
    }
};

// ==========================================
// 3. QUẢN LÝ BIẾN THỂ (VARIANTS)
// ==========================================

// Lấy danh sách biến thể theo món (GET /api/variants)
exports.getVariantsByMenuItem = async (req, res) => {
    try {
        const { menuItem_id } = req.query;
        let filter = { status: { $ne: 'Archived' } };
        if (menuItem_id) {
            if (!mongoose.Types.ObjectId.isValid(menuItem_id)) {
                return res.status(400).json({ status: 0, message: "Định dạng menuItem_id không hợp lệ!" });
            }
            filter.menuItem_id = menuItem_id;
        }

        const variants = await Variant.find(filter);
        res.status(200).json({ status: 1, message: "Lấy biến thể thành công", data: variants });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy biến thể", err: error.message });
    }
};

// Thêm biến thể mới (POST /api/variants)
exports.createVariant = async (req, res) => {
    try {
        const { menuItem_id, name, extra_price, group_name, cost_price, allowMultiple, status } = req.body;

        if (!menuItem_id || !mongoose.Types.ObjectId.isValid(menuItem_id)) {
            return res.status(400).json({ status: 0, message: "menuItem_id không hợp lệ!" });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ status: 0, message: "Tên biến thể không được để trống!" });
        }

        const validStatuses = ['Available', 'Out_of_stock', 'Archived'];
        const finalStatus = (status && validStatuses.includes(status)) ? status : 'Available';

        const newVariant = await Variant.create({
            menuItem_id,
            group_name: group_name ? group_name.trim() : 'Tùy chọn',
            name: name.trim(),
            extra_price: Number(extra_price) || 0,
            cost_price: Number(cost_price) || 0,
            allowMultiple: Boolean(allowMultiple),
            status: finalStatus
        });

        res.status(201).json({ status: 1, message: "Thêm biến thể thành công!", data: newVariant });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo biến thể", err: error.message });
    }
};

// Cập nhật biến thể (PUT /api/variants/:id)
exports.updateVariant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID biến thể không hợp lệ!" });
        }

        const updated = await Variant.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) return res.status(404).json({ status: 0, message: "Không tìm thấy biến thể" });

        res.status(200).json({ status: 1, message: "Cập nhật biến thể thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật biến thể", err: error.message });
    }
};

// Xóa biến thể (DELETE /api/variants/:id)
exports.deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID biến thể không hợp lệ!" });
        }

        const deleted = await Variant.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy biến thể" });

        res.status(200).json({ status: 1, message: "Xóa biến thể thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa biến thể", err: error.message });
    }
};
