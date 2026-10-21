import { 
    capNhatTrangThaiMon, capNhatTrangThaiMenu, layDanhSachMonChoXacNhan, 
    layDanhSachMonChoNau, layDanhSachMonSanSang, layDanhSachMonAn, layTatCaDonHang, layDanhSachBan, 
    layDanhSachNguyenLieu, layTatCaCongThuc, layDanhSachDanhMuc, unpackData 
} from './api';
import { MenuItem, Category } from './interfaces';
import { showConfirmModal, showSuccessToast, showWarningToast } from './utils/ui';
import { getCurrentUser, requireAuth, logout } from './auth';

// Kiểm tra bắt buộc đăng nhập trước khi sử dụng Bếp KDS
const currentAuthUser = requireAuth(['Chef', 'Admin']);

let mangMonAn: MenuItem[] = [];
let mangDanhMuc: Category[] = [];
let mangBan: any[] = [];
let mangOrder: any[] = [];
let mangNguyenLieu: any[] = [];
let mangCongThuc: any[] = [];
let mangMonSanSang: any[] = []; // Món Ready cho Gói 1 (Recall)
let currentKitchenDataHash = "";
let kitchenPollingInterval: any = null;
let previousPendingCount = -1;

// Trạng thái trạm lọc (Station routing) & chế độ xem (View mode)
let currentStation: 'all' | 'hot' | 'cold' | 'bar' = 'all';
let currentViewMode: 'dish' | 'table' = 'dish';

// Gói 1: Recall state & Bộ lọc lịch sử hoàn thành
let recallSearchKeyword = '';
let recallFilterMode: 'all' | '15m' = 'all';
const completedTimeMap: Record<string, number> = {};

// Gói 2: Hàng đợi Giục bếp & Ưu tiên thủ công (Rush Queue & Priority)
const rushedDetailIds = new Set<string>();
const rushedTableKeys = new Set<string>();
const manualPriorityIds = new Set<string>();

const loadRushState = () => {
    try {
        const d = JSON.parse(sessionStorage.getItem('kds_rushed_details') || '[]');
        const t = JSON.parse(sessionStorage.getItem('kds_rushed_tables') || '[]');
        const m = JSON.parse(sessionStorage.getItem('kds_manual_priorities') || '[]');
        d.forEach((id: string) => rushedDetailIds.add(String(id)));
        t.forEach((tb: string) => rushedTableKeys.add(String(tb).toLowerCase()));
        m.forEach((id: string) => manualPriorityIds.add(String(id)));
    } catch (e) {
        console.warn('Lỗi đọc rush state:', e);
    }
};

const saveRushState = () => {
    try {
        sessionStorage.setItem('kds_rushed_details', JSON.stringify(Array.from(rushedDetailIds)));
        sessionStorage.setItem('kds_rushed_tables', JSON.stringify(Array.from(rushedTableKeys)));
        sessionStorage.setItem('kds_manual_priorities', JSON.stringify(Array.from(manualPriorityIds)));
    } catch (e) {
        console.warn('Lỗi lưu rush state:', e);
    }
};
loadRushState();

// Gói 3: Tìm kiếm nhanh trên màn hình KDS
let kdsQuickSearch = '';

// Khởi tạo kênh giao tiếp thời gian thực (Push Notification)
const kdsChannel = new BroadcastChannel('foodhub_kds');

// --- HỆ THỐNG ÂM THANH CHUÔNG BÁO BẾP (KDS CHIME - WEB AUDIO API) ---
let audioCtx: AudioContext | null = null;
let isSoundEnabled = localStorage.getItem('kds_sound') !== 'false';

const initAudio = () => {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

// Chuông đôi 2-tone chuyên nghiệp cho Bếp (Ding-Dong POS chuẩn)
const playKitchenChime = () => {
    if (!isSoundEnabled) return;
    try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        // Tone 1: 587.33 Hz (D5)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        // Tone 2: 880 Hz (A5)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.45, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.9);
    } catch (e) {
        console.warn('Không thể phát âm thanh KDS:', e);
    }
};

// Cập nhật giao diện nút âm thanh
const updateSoundUI = () => {
    const soundIcon = document.getElementById('sound-icon');
    const soundLabel = document.getElementById('sound-label');
    const btnSound = document.getElementById('btn-sound-toggle');
    if (!btnSound || !soundIcon || !soundLabel) return;

    if (isSoundEnabled) {
        soundIcon.className = 'fa-solid fa-volume-high text-emerald-400';
        soundLabel.innerText = 'Chuông: Bật';
        btnSound.classList.remove('opacity-60', 'border-red-500/30');
    } else {
        soundIcon.className = 'fa-solid fa-volume-xmark text-red-400';
        soundLabel.innerText = 'Chuông: Tắt';
        btnSound.classList.add('opacity-60', 'border-red-500/30');
    }
};

// Gắn sự kiện nút chuông
document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
    initAudio();
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('kds_sound', String(isSoundEnabled));
    updateSoundUI();
    if (isSoundEnabled) {
        playKitchenChime(); // Kêu thử 1 tiếng phản hồi
    }
});

// Cho phép unlock âm thanh bằng bất kỳ thao tác click đầu tiên trên trang
window.addEventListener('click', () => initAudio(), { once: true });

// Lắng nghe thông điệp từ Waiter / Customer
kdsChannel.onmessage = (event) => {
    if (event.data.type === 'FOODHUB_NEW_ORDER' || event.data.type === 'CUSTOMER_ORDERED' || event.data.type === 'NEW_ORDER') {
        playKitchenChime();
        currentKitchenDataHash = "";
        renderKDS();
    } else if (event.data.type === 'RUSH_ORDER') {
        playKitchenChime();
        if (event.data.detailId) rushedDetailIds.add(String(event.data.detailId));
        if (event.data.tableId) rushedTableKeys.add(String(event.data.tableId).toLowerCase());
        if (event.data.tableName) rushedTableKeys.add(String(event.data.tableName).toLowerCase());
        if (event.data.orderId) rushedTableKeys.add(String(event.data.orderId).toLowerCase());
        saveRushState();
        showWarningToast(event.data.message || '⚡ Có yêu cầu GIỤC BẾP KHẨN CẤP!');
        currentKitchenDataHash = "";
        renderKDS();
    } else if (event.data.type === 'TRANSFER_ITEMS') {
        showWarningToast(event.data.message || 'Có món vừa được chuyển bàn!');
        currentKitchenDataHash = "";
        renderKDS();
    } else if (event.data.type === 'KITCHEN_RECALL') {
        currentKitchenDataHash = "";
        renderKDS();
    } else if (event.data.type === 'ADMIN_ANNOUNCEMENT') {
        if (!event.data.targetAudience || event.data.targetAudience === 'all' || event.data.targetAudience === 'kitchen') {
            playKitchenChime();
            const prefix = event.data.priority === 'urgent' ? '🚨 [KHẨN CẤP]' : '📢 [LOA QUẢN LÝ]';
            showWarningToast(`${prefix} ${event.data.title}: ${event.data.message}`);
        }
    }
};

