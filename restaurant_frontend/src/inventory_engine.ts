import { API_ORDER_DETAILS_URL, API_RECIPES_URL, API_INGREDIENTS_URL, API_VARIANTS_URL } from './config';

const API_VARIANT_RECIPES_URL = "http://localhost:3000/VariantRecipes";

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
        const deductionMap: { [key: string]: number } = {};

        for (const detail of validDetails) {
            const qty = detail.quantity;

            // A. Trừ nguyên liệu của MÓN CHÍNH
            const mainRecipes = allRecipes.filter((r: any) => String(r.menuItem_id) === String(detail.menuItem_id));
            mainRecipes.forEach((r: any) => {
                if (!deductionMap[r.ingredient_id]) deductionMap[r.ingredient_id] = 0;
                deductionMap[r.ingredient_id] += (r.quantity_required * qty);
            });

            // B. Trừ nguyên liệu của BIẾN THỂ (Phân tích từ trường 'notes')
            if (detail.notes) {
                // Tìm tất cả biến thể của món này
                const itemVariants = allVariants.filter((v: any) => String(v.menuItem_id) === String(detail.menuItem_id));
                
                // Nếu tên biến thể nằm trong note (vd: "[Size L]"), ta sẽ lấy công thức của nó
                itemVariants.forEach((v: any) => {
                    if (detail.notes.includes(v.name)) {
                        const varRecipes = allVarRecipes.filter((vr: any) => String(vr.variantId) === String(v.id));
                        varRecipes.forEach((vr: any) => {
                            if (!deductionMap[vr.ingredientId]) deductionMap[vr.ingredientId] = 0;
                            deductionMap[vr.ingredientId] += (vr.quantity * qty);
                        });
                    }
                });
            }
        }

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
    } catch (e) {
        console.error("[Auto-Deduction] Lỗi khi trừ kho tự động: ", e);
    }
};
