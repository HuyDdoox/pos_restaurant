const mongoose = require('mongoose');
const { Ingredient, Recipe, VariantRecipe, LossReport, AuditLog } = require('../models');

// ==========================================
// 1. QUẢN LÝ NGUYÊN LIỆU KHO (INGREDIENTS)
// ==========================================

// Lấy danh sách nguyên vật liệu tồn kho (GET /api/inventory)
exports.getAllIngredients = async (req, res) => {
    try {
        const { branch_id, lowStock, q } = req.query;
        let filter = { status: { $ne: 'Archived' } };

        if (branch_id) filter.$or = [{ branch_id }, { branch_id: null }];
        if (q) filter.name = { $regex: q.trim(), $options: 'i' };

        const ingredients = await Ingredient.find(filter).sort({ name: 1 });

        // Lọc các món sắp hết hàng nếu yêu cầu lowStock=true
        let result = ingredients;
        if (lowStock === 'true') {
            result = ingredients.filter(i => (i.stock_quantity || 0) <= (i.min_threshold || 5));
        }

        res.status(200).json({ status: 1, message: "Lấy kho nguyên liệu thành công", data: result });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy kho nguyên liệu", err: error.message });
    }
};

// Thêm nguyên liệu mới vào kho (POST /api/inventory)
exports.createIngredient = async (req, res) => {
    try {
        const { name, stock_quantity, unit, cost_price, min_threshold, branch_id } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ status: 0, message: "Tên nguyên liệu không được để trống!" });
        }

        const cleanName = name.trim();

        // 409: Kiểm tra trùng tên nguyên liệu
        const duplicate = await Ingredient.findOne({ name: cleanName });
        if (duplicate) {
            return res.status(409).json({ status: 0, message: `Nguyên liệu [${cleanName}] đã tồn tại trong kho!` });
        }

        const newIng = await Ingredient.create({
            name: cleanName,
            stock_quantity: (stock_quantity && !isNaN(stock_quantity)) ? Number(stock_quantity) : 0,
            unit: unit ? unit.trim() : 'kg',
            cost_price: (cost_price && !isNaN(cost_price)) ? Number(cost_price) : 0,
            min_threshold: (min_threshold && !isNaN(min_threshold)) ? Number(min_threshold) : 5,
            branch_id: branch_id || null,
            status: 'Active'
        });

        res.status(201).json({ status: 1, message: "Thêm nguyên liệu thành công!", data: newIng });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi tạo nguyên liệu", err: error.message });
    }
};

// Cập nhật nguyên liệu (PUT /api/inventory/:id)
exports.updateIngredient = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID nguyên liệu không hợp lệ!" });
        }

        const ing = await Ingredient.findById(id);
        if (!ing) return res.status(404).json({ status: 0, message: "Không tìm thấy nguyên liệu trong kho!" });

        const { name, stock_quantity, unit, cost_price, min_threshold, branch_id, status } = req.body;
        const updateData = {};

        // 409: Kiểm tra trùng tên (loại trừ chính id đang sửa)
        if (name && name.trim()) {
            const cleanName = name.trim();
            const duplicate = await Ingredient.findOne({ name: cleanName, _id: { $ne: id } });
            if (duplicate) {
                return res.status(409).json({ status: 0, message: `Tên nguyên liệu [${cleanName}] đã được sử dụng!` });
            }
            updateData.name = cleanName;
        }

        if (stock_quantity !== undefined) updateData.stock_quantity = Number(stock_quantity);
        if (unit !== undefined) updateData.unit = unit.trim();
        if (cost_price !== undefined) updateData.cost_price = Number(cost_price);
        if (min_threshold !== undefined) updateData.min_threshold = Number(min_threshold);
        if (branch_id !== undefined) updateData.branch_id = branch_id;
        if (status !== undefined) updateData.status = status;

        const updated = await Ingredient.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: 1, message: "Cập nhật nguyên liệu thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật", err: error.message });
    }
};

// Xóa nguyên liệu (DELETE /api/inventory/:id)
exports.deleteIngredient = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "Định dạng ID nguyên liệu không hợp lệ!" });
        }

        const deleted = await Ingredient.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ status: 0, message: "Không tìm thấy nguyên liệu" });

        res.status(200).json({ status: 1, message: "Xóa nguyên liệu thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa", err: error.message });
    }
};

// ==========================================
// 2. CÔNG THỨC ĐỊNH LƯỢNG (RECIPES & VARIANT RECIPES)
// ==========================================

// Lấy công thức của món (GET /api/recipes)
exports.getRecipes = async (req, res) => {
    try {
        const { menuItem_id } = req.query;
        let filter = { status: 'Active' };
        if (menuItem_id) {
            if (!mongoose.Types.ObjectId.isValid(menuItem_id)) {
                return res.status(400).json({ status: 0, message: "menuItem_id không hợp lệ!" });
            }
            filter.menuItem_id = menuItem_id;
        }

        const recipes = await Recipe.find(filter)
            .populate('menuItem_id', 'name base_price')
            .populate('ingredient_id', 'name unit stock_quantity');

        res.status(200).json({ status: 1, message: "Lấy công thức thành công", data: recipes });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy công thức", err: error.message });
    }
};

