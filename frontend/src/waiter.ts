import {
    layDanhSachBan, capNhatTrangThaiBan, taoDonHang, layDonHangDangMoCuaBan,
    layChiTietCuaDon, capNhatChiTietDonHang, taoChiTietDonHang, layDanhSachMonAn,
    layDanhSachDanhMuc, capNhatTrangThaiMenu, layTatCaDonHang, layDanhSachMonSanSang, layDanhSachVariants,
    capNhatDonHang, layDanhSachNguyenLieu, layTatCaCongThuc
} from './api';
import { API_ORDERS_URL, API_ORDER_DETAILS_URL, API_TABLES_URL } from './config';
import { showSuccessToast, showConfirmModal, showPromptModal, showWarningToast, showMoveMergeModal, showNumberPromptModal } from './utils/ui';
import { getCurrentUser, requireAuth, logout } from './auth';

// Kiểm tra bắt buộc đăng nhập trước khi sử dụng POS Phục vụ
const currentAuthUser = requireAuth(['Waiter', 'Admin']);

let currentTab = 'tables';
let allTables: any[] = [];
let allMenuItems: any[] = [];
let allCategories: any[] = [];
let selectedTableId: string | null = null;
let currentOrderId: string | null = null;
let selectedOrderItemIds: string[] = []; // Chuyển sang mảng để chọn nhiều mục
let currentDetailStatusFilter = 'all';
let cachedCurrentOrderDetails: any[] = [];
let cachedCurrentPax = 0;
let selectedTransferTargetTableId: string | null = null;
let targetReservationTableId: string | null = null;

// --- GLOBAL UTILS ---
const updateDateTime = () => {
    const now = new Date();
    document.getElementById('global-date')!.innerText = now.toLocaleDateString('vi-VN');
    document.getElementById('global-time')!.innerText = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
setInterval(updateDateTime, 1000);
updateDateTime();

const initWaiterUserProfile = () => {
    const user: any = currentAuthUser || (() => {
        try {
            return JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('user') || '{}');
        } catch { return {}; }
    })();

    const fullName = user.fullname || user.name || user.username || 'Phục vụ';
    const words = fullName.trim().split(/\s+/);
    const initials = words.length > 1 
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase() 
        : fullName.slice(0, 2).toUpperCase();

    const avatarEl = document.getElementById('waiter-avatar-initials');
    if (avatarEl) avatarEl.innerText = initials;

    const nameEl = document.getElementById('global-user-name');
    if (nameEl) nameEl.innerText = fullName;

    const dropNameEl = document.getElementById('waiter-dropdown-user-name');
    if (dropNameEl) dropNameEl.innerText = fullName;
};
initWaiterUserProfile();

let cachedIngredients: any[] = [];
let cachedRecipes: any[] = [];

const ensureWaiterIngredientsAndRecipes = async () => {
    if (cachedIngredients.length === 0 || cachedRecipes.length === 0) {
        try {
            const [ings, recs] = await Promise.all([
                layDanhSachNguyenLieu().catch(() => []),
                layTatCaCongThuc().catch(() => [])
            ]);
            cachedIngredients = Array.isArray(ings) ? ings : [];
            cachedRecipes = Array.isArray(recs) ? recs : [];
        } catch (e) {
            console.error('Lỗi nạp kho & công thức waiter:', e);
        }
    }
};

const calculateWaiterPortions = (dish: any): number => {
    if (!dish) return 25;
    const dishId = String(dish.id || dish._id);

    // 1. Nếu là món Combo: tính theo số suất của các món thành phần trong Combo
    if (dish.is_combo && dish.combo_items && dish.combo_items.length > 0) {
        const comboPortions = dish.combo_items.map((ci: any) => {
            const childId = String(ci.menuItem_id?._id || ci.menuItem_id?.id || ci.menuItem_id);
            const childDish = allMenuItems.find(m => String(m.id || m._id) === childId);
            const singlePortions = childDish ? calculateWaiterPortions(childDish) : 25;
            const req = Number(ci.quantity) || 1;
            return Math.floor(singlePortions / req);
        });
        const minP = Math.min(...comboPortions);
        return (isFinite(minP) && minP >= 0) ? minP : 15;
    }

    // 2. Món đơn có công thức định lượng
    if (cachedRecipes.length > 0 && cachedIngredients.length > 0) {
        const itemRecipes = cachedRecipes.filter((r: any) => {
            const rMid = String(r.menuItem_id?._id || r.menuItem_id?.id || r.menuItem_id);
            return rMid === dishId;
        });

        if (itemRecipes.length > 0) {
            const portions = itemRecipes.map((r: any) => {
                const rIngId = String(r.ingredient_id?._id || r.ingredient_id?.id || r.ingredient_id);
                const ing = cachedIngredients.find((i: any) => String(i.id || i._id) === rIngId);
                if (!ing) return 25;
                const stock = Number(ing.stock_quantity) || 0;
                const req = Number(r.quantity_required) || 1;
                return Math.floor(stock / req);
            });
            const minPortion = Math.min(...portions);
            return (isFinite(minPortion) && minPortion >= 0) ? minPortion : 20;
        }
    }

    // 3. Fallback giá trị tồn kho cụ thể
    const explicit = Number(dish.stock_quantity);
    if (!isNaN(explicit) && explicit > 0) return explicit;
    return 25;
};

// --- HỆ THỐNG ÂM THANH PHỤC VỤ (WAITER NOTIFICATION CHIME) ---
let waiterAudioCtx: AudioContext | null = null;
const playWaiterBell = () => {
    try {
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!waiterAudioCtx && AudioClass) waiterAudioCtx = new AudioClass();
        if (waiterAudioCtx && waiterAudioCtx.state === 'suspended') waiterAudioCtx.resume();
        if (!waiterAudioCtx) return;
        const now = waiterAudioCtx.currentTime;

        const osc = waiterAudioCtx.createOscillator();
        const gain = waiterAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, now); // G5
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(waiterAudioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
    } catch (e) {
        // audio unlock fallback
    }
};
window.addEventListener('click', () => {
    try {
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!waiterAudioCtx && AudioClass) waiterAudioCtx = new AudioClass();
        if (waiterAudioCtx && waiterAudioCtx.state === 'suspended') waiterAudioCtx.resume();
    } catch(e) {}
}, { once: true });

// Quản lý yêu cầu từ khách (Gọi phục vụ & Yêu cầu tính tiền)
interface ServiceCall {
    type: 'CALL' | 'BILL';
    tableId: string;
    tableName: string;
    reason?: string;
    method?: string;
    time: string;
    acknowledged?: boolean;
}
let activeServiceCalls: { [tableId: string]: ServiceCall } = {};

const updateServiceCenterBadge = () => {
    const badge = document.getElementById('header-service-badge');
    const count = Object.keys(activeServiceCalls).length;
    if (badge) {
        badge.innerText = String(count);
        if (count > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
};

const updateReadyPickupBadge = async () => {
    try {
        const readyItems = await layDanhSachMonSanSang();
        const badge = document.getElementById('header-pickup-badge');
        if (badge) {
            badge.innerText = String(readyItems.length);
            if (readyItems.length > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (e) {
        // silent
    }
};

// --- KITCHEN SYNC (ĐỒNG BỘ BẾP & KHÁCH HÀNG - PUSH NOTIFICATION) ---
const kdsChannel = new BroadcastChannel('foodhub_kds');
kdsChannel.onmessage = (event) => {
    if (event.data.type === 'KITCHEN_READY') {
        playWaiterBell();
        showSuccessToast(event.data.message);
        updateReadyPickupBadge();
        
        // Tự động làm mới bàn nếu đang mở
        if (selectedTableId) {
            const table = allTables.find(t => t.id === selectedTableId);
            if (table) handleTableClick(table, true);
        }
    } else if (event.data.type === 'OUT_OF_STOCK' || event.data.type === 'MENU_UPDATED') {
        showWarningToast(event.data.message || 'Menu đã được cập nhật');
        loadMenu();
        if (selectedTableId) {
            const table = allTables.find(t => t.id === selectedTableId);
            if (table) handleTableClick(table, true);
        }
    } else if (event.data.type === 'CALL_WAITER') {
        playWaiterBell();
        const { tableId, tableName, reason, time } = event.data;
        activeServiceCalls[String(tableId)] = {
            type: 'CALL',
            tableId: String(tableId),
            tableName,
            reason,
            time
        };
        updateServiceCenterBadge();
        showWarningToast(`🛎️ ${tableName} đang gọi: "${reason}" (${time})`);
        renderTables();
        if (selectedTableId && String(selectedTableId) === String(tableId)) {
            const table = allTables.find(t => String(t.id) === String(tableId));
            if (table) handleTableClick(table, true);
        }
    } else if (event.data.type === 'REQUEST_CHECKOUT') {
        playWaiterBell();
        const { tableId, tableName, method, time } = event.data;
        activeServiceCalls[String(tableId)] = {
            type: 'BILL',
            tableId: String(tableId),
            tableName,
            method,
            time
        };
        updateServiceCenterBadge();
        showWarningToast(`💳 ${tableName} yêu cầu tính tiền [${method}] (${time})`);
        renderTables();
        if (selectedTableId && String(selectedTableId) === String(tableId)) {
            const table = allTables.find(t => String(t.id) === String(tableId));
            if (table) handleTableClick(table, true);
        }
    } else if (event.data.type === 'CUSTOMER_ORDERED') {
        playWaiterBell();
        showSuccessToast(`🔔 ${event.data.tableName} vừa đặt ${event.data.itemCount} món qua QR!`);
        loadTables(true);
    } else if (event.data.type === 'ORDER_PAID') {
        delete activeServiceCalls[String(event.data.tableId)];
        updateServiceCenterBadge();
        loadTables(true);
    } else if (event.data.type === 'WAITER_ACKNOWLEDGED') {
        delete activeServiceCalls[String(event.data.tableId)];
        updateServiceCenterBadge();
        renderTables();
        if (selectedTableId && String(selectedTableId) === String(event.data.tableId)) {
            const table = allTables.find(t => String(t.id) === String(event.data.tableId));
            if (table) handleTableClick(table, true);
        }
    } else if (event.data.type === 'ITEM_SERVED') {
        updateReadyPickupBadge();
    } else if (event.data.type === 'ADMIN_ANNOUNCEMENT') {
        if (!event.data.targetAudience || event.data.targetAudience === 'all' || event.data.targetAudience === 'front') {
            playWaiterBell();
            const prefix = event.data.priority === 'urgent' ? '🚨 [KHẨN CẤP]' : '📢 [LOA QUẢN LÝ]';
            showWarningToast(`${prefix} ${event.data.title}: ${event.data.message}`);
        }
    }
};

const formatMoney = (amount: number) => {
    const val = Number(amount);
    return (isNaN(val) ? 0 : val).toLocaleString('vi-VN') + ' đ';
};

// --- EVENT LISTENER FOR TABS ---
window.addEventListener('tabChanged', (e: any) => {
    currentTab = e.detail;
    if (currentTab === 'tables') loadTables();
    if (currentTab === 'menu') loadMenu();
    if (currentTab === 'orders') loadOrders();
    if (currentTab === 'profile') loadProfile();
});

// ==========================================
// TAB 1: BÀN ĂN (QUẢN LÝ BÀN)
// ==========================================
let currentTableFilter = 'all';
let currentZoneFilter = 'all';

document.querySelectorAll('.filter-zone-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        document.querySelectorAll('.filter-zone-btn').forEach(b => {
            b.classList.remove('bg-orange-500', 'text-white');
            b.classList.add('text-slate-400');
        });
        target.classList.remove('text-slate-400');
        target.classList.add('bg-orange-500', 'text-white');
        currentZoneFilter = target.getAttribute('data-zone') || 'all';
        renderTables();
    });
});

document.querySelectorAll('.filter-table-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        document.querySelectorAll('.filter-table-btn').forEach(b => {
            b.classList.remove('bg-orange-500', 'text-white');
            b.classList.add('text-slate-400');
        });
        target.classList.remove('text-slate-400');
        target.classList.add('bg-orange-500', 'text-white');
        currentTableFilter = target.getAttribute('data-filter') || 'all';
        renderTables();
    });
});

document.querySelectorAll('.filter-tab3-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        document.querySelectorAll('.filter-tab3-btn').forEach(b => {
            b.classList.remove('bg-orange-500', 'text-white');
            b.classList.add('text-slate-400');
        });
        target.classList.remove('text-slate-400');
        target.classList.add('bg-orange-500', 'text-white');
        currentOrderFilter = target.getAttribute('data-filter') || 'all';
        loadOrders();
    });
});

let currentTablesHash = "";
const loadTables = async (isBackground = false) => {
    try {
        const newData = await layDanhSachBan();
        
        // HASH COMPARE
        const newDataHash = JSON.stringify(newData);
        if (isBackground && newDataHash === currentTablesHash) return;
        currentTablesHash = newDataHash;
        
        allTables = newData;
        renderTables();
        
        // Cập nhật chi tiết bàn đang chọn nếu panel đang mở
        if (selectedTableId) {
            const table = allTables.find(t => t.id === selectedTableId);
            if (table) {
                // Rerender specifically the right panel for this table without losing selected ID
                const oldSelection = selectedTableId;
                handleTableClick(table, true); // true = no background loading flicker
                selectedTableId = oldSelection;
            }
        }
    } catch (error) {
        console.error(error);
    }
};

const matchesWaiterZone = (table: any, filter: string): boolean => {
    if (!filter || filter === 'all') return true;
    const z = (table.zone || '').toLowerCase();
    const num = (table.tableNumber || '').toLowerCase();
    if (filter === 'vip') {
        return z.includes('vip') || num.includes('vip');
    }
    if (filter === 't1') {
        if (z.includes('vip') || num.includes('vip')) return false;
        return z.includes('1') || z.includes('trong nhà') || (!z.includes('2') && !z.includes('sân vườn'));
    }
    if (filter === 't2') {
        if (z.includes('vip') || num.includes('vip')) return false;
        return z.includes('2') || z.includes('sân vườn');
    }
    return true;
};