// Định dạng thời gian SLA chuyên nghiệp (Đếm ngược 5 phút chuẩn bị)
export const formatKdsTime = (oldestTime: number, isUrgent = false, targetSlaSecs = 300) => {
    if (!oldestTime || isNaN(oldestTime)) {
        return { isSlaAlert: isUrgent, timeStr: '05:00', badgeLabel: 'Chờ nấu' };
    }
    const now = Date.now();
    const elapsedSecs = Math.max(0, Math.floor((now - oldestTime) / 1000));
    const remainingSecs = targetSlaSecs - elapsedSecs;
    const isOverdue = remainingSecs <= 0;
    const isSlaAlert = isOverdue || isUrgent;

    let timeStr = '';
    let badgeLabel = '';

    if (!isOverdue) {
        const m = Math.floor(remainingSecs / 60);
        const s = remainingSecs % 60;
        timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        badgeLabel = isUrgent ? 'GẤP' : 'Chờ nấu';
    } else {
        const overdueSecs = Math.abs(remainingSecs);
        if (overdueSecs >= 86400) {
            const days = Math.floor(overdueSecs / 86400);
            timeStr = `Trễ >${days}d`;
        } else if (overdueSecs >= 3600) {
            const h = Math.floor(overdueSecs / 3600);
            const m = Math.floor((overdueSecs % 3600) / 60);
            timeStr = `Trễ ${h}h${m > 0 ? ` ${m}p` : ''}`;
        } else {
            const m = Math.floor(overdueSecs / 60);
            const s = overdueSecs % 60;
            timeStr = `Trễ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        badgeLabel = 'QUÁ HẠN';
    }

    return {
        remainingSecs,
        isOverdue,
        isSlaAlert,
        timeStr,
        badgeLabel
    };
};

// Cập nhật real-time các thẻ countdown trên màn hình KDS mỗi giây
const updateLiveTimers = () => {
    // 1. Cập nhật view gộp món
    document.querySelectorAll('.kds-timer-wrapper').forEach(el => {
        const oldestTime = Number(el.getAttribute('data-oldest-time'));
        const isUrgent = el.getAttribute('data-urgent') === '1';
        if (!oldestTime) return;
        const { isSlaAlert, timeStr } = formatKdsTime(oldestTime, isUrgent);
        const textEl = el.querySelector('.kds-timer-text');
        if (textEl && textEl.textContent !== timeStr) {
            textEl.textContent = timeStr;
        }
        if (isSlaAlert) {
            el.classList.add('text-red-500', 'font-black');
            el.classList.remove('text-slate-400', 'font-bold');
            const icon = el.querySelector('i');
            if (icon && !icon.classList.contains('text-red-500')) {
                icon.className = 'fa-solid fa-clock text-red-500 animate-pulse text-lg';
            }
            const card = el.closest('.kds-card');
            if (card && !card.classList.contains('sla-alert')) {
                card.classList.add('sla-alert', 'border-red-500');
                card.classList.remove('border-slate-700');
            }
        }
    });

    // 2. Cập nhật view phiếu order theo bàn
    document.querySelectorAll('.kds-ticket-timer').forEach(el => {
        const oldestTime = Number(el.getAttribute('data-oldest-time'));
        const isUrgent = el.getAttribute('data-urgent') === '1';
        if (!oldestTime) return;
        const { isSlaAlert, timeStr } = formatKdsTime(oldestTime, isUrgent);
        const textEl = el.querySelector('.kds-timer-text');
        if (textEl && textEl.textContent !== timeStr) {
            textEl.textContent = timeStr;
        }
        if (isSlaAlert) {
            el.className = 'kds-ticket-timer text-xs font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400';
            const card = el.closest('.kds-ticket-card');
            if (card && !card.classList.contains('sla-alert')) {
                card.classList.add('sla-alert', 'border-red-500');
                card.classList.remove('border-slate-700');
            }
        }
    });
};

// Khởi tạo đồng hồ
const updateClock = () => {
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('vi-VN', { hour12: false });
    }
    updateLiveTimers();
};
setInterval(updateClock, 1000);
updateClock();

// Helper lấy ID danh mục an toàn (hỗ trợ cả ObjectId dạng string hoặc Object được populate từ MongoDB)
const getDishCategoryId = (mon: any): string => {
    if (!mon) return '';
    if (mon.category_id && typeof mon.category_id === 'object') {
        return String(mon.category_id.id || mon.category_id._id || '');
    }
    return String(mon.category_id || '');
};

// --- PHÂN LOẠI TRẠM CHẾ BIẾN (STATION ROUTING) ---
const getItemStation = (menuItemId: any): 'hot' | 'cold' | 'bar' => {
    if (menuItemId && typeof menuItemId === 'object' && menuItemId.station) {
        return menuItemId.station as 'hot' | 'cold' | 'bar';
    }
    const rawId = (menuItemId && typeof menuItemId === 'object') ? String(menuItemId.id || menuItemId._id) : String(menuItemId || '');
    const item = mangMonAn.find(m => String(m.id || (m as any)._id) === rawId);
    if (item && (item as any).station) return (item as any).station as 'hot' | 'cold' | 'bar';
    if (!item) return 'hot';
    const itemCatId = getDishCategoryId(item);
    const cat = mangDanhMuc.find(c => String(c.id || (c as any)._id) === itemCatId);
    const catName = (cat ? cat.name : '').toLowerCase();
    const catId = itemCatId;

    // Quầy Bar / Đồ uống
    if (catId === 'C004' || catName.includes('uống') || catName.includes('nước') || catName.includes('bar') || catName.includes('drink') || catName.includes('bia') || catName.includes('cà phê') || catName.includes('trà') || catName.includes('cocktail')) {
        return 'bar';
    }
    // Bếp Lạnh / Khai vị / Tráng miệng / Salad
    if (catId === 'C003' || catName.includes('tráng miệng') || catName.includes('salad') || catName.includes('khai vị') || catName.includes('gỏi') || catName.includes('dessert') || catName.includes('cold')) {
        return 'cold';
    }
    // Bếp Nóng (Món chính, lẩu, xào, nướng, súp...)
    return 'hot';
};

// --- RENDER KDS CHÍNH ---
const renderKDS = async (isBackground = false) => {
    try {
        const [pendingDetails, cookingDetails, readyDetails, monAns, orders, tables, ingredients, recipes, categories] = await Promise.all([
            layDanhSachMonChoXacNhan(), // status=Pending
            layDanhSachMonChoNau(),     // status=Cooking
            layDanhSachMonSanSang(),    // status=Ready (Gói 1: Recall)
            mangMonAn.length > 0 ? Promise.resolve(mangMonAn) : layDanhSachMonAn(),
            layTatCaDonHang(),
            mangBan.length > 0 ? Promise.resolve(mangBan) : layDanhSachBan(),
            mangNguyenLieu.length > 0 ? Promise.resolve(mangNguyenLieu) : layDanhSachNguyenLieu(),
            mangCongThuc.length > 0 ? Promise.resolve(mangCongThuc) : layTatCaCongThuc(),
            mangDanhMuc.length > 0 ? Promise.resolve(mangDanhMuc) : layDanhSachDanhMuc()
        ]);

        const newDataHash = JSON.stringify({ 
            pendingIds: pendingDetails.map((p: any) => p.id + p.status + p.quantity), 
            cookingIds: cookingDetails.map((c: any) => c.id + c.status + c.quantity),
            readyCount: readyDetails.length,
            rushCount: rushedDetailIds.size + manualPriorityIds.size,
            search: kdsQuickSearch,
            station: currentStation,
            mode: currentViewMode
        });
        
        if (isBackground && newDataHash === currentKitchenDataHash) return;
        currentKitchenDataHash = newDataHash;
        
        mangMonAn = monAns;
        mangOrder = orders;
        mangBan = tables;
        mangNguyenLieu = Array.isArray(ingredients) ? ingredients : (unpackData(ingredients) || []);
        mangCongThuc = Array.isArray(recipes) ? recipes : (unpackData(recipes) || []);
        mangDanhMuc = Array.isArray(categories) ? categories : (unpackData(categories) || []);
        mangMonSanSang = readyDetails;

        // Lưu vết thời gian Ready nếu chưa có
        const now = Date.now();
        readyDetails.forEach((d: any) => {
            if (!completedTimeMap[d.id]) {
                completedTimeMap[d.id] = d.updatedAt ? new Date(d.updatedAt).getTime() : now;
            }
        });

        // Cập nhật số lượng món đã nấu xong trên badge Header
        const badgeReadyEl = document.getElementById('badge-recent-ready-count');
        if (badgeReadyEl) badgeReadyEl.innerText = String(readyDetails.length);
        const recallTotalEl = document.getElementById('recall-modal-total-count');
        if (recallTotalEl) recallTotalEl.innerText = `${readyDetails.length} món`;

        // Phát chuông báo nếu số lượng món chờ tăng lên
        if (previousPendingCount !== -1 && pendingDetails.length > previousPendingCount) {
            playKitchenChime();
        }
        previousPendingCount = pendingDetails.length;

        // Lọc theo trạm chế biến hiện tại
        const filterByStation = (details: any[]) => {
            if (currentStation === 'all') return details;
            return details.filter(d => getItemStation(d.menuItem_id) === currentStation);
        };

        const filteredPending = filterByStation(pendingDetails);
        const filteredCooking = filterByStation(cookingDetails);

        // Cập nhật số lượng hiển thị trên cột
        const pendingCountEl = document.getElementById('pending-count');
        const cookingCountEl = document.getElementById('cooking-count');
        if (pendingCountEl) pendingCountEl.innerText = filteredPending.length.toString();
        if (cookingCountEl) cookingCountEl.innerText = filteredCooking.length.toString();

        if (currentViewMode === 'dish') {
            // Chế độ 1: Tổng hợp món (Item Grouping)
            const pendingGroups = groupDetailsByDish(filteredPending);
            const cookingGroups = groupDetailsByDish(filteredCooking);
            renderPendingCol(pendingGroups);
            renderCookingCol(cookingGroups);
        } else {
            // Chế độ 2: Theo bàn (Table Ticket Grouping)
            const pendingTickets = groupTicketsByTable(filteredPending);
            const cookingTickets = groupTicketsByTable(filteredCooking);
            renderPendingTickets(pendingTickets);
            renderCookingTickets(cookingTickets);
        }

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu KDS:", error);
    }
};

// Kiểm tra chi tiết món hoặc bàn có thuộc diện GIỤC GẤP / ƯU TIÊN không
const isItemOrTableUrgent = (detail: any, tblName: string): boolean => {
    if (detail.isUrgent) return true;
    if (rushedDetailIds.has(String(detail.id))) return true;
    if (manualPriorityIds.has(String(detail.menuItem_id))) return true;
    if (manualPriorityIds.has(`ticket_${detail.order_id}`)) return true;
    if (tblName && (rushedTableKeys.has(tblName.toLowerCase()) || rushedTableKeys.has(`bàn ${tblName.replace(/\D/g, '')}`.toLowerCase()))) return true;
    if (detail.order_id && rushedTableKeys.has(String(detail.order_id).toLowerCase())) return true;
    return false;
};

const resolveTableInfo = (detail: any): { tableName: string; tableId: string; orderId: string } => {
    let orderId = '';
    let tableId = '';
    let tableName = 'Bàn ?';

    if (detail.order_id && typeof detail.order_id === 'object') {
        orderId = String(detail.order_id.id || detail.order_id._id || '');
        const tObj = detail.order_id.table_id;
        if (tObj && typeof tObj === 'object') {
            tableId = String(tObj.id || tObj._id || '');
            tableName = tObj.tableNumber || `Bàn #${tableId || '?'}`;
        } else if (tObj) {
            tableId = String(tObj);
            const t = mangBan.find(b => String(b.id || (b as any)._id) === tableId);
            if (t) tableName = t.tableNumber;
        }
    } else {
        orderId = String(detail.order_id || '');
        const order = mangOrder.find(o => String(o.id || (o as any)._id) === orderId);
        if (order) {
            const tObj = order.table_id;
            if (tObj && typeof tObj === 'object') {
                tableId = String(tObj.id || tObj._id || '');
                tableName = tObj.tableNumber || `Bàn #${tableId || '?'}`;
            } else if (tObj) {
                tableId = String(tObj);
                const t = mangBan.find(b => String(b.id || (b as any)._id) === tableId);
                if (t) tableName = t.tableNumber;
            }
        }
    }

    return { tableName, tableId, orderId };
};

// Helper làm sạch ghi chú trên KDS (loại bỏ lặp topping)
const cleanKdsNote = (raw: string): string => {
    if (!raw) return '';
    if (!raw.includes(' | ')) return raw.trim();
    const parts = raw.split(' | ').map(s => s.trim()).filter(Boolean);
    const vText = parts[0];
    const normV = vText.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
    const noteParts = parts.slice(1).filter(p => {
        const normP = p.replace(/\(\+.*?\)/g, '').replace(/[\s,|+]/g, '').toLowerCase();
        return normP !== normV && !normV.includes(normP);
    });
    return [vText, ...noteParts].filter(Boolean).join(' | ');
};

// --- HÀM GỘP NHÓM THEO MÓN (DISH GROUPING) ---
const groupDetailsByDish = (details: any[]) => {
    const groups: { [key: string]: any } = {};
    details.forEach(detail => {
        const menuItemId = (detail.menuItem_id && typeof detail.menuItem_id === 'object') ? String(detail.menuItem_id.id || detail.menuItem_id._id) : String(detail.menuItem_id || '');
        if (!groups[menuItemId]) {
            groups[menuItemId] = {
                menuItemId: menuItemId,
                details: [],
                totalQty: 0,
                tablesMap: {} as { [key: string]: number },
                notes: new Set<string>(),
                oldestTime: new Date(detail.createdAt).getTime(), 
                isUrgent: false
            };
        }
        const group = groups[menuItemId];
        group.details.push(detail);
        group.totalQty += detail.quantity;
        
        // Lấy thông tin bàn
        const { tableName } = resolveTableInfo(detail);
        group.tablesMap[tableName] = (group.tablesMap[tableName] || 0) + detail.quantity;
        
        if (detail.notes) group.notes.add(cleanKdsNote(detail.notes));
        if (isItemOrTableUrgent(detail, tableName)) group.isUrgent = true;
        
        const detailTime = new Date(detail.createdAt).getTime();
        if (detailTime < group.oldestTime) group.oldestTime = detailTime;
    });

    let groupsArr = Object.values(groups);

    // Tìm kiếm nhanh trên KDS
    if (kdsQuickSearch.trim() !== '') {
        const kw = kdsQuickSearch.trim().toLowerCase();
        groupsArr = groupsArr.filter(g => {
            const mon = mangMonAn.find(m => String(m.id || (m as any)._id) === g.menuItemId);
            const name = (mon ? mon.name : '').toLowerCase();
            const tables = Object.keys(g.tablesMap).join(' ').toLowerCase();
            return name.includes(kw) || tables.includes(kw);
        });
    }
    
    // Sort: Giục gấp / Ưu tiên LÊN ĐẦU (Gói 2), sau đó đến cũ nhất trước (FIFO)
    return groupsArr.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return a.oldestTime - b.oldestTime;
    });
};

