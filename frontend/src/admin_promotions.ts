import { 
    layDanhSachVouchers, taoVoucher, suaVoucher, xoaVoucher,
    layDanhSachCustomers, taoCustomer, suaCustomer, xoaCustomer,
    ghiAuditLog
} from './api';
import { showConfirmModal, showSuccessToast, showWarningToast } from './utils/ui';

// ==========================================
// STATE
// ==========================================
let allVouchers: any[] = [];
let allCustomers: any[] = [];
let currentPromotionsTab: 'vouchers' | 'vip' = 'vouchers';
let voucherSearchKeyword = '';
let customerSearchKeyword = '';
let currentEditingVoucherId: string | null = null;
let currentEditingCustomerId: string | null = null;
let currentAdjustingCustomer: any = null;
let currentVoucherCardFilter: 'all' | 'active' | 'inactive' | 'used' = 'all';
let currentCustomerCardFilter: 'all' | 'Diamond' | 'Gold' | 'Silver' = 'all';

let voucherSortCol = 'code';
let voucherSortAsc = true;

let customerSortCol = 'spent';
let customerSortAsc = false;

// ==========================================
// 1. QUẢN LÝ VOUCHERS / KHUYẾN MÃI
// ==========================================
export const loadVouchers = async () => {
    try {
        allVouchers = await layDanhSachVouchers();
        updateVoucherStats();
        updateVoucherCardStyles();
        renderVouchersTable();
    } catch (e) {
        console.error("Lỗi khi tải vouchers:", e);
    }
};

const updateVoucherStats = () => {
    const totalEl = document.getElementById('stat-voucher-total');
    const activeEl = document.getElementById('stat-voucher-active');
    const inactiveEl = document.getElementById('stat-voucher-inactive');
    const usedEl = document.getElementById('stat-voucher-used');

    const total = allVouchers.length;
    const active = allVouchers.filter(v => v.status === 'Active').length;
    const inactive = total - active;
    const totalUsed = allVouchers.reduce((sum, v) => sum + (Number(v.usedCount) || 0), 0);

    if (totalEl) totalEl.innerText = String(total);
    if (activeEl) activeEl.innerText = String(active);
    if (inactiveEl) inactiveEl.innerText = String(inactive);
    if (usedEl) usedEl.innerText = String(totalUsed);
};

export const updateVoucherCardStyles = () => {
    const configs = [
        { id: 'card-voucher-total', filter: 'all', activeBorder: 'border-orange-500/80 ring-2 ring-orange-500/20' },
        { id: 'card-voucher-active', filter: 'active', activeBorder: 'border-emerald-500/80 ring-2 ring-emerald-500/20' },
        { id: 'card-voucher-inactive', filter: 'inactive', activeBorder: 'border-slate-400/80 ring-2 ring-slate-400/20' },
        { id: 'card-voucher-used', filter: 'used', activeBorder: 'border-blue-500/80 ring-2 ring-blue-500/20' },
    ];

    configs.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        if (!el) return;
        const isSelected = currentVoucherCardFilter === cfg.filter;
        const indicator = el.querySelector('.v-card-indicator');

        if (isSelected) {
            el.className = `voucher-stat-card cursor-pointer p-5 rounded-2xl border ${cfg.activeBorder} bg-orange-50/50 shadow-sm transition-all duration-200 scale-[1.02] select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'v-card-indicator text-[10px] font-bold text-orange-500 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-check text-[9px]"></i> Đang lọc';
            }
        } else {
            el.className = `voucher-stat-card cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-slate-400 active:scale-95 select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'v-card-indicator text-[10px] font-bold text-slate-400 group-hover:text-slate-600 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-filter text-[9px]"></i> Lọc';
            }
        }
    });
};

