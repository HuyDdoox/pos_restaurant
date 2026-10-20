/**
 * FoodHub POS Accounting & Business Logic Engine
 * Module tính toán kế toán nhà hàng, thuế VAT, chiết khấu, tách gộp hóa đơn và vòng đời đơn hàng.
 */

export interface BillAccountingResult {
    subtotal: number;
    discountAmount: number;
    afterDiscount: number;
    serviceCharge: number;
    vatAmount: number;
    finalTotal: number;
}

/**
 * Tính toán tài chính hóa đơn theo tiêu chuẩn F&B Việt Nam:
 * 1. Tiền hàng trước thuế & giảm giá (Subtotal)
 * 2. Chiết khấu (Discount = Subtotal * % Discount)
 * 3. Giá trị sau chiết khấu (After Discount = Subtotal - Discount)
 * 4. Phí phục vụ (Service Charge = After Discount * Service Rate)
 * 5. Thuế GTGT (VAT = (After Discount + Service Charge) * VAT Rate)
 * 6. Tổng cộng phải trả (Final Total = After Discount + Service Charge + VAT)
 */
export const calculateBillAccounting = (
    subtotal: number,
    discountPercent: number = 0,
    serviceChargeRate: number = 0,
    vatRate: number = 0.08
): BillAccountingResult => {
    const validSubtotal = Math.max(0, Math.round(subtotal || 0));
    const validDiscountPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const validServiceRate = Math.max(0, Number(serviceChargeRate) || 0);
    const validVatRate = Math.max(0, Number(vatRate) || 0);

    const discountAmount = Math.round(validSubtotal * (validDiscountPct / 100));
    const afterDiscount = Math.max(0, validSubtotal - discountAmount);
    const serviceCharge = Math.round(afterDiscount * validServiceRate);
    const vatAmount = Math.round((afterDiscount + serviceCharge) * validVatRate);
    const finalTotal = afterDiscount + serviceCharge + vatAmount;

    return {
        subtotal: validSubtotal,
        discountAmount,
        afterDiscount,
        serviceCharge,
        vatAmount,
        finalTotal
    };
};

/**
 * Tính tiền thừa trả khách khi thanh toán tiền mặt (Quick Cash Numpad)
 */
export const calculateCashChange = (cashGiven: number, finalTotal: number): {
    change: number;
    isValid: boolean;
    isExact: boolean;
} => {
    const given = Math.max(0, Math.round(cashGiven || 0));
    const total = Math.max(0, Math.round(finalTotal || 0));
    const change = given - total;

    return {
        change,
        isValid: change >= 0,
        isExact: change === 0
    };
};

/**
 * Chia đều hóa đơn cho N người (Equal Split)
 */
export const calculateEqualSplit = (finalTotal: number, parts: number): {
    parts: number;
    sharePerPerson: number;
    shares: number[];
    isExact: boolean;
} => {
    const validParts = Math.max(1, Math.floor(parts || 1));
    const total = Math.max(0, Math.round(finalTotal || 0));
    const baseShare = Math.floor(total / validParts);
    const remainder = total - (baseShare * validParts);

    // Người đầu tiên gánh phần dư nhỏ nếu có, hoặc chia đều
    const shares: number[] = [];
    for (let i = 0; i < validParts; i++) {
        shares.push(i === 0 ? baseShare + remainder : baseShare);
    }

    return {
        parts: validParts,
        sharePerPerson: baseShare,
        shares,
        isExact: remainder === 0
    };
};

/**
 * Tính giá vốn (COGS) và tỷ suất lợi nhuận biên cho một món ăn
 */