const renderTables = () => {
    const grid = document.getElementById('tables-grid')!;
    grid.innerHTML = '';
    
    let filtered = allTables;
    if (currentTableFilter === 'empty') filtered = allTables.filter(t => t.status === 'Available');
    if (currentTableFilter === 'occupied') filtered = allTables.filter(t => t.status === 'Occupied' || t.status === 'Waiting_Payment');
    if (currentTableFilter === 'reserved') filtered = allTables.filter(t => t.status === 'Reserved');

    if (currentZoneFilter !== 'all') {
        filtered = filtered.filter(t => matchesWaiterZone(t, currentZoneFilter));
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-slate-500 py-16 font-medium"><i class="fa-solid fa-filter text-2xl mb-2 block opacity-40"></i>Không có bàn nào thuộc khu vực hoặc trạng thái này</div>';
        return;
    }

    filtered.forEach(table => {
        const tStatus = (table.status || '').toLowerCase();
        const isOccupied = tStatus === 'occupied';
        const isWaitingPayment = tStatus === 'waiting_payment';
        const isLocked = tStatus === 'locked';
        const isReserved = tStatus === 'reserved';
        const isSelected = table.id === selectedTableId;
        
        let bgClass = 'bg-white text-emerald-800 border-2 border-emerald-500/50 shadow-xs hover:border-emerald-600 hover:bg-emerald-50/40 hover:shadow-sm'; // Default light green card for empty
        if (isOccupied) bgClass = 'bg-orange-500 text-white border-orange-600 shadow-md hover:brightness-105'; // Orange for occupied
        if (isWaitingPayment) bgClass = 'bg-amber-400 text-slate-950 border-2 border-amber-500 shadow-md animate-pulse'; // Amber blinking
        if (isReserved) bgClass = 'bg-blue-50 text-blue-900 border-2 border-blue-400 shadow-xs hover:border-blue-600'; // Blue for reserved
        if (isLocked) bgClass = 'bg-slate-100 text-slate-400 border border-slate-300 opacity-60 cursor-not-allowed'; // Red for locked/merged

        if (isSelected) {
            bgClass += ' ring-4 ring-orange-500 ring-offset-2 ring-offset-slate-50 transform scale-105 z-10';
        }

        // Kiểm tra yêu cầu phục vụ từ khách
        const serviceCall = activeServiceCalls[String(table.id)];
        let rightIndicator = `<span class="w-2.5"></span>`;
        if (serviceCall) {
            if (serviceCall.type === 'CALL') {
                rightIndicator = `<span class="inline-flex items-center gap-0.5 bg-red-600 text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full shadow border border-white animate-bounce leading-none select-none"><i class="fa-solid fa-bell text-[7px]"></i>Gọi</span>`;
                bgClass += ' ring-4 ring-red-500 ring-offset-2 ring-offset-slate-50';
            } else {
                rightIndicator = `<span class="inline-flex items-center gap-0.5 bg-amber-400 text-amber-950 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full shadow border border-white animate-bounce leading-none select-none"><i class="fa-solid fa-receipt text-[7px]"></i>Bill</span>`;
                bgClass += ' ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-50';
            }
        } else if (isReserved) {
            rightIndicator = `<span class="inline-flex items-center gap-0.5 bg-blue-500 text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full shadow border border-white leading-none select-none"><i class="fa-solid fa-calendar-check text-[7px]"></i>${table.reservation?.time || 'Đặt'}</span>`;
        } else if (isWaitingPayment) {
            rightIndicator = `<span class="w-2 h-2 rounded-full bg-amber-300 border border-white shadow-xs animate-bounce"></span>`;
        } else if (isOccupied) {
            rightIndicator = `<span class="w-2 h-2 rounded-full bg-orange-400 border border-white shadow-xs animate-pulse"></span>`;
        }

        const isVip = (table.zone || '').toLowerCase().includes('vip') || (table.tableNumber || '').toLowerCase().includes('vip');
        const vipBadge = isVip 
            ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 text-[8px] sm:text-[9px] font-black border border-amber-300 shadow-xs uppercase tracking-tighter leading-none select-none"><i class="fa-solid fa-crown text-[7px] sm:text-[8px]"></i>VIP</span>` 
            : `<span class="w-2.5"></span>`;

        let zoneLabel = '';
        if (isVip) {
            zoneLabel = 'Phòng VIP';
        } else if ((table.zone || '').toLowerCase().includes('2') || (table.zone || '').toLowerCase().includes('sân vườn')) {
            zoneLabel = 'Tầng 2';
        } else {
            zoneLabel = 'Tầng 1';
        }

        let statusText = 'Trống';
        if (isLocked) statusText = 'Đang gộp';
        else if (isWaitingPayment) statusText = 'Chờ bill';
        else if (isOccupied) statusText = 'Có khách';
        else if (isReserved) statusText = 'Đặt trước';

        // Extra info labels
        let bottomText = zoneLabel;
        if (isReserved && table.reservation?.guestName) {
            bottomText = table.reservation.guestName;
        } else if (isLocked) {
            const parent = allTables.find(p => p.id === table.merged_with);
            bottomText = `Gộp ${parent ? parent.tableNumber : ''}`;
        } else if (isOccupied) {
            const children = allTables.filter(c => c.merged_with === table.id);
            if (children.length > 0) {
                bottomText = `+${children.map(c => c.tableNumber).join(', ')}`;
            }
        }

        const isLongName = String(table.tableNumber).length > 3;
        const numFontSize = isLongName ? 'text-base sm:text-lg lg:text-xl' : 'text-xl sm:text-2xl lg:text-3xl';

        const btn = document.createElement('button');
        btn.className = `relative aspect-square w-full min-h-0 min-w-0 flex flex-col justify-between p-2 sm:p-2.5 rounded-2xl border text-center transition-all hover:brightness-110 active:scale-95 overflow-hidden select-none cursor-pointer ${bgClass}`;
        
        // Drag and drop implementation
        if (isOccupied || isWaitingPayment) {
            btn.draggable = true;
            btn.addEventListener('dragstart', (e) => {
                e.dataTransfer?.setData('text/plain', table.id);
                btn.classList.add('opacity-50', 'scale-90');
            });
            btn.addEventListener('dragend', () => {
                btn.classList.remove('opacity-50', 'scale-90');
            });
        }
        
        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            btn.classList.add('brightness-125', 'ring-4', 'ring-white/20');
        });
        
        btn.addEventListener('dragleave', () => {
            btn.classList.remove('brightness-125', 'ring-4', 'ring-white/20');
        });
        
        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            btn.classList.remove('brightness-125', 'ring-4', 'ring-white/20');
            const sourceId = e.dataTransfer?.getData('text/plain');
            if (sourceId && sourceId !== table.id) {
                handleTableDragDrop(sourceId, table.id);
            }
        });

        btn.innerHTML = `
            <div class="w-full flex items-center justify-between h-4 sm:h-5 shrink-0 pointer-events-none">
                ${vipBadge}
                ${rightIndicator}
            </div>
            <div class="flex-1 flex flex-col items-center justify-center my-auto px-0.5 min-h-0 pointer-events-none">
                <span class="${numFontSize} font-black tracking-tight leading-none whitespace-nowrap mb-1">${table.tableNumber}</span>
                <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-90 whitespace-nowrap leading-none">${statusText}</span>
            </div>
            <div class="w-full h-3.5 sm:h-4 shrink-0 flex items-center justify-center pointer-events-none">
                <span class="text-[8px] sm:text-[9px] font-semibold opacity-75 whitespace-nowrap truncate leading-none">${bottomText}</span>
            </div>
        `;
        btn.onclick = () => handleTableClick(table);
        grid.appendChild(btn);
    });
};

const handleTableDragDrop = async (sourceId: string, targetId: string) => {
    const source = allTables.find(t => t.id === sourceId);
    const target = allTables.find(t => t.id === targetId);
    if (!source || !target) return;

    if (target.status === 'Available') {
        const sourceNum = parseInt(source.tableNumber.replace(/\D/g, ''));
        const targetNum = parseInt(target.tableNumber.replace(/\D/g, ''));
        const isAdjacent = [1, 2, 3, 4, 5].includes(Math.abs(sourceNum - targetNum));

        const action = await showMoveMergeModal(source.tableNumber, target.tableNumber);
        
        if (action === 'move') {
            try {
                target.status = source.status;
                source.status = 'Available';
                
                const activeOrders = await layDonHangDangMoCuaBan(sourceId);
                if (activeOrders.length > 0) {
                    await fetch(`${API_ORDERS_URL}/${activeOrders[0].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_id: targetId }) });
                }
                
                await fetch(`${API_TABLES_URL}/${sourceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Available' }) });
                await fetch(`${API_TABLES_URL}/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: target.status, tableNumber: target.tableNumber.split(' & ')[0] }) });
                
                showSuccessToast(`Đã chuyển khách sang ${target.tableNumber}`);
                allTables = await layDanhSachBan();
                renderTables();
            } catch (err) { console.error(err); }
        } else if (action === 'merge') {
            if (!isAdjacent) {
                showWarningToast("Lỗi: Chỉ được ghép với các bàn liền kề!");
                return;
            }
            try {
                // Khóa bàn đích
                await fetch(`${API_TABLES_URL}/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Locked', merged_with: sourceId }) });

                showSuccessToast(`Đã ghép ${target.tableNumber} vào ${source.tableNumber}`);
                allTables = await layDanhSachBan();
                renderTables();
            } catch (err) { console.error(err); }
        }
    } else {
        showWarningToast("Bàn đích đang có người hoặc bị khóa, không thể thao tác!");
    }
};

const handleTableClick = async (table: any, isSilent = false) => {
    selectedTableId = table.id;
    if (!isSilent) renderTables(); // Chỉ vẽ lại lưới bàn nếu click tay
    
    const rightPanelOccupied = document.getElementById('table-detail-panel')!;
    const rightPanelEmpty = document.getElementById('table-empty-panel')!;
    
    const tStatus = (table.status || '').toLowerCase();
    if (tStatus === 'available') {
        rightPanelOccupied.classList.add('hidden');
        rightPanelEmpty.classList.remove('hidden');
        rightPanelEmpty.innerHTML = `
            <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl font-black border border-emerald-500/20 mb-3">
                <i class="fa-solid fa-utensils"></i>
            </div>
            <p class="font-bold text-slate-900 text-lg mb-1">${table.tableNumber} đang trống</p>
            <p class="text-xs text-amber-600 font-bold mb-1 flex items-center justify-center gap-1.5"><i class="fa-solid fa-location-dot text-[11px]"></i> ${table.zone || (table.tableNumber.toLowerCase().includes('vip') ? 'Phòng VIP' : 'Khu vực Tầng 1')}</p>
            <p class="text-xs text-slate-500 mb-5">Sức chứa: ${table.max_capacity || 4} khách</p>
            <div class="flex flex-col gap-2.5 w-full max-w-[220px]">
                <button id="btn-open-table" class="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-play text-sm"></i> Mở bàn
                </button>
                <button id="btn-open-reserve-modal" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-xs cursor-pointer">
                    <i class="fa-solid fa-calendar-check text-sm"></i> Đặt trước bàn
                </button>
            </div>
        `;
        document.getElementById('btn-open-table')!.onclick = () => openTable(table.id);
        document.getElementById('btn-open-reserve-modal')!.onclick = () => openReservationModal(table);
    } else if (table.status === 'Reserved') {
        rightPanelOccupied.classList.add('hidden');
        rightPanelEmpty.classList.remove('hidden');
        const res = table.reservation || {};
        rightPanelEmpty.innerHTML = `
            <div class="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-2xl font-black border border-blue-500/20 mb-2">
                <i class="fa-solid fa-calendar-check"></i>
            </div>
            <p class="font-bold text-slate-900 text-lg mb-1">${table.tableNumber}</p>
            <span class="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">ĐÃ ĐẶT TRƯỚC</span>
            
            <div class="w-full bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-5 text-left text-xs space-y-2.5">
                <div class="flex justify-between border-b border-slate-200/80 pb-1.5">
                    <span class="text-slate-500">Khách hàng:</span>
                    <span class="font-bold text-slate-900 text-sm">${res.guestName || 'Chưa có tên'}</span>
                </div>
                <div class="flex justify-between border-b border-slate-200/80 pb-1.5">
                    <span class="text-slate-500">Số điện thoại:</span>
                    <span class="font-bold text-blue-600 font-mono">${res.phone || '--'}</span>
                </div>
                <div class="flex justify-between border-b border-slate-200/80 pb-1.5">
                    <span class="text-slate-500">Giờ hẹn đến:</span>
                    <span class="font-bold text-amber-600 font-mono">${res.time || '--'}</span>
                </div>
                <div class="flex justify-between border-b border-slate-200/80 pb-1.5">
                    <span class="text-slate-500">Số khách:</span>
                    <span class="font-bold text-slate-900">${res.pax || 2} người</span>
                </div>
                ${res.notes ? `
                <div class="pt-1 text-slate-700 italic">
                    <span class="text-slate-500 not-italic">Ghi chú:</span> ${res.notes}
                </div>` : ''}
            </div>

            <div class="flex flex-col gap-2.5 w-full">
                <button id="btn-checkin-reserve" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-user-check"></i> Khách đến - Mở bàn
                </button>
                <button id="btn-cancel-reserve-table" class="w-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer">
                    <i class="fa-solid fa-trash-can"></i> Hủy đặt trước
                </button>
            </div>
        `;
        document.getElementById('btn-checkin-reserve')!.onclick = () => checkinReservedTable(table);
        document.getElementById('btn-cancel-reserve-table')!.onclick = () => cancelReservation(table);
    } else if (table.status === 'Locked') {
        rightPanelOccupied.classList.add('hidden');
        rightPanelEmpty.classList.remove('hidden');
        const parentTable = allTables.find(t => t.id === table.merged_with);
        rightPanelEmpty.innerHTML = `
            <div class="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center text-2xl font-black border border-red-500/20 mb-2">
                <i class="fa-solid fa-lock"></i>
            </div>
            <p class="font-bold text-slate-900 text-lg mb-1">${table.tableNumber}</p>
            <span class="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1 rounded-full mb-4">BÀN ĐÃ GỘP</span>
            
            <div class="w-full bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-5 text-left text-xs space-y-2">
                <p class="text-slate-700">Bàn này đang được ghép chung vào bàn chính: <strong class="text-slate-900 text-sm">${parentTable ? parentTable.tableNumber : 'Khác'}</strong></p>
                <p class="text-slate-500 text-[11px]">Tất cả đơn hàng và phục vụ đều được ghi nhận vào bàn chính.</p>
            </div>

            <button id="btn-unmerge-single-table" class="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                <i class="fa-solid fa-link-slash"></i> Tách bàn này (Mở lại)
            </button>
        `;
        document.getElementById('btn-unmerge-single-table')!.onclick = () => unmergeSingleTable(table);
    } else {
        rightPanelEmpty.classList.add('hidden');
        rightPanelOccupied.classList.remove('hidden');
        rightPanelOccupied.classList.add('flex');
        
        document.getElementById('td-title')!.innerText = table.tableNumber;
        document.getElementById('td-status')!.innerText = table.status === 'Waiting_Payment' ? 'Chờ thanh toán' : 'Đang phục vụ';
        
        const tdZone = document.getElementById('td-zone-badge');
        if (tdZone) {
            tdZone.classList.remove('hidden');
            const isVipTable = (table.zone || '').toLowerCase().includes('vip') || (table.tableNumber || '').toLowerCase().includes('vip');
            if (isVipTable) {
                tdZone.className = "bg-amber-400 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1";
                tdZone.innerHTML = `<i class="fa-solid fa-crown text-[10px]"></i> ${table.zone || 'Phòng VIP'}`;
            } else {
                tdZone.className = "bg-black/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full";
                tdZone.innerText = table.zone || 'Tầng 1';
            }
        }

        document.getElementById('td-total')!.innerText = '0 đ';
        document.getElementById('td-count')!.innerText = '0 món';

        // Merged children indicator
        const mergedChildren = allTables.filter(t => t.merged_with === table.id);
        const mergedBanner = document.getElementById('td-merged-banner');
        if (mergedBanner) {
            if (mergedChildren.length > 0) {
                mergedBanner.innerHTML = `
                    <div class="p-2.5 rounded-xl bg-orange-700/30 border border-orange-400/40 text-xs flex items-center justify-between">
                        <span class="font-bold text-orange-100 flex items-center gap-1.5 truncate">
                            <i class="fa-solid fa-link"></i> Đã gộp: ${mergedChildren.map(c => c.tableNumber).join(', ')}
                        </span>
                        <button id="btn-unmerge-children" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black shrink-0 transition shadow cursor-pointer">
                            <i class="fa-solid fa-link-slash"></i> Tách bàn
                        </button>
                    </div>
                `;
                mergedBanner.classList.remove('hidden');
                document.getElementById('btn-unmerge-children')?.addEventListener('click', () => {
                    unmergeAllChildren(table.id);
                });
            } else {
                mergedBanner.innerHTML = '';
                mergedBanner.classList.add('hidden');
            }
        }

        // Hiển thị cảnh báo nếu bàn đang có yêu cầu phục vụ / tính tiền
        const serviceCall = activeServiceCalls[String(table.id)];
        const alertContainer = document.getElementById('td-service-alert');
        if (alertContainer) {
            if (serviceCall) {
                const isCall = serviceCall.type === 'CALL';
                alertContainer.innerHTML = `
                    <div class="p-3 rounded-2xl border ${isCall ? 'bg-red-500/20 border-red-500/40 text-red-100' : 'bg-amber-500/20 border-amber-500/40 text-amber-100'} shadow-lg">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                                <i class="fa-solid ${isCall ? 'fa-bell text-red-400' : 'fa-receipt text-amber-400'} animate-bounce"></i>
                                ${isCall ? 'Khách đang gọi!' : 'Khách yêu cầu Bill!'}
                            </span>
                            <span class="text-[10px] font-mono opacity-80">${serviceCall.time}</span>
                        </div>
                        <p class="text-xs font-bold mb-2">${isCall ? (serviceCall.reason || 'Cần hỗ trợ tại bàn') : `Phương thức: ${serviceCall.method || 'Tiền mặt'}`}</p>
                        <button id="btn-ack-service" class="w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm">
                            <i class="fa-solid fa-check"></i> Xác nhận đã tiếp nhận
                        </button>
                    </div>
                `;
                alertContainer.classList.remove('hidden');
                document.getElementById('btn-ack-service')?.addEventListener('click', () => {
                    delete activeServiceCalls[String(table.id)];
                    kdsChannel.postMessage({
                        type: 'WAITER_ACKNOWLEDGED',
                        tableId: table.id,
                        message: 'Nhân viên đang tới bàn!'
                    });
                    showSuccessToast('Đã tiếp nhận yêu cầu từ khách!');
                    updateServiceCenterBadge();
                    renderTables();
                    handleTableClick(table, true);
                });
            } else {
                alertContainer.innerHTML = '';
                alertContainer.classList.add('hidden');
            }
        }
        
        const container = document.getElementById('td-items-container')!;
        const list = document.getElementById('td-items-list')!;
        container.classList.add('hidden');
        list.innerHTML = '';
        
        try {
            const orders = await layDonHangDangMoCuaBan(table.id);
            if (orders.length > 0) {
                const order = (table.currentOrder_id && orders.find((o: any) => (o.id || o._id) === table.currentOrder_id)) || orders[orders.length - 1];
                currentOrderId = order.id || order._id;
                let details: any[] = [];
                if (currentOrderId) {
                    details = await layChiTietCuaDon(currentOrderId);
                }
                // Nếu bàn có nhiều đơn đang mở, gộp toàn bộ chi tiết món của các đơn để không bị mất món
                if (orders && orders.length > 1) {
                    const seenIds = new Set(details.map((d: any) => String(d.id || d._id)));
                    for (const otherOrd of orders) {
                        const oid = otherOrd.id || otherOrd._id;
                        if (oid && String(oid) !== String(currentOrderId)) {
                            const moreDetails = await layChiTietCuaDon(oid);
                            if (Array.isArray(moreDetails)) {
                                for (const md of moreDetails) {
                                    const mid = String(md.id || md._id);
                                    if (!seenIds.has(mid)) {
                                        seenIds.add(mid);
                                        details.push(md);
                                    }
                                }
                            }
                        }
                    }
                }
                
                let calculatedTotal = 0;
                let calculatedCount = 0;
                let itemsHtml = '';
                let hasPendingOrReady = false;
                
                details.forEach((curr: any) => {
                    const price = curr.priceAtOrder !== undefined ? curr.priceAtOrder : (curr.price || 0);
                    calculatedTotal += price * curr.quantity;
                    calculatedCount += curr.quantity;
                    
                    const st = (curr.status || '').toLowerCase();
                    if (st === 'unconfirmed' || st === 'pending' || st === 'cooking' || st === 'ready') {
                        hasPendingOrReady = true;
                        const mId = (curr.menuItem_id && typeof curr.menuItem_id === 'object') ? String(curr.menuItem_id.id || curr.menuItem_id._id) : String(curr.menuItem_id || '');
                        const mon = allMenuItems.find(m => String(m.id || m._id) === mId);
                        const mName = (curr.menuItem_id && typeof curr.menuItem_id === 'object' && curr.menuItem_id.name) ? curr.menuItem_id.name : (mon ? mon.name : (curr.name || 'Món ăn'));
                        
                        let badge = '';
                        if (st === 'unconfirmed') badge = `<span class="whitespace-nowrap shrink-0 bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">Chờ duyệt</span>`;
                        else if (st === 'pending') badge = `<span class="whitespace-nowrap shrink-0 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded font-bold">Chờ bếp</span>`;
                        else if (st === 'cooking') badge = `<span class="whitespace-nowrap shrink-0 bg-orange-50 text-orange-700 border border-orange-200 text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">Đang nấu</span>`;
                        else if (st === 'ready') badge = `<span class="whitespace-nowrap shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-black shadow-xs">Sẵn sàng!</span>`;
                        
                        itemsHtml += `
                            <li class="flex justify-between items-center bg-white border border-slate-200 p-2 rounded-lg shadow-xs">
                                <span class="text-xs font-bold text-slate-800 truncate max-w-[140px]" title="${mName}">x${curr.quantity} ${mName}</span>
                                ${badge}
                            </li>
                        `;
                    }
                });
                
                if (hasPendingOrReady) {
                    container.classList.remove('hidden');
                    list.innerHTML = itemsHtml;
                }
                
                document.getElementById('td-total')!.innerText = formatMoney(calculatedTotal);
                document.getElementById('td-count')!.innerText = `${calculatedCount} món`;
            }
        } catch (e) {
            console.error(e);
        }
        
        document.getElementById('btn-td-action')!.onclick = () => {
            (window as any).switchTab('details');
            loadTableDetails(table.id, table.tableNumber);
        };
    }
};

const checkinReservedTable = async (table: any) => {
    try {
        const pax = table.reservation?.pax || 2;
        await fetch(`${API_TABLES_URL}/${table.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Occupied',
                current_pax: pax,
                reservation: null
            })
        });
        const orderData = {
            table_id: table.id,
            customerInfo: table.reservation?.guestName ? `Khách đặt: ${table.reservation.guestName}` : "Khách vãng lai",
            totalAmount: 0,
            status: "In_Progress",
            paymentStatus: "Unpaid",
            createdAt: new Date().toISOString()
        };
        await taoDonHang(orderData);
        await loadTables();
        const updatedTable = allTables.find(t => t.id === table.id);
        if (updatedTable) handleTableClick(updatedTable);
        showSuccessToast(`Đã nhận bàn ${table.tableNumber} cho khách!`);
    } catch (e) {
        console.error(e);
        showWarningToast("Lỗi khi mở bàn đặt trước!");
    }
};

const cancelReservation = async (table: any) => {
    const isConfirmed = await showConfirmModal("Hủy đặt trước", `Bạn có chắc chắn muốn hủy đặt trước cho ${table.tableNumber}?`);
    if (!isConfirmed) return;
    try {
        await fetch(`${API_TABLES_URL}/${table.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Available',
                reservation: null
            })
        });
        await loadTables();
        const updatedTable = allTables.find(t => t.id === table.id);
        if (updatedTable) handleTableClick(updatedTable);
        showSuccessToast(`Đã hủy đặt trước ${table.tableNumber}!`);
    } catch (e) {
        console.error(e);
        showWarningToast("Lỗi khi hủy đặt trước!");
    }
};

const unmergeSingleTable = async (table: any) => {
    const isConfirmed = await showConfirmModal("Tách bàn", `Xác nhận tách ${table.tableNumber} trở lại thành bàn trống?`);
    if (!isConfirmed) return;
    try {
        await fetch(`${API_TABLES_URL}/${table.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Available',
                merged_with: null
            })
        });
        await loadTables();
        const updatedTable = allTables.find(t => t.id === table.id);
        if (updatedTable) handleTableClick(updatedTable);
        showSuccessToast(`Đã tách ${table.tableNumber} thành công!`);
    } catch (e) {
        console.error(e);
        showWarningToast("Lỗi khi tách bàn!");
    }
};

const unmergeAllChildren = async (parentTableId: string) => {
    const isConfirmed = await showConfirmModal("Tách các bàn đã gộp", "Bạn muốn hủy ghép toàn bộ các bàn phụ về lại bàn trống?");
    if (!isConfirmed) return;
    try {
        const mergedChildren = allTables.filter(t => t.merged_with === parentTableId);
        for (const child of mergedChildren) {
            await fetch(`${API_TABLES_URL}/${child.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Available',
                    merged_with: null
                })
            });
        }
        await loadTables();
        const updatedParent = allTables.find(t => t.id === parentTableId);
        if (updatedParent) handleTableClick(updatedParent);
        showSuccessToast(`Đã tách các bàn đã gộp thành công!`);
    } catch (e) {
        console.error(e);
        showWarningToast("Lỗi khi tách bàn!");
    }
};