const renderVouchersTable = () => {
    const tbody = document.getElementById('vouchers-table-tbody');
    if (!tbody) return;

    let filtered = [...allVouchers];

    if (currentVoucherCardFilter === 'active') {
        filtered = filtered.filter(v => v.status === 'Active');
    } else if (currentVoucherCardFilter === 'inactive') {
        filtered = filtered.filter(v => v.status !== 'Active');
    } else if (currentVoucherCardFilter === 'used') {
        filtered = filtered.filter(v => Number(v.usedCount) > 0);
        filtered.sort((a, b) => (Number(b.usedCount) || 0) - (Number(a.usedCount) || 0));
    }

    if (voucherSearchKeyword.trim()) {
        const kw = voucherSearchKeyword.trim().toLowerCase();
        filtered = filtered.filter(v => 
            (v.code || '').toLowerCase().includes(kw) ||
            (v.name || '').toLowerCase().includes(kw)
        );
    }

    filtered.sort((a, b) => {
        let res = 0;
        if (voucherSortCol === 'code') {
            res = (a.code || '').localeCompare(b.code || '');
        } else if (voucherSortCol === 'name') {
            res = (a.name || '').localeCompare(b.name || '', 'vi');
        } else if (voucherSortCol === 'value') {
            res = Number(a.value || 0) - Number(b.value || 0);
        } else if (voucherSortCol === 'used') {
            res = Number(a.usedCount || 0) - Number(b.usedCount || 0);
        } else if (voucherSortCol === 'status') {
            res = (a.status || '').localeCompare(b.status || '');
        }
        return voucherSortAsc ? res : -res;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-600 font-bold">
                    <i class="fa-solid fa-tags text-4xl mb-2 text-slate-500 block"></i>
                    Không tìm thấy chương trình khuyến mãi nào
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(v => {
        const isPercent = v.type === 'percentage';
        const discountStr = isPercent ? `-${v.value}%` : `-${Number(v.value).toLocaleString('vi-VN')}đ`;
        const maxStr = isPercent && v.maxDiscount ? ` (Tối đa ${Number(v.maxDiscount).toLocaleString('vi-VN')}đ)` : '';
        const minOrderStr = v.minOrderValue ? `Đơn từ ${Number(v.minOrderValue).toLocaleString('vi-VN')}đ` : 'Mọi đơn hàng';
        const isActive = v.status === 'Active';
        const dateRange = (v.startDate && v.endDate) ? `${v.startDate} ➔ ${v.endDate}` : 'Không thời hạn';
        const usageStr = `${v.usedCount || 0} / ${v.usageLimit ? v.usageLimit : '∞'}`;

        html += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200">
                <td class="p-4 whitespace-nowrap">
                    <span class="font-mono font-black text-sm px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg border border-orange-200 whitespace-nowrap">
                        ${v.code}
                    </span>
                </td>
                <td class="p-4 font-bold text-slate-900 whitespace-nowrap">${v.name}</td>
                <td class="p-4 whitespace-nowrap">
                    <div class="font-black text-emerald-700 whitespace-nowrap">${discountStr}<span class="text-xs text-slate-500 font-normal">${maxStr}</span></div>
                    <div class="text-xs text-slate-500 whitespace-nowrap">${minOrderStr}</div>
                </td>
                <td class="p-4 text-xs font-mono text-slate-600 whitespace-nowrap">${dateRange}</td>
                <td class="p-4 text-xs font-bold text-slate-700 font-mono whitespace-nowrap">${usageStr}</td>
                <td class="p-4 whitespace-nowrap">
                    <button data-id="${v.id}" data-status="${v.status}" class="btn-toggle-voucher-status px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
                        ${isActive ? '🟢 Đang áp dụng' : '⚪ Tạm ngưng'}
                    </button>
                </td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button data-id="${v.id}" class="btn-edit-voucher w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Chỉnh sửa voucher ${v.code}">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button data-id="${v.id}" data-code="${v.code}" class="btn-delete-voucher w-8 h-8 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Tạm ngưng voucher ${v.code}">
                            <i class="fa-solid fa-eye-slash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    attachVoucherEvents();
};

const attachVoucherEvents = () => {
    // Toggle Status
    document.querySelectorAll('.btn-toggle-voucher-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            const currentStatus = target.getAttribute('data-status');
            if (!id) return;

            const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
            target.disabled = true;
            try {
                await suaVoucher(id, { status: newStatus });
                const v = allVouchers.find(x => String(x.id) === String(id));
                if (v) v.status = newStatus;
                ghiAuditLog('financial', 'Đổi trạng thái Voucher', `Đổi trạng thái mã "${v?.code}" sang ${newStatus}`);
                showSuccessToast(`Đã chuyển trạng thái sang "${newStatus === 'Active' ? 'Đang áp dụng' : 'Tạm ngưng'}"!`);
                updateVoucherStats();
                renderVouchersTable();
            } catch (err) {
                showWarningToast('Lỗi khi đổi trạng thái');
            }
        });
    });

    // Edit
    document.querySelectorAll('.btn-edit-voucher').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            if (!id) return;
            openVoucherModal(id);
        });
    });

    // Delete
    document.querySelectorAll('.btn-delete-voucher').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            const code = target.getAttribute('data-code');
            if (!id) return;

            const ok = await showConfirmModal(
                'Tạm ngưng Voucher',
                `Bạn có chắc chắn muốn tạm ngưng áp dụng mã khuyến mãi "${code}"?\n(Mã sẽ tạm ngưng áp dụng nhưng lịch sử các đơn hàng trước đó vẫn được bảo toàn nguyên vẹn).`,
                { okText: 'Tạm ngưng', cancelText: 'Hủy bỏ', type: 'warning' }
            );
            if (!ok) return;

            target.disabled = true;
            try {
                await xoaVoucher(id);
                const v = allVouchers.find(x => String(x.id) === String(id));
                if (v) v.status = 'Inactive';
                ghiAuditLog('financial', 'Tạm ngưng Voucher', `Tạm ngưng mã voucher "${code}" (ID: ${id})`);
                showSuccessToast(`Đã tạm ngưng áp dụng mã "${code}"!`);
                updateVoucherStats();
                renderVouchersTable();
            } catch (err) {
                showWarningToast('Lỗi khi tạm ngưng voucher');
            } finally {
                target.disabled = false;
            }
        });
    });
};

