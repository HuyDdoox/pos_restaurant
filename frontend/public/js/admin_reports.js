import { layTatCaDonHang, layDanhSachMonAn, layDanhSachDanhMuc } from './api';
import { API_ORDER_DETAILS_URL } from './config';
let currentReportBranch = '';
let currentReportPeriod = 'all';
export const initAdminReports = () => {
    const periodSelect = document.getElementById('report-period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            currentReportPeriod = periodSelect.value;
            loadReportData();
        });
    }
    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            exportReportToExcel();
        });
    }
};
export const setReportPeriod = (period) => {
    currentReportPeriod = period;
    const periodSelect = document.getElementById('report-period-select');
    if (periodSelect) {
        periodSelect.value = period;
    }
    loadReportData();
};
export const loadReportData = async (overrideBranchId) => {
    try {
        const branchSelector = document.getElementById('branch-selector');
        currentReportBranch = overrideBranchId !== undefined ? overrideBranchId : (branchSelector ? branchSelector.value : '');
        const periodSelect = document.getElementById('report-period-select');
        if (periodSelect) {
            currentReportPeriod = periodSelect.value;
        }
        setLoadingState(true);
        const [orders, menuItems, categories, detailsRes] = await Promise.all([
            layTatCaDonHang(currentReportBranch),
            layDanhSachMonAn(),
            layDanhSachDanhMuc(),
            fetch(API_ORDER_DETAILS_URL)
        ]);
        const allDetails = detailsRes.ok ? await detailsRes.json() : [];
        const filteredOrders = filterOrdersByPeriod(orders, currentReportPeriod);
        renderKPIs(filteredOrders, allDetails);
        renderWeeklyChart(filteredOrders, allDetails);
        renderBreakdowns(filteredOrders, allDetails, menuItems, categories);
        renderTopSellingItems(filteredOrders, allDetails, menuItems, categories);
        updatePeriodLabels();
        setLoadingState(false);
    }
    catch (e) {
        console.error("Lỗi khi load dữ liệu báo cáo:", e);
        setLoadingState(false);
    }
};
const setLoadingState = (isLoading) => {
    const kpis = ['report-revenue-amount', 'report-orders-count', 'report-avg-order', 'report-cancelled-count'];
    kpis.forEach(id => {
        const el = document.getElementById(id);
        if (el && isLoading) {
            el.classList.add('opacity-50', 'animate-pulse');
        }
        else if (el) {
            el.classList.remove('opacity-50', 'animate-pulse');
        }
    });
};
const filterOrdersByPeriod = (orders, period) => {
    const now = new Date();
    return orders.filter(o => {
        const orderDate = new Date(o.createdAt || Date.now());
        switch (period) {
            case 'today': {
                return orderDate.toDateString() === now.toDateString();
            }
            case '7days': {
                const diffTime = Math.abs(now.getTime() - orderDate.getTime());
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays <= 7;
            }
            case 'month_10': {
                return orderDate.getFullYear() === 2026 && orderDate.getMonth() === 9;
            }
            case 'month_9': {
                return orderDate.getFullYear() === 2026 && orderDate.getMonth() === 8;
            }
            case 'all':
            default:
                return true;
        }
    });
};
const getOrderTotal = (order, allDetails) => {
    if (order.totalAmount && order.totalAmount > 0)
        return order.totalAmount;
    const items = allDetails.filter(d => (d.order_id == order.id) && d.status !== 'Cancelled');
    return items.reduce((sum, it) => sum + (it.priceAtOrder || 0) * (it.quantity || 1), 0);
};
const renderKPIs = (orders, allDetails) => {
    const completedOrders = orders.filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid');
    const cancelledOrders = orders.filter(o => o.status === 'Cancelled');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + getOrderTotal(o, allDetails), 0);
    const orderCount = orders.length;
    const avgOrder = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;
    const cancelledCount = cancelledOrders.length;
    const cancelRate = orderCount > 0 ? ((cancelledCount / orderCount) * 100).toFixed(1) : '0';
    const elRev = document.getElementById('report-revenue-amount');
    const elOrders = document.getElementById('report-orders-count');
    const elAvg = document.getElementById('report-avg-order');
    const elCancel = document.getElementById('report-cancelled-count');
    const elCancelTrend = document.getElementById('report-cancelled-trend');
    if (elRev)
        elRev.innerHTML = `${totalRevenue.toLocaleString('vi-VN')} <span class="text-xs sm:text-sm font-bold text-slate-300 ml-1">đ</span>`;
    if (elOrders)
        elOrders.innerText = `${orderCount} đơn`;
    if (elAvg)
        elAvg.innerHTML = `${avgOrder.toLocaleString('vi-VN')} <span class="text-xs sm:text-sm font-bold text-slate-300 ml-1">đ</span>`;
    if (elCancel)
        elCancel.innerText = `${cancelledCount} đơn`;
    if (elCancelTrend)
        elCancelTrend.innerText = `Tỷ lệ hủy: ${cancelRate}%`;
};
const renderWeeklyChart = (orders, allDetails) => {
    const chartContainer = document.getElementById('report-weekly-chart');
    if (!chartContainer)
        return;
    const weeklyTotals = [0, 0, 0, 0];
    const completedOrders = orders.filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid');
    completedOrders.forEach(o => {
        const d = new Date(o.createdAt || Date.now());
        const day = d.getDate();
        const amt = getOrderTotal(o, allDetails);
        if (day <= 7)
            weeklyTotals[0] += amt;
        else if (day <= 14)
            weeklyTotals[1] += amt;
        else if (day <= 21)
            weeklyTotals[2] += amt;
        else
            weeklyTotals[3] += amt;
    });
    const maxWeekly = Math.max(...weeklyTotals, 1);
    const formatShortMoney = (val) => {
        if (val === 0)
            return '0đ';
        if (val >= 1000000)
            return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000)
            return (val / 1000).toFixed(0) + 'k';
        return val.toLocaleString('vi-VN') + 'đ';
    };
    chartContainer.innerHTML = weeklyTotals.map((total, idx) => {
        const heightPct = Math.max(10, Math.round((total / maxWeekly) * 100));
        const isMax = total === Math.max(...weeklyTotals) && total > 0;
        const barClass = isMax
            ? 'bg-orange-500 rounded-t-xl shadow-[0_0_15px_rgba(249,115,22,0.5)]'
            : total > 0
                ? 'bg-orange-500/70 border border-orange-500/50 rounded-t-xl'
                : 'bg-slate-700/40 rounded-t-xl';
        return `
            <div class="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span class="text-orange-400 text-xs font-black">${formatShortMoney(total)}</span>
                <div class="w-full ${barClass} transition-all duration-500" style="height: ${heightPct}%"></div>
                <span class="text-xs text-slate-400 font-bold">Tuần ${idx + 1}</span>
            </div>
        `;
    }).join('');
};
const renderBreakdowns = (orders, allDetails, menuItems, categories) => {
    const categoryContainer = document.getElementById('report-category-bars');
    const shiftContainer = document.getElementById('report-shift-bars');
    const completedOrderIds = orders.filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid').map(o => o.id);
    const validDetails = allDetails.filter(d => completedOrderIds.includes(d.order_id) && d.status !== 'Cancelled');
    if (categoryContainer) {
        const catMap = new Map();
        categories.forEach(c => catMap.set(c.id, c.name));
        const itemCatMap = new Map();
        menuItems.forEach(m => itemCatMap.set(m.id, m.category_id || 'Khác'));
        const catRevenue = {};
        let totalCatRev = 0;
        validDetails.forEach(d => {
            const catId = itemCatMap.get(d.menuItem_id) || 'Khác';
            const catName = catMap.get(catId) || 'Món ăn';
            const rev = (d.priceAtOrder || 0) * (d.quantity || 1);
            catRevenue[catName] = (catRevenue[catName] || 0) + rev;
            totalCatRev += rev;
        });
        const colors = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'];
        const entries = Object.entries(catRevenue);
        if (entries.length === 0) {
            categoryContainer.innerHTML = `
                <div class="text-xs text-slate-500 text-center py-4">Chưa có phát sinh món bán trong kỳ</div>
            `;
        }
        else {
            categoryContainer.innerHTML = entries.map(([catName, rev], idx) => {
                const pct = totalCatRev > 0 ? Math.round((rev / totalCatRev) * 100) : 0;
                const color = colors[idx % colors.length];
                return `
                    <div>
                        <div class="flex justify-between text-sm font-bold mb-1.5">
                            <span class="text-slate-300">${catName}</span>
                            <span class="text-white">${pct}% (${rev.toLocaleString('vi-VN')} đ)</span>
                        </div>
                        <div class="w-full bg-slate-700 rounded-full h-2.5">
                            <div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
    if (shiftContainer) {
        let countSang = 0, countChieu = 0, countToi = 0;
        const total = orders.length;
        orders.forEach(o => {
            const h = new Date(o.createdAt || Date.now()).getHours();
            if (h >= 8 && h < 14)
                countSang++;
            else if (h >= 14 && h < 20)
                countChieu++;
            else
                countToi++;
        });
        const pctSang = total > 0 ? Math.round((countSang / total) * 100) : 0;
        const pctChieu = total > 0 ? Math.round((countChieu / total) * 100) : 0;
        const pctToi = total > 0 ? Math.round((countToi / total) * 100) : 0;
        shiftContainer.innerHTML = `
            <div class="flex justify-between text-sm"><span class="text-slate-400 font-bold">Ca sáng (8–14h)</span><span class="text-white font-black">${pctSang}% (${countSang} đơn)</span></div>
            <div class="flex justify-between text-sm"><span class="text-slate-400 font-bold">Ca chiều (14–20h)</span><span class="text-white font-black">${pctChieu}% (${countChieu} đơn)</span></div>
            <div class="flex justify-between text-sm"><span class="text-slate-400 font-bold">Ca tối (20–22h)</span><span class="text-white font-black">${pctToi}% (${countToi} đơn)</span></div>
        `;
    }
};
let currentTopItemsForExport = [];
const renderTopSellingItems = (orders, allDetails, menuItems, categories) => {
    const tbody = document.getElementById('report-top-items-body');
    if (!tbody)
        return;
    const completedOrderIds = orders.filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid').map(o => o.id);
    const validDetails = allDetails.filter(d => completedOrderIds.includes(d.order_id) && d.status !== 'Cancelled');
    const itemMap = new Map();
    menuItems.forEach(m => itemMap.set(m.id, m));
    const catMap = new Map();
    categories.forEach(c => catMap.set(c.id, c.name));
    const itemStats = {};
    validDetails.forEach(d => {
        const item = itemMap.get(d.menuItem_id);
        const name = item ? item.name : (d.menuItem_id || 'Món');
        const catName = (item && item.category_id && catMap.get(item.category_id)) || 'Món chính';
        const qty = d.quantity || 1;
        const rev = (d.priceAtOrder || 0) * qty;
        if (!itemStats[d.menuItem_id]) {
            itemStats[d.menuItem_id] = { name, catName, quantity: 0, revenue: 0 };
        }
        itemStats[d.menuItem_id].quantity += qty;
        itemStats[d.menuItem_id].revenue += rev;
    });
    const sorted = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
    currentTopItemsForExport = sorted;
    if (sorted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10 text-center text-slate-500 font-bold">
                    Chưa có món nào được ghi nhận bán ra trong chu kỳ này
                </td>
            </tr>
        `;
        return;
    }
    const maxQty = sorted[0]?.quantity || 1;
    tbody.innerHTML = sorted.slice(0, 10).map((it, idx) => {
        const pct = Math.max(10, Math.round((it.quantity / maxQty) * 100));
        let badge = `<span class="text-slate-400 font-bold px-2">${idx + 1}</span>`;
        let barColor = 'bg-blue-400';
        if (idx === 0) {
            badge = `<div class="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black text-sm">1</div>`;
            barColor = 'bg-orange-500';
        }
        else if (idx === 1) {
            badge = `<div class="w-7 h-7 bg-slate-500 rounded-lg flex items-center justify-center text-white font-black text-sm">2</div>`;
            barColor = 'bg-slate-400';
        }
        else if (idx === 2) {
            badge = `<div class="w-7 h-7 bg-amber-700 rounded-lg flex items-center justify-center text-white font-black text-sm">3</div>`;
            barColor = 'bg-amber-500';
        }
        return `
            <tr class="hover:bg-slate-700/10 transition-colors border-b border-slate-700/40">
                <td class="px-6 py-4 whitespace-nowrap">${badge}</td>
                <td class="px-6 py-4 font-bold text-white whitespace-nowrap">${it.name}</td>
                <td class="px-6 py-4 text-slate-400 whitespace-nowrap">${it.catName}</td>
                <td class="px-6 py-4 text-right font-black text-white whitespace-nowrap">${it.quantity}</td>
                <td class="px-6 py-4 text-right font-black text-orange-400 whitespace-nowrap">${it.revenue.toLocaleString('vi-VN')} đ</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="w-24 bg-slate-700 rounded-full h-2">
                        <div class="${barColor} h-2 rounded-full" style="width: ${pct}%"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};
const updatePeriodLabels = () => {
    const periodSelect = document.getElementById('report-period-select');
    const labelText = periodSelect ? periodSelect.options[periodSelect.selectedIndex]?.text || '' : '';
    const chartTitle = document.getElementById('report-chart-title');
    const topBadge = document.getElementById('report-top-badge');
    if (chartTitle)
        chartTitle.innerText = `Doanh thu theo tuần (${labelText})`;
    if (topBadge)
        topBadge.innerText = labelText;
};
const exportReportToExcel = () => {
    if (currentTopItemsForExport.length === 0) {
        alert("Không có dữ liệu trong chu kỳ được chọn để xuất!");
        return;
    }
    const periodSelect = document.getElementById('report-period-select');
    const labelText = periodSelect ? periodSelect.options[periodSelect.selectedIndex]?.text || 'Ky' : 'Ky';
    let csv = '\uFEFF';
    csv += `BÁO CÁO MÓN BÁN CHẠY - ${labelText}\r\n`;
    csv += `STT,Tên món,Danh mục,Số lượng bán,Doanh thu (VNĐ)\r\n`;
    currentTopItemsForExport.forEach((it, idx) => {
        csv += `"${idx + 1}","${it.name}","${it.catName}","${it.quantity}","${it.revenue}"\r\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Doanh_Thu_${labelText.replace(/[\/\s:]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