const openReservationModal = (table: any) => {
    targetReservationTableId = table.id;
    const modal = document.getElementById('modal-reserve-table');
    const title = document.getElementById('reserve-modal-title');
    if (title) title.innerText = `Đặt trước ${table.tableNumber}`;

    const nameInput = document.getElementById('reserve-name') as HTMLInputElement;
    const phoneInput = document.getElementById('reserve-phone') as HTMLInputElement;
    const timeInput = document.getElementById('reserve-time') as HTMLInputElement;
    const paxInput = document.getElementById('reserve-pax') as HTMLInputElement;
    const notesInput = document.getElementById('reserve-notes') as HTMLInputElement;

    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (notesInput) notesInput.value = '';
    if (paxInput) paxInput.value = String(table.max_capacity || 4);
    if (timeInput) {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

const openTable = async (tableId: string) => {
    const { isConfirmed, value } = await showNumberPromptModal("Mở bàn", "Nhập số lượng khách", "2");
    if (!isConfirmed) return;

    try {
        await capNhatTrangThaiBan(tableId, 'Occupied', value);
        const orderData = {
            table_id: tableId,
            customerInfo: "Khách vãng lai",
            totalAmount: 0,
            status: "In_Progress",
            paymentStatus: "Unpaid",
            createdAt: new Date().toISOString()
        };
        await taoDonHang(orderData);
        await loadTables();
        const table = allTables.find(t => t.id === tableId);
        if (table) handleTableClick(table);
        showSuccessToast("Đã mở bàn thành công!");
    } catch (e) {
        console.error(e);
        showConfirmModal("Lỗi", "Có lỗi xảy ra khi mở bàn. Vui lòng thử lại!");
    }
};

// ==========================================
// TAB 2: CHI TIẾT ĐƠN (ORDER DETAILS)
// ==========================================
let currentTableDetailsHash = "";
const loadTableDetails = async (tableId: string, tableNumber: string, isBackground = false) => {
    selectedTableId = tableId;
    document.getElementById('detail-table-title')!.innerText = tableNumber;
    document.getElementById('detail-table-name')!.innerText = tableNumber;
    
    // Nếu click tay thì mới xoá chọn
    if (!isBackground) {
        selectedOrderItemIds = [];
        document.getElementById('detail-order-time')!.innerText = new Date().toLocaleString('vi-VN');
    }
    
    const table = allTables.find(t => t.id === tableId);
    if (table) {
        const statusSpan = document.getElementById('detail-status')!;
        if (table.status === 'Waiting_Payment') {
            statusSpan.innerText = 'CHỜ THANH TOÁN';
            statusSpan.className = 'bg-amber-50 text-amber-800 border border-amber-300 text-sm font-bold px-4 py-2 rounded-lg flex items-center uppercase tracking-wider shadow-2xs';
        } else {
            statusSpan.innerText = 'ĐANG PHỤC VỤ';
            statusSpan.className = 'bg-white border border-slate-200 text-slate-700 text-sm font-bold px-4 py-2 rounded-lg flex items-center uppercase tracking-wider shadow-2xs';
        }
    }
    
    try {
        if (!isBackground) allMenuItems = await layDanhSachMonAn();
        
        const orders = await layDonHangDangMoCuaBan(tableId);
        if (orders.length === 0) return;
        const activeOrder = (table?.currentOrder_id && orders.find((o: any) => (o.id || o._id) === table.currentOrder_id)) || orders[orders.length - 1];
        currentOrderId = activeOrder.id || activeOrder._id;
        
        // Hiển thị ghi chú toàn bàn nếu có
        const tableNoteEl = document.getElementById('detail-table-order-note');
        const tableNoteText = document.getElementById('detail-table-order-note-text');
        if (tableNoteEl && tableNoteText) {
            const tNote = (activeOrder.notes || '').trim();
            if (tNote) {
                tableNoteText.innerHTML = `Ghi chú bàn: <span class="text-white">${tNote}</span>`;
                tableNoteEl.classList.remove('hidden');
            } else {
                tableNoteEl.classList.add('hidden');
            }
        }
        
        const tableOrders = await layDonHangDangMoCuaBan(tableId);
        let details: any[] = [];
        if (currentOrderId) {
            details = await layChiTietCuaDon(currentOrderId);
        }
        // Nếu bàn có nhiều đơn đang mở, gộp toàn bộ chi tiết món của các đơn để không bị mất món
        if (tableOrders && tableOrders.length > 1) {
            const seenIds = new Set(details.map((d: any) => String(d.id || d._id)));
            for (const otherOrd of tableOrders) {
                const oid = otherOrd.id || otherOrd._id;
                if (oid && String(oid) !== String(currentOrderId)) {
                    const moreDetails = await layChiTietCuaDon(oid);
                    if (Array.isArray(moreDetails)) {
                        for (const md of moreDetails) {
                            const mid = String(md.id || md._id);
                            if (!seenIds.has(mid)) {
                                seenIds.add(mid);
                                details.push(md);
                            }
                        }
                    }
                }
            }
        }
        cachedCurrentOrderDetails = details;
        cachedCurrentPax = table?.current_pax || 0;
        
        // HASH COMPARE
        const newDataHash = JSON.stringify(details);
        if (isBackground && newDataHash === currentTableDetailsHash) return;
        currentTableDetailsHash = newDataHash;
        
        renderOrderDetails(details, table?.current_pax || 0);
    } catch (e) {
        console.error(e);
    }
};

(window as any).selectOrderItem = (id: string) => {
    if (selectedOrderItemIds.includes(id)) {
        selectedOrderItemIds = selectedOrderItemIds.filter(i => i !== id);
    } else {
        selectedOrderItemIds.push(id);
    }
    // Rerender styling manually without fetching
    document.querySelectorAll('.order-item-row').forEach(row => {
        if (selectedOrderItemIds.includes(row.getAttribute('data-id') || '')) {
            row.classList.add('bg-orange-50', 'shadow-[inset_4px_0_0_0_#f97316]');
            row.classList.remove('hover:bg-slate-50');
        } else {
            row.classList.remove('bg-orange-50', 'shadow-[inset_4px_0_0_0_#f97316]');
            row.classList.add('hover:bg-slate-50');
        }
    });
};

const renderOrderDetails = (details: any[], pax: number = 0) => {
    cachedCurrentOrderDetails = details;
    cachedCurrentPax = pax;

    const list = document.getElementById('detail-items-list')!;
    list.innerHTML = '';
    
    document.getElementById('detail-guest-count')!.innerText = `${pax} khách`;

    if (details.length === 0) {
        list.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500 font-bold">Chưa gọi món nào</td></tr>`;
        return;
    }

    // Gộp các món giống nhau (cùng menuItem_id, cùng trạng thái, cùng ghi chú)
    const groupedMap = new Map();
    details.forEach(item => {
        const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
        const noteStr = (item.notes || item.variantNote || item.note || '').trim();
        const key = `${mId}_${(item.status || '').toLowerCase()}_${noteStr}`;
        const itemId = String(item.id || item._id || '');
        if (!groupedMap.has(key)) {
            groupedMap.set(key, { ...item, notes: noteStr, variantNote: noteStr, ids: [itemId] });
        } else {
            const existing = groupedMap.get(key);
            existing.quantity += item.quantity;
            existing.ids.push(itemId);
        }
    });

    const groupedDetails = Array.from(groupedMap.values());

    // Bộ lọc trạng thái: 'all' | 'unconfirmed' | 'cooking' | 'ready' | 'served'
    let filteredDetails = groupedDetails;
    if (currentDetailStatusFilter === 'unconfirmed') {
        filteredDetails = groupedDetails.filter(it => (it.status || '').toLowerCase() === 'unconfirmed');
    } else if (currentDetailStatusFilter === 'cooking') {
        filteredDetails = groupedDetails.filter(it => ['cooking', 'pending'].includes((it.status || '').toLowerCase()));
    } else if (currentDetailStatusFilter === 'ready') {
        filteredDetails = groupedDetails.filter(it => (it.status || '').toLowerCase() === 'ready');
    } else if (currentDetailStatusFilter === 'served') {
        filteredDetails = groupedDetails.filter(it => (it.status || '').toLowerCase() === 'served');
    }

    if (filteredDetails.length === 0) {
        list.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500 font-bold">Không có món nào thuộc bộ lọc này</td></tr>`;
        return;
    }

    filteredDetails.forEach((item: any) => {
        const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
        const menuObj = allMenuItems.find(m => String(m.id || m._id) === mId);
        const name = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.name) ? item.menuItem_id.name : (menuObj ? menuObj.name : (item.name || 'Món không rõ'));
        const img = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.image) ? item.menuItem_id.image : (menuObj ? menuObj.image : '');
        const compositeId = item.ids.join(',');
        const rawStatus = (item.status || '').toLowerCase();
        const itemPrice = Number(item.priceAtOrder !== undefined && item.priceAtOrder !== null ? item.priceAtOrder : (item.price !== undefined && item.price !== null ? item.price : (menuObj ? (menuObj.price || menuObj.base_price) : 0))) || 0;
        
        let statusBadge = '';
        let fastActionBtn = '';

        if (rawStatus === 'unconfirmed') {
            statusBadge = `<span class="bg-amber-50 text-amber-800 border border-amber-300 text-xs px-2.5 py-1 rounded-full animate-pulse font-bold whitespace-nowrap">Chờ XN</span>`;
            fastActionBtn = `<button type="button" onclick="event.stopPropagation(); quickApproveDish('${compositeId}', '${name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition shadow shadow-emerald-500/20 cursor-pointer shrink-0" title="Duyệt món này gửi xuống bếp"><i class="fa-solid fa-check"></i> Duyệt</button>`;
        } else if (rawStatus === 'pending') {
            statusBadge = `<span class="bg-slate-100 text-slate-700 border border-slate-300 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">Chờ bếp</span>`;
            fastActionBtn = `<button type="button" onclick="event.stopPropagation(); quickRushDish('${compositeId}', '${name.replace(/'/g, "\\'")}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 rounded-lg text-[10px] font-black transition cursor-pointer shrink-0" title="Giục món này"><i class="fa-solid fa-bolt"></i> Giục</button>`;
        } else if (rawStatus === 'cooking') {
            statusBadge = `<span class="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">Đang nấu</span>`;
            fastActionBtn = `<button type="button" onclick="event.stopPropagation(); quickRushDish('${compositeId}', '${name.replace(/'/g, "\\'")}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 rounded-lg text-[10px] font-black transition cursor-pointer shrink-0" title="Giục món này"><i class="fa-solid fa-bolt"></i> Giục</button>`;
        } else if (rawStatus === 'ready') {
            statusBadge = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-black shadow-sm">Bếp xong</span>`;
            fastActionBtn = `<button type="button" onclick="event.stopPropagation(); quickServeDish('${compositeId}', '${name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition shadow shadow-emerald-500/20 cursor-pointer shrink-0" title="Đánh dấu đã lên bàn"><i class="fa-solid fa-check"></i> Trả món</button>`;
        } else if (rawStatus === 'served') {
            statusBadge = `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">Đã phục vụ</span>`;
        } else if (rawStatus === 'cancelled') {
            statusBadge = `<span class="bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full line-through whitespace-nowrap">Đã hủy</span>`;
        }
        
        let variantText = '';
        let actualNotes = '';

        const rawNote = (item.notes || item.variantNote || item.note || '').trim();

        // Tách biến thể và ghi chú:
        // Định dạng 1: [Variant] Note (do waiter tạo: [Size L, Nóng] ít ngọt)
        const matchBracket = rawNote.match(/^\[(.*?)\]\s*(.*)$/);
        if (matchBracket) {
            variantText = matchBracket[1].trim();
            actualNotes = matchBracket[2].trim();
        } else if (rawNote.includes(' | ')) {
            // Định dạng 2: Variant | Note (do customer tạo: Size L | ít đá)
            const parts = rawNote.split(' | ').map((s: string) => s.trim()).filter(Boolean);
            variantText = parts[0];
            const normV = variantText.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
            const noteParts = parts.slice(1).filter((p: string) => {
                const normP = p.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
                return normP !== normV && !normV.includes(normP);
            });
            actualNotes = noteParts.join(' | ').trim();
        } else if (item.variants_selected && item.variants_selected.length > 0) {
            variantText = rawNote;
            actualNotes = '';
        } else if (rawNote.includes('(+') || rawNote.includes('Size') || rawNote.includes('size')) {
            variantText = rawNote;
            actualNotes = '';
        } else {
            actualNotes = rawNote;
        }

        // Loại bỏ trùng lặp nếu actualNotes giống hệt variantText (do cart tự copy)
        const normVariant = variantText.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
        const normNote = actualNotes.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
        if (normVariant && normNote && (normVariant === normNote || normVariant.includes(normNote))) {
            actualNotes = '';
        }

        // Format Biến thể / Topping dạng chip nhỏ gọn, tự xuống dòng
        let variantHtml = `<span class="text-xs text-slate-400 font-normal">-</span>`;
        if (variantText && variantText !== '-') {
            const options = variantText.split(',').map((s: string) => s.trim()).filter(Boolean);
            if (options.length > 0) {
                variantHtml = `
                    <div class="flex flex-wrap gap-1 max-w-full">
                        ${options.map((opt: string) => `
                            <span class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs leading-normal">
                                <span class="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                                <span>${opt}</span>
                            </span>
                        `).join('')}
                    </div>
                `;
            }
        }

        // Format Ghi chú riêng biệt nổi bật màu cam, nhỏ gọn cân đối
        let notesHtml = `<span class="text-xs text-slate-400 font-normal">-</span>`;
        if (actualNotes && actualNotes !== '-') {
            notesHtml = `
                <div class="max-w-full">
                    <span class="inline-flex items-start gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs leading-tight break-words">
                        <i class="fa-solid fa-pen-to-square text-amber-600 text-[9px] mt-0.5 shrink-0"></i>
                        <span>${actualNotes}</span>
                    </span>
                </div>
            `;
        }

        const isSelected = selectedOrderItemIds.includes(compositeId);
        const bgClass = isSelected ? 'bg-orange-50 shadow-[inset_4px_0_0_0_#f97316]' : 'hover:bg-slate-50';

        list.innerHTML += `
            <tr onclick="selectOrderItem('${compositeId}')" data-id="${compositeId}" class="order-item-row border-b border-slate-100 transition-colors cursor-pointer ${bgClass}">
                <!-- 1. Món ăn -->
                <td class="py-3 px-4 align-middle">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${img}" loading="lazy" decoding="async" class="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-200 shadow-xs" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80'">
                        <div class="min-w-0">
                            <div class="text-sm font-black text-slate-900 leading-snug break-words">${name}</div>
                            ${item.is_combo ? '<span class="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200">Set Combo</span>' : ''}
                        </div>
                    </div>
                </td>
                <!-- 2. Biến thể / Topping -->
                <td class="py-3 px-3 align-middle">${variantHtml}</td>
                <!-- 3. Ghi chú -->
                <td class="py-3 px-2.5 align-middle">${notesHtml}</td>
                <!-- 4. Số lượng -->
                <td class="py-3 px-1 text-center align-middle">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-800 font-black text-[11px] border border-slate-200 shadow-2xs">${item.quantity}</span>
                </td>
                <!-- 5. Thành tiền -->
                <td class="py-3 px-3 text-right align-middle">
                    <div class="text-xs font-black text-orange-600 whitespace-nowrap font-mono">${formatMoney(itemPrice * item.quantity)}</div>
                    ${item.quantity > 1 ? `<div class="text-[10px] text-slate-500 font-semibold whitespace-nowrap">${formatMoney(itemPrice)}/phần</div>` : ''}
                </td>
                <!-- 6. Trạng thái & Thao tác -->
                <td class="py-3 px-4 text-right align-middle">
                    <div class="inline-flex items-center gap-1.5 justify-end whitespace-nowrap">
                        ${statusBadge}
                        ${fastActionBtn}
                    </div>
                </td>
            </tr>
        `;
    });
};

