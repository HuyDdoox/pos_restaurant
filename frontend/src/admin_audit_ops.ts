import { 
    layTatCaDonHang, layDanhSachMonAn, layDanhSachBan, layDanhSachIngredients, 
    layDanhSachRecipes, layDanhSachCashTransactions, layDanhSachNguoiDung,
    layDanhSachAuditLogs, ghiAuditLog, layDanhSachVouchers, layDanhSachCustomers
} from './api';
import { API_ORDER_DETAILS_URL } from './config';
import { showSuccessToast, showWarningToast } from './utils/ui';

// Channels
const kdsChannel = new BroadcastChannel('foodhub_kds');
const waiterChannel = new BroadcastChannel('foodhub_waiter');
const cashierChannel = new BroadcastChannel('foodhub_cashier');

// State
let allAuditLogs: any[] = [];
let currentAuditCategory = 'all';
let auditSearchKeyword = '';

// ==========================================
// 1. GÓI 1: LIVE OPS & SMART ALERT HUB
// ==========================================
export const scanAndRenderLiveOpsAlerts = async () => {
    const alertBanner = document.getElementById('live-ops-alert-banner');
    if (!alertBanner) return;

    try {
        const [orders, tables, ingredients, detailsRes, cashTx] = await Promise.all([
            layTatCaDonHang(),
            layDanhSachBan(),
            layDanhSachIngredients(),
            fetch(API_ORDER_DETAILS_URL).then(r => r.ok ? r.json() : []).then(j => Array.isArray(j) ? j : (j.data || [])),
            layDanhSachCashTransactions()
        ]);

        const safeOrders = Array.isArray(orders) ? orders : [];
        const safeTables = Array.isArray(tables) ? tables : [];
        const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
        const safeDetails = Array.isArray(detailsRes) ? detailsRes : [];
        const safeCashTx = Array.isArray(cashTx) ? cashTx : [];

        const now = Date.now();

        // 1. Kiểm tra nguyên liệu sắp hết kho (stock <= 5)
        const lowStockIngredients = safeIngredients.filter((ing: any) => {
            const stock = Number(ing.stock_quantity) || 0;
            const threshold = Number(ing.min_threshold) || 5;
            return stock <= threshold;
        });

        // 2. Kiểm tra món chế biến bị trễ SLA (> 10 phút)
        const delayedCookingItems = safeDetails.filter((d: any) => {
            if (d.status !== 'Cooking' && d.status !== 'Pending') return false;
            const created = new Date(d.createdAt).getTime();
            return (now - created) > 10 * 60 * 1000;
        });

        // 3. Tỷ lệ bàn đang có khách (Occupied / Waiting_Payment)
        const occupiedTables = safeTables.filter((t: any) => t.status === 'Occupied' || t.status === 'Waiting_Payment');
        const occupancyRate = safeTables.length > 0 ? Math.round((occupiedTables.length / safeTables.length) * 100) : 0;

        // 4. Phiếu chi tiền két hôm nay (Cash Out)
        const todayCashOut = safeCashTx.filter((tx: any) => {
            if (tx.type !== 'CASH_OUT') return false;
            const txDate = new Date(tx.createdAt || Date.now());
            return txDate.toDateString() === new Date().toDateString();
        });
        const totalCashOut = todayCashOut.reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

        // Render Alert Banner
        let alertPillsHtml = '';

        // Pill Kho cạn
        if (lowStockIngredients.length > 0) {
            alertPillsHtml += `
                <button id="alert-pill-inventory" class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer" title="Bấm để xem danh sách nguyên liệu thiếu">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <i class="fa-solid fa-boxes-stacked"></i>
                    <span>Kho cạn: ${lowStockIngredients.length} nguyên liệu sắp hết!</span>
                    <i class="fa-solid fa-arrow-right text-[10px] ml-1"></i>
                </button>
            `;
        }

        // Pill Bếp trễ SLA
        if (delayedCookingItems.length > 0) {
            alertPillsHtml += `
                <button id="alert-pill-kitchen" class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer" title="Bấm để kiểm tra tiến độ bếp">
                    <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    <i class="fa-solid fa-fire-burner"></i>
                    <span>Bếp trễ SLA: ${delayedCookingItems.length} món > 10 phút!</span>
                </button>
            `;
        }

        // Pill Lấp đầy bàn
        alertPillsHtml += `
            <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold">
                <i class="fa-solid fa-chair"></i>
                <span>Bàn phục vụ: ${occupiedTables.length}/${tables.length} (${occupancyRate}%)</span>
            </div>
        `;

        // Pill Tiền chi két
        if (totalCashOut > 0) {
            alertPillsHtml += `
                <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-bold">
                    <i class="fa-solid fa-money-bill-transfer"></i>
                    <span>Đã chi tiền két: ${totalCashOut.toLocaleString('vi-VN')}đ (${todayCashOut.length} phiếu)</span>
                </div>
            `;
        }

        alertBanner.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3 bg-white/95 border border-slate-200 p-3.5 px-5 rounded-2xl shadow-sm mb-6 backdrop-blur">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-tower-broadcast animate-pulse"></i>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">Giám sát Vận hành Trực tiếp</div>
                        <div class="text-sm font-black text-slate-900">Tình trạng Quán Hiện tại</div>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    ${alertPillsHtml}
                </div>
            </div>
        `;

        // Click pills to jump
        document.getElementById('alert-pill-inventory')?.addEventListener('click', () => {
            if (typeof (window as any).switchPage === 'function') {
                (window as any).switchPage('inventory');
            }
        });

    } catch (e) {
        console.error("Lỗi khi quét Live Ops Alerts:", e);
    }
};

// ==========================================
// 2. GÓI 1: BROADCAST ANNOUNCEMENT MODAL
// ==========================================
export const initBroadcastModal = () => {
    const modal = document.getElementById('modal-admin-broadcast');
    const openBtn = document.getElementById('btn-open-broadcast-modal');
    const closeBtn = document.getElementById('btn-close-broadcast-modal');
    const cancelBtn = document.getElementById('btn-cancel-broadcast-modal');
    const form = document.getElementById('form-admin-broadcast') as HTMLFormElement;

    const openModal = () => {
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    const closeModal = () => {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        form?.reset();
    };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = (document.getElementById('broadcast-title') as HTMLInputElement).value.trim();
        const message = (document.getElementById('broadcast-message') as HTMLTextAreaElement).value.trim();
        const priority = (document.getElementById('broadcast-priority') as HTMLSelectElement).value; // 'info' | 'warning' | 'urgent'
        const targetAudience = (document.getElementById('broadcast-target') as HTMLSelectElement).value; // 'all' | 'kitchen' | 'front'

        if (!title || !message) {
            showWarningToast('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo!');
            return;
        }

        const payload = {
            type: 'ADMIN_ANNOUNCEMENT',
            targetAudience,
            title,
            message,
            priority,
            sender: 'Ban Quản Trị FoodHub',
            timestamp: new Date().toISOString()
        };

        // Gửi tới tất cả các kênh (kdsChannel dùng chung giữa bếp, phục vụ và thu ngân)
        kdsChannel.postMessage(payload);
        waiterChannel.postMessage(payload);
        cashierChannel.postMessage(payload);

        // Ghi Audit Log
        const severity = priority === 'urgent' ? 'danger' : (priority === 'warning' ? 'warning' : 'info');
        await ghiAuditLog('system', 'Phát loa thông báo toàn hệ thống', `[${priority.toUpperCase()}] ${title}: ${message}`, 'Quản trị viên (Admin)', severity);

        showSuccessToast('Đã phát thông báo khẩn tới toàn bộ nhân viên thành công!');
        closeModal();
    });
};

// ==========================================
// 3. GÓI 3: ACTIVITY AUDIT LOG (NHẬT KÝ KIỂM TOÁN)
// ==========================================
export const loadAuditLogs = async () => {
    try {
        const [savedLogs, orders, cashTx, detailsRes] = await Promise.all([
            layDanhSachAuditLogs(),
            layTatCaDonHang(),
            layDanhSachCashTransactions(),
            fetch(API_ORDER_DETAILS_URL).then(r => r.ok ? r.json() : []).then(j => Array.isArray(j) ? j : (j.data || []))
        ]);

        const safeSavedLogs = Array.isArray(savedLogs) ? savedLogs : [];
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safeCashTx = Array.isArray(cashTx) ? cashTx : [];
        const safeDetails = Array.isArray(detailsRes) ? detailsRes : [];

        const synthesizedLogs: any[] = [...safeSavedLogs];

        // Tổng hợp log từ Đơn hàng có Giảm giá / Khuyến mãi
        safeOrders.forEach((o: any) => {
            if (o.discountAmount && o.discountAmount > 0) {
                const voucherCode = o.voucherCode ? ` (Mã: ${o.voucherCode})` : '';
                synthesizedLogs.push({
                    id: `SYNTH_ORD_${o.id}`,
                    timestamp: o.createdAt || new Date().toISOString(),
                    category: 'financial',
                    actor: 'Thu Ngân',
                    action: 'Áp dụng giảm giá hóa đơn',
                    detail: `Hóa đơn #${o.id} được giảm ${Number(o.discountAmount).toLocaleString('vi-VN')}đ${voucherCode}. Tổng thanh toán: ${Number(o.totalAmount).toLocaleString('vi-VN')}đ`,
                    severity: 'info'
                });
            }
        });

        // Tổng hợp log từ Phiếu Thu/Chi tiền két
        safeCashTx.forEach((tx: any) => {
            const isOut = tx.type === 'CASH_OUT';
            synthesizedLogs.push({
                id: `SYNTH_TX_${tx.id}`,
                timestamp: tx.createdAt || new Date().toISOString(),
                category: 'financial',
                actor: tx.performedBy || 'Thu Ngân',
                action: isOut ? 'Chi tiền mặt từ két (Cash Out)' : 'Nạp tiền vào két (Cash In)',
                detail: `${isOut ? 'Xuất' : 'Nạp'} số tiền ${Number(tx.amount).toLocaleString('vi-VN')}đ. Lý do: ${tx.reason || 'Chi nội bộ'}`,
                severity: isOut ? 'warning' : 'info'
            });
        });

        // Tổng hợp log từ Món bị hủy (Cancelled)
        safeDetails.forEach((d: any) => {
            if (d.status === 'Cancelled' && d.incidentNote) {
                synthesizedLogs.push({
                    id: `SYNTH_CANCEL_${d.id}`,
                    timestamp: d.createdAt || new Date().toISOString(),
                    category: 'order',
                    actor: 'Nhà Bếp / Phục vụ',
                    action: 'Hủy món do sự cố',
                    detail: `Hủy phần ăn #${d.id} (Số lượng: ${d.quantity}). Lý do: ${d.incidentNote}`,
                    severity: 'danger'
                });
            }
        });

        // Sort mới nhất lên đầu
        synthesizedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        allAuditLogs = synthesizedLogs;
        updateAuditStats();
        updateAuditCardStyles();
        renderAuditLogsTable();

    } catch (e) {
        console.error("Lỗi khi tải Audit Logs:", e);
    }
};

