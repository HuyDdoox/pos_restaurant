import { showConfirmModal, showSuccessToast } from './utils/ui';
import { layDanhSachBan, capNhatTrangThaiBan, capNhatDonHang, taoCaLamViec, ketThucCaLamViec, layChiTietCuaDon, layDanhSachMonAn, layDanhSachHoaDonChuaThanhToan, taoChiTietDonHang, layTatCaDonHang } from './api';
import { deductInventoryForOrder } from './inventory_engine';
import { MenuItem } from './interfaces';

let currentShiftId = localStorage.getItem('current_shift_id');
let unpaidOrders: any[] = [];
let menuItems: MenuItem[] = [];
let selectedOrder: any = null;

const TABLES = Array.from({length: 15}, (_, i) => `T${(i + 1).toString().padStart(3, '0')}`);

const formatMoney = (amount: number) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const setupShiftUI = () => {
    const overlay = document.getElementById('overlay-shift');
    const mainWorkspace = document.getElementById('main-workspace');
    if (currentShiftId) {
        overlay?.classList.add('hidden');
        overlay?.classList.remove('flex');
        mainWorkspace?.classList.remove('hidden');
        loadDashboard();
    } else {
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');
        mainWorkspace?.classList.add('hidden');
    }
};

document.getElementById('btn-show-close-shift')?.addEventListener('click', () => {
    const overlay = document.getElementById('overlay-shift');
    overlay?.classList.remove('hidden');
    overlay?.classList.add('flex');
    const title = document.getElementById('shift-modal-title');
    if (title) title.innerText = "Đóng ca làm việc";
});

document.getElementById('btn-cancel-shift')?.addEventListener('click', () => {
    document.getElementById('overlay-shift')?.classList.add('hidden');
});

document.getElementById('btn-submit-shift')?.addEventListener('click', async () => {
    const amount = Number((document.getElementById('input-shift-cash') as HTMLInputElement).value);
    if (currentShiftId) {
        await ketThucCaLamViec(currentShiftId, { endTime: new Date().toISOString(), endingCash: amount, status: "Closed" });
        localStorage.removeItem('current_shift_id');
        currentShiftId = null;
        setupShiftUI();
    } else {
        const ca = await taoCaLamViec({ startTime: new Date().toISOString(), startingCash: amount, status: "Open" });
        localStorage.setItem('current_shift_id', ca.id);
        currentShiftId = ca.id;
        setupShiftUI();
    }
});

const loadDashboard = async () => {
    if (menuItems.length === 0) menuItems = await layDanhSachMonAn();
    await renderTableMap();
};

const renderTableMap = async () => {
    const grid = document.getElementById('table-grid');
    if (!grid) return;
    unpaidOrders = await layDanhSachHoaDonChuaThanhToan();
    const allTables = await layDanhSachBan();
    let html = '';
    
    const tablesToRender = allTables && allTables.length > 0 ? allTables : TABLES.map(t => ({id: t, tableNumber: 'Bàn ' + parseInt(t.replace('T', ''), 10), status: 'Available'}));
    
    tablesToRender.forEach((table: any) => {
        const tableName = table.id;
        const activeOrder = unpaidOrders.find((o: any) => o.table_id === tableName);
        
        let bgColor = 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:brightness-110';
        let statusText = 'Trống';
        let cursor = 'cursor-pointer';
        
        if (table.status === 'Locked') {
            bgColor = 'bg-red-500 text-white border-red-600 opacity-70 cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.4)]';
            statusText = 'Đang gộp';
            cursor = 'cursor-not-allowed';
        } else if (activeOrder || table.status === 'Occupied' || table.status === 'Waiting_Payment') {
            if ((activeOrder && (activeOrder.status === 'Waiting_Payment' || activeOrder.paymentStatus === 'Pending')) || table.status === 'Waiting_Payment') {
                bgColor = 'bg-amber-500 text-white border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse hover:brightness-110 transform scale-105 z-10';
                statusText = 'Chờ tính tiền';
            } else {
                bgColor = 'bg-orange-500 text-white border-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:brightness-110 transform scale-105 z-10';
                statusText = 'Có khách';
            }
        }
        
        let displayNum = parseInt(tableName.replace('T', ''), 10);
        html += `
            <div data-table="${tableName}" class="table-card ${cursor} flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${bgColor} aspect-square text-center">
                <span class="text-3xl font-black mb-1">${displayNum}</span>
                <span class="text-[11px] font-bold uppercase tracking-wider opacity-90">${statusText}</span>
            </div>
        `;
    });
    grid.innerHTML = html;
    
    document.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const t = (e.currentTarget as HTMLDivElement).getAttribute('data-table');
            const tb = tablesToRender.find((tbl: any) => tbl.id === t);
            if (tb && tb.status === 'Locked') return;
            const ord = unpaidOrders.find((o: any) => o.table_id === t);
            if (ord) hienThiChiTietHoaDon(ord);
            else hienThiManHinhTrong();
        });
    });
};