const openVoucherModal = (voucherId: string | null = null) => {
    currentEditingVoucherId = voucherId;
    const modal = document.getElementById('modal-admin-voucher');
    const titleEl = document.getElementById('voucher-modal-title');
    const form = document.getElementById('form-admin-voucher') as HTMLFormElement;
    if (!modal || !form) return;

    if (voucherId) {
        const v = allVouchers.find(x => String(x.id) === String(voucherId));
        if (!v) return;
        if (titleEl) titleEl.innerText = `Chỉnh sửa Voucher: ${v.code}`;
        (document.getElementById('input-voucher-code') as HTMLInputElement).value = v.code || '';
        (document.getElementById('input-voucher-name') as HTMLInputElement).value = v.name || '';
        (document.getElementById('select-voucher-type') as HTMLSelectElement).value = v.type || 'percentage';
        (document.getElementById('input-voucher-value') as HTMLInputElement).value = String(v.value || 0);
        (document.getElementById('input-voucher-max') as HTMLInputElement).value = String(v.maxDiscount || '');
        (document.getElementById('input-voucher-min-order') as HTMLInputElement).value = String(v.minOrderValue || '');
        (document.getElementById('input-voucher-limit') as HTMLInputElement).value = String(v.usageLimit || '');
        (document.getElementById('input-voucher-start') as HTMLInputElement).value = v.startDate || '';
        (document.getElementById('input-voucher-end') as HTMLInputElement).value = v.endDate || '';
        (document.getElementById('select-voucher-status') as HTMLSelectElement).value = v.status || 'Active';
    } else {
        if (titleEl) titleEl.innerText = 'Tạo Chương Trình Khuyến Mãi Mới';
        form.reset();
        (document.getElementById('input-voucher-code') as HTMLInputElement).value = `PROMO${Math.floor(100 + Math.random() * 900)}`;
        (document.getElementById('select-voucher-status') as HTMLSelectElement).value = 'Active';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

const closeVoucherModal = () => {
    const modal = document.getElementById('modal-admin-voucher');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentEditingVoucherId = null;
};

// ==========================================
// 2. QUẢN LÝ KHÁCH HÀNG THÂN THIẾT (VIP LOYALTY)
// ==========================================
export const loadCustomers = async () => {
    try {
        allCustomers = await layDanhSachCustomers();
        updateCustomerStats();
        updateCustomerCardStyles();
        renderCustomersTable();
    } catch (e) {
        console.error("Lỗi khi tải danh sách khách hàng VIP:", e);
    }
};

const updateCustomerStats = () => {
    const totalEl = document.getElementById('stat-cust-total');
    const diamondEl = document.getElementById('stat-cust-diamond');
    const goldEl = document.getElementById('stat-cust-gold');
    const silverEl = document.getElementById('stat-cust-silver');

    const total = allCustomers.length;
    const diamond = allCustomers.filter(c => c.tier === 'Diamond').length;
    const gold = allCustomers.filter(c => c.tier === 'Gold').length;
    const silver = allCustomers.filter(c => c.tier === 'Silver' || c.tier === 'Bronze').length;

    if (totalEl) totalEl.innerText = String(total);
    if (diamondEl) diamondEl.innerText = String(diamond);
    if (goldEl) goldEl.innerText = String(gold);
    if (silverEl) silverEl.innerText = String(silver);
};

export const updateCustomerCardStyles = () => {
    const configs = [
        { id: 'card-cust-total', filter: 'all', activeBorder: 'border-orange-500/80 ring-2 ring-orange-500/20' },
        { id: 'card-cust-diamond', filter: 'Diamond', activeBorder: 'border-cyan-500/80 ring-2 ring-cyan-500/20' },
        { id: 'card-cust-gold', filter: 'Gold', activeBorder: 'border-amber-500/80 ring-2 ring-amber-500/20' },
        { id: 'card-cust-silver', filter: 'Silver', activeBorder: 'border-slate-400/80 ring-2 ring-slate-400/20' },
    ];

    configs.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        if (!el) return;
        const isSelected = currentCustomerCardFilter === cfg.filter;
        const indicator = el.querySelector('.cust-card-indicator');

        if (isSelected) {
            el.className = `cust-stat-card cursor-pointer p-5 rounded-2xl border ${cfg.activeBorder} bg-orange-50/50 shadow-sm transition-all duration-200 scale-[1.02] select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'cust-card-indicator text-[10px] font-bold text-orange-500 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-check text-[9px]"></i> Đang lọc';
            }
        } else {
            el.className = `cust-stat-card cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-slate-400 active:scale-95 select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'cust-card-indicator text-[10px] font-bold text-slate-400 group-hover:text-slate-600 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-filter text-[9px]"></i> Lọc';
            }
        }
    });
};

