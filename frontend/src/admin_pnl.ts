import { 
    layTatCaDonHang, 
    layTatCaChiTietDon, 
    layDanhSachMonAn, 
    layDanhSachDanhMuc,
    layDanhSachIngredients,
    layDanhSachRecipes
} from './api';

// Cache
let cachedIngredients: any[] = [];
let cachedRecipes: any[] = [];
let cachedCategories: any[] = [];
let currentPnlPeriod: 'today' | 'week' | 'all' = 'today';
let pnlSearchKeyword = '';
type PnlKpiSort = 'revenue' | 'cogs' | 'profit' | 'margin' | null;
let currentPnlKpiSort: PnlKpiSort = null;
let pnlSortDirection: 'desc' | 'asc' = 'desc';

const formatMoney = (amount: number): string => {
    return Math.round(amount || 0).toLocaleString('vi-VN').replace(/\./g, ' ');
};

export const calculateDishCOGS = (menuItemId: string, recipes: any[], ingredients: any[], menuItem?: any): number => {
    const fallbackCost = Number(menuItem?.cost_price) || 0;
    if (!recipes || !ingredients || recipes.length === 0) return fallbackCost;
    const ingMap = new Map<string, number>();
    ingredients.forEach((ing: any) => {
        const id = String(ing.id || ing._id);
        ingMap.set(id, Number(ing.cost_per_unit || ing.cost_price) || 0);
    });

    const targetId = String(menuItemId);
    const itemRecipes = recipes.filter((r: any) => {
        const rMid = String(r.menuItem_id?._id || r.menuItem_id?.id || r.menuItem_id);
        return rMid === targetId;
    });

    if (itemRecipes.length === 0) return fallbackCost;

    let cogs = 0;
    itemRecipes.forEach((r: any) => {
        const rIngId = String(r.ingredient_id?._id || r.ingredient_id?.id || r.ingredient_id);
        const costPerUnit = ingMap.get(rIngId) || 0;
        const qtyReq = Number(r.quantity_required) || 0;
        cogs += costPerUnit * qtyReq;
    });

    const finalCogs = Math.round(cogs);
    return finalCogs > 0 ? finalCogs : fallbackCost;
};

export const updateAdminPnlKpiCardStyles = () => {
    const kpiCards: { [key: string]: { id: string; badgeId: string; activeClasses: string[]; activeBadgeClass: string; label: string } } = {
        revenue: {
            id: 'card-admin-pnl-revenue',
            badgeId: 'card-admin-badge-revenue',
            activeClasses: ['ring-2', 'ring-blue-500', 'border-blue-500', 'bg-blue-500/10', 'shadow-blue-500/20'],
            activeBadgeClass: 'bg-blue-500 text-white',
            label: 'Doanh thu'
        },
        cogs: {
            id: 'card-admin-pnl-cogs',
            badgeId: 'card-admin-badge-cogs',
            activeClasses: ['ring-2', 'ring-rose-500', 'border-rose-500', 'bg-rose-500/10', 'shadow-rose-500/20'],
            activeBadgeClass: 'bg-rose-500 text-white',
            label: 'Giá vốn'
        },
        profit: {
            id: 'card-admin-pnl-profit',
            badgeId: 'card-admin-badge-profit',
            activeClasses: ['ring-2', 'ring-emerald-500', 'border-emerald-500', 'bg-emerald-500/10', 'shadow-emerald-500/20'],
            activeBadgeClass: 'bg-emerald-500 text-white',
            label: 'Lợi nhuận'
        },
        margin: {
            id: 'card-admin-pnl-margin',
            badgeId: 'card-admin-badge-margin',
            activeClasses: ['ring-2', 'ring-orange-500', 'border-orange-500', 'bg-orange-500/10', 'shadow-orange-500/20'],
            activeBadgeClass: 'bg-orange-500 text-white',
            label: 'Tỷ suất Margin'
        }
    };

    const sortIndicator = document.getElementById('admin-pnl-active-sort-indicator');
    const sortText = document.getElementById('admin-pnl-active-sort-text');

    Object.keys(kpiCards).forEach(key => {
        const item = kpiCards[key];
        const card = document.getElementById(item.id);
        const badge = document.getElementById(item.badgeId);
        const isActive = currentPnlKpiSort === key;

        if (card) {
            item.activeClasses.forEach(cls => {
                if (isActive) card.classList.add(cls);
                else card.classList.remove(cls);
            });
        }

        if (badge) {
            if (isActive) {
                badge.className = `inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${item.activeBadgeClass} mt-1 transition-all shadow-sm`;
                badge.innerHTML = `<i class="fa-solid fa-arrow-${pnlSortDirection === 'desc' ? 'down' : 'up'}-wide-short text-[9px]"></i> Đang xếp: ${pnlSortDirection === 'desc' ? 'Cao nhất' : 'Thấp nhất'}`;
            } else {
                badge.className = 'inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 mt-1 transition-all whitespace-nowrap';
                badge.innerHTML = '<i class="fa-solid fa-arrow-down-wide-short text-[9px]"></i> Nhấn để lọc';
            }
        }
    });

    if (currentPnlKpiSort && sortIndicator && sortText) {
        sortIndicator.classList.remove('hidden');
        sortIndicator.classList.add('inline-flex');
        const dirLabel = pnlSortDirection === 'desc' ? 'cao nhất' : 'thấp nhất';
        sortText.innerText = `Đang xếp: ${kpiCards[currentPnlKpiSort].label} ${dirLabel}`;
    } else if (sortIndicator) {
        sortIndicator.classList.add('hidden');
        sortIndicator.classList.remove('inline-flex');
    }
};

