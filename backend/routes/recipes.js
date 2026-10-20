// Chuyển hướng và gọi hàm Controller Công thức định lượng (Recipes)
var express = require('express');
var router = express.Router();

const invCtrl = require('../controllers/inventoryController');

/**
 * =========================================================================
 * RECIPES (CÔNG THỨC ĐỊNH LƯỢNG NGUYÊN LIỆU MÓN ĂN & BIẾN THỂ)
 * =========================================================================
 */

// GET http://localhost:4000/recipes hoặc /api/recipes
// Lấy danh sách toàn bộ công thức định lượng món
router.get('/', invCtrl.getRecipes);

// POST http://localhost:4000/recipes
// Lưu công thức định lượng món: { menu_item_id, ingredient_id, amount_needed }
router.post('/', invCtrl.saveRecipe);

// PATCH http://localhost:4000/recipes/:id
router.patch('/:id', invCtrl.updateRecipe);

// DELETE http://localhost:4000/recipes/:id
router.delete('/:id', invCtrl.deleteRecipe);

// GET http://localhost:4000/recipes/variant-recipes hoặc /api/variant-recipes
// Lấy danh sách định lượng theo từng biến thể
router.get(['/variant-recipes', '/variants'], invCtrl.getVariantRecipes);

module.exports = router;