const updateAuditStats = () => {
    const totalEl = document.getElementById('stat-audit-total');
    const finEl = document.getElementById('stat-audit-financial');
    const orderEl = document.getElementById('stat-audit-orders');
    const secEl = document.getElementById('stat-audit-security');

    const total = allAuditLogs.length;
    const fin = allAuditLogs.filter(l => l.category === 'financial').length;
    const ord = allAuditLogs.filter(l => l.category === 'order').length;
    const sec = allAuditLogs.filter(l => l.category === 'security' || l.category === 'system').length;

    if (totalEl) totalEl.innerText = String(total);
    if (finEl) finEl.innerText = String(fin);
    if (orderEl) orderEl.innerText = String(ord);
    if (secEl) secEl.innerText = String(sec);
};

export const updateAuditCardStyles = () => {
    const configs = [
        { id: 'card-audit-total', filter: 'all', activeBorder: 'border-orange-500/80 ring-2 ring-orange-500/20' },
        { id: 'card-audit-financial', filter: 'financial', activeBorder: 'border-emerald-500/80 ring-2 ring-emerald-500/20' },
        { id: 'card-audit-orders', filter: 'order', activeBorder: 'border-blue-500/80 ring-2 ring-blue-500/20' },
        { id: 'card-audit-security', filter: 'security', activeBorder: 'border-purple-500/80 ring-2 ring-purple-500/20' },
    ];

    configs.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        if (!el) return;
        const isSelected = currentAuditCategory === cfg.filter;
        const indicator = el.querySelector('.audit-card-indicator');

        if (isSelected) {
            el.className = `audit-stat-card cursor-pointer p-5 rounded-2xl border ${cfg.activeBorder} bg-orange-50/50 shadow-sm transition-all duration-200 scale-[1.02] select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'audit-card-indicator text-[10px] font-bold text-orange-500 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-check text-[9px]"></i> Đang lọc';
            }
        } else {
            el.className = `audit-stat-card cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-slate-400 active:scale-95 select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'audit-card-indicator text-[10px] font-bold text-slate-400 group-hover:text-slate-600 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-filter text-[9px]"></i> Lọc';
            }
        }
    });
};