// QUICK ACTIONS
document.getElementById('btn-request-checkout')?.addEventListener('click', async () => {
    if (!selectedTableId) return;
    const isConfirmed = await showConfirmModal("Yêu cầu Thanh toán", "Bạn muốn báo cho Thu ngân thanh toán bàn này?");
    if (!isConfirmed) return;
    
    try {
        await capNhatTrangThaiBan(selectedTableId, "Waiting_Payment");
        showSuccessToast('Đã gửi yêu cầu thanh toán!');
        
        // Refresh local table status and UI
        const table = allTables.find(t => t.id === selectedTableId);
        if (table) table.status = "Waiting_Payment";
        
        const tableTitle = document.getElementById('detail-table-title')!.innerText;
        loadTableDetails(selectedTableId, tableTitle);
        renderTables();
    } catch (e) {
        console.error(e);
        showConfirmModal("Lỗi", "Không thể gửi yêu cầu.");
    }
});

document.getElementById('btn-confirm-order')?.addEventListener('click', async () => {
    if (!currentOrderId) return;
    const isConfirmed = await showConfirmModal("Xác nhận", "Bạn có chắc chắn muốn duyệt và gửi lệnh order các món này xuống bếp?");
    if (!isConfirmed) return;
    
    const btn = document.getElementById('btn-confirm-order') as HTMLButtonElement;
    if (btn) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = 'Đang xử lý...';
        btn.disabled = true;
    }
    
    try {
        const details = await layChiTietCuaDon(currentOrderId);
        let count = 0;
        for (const item of details) {
            const st = (item.status || '').toLowerCase();
            if (st === 'unconfirmed') {
                const targetId = item.id || item._id;
                await capNhatChiTietDonHang(targetId, { status: 'Pending' });
                await new Promise(r => setTimeout(r, 60));
                count++;
            }
        }
        
        let activeTableId = selectedTableId;
        if (!activeTableId) {
            try {
                const allOrders = await layTatCaDonHang();
                const ord = (allOrders || []).find((o: any) => (o.id || o._id) === currentOrderId);
                if (ord) {
                    activeTableId = ord.table_id?._id || ord.table_id?.id || ord.table_id;
                    selectedTableId = activeTableId;
                }
            } catch (_) {}
        }

        if (count > 0) {
            // Đồng bộ mảng items trong Order nếu có
            try {
                if (activeTableId) {
                    const orders = await layDonHangDangMoCuaBan(activeTableId);
                    const ord = (orders || []).find((o: any) => (o.id || o._id) === currentOrderId);
                    if (ord && Array.isArray(ord.items)) {
                        ord.items.forEach((it: any) => {
                            if ((it.status || '').toLowerCase() === 'unconfirmed') it.status = 'Pending';
                        });
                        await capNhatDonHang(currentOrderId, { items: ord.items });
                    }
                }
            } catch (_) {}

            showSuccessToast(`Đã duyệt ${count} món và đẩy xuống Bếp!`);
            kdsChannel.postMessage({
                type: 'FOODHUB_NEW_ORDER',
                count,
                orderId: currentOrderId,
                tableId: activeTableId,
                message: `Có ${count} món mới chuyển xuống bếp!`
            });
        } else {
            showWarningToast('Không có món nào cần duyệt!');
        }
        
        if (activeTableId) {
            const tableTitle = document.getElementById('detail-table-title')?.innerText || 'Bàn';
            loadTableDetails(activeTableId, tableTitle);
        }
    } catch (e) {
        console.error(e);
        showWarningToast('Có lỗi xảy ra khi duyệt món!');
    } finally {
        if (btn) {
            btn.innerHTML = btn.dataset.original || '';
            btn.disabled = false;
        }
    }
});

document.getElementById('btn-update-status')?.addEventListener('click', async () => {
    if (!currentOrderId) return;
    if (selectedOrderItemIds.length === 0) {
        showWarningToast('Vui lòng chọn ít nhất một món ăn trong danh sách!');
        return;
    }
    
    const isConfirmed = await showConfirmModal("Xác nhận", "Cập nhật trạng thái các món đã chọn thành Đã phục vụ?");
    if (!isConfirmed) return;

    const btn = document.getElementById('btn-update-status') as HTMLButtonElement;
    if (btn) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = 'Đang xử lý...';
        btn.disabled = true;
    }
    
    try {
        const details = await layChiTietCuaDon(currentOrderId);
        // Flatten tất cả id chi tiết từ các dòng được chọn
        const allSelectedIds = selectedOrderItemIds.flatMap(compositeId => compositeId.split(','));
        
        let hasInvalidStatus = false;
        for (const id of allSelectedIds) {
            const item = details.find((d: any) => String(d.id) === id);
            if (item && item.status !== 'ready' && item.status !== 'Ready') {
                hasInvalidStatus = true;
                break;
            }
        }
        
        if (hasInvalidStatus) {
            showWarningToast('Một số món chưa nấu xong hoặc đã phục vụ!');
            return;
        }
        
        for (const id of allSelectedIds) {
            await capNhatChiTietDonHang(id, { status: 'Served' });
            await new Promise(r => setTimeout(r, 100)); // Delay nhỏ để backend không bị ngợp
        }
        
        selectedOrderItemIds = []; // Xóa chọn
        showSuccessToast('Đã phục vụ các món thành công!');
        loadTableDetails(selectedTableId!, document.getElementById('detail-table-title')!.innerText);
    } catch (e) {
        console.error(e);
    } finally {
        if (btn) {
            btn.innerHTML = btn.dataset.original || '';
            btn.disabled = false;
        }
    }
});

document.getElementById('btn-request-remake')?.addEventListener('click', async () => {
    if (!currentOrderId) return;
    if (selectedOrderItemIds.length === 0) {
        showWarningToast('Vui lòng chọn ít nhất một món ăn trong danh sách!');
        return;
    }
    
    const isConfirmed = await showConfirmModal("Cảnh báo", "Bạn có chắc chắn yêu cầu bếp làm lại các món đã chọn?");
    if (!isConfirmed) return;

    const btn = document.getElementById('btn-request-remake') as HTMLButtonElement;
    if (btn) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = 'Đang xử lý...';
        btn.disabled = true;
    }
    
    try {
        const details = await layChiTietCuaDon(currentOrderId);
        const allSelectedIds = selectedOrderItemIds.flatMap(compositeId => compositeId.split(','));
        
        const { isConfirmed: promptConf, reason } = await showPromptModal("Làm lại món", `Nhập lý do làm lại cho ${allSelectedIds.length} phần (VD: Khách làm đổ, món nguội...)`);
        if (!promptConf || !reason) {
            if (btn) { btn.innerHTML = btn.dataset.original || ''; btn.disabled = false; }
            return;
        }
        
        for (const id of allSelectedIds) {
            const item = details.find((d: any) => String(d.id) === id);
            if (!item) continue;
            
            await capNhatChiTietDonHang(id, { status: 'Cancelled', incidentNote: reason });
            await new Promise(r => setTimeout(r, 100));
            
            await taoChiTietDonHang({
                order_id: currentOrderId,
                menuItem_id: item.menuItem_id,
                quantity: item.quantity,
                priceAtOrder: 0,
                notes: `LÀM LẠI: ${reason}`,
                status: 'Pending',
                createdAt: new Date().toISOString()
            });
            await new Promise(r => setTimeout(r, 100));
        }
        selectedOrderItemIds = [];
        showSuccessToast('Đã gửi yêu cầu làm lại món xuống bếp!');
        kdsChannel.postMessage({
            type: 'FOODHUB_NEW_ORDER',
            message: 'Có món làm lại mới chuyển xuống bếp!'
        });
        loadTableDetails(selectedTableId!, document.getElementById('detail-table-title')!.innerText);
    } catch (e) {
        console.error(e);
    } finally {
        if (btn) {
            btn.innerHTML = btn.dataset.original || '';
            btn.disabled = false;
        }
    }
});

// INLINE FAST ACTIONS
(window as any).quickRushDish = (compositeId: string, dishName: string) => {
    const tableTitle = document.getElementById('detail-table-title')?.innerText || 'Bàn';
    kdsChannel.postMessage({
        type: 'RUSH_ORDER',
        tableId: selectedTableId,
        tableName: tableTitle,
        itemId: compositeId,
        dishName: dishName,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        message: `⚡ [${tableTitle}] Giục món gấp: ${dishName}!`
    });
    showSuccessToast(`⚡ Đã giục món "${dishName}" xuống bếp!`);
};

(window as any).quickServeDish = async (compositeId: string, dishName: string) => {
    const ids = compositeId.split(',');
    for (const id of ids) {
        await capNhatChiTietDonHang(id, { status: 'Served' });
    }
    showSuccessToast(`Đã bưng món "${dishName}" ra bàn!`);
    kdsChannel.postMessage({
        type: 'ITEM_SERVED',
        itemId: compositeId,
        itemName: dishName
    });
    updateReadyPickupBadge();
    const tableTitle = document.getElementById('detail-table-title')!.innerText;
    loadTableDetails(selectedTableId!, tableTitle);
};

(window as any).quickApproveDish = async (compositeId: string, dishName: string) => {
    const ids = compositeId.split(',');
    for (const id of ids) {
        await capNhatChiTietDonHang(id, { status: 'Pending' });
    }
    showSuccessToast(`Đã duyệt món "${dishName}" gửi xuống bếp!`);
    kdsChannel.postMessage({
        type: 'FOODHUB_NEW_ORDER',
        count: ids.length,
        orderId: currentOrderId,
        tableId: selectedTableId,
        message: `Đã duyệt món "${dishName}" chuyển xuống bếp!`
    });
    const tableTitle = document.getElementById('detail-table-title')?.innerText || 'Bàn';
    loadTableDetails(selectedTableId!, tableTitle);
};

// RUSH ORDER (GIỤC BẾP CẢ BÀN)
document.getElementById('btn-rush-order')?.addEventListener('click', async () => {
    if (!selectedTableId || !currentOrderId) {
        showWarningToast('Chưa chọn đơn hàng!');
        return;
    }
    const tableTitle = document.getElementById('detail-table-title')?.innerText || 'Bàn';
    const isConfirmed = await showConfirmModal("Giục bếp (Rush Order)", `Gửi cảnh báo GIỤC BẾP khẩn cấp cho ${tableTitle} xuống màn hình Bếp?`);
    if (!isConfirmed) return;

    kdsChannel.postMessage({
        type: 'RUSH_ORDER',
        tableId: selectedTableId,
        tableName: tableTitle,
        orderId: currentOrderId,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        message: `⚡ ${tableTitle} ĐANG GIỤC BẾP GẤP TOÀN BỘ MÓN!`
    });
    showSuccessToast(`⚡ Đã gửi cảnh báo giục bếp cho ${tableTitle}!`);
});