const hienThiManHinhTrong = () => {
    document.getElementById('empty-order-view')?.classList.remove('hidden');
    document.getElementById('active-order-view')?.classList.add('hidden');
};

const hienThiChiTietHoaDon = async (order: any) => {
    selectedOrder = order;
    document.getElementById('empty-order-view')?.classList.add('hidden');
    document.getElementById('active-order-view')?.classList.remove('hidden');
    
    const displayNum = parseInt(order.table_id.replace('T', ''), 10);
    const title = document.getElementById('detail-table-name');
    if(title) title.innerHTML = `Bàn ${displayNum}`;
    
    const totalEl = document.getElementById('detail-total-amount');
    if(totalEl) totalEl.innerHTML = `${formatMoney(order.totalAmount)} <span class="text-xl">đ</span>`;
    
    const itemsEl = document.getElementById('detail-items');
    if(itemsEl) {
        itemsEl.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i></div>';
        const details = await layChiTietCuaDon(order.id);
        let h = '';
        details.forEach((d: any) => {
            const mon = menuItems.find(m => m.id === d.menuItem_id);
            if(mon) {
                h += `<div class="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <div>
                        <p class="text-white font-bold">${d.quantity}x ${mon.name}</p>
                        <p class="text-xs text-slate-400">${formatMoney(d.priceAtOrder || mon.base_price)} đ</p>
                    </div>
                    <div class="font-bold text-orange-400">${formatMoney((d.priceAtOrder || mon.base_price) * d.quantity)} đ</div>
                </div>`;
            }
        });
        itemsEl.innerHTML = h;
    }
};

document.getElementById('btn-pay')?.addEventListener('click', () => {
    if(!selectedOrder) return;
    const overlay = document.getElementById('overlay-payment');
    if(overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        const total = document.getElementById('pay-total-amount');
        if(total) total.innerText = `${formatMoney(selectedOrder.totalAmount)} đ`;
    }
});

document.getElementById('btn-close-payment')?.addEventListener('click', () => {
    document.getElementById('overlay-payment')?.classList.add('hidden');
});

document.getElementById('btn-confirm-pay')?.addEventListener('click', async () => {
    if(!selectedOrder) return;
    try {
        await capNhatDonHang(selectedOrder.id, { status: "Completed", paymentStatus: "Paid" });
        await capNhatTrangThaiBan(selectedOrder.table_id, "Available");
        
        // Deduct inventory
        await deductInventoryForOrder(selectedOrder.id);
        
        showSuccessToast("Thanh toán thành công!");
        document.getElementById('overlay-payment')?.classList.add('hidden');
        hienThiManHinhTrong();
        renderTableMap();
    } catch(e) { console.error(e); }
});

