// Chuyển hướng và gọi hàm Controller Biến thể món ăn (Variants)
var express = require('express');
var router = express.Router();

const menuCtrl = require('../controllers/menuController');

/**
 * =========================================================================
 * VARIANTS (BIẾN THỂ MÓN ĂN - SIZE, TOPPING, ĐỘ NGỌT/ĐÁ...)
 * =========================================================================
 */

// GET http://localhost:4000/variants hoặc /api/variants?menu_item_id=...
// Lấy danh sách biến thể theo món ăn
router.get('/', menuCtrl.getVariantsByMenuItem);

// POST http://localhost:4000/variants
// Thêm biến thể cho món: { menu_item_id, name, extra_price }
router.post('/', menuCtrl.createVariant);

// PUT http://localhost:4000/variants/:id
// Cập nhật thông tin biến thể
router.put('/:id', menuCtrl.updateVariant);

// DELETE http://localhost:4000/variants/:id
// Xóa biến thể
router.delete('/:id', menuCtrl.deleteVariant);

module.exports = router;