// HỦY MÓN
document.getElementById('btn-cancel-item')?.addEventListener('click', async () => {
    if (!currentOrderId) return;
    if (selectedOrderItemIds.length === 0) {
        showWarningToast('Vui lòng chọn ít nhất một món để hủy!');
        return;
    }
    const allSelectedIds = selectedOrderItemIds.flatMap(compositeId => compositeId.split(','));
    const { isConfirmed, reason } = await showPromptModal("Hủy món", `Nhập lý do hủy cho ${allSelectedIds.length} phần món đã chọn:`);
    if (!isConfirmed) return;

    for (const id of allSelectedIds) {
        await capNhatChiTietDonHang(id, { status: 'Cancelled', incidentNote: reason || 'Hủy bởi phục vụ' });
    }
    // Recalculate order total
    const details = await layChiTietCuaDon(currentOrderId);
    const activeDetails = details.filter((d: any) => (d.status || '').toLowerCase() !== 'cancelled');
    const newTotal = activeDetails.reduce((sum: number, it: any) => sum + ((Number(it.priceAtOrder !== undefined && it.priceAtOrder !== null ? it.priceAtOrder : it.price) || 0) * it.quantity), 0);
    await fetch(`${API_ORDERS_URL}/${currentOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: newTotal })
    });

    selectedOrderItemIds = [];
    showSuccessToast('Đã hủy các món đã chọn thành công!');
    kdsChannel.postMessage({
        type: 'FOODHUB_NEW_ORDER',
        message: 'Có món bị hủy trong đơn hàng!'
    });
    loadTableDetails(selectedTableId!, document.getElementById('detail-table-title')!.innerText);
});

// BỘ LỌC TRẠNG THÁI MÓN CHI TIẾT ĐƠN (VIEW 2)
const initDetailStatusFilter = () => {
    document.querySelectorAll('.btn-detail-status-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            document.querySelectorAll('.btn-detail-status-filter').forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white');
                b.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
            });
            target.classList.remove('bg-white', 'text-slate-600', 'border', 'border-slate-200');
            target.classList.add('bg-orange-500', 'text-white');
            currentDetailStatusFilter = target.getAttribute('data-status') || 'all';
            renderOrderDetails(cachedCurrentOrderDetails, cachedCurrentPax);
        });
    });
};

// MODAL ADD MENU & SEARCH STATE
let currentModalFilter = 'all';
let modalDraftCart: { item: any, quantity: number, variant?: string, note?: string }[] = [];
let currentWaiterMenuCategory = 'all';
let waiterMenuSearchKeyword = '';
let modalMenuSearchKeyword = '';

const normalizeVietnamese = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .trim();
};

const FOOD_SYNONYMS: Record<string, string[]> = {
    'bo': ['beef', 'steak', 'bit tet', 'bap bo', 'bo my', 'kobe'],
    'beef': ['bo', 'steak', 'bit tet'],
    'ga': ['chicken', 'canh ga', 'dui ga'],
    'chicken': ['ga'],
    'ca': ['fish', 'salmon', 'hoi', 'ngu'],
    'salmon': ['ca hoi', 'ca'],
    'heo': ['pork', 'lon', 'suon'],
    'pork': ['heo', 'lon', 'suon'],
    'mi': ['spaghetti', 'pasta', 'noodle', 'soi'],
    'spaghetti': ['mi y', 'mi'],
    'pasta': ['mi y', 'mi'],
    'sup': ['soup'],
    'soup': ['sup'],
    'kem': ['ice cream', 'dessert'],
    'tra': ['tea'],
    'ca phe': ['coffee', 'cafe'],
    'bia': ['beer'],
};

const matchMenuItem = (item: any, keyword: string): boolean => {
    if (!keyword) return true;
    const normKwd = normalizeVietnamese(keyword);
    if (!normKwd) return true;

    const normName = normalizeVietnamese(item.name || '');
    const normDesc = normalizeVietnamese(item.description || '');
    const normTags = (item.tags || []).map((t: string) => normalizeVietnamese(t)).join(' ');
    const normId = normalizeVietnamese(item.id || '');
    const combined = `${normName} ${normDesc} ${normTags} ${normId}`;

    if (combined.includes(normKwd)) return true;

    const tokens = normKwd.split(/\s+/).filter(Boolean);
    const matchesAllTokens = tokens.every(token => {
        if (combined.includes(token)) return true;
        const syns = FOOD_SYNONYMS[token];
        if (syns && syns.some(s => combined.includes(s))) return true;
        return false;
    });

    return matchesAllTokens;
};

(window as any).openAddMenuModal = async () => {
    document.getElementById('modal-add-menu')!.classList.remove('hidden');
    document.getElementById('modal-add-menu')!.classList.add('flex');
    if (allCategories.length === 0) allCategories = await layDanhSachDanhMuc();
    if (allMenuItems.length === 0) allMenuItems = await layDanhSachMonAn();
    
    currentModalFilter = 'all';
    modalMenuSearchKeyword = '';
    const modalSearchInput = document.getElementById('modal-menu-search') as HTMLInputElement;
    if (modalSearchInput) modalSearchInput.value = '';
    const modalClearBtn = document.getElementById('btn-clear-modal-search');
    if (modalClearBtn) modalClearBtn.classList.add('hidden');

    modalDraftCart = [];
    
    (window as any).renderModalCategories();
    (window as any).renderModalMenuItems();
    (window as any).renderModalDraftCart();
};

const getWaiterCategoryIcon = (name: string, icon?: string): string => {
    if (icon && icon.startsWith('fa-')) return icon;
    const n = name.toLowerCase();
    if (n.includes('khai vị')) return 'fa-bowl-food';
    if (n.includes('chính') || n.includes('bít tết') || n.includes('bò')) return 'fa-drumstick-bite';
    if (n.includes('mì ý') || n.includes('pasta') || n.includes('pizza')) return 'fa-pizza-slice';
    if (n.includes('hải sản') || n.includes('cá') || n.includes('tôm')) return 'fa-shrimp';
    if (n.includes('tráng miệng') || n.includes('bánh') || n.includes('kem')) return 'fa-ice-cream';
    if (n.includes('uống') || n.includes('rượu') || n.includes('nước') || n.includes('trà')) return 'fa-wine-glass';
    if (n.includes('combo')) return 'fa-layer-group';
    return icon || 'fa-utensils';
};

(window as any).renderModalCategories = () => {
    const catList = document.getElementById('modal-category-list')!;
    catList.innerHTML = '';
    
    const renderBtn = (id: string, name: string, iconClass: string) => {
        const isActive = currentModalFilter === id;
        const bgClass = isActive 
            ? 'bg-orange-500 text-white shadow-md border-orange-400 font-black' 
            : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200 font-bold';
        const iconBg = isActive
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-orange-500 border border-slate-200';

        return `
            <button onclick="filterModalMenu('${id}')" title="${name}" 
                class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all border ${bgClass} cursor-pointer text-left active:scale-[0.98]">
                <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
                    <i class="fa-solid ${iconClass} text-[11px]"></i>
                </div>
                <span class="truncate leading-tight">${name}</span>
            </button>
        `;
    };
    
    catList.innerHTML += renderBtn('all', 'Tất cả', 'fa-border-all');
    allCategories.forEach(c => {
        const icon = getWaiterCategoryIcon(c.name, c.icon);
        catList.innerHTML += renderBtn(c.id, c.name, icon);
    });
};

(window as any).filterModalMenu = (categoryId: string) => {
    currentModalFilter = categoryId;
    (window as any).renderModalCategories();
    (window as any).renderModalMenuItems();
};

(window as any).renderModalMenuItems = () => {
    const menuGrid = document.getElementById('modal-menu-grid')!;
    menuGrid.innerHTML = '';
    
    const filtered = allMenuItems.filter(item => {
        if (item.status === 'Out_of_stock' || item.status === 'Out of Stock' || item.inStock === false) return false;
        if (currentModalFilter !== 'all') {
            const catId = (typeof item.category_id === 'object' && item.category_id !== null)
                ? (item.category_id._id || item.category_id.id || '')
                : item.category_id;
            if (String(catId) !== String(currentModalFilter)) return false;
        }
        return matchMenuItem(item, modalMenuSearchKeyword);
    });

    if (filtered.length === 0) {
        menuGrid.innerHTML = `
            <div class="col-span-full py-12 flex flex-col items-center justify-center text-center text-slate-500 font-bold">
                <i class="fa-solid fa-magnifying-glass text-2xl mb-2 text-slate-600"></i>
                <p>Không tìm thấy món ăn nào phù hợp.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        menuGrid.innerHTML += `
            <div class="bg-white rounded-xl border border-slate-200 p-3 hover:border-orange-500 transition-colors group flex flex-col shadow-2xs hover:shadow-md relative">
                <div class="h-28 overflow-hidden rounded-lg mb-3 bg-slate-100 cursor-pointer" onclick="addMenuItemToOrder('${item.id}')">
                    <img src="${item.image}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                </div>
                <h4 class="text-slate-900 font-bold text-sm mb-1 line-clamp-2 cursor-pointer" onclick="addMenuItemToOrder('${item.id}')">${item.name}</h4>
                <div class="text-xs text-emerald-600 font-bold mb-2">Còn ${calculateWaiterPortions(item)} phần</div>
                <div class="flex justify-between items-center mt-auto">
                    <p class="text-orange-600 font-black text-sm font-mono">${formatMoney(item.base_price)}</p>
                    <button onclick="addMenuItemToOrder('${item.id}')" class="w-8 h-8 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-black flex items-center justify-center transition-colors shadow-xs active:scale-95 cursor-pointer">+</button>
                </div>
            </div>
        `;
    });
};

let currentAddingMenuId: string | null = null;
let currentItemVariants: any[] = [];

(window as any).addMenuItemToOrder = async (menuId: string) => {
    const mon = allMenuItems.find(m => m.id === menuId);
    if (!mon) return;

    if (mon.status === 'Out_of_stock' || mon.status === 'Out of Stock' || mon.inStock === false) {
        showWarningToast(`Món "${mon.name}" đã hết hàng do thiếu nguyên liệu!`);
        return;
    }
    
    currentAddingMenuId = menuId;
    currentItemVariants = await layDanhSachVariants(menuId);
    
    if (currentItemVariants.length === 0) {
        // Luôn mở modal ghi chú để nhân viên có thể thêm yêu cầu đặc biệt (kể cả khi không có biến thể)
        const wrapper = document.getElementById('variant-container-wrapper')!;
        const container = document.getElementById('variant-options-container')!;
        wrapper.classList.add('hidden');
        container.innerHTML = '';
        (document.getElementById('input-item-note') as HTMLInputElement).value = '';
        const titleEl = document.getElementById('variant-modal-title')!;
        if (titleEl) titleEl.textContent = mon.name + ' — Ghi chú đặc biệt';
        document.getElementById('modal-item-variant')!.classList.remove('hidden');
        document.getElementById('modal-item-variant')!.classList.add('flex');
        return;
    }
    
    const wrapper = document.getElementById('variant-container-wrapper')!;
    const container = document.getElementById('variant-options-container')!;
    
    if (currentItemVariants.length > 0) {
        wrapper.classList.remove('hidden');
        
        // Group by group_name
        const groups: Record<string, any[]> = {};
        currentItemVariants.forEach(v => {
            if (v.status !== 'Available') return;
            if (!groups[v.group_name]) groups[v.group_name] = [];
            groups[v.group_name].push(v);
        });
        
        let html = '';
        for (const [gName, opts] of Object.entries(groups)) {
            const allowMultiple = opts[0].allowMultiple;
            html += `<div class="mb-4">
                <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-layer-group text-orange-600 text-[11px]"></i>
                        ${gName}
                        <span class="text-slate-600 font-semibold lowercase text-[11px]">(${allowMultiple ? 'chọn nhiều' : 'bắt buộc chọn 1'})</span>
                    </p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            `;
            opts.forEach((opt, idx) => {
                const inputType = allowMultiple ? 'checkbox' : 'radio';
                const inputName = `variant_group_${gName}`;
                // BẮT BUỘC có mặc định ban đầu cho biến thể radio (nhất là Size) không được để trống
                const isChecked = !allowMultiple && idx === 0;
                const priceBadge = opt.extra_price > 0 
                    ? `<span class="text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200 shrink-0">+${formatMoney(opt.extra_price)}</span>` 
                    : '';
                
                html += `
                    <label class="group relative flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all duration-200 active:scale-[0.98] select-none shadow-xs has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/50 has-[:checked]:ring-1 has-[:checked]:ring-orange-500/50">
                        <input type="${inputType}" name="${inputName}" value="${opt.name}" ${isChecked ? 'checked' : ''} class="sr-only" data-price="${opt.extra_price}">
                        <div class="flex items-center gap-2.5 min-w-0">
                            ${allowMultiple ? `
                                <div class="w-5 h-5 rounded-lg border-2 border-slate-300 bg-slate-100 flex items-center justify-center shrink-0 transition-all duration-200 group-hover:border-slate-400 group-has-[:checked]:border-orange-500 group-has-[:checked]:bg-orange-500">
                                    <i class="fa-solid fa-check text-white text-[10px] scale-0 group-has-[:checked]:scale-100 transition-transform duration-200"></i>
                                </div>
                            ` : `
                                <div class="w-5 h-5 rounded-full border-2 border-slate-300 bg-slate-100 flex items-center justify-center shrink-0 transition-all duration-200 group-hover:border-slate-400 group-has-[:checked]:border-orange-500 group-has-[:checked]:bg-orange-500">
                                    <div class="w-2 h-2 rounded-full bg-white scale-0 group-has-[:checked]:scale-100 transition-transform duration-200"></div>
                                </div>
                            `}
                            <span class="text-slate-800 text-xs font-bold tracking-wide group-hover:text-slate-900 group-has-[:checked]:text-orange-950 transition-colors truncate">${opt.name}</span>
                        </div>
                        ${priceBadge}
                    </label>
                `;
            });
            html += `</div></div>`;
        }
        
        container.innerHTML = html;
    } else {
        wrapper.classList.add('hidden');
        container.innerHTML = '';
    }
    
    (document.getElementById('input-item-note') as HTMLInputElement).value = '';
    
    document.getElementById('modal-item-variant')!.classList.remove('hidden');
    document.getElementById('modal-item-variant')!.classList.add('flex');
};

document.getElementById('btn-cancel-variant')?.addEventListener('click', () => {
    document.getElementById('modal-item-variant')!.classList.add('hidden');
    document.getElementById('modal-item-variant')!.classList.remove('flex');
});

document.getElementById('btn-confirm-variant')?.addEventListener('click', () => {
    if (!currentAddingMenuId) return;
    const mon = allMenuItems.find(m => m.id === currentAddingMenuId);
    if (!mon) return;

    let variantTexts: string[] = [];
    let extraPrice = 0;
    
    const container = document.getElementById('variant-options-container')!;
    const inputs = container.querySelectorAll('input:checked') as NodeListOf<HTMLInputElement>;
    
    // Đảm bảo không bị trống biến thể bắt buộc
    if (currentItemVariants.length > 0 && inputs.length === 0) {
        showWarningToast("Vui lòng chọn biến thể cho món ăn!");
        return;
    }

    inputs.forEach(input => {
        variantTexts.push(input.value);
        extraPrice += parseInt(input.getAttribute('data-price') || '0', 10);
    });

    const variantStr = variantTexts.join(', ');
    const noteStr = (document.getElementById('input-item-note') as HTMLInputElement).value.trim();
    
    const cartItemData = { ...mon, base_price: mon.base_price + extraPrice };
    
    const existing = modalDraftCart.find((c: any) => c.item.id === currentAddingMenuId && c.variant === variantStr && c.note === noteStr && c.item.base_price === cartItemData.base_price);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        modalDraftCart.push({ item: cartItemData, quantity: 1, variant: variantStr, note: noteStr });
    }
    
    document.getElementById('modal-item-variant')!.classList.add('hidden');
    document.getElementById('modal-item-variant')!.classList.remove('flex');
    (window as any).renderModalDraftCart();
});

(window as any).changeDraftQuantity = (index: number, delta: number) => {
    const existing = modalDraftCart[index];
    if (existing) {
        existing.quantity += delta;
        if (existing.quantity <= 0) {
            modalDraftCart.splice(index, 1);
        }
        (window as any).renderModalDraftCart();
    }
};