const getCategoryBadge = (cat: string) => {
    switch (cat) {
        case 'financial':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">💰 Tài chính</span>`;
        case 'order':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">🍽️ Đơn hàng</span>`;
        case 'inventory':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">📦 Kho hàng</span>`;
        case 'security':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30">🛡️ Bảo mật</span>`;
        default:
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">⚙️ Hệ thống</span>`;
    }
};

const getSeverityIcon = (sev: string) => {
    switch (sev) {
        case 'danger':
            return `<span class="text-red-500" title="Nghiêm trọng"><i class="fa-solid fa-circle-exclamation"></i></span>`;
        case 'warning':
            return `<span class="text-amber-400" title="Cảnh báo"><i class="fa-solid fa-triangle-exclamation"></i></span>`;
        default:
            return `<span class="text-blue-400" title="Thông tin"><i class="fa-solid fa-circle-info"></i></span>`;
    }
};

const renderAuditLogsTable = () => {
    const tbody = document.getElementById('audit-table-tbody');
    if (!tbody) return;

    let filtered = [...allAuditLogs];

    // Lọc theo Category
    if (currentAuditCategory !== 'all') {
        filtered = filtered.filter(l => l.category === currentAuditCategory);
    }

    // Lọc theo từ khóa tìm kiếm
    if (auditSearchKeyword.trim()) {
        const kw = auditSearchKeyword.trim().toLowerCase();
        filtered = filtered.filter(l => 
            (l.action || '').toLowerCase().includes(kw) ||
            (l.detail || '').toLowerCase().includes(kw) ||
            (l.actor || '').toLowerCase().includes(kw)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-slate-400">
                    <i class="fa-solid fa-clipboard-check text-4xl mb-2 text-slate-600 block"></i>
                    Không có nhật ký nào được ghi nhận
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.slice(0, 100).forEach(l => {
        const timeStr = l.timestamp ? new Date(l.timestamp).toLocaleString('vi-VN') : 'Vừa xong';

        html += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200 text-xs">
                <td class="p-4 text-center">${getSeverityIcon(l.severity)}</td>
                <td class="p-4 font-mono text-slate-500 whitespace-nowrap">${timeStr}</td>
                <td class="p-4 whitespace-nowrap">${getCategoryBadge(l.category)}</td>
                <td class="p-4 font-bold text-slate-700 whitespace-nowrap">${l.actor || 'Hệ thống'}</td>
                <td class="p-4 font-bold text-slate-900 whitespace-nowrap">${l.action}</td>
                <td class="p-4 text-slate-600 leading-relaxed">${l.detail}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

// ==========================================
// 4. GÓI 3: FULL SYSTEM BACKUP & EXPORT
// ==========================================
export const exportFullSystemBackupJSON = async () => {
    try {
        showSuccessToast('Đang tạo bản sao lưu dữ liệu toàn hệ thống...');
        const [orders, detailsRes, menu, categories, ingredients, recipes, users, tables, vouchers, customers, auditLogs] = await Promise.all([
            layTatCaDonHang(),
            fetch(API_ORDER_DETAILS_URL).then(r => r.ok ? r.json() : []).then(j => Array.isArray(j) ? j : (j.data || [])),
            layDanhSachMonAn(),
            layDanhSachBan(),
            layDanhSachIngredients(),
            layDanhSachRecipes(),
            layDanhSachNguoiDung(),
            layDanhSachBan(),
            layDanhSachVouchers(),
            layDanhSachCustomers(),
            layDanhSachAuditLogs()
        ]);

        const fullBackup = {
            metadata: {
                appName: 'FoodHub POS Restaurant',
                version: '2.5.0',
                exportedAt: new Date().toISOString(),
                exportBy: 'Admin'
            },
            data: {
                Orders: orders,
                OrderDetails: detailsRes,
                MenuItems: menu,
                Categories: categories,
                Ingredients: ingredients,
                Recipes: recipes,
                Users: users,
                Tables: tables,
                Vouchers: vouchers,
                Customers: customers,
                AuditLogs: auditLogs
            }
        };

        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", jsonStr);
        downloadAnchor.setAttribute("download", `FoodHub_Backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        await ghiAuditLog('system', 'Sao lưu hệ thống JSON', 'Tải bản sao lưu toàn bộ dữ liệu hệ thống', 'Quản trị viên (Admin)', 'info');
        showSuccessToast('Đã xuất bản sao lưu JSON thành công!');
    } catch (e) {
        console.error(e);
        showWarningToast('Lỗi khi tạo bản sao lưu hệ thống');
    }
};

// ==========================================
// INITIALIZATION
// ==========================================
export const initAdminAuditOps = () => {
    // 1. Live Ops Banner & Broadcast Modal
    scanAndRenderLiveOpsAlerts();
    initBroadcastModal();

    // 2. Audit Category Filter Buttons
    document.querySelectorAll('.btn-audit-cat-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const cat = target.getAttribute('data-cat') || 'all';
            currentAuditCategory = cat;

            document.querySelectorAll('.btn-audit-cat-filter').forEach(b => {
                b.className = 'btn-audit-cat-filter px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 cursor-pointer';
            });
            target.className = 'btn-audit-cat-filter px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-orange-500 text-white shadow-md shadow-orange-500/20';

            updateAuditCardStyles();
            renderAuditLogsTable();
        });
    });

    // 2.1 Tương tác lọc từ 4 thẻ thống kê AUDIT LOGS
    const auditCardConfigs = [
        { id: 'card-audit-total', filter: 'all' },
        { id: 'card-audit-financial', filter: 'financial' },
        { id: 'card-audit-orders', filter: 'order' },
        { id: 'card-audit-security', filter: 'security' },
    ];
    auditCardConfigs.forEach(c => {
        document.getElementById(c.id)?.addEventListener('click', () => {
            if (currentAuditCategory === c.filter && c.filter !== 'all') {
                currentAuditCategory = 'all';
            } else {
                currentAuditCategory = c.filter as any;
            }

            // Sync nút bấm
            document.querySelectorAll('.btn-audit-cat-filter').forEach(b => {
                const bCat = b.getAttribute('data-cat');
                if (bCat === currentAuditCategory) {
                    b.className = 'btn-audit-cat-filter px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-orange-500 text-white shadow-md shadow-orange-500/20';
                } else {
                    b.className = 'btn-audit-cat-filter px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 cursor-pointer';
                }
            });

            updateAuditCardStyles();
            renderAuditLogsTable();
        });
    });

    // 3. Audit Search
    const searchInput = document.getElementById('input-audit-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
        auditSearchKeyword = (e.target as HTMLInputElement).value || '';
        renderAuditLogsTable();
    });

    // 4. Refresh Button
    document.getElementById('btn-refresh-audit')?.addEventListener('click', async () => {
        showSuccessToast('Đang làm mới nhật ký...');
        await loadAuditLogs();
        showSuccessToast('Đã đồng bộ nhật ký mới nhất!');
    });

    // 5. System Backup Button
    document.getElementById('btn-export-backup-json')?.addEventListener('click', () => {
        exportFullSystemBackupJSON();
    });
};