// Lưu định lượng món ăn (POST /api/recipes)
exports.saveRecipe = async (req, res) => {
    try {
        const { menuItem_id, ingredient_id, quantity_required, unit } = req.body;

        if (!menuItem_id || !mongoose.Types.ObjectId.isValid(menuItem_id)) {
            return res.status(400).json({ status: 0, message: "Mã món ăn (menuItem_id) không hợp lệ!" });
        }

        if (!ingredient_id || !mongoose.Types.ObjectId.isValid(ingredient_id)) {
            return res.status(400).json({ status: 0, message: "Mã nguyên liệu (ingredient_id) không hợp lệ!" });
        }

        const recipe = await Recipe.create({
            menuItem_id,
            ingredient_id,
            quantity_required: Number(quantity_required) || 0,
            unit: unit ? unit.trim() : '',
            status: 'Active'
        });

        res.status(201).json({ status: 1, message: "Lưu công thức thành công!", data: recipe });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lưu công thức", err: error.message });
    }
};

// Cập nhật định lượng món ăn (PATCH /api/recipes/:id)
exports.updateRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "ID công thức không hợp lệ!" });
        }
        const updated = await Recipe.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) return res.status(404).json({ status: 0, message: "Không tìm thấy công thức!" });
        res.status(200).json({ status: 1, message: "Cập nhật công thức thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi cập nhật công thức", err: error.message });
    }
};

// Xóa định lượng món ăn (DELETE /api/recipes/:id)
exports.deleteRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 0, message: "ID công thức không hợp lệ!" });
        }
        await Recipe.findByIdAndDelete(id);
        res.status(200).json({ status: 1, message: "Xóa công thức thành công!" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi xóa công thức", err: error.message });
    }
};

// Định lượng của biến thể (GET /api/variant-recipes)
exports.getVariantRecipes = async (req, res) => {
    try {
        const { variantId } = req.query;
        let filter = { status: 'Active' };
        if (variantId) {
            if (!mongoose.Types.ObjectId.isValid(variantId)) {
                return res.status(400).json({ status: 0, message: "variantId không hợp lệ!" });
            }
            filter.variantId = variantId;
        }

        const list = await VariantRecipe.find(filter).populate('ingredientId', 'name unit stock_quantity');
        res.status(200).json({ status: 1, message: "Lấy định lượng biến thể thành công", data: list });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi", err: error.message });
    }
};

// ==========================================
// 3. BÁO CÁO THẤT THOÁT & KIỂM KÊ KHO (LOSS REPORTS)
// ==========================================

// Xem danh sách báo cáo thất thoát (GET /api/loss-reports)
exports.getLossReports = async (req, res) => {
    try {
        const { branch_id } = req.query;
        let filter = {};
        if (branch_id) filter.$or = [{ branch_id }, { branch_id: null }];

        const reports = await LossReport.find(filter)
            .populate('ingredientId', 'name unit cost_price')
            .sort({ createdAt: -1 });

        res.status(200).json({ status: 1, message: "Lấy báo cáo thất thoát thành công", data: reports });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lấy báo cáo", err: error.message });
    }
};

// Tạo phiếu kiểm kê kho / báo cáo thất thoát (POST /api/loss-reports)
exports.createLossReport = async (req, res) => {
    try {
        const { reports } = req.body;
        if (!reports || !Array.isArray(reports) || reports.length === 0) {
            return res.status(400).json({ status: 0, message: "Dữ liệu kiểm kê không hợp lệ (cần mảng danh sách kiểm kê)!" });
        }

        const savedReports = [];
        for (const item of reports) {
            if (item.ingredientId && mongoose.Types.ObjectId.isValid(item.ingredientId)) {
                const ing = await Ingredient.findById(item.ingredientId);
                if (ing) {
                    const diff = (Number(item.systemStock) || 0) - (Number(item.actualStock) || 0);
                    const cost = diff > 0 ? diff * (ing.cost_price || 0) : 0;

                    const doc = await LossReport.create({
                        branch_id: ing.branch_id || null,
                        ingredientId: ing._id,
                        ingredientName: ing.name,
                        systemStock: Number(item.systemStock) || 0,
                        actualStock: Number(item.actualStock) || 0,
                        lossAmount: diff,
                        lossCost: cost,
                        unit: ing.unit,
                        reason: item.reason || 'Kiểm kê định kỳ',
                        isAbnormal: diff > 10,
                        reportedBy: req.user ? req.user.id : null
                    });

                    // Cập nhật tồn kho thực tế vào Ingredient
                    ing.stock_quantity = Number(item.actualStock) || 0;
                    await ing.save();

                    savedReports.push(doc);
                }
            }
        }

        // Ghi Audit Log
        await AuditLog.create({
            category: 'inventory',
            actor: req.user ? req.user.username : 'Quản lý kho',
            action: 'Kiểm kê kho & Báo cáo thất thoát',
            detail: `Kiểm kê hoàn tất ${savedReports.length} nguyên liệu.`
        }).catch(() => {});

        res.status(201).json({
            status: 1,
            message: `Lưu phiếu kiểm kê thành công cho ${savedReports.length} nguyên liệu!`,
            data: savedReports
        });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Lỗi lưu kiểm kê", err: error.message });
    }
};