(window as any).renderModalDraftCart = () => {
    const container = document.getElementById('modal-draft-cart')!;
    const totalEl = document.getElementById('modal-draft-total')!;
    const btnConfirm = document.getElementById('btn-confirm-draft') as HTMLButtonElement;
    
    if (modalDraftCart.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-500 font-semibold text-sm">Chưa có món nào</div>';
        totalEl.innerText = '0 đ';
        btnConfirm.disabled = true;
        return;
    }
    
    btnConfirm.disabled = false;
    let html = '';
    let total = 0;
    
    modalDraftCart.forEach((cartItem: any, index: number) => {
        const lineTotal = cartItem.item.base_price * cartItem.quantity;
        total += lineTotal;
        
        const variantHtml = cartItem.variant ? `<span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded ml-1 font-semibold">${cartItem.variant}</span>` : '';
        const noteHtml = cartItem.note ? `<div class="text-[10px] text-amber-700 mt-0.5 italic">Ghi chú: ${cartItem.note}</div>` : '';
        
        html += `
            <div class="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                <div class="flex-1">
                    <h5 class="text-slate-900 font-bold text-sm mb-1">${cartItem.item.name} ${variantHtml}</h5>
                    <p class="text-orange-600 font-bold text-xs font-mono">${formatMoney(lineTotal)}</p>
                    ${noteHtml}
                </div>
                <div class="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 ml-2 shadow-2xs">
                    <button onclick="changeDraftQuantity(${index}, -1)" class="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition cursor-pointer font-bold">-</button>
                    <span class="text-slate-900 font-black text-sm w-4 text-center font-mono">${cartItem.quantity}</span>
                    <button onclick="changeDraftQuantity(${index}, 1)" class="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition cursor-pointer font-bold">+</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    totalEl.innerText = formatMoney(total);
};

document.getElementById('btn-confirm-draft')?.addEventListener('click', async () => {
    if (!currentOrderId || modalDraftCart.length === 0) return;
    
    const isConfirmed = await showConfirmModal("Xác nhận thêm món", `Thêm ${modalDraftCart.reduce((acc, c: any) => acc + c.quantity, 0)} phần món mới vào bàn này?`);
    if (!isConfirmed) return;
    
    const btn = document.getElementById('btn-confirm-draft') as HTMLButtonElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Đang xử lý...';
    btn.disabled = true;
    
    try {
        for (const cartItem of modalDraftCart as any[]) {
            const finalNotes = cartItem.variant ? `[${cartItem.variant}] ${cartItem.note}` : cartItem.note;
            await taoChiTietDonHang({
                order_id: currentOrderId,
                menuItem_id: cartItem.item.id,
                quantity: cartItem.quantity,
                priceAtOrder: cartItem.item.base_price,
                notes: finalNotes.trim(),
                variantNote: finalNotes.trim(),
                status: "Unconfirmed",
                incidentNote: "",
                createdAt: new Date().toISOString()
            });
            await new Promise(r => setTimeout(r, 300));
        }
        
        showSuccessToast('Đã thêm các món thành công!');
        modalDraftCart = [];
        (window as any).renderModalDraftCart();
        document.getElementById('btn-close-modal')!.click();
        
        const tableNumber = document.getElementById('detail-table-title')!.innerText;
        loadTableDetails(selectedTableId!, tableNumber);
    } catch (e) {
        console.error(e);
        showConfirmModal("Lỗi", "Không thể thêm món do lỗi kết nối. Hãy thử lại!");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    document.getElementById('modal-add-menu')!.classList.add('hidden');
    document.getElementById('modal-add-menu')!.classList.remove('flex');
});

// ==========================================
// TAB 3: THỰC ĐƠN
// ==========================================
const loadMenu = async () => {
    try {
        await ensureWaiterIngredientsAndRecipes();
        allMenuItems = await layDanhSachMonAn();
        allCategories = await layDanhSachDanhMuc();
        renderMenuTab();
    } catch (e) {
        console.error(e);
    }
};

const renderMenuTab = () => {
    // 1. Sidebar Danh mục
    const catList = document.getElementById('menu-categories-list');
    if (catList) {
        catList.innerHTML = '';
        const isAllActive = currentWaiterMenuCategory === 'all';
        const allBtn = document.createElement('button');
        allBtn.className = `w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs transition-all border ${
            isAllActive 
                ? 'bg-orange-500 text-white border-orange-400 shadow-md font-black' 
                : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200 font-bold'
        } cursor-pointer active:scale-[0.98] text-left`;
        allBtn.innerHTML = `
            <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isAllActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-orange-600 border border-slate-200'}">
                <i class="fa-solid fa-border-all text-[11px]"></i>
            </div>
            <span class="truncate leading-tight">Tất cả</span>
        `;
        allBtn.onclick = () => {
            currentWaiterMenuCategory = 'all';
            renderMenuTab();
        };
        catList.appendChild(allBtn);

        const visibleCategories = allCategories.filter(c => c.status !== 'Inactive' && c.status !== 'Archived' && c.status !== 'Hidden');
        visibleCategories.forEach(c => {
            const isActive = currentWaiterMenuCategory === c.id;
            const btn = document.createElement('button');
            btn.className = `w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs transition-all border ${
                isActive 
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md font-black' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200 font-bold'
            } cursor-pointer active:scale-[0.98] text-left`;
            btn.title = c.name;
            const icon = getWaiterCategoryIcon(c.name, c.icon);
            btn.innerHTML = `
                <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-orange-600 border border-slate-200'}">
                    <i class="fa-solid ${icon} text-[11px]"></i>
                </div>
                <span class="truncate leading-tight">${c.name}</span>
            `;
            btn.onclick = () => {
                currentWaiterMenuCategory = c.id;
                renderMenuTab();
            };
            catList.appendChild(btn);
        });
    }

    // 2. Filter món theo Category & Keyword
    const grid = document.getElementById('menu-items-grid')!;
    grid.innerHTML = '';

    const filtered = allMenuItems.filter(item => {
        if (item.status === 'Archived' || item.status === 'Inactive' || item.status === 'Hidden') return false;
        const parentCat = allCategories.find(c => String(c.id || (c as any)._id) === String(typeof item.category_id === 'object' && item.category_id !== null ? (item.category_id._id || item.category_id.id) : item.category_id));
        if (parentCat && (parentCat.status === 'Inactive' || parentCat.status === 'Archived' || parentCat.status === 'Hidden')) return false;

        if (currentWaiterMenuCategory !== 'all') {
            const catId2 = (typeof item.category_id === 'object' && item.category_id !== null)
                ? (item.category_id._id || item.category_id.id || '')
                : item.category_id;
            if (String(catId2) !== String(currentWaiterMenuCategory)) return false;
        }
        return matchMenuItem(item, waiterMenuSearchKeyword);
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 border border-slate-200">
                    <i class="fa-solid fa-magnifying-glass text-2xl"></i>
                </div>
                <h4 class="text-slate-900 font-bold text-lg mb-1">Không tìm thấy món ăn nào</h4>
                <p class="text-slate-500 text-sm max-w-sm mb-4">
                    ${waiterMenuSearchKeyword ? `Không có kết quả nào phù hợp với từ khóa "${waiterMenuSearchKeyword}".` : 'Danh mục này hiện chưa có món ăn.'} Vui lòng thử tìm từ khóa khác.
                </p>
                <button id="btn-reset-menu-filter" class="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-orange-500/20 flex items-center gap-2">
                    <i class="fa-solid fa-rotate-left"></i> Xóa bộ lọc
                </button>
            </div>
        `;
        document.getElementById('btn-reset-menu-filter')?.addEventListener('click', () => {
            waiterMenuSearchKeyword = '';
            currentWaiterMenuCategory = 'all';
            const searchInput = document.getElementById('waiter-menu-search') as HTMLInputElement;
            if (searchInput) searchInput.value = '';
            const clearBtn = document.getElementById('btn-clear-waiter-search');
            if (clearBtn) clearBtn.classList.add('hidden');
            renderMenuTab();
        });
        return;
    }

    filtered.forEach(item => {
        const isAvailable = item.status !== 'Out_of_stock' && item.status !== 'Out of Stock' && item.inStock !== false;
        
        let tagsHtml = '';
        if (item.tags && Array.isArray(item.tags)) {
            tagsHtml = `<div class="flex flex-wrap gap-1 absolute top-2 left-2 z-10 pointer-events-none">` + 
                item.tags.map((t: string) => {
                    let bg = 'bg-white/90 text-slate-700 border-white/50';
                    const tagUpper = t.toUpperCase();
                    if (tagUpper.includes('BESTSELLER') || tagUpper.includes('BEST SELLER')) {
                        bg = 'bg-amber-400 text-amber-950 border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
                    } else if (tagUpper.includes('MUST TRY')) {
                        bg = 'bg-rose-500 text-white border-rose-600 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
                    } else if (tagUpper.includes('CAY') || tagUpper.includes('SPICY')) {
                        bg = 'bg-red-600 text-white border-red-700 shadow-[0_0_10px_rgba(220,38,38,0.5)]';
                        t = '<i class="fa-solid fa-pepper-hot mr-1"></i>' + t;
                    } else if (tagUpper.includes('CHAY') || tagUpper.includes('VEGAN')) {
                        bg = 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
                        t = '<i class="fa-solid fa-leaf mr-1"></i>' + t;
                    }
                    return `<span class="${bg} backdrop-blur-sm text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border">${t}</span>`;
                }).join('') + 
                `</div>`;
        }
        
        grid.innerHTML += `
            <div class="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden group relative shadow-2xs hover:shadow-md">
                ${tagsHtml}
                <div class="h-32 overflow-hidden bg-slate-100">
                    <img src="${item.image}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition duration-500 ${!isAvailable ? 'opacity-40 grayscale' : ''}">
                </div>
                <div class="p-4 flex flex-col flex-1">
                    <h3 class="text-slate-900 font-bold text-sm leading-tight mb-1">${item.name}</h3>
                    <p class="text-orange-600 font-black text-sm font-mono mb-4">${formatMoney(item.base_price)}</p>
                    
                    <div class="mt-auto flex justify-between items-center">
                        <span class="text-xs font-bold ${isAvailable ? 'text-emerald-600' : 'text-slate-400'}">${isAvailable ? 'Còn ' + calculateWaiterPortions(item) + ' phần' : 'Hết hàng'}</span>
                    </div>
                </div>
            </div>
        `;
    });
};

(window as any).toggleMenuStatus = async (id: string, isChecked: boolean) => {
    try {
        const status = isChecked ? 'Available' : 'Out_of_stock';
        await capNhatTrangThaiMenu(id, status);
        loadMenu();
    } catch (e) {
        console.error(e);
    }
};

// ==========================================
// TAB 4: ĐƠN HÀNG
// ==========================================
let currentOrderFilter = 'all';

// Helper lấy tableId từ đơn hàng dù là string hay populated object
const getTableIdFromOrder = (o: any): string => {
    if (!o) return '';
    if (o.table_id && typeof o.table_id === 'object') {
        return String(o.table_id.id || o.table_id._id || '');
    }
    return String(o.table_id || '');
};

const loadOrders = async () => {
    try {
        if (allTables.length === 0) {
            allTables = await layDanhSachBan();
        }
        
        const orders = await layTatCaDonHang();
        let activeOrders = orders.filter((o: any) => {
            const isPendingPayment = o.status === 'In_Progress' || o.paymentStatus === 'Unpaid';
            const tid = getTableIdFromOrder(o);
            return isPendingPayment && allTables.some(t => String(t.id || t._id) === tid);
        });
        
        if (currentOrderFilter === 'single') {
            activeOrders = activeOrders.filter((o: any) => {
                const tid = getTableIdFromOrder(o);
                const t = allTables.find(t => String(t.id || t._id) === tid);
                return t && !t.tableNumber.includes('&');
            });
        } else if (currentOrderFilter === 'merged') {
            activeOrders = activeOrders.filter((o: any) => {
                const tid = getTableIdFromOrder(o);
                const t = allTables.find(t => String(t.id || t._id) === tid);
                return t && t.tableNumber.includes('&');
            });
        }

        const list = document.getElementById('orders-table-list')!;
        list.innerHTML = '';
        
        let totalReadyCount = 0;
        
        if(activeOrders.length === 0) {
            list.innerHTML = `<div class="text-slate-500 text-center py-4">Không có bàn nào</div>`;
        } else {
            for (const order of activeOrders) {
                const tid = getTableIdFromOrder(order);
                const table = allTables.find(t => String(t.id || t._id) === tid);
                const tName = table ? table.tableNumber : 'Unknown';
                const tId = table ? (table.id || table._id) : tid;
                
                // Fetch details to calculate ready items count
                const details = await layChiTietCuaDon(order.id);
                const readyItems = details.filter((d: any) => (d.status || '').toLowerCase() === 'ready').length;
                totalReadyCount += readyItems;
                const readyBadgeHtml = readyItems > 0 ? `<span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-black animate-pulse shadow-lg ml-2 border border-red-400/50">${readyItems} món xong!</span>` : '';

                list.innerHTML += `
                    <button onclick="viewOrderBill('${order.id}', '${tId}')" class="w-full bg-white border border-slate-200 hover:border-orange-500 p-4 rounded-2xl flex justify-between items-center transition text-left mb-3 shadow-xs hover:shadow-sm">
                        <div>
                            <h4 class="text-slate-900 font-bold flex items-center">${tName} ${readyBadgeHtml}</h4>
                            <span class="text-xs text-slate-500 font-medium">${table?.current_pax || 0} khách</span>
                        </div>
                        <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1 rounded-full font-bold">Đang phục vụ</span>
                    </button>
                `;
            }
        }
        
        // Update Bottom Nav Badge
        const badgeReady = document.getElementById('badge-ready-count');
        if (badgeReady) {
            if (totalReadyCount > 0) {
                badgeReady.innerText = totalReadyCount.toString();
                badgeReady.classList.remove('hidden');
            } else {
                badgeReady.classList.add('hidden');
            }
        }
        
        // Auto select first
        if (activeOrders.length > 0 && !currentOrderId) {
            const firstTid = getTableIdFromOrder(activeOrders[0]);
            const firstTable = allTables.find(t => String(t.id || t._id) === firstTid);
            (window as any).viewOrderBill(activeOrders[0].id, firstTable ? (firstTable.id || firstTable._id) : firstTid);
        } else if (currentOrderId) {
            // Re-select currently selected order to refresh view if needed
            const currentlyActive = activeOrders.find((o: any) => String(o.id || o._id) === String(currentOrderId));
            if (currentlyActive) {
                const curTid = getTableIdFromOrder(currentlyActive);
                const t = allTables.find(t => String(t.id || t._id) === curTid);
                (window as any).viewOrderBill(currentlyActive.id || currentlyActive._id, t ? (t.id || t._id) : curTid);
            }
        }
    } catch (e) {
        console.error(e);
    }
};

(window as any).viewOrderBill = async (orderId: string, tableId: string) => {
    currentOrderId = orderId;
    selectedTableId = tableId;
    
    if(allTables.length === 0) allTables = await layDanhSachBan();
    const table = allTables.find(t => t.id === tableId);
    const tableNumber = table ? table.tableNumber : 'Unknown';
    
    document.getElementById('bill-table-title')!.innerHTML = `${tableNumber} <span class="text-lg font-bold text-slate-500 ml-2" id="bill-guest-count">${table?.current_pax || 0} khách</span>`;
    
    try {
        if(allMenuItems.length === 0) allMenuItems = await layDanhSachMonAn();
        const details = await layChiTietCuaDon(orderId);
        
        const tbody = document.getElementById('bill-items-list')!;
        tbody.innerHTML = '';
        let total = 0;
        
        // Fill bill panel (giao diện màn hình)
        details.forEach((item: any) => {
            const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
            const mon = allMenuItems.find(m => String(m.id || m._id) === mId);
            const monName = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.name) ? item.menuItem_id.name : (mon ? mon.name : (item.name || 'Món ăn'));
            const basePrice = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.base_price !== undefined) ? item.menuItem_id.base_price : (mon ? mon.base_price : 0);
            const lineTotal = item.priceAtOrder ? item.priceAtOrder * item.quantity : basePrice * item.quantity;
            total += lineTotal;
            const rawNote = (item.notes || item.variantNote || '').trim();
            let displayNote = rawNote;
            if (rawNote.includes(' | ')) {
                const parts = rawNote.split(' | ').map((s: string) => s.trim()).filter(Boolean);
                const vText = parts[0];
                const normV = vText.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
                const noteParts = parts.slice(1).filter((p: string) => {
                    const normP = p.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
                    return normP !== normV && !normV.includes(normP);
                });
                displayNote = [vText, ...noteParts].filter(Boolean).join(' | ');
            }
            const notesHtml = displayNote ? `<div class="text-xs text-amber-700 mt-0.5">${displayNote}</div>` : '';
            // Badge trạng thái
            const s = (item.status || '').toLowerCase();
            let badge = '';
            if (s === 'unconfirmed') badge = `<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>Chờ duyệt</span>`;
            else if (s === 'pending') badge = `<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span>Chờ bếp</span>`;
            else if (s === 'cooking') badge = `<span class="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full border border-orange-200"><span class="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block animate-pulse"></span>Đang nấu</span>`;
            else if (s === 'ready') badge = `<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>Sẵn sàng!</span>`;
            else if (s === 'served') badge = `<span class="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>Đã phục vụ</span>`;
            // Nút mang ra chỉ khi Ready
            const serveBtn = s === 'ready'
                ? `<button onclick="markServed('${item.id}', '${orderId}', '${tableNumber}')" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-full transition-colors shadow-sm">✓ Mang ra</button>`
                : '';
            tbody.innerHTML += `
                <tr class="border-b border-slate-200/80 last:border-0">
                    <td class="py-3">
                        <div class="flex items-center gap-3">
                            <img src="${(mon && mon.image) ? mon.image : ((item.menuItem_id && item.menuItem_id.image) ? item.menuItem_id.image : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80')}" loading="lazy" decoding="async" class="w-10 h-10 rounded-md object-cover bg-slate-100 border border-slate-200 shrink-0">
                            <div>
                                <span class="text-slate-900 font-bold text-sm">${monName}</span>
                                ${notesHtml}
                                <div class="mt-1.5 flex items-center flex-wrap gap-1">${badge}${serveBtn}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 text-slate-600 font-bold text-center w-10">x${item.quantity}</td>
                    <td class="py-3 text-slate-900 font-bold text-right whitespace-nowrap">${formatMoney(lineTotal)}</td>
                </tr>
            `;
        });
        
        document.getElementById('bill-total')!.innerText = formatMoney(total);

        // Hiện/ẩn nút Phục vụ bếp
        const hasPending = details.some((d: any) => (d.status || '').toLowerCase() === 'pending');
        


        // ===== Fill RECEIPT (phiếu in tạm) =====
        const now = new Date();
        const dateStr = now.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
        const timeStr = now.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
        
        const receiptDate = document.getElementById('receipt-date');
        const receiptTable = document.getElementById('receipt-table');
        const receiptTime = document.getElementById('receipt-time');
        const receiptItems = document.getElementById('receipt-items');
        const receiptTotal = document.getElementById('receipt-total');

        if (receiptDate) receiptDate.innerText = `Ngày: ${dateStr}`;
        
        const mergedTablesStr = allTables.filter((t: any) => t.merged_with === tableId).map(t => t.tableNumber).join(', ');
        const finalTableText = mergedTablesStr ? `${tableNumber} (Đã gộp ${mergedTablesStr})` : tableNumber;
        if (receiptTable) receiptTable.innerText = finalTableText;
        
        if (receiptTime) receiptTime.innerText = timeStr;
        if (receiptTotal) receiptTotal.innerText = formatMoney(total);

        if (receiptItems) {
            receiptItems.innerHTML = '';
            let rowNum = 1;
            details.forEach((item: any) => {
                const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
                const mon = allMenuItems.find(m => String(m.id || m._id) === mId);
                const monName = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.name) ? item.menuItem_id.name : (mon ? mon.name : (item.name || 'Món ăn'));
                const basePrice = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.base_price !== undefined) ? item.menuItem_id.base_price : (mon ? mon.base_price : 0);
                const lineTotal = item.priceAtOrder ? item.priceAtOrder * item.quantity : basePrice * item.quantity;
                const rawNote = (item.notes || item.variantNote || '').trim();
                let displayNote = rawNote;
                if (rawNote.includes(' | ')) {
                    const parts = rawNote.split(' | ').map((s: string) => s.trim()).filter(Boolean);
                    const vText = parts[0];
                    const normV = vText.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
                    const noteParts = parts.slice(1).filter((p: string) => {
                        const normP = p.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
                        return normP !== normV && !normV.includes(normP);
                    });
                    displayNote = [vText, ...noteParts].filter(Boolean).join(' | ');
                }
                const noteName = displayNote ? ` (${displayNote})` : '';
                receiptItems.innerHTML += `
                    <tr>
                        <td style="padding:3px 0; text-align:left;">${rowNum++}. ${monName}${noteName}</td>
                        <td style="padding:3px 4px; text-align:center;">${item.quantity}</td>
                        <td style="padding:3px 0; text-align:right; white-space:nowrap;">${formatMoney(lineTotal)}</td>
                    </tr>
                `;
            });
        }
        
        const btnServeKitchenEl = document.getElementById('btn-serve-kitchen') as HTMLButtonElement;
        if (btnServeKitchenEl) {
            btnServeKitchenEl.onclick = async () => {
                const isConfirmed = await showConfirmModal("Xác nhận", "Gửi toàn bộ món đang chờ của đơn này xuống bếp?");
                if (!isConfirmed) return;
                for (const item of details) {
                    if ((item.status || '').toLowerCase() === 'pending') {
                        await capNhatChiTietDonHang(item.id, { status: 'Cooking' });
                        await new Promise(r => setTimeout(r, 400));
                    }
                }
                showSuccessToast('Đã gửi xuống bếp!');
                (window as any).viewOrderBill(orderId, tableId);
                loadOrders(); // Refresh left list badges
            };
        }
        
        // Checkout btn
        const btnTab4Checkout = document.getElementById('btn-tab4-request-checkout') as HTMLButtonElement;
        if (btnTab4Checkout) {
            btnTab4Checkout.onclick = async () => {
                const isConfirmed = await showConfirmModal("Yêu cầu Thanh toán", "Bạn muốn báo cho Thu ngân thanh toán bàn này?");
                if (!isConfirmed) return;
                try {
                    await capNhatTrangThaiBan(tableId, "Waiting_Payment");
                    showSuccessToast('Đã gửi yêu cầu thanh toán!');
                    
                    const table = allTables.find(t => t.id === tableId);
                    if (table) table.status = "Waiting_Payment";
                    renderTables();
                } catch(e) {
                    console.error(e);
                    showConfirmModal("Lỗi", "Không thể gửi yêu cầu.");
                }
            };
        }
        
    } catch (e) {
        console.error(e);
    }
};

