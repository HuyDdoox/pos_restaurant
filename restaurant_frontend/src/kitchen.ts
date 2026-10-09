import { capNhatTrangThaiMon, capNhatTrangThaiMenu, layDanhSachMonChoXacNhan, layDanhSachMonChoNau, layDanhSachMonAn, layTatCaDonHang, layDanhSachBan, layDanhSachNguyenLieu, layTatCaCongThuc } from './api';
import { MenuItem } from './interfaces';

let mangMonAn: MenuItem[] = [];
let mangBan: any[] = [];
let mangOrder: any[] = [];
let mangNguyenLieu: any[] = [];
let mangCongThuc: any[] = [];
let currentKitchenDataHash = "";
let kitchenPollingInterval: any = null;

// Khởi tạo kênh giao tiếp thời gian thực (Push Notification)
const kdsChannel = new BroadcastChannel('foodhub_kds');

// Khởi tạo đồng hồ
const updateClock = () => {
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('vi-VN', { hour12: false });
    }
};
setInterval(updateClock, 1000);
updateClock();

const renderKDS = async (isBackground = false) => {
    try {
        const [pendingDetails, cookingDetails, monAns, orders, tables, ingredients, recipes] = await Promise.all([
            layDanhSachMonChoXacNhan(), // status=Pending
            layDanhSachMonChoNau(),     // status=Cooking
            mangMonAn.length > 0 ? Promise.resolve(mangMonAn) : layDanhSachMonAn(),
            layTatCaDonHang(),
            mangBan.length > 0 ? Promise.resolve(mangBan) : layDanhSachBan(),
            mangNguyenLieu.length > 0 ? Promise.resolve(mangNguyenLieu) : layDanhSachNguyenLieu(),
            mangCongThuc.length > 0 ? Promise.resolve(mangCongThuc) : layTatCaCongThuc()
        ]);

        const newDataHash = JSON.stringify({ pendingDetails, cookingDetails });
        if (isBackground && newDataHash === currentKitchenDataHash) return;
        currentKitchenDataHash = newDataHash;
        
        mangMonAn = monAns;
        mangOrder = orders;
        mangBan = tables;
        mangNguyenLieu = ingredients;
        mangCongThuc = recipes;

        // Cập nhật số lượng
        const pendingCountEl = document.getElementById('pending-count');
        const cookingCountEl = document.getElementById('cooking-count');
        
        // --- HÀM GỘP NHÓM (ITEM GROUPING) ---
        const groupDetails = (details: any[]) => {
            const groups: { [key: string]: any } = {};
            details.forEach(detail => {
                const menuItemId = detail.menuItem_id;
                if (!groups[menuItemId]) {
                    groups[menuItemId] = {
                        menuItemId: menuItemId,
                        details: [],
                        totalQty: 0,
                        tablesMap: {} as { [key: string]: number },
                        notes: new Set<string>(),
                        oldestTime: new Date(detail.createdAt).getTime(), isUrgent: false
                    };
                }
                const group = groups[menuItemId];
                group.details.push(detail);
                group.totalQty += detail.quantity;
                
                // Lấy thông tin bàn
                const order = mangOrder.find(o => o.id === detail.order_id);
                let tableName = "Bàn ?";
                if (order) {
                    const table = mangBan.find(t => t.id === order.table_id);
                    if (table) tableName = table.tableNumber;
                }
                
                group.tablesMap[tableName] = (group.tablesMap[tableName] || 0) + detail.quantity;
                
                if (detail.notes) group.notes.add(detail.notes);
                if (detail.isUrgent) group.isUrgent = true;
                
                const detailTime = new Date(detail.createdAt).getTime();
                if (detailTime < group.oldestTime) group.oldestTime = detailTime;
            });
            
            // Chuyển object thành array và sort theo oldestTime (FIFO)
            return Object.values(groups).sort((a, b) => a.oldestTime - b.oldestTime);
        };

        const pendingGroups = groupDetails(pendingDetails);
        const cookingGroups = groupDetails(cookingDetails);

        if (pendingCountEl) pendingCountEl.innerText = pendingGroups.length.toString();
        if (cookingCountEl) cookingCountEl.innerText = cookingGroups.length.toString();

        renderPendingCol(pendingGroups);
        renderCookingCol(cookingGroups);

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu KDS:", error);
    }
};