export const calculateDishProfitability = (
    basePrice: number,
    menuItemId: string,
    recipes: any[],
    ingredients: any[]
): {
    menuItemId: string;
    basePrice: number;
    unitCogs: number;
    unitProfit: number;
    marginPercent: number;
    classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';
} => {
    const price = Math.max(0, Number(basePrice) || 0);
    const ingMap = new Map<string, number>();
    ingredients.forEach((ing: any) => ingMap.set(String(ing.id), Number(ing.cost_per_unit) || 0));

    const itemRecipes = recipes.filter((r: any) => String(r.menuItem_id) === String(menuItemId));
    let unitCogs = 0;
    itemRecipes.forEach((r: any) => {
        const cost = ingMap.get(String(r.ingredient_id)) || 0;
        const qtyReq = Number(r.quantity_required) || 0;
        unitCogs += cost * qtyReq;
    });
    unitCogs = Math.round(unitCogs);

    const unitProfit = price - unitCogs;
    const marginPercent = price > 0 ? ((price - unitCogs) / price) * 100 : 0;

    let classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';
    if (marginPercent >= 65) {
        classification = 'Star'; // Siêu lợi nhuận
    } else if (marginPercent >= 45) {
        classification = 'Plowhorse'; // Lợi nhuận chuẩn tốt
    } else if (marginPercent >= 30) {
        classification = 'Puzzle'; // Lợi nhuận trung bình
    } else {
        classification = 'Dog'; // Cảnh báo giá vốn cao
    }

    return {
        menuItemId,
        basePrice: price,
        unitCogs,
        unitProfit,
        marginPercent: Math.round(marginPercent * 10) / 10,
        classification
    };
};

/**
 * Ma trận kiểm tra tính hợp lệ của vòng đời chuyển trạng thái đơn hàng (State Machine)
 */
export const ORDER_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
    'Unconfirmed': ['Pending', 'Cancelled'],
    'Pending': ['Cooking', 'Cancelled'],
    'Cooking': ['Ready', 'Cancelled'],
    'Ready': ['Served', 'Cancelled'],
    'Served': ['Completed', 'Waiting_Payment'],
    'Waiting_Payment': ['Completed', 'Paid'],
    'Paid': ['Completed'],
    'Completed': [],
    'Cancelled': []
};

export const isValidOrderTransition = (fromStatus: string, toStatus: string): boolean => {
    if (fromStatus === toStatus) return true;
    const allowed = ORDER_LIFECYCLE_TRANSITIONS[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
};

/**
 * Gộp các món từ nhiều hóa đơn thành một danh sách duy nhất
 */
export const mergeOrderItems = (orderDetailsList: any[]): any[] => {
    const itemMap = new Map<string, any>();

    orderDetailsList.forEach(item => {
        const key = `${item.menuItem_id}_${item.notes || ''}_${item.variant_id || ''}`;
        if (itemMap.has(key)) {
            const existing = itemMap.get(key);
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        } else {
            itemMap.set(key, { ...item });
        }
    });

    return Array.from(itemMap.values());
};

/**
 * Tính toán số lượng nguyên liệu cần khấu trừ từ danh sách món ăn và biến thể
 */
export const calculateInventoryDeductions = (
    validDetails: any[],
    allRecipes: any[],
    allVariants: any[],
    allVarRecipes: any[]
): { [key: string]: number } => {
    const deductionMap: { [key: string]: number } = {};

    for (const detail of validDetails) {
        const qty = Number(detail.quantity) || 1;

        // A. Trừ nguyên liệu của MÓN CHÍNH
        const mainRecipes = allRecipes.filter((r: any) => String(r.menuItem_id) === String(detail.menuItem_id));
        mainRecipes.forEach((r: any) => {
            if (!deductionMap[r.ingredient_id]) deductionMap[r.ingredient_id] = 0;
            deductionMap[r.ingredient_id] += ((Number(r.quantity_required) || 0) * qty);
        });

        // B. Trừ nguyên liệu của BIẾN THỂ (Hỗ trợ cả variant_id trực tiếp và phân tích từ 'notes')
        const matchedVariants: any[] = [];
        if (detail.variant_id) {
            const vById = allVariants.find((v: any) => String(v.id) === String(detail.variant_id));
            if (vById) matchedVariants.push(vById);
        }
        if (detail.notes) {
            const itemVariants = allVariants.filter((v: any) => String(v.menuItem_id) === String(detail.menuItem_id));
            itemVariants.forEach((v: any) => {
                if (detail.notes.includes(v.name) && !matchedVariants.some((mv: any) => String(mv.id) === String(v.id))) {
                    matchedVariants.push(v);
                }
            });
        }

        matchedVariants.forEach((v: any) => {
            const varRecipes = allVarRecipes.filter((vr: any) => String(vr.variantId) === String(v.id));
            varRecipes.forEach((vr: any) => {
                if (!deductionMap[vr.ingredientId]) deductionMap[vr.ingredientId] = 0;
                deductionMap[vr.ingredientId] += ((Number(vr.quantity) || 0) * qty);
            });
        });
    }

    return deductionMap;
};