// Đánh dấu đã mang món ra bàn (Served)
(window as any).markServed = async (detailId: string, orderId: string, tableId: string) => {
    try {
        await capNhatChiTietDonHang(detailId, { status: 'Served' });
        showSuccessToast('Đã mang món ra bàn!');
        (window as any).viewOrderBill(orderId, tableId);
        loadOrders(); // Refresh left list badges
    } catch(e) {
        console.error(e);
    }
};

// ==========================================
// ADD-ON TAB ĐƠN HÀNG FEATURES
// ==========================================

// Nút Thêm món vào đơn đang có (Ở tab Đơn hàng)
document.getElementById('btn-add-item')?.addEventListener('click', () => {
    if (!currentOrderId || !selectedTableId) return;
    const table = allTables.find(t => t.id === selectedTableId);
    if (!table) return;
    
    // Gọi modal thêm món lên ngay lập tức, vì biến selectedTableId và currentOrderId đã được lưu lúc chọn đơn
    (window as any).openAddMenuModal();
});

// Nút Gọi thêm khách (Cập nhật current_pax)
let tempPax = 1;
document.getElementById('btn-add-guest')?.addEventListener('click', () => {
    if (!selectedTableId) return;
    const table = allTables.find(t => t.id === selectedTableId);
    tempPax = table?.current_pax || 1;
    if (tempPax < 1) tempPax = 1;
    document.getElementById('guest-count-display')!.innerText = tempPax.toString();
    document.getElementById('modal-add-guest')!.classList.remove('hidden');
    document.getElementById('modal-add-guest')!.classList.add('flex');
});

document.getElementById('btn-guest-minus')?.addEventListener('click', () => {
    if (tempPax > 1) {
        tempPax--;
        document.getElementById('guest-count-display')!.innerText = tempPax.toString();
    }
});
document.getElementById('btn-guest-plus')?.addEventListener('click', () => {
    tempPax++;
    document.getElementById('guest-count-display')!.innerText = tempPax.toString();
});
document.getElementById('btn-guest-cancel')?.addEventListener('click', () => {
    document.getElementById('modal-add-guest')!.classList.add('hidden');
    document.getElementById('modal-add-guest')!.classList.remove('flex');
});
document.getElementById('btn-guest-confirm')?.addEventListener('click', async () => {
    if (!selectedTableId) return;
    try {
        await capNhatTrangThaiBan(selectedTableId, 'Occupied', tempPax);
        showSuccessToast('Đã cập nhật số khách!');
        document.getElementById('modal-add-guest')!.classList.add('hidden');
        document.getElementById('modal-add-guest')!.classList.remove('flex');
        
        allTables = await layDanhSachBan();
        loadOrders();
    } catch(e) {
        console.error(e);
    }
});

// Nút Chuyển bàn
let tableToTransfer: string | null = null;
document.getElementById('btn-transfer-table')?.addEventListener('click', () => {
    if (!currentOrderId || !selectedTableId) return;
    
    const availableTables = allTables.filter(t => t.status === 'Available');
    const grid = document.getElementById('transfer-table-grid')!;
    grid.innerHTML = '';
    
    if (availableTables.length === 0) {
        grid.innerHTML = `<div class="col-span-4 text-center text-slate-500 py-4">Không có bàn trống</div>`;
    } else {
        availableTables.forEach(t => {
            grid.innerHTML += `
                <button onclick="selectTransferTable('${t.id}')" id="tfer-btn-${t.id}" class="tfer-table-btn py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-700 font-bold hover:border-orange-500 transition shadow-xs">
                    ${t.tableNumber}
                </button>
            `;
        });
    }
    
    tableToTransfer = null;
    (document.getElementById('btn-transfer-confirm') as HTMLButtonElement).disabled = true;
    document.getElementById('btn-transfer-confirm')!.classList.add('opacity-50', 'cursor-not-allowed');
    
    document.getElementById('modal-transfer-table')!.classList.remove('hidden');
    document.getElementById('modal-transfer-table')!.classList.add('flex');
});

(window as any).selectTransferTable = (id: string) => {
    tableToTransfer = id;
    document.querySelectorAll('.tfer-table-btn').forEach(b => {
        b.classList.remove('border-orange-500', 'text-orange-700', 'bg-orange-50');
        b.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
    });
    const btn = document.getElementById(`tfer-btn-${id}`)!;
    btn.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');
    btn.classList.add('border-orange-500', 'text-orange-700', 'bg-orange-50');
    
    (document.getElementById('btn-transfer-confirm') as HTMLButtonElement).disabled = false;
    document.getElementById('btn-transfer-confirm')!.classList.remove('opacity-50', 'cursor-not-allowed');
};

document.getElementById('btn-transfer-cancel')?.addEventListener('click', () => {
    document.getElementById('modal-transfer-table')!.classList.add('hidden');
    document.getElementById('modal-transfer-table')!.classList.remove('flex');
});

document.getElementById('btn-transfer-confirm')?.addEventListener('click', async () => {
    if (!currentOrderId || !selectedTableId || !tableToTransfer) return;
    
    try {
        const oldTable = allTables.find(t => t.id === selectedTableId);
        const pax = oldTable ? oldTable.current_pax : 1;
        
        // 1. Cập nhật Order sang bàn mới
        await fetch(`${API_ORDERS_URL}/${currentOrderId}`, {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ table_id: tableToTransfer })
        });
        
        // 2. Bàn mới thành Occupied
        await capNhatTrangThaiBan(tableToTransfer, 'Occupied', pax);
        
        // 3. Bàn cũ thành Available
        await capNhatTrangThaiBan(selectedTableId, 'Available', 0);
        
        showSuccessToast('Đã chuyển bàn thành công!');
        document.getElementById('modal-transfer-table')!.classList.add('hidden');
        document.getElementById('modal-transfer-table')!.classList.remove('flex');
        
        allTables = await layDanhSachBan();
        currentOrderId = null;
        selectedTableId = null;
        loadOrders();
        
    } catch(e) {
        console.error(e);
    }
});



// ==========================================
// TAB 5: CÁ NHÂN
// ==========================================
const loadProfile = () => {
    // In real app, fetch from localStorage user obj. Mocking here.
    const user = {
        name: "Nguyễn Văn T",
        id: "NV001",
        role: "Nhân viên phục vụ"
    };
    document.getElementById('profile-name')!.innerText = user.name;
    document.getElementById('info-name')!.innerText = user.name;
    document.getElementById('info-id')!.innerText = user.id;
    document.getElementById('global-user-name')!.innerText = user.name;
};

document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '../auth/login.html'; // Assuming this path
});

// INIT SEARCH EVENT LISTENERS
const initWaiterSearchListeners = () => {
    const waiterSearch = document.getElementById('waiter-menu-search') as HTMLInputElement;
    const waiterClear = document.getElementById('btn-clear-waiter-search');

    if (waiterSearch) {
        waiterSearch.addEventListener('input', () => {
            waiterMenuSearchKeyword = waiterSearch.value.trim();
            if (waiterClear) {
                if (waiterMenuSearchKeyword.length > 0) {
                    waiterClear.classList.remove('hidden');
                } else {
                    waiterClear.classList.add('hidden');
                }
            }
            renderMenuTab();
        });

        waiterSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                waiterSearch.value = '';
                waiterMenuSearchKeyword = '';
                if (waiterClear) waiterClear.classList.add('hidden');
                renderMenuTab();
            }
        });
    }

    if (waiterClear) {
        waiterClear.addEventListener('click', () => {
            if (waiterSearch) {
                waiterSearch.value = '';
                waiterSearch.focus();
            }
            waiterMenuSearchKeyword = '';
            waiterClear.classList.add('hidden');
            renderMenuTab();
        });
    }

    const modalSearch = document.getElementById('modal-menu-search') as HTMLInputElement;
    const modalClear = document.getElementById('btn-clear-modal-search');

    if (modalSearch) {
        modalSearch.addEventListener('input', () => {
            modalMenuSearchKeyword = modalSearch.value.trim();
            if (modalClear) {
                if (modalMenuSearchKeyword.length > 0) {
                    modalClear.classList.remove('hidden');
                } else {
                    modalClear.classList.add('hidden');
                }
            }
            (window as any).renderModalMenuItems();
        });

        modalSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modalSearch.value = '';
                modalMenuSearchKeyword = '';
                if (modalClear) modalClear.classList.add('hidden');
                (window as any).renderModalMenuItems();
            }
        });
    }

    if (modalClear) {
        modalClear.addEventListener('click', () => {
            if (modalSearch) {
                modalSearch.value = '';
                modalSearch.focus();
            }
            modalMenuSearchKeyword = '';
            modalClear.classList.add('hidden');
            (window as any).renderModalMenuItems();
        });
    }
};