const renderPendingCol = (groups: any[]) => {
    const container = document.getElementById('pending-container');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold">Không có món chờ nấu</div>`;
        return;
    }

    let html = '';
    const now = new Date().getTime();

    groups.forEach(group => {
        const monAn = mangMonAn.find(m => m.id === group.menuItemId);
        const tenMon = monAn ? monAn.name : 'Món không xác định';
        
        // Format danh sách bàn
        const tableTags = Object.entries(group.tablesMap as Record<string, number>).map(([tb, qty]) => 
            `<span class="px-2 py-1 bg-slate-700 rounded text-xs font-bold text-slate-300">${tb}${qty > 1 ? ` (x${qty})` : ''}</span>`
        ).join('');

        // Ghi chú
        const noteStr = Array.from(group.notes).join(', ');
        const noteHtml = noteStr ? `<div class="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm font-bold p-3 rounded-xl mb-4">Ghi chú: ${noteStr}</div>` : '';

        // Tính SLA (Đếm ngược 5 phút = 300 giây)
        const elapsedSecs = Math.floor((now - group.oldestTime) / 1000);
        const remainingSecs = 300 - elapsedSecs;
        const isSlaAlert = remainingSecs < 0 || group.isUrgent;
        
        const absRem = Math.abs(remainingSecs);
        const m = Math.floor(absRem / 60);
        const s = absRem % 60;
        const mm = m < 10 ? '0' + m : m;
        const ss = s < 10 ? '0' + s : s;
        const timeStr = isSlaAlert ? `-${mm}:${ss}` : `${mm}:${ss}`;

        const alertClass = isSlaAlert ? 'sla-alert border-red-500' : 'border-slate-700';
        const timeClass = isSlaAlert ? 'text-red-500 font-black' : 'text-slate-400 font-bold';
        const timeIconClass = isSlaAlert ? 'animate-pulse text-red-500' : 'text-slate-400';

        const detailIds = group.details.map((d: any) => d.id).join(',');

        // Tính số phần có thể nấu
        const dsCongThuc = mangCongThuc.filter(c => c.menuItem_id === group.menuItemId);
        let maxPortions = -1;
        if (dsCongThuc.length > 0) {
            maxPortions = Math.min(...dsCongThuc.map(c => {
                const ing = mangNguyenLieu.find(i => i.id === c.ingredient_id);
                if (!ing) return 0;
                return Math.floor(ing.stock_quantity / c.quantity_required);
            }));
        }
        let stockHtml = '';
        if (maxPortions >= 0) {
            if (maxPortions === 0) {
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-500 rounded border border-red-500/30">HẾT NGUYÊN LIỆU</div>`;
            } else {
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">Kho còn: ${maxPortions} phần</div>`;
            }
        }

        html += `
            <div class="bg-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group border ${alertClass}">
                <button data-menu-id="${group.menuItemId}" class="btn-out-of-stock absolute top-4 right-4 p-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-red-500/20 hover:text-red-500 transition-colors tooltip" title="Báo hết hàng">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                </button>
                
                <div class="pr-12">
                    <h4 class="font-black text-2xl text-white mb-1">${tenMon}</h4>
                    <div class="flex items-center gap-3 mb-3">
                        <div class="text-3xl font-black text-orange-500">x ${group.totalQty}</div>
                        ${stockHtml}
                    </div>
                </div>
                
                <div class="flex gap-2 flex-wrap mb-3">${tableTags}</div>
                ${noteHtml}
                
                <div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-700">
                    <div class="flex items-center gap-2 font-mono text-lg ${timeClass}">
                        <svg class="w-6 h-6 ${timeIconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        
                    </div>
                    <button data-ids="${detailIds}" class="btn-start-cooking bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-lg py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95">
                        Nhận nấu
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    attachPendingEvents();
};

const renderCookingCol = (groups: any[]) => {
    const container = document.getElementById('cooking-container');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold">Không có món đang nấu</div>`;
        return;
    }

    let html = '';

    groups.forEach(group => {
        const monAn = mangMonAn.find(m => m.id === group.menuItemId);
        const tenMon = monAn ? monAn.name : 'Món không xác định';
        
        const tableTags = Object.entries(group.tablesMap as Record<string, number>).map(([tb, qty]) => 
            `<span class="px-2 py-1 bg-slate-700 rounded text-xs font-bold text-slate-300">${tb}${qty > 1 ? ` (x${qty})` : ''}</span>`
        ).join('');

        const detailIds = group.details.map((d: any) => d.id).join(',');

        // Tính số phần có thể nấu
        const dsCongThuc = mangCongThuc.filter(c => c.menuItem_id === group.menuItemId);
        let maxPortions = -1;
        if (dsCongThuc.length > 0) {
            maxPortions = Math.min(...dsCongThuc.map(c => {
                const ing = mangNguyenLieu.find(i => i.id === c.ingredient_id);
                if (!ing) return 0;
                return Math.floor(ing.stock_quantity / c.quantity_required);
            }));
        }
        
        let stockHtml = '';
        if (maxPortions >= 0) {
            if (maxPortions === 0) {
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-500 rounded border border-red-500/30">HẾT NGUYÊN LIỆU</div>`;
            } else {
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">Kho còn: ${maxPortions} phần</div>`;
            }
        }

        html += `
            <div class="bg-slate-800/80 rounded-2xl p-5 shadow-lg border border-orange-500/30 relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')]">
                <div class="pr-12">
                    <h4 class="font-black text-2xl text-white mb-1">${tenMon}</h4>
                    <div class="flex items-center gap-3 mb-3">
                        <div class="text-3xl font-black text-emerald-400">x ${group.totalQty}</div>
                        ${stockHtml}
                    </div>
                </div>
                
                <div class="flex gap-2 flex-wrap mb-4">${tableTags}</div>
                
                <div class="flex items-center justify-between mt-auto pt-4 border-t border-slate-700">
                    <div class="flex items-center gap-2 text-orange-400 font-bold text-sm">
                        <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Đang chế biến
                    </div>
                    <button data-ids="${detailIds}" class="btn-finish-cooking bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-lg py-3 px-8 rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                        Xong
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    attachCookingEvents();
};

const attachPendingEvents = () => {
    // Nhận nấu
    document.querySelectorAll('.btn-start-cooking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const idsStr = target.getAttribute('data-ids');
            if (!idsStr) return;

            target.innerHTML = 'Đang xử lý...';
            target.disabled = true;

            const ids = idsStr.split(',');
            try {
                await Promise.all(ids.map(id => capNhatTrangThaiMon(id, 'Cooking')));
                renderKDS(); // Reload
            } catch (error) {
                console.error(error);
                alert('Lỗi cập nhật trạng thái');
                target.disabled = false;
                target.innerHTML = 'Nhận nấu';
            }
        });
    });

    // Báo hết hàng
    document.querySelectorAll('.btn-out-of-stock').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            if (!menuId) return;

            if (confirm('Xác nhận báo HẾT HÀNG món này? (Sẽ khóa trên toàn bộ menu)')) {
                try {
                    await capNhatTrangThaiMenu(menuId, 'Out of Stock');
                    alert('Đã khóa món ăn thành công!');
                    // Tùy chọn: Cũng tự động hủy các OrderDetails đang chờ của món này? 
                    // Tạm thời chỉ cập nhật menu.
                } catch (error) {
                    console.error(error);
                    alert('Lỗi khi báo hết hàng');
                }
            }
        });
    });
};

const attachCookingEvents = () => {
    // Hoàn thành
    document.querySelectorAll('.btn-finish-cooking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const idsStr = target.getAttribute('data-ids');
            if (!idsStr) return;

            target.innerHTML = 'Đang xử lý...';
            target.disabled = true;

            const ids = idsStr.split(',');
            try {
                await Promise.all(ids.map(id => capNhatTrangThaiMon(id, 'Ready')));
                
                // MÔ PHỎNG PUSH NOTIFICATION CHO WAITER BẰNG BROADCAST CHANNEL (Real-time)
                kdsChannel.postMessage({ 
                    type: 'KITCHEN_READY', 
                    message: '🔔 Bếp báo: Có món mới vừa nấu xong! Vui lòng ra quầy nhận món.' 
                });
                
                renderKDS(); // Reload
            } catch (error) {
                console.error(error);
                alert('Lỗi cập nhật trạng thái');
                target.disabled = false;
                target.innerHTML = 'Xong';
            }
        });
    });
};

// Navigation
const navKds = document.getElementById('nav-kds');
const navMenu = document.getElementById('nav-menu');
const viewKds = document.getElementById('view-kds');
const viewMenu = document.getElementById('view-menu');
let currentTab = 'kds';

if (navKds && navMenu && viewKds && viewMenu) {
    navKds.addEventListener('click', (e) => {
        e.preventDefault();
        currentTab = 'kds';
        viewKds.classList.remove('hidden');
        viewKds.classList.add('flex');
        viewMenu.classList.add('hidden');
        viewMenu.classList.remove('flex');
        navKds.querySelector('.active-indicator')?.classList.remove('hidden');
        navMenu.querySelector('.active-indicator')?.classList.add('hidden');
        navKds.classList.add('text-orange-500', 'bg-orange-500/20');
        navKds.classList.remove('text-slate-500');
        navMenu.classList.remove('text-orange-500', 'bg-orange-500/20');
        navMenu.classList.add('text-slate-500');
        renderKDS();
    });

    navMenu.addEventListener('click', (e) => {
        e.preventDefault();
        currentTab = 'menu';
        viewMenu.classList.remove('hidden');
        viewMenu.classList.add('flex');
        viewKds.classList.add('hidden');
        viewKds.classList.remove('flex');
        navMenu.querySelector('.active-indicator')?.classList.remove('hidden');
        navKds.querySelector('.active-indicator')?.classList.add('hidden');
        navMenu.classList.add('text-orange-500', 'bg-orange-500/20');
        navMenu.classList.remove('text-slate-500');
        navKds.classList.remove('text-orange-500', 'bg-orange-500/20');
        navKds.classList.add('text-slate-500');
        renderMenuTab();
    });
}

const renderMenuTab = async () => {
    if (mangMonAn.length === 0) {
        const [monAns, ingredients, recipes] = await Promise.all([
            layDanhSachMonAn(),
            layDanhSachNguyenLieu(),
            layTatCaCongThuc()
        ]);
        mangMonAn = monAns;
        mangNguyenLieu = ingredients;
        mangCongThuc = recipes;
    }

    const container = document.getElementById('menu-grid');
    if (!container) return;

    let html = '';
    mangMonAn.forEach(mon => {
        const dsCongThuc = mangCongThuc.filter(c => c.menuItem_id === mon.id);
        let maxPortions = -1;
        if (dsCongThuc.length > 0) {
            maxPortions = Math.min(...dsCongThuc.map(c => {
                const ing = mangNguyenLieu.find(i => i.id === c.ingredient_id);
                if (!ing) return 0;
                return Math.floor(ing.stock_quantity / c.quantity_required);
            }));
        }

        const isOut = mon.status === 'Out of Stock';
        const cardBg = isOut ? 'bg-red-900/20 border-red-500/30 opacity-70' : 'bg-slate-800 border-slate-700';
        const stockText = maxPortions >= 0 ? `Tồn kho: ${maxPortions} phần` : 'Tồn kho: Vô hạn';
        
        html += `
            <div class="rounded-2xl p-4 shadow-lg border ${cardBg} flex flex-col items-center text-center transition-colors">
                <img src="${mon.image}" class="w-20 h-20 object-cover rounded-full mb-3 shadow-md border-2 border-slate-700" onerror="this.src='https://via.placeholder.com/150'">
                <h4 class="font-black text-white text-lg mb-1 leading-tight line-clamp-2 min-h-[3rem]">${mon.name}</h4>
                <div class="text-sm font-bold text-slate-400 mb-4">${stockText}</div>
                <div class="flex items-center justify-between w-full mt-auto bg-slate-700/50 p-2 rounded-xl border border-slate-600/50">
                    <span class="text-sm font-bold ${isOut ? 'text-red-400' : 'text-emerald-400'}">${isOut ? 'Đã khóa' : 'Đang bán'}</span>
                    <button data-id="${mon.id}" data-name="${mon.name}" data-current="${isOut ? 'Out of Stock' : 'Active'}" class="btn-toggle-menu relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${!isOut ? 'bg-emerald-500' : 'bg-slate-600'}">
                        <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${!isOut ? 'translate-x-6' : 'translate-x-1'}"></span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    document.querySelectorAll('.btn-toggle-menu').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-id');
            const menuName = target.getAttribute('data-name');
            const currentStatus = target.getAttribute('data-current');
            if (!menuId) return;
            
            const isLocking = currentStatus !== 'Out of Stock';
            const confirmMsg = isLocking ? `Bạn có chắc muốn KHÓA món ${menuName}? Khách sẽ không thể gọi món này nữa.` : `Bạn có chắc muốn MỞ LẠI món ${menuName}?`;
            if (!confirm(confirmMsg)) return;
            
            const newStatus = currentStatus === 'Out of Stock' ? 'Active' : 'Out of Stock';
            target.disabled = true;
            
            try {
                await capNhatTrangThaiMenu(menuId, newStatus);
                const m = mangMonAn.find(x => x.id === menuId);
                if (m) m.status = newStatus;
                
                kdsChannel.postMessage({ type: 'MENU_UPDATED', message: 'Bếp cập nhật menu' });
                renderMenuTab();
            } catch (error) {
                console.error(error);
                alert('Lỗi cập nhật món');
                renderMenuTab();
            }
        });
    });
};

// Khởi chạy
renderKDS();

// Polling ngầm mỗi 3 giây
if (!kitchenPollingInterval) {
    kitchenPollingInterval = setInterval(() => {
        if (currentTab === 'kds') {
            renderKDS(true); 
        } else {
            // Optional: poll menu tab
        }
    }, 3000);
}