const getTierBadge = (tier: string) => {
    switch (tier) {
        case 'Diamond':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-50 text-cyan-800 border border-cyan-200">💎 Kim Cương</span>`;
        case 'Gold':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">🥇 Vàng</span>`;
        case 'Silver':
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-300">🥈 Bạc</span>`;
        default:
            return `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 text-orange-800 border border-orange-200">🥉 Đồng</span>`;
    }
};

const renderCustomersTable = () => {
    const tbody = document.getElementById('customers-table-tbody');
    if (!tbody) return;

    let filtered = [...allCustomers];

    if (currentCustomerCardFilter === 'Diamond') {
        filtered = filtered.filter(c => c.tier === 'Diamond');
    } else if (currentCustomerCardFilter === 'Gold') {
        filtered = filtered.filter(c => c.tier === 'Gold');
    } else if (currentCustomerCardFilter === 'Silver') {
        filtered = filtered.filter(c => c.tier === 'Silver' || c.tier === 'Bronze');
    }

    if (customerSearchKeyword.trim()) {
        const kw = customerSearchKeyword.trim().toLowerCase();
        filtered = filtered.filter(c => 
            (c.name || '').toLowerCase().includes(kw) ||
            (c.phone || '').includes(kw) ||
            (c.email || '').toLowerCase().includes(kw)
        );
    }

    filtered.sort((a, b) => {
        let res = 0;
        if (customerSortCol === 'name') {
            res = (a.name || '').localeCompare(b.name || '', 'vi');
        } else if (customerSortCol === 'phone') {
            res = (a.phone || '').localeCompare(b.phone || '');
        } else if (customerSortCol === 'rank') {
            res = (a.tier || '').localeCompare(b.tier || '');
        } else if (customerSortCol === 'points') {
            res = Number(a.points || 0) - Number(b.points || 0);
        } else if (customerSortCol === 'spent') {
            res = Number(a.totalSpent || 0) - Number(b.totalSpent || 0);
        }
        return customerSortAsc ? res : -res;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-slate-600 font-bold">
                    <i class="fa-solid fa-crown text-4xl mb-2 text-slate-500 block"></i>
                    Không tìm thấy hội viên phù hợp
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(c => {
        const spentStr = Number(c.totalSpent || 0).toLocaleString('vi-VN') + 'đ';
        const points = Number(c.points || 0);

        html += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200">
                <td class="p-4 whitespace-nowrap">
                    <div class="font-bold text-slate-900 text-base whitespace-nowrap">${c.name}</div>
                    <div class="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap mt-0.5">
                        <span class="font-mono text-slate-400 font-bold">#${c.id}</span>
                        <span>•</span>
                        <span>${c.email || 'Chưa có email'}</span>
                    </div>
                </td>
                <td class="p-4 font-mono font-bold text-sm text-slate-700 whitespace-nowrap">${c.phone}</td>
                <td class="p-4 whitespace-nowrap">${getTierBadge(c.tier)}</td>
                <td class="p-4 whitespace-nowrap">
                    <div class="flex items-center gap-2 whitespace-nowrap">
                        <span class="font-black text-amber-700 text-base font-mono whitespace-nowrap">${points.toLocaleString('vi-VN')} điểm</span>
                        <button data-id="${c.id}" class="btn-adjust-points w-8 h-8 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Cộng / Trừ điểm cho ${c.name}">
                            <i class="fa-solid fa-sliders text-xs"></i>
                        </button>
                    </div>
                </td>
                <td class="p-4 font-bold text-emerald-700 font-mono whitespace-nowrap">${spentStr}</td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button data-id="${c.id}" class="btn-edit-customer w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Chỉnh sửa hội viên ${c.name}">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button data-id="${c.id}" data-name="${c.name}" class="btn-delete-customer w-8 h-8 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Tạm ngưng hội viên ${c.name}">
                            <i class="fa-solid fa-user-slash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    attachCustomerEvents();
};

const attachCustomerEvents = () => {
    // Points adjust
    document.querySelectorAll('.btn-adjust-points').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            const cust = allCustomers.find(c => String(c.id) === String(id));
            if (!cust) return;
            openAdjustPointsModal(cust);
        });
    });

    // Edit
    document.querySelectorAll('.btn-edit-customer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            if (id) openCustomerModal(id);
        });
    });

    // Delete
    document.querySelectorAll('.btn-delete-customer').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const id = target.getAttribute('data-id');
            const name = target.getAttribute('data-name');
            if (!id) return;

            const ok = await showConfirmModal(
                'Tạm ngưng tài khoản hội viên',
                `Bạn có chắc chắn muốn tạm ngưng hoạt động hội viên "${name}"?\n(Dữ liệu điểm tích lũy và lịch sử giao dịch vẫn được lưu giữ an toàn).`,
                { okText: 'Tạm ngưng', cancelText: 'Hủy bỏ', type: 'warning' }
            );
            if (!ok) return;

            target.disabled = true;
            try {
                await xoaCustomer(id);
                const c = allCustomers.find(item => String(item.id) === String(id));
                if (c) c.status = 'Inactive';
                ghiAuditLog('security', 'Tạm ngưng Hội Viên VIP', `Đã tạm ngưng hội viên "${name}" (ID: ${id})`);
                showSuccessToast(`Đã tạm ngưng hội viên "${name}" thành công!`);
                updateCustomerStats();
                renderCustomersTable();
            } catch (err) {
                showWarningToast('Lỗi khi cập nhật khách hàng');
            } finally {
                target.disabled = false;
            }
        });
    });
};

