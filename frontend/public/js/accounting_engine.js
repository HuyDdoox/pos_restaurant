export const calculateBillAccounting = (subtotal, discountPercent = 0, serviceChargeRate = 0, vatRate = 0.08) => {
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
export const calculateCashChange = (cashGiven, finalTotal) => {
    const given = Math.max(0, Math.round(cashGiven || 0));
    const total = Math.max(0, Math.round(finalTotal || 0));
    const change = given - total;
    return {
        change,
        isValid: change >= 0,
        isExact: change === 0
    };
};
export const calculateEqualSplit = (finalTotal, parts) => {
    const validParts = Math.max(1, Math.floor(parts || 1));
    const total = Math.max(0, Math.round(finalTotal || 0));
    const baseShare = Math.floor(total / validParts);
    const remainder = total - (baseShare * validParts);
    const shares = [];
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
export const calculateDishProfitability = (basePrice, menuItemId, recipes, ingredients) => {
    const price = Math.max(0, Number(basePrice) || 0);
    const ingMap = new Map();
    ingredients.forEach((ing) => ingMap.set(String(ing.id), Number(ing.cost_per_unit) || 0));
    const itemRecipes = recipes.filter((r) => String(r.menuItem_id) === String(menuItemId));
    let unitCogs = 0;
    itemRecipes.forEach((r) => {
        const cost = ingMap.get(String(r.ingredient_id)) || 0;
        const qtyReq = Number(r.quantity_required) || 0;
        unitCogs += cost * qtyReq;
    });
    unitCogs = Math.round(unitCogs);
    const unitProfit = price - unitCogs;
    const marginPercent = price > 0 ? ((price - unitCogs) / price) * 100 : 0;
    let classification;
    if (marginPercent >= 65) {
        classification = 'Star';
    }
    else if (marginPercent >= 45) {
        classification = 'Plowhorse';
    }
    else if (marginPercent >= 30) {
        classification = 'Puzzle';
    }
    else {
        classification = 'Dog';
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
export const ORDER_LIFECYCLE_TRANSITIONS = {
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
export const isValidOrderTransition = (fromStatus, toStatus) => {
    if (fromStatus === toStatus)
        return true;
    const allowed = ORDER_LIFECYCLE_TRANSITIONS[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
};
export const mergeOrderItems = (orderDetailsList) => {
    const itemMap = new Map();
    orderDetailsList.forEach(item => {
        const key = `${item.menuItem_id}_${item.notes || ''}_${item.variant_id || ''}`;
        if (itemMap.has(key)) {
            const existing = itemMap.get(key);
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        }
        else {
            itemMap.set(key, { ...item });
        }
    });
    return Array.from(itemMap.values());
};
export const calculateInventoryDeductions = (validDetails, allRecipes, allVariants, allVarRecipes) => {
    const deductionMap = {};
    for (const detail of validDetails) {
        const qty = Number(detail.quantity) || 1;
        const mainRecipes = allRecipes.filter((r) => String(r.menuItem_id) === String(detail.menuItem_id));
        mainRecipes.forEach((r) => {
            if (!deductionMap[r.ingredient_id])
                deductionMap[r.ingredient_id] = 0;
            deductionMap[r.ingredient_id] += ((Number(r.quantity_required) || 0) * qty);
        });
        const matchedVariants = [];
        if (detail.variant_id) {
            const vById = allVariants.find((v) => String(v.id) === String(detail.variant_id));
            if (vById)
                matchedVariants.push(vById);
        }
        if (detail.notes) {
            const itemVariants = allVariants.filter((v) => String(v.menuItem_id) === String(detail.menuItem_id));
            itemVariants.forEach((v) => {
                if (detail.notes.includes(v.name) && !matchedVariants.some((mv) => String(mv.id) === String(v.id))) {
                    matchedVariants.push(v);
                }
            });
        }
        matchedVariants.forEach((v) => {
            const varRecipes = allVarRecipes.filter((vr) => String(vr.variantId) === String(v.id));
            varRecipes.forEach((vr) => {
                if (!deductionMap[vr.ingredientId])
                    deductionMap[vr.ingredientId] = 0;
                deductionMap[vr.ingredientId] += ((Number(vr.quantity) || 0) * qty);
            });
        });
    }
    return deductionMap;
};
