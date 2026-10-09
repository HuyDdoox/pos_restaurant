import {
    layDanhSachBan, capNhatTrangThaiBan, taoDonHang, layDonHangDangMoCuaBan,
    layChiTietCuaDon, capNhatChiTietDonHang, taoChiTietDonHang, layDanhSachMonAn,
    layDanhSachDanhMuc, capNhatTrangThaiMenu, layTatCaDonHang, layDanhSachMonSanSang, layDanhSachVariants
} from './api';
import { showSuccessToast, showConfirmModal, showPromptModal, showWarningToast, showMoveMergeModal, showNumberPromptModal } from './utils/ui';

let currentTab = 'tables';
let allTables: any[] = [];
let allMenuItems: any[] = [];
let allCategories: any[] = [];
let selectedTableId: string | null = null;
let currentOrderId: string | null = null;
let selectedOrderItemIds: string[] = []; // Chuyển sang mảng để chọn nhiều mục

// --- GLOBAL UTILS ---
const updateDateTime = () => {
    const now = new Date();
    document.getElementById('global-date')!.innerText = now.toLocaleDateString('vi-VN');
    document.getElementById('global-time')!.innerText = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
setInterval(updateDateTime, 1000);
updateDateTime();

// --- KITCHEN SYNC (ĐỒNG BỘ BẾP - PUSH NOTIFICATION) ---
const kdsChannel = new BroadcastChannel('foodhub_kds');
kdsChannel.onmessage = (event) => {
    if (event.data.type === 'KITCHEN_READY') {
        showSuccessToast(event.data.message);
        
        // Tự động làm mới bàn nếu đang mở
        if (selectedTableId) {
            const table = allTables.find(t => t.id === selectedTableId);
            if (table) handleTableClick(table, true); // true = không hiện hiệu ứng giật
        }
    }
};

const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + ' đ';

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

const renderTables = () => {
    const grid = document.getElementById('tables-grid')!;
    grid.innerHTML = '';
    
    let filtered = allTables;
    if (currentTableFilter === 'empty') filtered = allTables.filter(t => t.status === 'Available');
    if (currentTableFilter === 'occupied') filtered = allTables.filter(t => t.status === 'Occupied');

    filtered.forEach(table => {
        const isOccupied = table.status === 'Occupied';
        const isWaitingPayment = table.status === 'Waiting_Payment';
        const isLocked = table.status === 'Locked';
        const isSelected = table.id === selectedTableId;
        
        let bgClass = 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]'; // Default green for empty
        if (isOccupied) bgClass = 'bg-orange-500 text-white border-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.4)]'; // Orange for occupied
        if (isWaitingPayment) bgClass = 'bg-amber-500 text-white border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse'; // Amber blinking
        if (isLocked) bgClass = 'bg-red-500 text-white border-red-600 opacity-70 cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.4)]'; // Red for locked

        if (isSelected) {
            bgClass += ' ring-4 ring-white ring-offset-4 ring-offset-[#0f172a] transform scale-105 z-10';
        }

        const btn = document.createElement('button');
        btn.className = `relative aspect-square flex-col rounded-2xl border flex items-center justify-center text-xl font-black transition-all hover:brightness-110 active:scale-95 ${bgClass}`;
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
            e.preventDefault(); // Necessary to allow dropping
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
            <span>${table.tableNumber}</span>
            ${isOccupied ? '<div class="absolute top-3 right-3 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>' : ''}
            ${isWaitingPayment ? '<div class="absolute top-3 right-3 w-3 h-3 bg-amber-500 rounded-full animate-bounce"></div>' : ''}
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
                    await fetch(`http://localhost:3000/Orders/${activeOrders[0].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_id: targetId }) });
                }
                
                await fetch(`http://localhost:3000/Tables/${sourceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Available' }) });
                await fetch(`http://localhost:3000/Tables/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: target.status, tableNumber: target.tableNumber.split(' & ')[0] }) });
                
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
                await fetch(`http://localhost:3000/Tables/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Locked', merged_with: sourceId }) });

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
    
    if (table.status === 'Available') {
        rightPanelOccupied.classList.add('hidden');
        rightPanelEmpty.classList.remove('hidden');
        rightPanelEmpty.innerHTML = `
            <svg class="w-16 h-16 mb-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p class="font-bold text-white text-lg mb-2">${table.tableNumber} đang trống</p>
            <button id="btn-open-table" class="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-emerald-500/30">Mở bàn</button>
        `;
        document.getElementById('btn-open-table')!.onclick = () => openTable(table.id);
    } else {
        rightPanelEmpty.classList.add('hidden');
        rightPanelOccupied.classList.remove('hidden');
        rightPanelOccupied.classList.add('flex');
        
        document.getElementById('td-title')!.innerText = table.tableNumber;
        document.getElementById('td-status')!.innerText = table.status === 'Waiting_Payment' ? 'Chờ thanh toán' : 'Đang phục vụ';
        document.getElementById('td-total')!.innerText = '0 đ';
        document.getElementById('td-count')!.innerText = '0 món';
        
        const container = document.getElementById('td-items-container')!;
        const list = document.getElementById('td-items-list')!;
        container.classList.add('hidden');
        list.innerHTML = '';
        
        try {
            const orders = await layDonHangDangMoCuaBan(table.id);
            if (orders.length > 0) {
                const order = orders[0];
                currentOrderId = order.id;
                const details = await layChiTietCuaDon(order.id);
                
                let calculatedTotal = 0;
                let calculatedCount = 0;
                let itemsHtml = '';
                let hasPendingOrReady = false;
                
                details.forEach((curr: any) => {
                    calculatedTotal += (curr.priceAtOrder || 0) * curr.quantity;
                    calculatedCount += curr.quantity;
                    
                    const st = (curr.status || '').toLowerCase();
                    if (st === 'pending' || st === 'cooking' || st === 'ready') {
                        hasPendingOrReady = true;
                        const mon = allMenuItems.find(m => m.id === curr.menuItem_id);
                        const mName = mon ? mon.name : 'Món ẩn';
                        
                        let badge = '';
                        if (st === 'pending') badge = `<span class="whitespace-nowrap shrink-0 bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded">Chờ bếp</span>`;
                        if (st === 'cooking') badge = `<span class="whitespace-nowrap shrink-0 bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[10px] px-1.5 py-0.5 rounded animate-pulse">Đang nấu</span>`;
                        if (st === 'ready') badge = `<span class="whitespace-nowrap shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded font-black shadow-lg shadow-emerald-500/20">Sẵn sàng!</span>`;
                        
                        itemsHtml += `
                            <li class="flex justify-between items-center bg-[#1e293b]/80 border border-orange-500/20 p-2 rounded-lg">
                                <span class="text-xs font-bold text-white truncate max-w-[140px]" title="${mName}">x${curr.quantity} ${mName}</span>
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
            statusSpan.className = 'bg-amber-500/20 border border-amber-500 text-amber-500 text-sm font-bold px-4 py-2 rounded-lg flex items-center uppercase tracking-wider';
        } else {
            statusSpan.innerText = 'ĐANG PHỤC VỤ';
            statusSpan.className = 'bg-[#1e293b] border border-slate-700 text-slate-400 text-sm font-bold px-4 py-2 rounded-lg flex items-center uppercase tracking-wider';
        }
    }
    
    try {
        if (!isBackground) allMenuItems = await layDanhSachMonAn();
        
        const orders = await layDonHangDangMoCuaBan(tableId);
        if (orders.length === 0) return;
        currentOrderId = orders[0].id;
        
        const details = await layChiTietCuaDon(currentOrderId!);
        
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
            row.classList.add('bg-slate-700/80', 'shadow-[inset_4px_0_0_0_#10b981]');
            row.classList.remove('hover:bg-slate-800/50');
        } else {
            row.classList.remove('bg-slate-700/80', 'shadow-[inset_4px_0_0_0_#10b981]');
            row.classList.add('hover:bg-slate-800/50');
        }
    });
};

const renderOrderDetails = (details: any[], pax: number = 0) => {
    const list = document.getElementById('detail-items-list')!;
    list.innerHTML = '';
    
    document.getElementById('detail-guest-count')!.innerText = `${pax} khách`;

    if (details.length === 0) {
        list.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-500">Chưa gọi món nào</td></tr>`;
        return;
    }

    // Gộp các món giống nhau (cùng menuItem_id, cùng trạng thái, cùng ghi chú)
    const groupedMap = new Map();
    details.forEach(item => {
        const key = `${item.menuItem_id}_${item.status.toLowerCase()}_${item.notes || ''}`;
        if (!groupedMap.has(key)) {
            groupedMap.set(key, { ...item, ids: [item.id] });
        } else {
            const existing = groupedMap.get(key);
            existing.quantity += item.quantity;
            existing.ids.push(item.id);
        }
    });

    const groupedDetails = Array.from(groupedMap.values());

    groupedDetails.forEach((item: any) => {
        const menuObj = allMenuItems.find(m => m.id === item.menuItem_id);
        const name = menuObj ? menuObj.name : 'Món không rõ';
        const img = menuObj ? menuObj.image : '';
        const compositeId = item.ids.join(',');
        
        let statusBadge = '';
        if (item.status === 'Unconfirmed' || item.status === 'unconfirmed') statusBadge = `<span class="bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-xs px-3 py-1 rounded-full animate-pulse font-bold">Khách đặt - Chờ XN</span>`;
        if (item.status === 'Pending' || item.status === 'pending') statusBadge = `<span class="bg-slate-700 text-slate-300 text-xs px-3 py-1 rounded-full">Chờ bếp</span>`;
        if (item.status === 'cooking' || item.status === 'Cooking') statusBadge = `<span class="bg-orange-500/20 text-orange-500 border border-orange-500/20 text-xs px-3 py-1 rounded-full">Đang nấu</span>`;
        if (item.status === 'ready' || item.status === 'Ready') statusBadge = `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs px-3 py-1 rounded-full">Sẵn sàng</span>`;
        if (item.status === 'served' || item.status === 'Served') statusBadge = `<span class="bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-3 py-1 rounded-full">Đã phục vụ</span>`;
        if (item.status === 'cancelled' || item.status === 'Cancelled') statusBadge = `<span class="bg-red-500/20 text-red-400 text-xs px-3 py-1 rounded-full line-through">Đã hủy</span>`;
        
        let variantText = '';
        let actualNotes = item.notes || '';

        // Tách biến thể (VD: [S, Rare]) ra khỏi chuỗi notes
        const match = actualNotes.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
            variantText = match[1];
            actualNotes = match[2];
        }

        let variantHtml = '';
        if (variantText) {
            variantHtml = `<span class="text-xs text-slate-400 font-bold bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-700">${variantText}</span>`;
        }

        let notesHtml = '';
        if (actualNotes) {
            notesHtml = `<span class="text-xs text-orange-400 italic">${actualNotes}</span>`;
        }

        const isSelected = selectedOrderItemIds.includes(compositeId);
        const bgClass = isSelected ? 'bg-slate-700/80 shadow-[inset_4px_0_0_0_#10b981]' : 'hover:bg-slate-800/50';

        list.innerHTML += `
            <tr onclick="selectOrderItem('${compositeId}')" data-id="${compositeId}" class="order-item-row transition-colors cursor-pointer ${bgClass}">
                <td class="py-3 px-6">
                    <div class="flex items-center gap-4">
                        <img src="${img}" class="w-12 h-12 rounded-lg object-cover">
                        <span class="font-bold">${name}</span>
                    </div>
                </td>
                <td class="py-3 px-6 w-40">${variantHtml}</td>
                <td class="py-3 px-6 text-center font-black">${item.quantity}</td>
                <td class="py-3 px-6 text-right font-bold text-orange-400">${formatMoney(item.priceAtOrder * item.quantity)}</td>
                <td class="py-3 px-6 w-48">${notesHtml}</td>
                <td class="py-3 px-6 text-right">${statusBadge}</td>
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
    const isConfirmed = await showConfirmModal("Xác nhận", "Bạn có chắc chắn muốn gửi lệnh order các món này xuống bếp?");
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
            if (item.status === 'unconfirmed' || item.status === 'Unconfirmed') {
                await capNhatChiTietDonHang(item.id, { status: 'Pending' });
                await new Promise(r => setTimeout(r, 100));
                count++;
            }
        }
        
        if (count > 0) {
            showSuccessToast(`Đã duyệt ${count} món và đẩy xuống Bếp!`);
        } else {
            showWarningToast('Không có món nào cần duyệt!');
        }
        
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

// MODAL ADD MENU
let currentModalFilter = 'all';
let modalDraftCart: { item: any, quantity: number, variant?: string, note?: string }[] = [];

(window as any).openAddMenuModal = async () => {
    document.getElementById('modal-add-menu')!.classList.remove('hidden');
    document.getElementById('modal-add-menu')!.classList.add('flex');
    if (allCategories.length === 0) allCategories = await layDanhSachDanhMuc();
    if (allMenuItems.length === 0) allMenuItems = await layDanhSachMonAn();
    
    currentModalFilter = 'all';
    modalDraftCart = [];
    
    (window as any).renderModalCategories();
    (window as any).renderModalMenuItems();
    (window as any).renderModalDraftCart();
};

(window as any).renderModalCategories = () => {
    const catList = document.getElementById('modal-category-list')!;
    catList.innerHTML = '';
    
    const renderBtn = (id: string, name: string) => {
        const isActive = currentModalFilter === id;
        const bgClass = isActive 
            ? 'bg-orange-500 text-white shadow-lg border-orange-400' 
            : 'bg-[#1e293b] text-slate-400 hover:bg-slate-700 hover:text-white border-transparent';
        return `<button onclick="filterModalMenu('${id}')" class="text-left px-4 py-3 rounded-xl font-bold transition-all border ${bgClass}">${name}</button>`;
    };
    
    catList.innerHTML += renderBtn('all', 'Tất cả');
    allCategories.forEach(c => {
        catList.innerHTML += renderBtn(c.id, c.name);
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
        if (item.status === 'Out_of_stock' || item.inStock === false) return false;
        if (currentModalFilter !== 'all' && item.category_id !== currentModalFilter) return false;
        return true;
    });

    if (filtered.length === 0) {
        menuGrid.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10 font-bold">Không có món ăn nào.</div>`;
        return;
    }

    filtered.forEach(item => {
        menuGrid.innerHTML += `
            <div class="bg-[#0f172a] rounded-xl border border-slate-700/50 p-3 hover:border-orange-500 transition-colors group flex flex-col shadow-sm hover:shadow-md relative">
                <div class="h-28 overflow-hidden rounded-lg mb-3 bg-slate-800 cursor-pointer" onclick="addMenuItemToOrder('${item.id}')">
                    <img src="${item.image}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                </div>
                <h4 class="text-white font-bold text-sm mb-1 line-clamp-2 cursor-pointer" onclick="addMenuItemToOrder('${item.id}')">${item.name}</h4>
                <div class="text-xs text-emerald-500 font-bold mb-2">Còn ${item.stock_quantity || 0} phần</div>
                <div class="flex justify-between items-center mt-auto">
                    <p class="text-orange-500 font-black text-sm">${formatMoney(item.base_price)}</p>
                    <button onclick="addMenuItemToOrder('${item.id}')" class="w-8 h-8 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-black flex items-center justify-center transition-colors shadow-md active:scale-95">+</button>
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
    
    currentAddingMenuId = menuId;
    currentItemVariants = await layDanhSachVariants(menuId);
    
    if (currentItemVariants.length === 0) {
        const existing = modalDraftCart.find((c: any) => c.item.id === menuId && c.variant === "" && c.note === "");
        if (existing) {
            existing.quantity += 1;
        } else {
            modalDraftCart.push({ item: { ...mon }, quantity: 1, variant: "", note: "" });
        }
        (window as any).renderModalDraftCart();
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
            html += `<div class="mb-3">
                <p class="text-sm text-slate-300 font-bold mb-2 capitalize">${gName}</p>
                <div class="flex flex-wrap gap-2">
            `;
            opts.forEach(opt => {
                const inputType = allowMultiple ? 'checkbox' : 'radio';
                const inputName = `variant_group_${gName}`;
                html += `
                    <label class="flex items-center gap-2 bg-[#1e293b] border border-slate-600 px-3 py-2 rounded-lg cursor-pointer hover:border-orange-500 transition has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/10">
                        <input type="${inputType}" name="${inputName}" value="${opt.name}" class="accent-orange-500" data-price="${opt.extra_price}">
                        <span class="text-white text-sm font-semibold">${opt.name} ${opt.extra_price > 0 ? `(+${formatMoney(opt.extra_price)})` : ''}</span>
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
        
        const variantHtml = cartItem.variant ? `<span class="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded ml-1">${cartItem.variant}</span>` : '';
        const noteHtml = cartItem.note ? `<div class="text-[10px] text-slate-400 mt-0.5 italic">Ghi chú: ${cartItem.note}</div>` : '';
        
        html += `
            <div class="flex items-center justify-between p-3 border border-slate-700/50 rounded-xl bg-[#1e293b]/50">
                <div class="flex-1">
                    <h5 class="text-white font-bold text-sm mb-1">${cartItem.item.name} ${variantHtml}</h5>
                    <p class="text-orange-500 font-bold text-xs">${formatMoney(lineTotal)}</p>
                    ${noteHtml}
                </div>
                <div class="flex items-center gap-2 bg-[#0f172a] rounded-lg p-1 border border-slate-700 ml-2">
                    <button onclick="changeDraftQuantity(${index}, -1)" class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition">-</button>
                    <span class="text-white font-black text-sm w-4 text-center">${cartItem.quantity}</span>
                    <button onclick="changeDraftQuantity(${index}, 1)" class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition">+</button>
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
        allMenuItems = await layDanhSachMonAn();
        allCategories = await layDanhSachDanhMuc();
        renderMenuTab();
    } catch (e) {
        console.error(e);
    }
};

const renderMenuTab = () => {
    const catList = document.getElementById('menu-categories-list')!;
    catList.innerHTML = `<button class="w-full text-left px-4 py-3 bg-[#1e293b] text-orange-500 font-bold rounded-xl border border-orange-500/20">Tất cả</button>`;
    allCategories.forEach(c => {
        catList.innerHTML += `<button class="w-full text-left px-4 py-3 text-slate-400 hover:bg-[#1e293b] hover:text-white font-bold rounded-xl transition">${c.name}</button>`;
    });

    const grid = document.getElementById('menu-items-grid')!;
    grid.innerHTML = '';
    allMenuItems.forEach(item => {
        const isAvailable = item.status !== 'Out_of_stock' && item.inStock !== false;
        
        grid.innerHTML += `
            <div class="bg-[#0f172a] rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden group">
                <div class="h-32 overflow-hidden bg-slate-800">
                    <img src="${item.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500 ${!isAvailable ? 'opacity-40 grayscale' : ''}">
                </div>
                <div class="p-4 flex flex-col flex-1">
                    <h3 class="text-white font-bold text-sm leading-tight mb-1">${item.name}</h3>
                    <p class="text-orange-500 font-black text-sm mb-4">${formatMoney(item.base_price)}</p>
                    
                    <div class="mt-auto flex justify-between items-center">
                        <span class="text-xs font-bold ${isAvailable ? 'text-emerald-500' : 'text-slate-500'}">${isAvailable ? 'Còn ' + (item.stock_quantity || 0) + ' phần' : 'Hết hàng'}</span>
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

const loadOrders = async () => {
    try {
        if (allTables.length === 0) {
            allTables = await layDanhSachBan();
        }
        
        const orders = await layTatCaDonHang();
        let activeOrders = orders.filter((o: any) => (o.status === 'In_Progress' || o.paymentStatus === 'Unpaid') && allTables.find(t => t.id === o.table_id));
        
        if (currentOrderFilter === 'single') {
            activeOrders = activeOrders.filter((o: any) => {
                const t = allTables.find(t => t.id === o.table_id);
                return t && !t.tableNumber.includes('&');
            });
        } else if (currentOrderFilter === 'merged') {
            activeOrders = activeOrders.filter((o: any) => {
                const t = allTables.find(t => t.id === o.table_id);
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
                const table = allTables.find(t => t.id === order.table_id);
                const tName = table ? table.tableNumber : 'Unknown';
                const tId = table ? table.id : '';
                
                // Fetch details to calculate ready items count
                const details = await layChiTietCuaDon(order.id);
                const readyItems = details.filter((d: any) => (d.status || '').toLowerCase() === 'ready').length;
                totalReadyCount += readyItems;
                const readyBadgeHtml = readyItems > 0 ? `<span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-black animate-pulse shadow-lg ml-2 border border-red-400/50">${readyItems} món xong!</span>` : '';

                list.innerHTML += `
                    <button onclick="viewOrderBill('${order.id}', '${tId}')" class="w-full bg-[#1e293b] border border-slate-700/50 hover:border-orange-500 p-4 rounded-2xl flex justify-between items-center transition text-left mb-3">
                        <div>
                            <h4 class="text-white font-bold flex items-center">${tName} ${readyBadgeHtml}</h4>
                            <span class="text-xs text-slate-500 font-semibold">${table?.current_pax || 0} khách</span>
                        </div>
                        <span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs px-3 py-1 rounded-full font-bold">Đang phục vụ</span>
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
            const firstTable = allTables.find(t => t.id === activeOrders[0].table_id);
            (window as any).viewOrderBill(activeOrders[0].id, firstTable ? firstTable.id : '');
        } else if (currentOrderId) {
            // Re-select currently selected order to refresh view if needed
            const currentlyActive = activeOrders.find((o: any) => o.id === currentOrderId);
            if (currentlyActive) {
                const t = allTables.find(t => t.id === currentlyActive.table_id);
                (window as any).viewOrderBill(currentlyActive.id, t ? t.id : '');
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
            const mon = allMenuItems.find(m => m.id === item.menuItem_id);
            if (!mon) return;
            const lineTotal = item.priceAtOrder ? item.priceAtOrder * item.quantity : mon.base_price * item.quantity;
            total += lineTotal;
            const notesHtml = item.notes ? `<div class="text-xs text-orange-400 mt-0.5">${item.notes}</div>` : '';
            // Badge trạng thái
            const s = (item.status || '').toLowerCase();
            let badge = '';
            if (s === 'unconfirmed') badge = `<span class="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-500 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse border border-yellow-500/20"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block"></span>Chờ duyệt</span>`;
            else if (s === 'pending') badge = `<span class="inline-flex items-center gap-1 bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span>Chờ bếp</span>`;
            else if (s === 'cooking') badge = `<span class="inline-flex items-center gap-1 bg-orange-500/20 text-orange-400 text-xs font-bold px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block animate-pulse"></span>Đang nấu</span>`;
            else if (s === 'ready') badge = `<span class="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>Sẵn sàng!</span>`;
            else if (s === 'served') badge = `<span class="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>Đã phục vụ</span>`;
            // Nút mang ra chỉ khi Ready
            const serveBtn = s === 'ready'
                ? `<button onclick="markServed('${item.id}', '${orderId}', '${tableNumber}')" class="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3 py-1 rounded-full transition-colors">✓ Mang ra</button>`
                : '';
            tbody.innerHTML += `
                <tr class="border-b border-slate-800/50 last:border-0">
                    <td class="py-3">
                        <div class="flex items-center gap-3">
                            <img src="${mon.image}" class="w-10 h-10 rounded-md object-cover bg-slate-800 shrink-0">
                            <div>
                                <span class="text-white font-bold text-sm">${mon.name}</span>
                                ${notesHtml}
                                <div class="mt-1.5 flex items-center flex-wrap gap-1">${badge}${serveBtn}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 text-slate-400 font-bold text-center w-10">x${item.quantity}</td>
                    <td class="py-3 text-white font-bold text-right whitespace-nowrap">${formatMoney(lineTotal)}</td>
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
                const mon = allMenuItems.find(m => m.id === item.menuItem_id);
                if (!mon) return;
                const lineTotal = item.priceAtOrder ? item.priceAtOrder * item.quantity : mon.base_price * item.quantity;
                const noteName = item.notes ? ` (${item.notes})` : '';
                receiptItems.innerHTML += `
                    <tr>
                        <td style="padding:3px 0; text-align:left;">${rowNum++}. ${mon.name}${noteName}</td>
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
                <button onclick="selectTransferTable('${t.id}')" id="tfer-btn-${t.id}" class="tfer-table-btn py-3 rounded-xl border-2 border-slate-700 bg-[#0f172a] text-slate-300 font-bold hover:border-orange-500 transition">
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
        b.classList.remove('border-orange-500', 'text-white', 'bg-orange-500/20');
        b.classList.add('border-slate-700', 'bg-[#0f172a]', 'text-slate-300');
    });
    const btn = document.getElementById(`tfer-btn-${id}`)!;
    btn.classList.remove('border-slate-700', 'bg-[#0f172a]', 'text-slate-300');
    btn.classList.add('border-orange-500', 'text-white', 'bg-orange-500/20');
    
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
        await fetch(`http://localhost:3000/orders/${currentOrderId}`, {
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

// INIT
loadTables();

// Bật Short Polling (3 giây 1 lần)
setInterval(() => {
    if (currentTab === 'tables') {
        loadTables(true);
    } else if (currentTab === 'details' && selectedTableId) {
        // Lấy lại table number từ UI (đỡ phải truyền biến)
        const tableNumber = document.getElementById('detail-table-title')!.innerText;
        loadTableDetails(selectedTableId, tableNumber, true);
    }
}, 3000);