// ==========================================
// GÓI A: KHAY MÓN CHỜ BƯNG RA (FOOD PICKUP BOARD)
// ==========================================
const loadPickupBoard = async () => {
    const modal = document.getElementById('modal-pickup-board');
    const list = document.getElementById('pickup-board-list');
    if (!modal || !list) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    list.innerHTML = `<div class="py-12 text-center text-slate-400 font-bold"><i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-500 mb-2"></i><p>Đang tải khay món chờ bưng...</p></div>`;

    try {
        if (allMenuItems.length === 0) allMenuItems = await layDanhSachMonAn();
        if (allTables.length === 0) allTables = await layDanhSachBan();

        const [readyDetails, allOrders] = await Promise.all([
            layDanhSachMonSanSang(),
            layTatCaDonHang()
        ]);

        updateReadyPickupBadge();

        if (readyDetails.length === 0) {
            list.innerHTML = `
                <div class="py-12 text-center text-slate-500">
                    <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-3">
                        <i class="fa-solid fa-check-double text-emerald-600"></i>
                    </div>
                    <p class="font-bold text-base text-slate-800">Không có món nào đang chờ bưng ra</p>
                    <p class="text-xs text-slate-500 mt-1">Khi bếp hoàn thành món, danh sách sẽ hiển thị tại đây</p>
                </div>
            `;
            return;
        }

        let html = '';
        readyDetails.forEach((item: any) => {
            let tableName = '';
            let orderCode = '';

            if (item.order_id && typeof item.order_id === 'object') {
                const ordObj = item.order_id;
                const ordId = String(ordObj.id || ordObj._id || '');
                if (ordId) orderCode = `#${ordId.slice(-6).toUpperCase()}`;

                // 1. Kiểm tra table_id lồng bên trong order_id đã populate
                if (ordObj.table_id && typeof ordObj.table_id === 'object') {
                    tableName = ordObj.table_id.tableNumber || '';
                } else if (ordObj.table_id) {
                    const table = allTables.find((t: any) => String(t.id || t._id) === String(ordObj.table_id));
                    if (table) tableName = table.tableNumber;
                }

                if (!tableName && ordObj.customerInfo && ordObj.customerInfo !== 'Khách lẻ') {
                    tableName = ordObj.customerInfo;
                }
            } else if (item.order_id) {
                const ordId = String(item.order_id);
                orderCode = `#${ordId.slice(-6).toUpperCase()}`;
                const order = allOrders.find((o: any) => String(o.id || o._id) === ordId);
                if (order) {
                    if (order.table_id && typeof order.table_id === 'object') {
                        tableName = order.table_id.tableNumber || '';
                    } else if (order.table_id) {
                        const table = allTables.find((t: any) => String(t.id || t._id) === String(order.table_id));
                        if (table) tableName = table.tableNumber;
                    }
                    if (!tableName && order.customerInfo && order.customerInfo !== 'Khách lẻ') {
                        tableName = order.customerInfo;
                    }
                }
            }

            if (!tableName) {
                tableName = orderCode ? `Đơn ${orderCode}` : 'Mang đi';
            }

            const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
            const menuItem = allMenuItems.find((m: any) => String(m.id || m._id) === mId);
            const itemName = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.name) ? item.menuItem_id.name : (menuItem ? menuItem.name : (item.name || 'Món ăn'));
            const itemImg = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.image) ? item.menuItem_id.image : (menuItem ? menuItem.image : '');

            html += `
                <div class="bg-white border border-slate-200 hover:border-emerald-500 rounded-lg p-4 flex items-center justify-between gap-4 transition shadow-sm hover:shadow">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${itemImg}" loading="lazy" decoding="async" class="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200 bg-slate-50">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" title="${orderCode}">
                                    <i class="fa-solid fa-utensils text-[10px] mr-1"></i>${tableName}
                                </span>
                                <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap animate-pulse">
                                    Bếp đã xong
                                </span>
                            </div>
                            <h4 class="font-bold text-slate-900 text-sm truncate">${itemName}</h4>
                            <div class="flex items-center gap-2 text-xs text-slate-500">
                                <span>SL: <strong class="text-emerald-700 text-sm">${item.quantity}</strong></span>
                                ${item.notes ? `<span class="italic text-slate-500 truncate">(${item.notes})</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-serve-pickup shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer" data-id="${item.id}" data-name="${itemName.replace(/"/g, '&quot;')}" data-table="${tableName}">
                        <i class="fa-solid fa-check"></i> Đã bưng
                    </button>
                </div>
            `;
        });

        list.innerHTML = html;

        list.querySelectorAll('.btn-serve-pickup').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const id = target.getAttribute('data-id')!;
                const name = target.getAttribute('data-name')!;
                const tName = target.getAttribute('data-table')!;

                target.disabled = true;
                target.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

                try {
                    await capNhatChiTietDonHang(id, { status: 'Served' });
                    showSuccessToast(`Đã bưng ${name} ra ${tName}!`);
                    kdsChannel.postMessage({
                        type: 'ITEM_SERVED',
                        itemId: id,
                        itemName: name
                    });
                    loadPickupBoard();
                    updateReadyPickupBadge();
                    if (selectedTableId) {
                        const t = allTables.find(x => x.id === selectedTableId);
                        if (t) handleTableClick(t, true);
                    }
                } catch (err) {
                    console.error(err);
                    showWarningToast("Lỗi khi cập nhật trạng thái!");
                }
            });
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = `<div class="py-8 text-center text-red-400">Lỗi khi tải danh sách món sẵn sàng</div>`;
    }
};

const initPickupBoardModal = () => {
    const openBtn = document.getElementById('btn-open-pickup-board');
    const closeBtn = document.getElementById('btn-close-pickup-board');
    const modal = document.getElementById('modal-pickup-board');

    openBtn?.addEventListener('click', loadPickupBoard);
    closeBtn?.addEventListener('click', () => {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
};

// ==========================================
// GÓI A: TRUNG TÂM CHUÔNG GỌI (SERVICE CENTER)
// ==========================================
const renderServiceCenterList = () => {
    const modal = document.getElementById('modal-service-center');
    const list = document.getElementById('service-center-list');
    if (!modal || !list) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const calls = Object.values(activeServiceCalls);
    if (calls.length === 0) {
        list.innerHTML = `
            <div class="py-12 text-center text-slate-500">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-3">
                    <i class="fa-solid fa-bell-slash text-slate-400"></i>
                </div>
                <p class="font-bold text-base text-slate-800">Không có yêu cầu phục vụ nào</p>
                <p class="text-xs text-slate-500 mt-1">Khi khách bấm chuông gọi tại bàn, thông báo sẽ hiện ở đây</p>
            </div>
        `;
        return;
    }

    let html = '';
    calls.forEach(call => {
        const isCall = call.type === 'CALL';
        html += `
            <div class="p-4 rounded-2xl border ${isCall ? 'bg-red-50/60 border-red-200 text-red-900' : 'bg-amber-50/60 border-amber-200 text-amber-900'} shadow-sm space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-lg ${isCall ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'} flex items-center justify-center font-bold text-sm">
                            <i class="fa-solid ${isCall ? 'fa-bell' : 'fa-receipt'}"></i>
                        </span>
                        <div>
                            <h4 class="font-bold text-slate-900 text-base">${call.tableName}</h4>
                            <span class="text-[10px] font-mono text-slate-500">${call.time}</span>
                        </div>
                    </div>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full ${isCall ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                        ${isCall ? 'Gọi phục vụ' : 'Tính tiền'}
                    </span>
                </div>
                <p class="text-xs font-semibold text-slate-700">
                    ${isCall ? (call.reason || 'Cần hỗ trợ tại bàn') : `Phương thức: ${call.method || 'Tiền mặt'}`}
                </p>
                <div class="flex gap-2">
                    <button type="button" class="btn-ack-call flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-sm" data-table="${call.tableId}">
                        <i class="fa-solid fa-check"></i> Tiếp nhận
                    </button>
                    <button type="button" class="btn-goto-table flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1" data-table="${call.tableId}">
                        <i class="fa-solid fa-eye"></i> Xem bàn
                    </button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    list.querySelectorAll('.btn-ack-call').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tableId = (e.currentTarget as HTMLElement).getAttribute('data-table')!;
            delete activeServiceCalls[String(tableId)];
            kdsChannel.postMessage({
                type: 'WAITER_ACKNOWLEDGED',
                tableId,
                message: 'Nhân viên đang tới bàn!'
            });
            showSuccessToast('Đã tiếp nhận yêu cầu từ khách!');
            updateServiceCenterBadge();
            renderServiceCenterList();
            renderTables();
            if (selectedTableId && String(selectedTableId) === String(tableId)) {
                const table = allTables.find(t => String(t.id) === String(tableId));
                if (table) handleTableClick(table, true);
            }
        });
    });

    list.querySelectorAll('.btn-goto-table').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tableId = (e.currentTarget as HTMLElement).getAttribute('data-table')!;
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            (window as any).switchTab('tables');
            const table = allTables.find(t => String(t.id) === String(tableId));
            if (table) handleTableClick(table);
        });
    });
};

const initServiceCenterModal = () => {
    const openBtn = document.getElementById('btn-open-service-center');
    const closeBtn = document.getElementById('btn-close-service-center');
    const modal = document.getElementById('modal-service-center');

    openBtn?.addEventListener('click', renderServiceCenterList);
    closeBtn?.addEventListener('click', () => {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
};

// ==========================================
// GÓI B: MODAL ĐẶT TRƯỚC BÀN (TABLE RESERVATION)
// ==========================================
const initReservationModal = () => {
    const modal = document.getElementById('modal-reserve-table');
    const closeBtn = document.getElementById('btn-close-reserve-table');
    const cancelBtn = document.getElementById('btn-cancel-reserve');
    const confirmBtn = document.getElementById('btn-confirm-reserve');

    const closeModal = () => {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        targetReservationTableId = null;
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    confirmBtn?.addEventListener('click', async () => {
        if (!targetReservationTableId) return;
        const nameInput = document.getElementById('reserve-name') as HTMLInputElement;
        const phoneInput = document.getElementById('reserve-phone') as HTMLInputElement;
        const timeInput = document.getElementById('reserve-time') as HTMLInputElement;
        const paxInput = document.getElementById('reserve-pax') as HTMLInputElement;
        const notesInput = document.getElementById('reserve-notes') as HTMLInputElement;

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const time = timeInput.value.trim();
        const pax = parseInt(paxInput.value) || 2;
        const notes = notesInput.value.trim();

        if (!name) {
            showWarningToast("Vui lòng nhập tên khách hàng!");
            nameInput.focus();
            return;
        }
        if (!phone) {
            showWarningToast("Vui lòng nhập số điện thoại khách!");
            phoneInput.focus();
            return;
        }

        try {
            await fetch(`${API_TABLES_URL}/${targetReservationTableId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Reserved',
                    reservation: {
                        guestName: name,
                        phone,
                        time,
                        pax,
                        notes,
                        createdAt: new Date().toISOString()
                    }
                })
            });
            showSuccessToast(`Đã đặt trước bàn cho khách ${name}!`);
            closeModal();
            await loadTables();
            const table = allTables.find(t => t.id === targetReservationTableId);
            if (table) handleTableClick(table);
        } catch (e) {
            console.error(e);
            showWarningToast("Lỗi khi lưu thông tin đặt bàn!");
        }
    });
};

// ==========================================
// GÓI B: MODAL CHUYỂN MÓN SANG BÀN KHÁC (TRANSFER ITEMS)
// ==========================================
const initTransferItemModal = () => {
    const modal = document.getElementById('modal-transfer-item');
    const closeBtn = document.getElementById('btn-close-transfer-item');
    const cancelBtn = document.getElementById('btn-cancel-transfer-item');
    const confirmBtn = document.getElementById('btn-confirm-transfer-item') as HTMLButtonElement;
    const grid = document.getElementById('transfer-item-table-grid');
    const summary = document.getElementById('transfer-items-summary');

    const closeModal = () => {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        selectedTransferTargetTableId = null;
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    document.getElementById('btn-transfer-item')?.addEventListener('click', async () => {
        if (!selectedTableId || !currentOrderId) {
            showWarningToast("Chưa chọn bàn hoặc đơn hàng!");
            return;
        }
        if (selectedOrderItemIds.length === 0) {
            showWarningToast("Vui lòng chọn ít nhất một món trong danh sách để chuyển!");
            return;
        }

        // Get details of selected items
        const details = await layChiTietCuaDon(currentOrderId);
        const allSelectedIds = selectedOrderItemIds.flatMap(c => c.split(','));
        const selectedItems = details.filter((d: any) => allSelectedIds.includes(String(d.id)));

        if (selectedItems.length === 0) {
            showWarningToast("Không tìm thấy thông tin món đã chọn!");
            return;
        }

        const summaryTexts = selectedItems.map((item: any) => {
            const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
            const m = allMenuItems.find(x => String(x.id || x._id) === mId);
            const mName = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.name) ? item.menuItem_id.name : (m ? m.name : (item.name || 'Món'));
            return `x${item.quantity} ${mName}`;
        });
        if (summary) summary.innerText = summaryTexts.join(', ');

        // Render destination tables (allTables except selectedTableId, excluding Locked)
        if (grid) {
            grid.innerHTML = '';
            const eligibleTables = allTables.filter(t => t.id !== selectedTableId && t.status !== 'Locked');
            eligibleTables.forEach(t => {
                const isOccupied = t.status === 'Occupied' || t.status === 'Waiting_Payment';
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `p-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    isOccupied 
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-200 hover:bg-orange-500/40' 
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/40'
                }`;
                btn.innerHTML = `
                    <span class="font-black text-sm">${t.tableNumber}</span>
                    <span class="text-[10px] opacity-80">${isOccupied ? 'Có khách' : 'Trống'}</span>
                `;
                btn.onclick = () => {
                    grid.querySelectorAll('button').forEach(b => {
                        b.classList.remove('ring-4', 'ring-indigo-500', 'border-indigo-400');
                    });
                    btn.classList.add('ring-4', 'ring-indigo-500', 'border-indigo-400');
                    selectedTransferTargetTableId = t.id;
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                };
                grid.appendChild(btn);
            });
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    confirmBtn?.addEventListener('click', async () => {
        if (!selectedTransferTargetTableId || !selectedTableId || !currentOrderId) return;
        const targetTable = allTables.find(t => t.id === selectedTransferTargetTableId);
        const sourceTable = allTables.find(t => t.id === selectedTableId);
        if (!targetTable) return;

        const isConfirmed = await showConfirmModal("Xác nhận chuyển món", `Chuyển các món đã chọn từ ${sourceTable?.tableNumber || 'Bàn hiện tại'} sang ${targetTable.tableNumber}?`);
        if (!isConfirmed) return;

        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Đang chuyển...';

        try {
            // Check if target table has an open order
            let targetOrder: any = null;
            const targetOrders = await layDonHangDangMoCuaBan(targetTable.id);
            if (targetOrders.length > 0) {
                targetOrder = targetOrders[0];
            } else {
                // If target table is Available or empty, open it
                await capNhatTrangThaiBan(targetTable.id, 'Occupied', 2);
                targetOrder = await taoDonHang({
                    table_id: targetTable.id,
                    customerInfo: "Khách chuyển món",
                    totalAmount: 0,
                    status: "In_Progress",
                    paymentStatus: "Unpaid",
                    createdAt: new Date().toISOString()
                });
            }

            const targetOrdId = targetOrder.id || targetOrder._id || (targetOrder.data && (targetOrder.data.id || targetOrder.data._id));
            const allSelectedIds = selectedOrderItemIds.flatMap(c => c.split(','));
            for (const id of allSelectedIds) {
                await capNhatChiTietDonHang(id, { order_id: targetOrdId });
                await new Promise(r => setTimeout(r, 80));
            }

            // Recalculate totals
            const sourceDetails = await layChiTietCuaDon(currentOrderId);
            const sourceTotal = sourceDetails.reduce((sum: number, it: any) => sum + ((Number(it.priceAtOrder !== undefined && it.priceAtOrder !== null ? it.priceAtOrder : it.price) || 0) * it.quantity), 0);
            await fetch(`${API_ORDERS_URL}/${currentOrderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalAmount: sourceTotal })
            });

            const targetDetails = await layChiTietCuaDon(targetOrder.id);
            const targetTotal = targetDetails.reduce((sum: number, it: any) => sum + ((Number(it.priceAtOrder !== undefined && it.priceAtOrder !== null ? it.priceAtOrder : it.price) || 0) * it.quantity), 0);
            await fetch(`${API_ORDERS_URL}/${targetOrder.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalAmount: targetTotal })
            });

            kdsChannel.postMessage({
                type: 'TRANSFER_ITEMS',
                fromTable: sourceTable?.tableNumber,
                toTable: targetTable.tableNumber,
                itemCount: allSelectedIds.length,
                message: `Đã chuyển ${allSelectedIds.length} món từ ${sourceTable?.tableNumber} sang ${targetTable.tableNumber}`
            });

            showSuccessToast(`Đã chuyển thành công sang ${targetTable.tableNumber}!`);
            closeModal();
            selectedOrderItemIds = [];
            await loadTables();
            loadTableDetails(selectedTableId, sourceTable?.tableNumber || 'Bàn');
        } catch (e) {
            console.error(e);
            showWarningToast("Lỗi khi chuyển món!");
        } finally {
            confirmBtn.innerText = 'Xác nhận chuyển';
        }
    });
};

// INIT
loadTables();
initWaiterSearchListeners();
updateReadyPickupBadge();
updateServiceCenterBadge();
initPickupBoardModal();
initServiceCenterModal();
initReservationModal();
initTransferItemModal();
initDetailStatusFilter();

// Bật Short Polling an toàn có cờ khóa chống nghẽn (3.5 giây 1 lần)
let isPollingWaiter = false;
setInterval(async () => {
    if (isPollingWaiter) return;
    isPollingWaiter = true;
    try {
        if (currentTab === 'tables') {
            await Promise.all([
                loadTables(true),
                updateReadyPickupBadge(),
                updateServiceCenterBadge()
            ]);
        } else if (currentTab === 'details' && selectedTableId) {
            const tableTitleEl = document.getElementById('detail-table-title');
            const tableNumber = tableTitleEl ? tableTitleEl.innerText : '';
            await Promise.all([
                loadTableDetails(selectedTableId, tableNumber, true),
                updateReadyPickupBadge(),
                updateServiceCenterBadge()
            ]);
        }
    } catch (e) {
        // Tránh gián đoạn hệ thống khi mạng lag
    } finally {
        isPollingWaiter = false;
    }
}, 3500);