// --- HÀM GỘP THEO BÀN / ORDER TICKET ---
const groupTicketsByTable = (details: any[]) => {
    const tableMap: { [orderId: string]: { orderId: string; tableId: string; tableName: string; customerInfo?: string; details: any[]; oldestTime: number; isUrgent: boolean } } = {};
    details.forEach(detail => {
        const { orderId, tableId, tableName } = resolveTableInfo(detail);
        const key = orderId || String(Math.random());
        if (!tableMap[key]) {
            const custInfo = (detail.order_id && typeof detail.order_id === 'object') ? detail.order_id.customerInfo : '';
            tableMap[key] = {
                orderId: key,
                tableId,
                tableName,
                customerInfo: custInfo,
                details: [],
                oldestTime: new Date(detail.createdAt).getTime(),
                isUrgent: false
            };
        }
        tableMap[key].details.push(detail);
        if (isItemOrTableUrgent(detail, tableMap[key].tableName)) tableMap[key].isUrgent = true;
        const t = new Date(detail.createdAt).getTime();
        if (t < tableMap[key].oldestTime) tableMap[key].oldestTime = t;
    });

    let ticketsArr = Object.values(tableMap);

    // Tìm kiếm nhanh trên KDS
    if (kdsQuickSearch.trim() !== '') {
        const kw = kdsQuickSearch.trim().toLowerCase();
        ticketsArr = ticketsArr.filter(t => {
            const tbl = t.tableName.toLowerCase();
            const oid = String(t.orderId).toLowerCase();
            const dishes = t.details.map((d: any) => {
                const mId = (d.menuItem_id && typeof d.menuItem_id === 'object') ? String(d.menuItem_id.id || d.menuItem_id._id) : String(d.menuItem_id || '');
                const m = mangMonAn.find(x => String(x.id || (x as any)._id) === mId);
                const mName = (d.menuItem_id && typeof d.menuItem_id === 'object' && d.menuItem_id.name) ? d.menuItem_id.name : (m ? m.name : '');
                return mName.toLowerCase();
            }).join(' ');
            return tbl.includes(kw) || oid.includes(kw) || dishes.includes(kw);
        });
    }

    // Sort: Giục gấp / Ưu tiên LÊN ĐẦU
    return ticketsArr.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return a.oldestTime - b.oldestTime;
    });
};