const openCustomerModal = (custId: string | null = null) => {
    currentEditingCustomerId = custId;
    const modal = document.getElementById('modal-admin-customer');
    const titleEl = document.getElementById('customer-modal-title');
    const form = document.getElementById('form-admin-customer') as HTMLFormElement;
    if (!modal || !form) return;

    if (custId) {
        const c = allCustomers.find(x => String(x.id) === String(custId));
        if (!c) return;
        if (titleEl) titleEl.innerText = `Chỉnh sửa Hội Viên: ${c.name}`;
        (document.getElementById('input-cust-name') as HTMLInputElement).value = c.name || '';
        (document.getElementById('input-cust-phone') as HTMLInputElement).value = c.phone || '';
        (document.getElementById('input-cust-email') as HTMLInputElement).value = c.email || '';
        (document.getElementById('select-cust-tier') as HTMLSelectElement).value = c.tier || 'Bronze';
        (document.getElementById('input-cust-points') as HTMLInputElement).value = String(c.points || 0);
        (document.getElementById('input-cust-spent') as HTMLInputElement).value = String(c.totalSpent || 0);
    } else {
        if (titleEl) titleEl.innerText = 'Thêm Hội Viên VIP Mới';
        form.reset();
        (document.getElementById('select-cust-tier') as HTMLSelectElement).value = 'Silver';
        (document.getElementById('input-cust-points') as HTMLInputElement).value = '100';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

const closeCustomerModal = () => {
    const modal = document.getElementById('modal-admin-customer');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentEditingCustomerId = null;
};

const openAdjustPointsModal = (cust: any) => {
    currentAdjustingCustomer = cust;
    const modal = document.getElementById('modal-adjust-points');
    const infoEl = document.getElementById('adjust-points-cust-info');
    if (!modal) return;

    if (infoEl) {
        infoEl.innerHTML = `<strong>${cust.name}</strong> (${cust.phone}) • Điểm hiện tại: <span class="text-amber-400 font-bold">${cust.points || 0} điểm</span>`;
    }
    (document.getElementById('input-adjust-points-num') as HTMLInputElement).value = '50';
    (document.getElementById('input-adjust-points-reason') as HTMLInputElement).value = 'Tặng điểm tri ân khách hàng';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

const closeAdjustPointsModal = () => {
    const modal = document.getElementById('modal-adjust-points');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentAdjustingCustomer = null;
};

// ==========================================
// INITIALIZATION
// ==========================================
export const initAdminPromotions = () => {
    // 1. Sub-tab switching (Vouchers vs VIP)
    const btnTabVouchers = document.getElementById('btn-subtab-vouchers');
    const btnTabVip = document.getElementById('btn-subtab-vip');
    const viewVouchers = document.getElementById('subview-vouchers');
    const viewVip = document.getElementById('subview-vip');

    btnTabVouchers?.addEventListener('click', () => {
        currentPromotionsTab = 'vouchers';
        btnTabVouchers.className = 'px-5 py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer';
        btnTabVip!.className = 'px-5 py-2.5 rounded-xl font-bold text-sm bg-transparent text-slate-600 hover:text-slate-900 transition-all cursor-pointer';
        viewVouchers?.classList.remove('hidden');
        viewVip?.classList.add('hidden');
        loadVouchers();
    });

    btnTabVip?.addEventListener('click', () => {
        currentPromotionsTab = 'vip';
        btnTabVip.className = 'px-5 py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer';
        btnTabVouchers!.className = 'px-5 py-2.5 rounded-xl font-bold text-sm bg-transparent text-slate-600 hover:text-slate-900 transition-all cursor-pointer';
        viewVip?.classList.remove('hidden');
        viewVouchers?.classList.add('hidden');
        loadCustomers();
    });

    // 2. Voucher Controls
    const voucherSearch = document.getElementById('input-voucher-search') as HTMLInputElement;
    voucherSearch?.addEventListener('input', (e) => {
        voucherSearchKeyword = (e.target as HTMLInputElement).value || '';
        renderVouchersTable();
    });

    document.getElementById('btn-add-voucher')?.addEventListener('click', () => openVoucherModal());
    document.getElementById('btn-close-voucher-modal')?.addEventListener('click', closeVoucherModal);
    document.getElementById('btn-cancel-voucher-modal')?.addEventListener('click', closeVoucherModal);

    // Save Voucher Form
    const formVoucher = document.getElementById('form-admin-voucher') as HTMLFormElement;
    formVoucher?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = (document.getElementById('input-voucher-code') as HTMLInputElement).value.trim().toUpperCase();
        const name = (document.getElementById('input-voucher-name') as HTMLInputElement).value.trim();
        const type = (document.getElementById('select-voucher-type') as HTMLSelectElement).value;
        const value = Number((document.getElementById('input-voucher-value') as HTMLInputElement).value) || 0;
        const maxDiscount = Number((document.getElementById('input-voucher-max') as HTMLInputElement).value) || 0;
        const minOrderValue = Number((document.getElementById('input-voucher-min-order') as HTMLInputElement).value) || 0;
        const usageLimit = Number((document.getElementById('input-voucher-limit') as HTMLInputElement).value) || 100;
        const startDate = (document.getElementById('input-voucher-start') as HTMLInputElement).value;
        const endDate = (document.getElementById('input-voucher-end') as HTMLInputElement).value;
        const status = (document.getElementById('select-voucher-status') as HTMLSelectElement).value;

        if (!code || !name || value <= 0) {
            showWarningToast('Vui lòng điền đầy đủ mã, tên và giá trị giảm hợp lệ!');
            return;
        }

        if (type === 'percentage' && value > 50) {
            showWarningToast('Mức giảm giá phần trăm của Voucher không được vượt quá 50%!');
            return;
        }

        const voucherData = {
            code,
            name,
            type,
            value,
            maxDiscount: maxDiscount || undefined,
            minOrderValue: minOrderValue || undefined,
            usageLimit: usageLimit || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status
        };

        try {
            if (currentEditingVoucherId) {
                await suaVoucher(currentEditingVoucherId, voucherData);
                const idx = allVouchers.findIndex(x => String(x.id) === String(currentEditingVoucherId));
                if (idx !== -1) allVouchers[idx] = { ...allVouchers[idx], ...voucherData };
                ghiAuditLog('financial', 'Chỉnh sửa Voucher', `Chỉnh sửa thông tin mã "${code}"`);
                showSuccessToast(`Đã cập nhật mã "${code}" thành công!`);
            } else {
                const newVoucher = { id: `V_${Date.now()}`, usedCount: 0, ...voucherData };
                await taoVoucher(newVoucher);
                allVouchers.unshift(newVoucher);
                ghiAuditLog('financial', 'Tạo Voucher mới', `Tạo mới mã khuyến mãi "${code}" (${name})`);
                showSuccessToast(`Đã tạo mới mã "${code}" thành công!`);
            }
            closeVoucherModal();
            updateVoucherStats();
            renderVouchersTable();
        } catch (err) {
            showWarningToast('Có lỗi xảy ra khi lưu voucher');
        }
    });

    // 3. Customer Controls
    const custSearch = document.getElementById('input-cust-search') as HTMLInputElement;
    custSearch?.addEventListener('input', (e) => {
        customerSearchKeyword = (e.target as HTMLInputElement).value || '';
        renderCustomersTable();
    });

    document.getElementById('btn-add-customer')?.addEventListener('click', () => openCustomerModal());
    document.getElementById('btn-close-cust-modal')?.addEventListener('click', closeCustomerModal);
    document.getElementById('btn-cancel-cust-modal')?.addEventListener('click', closeCustomerModal);

    // Save Customer Form
    const formCust = document.getElementById('form-admin-customer') as HTMLFormElement;
    formCust?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('input-cust-name') as HTMLInputElement).value.trim();
        const phone = (document.getElementById('input-cust-phone') as HTMLInputElement).value.trim();
        const email = (document.getElementById('input-cust-email') as HTMLInputElement).value.trim();
        const tier = (document.getElementById('select-cust-tier') as HTMLSelectElement).value;
        const points = Number((document.getElementById('input-cust-points') as HTMLInputElement).value) || 0;
        const totalSpent = Number((document.getElementById('input-cust-spent') as HTMLInputElement).value) || 0;

        if (!name || !phone) {
            showWarningToast('Họ tên và Số điện thoại là bắt buộc!');
            return;
        }

        const custData = { name, phone, email, tier, points, totalSpent };

        try {
            if (currentEditingCustomerId) {
                await suaCustomer(currentEditingCustomerId, custData);
                const idx = allCustomers.findIndex(x => String(x.id) === String(currentEditingCustomerId));
                if (idx !== -1) allCustomers[idx] = { ...allCustomers[idx], ...custData };
                ghiAuditLog('security', 'Cập nhật Hội Viên', `Cập nhật thông tin hội viên "${name}" (${phone})`);
                showSuccessToast(`Đã cập nhật thông tin hội viên "${name}"!`);
            } else {
                const newCust = {
                    id: `CUST_${Date.now().toString().slice(-4)}`,
                    registeredAt: new Date().toISOString().split('T')[0],
                    lastVisit: new Date().toISOString(),
                    ...custData
                };
                await taoCustomer(newCust);
                allCustomers.unshift(newCust);
                ghiAuditLog('security', 'Thêm Hội Viên Mới', `Đăng ký hội viên mới "${name}" (${phone})`);
                showSuccessToast(`Đã thêm hội viên "${name}" thành công!`);
            }
            closeCustomerModal();
            updateCustomerStats();
            renderCustomersTable();
        } catch (err) {
            showWarningToast('Có lỗi xảy ra khi lưu hội viên');
        }
    });

    // Adjust Points Form
    document.getElementById('btn-close-adjust-points-modal')?.addEventListener('click', closeAdjustPointsModal);
    document.getElementById('btn-cancel-adjust-points')?.addEventListener('click', closeAdjustPointsModal);
    
    document.getElementById('btn-confirm-adjust-points')?.addEventListener('click', async () => {
        if (!currentAdjustingCustomer) return;
        const type = (document.getElementById('select-adjust-points-type') as HTMLSelectElement).value; // 'add' | 'subtract'
        const pointsDiff = Number((document.getElementById('input-adjust-points-num') as HTMLInputElement).value) || 0;
        const reason = (document.getElementById('input-adjust-points-reason') as HTMLInputElement).value.trim() || 'Điều chỉnh thủ công';

        if (pointsDiff <= 0) {
            showWarningToast('Số điểm điều chỉnh phải lớn hơn 0!');
            return;
        }

        const oldPoints = Number(currentAdjustingCustomer.points) || 0;
        const newPoints = type === 'add' ? oldPoints + pointsDiff : Math.max(0, oldPoints - pointsDiff);

        try {
            await suaCustomer(currentAdjustingCustomer.id, { points: newPoints });
            currentAdjustingCustomer.points = newPoints;
            const sign = type === 'add' ? `+${pointsDiff}` : `-${pointsDiff}`;
            ghiAuditLog('financial', 'Điều chỉnh Điểm VIP', `Điều chỉnh điểm cho ${currentAdjustingCustomer.name} (${sign} điểm). Lý do: ${reason}`);
            showSuccessToast(`Đã điều chỉnh điểm cho ${currentAdjustingCustomer.name} thành công! (${sign} điểm)`);
            closeAdjustPointsModal();
            renderCustomersTable();
        } catch (e) {
            showWarningToast('Lỗi khi cập nhật điểm');
        }
    });

    // Tương tác lọc từ 4 thẻ thống kê VOUCHER
    const vCardConfigs = [
        { id: 'card-voucher-total', filter: 'all' },
        { id: 'card-voucher-active', filter: 'active' },
        { id: 'card-voucher-inactive', filter: 'inactive' },
        { id: 'card-voucher-used', filter: 'used' },
    ];
    vCardConfigs.forEach(c => {
        document.getElementById(c.id)?.addEventListener('click', () => {
            if (currentVoucherCardFilter === c.filter && c.filter !== 'all') {
                currentVoucherCardFilter = 'all';
            } else {
                currentVoucherCardFilter = c.filter as any;
            }
            updateVoucherCardStyles();
            renderVouchersTable();
        });
    });

    // Tương tác lọc từ 4 thẻ thống kê CUSTOMER VIP
    const custCardConfigs = [
        { id: 'card-cust-total', filter: 'all' },
        { id: 'card-cust-diamond', filter: 'Diamond' },
        { id: 'card-cust-gold', filter: 'Gold' },
        { id: 'card-cust-silver', filter: 'Silver' },
    ];
    custCardConfigs.forEach(c => {
        document.getElementById(c.id)?.addEventListener('click', () => {
            if (currentCustomerCardFilter === c.filter && c.filter !== 'all') {
                currentCustomerCardFilter = 'all';
            } else {
                currentCustomerCardFilter = c.filter as any;
            }
            updateCustomerCardStyles();
            renderCustomersTable();
        });
    });

    setupVoucherSorting();
    setupCustomerSorting();

    // Initial load
    loadVouchers();
};