export const renderOrdersList = async () => {
    const tbody = document.getElementById('cashier-orders-tbody');
    if (!tbody) return;
    
    const allOrders = await layTatCaDonHang();
    let html = '';
    allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    allOrders.forEach((order: any) => {
        let badge = order.status === 'Completed' || order.paymentStatus === 'Paid' ? 
            '<span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Đã thanh toán</span>' : 
            '<span class="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30">Đang phục vụ</span>';
            
        const timeStr = new Date(order.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        let numTable = 'N/A';
        if (order.table_id) numTable = parseInt(order.table_id.replace('T', ''), 10).toString();
        
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="px-6 py-4 font-bold text-orange-400">#${order.id}</td>
                <td class="px-6 py-4 font-bold text-white">Bàn ${numTable}</td>
                <td class="px-6 py-4 text-slate-400">${timeStr}</td>
                <td class="px-6 py-4 text-slate-300">-</td>
                <td class="px-6 py-4 text-right font-black text-white">${formatMoney(order.totalAmount || 0)} đ</td>
                <td class="px-6 py-4 text-center">${badge}</td>
                <td class="px-6 py-4 text-center"><button class="text-slate-400 hover:text-white transition-colors"><i class="fas fa-print"></i></button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

setupShiftUI();
setInterval(() => { renderTableMap(); renderOrdersList(); }, 3000);
renderOrdersList();


export const updateOverviewTab = async () => {
    // @ts-ignore
    const { layTatCaDonHang, layDanhSachBan } = require('./api');
    const allOrders = await layTatCaDonHang();
    const allTables = await layDanhSachBan();
    
    // Revenue today
    const today = new Date().toDateString();
    let revenue = 0;
    let ordersCount = 0;
    
    allOrders.forEach((o: any) => {
        const d = new Date(o.createdAt).toDateString();
        if (d === today && o.paymentStatus === 'Paid') {
            revenue += o.totalAmount;
        }
        if (d === today) {
            ordersCount++;
        }
    });
    
    const revEl = document.getElementById('overview-revenue');
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    if (revEl) revEl.innerText = fmtMoney(revenue) + ' đ';
    
    const ordEl = document.getElementById('overview-orders-count');
    if (ordEl) ordEl.innerText = ordersCount.toString();
    
    const activeTables = allTables.filter((t: any) => t.status === 'Occupied' || t.status === 'Waiting_Payment').length;
    const tabEl = document.getElementById('overview-active-tables');
    if (tabEl) tabEl.innerText = `${activeTables} / ${allTables.length}`;
    
    const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    const avgEl = document.getElementById('overview-avg-order');
    if (avgEl) avgEl.innerText = fmtMoney(avg) + ' đ';
};

export const renderMenuTab = async () => {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;
    
    // @ts-ignore
    const { layDanhSachMonAn } = require('./api');
    const menuItems = await layDanhSachMonAn();
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    let html = '';
    menuItems.forEach((item: any) => {
        html += `
            <div class="bg-[#1e293b] rounded-2xl p-4 border border-slate-700/50 shadow-md hover:border-orange-500/30 transition-colors group">
                <div class="relative">
                    <img src="${item.image_url}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'" class="w-full h-32 object-cover rounded-xl mb-3">
                    <span class="absolute top-2 right-2 ${item.status === 'Available' ? 'bg-emerald-500' : 'bg-red-500'} text-white text-xs font-black px-2 py-0.5 rounded-full">${item.status === 'Available' ? 'Còn hàng' : 'Hết hàng'}</span>
                </div>
                <h4 class="font-bold text-white text-sm mb-1 line-clamp-1">${item.name}</h4>
                <p class="text-orange-400 font-black mb-3">${fmtMoney(item.base_price)} đ</p>
            </div>
        `;
    });
    grid.innerHTML = html;
};

setInterval(updateOverviewTab, 5000);
updateOverviewTab();
renderMenuTab();


export const updateReportsTab = async () => {
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    
    const today = new Date().toDateString();
    let revenue = 0;
    let ordersCount = 0;
    
    // For chart: map hour -> revenue
    const hourlyRevenue = new Map<number, number>();
    for(let i=0; i<24; i++) hourlyRevenue.set(i, 0);
    
    allOrders.forEach((o: any) => {
        const d = new Date(o.createdAt);
        if (d.toDateString() === today && o.paymentStatus === 'Paid') {
            revenue += o.totalAmount;
            const hour = d.getHours();
            hourlyRevenue.set(hour, (hourlyRevenue.get(hour) || 0) + o.totalAmount);
            ordersCount++;
        }
    });
    
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    // Update summary
    const revEl = document.getElementById('reports-summary-revenue');
    if (revEl) revEl.innerText = fmtMoney(revenue) + ' đ';
    
    const ordEl = document.getElementById('reports-summary-orders');
    if (ordEl) ordEl.innerText = ordersCount.toString();
    
    const avgEl = document.getElementById('reports-summary-avg');
    const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    if (avgEl) avgEl.innerText = fmtMoney(avg) + ' đ';
    
    // Update chart
    const chartEl = document.getElementById('reports-chart');
    if (chartEl) {
        // Find max revenue hour to normalize heights
        let maxRev = 0;
        hourlyRevenue.forEach(v => { if (v > maxRev) maxRev = v; });
        
        // Group into 6 blocks: 8h, 10h, 12h, 14h, 16h, 18h (or just evenly space available data)
        const displayHours = [8, 10, 12, 14, 16, 18];
        let html = '';
        displayHours.forEach(h => {
            const rev = hourlyRevenue.get(h) || 0;
            // Height between 10% and 100%
            const pct = maxRev > 0 ? Math.max(10, Math.round((rev / maxRev) * 100)) : 10;
            
            // Choose color based on height
            let bgClass = 'bg-orange-500/30 border-orange-500/50';
            if (pct > 70) bgClass = 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
            else if (pct > 40) bgClass = 'bg-orange-500/70 border-orange-500/50';
            else if (pct > 20) bgClass = 'bg-orange-500/50 border-orange-500/50';
            
            html += `
                <div class="flex-1 flex flex-col items-center gap-2">
                    <div class="${bgClass} border rounded-t-lg w-full transition-all duration-500 relative group" style="height:${pct}%">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            ${fmtMoney(rev)} đ
                        </div>
                    </div>
                    <span class="text-xs text-slate-500">${h}h</span>
                </div>
            `;
        });
        chartEl.innerHTML = html;
    }
};

setInterval(updateReportsTab, 5000);
updateReportsTab();


export const updateReportsTransactions = async () => {
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    
    const tbody = document.getElementById('cashier-reports-tbody');
    if (!tbody) return;
    
    // Sort descending
    const recentOrders = allOrders
        .filter((o: any) => o.paymentStatus === 'Paid')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10); // Show top 10
        
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    let html = '';
    recentOrders.forEach((o: any) => {
        const d = new Date(o.createdAt);
        const dateStr = d.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'}) + ' ' + d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="px-6 py-4 font-bold text-white">#${o.id}</td>
                <td class="px-6 py-4 text-slate-400">${dateStr}</td>
                <td class="px-6 py-4 text-slate-300">Thanh toán</td>
                <td class="px-6 py-4 text-right font-black text-emerald-400">+${fmtMoney(o.totalAmount)} đ</td>
                <td class="px-6 py-4 text-center"><span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Thành công</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

setInterval(updateReportsTransactions, 5000);
updateReportsTransactions();


export const renderOverviewRecentOrders = async () => {
    const tbody = document.getElementById('overview-recent-orders-tbody');
    if (!tbody) return;
    
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    
    // Sort descending and take top 5
    const recentOrders = allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    let html = '';
    recentOrders.forEach((order: any) => {
        let badge = '';
        if (order.status === 'Completed' || order.paymentStatus === 'Paid') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Đã thanh toán</span>';
        } else {
            badge = '<span class="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30">Đang phục vụ</span>';
        }
        
        const timeStr = new Date(order.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        let numTable = 'N/A';
        if (order.table_id) numTable = parseInt(order.table_id.replace('T', ''), 10).toString();
        
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="px-6 py-4 font-bold text-white">Bàn ${numTable}</td>
                <td class="px-6 py-4 text-slate-400">${timeStr}</td>
                <td class="px-6 py-4 text-slate-300">- món</td>
                <td class="px-6 py-4 text-right font-black text-white">${fmtMoney(order.totalAmount || 0)} đ</td>
                <td class="px-6 py-4 text-center">${badge}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

setInterval(renderOverviewRecentOrders, 5000);
renderOverviewRecentOrders();