// --- RENDER CỘT ĐANG CHỜ (VIEW TỔNG HỢP MÓN) ---
const renderPendingCol = (groups: any[]) => {
    const container = document.getElementById('pending-container');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold"><i class="fa-solid fa-check-circle text-3xl mb-2 block opacity-40"></i>Không có món chờ nấu</div>`;
        return;
    }

    let html = '';

    groups.forEach(group => {
        const monAn = mangMonAn.find(m => String(m.id || (m as any)._id) === String(group.menuItemId));
        const firstDet = group.details?.[0];
        const popItem = (firstDet?.menuItem_id && typeof firstDet.menuItem_id === 'object') ? firstDet.menuItem_id : null;
        const tenMon = (popItem && popItem.name) ? popItem.name : (monAn ? monAn.name : 'Món không xác định');
        
        // Format danh sách bàn
        const tableTags = Object.entries(group.tablesMap as Record<string, number>).map(([tb, qty]) => 
            `<span class="px-2 py-1 bg-slate-700/80 rounded text-xs font-bold text-slate-300 border border-slate-600/50">${tb}${qty > 1 ? ` (x${qty})` : ''}</span>`
        ).join('');

        // Ghi chú
        const noteStr = Array.from(group.notes).join(', ');
        const noteHtml = noteStr ? `<div class="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm font-bold p-3 rounded-xl mb-4">Ghi chú: ${noteStr}</div>` : '';

        // Tính SLA (Đếm ngược 5 phút chuẩn bị)
        const { isSlaAlert, timeStr } = formatKdsTime(group.oldestTime, group.isUrgent);
        
        // Card styling: Ưu tiên chớp đỏ viền hồng cam cho GIỤC GẤP (Gói 2)
        const isRush = group.isUrgent;
        const alertClass = isRush 
            ? 'rush-alert border-rose-500 bg-rose-950/20' 
            : (isSlaAlert ? 'sla-alert border-red-500' : 'border-slate-700');
        const timeClass = (isRush || isSlaAlert) ? 'text-red-500 font-black' : 'text-slate-400 font-bold';

        const detailIds = group.details.map((d: any) => d.id).join(',');

        const isComboMon = monAn?.is_combo || group.details?.some((d: any) => d.is_combo);
        const comboItemList = (monAn?.combo_items && monAn.combo_items.length > 0)
            ? monAn.combo_items
            : (group.details?.find((d: any) => d.combo_items && d.combo_items.length)?.combo_items || []);
        const comboBreakdownHtml = (isComboMon && comboItemList.length > 0)
            ? `<div class="text-xs text-slate-300 bg-slate-900/70 p-2.5 rounded-xl mb-3 border border-amber-500/30">
                 <div class="text-amber-400 font-bold flex items-center gap-1.5 mb-1.5 text-xs">
                     <i class="fa-solid fa-layer-group"></i> Combo gồm các món (x${group.totalQty}):
                 </div>
                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-200">
                     ${comboItemList.map((ci: any) => `
                         <div class="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
                             <span class="font-black text-amber-400 font-mono">${(ci.quantity || 1) * group.totalQty}x</span>
                             <span class="truncate">${ci.name}${ci.variant_name ? ` <span class="text-slate-400 text-[10px]">(${ci.variant_name})</span>` : ''}</span>
                         </div>
                     `).join('')}
                 </div>
               </div>`
            : '';

        // Tính số phần có thể nấu
        const dsCongThuc = mangCongThuc.filter(c => String(c.menuItem_id) === String(group.menuItemId));
        let maxPortions = -1;
        if (dsCongThuc.length > 0) {
            maxPortions = Math.min(...dsCongThuc.map(c => {
                const ing = mangNguyenLieu.find(i => String(i.id) === String(c.ingredient_id));
                if (!ing) return 0;
                const stock = Number(ing.stock_quantity) || 0;
                const req = Number(c.quantity_required) || 1;
                return Math.floor(stock / req);
            }));
        }

        let stockHtml = '';
        let canCook = true;
        let cookBtnText = 'Nhận nấu';
        let cookBtnClass = 'btn-start-cooking bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-lg py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 cursor-pointer';
        let cookBtnDisabled = '';

        if (maxPortions >= 0) {
            if (maxPortions <= 0) {
                canCook = false;
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-500 rounded border border-red-500/30 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> HẾT NGUYÊN LIỆU (0 phần)</div>`;
                cookBtnText = '<i class="fa-solid fa-ban mr-1.5"></i> Không thể nấu';
                cookBtnClass = 'btn-start-cooking bg-slate-700/60 text-slate-500 font-bold text-base py-3 px-6 rounded-xl cursor-not-allowed border border-slate-600/50 flex items-center justify-center';
                cookBtnDisabled = 'disabled';
            } else if (maxPortions < group.totalQty) {
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Kho thiếu: còn ${maxPortions}/${group.totalQty} phần</div>`;
            } else {
                stockHtml = `<div class="text-xs font-bold px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">Kho còn: ${maxPortions} phần</div>`;
            }
        }

        const outOfStockActionBtn = !canCook
            ? `<button data-menu-id="${group.menuItemId}" data-detail-ids="${detailIds}" data-menu-name="${tenMon}" class="btn-cancel-out-of-stock bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer" title="Khóa món trên Menu & Hủy các phần đang chờ">
                <i class="fa-solid fa-ban"></i> Hủy & Báo hết
               </button>`
            : '';

        const rushBadge = isRush 
            ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white inline-flex items-center gap-1 shadow-md shadow-rose-500/40 animate-pulse mb-1.5"><i class="fa-solid fa-bolt"></i> GIỤC BẾP GẤP</span>` 
            : '';

        html += `
            <div class="kds-card bg-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group border ${alertClass}">
                <!-- Toolbar góc phải: Công thức, Ưu tiên, Khóa món -->
                <div class="absolute top-4 right-4 flex items-center gap-1.5">
                    <button data-menu-id="${group.menuItemId}" class="btn-recipe-peek p-1.5 px-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1" title="Xem định lượng công thức món">
                        <i class="fa-solid fa-book-open"></i> <span class="hidden sm:inline">Công thức</span>
                    </button>
                    <button data-menu-id="${group.menuItemId}" class="btn-toggle-priority p-1.5 px-2 rounded-lg text-xs font-bold transition-all ${isRush ? 'bg-rose-500 text-white shadow' : 'bg-slate-700/60 text-slate-400 hover:text-amber-400 border border-slate-600/40'}" title="${isRush ? 'Hạ ưu tiên' : 'Đánh dấu ưu tiên cao lên đầu'}">
                        <i class="fa-solid fa-bolt"></i>
                    </button>
                    <button data-menu-id="${group.menuItemId}" class="btn-out-of-stock p-1.5 px-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-red-500/20 hover:text-red-500 transition-colors tooltip" title="Báo hết hàng">
                        <i class="fa-solid fa-ban text-xs"></i>
                    </button>
                </div>
                
                <div class="pr-28">
                    ${rushBadge}
                    <h4 class="font-black text-2xl text-white mb-1 flex items-center gap-2">
                        <span>${tenMon}</span>
                        ${isComboMon ? '<span class="text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">COMBO</span>' : ''}
                    </h4>
                    <div class="flex items-center gap-3 mb-3">
                        <div class="text-3xl font-black text-orange-500">x ${group.totalQty}</div>
                        ${stockHtml}
                    </div>
                </div>
                
                ${comboBreakdownHtml}
                <div class="flex gap-2 flex-wrap mb-3">${tableTags}</div>
                ${noteHtml}
                
                <div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-700">
                    <div class="kds-timer-wrapper flex items-center gap-2 font-mono text-base ${timeClass}" data-oldest-time="${group.oldestTime}" data-urgent="${isRush ? '1' : '0'}">
                        <i class="fa-solid fa-clock ${(isRush || isSlaAlert) ? 'text-red-500 animate-pulse' : 'text-slate-400'} text-lg"></i>
                        <span class="kds-timer-text font-black">${timeStr}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${outOfStockActionBtn}
                        <button data-ids="${detailIds}" data-menu-id="${group.menuItemId}" data-can-cook="${canCook ? (maxPortions >= 0 && maxPortions < group.totalQty ? 'partial' : 'true') : 'false'}" data-portions="${maxPortions}" data-qty="${group.totalQty}" class="${cookBtnClass}" ${cookBtnDisabled}>
                            ${cookBtnText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    attachPendingEvents();
};

// --- RENDER CỘT ĐANG NẤU (VIEW TỔNG HỢP MÓN) ---
const renderCookingCol = (groups: any[]) => {
    const container = document.getElementById('cooking-container');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold"><i class="fa-solid fa-fire text-3xl mb-2 block opacity-40"></i>Không có món đang nấu</div>`;
        return;
    }

    let html = '';

    groups.forEach(group => {
        const monAn = mangMonAn.find(m => m.id === group.menuItemId);
        const tenMon = monAn ? monAn.name : 'Món không xác định';
        const isRush = group.isUrgent;
        
        // Gói 3: Trả món từng bàn (Partial completion per table)
        const tableTags = Object.entries(group.tablesMap as Record<string, number>).map(([tb, qty]) => {
            const tableDetails = group.details.filter((d: any) => {
                const order = mangOrder.find(o => String(o.id) === String(d.order_id));
                const table = order ? mangBan.find(t => String(t.id) === String(order.table_id)) : null;
                const name = table ? table.tableNumber : "Bàn ?";
                return name === tb;
            });
            const tableDetailIds = tableDetails.map((d: any) => d.id).join(',');
            return `
                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 rounded-xl text-xs font-bold text-slate-200 border border-slate-600/70 shadow-sm">
                    <span>${tb}${qty > 1 ? ` (x${qty})` : ''}</span>
                    <button data-ids="${tableDetailIds}" data-table="${tb}" data-qty="${qty}" data-dish="${tenMon}" 
                        class="btn-partial-finish-table ml-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1 active:scale-95 shadow cursor-pointer" 
                        title="Đã nấu xong phần cho ${tb}">
                        <i class="fa-solid fa-check"></i> Xong
                    </button>
                </div>
            `;
        }).join('');

        const detailIds = group.details.map((d: any) => d.id).join(',');
        const rushBadge = isRush 
            ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white inline-flex items-center gap-1 shadow-md shadow-rose-500/40 animate-pulse mb-1.5"><i class="fa-solid fa-bolt"></i> GIỤC BẾP GẤP</span>` 
            : '';

        const cardBorderClass = isRush 
            ? 'rush-alert border-rose-500 bg-rose-950/20' 
            : 'border-orange-500/30';

        const isComboMon = monAn?.is_combo || group.details?.some((d: any) => d.is_combo);
        const comboItemList = (monAn?.combo_items && monAn.combo_items.length > 0)
            ? monAn.combo_items
            : (group.details?.find((d: any) => d.combo_items && d.combo_items.length)?.combo_items || []);
        const comboBreakdownHtml = (isComboMon && comboItemList.length > 0)
            ? `<div class="text-xs text-slate-300 bg-slate-900/70 p-2.5 rounded-xl mb-3 border border-amber-500/30">
                 <div class="text-amber-400 font-bold flex items-center gap-1.5 mb-1.5 text-xs">
                     <i class="fa-solid fa-layer-group"></i> Combo gồm các món (x${group.totalQty}):
                 </div>
                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-200">
                     ${comboItemList.map((ci: any) => `
                         <div class="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
                             <span class="font-black text-amber-400 font-mono">${(ci.quantity || 1) * group.totalQty}x</span>
                             <span class="truncate">${ci.name}${ci.variant_name ? ` <span class="text-slate-400 text-[10px]">(${ci.variant_name})</span>` : ''}</span>
                         </div>
                     `).join('')}
                 </div>
               </div>`
            : '';

        html += `
            <div class="bg-slate-800/80 rounded-2xl p-5 shadow-lg border ${cardBorderClass} relative overflow-hidden">
                <!-- Toolbar góc phải: Công thức, Ưu tiên -->
                <div class="absolute top-4 right-4 flex items-center gap-1.5">
                    <button data-menu-id="${group.menuItemId}" class="btn-recipe-peek p-1.5 px-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1" title="Xem định lượng công thức món">
                        <i class="fa-solid fa-book-open"></i> <span class="hidden sm:inline">Công thức</span>
                    </button>
                    <button data-menu-id="${group.menuItemId}" class="btn-toggle-priority p-1.5 px-2 rounded-lg text-xs font-bold transition-all ${isRush ? 'bg-rose-500 text-white shadow' : 'bg-slate-700/60 text-slate-400 hover:text-amber-400 border border-slate-600/40'}" title="${isRush ? 'Hạ ưu tiên' : 'Đánh dấu ưu tiên cao lên đầu'}">
                        <i class="fa-solid fa-bolt"></i>
                    </button>
                </div>

                <div class="pr-24">
                    ${rushBadge}
                    <h4 class="font-black text-2xl text-white mb-1 flex items-center gap-2">
                        <span>${tenMon}</span>
                        ${isComboMon ? '<span class="text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">COMBO</span>' : ''}
                    </h4>
                    <div class="flex items-center gap-3 mb-3">
                        <div class="text-3xl font-black text-emerald-400">x ${group.totalQty}</div>
                        <span class="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-bold border border-orange-500/30 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span> Đang nấu
                        </span>
                    </div>
                </div>
                
                ${comboBreakdownHtml}
                <div class="flex gap-2 flex-wrap mb-4">${tableTags}</div>
                
                <div class="flex items-center justify-between mt-auto pt-4 border-t border-slate-700">
                    <div class="flex items-center gap-2 text-orange-400 font-bold text-sm">
                        <i class="fa-solid fa-fire text-sm animate-pulse"></i>
                        Đang chế biến
                    </div>
                    <button data-ids="${detailIds}" data-dish="${tenMon}" class="btn-finish-cooking bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-lg py-3 px-8 rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-bell-concierge text-xl"></i>
                        Xong toàn bộ
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    attachCookingEvents();
};

// --- RENDER THEO BÀN (TABLE TICKETS - PENDING) ---
const renderPendingTickets = (tickets: any[]) => {
    const container = document.getElementById('pending-container');
    if (!container) return;

    if (tickets.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold"><i class="fa-solid fa-check-circle text-3xl mb-2 block opacity-40"></i>Không có phiếu bàn chờ nấu</div>`;
        return;
    }

    let html = '';

    tickets.forEach(ticket => {
        const { isSlaAlert, timeStr } = formatKdsTime(ticket.oldestTime, ticket.isUrgent);
        const isRush = ticket.isUrgent;
        const allDetailIds = ticket.details.map((d: any) => d.id).join(',');

        let itemsHtml = '';
        ticket.details.forEach((d: any) => {
            const mId = (d.menuItem_id && typeof d.menuItem_id === 'object') ? String(d.menuItem_id.id || d.menuItem_id._id) : String(d.menuItem_id || '');
            const mon = mangMonAn.find(m => String(m.id || (m as any)._id) === mId);
            const name = (d.menuItem_id && typeof d.menuItem_id === 'object' && d.menuItem_id.name) ? d.menuItem_id.name : (mon ? mon.name : (d.name || 'Món ?'));
            const noteStr = d.notes ? `<span class="block text-xs text-yellow-400 italic">${cleanKdsNote(d.notes)}</span>` : '';
            const isCombo = d.is_combo || mon?.is_combo;
            const comboItems = (d.combo_items && d.combo_items.length > 0) ? d.combo_items : (mon?.combo_items || []);
            const comboBreakdown = (isCombo && comboItems.length > 0)
                ? `<div class="text-[11px] text-slate-300 bg-slate-900/60 p-1.5 rounded-lg mt-1 border border-amber-500/30">
                     <span class="text-amber-400 font-bold">Gồm:</span> ${comboItems.map((ci: any) => `${(ci.quantity || 1) * d.quantity}x ${ci.name}${ci.variant_name ? ` (${ci.variant_name})` : ''}`).join(', ')}
                   </div>`
                : '';

            itemsHtml += `
                <div class="flex items-start justify-between py-2 border-b border-slate-700/60 last:border-0">
                    <div class="flex-1 pr-2">
                        <div class="font-bold text-white text-base flex items-center gap-1.5">
                            <span>${name}</span>
                            ${isCombo ? '<span class="text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded">COMBO</span>' : ''}
                        </div>
                        ${noteStr}
                        ${comboBreakdown}
                    </div>
                    <div class="font-black text-orange-400 text-lg">x${d.quantity}</div>
                </div>
            `;
        });

        const rushBadge = isRush 
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white inline-flex items-center gap-1 shadow animate-pulse"><i class="fa-solid fa-bolt"></i> GIỤC GẤP</span>` 
            : '';

        const alertClass = isRush 
            ? 'rush-alert border-rose-500 bg-rose-950/20' 
            : (isSlaAlert ? 'sla-alert border-red-500' : 'border-slate-700');

        html += `
            <div class="kds-ticket-card bg-slate-800 rounded-2xl p-5 shadow-lg border ${alertClass}">
                <div class="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Phiếu Order #${ticket.orderId}</span>
                            ${rushBadge}
                        </div>
                        <h4 class="text-2xl font-black text-white">${ticket.tableName}</h4>
                    </div>
                    <div class="text-right flex flex-col items-end gap-1.5">
                        <div class="flex items-center gap-2">
                            <button data-order-id="${ticket.orderId}" class="btn-toggle-priority-ticket p-1 px-2 rounded-lg text-xs font-bold transition-all ${isRush ? 'bg-rose-500 text-white shadow' : 'bg-slate-700 text-slate-400 hover:text-amber-400'}" title="${isRush ? 'Hạ ưu tiên bàn' : 'Ghim ưu tiên bàn lên đầu'}">
                                <i class="fa-solid fa-bolt"></i>
                            </button>
                            <span class="kds-ticket-timer text-xs font-black px-2 py-0.5 rounded-full ${(isRush || isSlaAlert) ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}" data-oldest-time="${ticket.oldestTime}" data-urgent="${isRush ? '1' : '0'}">
                                <i class="fa-solid fa-clock mr-1"></i><span class="kds-timer-text">${timeStr}</span>
                            </span>
                        </div>
                        <div class="text-xs text-slate-400 font-bold">${ticket.details.length} món</div>
                    </div>
                </div>

                <div class="space-y-1 mb-4">
                    ${itemsHtml}
                </div>

                <button data-ids="${allDetailIds}" class="btn-start-cooking w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-black text-base shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-fire"></i> Nhận nấu toàn bộ bàn
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    attachPendingEvents();
};

// --- RENDER THEO BÀN (TABLE TICKETS - COOKING) ---
const renderCookingTickets = (tickets: any[]) => {
    const container = document.getElementById('cooking-container');
    if (!container) return;

    if (tickets.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold"><i class="fa-solid fa-fire text-3xl mb-2 block opacity-40"></i>Không có phiếu bàn đang nấu</div>`;
        return;
    }

    let html = '';

    tickets.forEach(ticket => {
        const isRush = ticket.isUrgent;
        const allDetailIds = ticket.details.map((d: any) => d.id).join(',');

        // Gói 3: Trả món từng món riêng lẻ trong phiếu bàn
        let itemsHtml = '';
        ticket.details.forEach((d: any) => {
            const mId = (d.menuItem_id && typeof d.menuItem_id === 'object') ? String(d.menuItem_id.id || d.menuItem_id._id) : String(d.menuItem_id || '');
            const mon = mangMonAn.find(m => String(m.id || (m as any)._id) === mId);
            const name = (d.menuItem_id && typeof d.menuItem_id === 'object' && d.menuItem_id.name) ? d.menuItem_id.name : (mon ? mon.name : (d.name || 'Món ?'));
            const noteStr = d.notes ? `<span class="block text-xs text-yellow-400 italic">${cleanKdsNote(d.notes)}</span>` : '';
            const isCombo = d.is_combo || mon?.is_combo;
            const comboItems = (d.combo_items && d.combo_items.length > 0) ? d.combo_items : (mon?.combo_items || []);
            const comboBreakdown = (isCombo && comboItems.length > 0)
                ? `<div class="text-[11px] text-slate-300 bg-slate-900/60 p-1.5 rounded-lg mt-1 border border-amber-500/30">
                     <span class="text-amber-400 font-bold">Gồm:</span> ${comboItems.map((ci: any) => `${(ci.quantity || 1) * d.quantity}x ${ci.name}${ci.variant_name ? ` (${ci.variant_name})` : ''}`).join(', ')}
                   </div>`
                : '';

            itemsHtml += `
                <div class="flex items-center justify-between py-2.5 border-b border-slate-700/60 last:border-0">
                    <div class="flex-1 pr-3">
                        <div class="font-bold text-white text-base flex items-center gap-1.5">
                            <span>${name}</span>
                            ${isCombo ? '<span class="text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded">COMBO</span>' : ''}
                        </div>
                        ${noteStr}
                        ${comboBreakdown}
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-black text-emerald-400 text-lg">x${d.quantity}</span>
                        <button data-id="${d.id}" data-name="${name}" data-table="${ticket.tableName}" 
                            class="btn-single-item-finish px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 active:scale-95 shadow cursor-pointer" 
                            title="Hoàn thành riêng món này">
                            <i class="fa-solid fa-check"></i> Xong
                        </button>
                    </div>
                </div>
            `;
        });

        const rushBadge = isRush 
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white inline-flex items-center gap-1 shadow animate-pulse"><i class="fa-solid fa-bolt"></i> GIỤC GẤP</span>` 
            : '';

        const cardBorderClass = isRush 
            ? 'rush-alert border-rose-500 bg-rose-950/20' 
            : 'border-orange-500/30';

        html += `
            <div class="bg-slate-800 rounded-2xl p-5 shadow-lg border ${cardBorderClass}">
                <div class="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Phiếu Đang Nấu #${ticket.orderId}</span>
                            ${rushBadge}
                        </div>
                        <h4 class="text-2xl font-black text-white">${ticket.tableName}</h4>
                    </div>
                    <div class="flex items-center gap-2">
                        <button data-order-id="${ticket.orderId}" class="btn-toggle-priority-ticket p-1 px-2 rounded-lg text-xs font-bold transition-all ${isRush ? 'bg-rose-500 text-white shadow' : 'bg-slate-700 text-slate-400 hover:text-amber-400'}" title="${isRush ? 'Hạ ưu tiên bàn' : 'Ghim ưu tiên bàn lên đầu'}">
                            <i class="fa-solid fa-bolt"></i>
                        </button>
                        <span class="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-bold border border-orange-500/30 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span> Đang nấu
                        </span>
                    </div>
                </div>

                <div class="space-y-1 mb-4">
                    ${itemsHtml}
                </div>

                <button data-ids="${allDetailIds}" data-table="${ticket.tableName}" class="btn-finish-cooking w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-black text-base shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-bell-concierge text-lg"></i> Hoàn thành toàn bộ bàn
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    attachCookingEvents();
};

// --- SỰ KIỆN NÚT TRÊN CỘT ĐANG CHỜ ---
const attachPendingEvents = () => {
    // Nhận nấu
    document.querySelectorAll('.btn-start-cooking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const canCook = target.getAttribute('data-can-cook');
            if (canCook === 'false') {
                showWarningToast('Không đủ nguyên liệu để nấu món này! Vui lòng bấm "Hủy & Báo hết" hoặc liên hệ Phục vụ.');
                return;
            }
            if (canCook === 'partial') {
                const portions = target.getAttribute('data-portions');
                const totalQty = target.getAttribute('data-qty');
                const ok = await showConfirmModal(
                    'Cảnh báo thiếu nguyên liệu',
                    `Tồn kho chỉ còn đủ ${portions} phần nhưng khách gọi ${totalQty} phần.\n\nBạn có chắc chắn muốn nhận nấu ${portions} phần còn lại không?`,
                    { okText: 'Nhận nấu một phần', cancelText: 'Đóng', type: 'warning' }
                );
                if (!ok) return;
            }

            const idsStr = target.getAttribute('data-ids');
            if (!idsStr) return;

            target.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Đang xử lý...';
            target.disabled = true;

            const ids = idsStr.split(',');
            try {
                await Promise.all(ids.map(id => capNhatTrangThaiMon(id, 'Cooking')));
                showSuccessToast('Đã nhận nấu món thành công!');
                currentKitchenDataHash = "";
                renderKDS();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi cập nhật trạng thái');
                target.disabled = false;
                target.innerHTML = 'Nhận nấu';
            }
        });
    });

    // Nút Hủy & Báo hết khi hết nguyên liệu
    document.querySelectorAll('.btn-cancel-out-of-stock').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            const detailIdsStr = target.getAttribute('data-detail-ids');
            const menuName = target.getAttribute('data-menu-name') || 'Món này';
            if (!menuId) return;

            const ok = await showConfirmModal(
                'Báo hết hàng & Hủy món chờ',
                `Món "${menuName}" đã hết nguyên liệu chế biến.\n\nHệ thống sẽ:\n• Khóa món trên toàn bộ menu (Hết hàng)\n• Hủy các phần đang chờ nấu\n• Gửi thông báo đến Phục vụ để hỗ trợ khách\n\nBạn có chắc chắn muốn thực hiện?`,
                { okText: 'Khóa & Hủy món', cancelText: 'Hủy bỏ', type: 'danger' }
            );
            if (!ok) return;

            target.disabled = true;
            target.innerText = 'Đang xử lý...';

            try {
                await capNhatTrangThaiMenu(menuId, 'Out_of_stock');
                const monItem = mangMonAn.find(m => String(m.id) === String(menuId));
                if (monItem) monItem.status = 'Out_of_stock';
                
                if (detailIdsStr) {
                    const ids = detailIdsStr.split(',');
                    await Promise.all(ids.map(id => capNhatTrangThaiMon(id, 'Cancelled', 'Bếp hết nguyên liệu')));
                }

                kdsChannel.postMessage({
                    type: 'OUT_OF_STOCK',
                    menuId,
                    newStatus: 'Out_of_stock',
                    message: `⚠️ Bếp báo: Món "${menuName}" đã hết nguyên liệu! Đã hủy các phần chờ để đổi món cho khách.`
                });

                showSuccessToast(`Đã khóa món "${menuName}" và hủy phần chờ nấu!`);
                currentKitchenDataHash = "";
                renderKDS();
            } catch (err) {
                console.error(err);
                showWarningToast('Có lỗi xảy ra khi xử lý báo hết hàng');
                target.disabled = false;
                target.innerText = 'Hủy & Báo hết';
            }
        });
    });

    // Báo hết hàng (nút icon ban trên card món)
    document.querySelectorAll('.btn-out-of-stock').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            if (!menuId) return;

            const mon = mangMonAn.find(m => String(m.id) === String(menuId));
            const monName = mon ? mon.name : 'món này';

            const ok = await showConfirmModal(
                'Xác nhận báo hết hàng',
                `Bạn có chắc muốn báo HẾT HÀNG món "${monName}"?\n\nMón ăn sẽ được tự động khóa trên toàn bộ thực đơn của Phục vụ và Khách hàng.`,
                { okText: 'Khóa món', cancelText: 'Hủy bỏ', type: 'danger' }
            );
            if (!ok) return;

            try {
                await capNhatTrangThaiMenu(menuId, 'Out_of_stock');
                const monItem = mangMonAn.find(m => String(m.id) === String(menuId));
                if (monItem) monItem.status = 'Out_of_stock';

                kdsChannel.postMessage({
                    type: 'OUT_OF_STOCK',
                    menuId,
                    newStatus: 'Out_of_stock',
                    message: `⚠️ Bếp đã khóa món "${monName}" (Hết hàng) trên menu`
                });
                showSuccessToast(`Đã khóa món "${monName}" thành công!`);
                currentKitchenDataHash = "";
                renderKDS();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi khi báo hết hàng');
            }
        });
    });

    // Gói 2: Bật/Tắt ưu tiên thủ công cho món (Chef Priority)
    document.querySelectorAll('.btn-toggle-priority').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            if (!menuId) return;

            if (manualPriorityIds.has(menuId)) {
                manualPriorityIds.delete(menuId);
                showSuccessToast('Đã hạ ưu tiên món này');
            } else {
                manualPriorityIds.add(menuId);
                showSuccessToast('⚡ Đã ghim ƯU TIÊN CAO cho món này!');
            }
            saveRushState();
            currentKitchenDataHash = "";
            renderKDS();
        });
    });

    // Gói 2: Bật/Tắt ưu tiên thủ công cho phiếu bàn
    document.querySelectorAll('.btn-toggle-priority-ticket').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const orderId = target.getAttribute('data-order-id');
            if (!orderId) return;
            const key = `ticket_${orderId}`;

            if (manualPriorityIds.has(key)) {
                manualPriorityIds.delete(key);
                showSuccessToast('Đã hạ ưu tiên phiếu bàn');
            } else {
                manualPriorityIds.add(key);
                showSuccessToast('⚡ Đã ghim ƯU TIÊN CAO cho phiếu bàn này!');
            }
            saveRushState();
            currentKitchenDataHash = "";
            renderKDS();
        });
    });

    // Gói 3: Xem công thức & định lượng nguyên liệu món
    document.querySelectorAll('.btn-recipe-peek').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            if (menuId) openRecipePeekModal(menuId);
        });
    });
};

// --- SỰ KIỆN NÚT TRÊN CỘT ĐANG NẤU ---
const attachCookingEvents = () => {
    // 1. Gói 3: Trả món theo từng bàn riêng lẻ (Partial Cook by Table)
    document.querySelectorAll('.btn-partial-finish-table').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const idsStr = target.getAttribute('data-ids');
            const tblName = target.getAttribute('data-table') || 'bàn';
            const qty = target.getAttribute('data-qty') || '1';
            const dishName = target.getAttribute('data-dish') || 'Món';
            if (!idsStr) return;

            target.disabled = true;
            target.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';

            const ids = idsStr.split(',');
            try {
                await Promise.all(ids.map(id => capNhatTrangThaiMon(id, 'Ready')));
                
                // Lưu vết thời gian hoàn thành
                const now = Date.now();
                ids.forEach(id => { completedTimeMap[id] = now; });

                kdsChannel.postMessage({ 
                    type: 'KITCHEN_READY', 
                    message: `🔔 Bếp báo: Đã xong ${qty} phần "${dishName}" cho ${tblName}! Vui lòng nhận món.` 
                });
                showSuccessToast(`Đã xong ${qty} phần "${dishName}" cho ${tblName}!`);
                currentKitchenDataHash = "";
                renderKDS();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi khi hoàn thành món theo bàn');
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-check"></i> Xong';
            }
        });
    });

    // 2. Gói 3: Trả món từng món riêng lẻ trong phiếu bàn (Single item in ticket)
    document.querySelectorAll('.btn-single-item-finish').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            const name = target.getAttribute('data-name') || 'Món';
            const tblName = target.getAttribute('data-table') || 'bàn';
            if (!id) return;

            target.disabled = true;
            target.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';

            try {
                await capNhatTrangThaiMon(id, 'Ready');
                completedTimeMap[id] = Date.now();

                kdsChannel.postMessage({ 
                    type: 'KITCHEN_READY', 
                    message: `🔔 Bếp báo: Món "${name}" (${tblName}) vừa xong! Vui lòng nhận món.` 
                });
                showSuccessToast(`Đã xong món "${name}" (${tblName})!`);
                currentKitchenDataHash = "";
                renderKDS();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi khi hoàn thành món');
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-check"></i> Xong';
            }
        });
    });

    // 3. Hoàn thành toàn bộ (Mẻ gộp hoặc cả phiếu bàn)
    document.querySelectorAll('.btn-finish-cooking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const idsStr = target.getAttribute('data-ids');
            const dishName = target.getAttribute('data-dish');
            const tableName = target.getAttribute('data-table');
            if (!idsStr) return;

            target.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Đang xử lý...';
            target.disabled = true;

            const ids = idsStr.split(',');
            try {
                await Promise.all(ids.map(id => capNhatTrangThaiMon(id, 'Ready')));
                
                const now = Date.now();
                ids.forEach(id => { completedTimeMap[id] = now; });

                const msg = tableName 
                    ? `🔔 Bếp báo: Đã xong toàn bộ món cho ${tableName}! Vui lòng nhận món.`
                    : (dishName ? `🔔 Bếp báo: Đã nấu xong toàn bộ phần "${dishName}"!` : '🔔 Bếp báo: Có món mới vừa nấu xong!');

                kdsChannel.postMessage({ 
                    type: 'KITCHEN_READY', 
                    message: msg 
                });
                
                showSuccessToast('Đã nấu xong! Đã báo phục vụ nhận món.');
                currentKitchenDataHash = "";
                renderKDS();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi cập nhật trạng thái');
                target.disabled = false;
                target.innerHTML = 'Xong';
            }
        });
    });

    // Gói 2: Bật/Tắt ưu tiên trên cột Đang nấu
    document.querySelectorAll('.btn-toggle-priority').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            if (!menuId) return;

            if (manualPriorityIds.has(menuId)) {
                manualPriorityIds.delete(menuId);
                showSuccessToast('Đã hạ ưu tiên món này');
            } else {
                manualPriorityIds.add(menuId);
                showSuccessToast('⚡ Đã ghim ƯU TIÊN CAO cho món này!');
            }
            saveRushState();
            currentKitchenDataHash = "";
            renderKDS();
        });
    });

    document.querySelectorAll('.btn-toggle-priority-ticket').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const orderId = target.getAttribute('data-order-id');
            if (!orderId) return;
            const key = `ticket_${orderId}`;

            if (manualPriorityIds.has(key)) {
                manualPriorityIds.delete(key);
                showSuccessToast('Đã hạ ưu tiên phiếu bàn');
            } else {
                manualPriorityIds.add(key);
                showSuccessToast('⚡ Đã ghim ƯU TIÊN CAO cho phiếu bàn này!');
            }
            saveRushState();
            currentKitchenDataHash = "";
            renderKDS();
        });
    });

    // Gói 3: Xem công thức trên cột Đang nấu
    document.querySelectorAll('.btn-recipe-peek').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-menu-id');
            if (menuId) openRecipePeekModal(menuId);
        });
    });
};

// ==========================================
// GÓI 3: POPUP XEM CÔNG THỨC & ĐỊNH LƯỢNG MÓN
// ==========================================
const openRecipePeekModal = (menuId: string) => {
    const modal = document.getElementById('modal-recipe-peek');
    const dish = mangMonAn.find(m => String(m.id) === String(menuId));
    if (!modal || !dish) return;

    const nameEl = document.getElementById('recipe-modal-dish-name');
    const imgEl = document.getElementById('recipe-modal-dish-img') as HTMLImageElement;
    const stationBadge = document.getElementById('recipe-modal-station-badge');
    const catEl = document.getElementById('recipe-modal-category-text');
    const portionsBadge = document.getElementById('recipe-modal-portions-badge');
    const tbody = document.getElementById('recipe-modal-ingredients-tbody');

    if (nameEl) nameEl.innerText = dish.name;
    if (imgEl) imgEl.src = dish.image || 'https://via.placeholder.com/150';

    const station = getItemStation(dish.id);
    const stationLabels = {
        hot: '🔥 Bếp Nóng',
        cold: '🥗 Bếp Lạnh',
        bar: '🍸 Quầy Bar'
    };
    if (stationBadge) stationBadge.innerText = stationLabels[station] || '🔥 Bếp Nóng';

    const dishCatId = getDishCategoryId(dish);
    const cat = mangDanhMuc.find(c => String(c.id || (c as any)._id) === dishCatId);
    if (catEl) catEl.innerText = cat ? cat.name : 'Món ăn';

    // Công thức & nguyên liệu
    const recipes = mangCongThuc.filter(c => String(c.menuItem_id) === String(dish.id));
    let minPortions = -1;

    if (!recipes || recipes.length === 0) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Món này chưa thiết lập công thức nguyên liệu trong hệ thống.</td></tr>`;
        }
        if (portionsBadge) {
            portionsBadge.className = 'text-base font-black text-slate-400 font-mono';
            portionsBadge.innerText = 'Chưa thiết lập';
        }
    } else {
        let rowsHtml = '';
        recipes.forEach(c => {
            const ing = mangNguyenLieu.find(i => String(i.id) === String(c.ingredient_id));
            const ingName = ing ? ing.name : `Nguyên liệu #${c.ingredient_id}`;
            const req = Number(c.quantity_required) || 1;
            const unit = ing ? (ing.unit || '') : '';
            const stock = ing ? (Number(ing.stock_quantity) || 0) : 0;
            const portionsPossible = Math.floor(stock / req);

            if (minPortions === -1 || portionsPossible < minPortions) {
                minPortions = portionsPossible;
            }

            const isStockOk = stock >= req;
            const statusClass = isStockOk ? 'text-emerald-400' : 'text-red-400 font-bold';
            const statusText = isStockOk 
                ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">Đủ nấu (${portionsPossible} suất)</span>` 
                : `<span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">Hết hàng</span>`;

            rowsHtml += `
                <tr class="hover:bg-slate-700/30 transition-colors">
                    <td class="p-3 font-bold text-white">${ingName}</td>
                    <td class="p-3 text-center font-mono text-slate-300 font-bold">${req} ${unit}</td>
                    <td class="p-3 text-center font-mono font-bold ${statusClass}">${stock} ${unit}</td>
                    <td class="p-3 text-right">${statusText}</td>
                </tr>
            `;
        });

        if (tbody) tbody.innerHTML = rowsHtml;
        if (portionsBadge) {
            if (minPortions <= 0) {
                portionsBadge.className = 'text-base font-black text-red-400 font-mono';
                portionsBadge.innerText = 'Hết nguyên liệu (0 suất)';
            } else if (minPortions <= 5) {
                portionsBadge.className = 'text-base font-black text-amber-400 font-mono';
                portionsBadge.innerText = `Sắp hết: ${minPortions} suất`;
            } else {
                portionsBadge.className = 'text-base font-black text-emerald-400 font-mono';
                portionsBadge.innerText = `Đủ nấu: ${minPortions} suất`;
            }
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

const initRecipePeekModal = () => {
    const modal = document.getElementById('modal-recipe-peek');
    const closeBtn = document.getElementById('btn-close-recipe-modal');
    const footerBtn = document.getElementById('btn-close-recipe-modal-footer');

    const closeModal = () => {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    closeBtn?.addEventListener('click', closeModal);
    footerBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
};

// ==========================================
// GÓI 1: MODAL KHÔI PHỤC MÓN ĐÃ NẤU XONG (RECALL)
// ==========================================
const renderRecallModalList = () => {
    const container = document.getElementById('recall-list-container');
    const modal = document.getElementById('modal-kds-recall');
    if (!container || !modal) return;

    if (mangMonSanSang.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <i class="fa-solid fa-clock-rotate-left text-4xl mb-3 text-slate-600"></i>
                <h4 class="text-white font-bold text-base mb-1">Chưa có món nào nấu xong</h4>
                <p class="text-xs text-slate-500">Các món được bấm "Xong" sẽ hiển thị ở đây để bếp kiểm soát và khôi phục khi cần</p>
            </div>
        `;
        return;
    }

    const now = Date.now();
    let filtered = [...mangMonSanSang];

    // Filter theo 15 phút gần nhất
    if (recallFilterMode === '15m') {
        filtered = filtered.filter((d: any) => {
            const time = completedTimeMap[d.id] || (d.updatedAt ? new Date(d.updatedAt).getTime() : now);
            return (now - time) <= 15 * 60 * 1000;
        });
    }

    // Filter theo từ khóa
    if (recallSearchKeyword.trim() !== '') {
        const kw = recallSearchKeyword.trim().toLowerCase();
        filtered = filtered.filter((d: any) => {
            const mId = (d.menuItem_id && typeof d.menuItem_id === 'object') ? String(d.menuItem_id.id || d.menuItem_id._id) : String(d.menuItem_id || '');
            const mon = mangMonAn.find(m => String(m.id || (m as any)._id) === mId);
            const dishName = ((d.menuItem_id && typeof d.menuItem_id === 'object' && d.menuItem_id.name) ? d.menuItem_id.name : (mon ? mon.name : '')).toLowerCase();
            const order = mangOrder.find(o => String(o.id) === String(d.order_id));
            const table = order ? mangBan.find(t => String(t.id) === String(order.table_id)) : null;
            const tableName = (table ? table.tableNumber : '').toLowerCase();
            return dishName.includes(kw) || tableName.includes(kw) || String(d.order_id).includes(kw);
        });
    }

    // Sort mới nhất lên đầu
    filtered.sort((a, b) => {
        const timeA = completedTimeMap[a.id] || (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = completedTimeMap[b.id] || (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeB - timeA;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <i class="fa-solid fa-magnifying-glass text-3xl mb-2 text-slate-600"></i>
                <p class="text-sm font-bold text-slate-300">Không tìm thấy món phù hợp</p>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach((d: any) => {
        const mId = (d.menuItem_id && typeof d.menuItem_id === 'object') ? String(d.menuItem_id.id || d.menuItem_id._id) : String(d.menuItem_id || '');
        const mon = mangMonAn.find(m => String(m.id || (m as any)._id) === mId);
        const dishName = (d.menuItem_id && typeof d.menuItem_id === 'object' && d.menuItem_id.name) ? d.menuItem_id.name : (mon ? mon.name : (d.name || 'Món ?'));
        const order = mangOrder.find(o => String(o.id) === String(d.order_id));
        const table = order ? mangBan.find(t => String(t.id) === String(order.table_id)) : null;
        const tableName = table ? table.tableNumber : `Bàn #${order?.table_id || '?'}`;
        const time = completedTimeMap[d.id] || (d.updatedAt ? new Date(d.updatedAt).getTime() : now);
        const diffMins = Math.max(0, Math.floor((now - time) / 60000));
        const timeAgoStr = diffMins === 0 ? 'Vừa xong' : `${diffMins} phút trước`;
        const timeClockStr = new Date(time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const station = getItemStation(d.menuItem_id);
        const stationBadge = station === 'bar' ? '🍸 Quầy Bar' : (station === 'cold' ? '🥗 Bếp Lạnh' : '🔥 Bếp Nóng');

        html += `
            <div class="bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all shadow-sm">
                <div class="flex items-center gap-3.5 flex-1 min-w-0">
                    <img src="${mon?.image || 'https://via.placeholder.com/150'}" loading="lazy" decoding="async" class="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0" onerror="this.src='https://via.placeholder.com/150'">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-xs font-bold text-slate-400">${tableName}</span>
                            <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.2 rounded-full font-bold">${stationBadge}</span>
                            <span class="text-[11px] text-slate-500 font-mono">${timeClockStr} (${timeAgoStr})</span>
                        </div>
                        <h4 class="font-bold text-white text-base truncate">${dishName}</h4>
                        ${d.notes ? `<div class="text-xs text-yellow-400 italic truncate">Ghi chú: ${d.notes}</div>` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-3 shrink-0">
                    <span class="text-xl font-black text-emerald-400 font-mono">x${d.quantity}</span>
                    <button data-id="${d.id}" data-name="${dishName}" data-table="${tableName}" 
                        class="btn-recall-item px-3.5 py-2 bg-orange-600/90 hover:bg-orange-500 active:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer">
                        <i class="fa-solid fa-rotate-left"></i> Nấu lại
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Gắn sự kiện nút Nấu lại / Hoàn tác (Recall)
    container.querySelectorAll('.btn-recall-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            const name = target.getAttribute('data-name');
            const tbl = target.getAttribute('data-table');
            if (!id) return;

            const ok = await showConfirmModal(
                'Hoàn tác / Nấu lại món',
                `Bạn có chắc muốn đưa món "${name}" (${tbl}) quay trở lại cột "ĐANG NẤU"?\n\nHệ thống sẽ thông báo cho Phục vụ và đưa món trở lại màn hình KDS ngay lập tức.`,
                { okText: 'Nấu lại', cancelText: 'Hủy bỏ', type: 'warning' }
            );
            if (!ok) return;

            target.disabled = true;
            target.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';

            try {
                await capNhatTrangThaiMon(id, 'Cooking');
                kdsChannel.postMessage({
                    type: 'KITCHEN_RECALL',
                    id,
                    message: `↩️ Bếp đã hoàn tác món "${name}" (${tbl}) về trạng thái Đang nấu!`
                });
                showSuccessToast(`Đã đưa món "${name}" trở lại cột Đang nấu!`);
                mangMonSanSang = mangMonSanSang.filter(m => String(m.id) !== String(id));
                renderRecallModalList();
                currentKitchenDataHash = "";
                renderKDS();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi khi hoàn tác món ăn');
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Nấu lại';
            }
        });
    });
};

const initRecallModal = () => {
    const modal = document.getElementById('modal-kds-recall');
    const openBtn = document.getElementById('btn-open-recall-modal');
    const closeBtn = document.getElementById('btn-close-recall-modal');
    const footerBtn = document.getElementById('btn-close-recall-modal-footer');
    const searchInput = document.getElementById('input-recall-search') as HTMLInputElement;
    const refreshBtn = document.getElementById('btn-refresh-recall');
    const filterAllBtn = document.getElementById('btn-recall-filter-all');
    const filter15mBtn = document.getElementById('btn-recall-filter-15m');

    const openModal = async () => {
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        try {
            mangMonSanSang = await layDanhSachMonSanSang();
            renderRecallModalList();
        } catch (e) {
            console.error(e);
        }
    };

    const closeModal = () => {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    footerBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    searchInput?.addEventListener('input', (e) => {
        recallSearchKeyword = (e.target as HTMLInputElement).value || '';
        renderRecallModalList();
    });

    refreshBtn?.addEventListener('click', async () => {
        try {
            mangMonSanSang = await layDanhSachMonSanSang();
            renderRecallModalList();
            showSuccessToast('Đã làm mới danh sách món đã nấu');
        } catch(e) {
            showWarningToast('Lỗi tải danh sách món sẵn sàng');
        }
    });

    filterAllBtn?.addEventListener('click', () => {
        recallFilterMode = 'all';
        filterAllBtn.className = 'btn-recall-filter active px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500 text-white';
        filter15mBtn!.className = 'btn-recall-filter px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 hover:text-white border border-slate-700';
        renderRecallModalList();
    });

    filter15mBtn?.addEventListener('click', () => {
        recallFilterMode = '15m';
        filter15mBtn.className = 'btn-recall-filter active px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500 text-white';
        filterAllBtn!.className = 'btn-recall-filter px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 hover:text-white border border-slate-700';
        renderRecallModalList();
    });
};

// ==========================================
// GÓI 3: TÌM KIẾM NHANH TRÊN MÀN HÌNH KDS
// ==========================================
const initKdsQuickSearch = () => {
    const input = document.getElementById('kds-quick-search') as HTMLInputElement;
    const clearBtn = document.getElementById('kds-clear-search-btn');

    input?.addEventListener('input', (e) => {
        kdsQuickSearch = (e.target as HTMLInputElement).value || '';
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', kdsQuickSearch.trim() === '');
        }
        currentKitchenDataHash = "";
        renderKDS();
    });

    clearBtn?.addEventListener('click', () => {
        if (input) input.value = '';
        kdsQuickSearch = '';
        clearBtn.classList.add('hidden');
        currentKitchenDataHash = "";
        renderKDS();
    });
};

// --- GẮN SỰ KIỆN LỌC TRẠM CHẾ BIẾN & CHẾ ĐỘ XEM ---
const initStationAndFilters = () => {
    // 1. Station routing
    const stationBtns = document.querySelectorAll('.btn-station');
    stationBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            stationBtns.forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white', 'shadow-sm');
                b.classList.add('text-slate-400');
            });
            target.classList.remove('text-slate-400');
            target.classList.add('bg-orange-500', 'text-white', 'shadow-sm');
            currentStation = (target.getAttribute('data-station') || 'all') as any;
            currentKitchenDataHash = ""; // Buộc render lại
            renderKDS();
        });
    });

    // 2. View Mode (Tổng hợp món vs Theo bàn)
    const btnViewDish = document.getElementById('btn-view-by-dish');
    const btnViewTable = document.getElementById('btn-view-by-table');

    btnViewDish?.addEventListener('click', () => {
        currentViewMode = 'dish';
        btnViewDish.className = 'px-3 py-1 bg-orange-500 text-white rounded-md text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
        btnViewTable!.className = 'px-3 py-1 text-slate-400 hover:text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
        currentKitchenDataHash = "";
        renderKDS();
    });

    btnViewTable?.addEventListener('click', () => {
        currentViewMode = 'table';
        btnViewTable.className = 'px-3 py-1 bg-orange-500 text-white rounded-md text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
        btnViewDish!.className = 'px-3 py-1 text-slate-400 hover:text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
        currentKitchenDataHash = "";
        renderKDS();
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
        renderMenuTab(true);
    });
}

// ==========================================
// THỰC ĐƠN / QUẢN LÝ BẬT TẮT MÓN (KDS)
// ==========================================
let kitchenMenuSearchKeyword = '';
let kitchenSelectedCategory = 'all';
let kitchenSelectedStatus: 'all' | 'Available' | 'Out_of_stock' = 'all';
let isKitchenMenuEventsInitialized = false;

const isDishOutOfStock = (mon: MenuItem): boolean => {
    return mon.status === 'Out of Stock' || mon.status === 'Out_of_stock' || mon.status === 'Archived' || mon.inStock === false;
};

const getDishMaxPortions = (monId: string): number => {
    const dsCongThuc = mangCongThuc.filter(c => c.menuItem_id === monId);
    if (!dsCongThuc || dsCongThuc.length === 0) return -1;
    return Math.min(...dsCongThuc.map(c => {
        const ing = mangNguyenLieu.find(i => i.id === c.ingredient_id);
        if (!ing) return 0;
        const req = Number(c.quantity_required) || 1;
        return Math.floor((Number(ing.stock_quantity) || 0) / req);
    }));
};

const updateKitchenStatusCounters = () => {
    const total = mangMonAn.length;
    let outCount = 0;
    let availCount = 0;
    mangMonAn.forEach(mon => {
        if (isDishOutOfStock(mon)) {
            outCount++;
        } else {
            availCount++;
        }
    });

    const totalBadge = document.getElementById('kitchen-menu-total-badge');
    const countAll = document.getElementById('count-status-all');
    const countAvail = document.getElementById('count-status-available');
    const countOut = document.getElementById('count-status-outofstock');

    if (totalBadge) totalBadge.innerText = `${total} món`;
    if (countAll) countAll.innerText = String(total);
    if (countAvail) countAvail.innerText = String(availCount);
    if (countOut) countOut.innerText = String(outCount);
};

const renderKitchenCategoryPills = () => {
    const container = document.getElementById('kitchen-category-filters');
    if (!container) return;

    let html = `
        <button data-cat="all" class="btn-kitchen-cat-filter px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${kitchenSelectedCategory === 'all' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}">
            Tất cả danh mục (${mangMonAn.length})
        </button>
    `;

    mangDanhMuc.forEach(cat => {
        const catId = String(cat.id || (cat as any)._id);
        const count = mangMonAn.filter(m => getDishCategoryId(m) === catId).length;
        const isActive = kitchenSelectedCategory === catId;
        html += `
            <button data-cat="${catId}" class="btn-kitchen-cat-filter px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${isActive ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}">
                ${cat.name} (${count})
            </button>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.btn-kitchen-cat-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const catId = target.getAttribute('data-cat') || 'all';
            kitchenSelectedCategory = catId;
            renderKitchenCategoryPills();
            renderKitchenFilteredGrid();
        });
    });
};

const initKitchenMenuControls = () => {
    if (isKitchenMenuEventsInitialized) return;
    isKitchenMenuEventsInitialized = true;

    const searchInput = document.getElementById('kitchen-menu-search') as HTMLInputElement;
    const clearBtn = document.getElementById('kitchen-menu-clear-search');
    const refreshBtn = document.getElementById('kitchen-menu-refresh-btn');

    searchInput?.addEventListener('input', (e) => {
        kitchenMenuSearchKeyword = (e.target as HTMLInputElement).value || '';
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', kitchenMenuSearchKeyword.trim() === '');
        }
        renderKitchenFilteredGrid();
    });

    clearBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        kitchenMenuSearchKeyword = '';
        clearBtn.classList.add('hidden');
        renderKitchenFilteredGrid();
    });

    refreshBtn?.addEventListener('click', async () => {
        showSuccessToast('Đang làm mới dữ liệu từ máy chủ...');
        await renderMenuTab(true);
        showSuccessToast('Đã đồng bộ thực đơn mới nhất!');
    });

    const statusBtns = document.querySelectorAll('.btn-kitchen-status-filter');
    statusBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const status = target.getAttribute('data-status') as any;
            kitchenSelectedStatus = status || 'all';

            statusBtns.forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white', 'shadow-md', 'shadow-orange-500/20');
                b.classList.add('bg-slate-800', 'text-slate-400', 'border', 'border-slate-700');
            });
            target.classList.remove('bg-slate-800', 'text-slate-400', 'border', 'border-slate-700');
            target.classList.add('bg-orange-500', 'text-white', 'shadow-md', 'shadow-orange-500/20');

            renderKitchenFilteredGrid();
        });
    });
};