export const handleAdminPnlKpiCardClick = (kpi: 'revenue' | 'cogs' | 'profit' | 'margin') => {
    if (currentPnlKpiSort === kpi) {
        pnlSortDirection = pnlSortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        currentPnlKpiSort = kpi;
        pnlSortDirection = 'desc';
    }

    updateAdminPnlKpiCardStyles();
    updateAdminPnlReport();

    const tableSec = document.getElementById('admin-pnl-table-section');
    if (tableSec) {
        tableSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

export const updateAdminPnlReport = async () => {
    const tbody = document.getElementById('admin-pnl-dish-tbody');
    if (!tbody) return;

    try {
        if (cachedIngredients.length === 0) cachedIngredients = await layDanhSachIngredients();
        if (cachedRecipes.length === 0) cachedRecipes = await layDanhSachRecipes();
        if (cachedCategories.length === 0) cachedCategories = await layDanhSachDanhMuc();
    } catch (e) {
        console.error("Lỗi cache dữ liệu P&L Admin:", e);
    }

    const allOrders = await layTatCaDonHang();
    const allDetails = await layTatCaChiTietDon();
    const allMenu = await layDanhSachMonAn();

    const todayStr = new Date().toDateString();
    const now = new Date();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    const filteredOrders = allOrders.filter((o: any) => {
        const isPaid = o.paymentStatus === 'Paid' || o.status === 'Completed';
        if (!isPaid) return false;

        const orderTime = new Date(o.createdAt).getTime();
        if (currentPnlPeriod === 'today') {
            return new Date(o.createdAt).toDateString() === todayStr;
        } else if (currentPnlPeriod === 'week') {
            return orderTime >= sevenDaysAgo;
        }
        return true; // 'all'
    });

    const paidOrderIds = new Set(filteredOrders.map((o: any) => String(o.id)));
    const paidDetails = allDetails.filter((d: any) => paidOrderIds.has(String(d.order_id)));

    const dishSalesMap = new Map<string, { soldQty: number; revenue: number }>();
    paidDetails.forEach((d: any) => {
        if (d.status === 'Cancelled') return;
        const current = dishSalesMap.get(d.menuItem_id) || { soldQty: 0, revenue: 0 };
        current.soldQty += Number(d.quantity) || 1;
        const linePrice = (Number(d.priceAtOrder) || 0) * (Number(d.quantity) || 1);
        current.revenue += linePrice;
        dishSalesMap.set(d.menuItem_id, current);
    });

    let totalOrdersCompleted = filteredOrders.length;
    let totalRevenue = 0;
    filteredOrders.forEach((o: any) => {
        let ordTotal = Number(o.totalAmount) || 0;
        if (ordTotal <= 0) {
            const ordItems = paidDetails.filter((d: any) => String(d.order_id) === String(o.id) && d.status !== 'Cancelled');
            ordTotal = ordItems.reduce((sum: number, it: any) => sum + (Number(it.priceAtOrder) || 0) * (Number(it.quantity) || 1), 0);
        }
        totalRevenue += ordTotal;
    });

    let totalCOGS = 0;
    const catMap = new Map<string, string>();
    cachedCategories.forEach((c: any) => {
        catMap.set(String(c.id || c._id), c.name);
    });

    interface PnlDishRow {
        id: string;
        name: string;
        categoryName: string;
        price: number;
        cogs: number;
        unitProfit: number;
        soldQty: number;
        totalRevenue: number;
        totalCogs: number;
        grossProfit: number;
        marginPercent: number;
    }

    const dishRows: PnlDishRow[] = allMenu.map((item: any) => {
        const dishCogs = calculateDishCOGS(item.id, cachedRecipes, cachedIngredients, item);
        const sales = dishSalesMap.get(item.id) || { soldQty: 0, revenue: 0 };
        const unitProfit = item.base_price - dishCogs;
        const itemTotalCogs = dishCogs * sales.soldQty;
        const itemGrossProfit = sales.revenue - itemTotalCogs;
        const itemMargin = sales.revenue > 0 
            ? Math.round((itemGrossProfit / sales.revenue) * 1000) / 10 
            : (item.base_price > 0 ? Math.round((unitProfit / item.base_price) * 1000) / 10 : 0);

        totalCOGS += itemTotalCogs;

        const resolvedCatName = (typeof item.category_id === 'object' && item.category_id?.name)
            ? item.category_id.name
            : (catMap.get(String(item.category_id?._id || item.category_id?.id || item.category_id)) || (item.is_combo ? 'Combo Tiệc Âu' : 'Món chính'));

        return {
            id: item.id,
            name: item.name,
            categoryName: resolvedCatName,
            price: item.base_price,
            cogs: dishCogs,
            unitProfit: unitProfit,
            soldQty: sales.soldQty,
            totalRevenue: sales.revenue,
            totalCogs: itemTotalCogs,
            grossProfit: itemGrossProfit,
            marginPercent: itemMargin
        };
    });

    const overallGrossProfit = totalRevenue - totalCOGS;
    const overallMargin = totalRevenue > 0 ? Math.round((overallGrossProfit / totalRevenue) * 1000) / 10 : 0;
    const avgOrder = totalOrdersCompleted > 0 ? Math.round(totalRevenue / totalOrdersCompleted) : 0;
    const avgCogs = totalOrdersCompleted > 0 ? Math.round(totalCOGS / totalOrdersCompleted) : 0;
    const avgProfit = totalOrdersCompleted > 0 ? Math.round(overallGrossProfit / totalOrdersCompleted) : 0;

    // Render KPI Cards
    const revEl = document.getElementById('admin-pnl-net-revenue');
    const cogsEl = document.getElementById('admin-pnl-cogs');
    const profitEl = document.getElementById('admin-pnl-gross-profit');
    const marginEl = document.getElementById('admin-pnl-margin-percent');
    const marginHealthEl = document.getElementById('admin-pnl-margin-health');
    const ordersEl = document.getElementById('admin-pnl-orders-count');
    const avgOrderEl = document.getElementById('admin-pnl-avg-order');
    const avgCogsEl = document.getElementById('admin-pnl-avg-cogs');
    const avgProfitEl = document.getElementById('admin-pnl-avg-profit');

    if (revEl) revEl.innerHTML = `${formatMoney(totalRevenue)}&nbsp;đ`;
    if (cogsEl) cogsEl.innerHTML = `${formatMoney(totalCOGS)}&nbsp;đ`;
    if (profitEl) profitEl.innerHTML = `${formatMoney(overallGrossProfit)}&nbsp;đ`;
    if (marginEl) marginEl.innerText = `${overallMargin.toFixed(1)}%`;
    if (ordersEl) ordersEl.innerText = totalOrdersCompleted.toString();
    if (avgOrderEl) avgOrderEl.innerHTML = `${formatMoney(avgOrder)}&nbsp;đ`;
    if (avgCogsEl) avgCogsEl.innerHTML = `${formatMoney(avgCogs)}&nbsp;đ`;
    if (avgProfitEl) avgProfitEl.innerHTML = `${formatMoney(avgProfit)}&nbsp;đ`;

    if (marginHealthEl) {
        if (totalRevenue === 0) {
            marginHealthEl.innerText = 'Chưa có giao dịch trong chu kỳ này';
            marginHealthEl.className = 'text-xs text-slate-400 font-bold whitespace-nowrap truncate';
        } else if (overallMargin >= 65) {
            marginHealthEl.innerText = 'Tỷ suất rất cao (Chuẩn F&B cao cấp)';
            marginHealthEl.className = 'text-xs text-emerald-400 font-bold whitespace-nowrap truncate';
        } else if (overallMargin >= 50) {
            marginHealthEl.innerText = 'Tỷ suất tốt (Đạt mục tiêu)';
            marginHealthEl.className = 'text-xs text-blue-400 font-bold whitespace-nowrap truncate';
        } else {
            marginHealthEl.innerText = 'Cảnh báo: Biên lợi nhuận thấp, cần tối ưu COGS';
            marginHealthEl.className = 'text-xs text-rose-400 font-bold whitespace-nowrap truncate';
        }
    }

    // Filter by search keyword
    let displayRows = dishRows;
    if (pnlSearchKeyword.trim()) {
        const kw = pnlSearchKeyword.toLowerCase().trim();
        displayRows = displayRows.filter(r => 
            r.name.toLowerCase().includes(kw) || 
            r.categoryName.toLowerCase().includes(kw) ||
            r.id.toLowerCase().includes(kw)
        );
    }

    // Sort table rows
    if (currentPnlKpiSort) {
        displayRows.sort((a, b) => {
            let valA = 0;
            let valB = 0;
            if (currentPnlKpiSort === 'revenue') {
                valA = a.totalRevenue;
                valB = b.totalRevenue;
            } else if (currentPnlKpiSort === 'cogs') {
                valA = a.totalCogs;
                valB = b.totalCogs;
            } else if (currentPnlKpiSort === 'profit') {
                valA = a.grossProfit;
                valB = b.grossProfit;
            } else if (currentPnlKpiSort === 'margin') {
                valA = a.marginPercent;
                valB = b.marginPercent;
            }
            return pnlSortDirection === 'desc' ? valB - valA : valA - valB;
        });
    } else {
        displayRows.sort((a, b) => {
            if (b.soldQty !== a.soldQty) return b.soldQty - a.soldQty;
            return b.grossProfit - a.grossProfit;
        });
    }

    // Render table rows
    let tbodyHtml = '';
    displayRows.forEach(row => {
        let marginBadge = '';
        if (row.marginPercent >= 70) {
            marginBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Siêu lợi nhuận</span>`;
        } else if (row.marginPercent >= 55) {
            marginBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Lợi nhuận tốt</span>`;
        } else {
            marginBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">Cần tối ưu</span>`;
        }

        tbodyHtml += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 whitespace-nowrap">
                    <div class="font-bold text-slate-900 text-xs whitespace-nowrap">${row.name}</div>
                    <div class="text-[10px] text-slate-500 font-mono whitespace-nowrap">#${row.id}</div>
                </td>
                <td class="py-3 px-3 text-slate-600 text-xs whitespace-nowrap">${row.categoryName}</td>
                <td class="py-3 px-3 text-right font-mono text-slate-800 text-xs whitespace-nowrap">${formatMoney(row.price)}&nbsp;đ</td>
                <td class="py-3 px-3 text-right font-mono text-rose-600 text-xs whitespace-nowrap">${formatMoney(row.cogs)}&nbsp;đ</td>
                <td class="py-3 px-3 text-right font-mono text-emerald-700 text-xs whitespace-nowrap font-bold">${formatMoney(row.unitProfit)}&nbsp;đ</td>
                <td class="py-3 px-3 text-center whitespace-nowrap font-mono">
                    <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">${row.soldQty}</span>
                </td>
                <td class="py-3 px-3 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">${formatMoney(row.totalRevenue)}&nbsp;đ</td>
                <td class="py-3 px-3 text-right font-mono text-slate-600 text-xs whitespace-nowrap">${formatMoney(row.totalCogs)}&nbsp;đ</td>
                <td class="py-3 px-3 text-right font-mono font-black text-emerald-700 text-xs whitespace-nowrap">${formatMoney(row.grossProfit)}&nbsp;đ</td>
                <td class="py-3 px-3 text-center font-mono font-bold text-xs text-orange-600 whitespace-nowrap">${row.marginPercent.toFixed(1)}%</td>
                <td class="py-3 px-4 text-center whitespace-nowrap">${marginBadge}</td>
            </tr>
        `;
    });

    if (displayRows.length === 0) {
        tbodyHtml = `<tr><td colspan="11" class="text-center py-8 text-slate-500 font-semibold text-xs">Không tìm thấy món ăn nào phù hợp với từ khóa "${pnlSearchKeyword}"</td></tr>`;
    }
    tbody.innerHTML = tbodyHtml;

    // Render Top 5 Profit
    const topProfitContainer = document.getElementById('admin-pnl-top-profit-items');
    if (topProfitContainer) {
        const topProfits = [...dishRows].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5);
        let topProfitHtml = '';
        const maxProfit = topProfits.length > 0 && topProfits[0].grossProfit > 0 ? topProfits[0].grossProfit : 1;

        topProfits.forEach((item, index) => {
            const pct = Math.max(5, Math.min(100, Math.round((item.grossProfit / maxProfit) * 100)));
            topProfitHtml += `
                <div>
                    <div class="flex justify-between items-center text-xs mb-1">
                        <span class="font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap truncate max-w-[200px]">
                            <span class="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-black text-[10px] flex items-center justify-center shrink-0 border border-amber-200">${index + 1}</span>
                            ${item.name}
                        </span>
                        <div class="text-right whitespace-nowrap font-mono">
                            <span class="font-black text-emerald-700 text-xs">${formatMoney(item.grossProfit)}&nbsp;đ</span>
                            <span class="text-[10px] text-slate-500 ml-1">(${item.soldQty} phần)</span>
                        </div>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        });
        topProfitContainer.innerHTML = topProfitHtml || '<div class="text-slate-500 text-xs text-center py-4">Chưa có dữ liệu</div>';
    }

    // Render Top 5 Margin
    const topMarginContainer = document.getElementById('admin-pnl-top-margin-items');
    if (topMarginContainer) {
        const topMargins = [...dishRows].sort((a, b) => b.marginPercent - a.marginPercent).slice(0, 5);
        let topMarginHtml = '';

        topMargins.forEach((item, index) => {
            const pct = Math.max(5, Math.min(100, Math.round(item.marginPercent)));
            topMarginHtml += `
                <div>
                    <div class="flex justify-between items-center text-xs mb-1">
                        <span class="font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap truncate max-w-[200px]">
                            <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center shrink-0 border border-emerald-200">${index + 1}</span>
                            ${item.name}
                        </span>
                        <div class="text-right whitespace-nowrap font-mono">
                            <span class="font-black text-orange-600 text-xs">${item.marginPercent.toFixed(1)}%</span>
                            <span class="text-[10px] text-slate-400 ml-1">COGS: ${formatMoney(item.cogs)}&nbsp;đ</span>
                        </div>
                    </div>
                    <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-gradient-to-r from-emerald-500 to-orange-500 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        });
        topMarginContainer.innerHTML = topMarginHtml || '<div class="text-slate-500 text-xs text-center py-4">Chưa có dữ liệu</div>';
    }
};

export const printAdminPnlReport = () => {
    const revEl = document.getElementById('admin-pnl-net-revenue');
    const cogsEl = document.getElementById('admin-pnl-cogs');
    const profitEl = document.getElementById('admin-pnl-gross-profit');
    const marginEl = document.getElementById('admin-pnl-margin-percent');
    const ordersEl = document.getElementById('admin-pnl-orders-count');
    const printArea = document.getElementById('admin-pnl-print-area');
    const overlay = document.getElementById('admin-overlay-pnl-print');

    if (!printArea || !overlay) {
        window.print();
        return;
    }

    const periodLabel = currentPnlPeriod === 'today' ? 'HÔM NAY' : (currentPnlPeriod === 'week' ? '7 NGÀY QUA' : 'TOÀN BỘ THỜI GIAN');

    printArea.innerHTML = `
        <div class="text-center mb-3">
            <h2 class="text-xl font-black uppercase mb-0.5 tracking-tight text-slate-900">FOODHUB RESTAURANT</h2>
            <p class="text-[10px] text-gray-500">123 Lê Lợi, Bến Nghé, Quận 1, TP.HCM</p>
            <p class="text-[10px] text-gray-500">Hotline: 0901.234.567</p>
        </div>
        <div class="text-center font-black border-y border-dashed border-gray-400 py-1.5 mb-3 uppercase text-sm tracking-wider text-slate-900">
            BÁO CÁO TÀI CHÍNH & LỢI NHUẬN GỘP (P&L)
        </div>
        <div class="text-[11px] space-y-1 mb-3 text-slate-700">
            <div class="flex justify-between"><span class="text-gray-500">Chu kỳ báo cáo:</span><span class="font-bold text-slate-900">${periodLabel}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Thời gian in:</span><span class="font-bold text-slate-900">${new Date().toLocaleString('vi-VN')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Người lập báo cáo:</span><span class="font-bold text-slate-900">Quản trị viên FoodHub</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Số đơn hoàn tất:</span><span class="font-bold text-slate-900">${ordersEl?.innerText || '0'}</span></div>
        </div>
        <div class="border-t border-dashed border-gray-400 py-3 space-y-2 text-xs text-slate-800">
            <div class="flex justify-between"><span class="font-bold">Doanh thu thuần:</span><span class="font-black text-sm text-slate-900">${revEl?.innerText || '0 đ'}</span></div>
            <div class="flex justify-between"><span class="text-gray-600">Giá vốn nguyên liệu (COGS):</span><span class="font-bold text-rose-600">${cogsEl?.innerText || '0 đ'}</span></div>
            <div class="flex justify-between text-black font-black border-t border-gray-300 pt-1">
                <span>LỢI NHUẬN GỘP:</span>
                <span class="text-sm text-emerald-700">${profitEl?.innerText || '0 đ'}</span>
            </div>
            <div class="flex justify-between font-bold pt-1">
                <span>TỶ SUẤT GROSS MARGIN:</span>
                <span class="text-sm text-orange-600">${marginEl?.innerText || '0%'}</span>
            </div>
        </div>
        <div class="border-t border-dashed border-gray-400 pt-3 text-center text-[10px] text-gray-500 space-y-1">
            <p>Báo cáo tự động tính từ Định lượng Nguyên liệu (Recipes)</p>
            <p class="font-bold text-slate-700">FoodHub POS System - Kế Toán Quản Trị & Ban Giám Đốc</p>
        </div>
        <div class="mt-4 flex gap-2 no-print">
            <button id="btn-admin-exec-print" class="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs transition">In ngay</button>
            <button id="btn-admin-dismiss-print" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-xs transition">Đóng</button>
        </div>
    `;

    document.getElementById('btn-admin-exec-print')?.addEventListener('click', () => {
        window.print();
    });
    document.getElementById('btn-admin-dismiss-print')?.addEventListener('click', () => {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    });

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
};

export const initAdminPnl = () => {
    // Period buttons
    document.querySelectorAll('.btn-admin-pnl-period').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const period = target.getAttribute('data-period') as 'today' | 'week' | 'all';
            if (!period) return;
            currentPnlPeriod = period;

            document.querySelectorAll('.btn-admin-pnl-period').forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white');
                b.classList.add('text-slate-400');
            });
            target.classList.add('bg-orange-500', 'text-white');
            target.classList.remove('text-slate-400');

            updateAdminPnlReport();
        });
    });

    // Search dish
    document.getElementById('admin-pnl-search-dish')?.addEventListener('input', (e) => {
        pnlSearchKeyword = (e.target as HTMLInputElement).value || '';
        updateAdminPnlReport();
    });

    // Print button
    document.getElementById('btn-admin-print-pnl')?.addEventListener('click', () => {
        printAdminPnlReport();
    });

    // Close print overlay
    document.getElementById('btn-admin-close-pnl-print')?.addEventListener('click', () => {
        const overlay = document.getElementById('admin-overlay-pnl-print');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    });

    // KPI cards and column header clicks
    const kpis: ('revenue' | 'cogs' | 'profit' | 'margin')[] = ['revenue', 'cogs', 'profit', 'margin'];
    kpis.forEach(kpi => {
        document.getElementById(`card-admin-pnl-${kpi}`)?.addEventListener('click', () => {
            handleAdminPnlKpiCardClick(kpi);
        });
        document.getElementById(`th-admin-pnl-${kpi}`)?.addEventListener('click', () => {
            handleAdminPnlKpiCardClick(kpi);
        });
    });

    // Reset sort button
    document.getElementById('btn-admin-pnl-reset-sort')?.addEventListener('click', () => {
        currentPnlKpiSort = null;
        pnlSortDirection = 'desc';
        updateAdminPnlKpiCardStyles();
        updateAdminPnlReport();
    });

    (window as any).updateAdminPnlReport = updateAdminPnlReport;
};