function setupVoucherSorting() {
    document.querySelectorAll<HTMLElement>('[data-v-sort]').forEach(th => {
        th.onclick = () => {
            const col = th.getAttribute('data-v-sort') || 'code';
            if (voucherSortCol === col) {
                voucherSortAsc = !voucherSortAsc;
            } else {
                voucherSortCol = col;
                voucherSortAsc = (col === 'value' || col === 'used' ? false : true);
            }
            document.querySelectorAll<HTMLElement>('[data-v-sort]').forEach(h => {
                const icon = h.querySelector('i');
                const hCol = h.getAttribute('data-v-sort');
                if (icon) {
                    if (hCol === voucherSortCol) {
                        icon.className = voucherSortAsc ? 'fa-solid fa-sort-up text-[10px] ml-1 text-slate-900' : 'fa-solid fa-sort-down text-[10px] ml-1 text-slate-900';
                    } else {
                        icon.className = 'fa-solid fa-sort text-[10px] ml-1 opacity-60';
                    }
                }
            });
            renderVouchersTable();
        };
    });
}

function setupCustomerSorting() {
    document.querySelectorAll<HTMLElement>('[data-cust-sort]').forEach(th => {
        th.onclick = () => {
            const col = th.getAttribute('data-cust-sort') || 'spent';
            if (customerSortCol === col) {
                customerSortAsc = !customerSortAsc;
            } else {
                customerSortCol = col;
                customerSortAsc = (col === 'points' || col === 'spent' ? false : true);
            }
            document.querySelectorAll<HTMLElement>('[data-cust-sort]').forEach(h => {
                const icon = h.querySelector('i');
                const hCol = h.getAttribute('data-cust-sort');
                if (icon) {
                    if (hCol === customerSortCol) {
                        icon.className = customerSortAsc ? 'fa-solid fa-sort-up text-[10px] ml-1 text-slate-900' : 'fa-solid fa-sort-down text-[10px] ml-1 text-slate-900';
                    } else {
                        icon.className = 'fa-solid fa-sort text-[10px] ml-1 opacity-60';
                    }
                }
            });
            renderCustomersTable();
        };
    });
}