const renderKitchenFilteredGrid = () => {
    const container = document.getElementById('menu-grid');
    const emptyEl = document.getElementById('kitchen-menu-empty');
    if (!container) return;

    const filtered = mangMonAn.filter(mon => {
        // Lọc danh mục
        if (kitchenSelectedCategory !== 'all' && getDishCategoryId(mon) !== kitchenSelectedCategory) {
            return false;
        }
        // Lọc trạng thái
        const isOut = isDishOutOfStock(mon);
        if (kitchenSelectedStatus === 'Available' && isOut) return false;
        if (kitchenSelectedStatus === 'Out_of_stock' && !isOut) return false;

        // Lọc tìm kiếm
        if (kitchenMenuSearchKeyword.trim() !== '') {
            const kw = kitchenMenuSearchKeyword.trim().toLowerCase();
            const nameMatch = mon.name.toLowerCase().includes(kw);
            const idMatch = String(mon.id).toLowerCase().includes(kw);
            if (!nameMatch && !idMatch) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        if (emptyEl) {
            emptyEl.classList.remove('hidden');
            emptyEl.classList.add('flex');
        }
        return;
    }

    container.classList.remove('hidden');
    if (emptyEl) {
        emptyEl.classList.add('hidden');
        emptyEl.classList.remove('flex');
    }

    let html = '';
    filtered.forEach(mon => {
        const maxPortions = getDishMaxPortions(mon.id);
        const isOut = isDishOutOfStock(mon);
        const cardBg = isOut ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-800/90 border-slate-700/80 hover:border-slate-600';
        const stockText = maxPortions >= 0 ? `Tồn kho: ${maxPortions} phần` : 'Tồn kho: Vô hạn';
        const stockColor = (maxPortions >= 0 && maxPortions <= 5) ? 'text-amber-400 font-bold' : 'text-slate-400';

        html += `
            <div class="rounded-2xl p-4 shadow-lg border ${cardBg} flex flex-col items-center text-center transition-all duration-200 relative group">
                <div class="relative mb-3">
                    <img src="${mon.image}" loading="lazy" decoding="async" class="w-20 h-20 object-cover rounded-full shadow-md border-2 ${isOut ? 'border-red-500/50 grayscale' : 'border-slate-700'}" onerror="this.src='https://via.placeholder.com/150'">
                    ${isOut ? '<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">ĐÃ KHÓA</span>' : ''}
                </div>
                <h4 class="font-black text-white text-base mb-1 leading-tight line-clamp-2 min-h-[2.5rem]">${mon.name}</h4>
                <div class="text-xs ${stockColor} mb-3">${stockText}</div>
                <div class="flex items-center justify-between w-full mt-auto bg-slate-900/60 p-2.5 rounded-xl border ${isOut ? 'border-red-500/20' : 'border-slate-700/60'}">
                    <span class="text-xs font-bold ${isOut ? 'text-red-400' : 'text-emerald-400'}">
                        ${isOut ? '🔴 Đã khóa' : '🟢 Đang bán'}
                    </span>
                    <button data-id="${mon.id}" data-name="${mon.name}" data-current="${isOut ? 'Out_of_stock' : 'Available'}" 
                        class="btn-toggle-menu relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${!isOut ? 'bg-emerald-500' : 'bg-slate-600'}">
                        <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${!isOut ? 'translate-x-6' : 'translate-x-1'} shadow-sm"></span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Attach toggle event
    container.querySelectorAll('.btn-toggle-menu').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const menuId = target.getAttribute('data-id');
            const menuName = target.getAttribute('data-name');
            const currentStatus = target.getAttribute('data-current');
            if (!menuId) return;
            
            const isLocking = currentStatus !== 'Out_of_stock';
            const ok = await showConfirmModal(
                isLocking ? 'Khóa món ăn' : 'Mở bán món ăn',
                isLocking 
                    ? `Bạn có chắc muốn KHÓA món "${menuName}"?\nKhách hàng và Phục vụ sẽ không thể đặt món này nữa.`
                    : `Bạn có chắc muốn MỞ BÁN LẠI món "${menuName}"?`,
                { okText: isLocking ? 'Khóa món' : 'Mở bán lại', cancelText: 'Hủy bỏ', type: isLocking ? 'danger' : 'primary' }
            );
            if (!ok) return;
            
            const newStatus = isLocking ? 'Out_of_stock' : 'Available';
            target.disabled = true;
            
            try {
                await capNhatTrangThaiMenu(menuId, newStatus);
                const m = mangMonAn.find(x => String(x.id) === String(menuId));
                if (m) m.status = newStatus;
                
                kdsChannel.postMessage({ 
                    type: 'OUT_OF_STOCK', 
                    menuId,
                    newStatus,
                    message: isLocking ? `⚠️ Bếp đã khóa món "${menuName}" (Hết hàng)!` : `✅ Bếp đã mở bán lại món "${menuName}"!` 
                });
                showSuccessToast(isLocking ? `Đã khóa món "${menuName}" thành công!` : `Đã mở bán lại món "${menuName}"!`);
                updateKitchenStatusCounters();
                renderKitchenFilteredGrid();
            } catch (error) {
                console.error(error);
                showWarningToast('Lỗi cập nhật món');
                renderMenuTab(true);
            }
        });
    });
};

const renderMenuTab = async (forceReload: boolean = false) => {
    if (forceReload || mangMonAn.length === 0 || mangDanhMuc.length === 0) {
        const [monAns, ingredients, recipes, categories] = await Promise.all([
            layDanhSachMonAn(),
            layDanhSachNguyenLieu(),
            layTatCaCongThuc(),
            layDanhSachDanhMuc()
        ]);
        mangMonAn = monAns;
        mangNguyenLieu = Array.isArray(ingredients) ? ingredients : (unpackData(ingredients) || []);
        mangCongThuc = Array.isArray(recipes) ? recipes : (unpackData(recipes) || []);
        mangDanhMuc = Array.isArray(categories) ? categories : (unpackData(categories) || []);
    }

    renderKitchenCategoryPills();
    updateKitchenStatusCounters();
    renderKitchenFilteredGrid();
    initKitchenMenuControls();
};

// Khởi chạy
updateSoundUI();
initStationAndFilters();
initRecallModal();
initRecipePeekModal();
initKdsQuickSearch();
renderKDS();

// Polling ngầm mỗi 3 giây
if (!kitchenPollingInterval) {
    kitchenPollingInterval = setInterval(() => {
        if (currentTab === 'kds') {
            renderKDS(true); 
        }
    }, 3000);
}
