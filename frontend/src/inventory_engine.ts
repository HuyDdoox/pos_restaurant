import { API_URL, API_ORDER_DETAILS_URL, API_RECIPES_URL, API_INGREDIENTS_URL, API_VARIANTS_URL } from './config';
import { calculateInventoryDeductions } from './accounting_engine';

const API_VARIANT_RECIPES_URL = `${API_RECIPES_URL}/variant-recipes`;

/**
 * Tự động đồng bộ trạng thái món ăn (Available / Out_of_stock)
 * Dựa trên việc kiểm tra tồn kho của tất cả nguyên liệu trong công thức.
 * Nếu bất kỳ nguyên liệu nào trong công thức bị thiếu hoặc hết (stock < required hoặc <= 0) -> Món chuyển sang 'Out_of_stock'.
 * Nếu tất cả nguyên liệu đều đủ -> Món (nếu đang bị Out_of_stock) chuyển lại 'Available'.
 */
export const syncMenuItemsStockStatus = async (): Promise<{ updatedCount: number; outOfStockIds: string[] }> => {
    try {
        const [menuRes, ingRes, recRes] = await Promise.all([
            fetch(API_URL),
            fetch(API_INGREDIENTS_URL),
            fetch(API_RECIPES_URL)
        ]);

        if (!menuRes.ok || !ingRes.ok || !recRes.ok) return { updatedCount: 0, outOfStockIds: [] };

        const menuJson = await menuRes.json();
        const ingJson = await ingRes.json();
        const recJson = await recRes.json();

        const menuItems = Array.isArray(menuJson) ? menuJson : (menuJson.data || []);
        const ingredients = Array.isArray(ingJson) ? ingJson : (ingJson.data || []);
        const recipes = Array.isArray(recJson) ? recJson : (recJson.data || []);

        let updatedCount = 0;
        const outOfStockIds: string[] = [];

        for (const item of menuItems) {
            const itemId = String(item.id || item._id);
            // Không can thiệp món đã bị xóa mềm/lưu trữ (Archived)
            if (item.status === 'Archived') continue;

            const itemRecipes = recipes.filter((r: any) => {
                const rMenuId = (r.menuItem_id && typeof r.menuItem_id === 'object') ? (r.menuItem_id._id || r.menuItem_id.id) : r.menuItem_id;
                return String(rMenuId) === itemId;
            });
            if (itemRecipes.length === 0) continue;

            let isStockEnough = true;
            for (const r of itemRecipes) {
                const rIngId = (r.ingredient_id && typeof r.ingredient_id === 'object') ? (r.ingredient_id._id || r.ingredient_id.id) : r.ingredient_id;
                const ing = ingredients.find((i: any) => String(i.id || i._id) === String(rIngId));
                const stock = ing ? (Number(ing.stock_quantity) || 0) : ((r.ingredient_id && typeof r.ingredient_id === 'object') ? Number(r.ingredient_id.stock_quantity || 0) : 0);
                const req = Number(r.quantity_required) || 0;
                if (!ing || stock < req || stock <= 0) {
                    isStockEnough = false;
                    break;
                }
            }

            if (!isStockEnough) {
                outOfStockIds.push(item.id);
                if (item.status !== 'Out_of_stock') {
                    await fetch(`${API_URL}/${item.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'Out_of_stock' })
                    });
                    item.status = 'Out_of_stock';
                    updatedCount++;
                }
            } else {
                // Nếu kho đã đủ lại và trạng thái đang là Out_of_stock -> Mở lại Available
                if (item.status === 'Out_of_stock' || item.status === 'Out of Stock') {
                    await fetch(`${API_URL}/${item.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'Available' })
                    });
                    item.status = 'Available';
                    updatedCount++;
                }
            }
        }

        if (updatedCount > 0) {
            try {
                const channel = new BroadcastChannel('foodhub_kds');
                channel.postMessage({
                    type: 'MENU_UPDATED',
                    message: `Hệ thống kho đã tự động đồng bộ trạng thái ${updatedCount} món ăn!`
                });
            } catch (e) {}
        }

        return { updatedCount, outOfStockIds };
    } catch (e) {
        console.error('[Inventory-Engine] Lỗi đồng bộ trạng thái thực đơn:', e);
        return { updatedCount: 0, outOfStockIds: [] };
    }
};

export { calculateInventoryDeductions };

/**
 * Hàm Trừ Kho Tự Động
 * Sẽ được gọi ngay sau khi Thu ngân ấn "Thanh toán xong".
 * Phân tích từng món ăn và biến thể (size, topping) để trừ lượng nguyên liệu tương ứng.
 */
export const deductInventoryForOrder = async (orderId: string) => {
    try {
        // 1. Lấy tất cả các món trong hóa đơn (bỏ qua những món bị Hủy)
        const allDetailsRes = await fetch(`${API_ORDER_DETAILS_URL}?order_id=${orderId}`);
        const details = await allDetailsRes.json();
        const validDetails = details.filter((d: any) => d.status !== 'Cancelled');

        if (validDetails.length === 0) return;

        // 2. Fetch data (Nguyên liệu, Công thức món, Công thức biến thể, Biến thể)
        const [ingRes, recRes, varRecRes, varRes] = await Promise.all([
            fetch(API_INGREDIENTS_URL),
            fetch(API_RECIPES_URL),
            fetch(API_VARIANT_RECIPES_URL).catch(() => ({ ok: false, json: () => [] }) as any),
            fetch(API_VARIANTS_URL)
        ]);
        
        const ingredients = await ingRes.json();
        const allRecipes = await recRes.json();
        const allVarRecipes = varRecRes.ok ? await varRecRes.json() : [];
        const allVariants = await varRes.json();

        // 3. Tính toán tổng nguyên liệu tiêu hao { ingredientId: amountToSubtract }
        const deductionMap = calculateInventoryDeductions(validDetails, allRecipes, allVariants, allVarRecipes);

        // 4. Cập nhật lại số lượng tồn kho vào DB
        for (const ingId in deductionMap) {
            const amountToSubtract = deductionMap[ingId];
            if (amountToSubtract <= 0) continue;

            const ing = ingredients.find((i: any) => String(i.id) === String(ingId));
            if (ing) {
                let newStock = Number(ing.stock_quantity) - amountToSubtract;
                if (newStock < 0) newStock = 0; // Tạm thời không cho kho âm (tùy nghiệp vụ)

                await fetch(`${API_INGREDIENTS_URL}/${ing.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stock_quantity: newStock })
                });
            }
        }
        
        console.log(`[Auto-Deduction] Kho đã được trừ tự động cho hóa đơn ${orderId}`);

        // 5. Tự động đồng bộ trạng thái thực đơn sau khi trừ kho
        await syncMenuItemsStockStatus();
    } catch (e) {
        console.error("[Auto-Deduction] Lỗi khi trừ kho tự động: ", e);
    }
};
