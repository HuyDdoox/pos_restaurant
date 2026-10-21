import { showConfirmModal, showSuccessToast, showWarningToast } from './utils/ui';
import { 
    layDanhSachBan, capNhatTrangThaiBan, capNhatDonHang, taoCaLamViec, 
    ketThucCaLamViec, layThongTinCaLamViec, layCaHienTai, layChiTietCuaDon, layDanhSachMonAn, layDanhSachHoaDonChuaThanhToan, 
    taoChiTietDonHang, layTatCaDonHang, layTatCaChiTietDon, capNhatChiTietDonHang, 
    xoaChiTietDonHang, taoDonHang, layDanhSachNguyenLieu, layTatCaCongThuc, layDanhSachDanhMuc,
    layDanhSachCashTransactions, taoCashTransaction, chuyenBanDonHang 
} from './api';
import { deductInventoryForOrder } from './inventory_engine';
import { MenuItem } from './interfaces';
import { getCurrentUser, requireAuth, logout } from './auth';

// Kiểm tra bắt buộc đăng nhập trước khi sử dụng POS Thu ngân
const currentAuthUser = requireAuth(['Cashier', 'Admin']);

declare const Chart: any;

let currentShiftId = localStorage.getItem('current_shift_id');
if (currentShiftId && !/^[0-9a-fA-F]{24}$/.test(currentShiftId)) {
    localStorage.removeItem('current_shift_id');
    currentShiftId = null;
}
let unpaidOrders: any[] = [];
let menuItems: MenuItem[] = [];
let selectedOrder: any = null;
let activeOrderDetails: any[] = [];

// Kênh đồng bộ thời gian thực KDS / Phục vụ / Khách hàng
const kdsChannel = new BroadcastChannel('foodhub_kds');
let tablesRequestedBill = new Set<string>();

kdsChannel.onmessage = (event) => {
    if (event.data.type === 'REQUEST_CHECKOUT') {
        const { tableId, tableName, method, time } = event.data;
        tablesRequestedBill.add(String(tableId));
        showWarningToast(`💳 ${tableName} yêu cầu tính tiền [${method}] (${time})!`);
        renderTableMap();
    } else if (event.data.type === 'CUSTOMER_ORDERED') {
        renderTableMap();
    } else if (event.data.type === 'TABLE_MOVED') {
        renderTableMap();
    } else if (event.data.type === 'ADMIN_ANNOUNCEMENT') {
        if (!event.data.targetAudience || event.data.targetAudience === 'all' || event.data.targetAudience === 'front') {
            const prefix = event.data.priority === 'urgent' ? '🚨 [KHẨN CẤP]' : '📢 [LOA QUẢN LÝ]';
            showWarningToast(`${prefix} ${event.data.title}: ${event.data.message}`);
        }
    }
};

// ==========================================
// HÀM TIỆN ÍCH TRÍCH XUẤT DỮ LIỆU CHUẨN XÁC
// ==========================================
export const getDetailOrderId = (d: any): string => {
    if (!d || !d.order_id) return '';
    if (typeof d.order_id === 'object' && d.order_id !== null) {
        return String(d.order_id._id || d.order_id.id || '');
    }
    return String(d.order_id);
};

export const getDetailMenuItemId = (d: any): string => {
    if (!d || !d.menuItem_id) return '';
    if (typeof d.menuItem_id === 'object' && d.menuItem_id !== null) {
        return String(d.menuItem_id._id || d.menuItem_id.id || '');
    }
    return String(d.menuItem_id);
};

export const getDetailMenuItem = (d: any, items: any[] = []): any => {
    if (!d) return null;
    if (typeof d.menuItem_id === 'object' && d.menuItem_id !== null && d.menuItem_id.name) {
        return d.menuItem_id;
    }
    const mid = getDetailMenuItemId(d);
    return items.find(m => String(m.id || m._id) === mid) || null;
};

export const getOrderTableDisplay = (order: any, tables: any[] = []): string => {
    if (!order) return 'Mang về';
    if (order.table_id) {
        if (typeof order.table_id === 'object' && order.table_id !== null) {
            if (order.table_id.tableNumber) return `Bàn ${order.table_id.tableNumber}`;
            if (order.table_id.name) return String(order.table_id.name);
            const tid = String(order.table_id._id || order.table_id.id || '');
            if (tid) {
                const found = tables.find((t: any) => String(t.id || t._id) === tid);
                if (found) return `Bàn ${found.tableNumber}`;
            }
        } else {
            const tid = String(order.table_id);
            const found = tables.find((t: any) => String(t.id || t._id) === tid);
            if (found) return `Bàn ${found.tableNumber}`;
            const num = parseInt(tid.replace(/\D/g, ''), 10);
            if (!isNaN(num)) return `Bàn ${num < 10 ? '0' + num : num}`;
        }
    }
    if (order.customerInfo && typeof order.customerInfo === 'string') {
        const ci = order.customerInfo.trim();
        if (/khách\s+bàn/i.test(ci)) {
            const clean = ci.replace(/khách\s+/i, '');
            return clean.charAt(0).toUpperCase() + clean.slice(1);
        }
        if (/mang\s+về|takeaway/i.test(ci)) return 'Mang về';
        if (ci.length > 0) return ci;
    }
    return 'Mang về';
};

export const getCashierOrderTableId = (order: any): string => {
    if (!order) return '';
    const tid = order.table_id;
    if (!tid) return '';
    if (typeof tid === 'object' && tid !== null) {
        return String(tid._id || tid.id || '');
    }
    return String(tid);
};

export const getCashierOrderTableNumber = (order: any, tables: any[] = []): string => {
    if (!order) return '';
    const tid = order.table_id;
    if (typeof tid === 'object' && tid !== null) {
        if (tid.tableNumber) return String(tid.tableNumber);
        if (tid.name) return String(tid.name).replace(/\D/g, '');
        const idStr = String(tid._id || tid.id || '');
        const found = tables.find((t: any) => String(t.id || t._id) === idStr);
        if (found && found.tableNumber) return String(found.tableNumber);
    } else if (typeof tid === 'string') {
        const found = tables.find((t: any) => String(t.id || t._id) === tid || String(t.tableNumber) === tid);
        if (found && found.tableNumber) return String(found.tableNumber);
        const num = tid.replace(/\D/g, '');
        if (num) return num;
    }
    if (order.customerInfo && typeof order.customerInfo === 'string') {
        const match = order.customerInfo.match(/bàn\s*(\d+)/i);
        if (match) return match[1];
    }
    return '';
};

export const isOrderForTable = (order: any, table: any): boolean => {
    if (!order || !table) return false;
    const tableId = typeof table === 'object' ? String(table.id || table._id || '') : String(table);
    const tableNum = typeof table === 'object' ? String(table.tableNumber || '') : (String(table).replace(/\D/g, '') || String(table));
    
    const ordTableId = getCashierOrderTableId(order);
    if (ordTableId && tableId && ordTableId === tableId) return true;
    
    const ordTableNum = getCashierOrderTableNumber(order);
    if (ordTableNum && tableNum) {
        if (ordTableNum === tableNum) return true;
        const p1 = parseInt(ordTableNum, 10);
        const p2 = parseInt(tableNum, 10);
        if (!isNaN(p1) && !isNaN(p2) && p1 === p2) return true;
    }
    if (ordTableId && tableNum && ordTableId === tableNum) return true;
    if (ordTableNum && tableId && ordTableNum === tableId) return true;
    
    return false;
};

// ==========================================
// CẤU HÌNH THUẾ, CHIẾT KHẤU & PHÍ DỊCH VỤ
// ==========================================
let currentDiscountType: 'percent' | 'amount' | 'voucher' = 'percent';
let currentDiscountPercent = 0;
let currentDiscountFixedAmount = 0;
let currentDiscountVoucherCode = '';
let currentDiscountReason = '';
let currentServiceChargeRate = 0; // 0 hoặc 0.05 (5%)
let currentVatRate = 0.08;        // 0 hoặc 0.08 (8%)

let calculatedSubtotal = 0;
let calculatedDiscountAmount = 0;
let calculatedServiceCharge = 0;
let calculatedVatAmount = 0;
let calculatedFinalTotal = 0;

// Voucher mẫu sẵn có trong hệ thống
const AVAILABLE_VOUCHERS = [
    { code: 'VIP10', name: 'Thành viên VIP Bạc', type: 'percent', value: 10, minOrder: 0, desc: 'Giảm 10% tổng hóa đơn' },
    { code: 'VIP15', name: 'Thành viên VIP Vàng', type: 'percent', value: 15, minOrder: 300000, desc: 'Giảm 15% cho đơn từ 300k' },
    { code: 'VIP20', name: 'Thành viên VIP Kim Cương', type: 'percent', value: 20, minOrder: 500000, desc: 'Giảm 20% cho đơn từ 500k' },
    { code: 'GIAM50K', name: 'Voucher Chào Bạn Mới', type: 'amount', value: 50000, minOrder: 200000, desc: 'Giảm 50.000 đ đơn từ 200k' },
    { code: 'GIAM100K', name: 'Tri ân khách hàng', type: 'amount', value: 100000, minOrder: 600000, desc: 'Giảm 100.000 đ đơn từ 600k' },
    { code: 'SINHNHAT', name: 'Ưu đãi Sinh nhật', type: 'percent', value: 15, minOrder: 0, desc: 'Giảm 15% mừng sinh nhật khách' },
    { code: 'HAPPYHOUR', name: 'Khung giờ Vàng (14h-17h)', type: 'percent', value: 10, minOrder: 150000, desc: 'Giảm 10% khung giờ trưa' }
];

// State cho Chuyển Bàn
let selectedTransferTargetTableId: string | null = null;

// State cho Phiếu Thu / Chi Két
let currentCashTransType: 'in' | 'out' = 'in';

// State cho Tách Hóa Đơn
let splitBillAItems: any[] = [];
let splitBillBItems: any[] = [];
let splitMode: 'items' | 'equal' = 'items';
let equalShareCount = 2;
let equalPaidShares: number[] = [];

// State cho Gộp Hóa Đơn
let mergeCandidateOrders: any[] = [];
let selectedMergeOrderIds: string[] = [];

const TABLES = Array.from({ length: 15 }, (_, i) => `T${(i + 1).toString().padStart(3, '0')}`);

const formatMoney = (amount: number): string => {
    return Math.round(amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// ==========================================
// QUẢN LÝ CA LÀM VIỆC (SHIFT MANAGEMENT)
// ==========================================
const setupShiftUI = async () => {
    if (!currentShiftId) {
        try {
            const activeShift = await layCaHienTai();
            if (activeShift && (activeShift._id || activeShift.id)) {
                currentShiftId = String(activeShift._id || activeShift.id);
                localStorage.setItem('current_shift_id', currentShiftId);
            }
        } catch (e) {
            console.error("Lỗi lấy ca hiện tại:", e);
        }
    }
    const overlay = document.getElementById('overlay-shift');
    const mainWorkspace = document.getElementById('main-workspace');
    const shiftPill = document.getElementById('shift-status-pill');

    if (currentShiftId) {
        overlay?.classList.add('hidden');
        overlay?.classList.remove('flex');
        mainWorkspace?.classList.remove('hidden');
        if (shiftPill) {
            const shortShift = currentShiftId.length > 8 ? currentShiftId.slice(-4).toUpperCase() : currentShiftId;
            shiftPill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span> <span class="truncate font-mono">Ca #${shortShift}</span> <span class="text-[9px] opacity-80">(Mở)</span>`;
            shiftPill.title = `Ca làm việc #${currentShiftId}`;
            shiftPill.className = "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 whitespace-nowrap shrink-0";
        }
        loadDashboard();
    } else {
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');
        mainWorkspace?.classList.add('hidden');
        if (shiftPill) {
            shiftPill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span> <span class="truncate">Chưa mở ca</span>`;
            shiftPill.className = "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-700 text-slate-400 bg-slate-800 whitespace-nowrap shrink-0";
        }
    }
};

document.getElementById('btn-show-close-shift')?.addEventListener('click', () => {
    const overlay = document.getElementById('overlay-shift');
    overlay?.classList.remove('hidden');
    overlay?.classList.add('flex');
    const title = document.getElementById('shift-modal-title');
    if (title) title.innerText = "Đóng ca làm việc";
    const desc = document.getElementById('shift-modal-desc');
    if (desc) desc.innerText = "Vui lòng nhập số tiền thực tế trong két để chốt ca và in Z-Report.";
    const btnCancel = document.getElementById('btn-cancel-shift');
    if (btnCancel) btnCancel.classList.remove('hidden');
});

document.getElementById('btn-overview-close-shift')?.addEventListener('click', () => {
    document.getElementById('btn-show-close-shift')?.click();
});

document.getElementById('btn-cancel-shift')?.addEventListener('click', () => {
    document.getElementById('overlay-shift')?.classList.add('hidden');
    document.getElementById('overlay-shift')?.classList.remove('flex');
});

document.getElementById('btn-submit-shift')?.addEventListener('click', async () => {
    const amount = Number((document.getElementById('input-shift-cash') as HTMLInputElement).value);
    if (isNaN(amount) || amount < 0) {
        showWarningToast("Vui lòng nhập số tiền hợp lệ!");
        return;
    }

    if (currentShiftId) {
        let startingCash = 0;
        try {
            const shiftInfo = await layThongTinCaLamViec(currentShiftId);
            if (shiftInfo) startingCash = Number(shiftInfo.startingCash || 0);
        } catch (e) {
            console.error("Lỗi lấy thông tin ca:", e);
        }

        const allOrders = await layTatCaDonHang();
        const paidOrders = allOrders.filter((o: any) => o.paymentStatus === 'Paid' || o.status === 'Completed');
        const cashOrders = paidOrders.filter((o: any) => o.paymentMethod === 'cash' || !o.paymentMethod);
        const transferOrders = paidOrders.filter((o: any) => o.paymentMethod === 'transfer');

        const cashSales = cashOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
        const transferSales = transferOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
        const totalSales = cashSales + transferSales;

        const transactions = await layDanhSachCashTransactions(currentShiftId);
        let totalCashIn = 0;
        let totalCashOut = 0;
        transactions.forEach((t: any) => {
            const amt = Number(t.amount || 0);
            if (t.type === 'in') totalCashIn += amt;
            else if (t.type === 'out') totalCashOut += amt;
        });

        const expectedCash = startingCash + cashSales + totalCashIn - totalCashOut;
        const endingCash = amount;
        const diff = endingCash - expectedCash;

        await ketThucCaLamViec(currentShiftId, { 
            endTime: new Date().toISOString(), 
            endingCash: endingCash,
            expectedCash: expectedCash,
            difference: diff,
            cashSales: cashSales,
            transferSales: transferSales,
            totalSales: totalSales,
            totalCashIn: totalCashIn,
            totalCashOut: totalCashOut,
            status: "Closed" 
        });

        const closedShiftId = currentShiftId;
        localStorage.removeItem('current_shift_id');
        currentShiftId = null;

        document.getElementById('overlay-shift')?.classList.add('hidden');
        document.getElementById('overlay-shift')?.classList.remove('flex');

        showSuccessToast("Đã đóng ca làm việc thành công!");

        showZReport({
            shiftId: closedShiftId,
            startingCash,
            endingCash,
            expectedCash,
            diff,
            cashSales,
            transferSales,
            totalSales,
            totalCashIn,
            totalCashOut,
            transactions
        });

        setupShiftUI();
    } else {
        const ca = await taoCaLamViec({ 
            startTime: new Date().toISOString(), 
            startingCash: amount, 
            status: "Open" 
        });
        localStorage.setItem('current_shift_id', ca.id);
        currentShiftId = ca.id;
        showSuccessToast("Mở ca làm việc thành công!");
        setupShiftUI();
    }
});

// ==========================================
// TÍNH TOÁN CHIẾT KHẤU, VAT & PHÍ DỊCH VỤ
// ==========================================
const calculateBillTotals = () => {
    if (!selectedOrder) return;

    // 1. Tạm tính (Subtotal)
    calculatedSubtotal = activeOrderDetails
        .filter(d => d.status !== 'Cancelled' && d.status !== 'cancelled')
        .reduce((sum, d) => sum + ((d.priceAtOrder || 0) * (d.quantity || 1)), 0);

    // 2. Chiết khấu (Discount)
    if (currentDiscountType === 'percent') {
        calculatedDiscountAmount = Math.round(calculatedSubtotal * (currentDiscountPercent / 100));
    } else if (currentDiscountType === 'amount') {
        calculatedDiscountAmount = Math.min(calculatedSubtotal, currentDiscountFixedAmount);
    } else if (currentDiscountType === 'voucher') {
        const matched = AVAILABLE_VOUCHERS.find(v => v.code === currentDiscountVoucherCode);
        if (matched) {
            if (matched.type === 'percent') {
                calculatedDiscountAmount = Math.round(calculatedSubtotal * (matched.value / 100));
            } else {
                calculatedDiscountAmount = Math.min(calculatedSubtotal, matched.value);
            }
        } else {
            calculatedDiscountAmount = Math.round(calculatedSubtotal * (currentDiscountPercent / 100));
        }
    }
    calculatedDiscountAmount = Math.max(0, Math.min(calculatedSubtotal, calculatedDiscountAmount));

    const afterDiscount = Math.max(0, calculatedSubtotal - calculatedDiscountAmount);

    // 3. Phí dịch vụ (Service Charge)
    calculatedServiceCharge = Math.round(afterDiscount * currentServiceChargeRate);

    // 4. Thuế VAT
    calculatedVatAmount = Math.round((afterDiscount + calculatedServiceCharge) * currentVatRate);

    // 5. Tổng thanh toán cuối cùng (Final Total)
    calculatedFinalTotal = afterDiscount + calculatedServiceCharge + calculatedVatAmount;

    // Cập nhật DOM
    const subtotalEl = document.getElementById('detail-subtotal');
    if (subtotalEl) subtotalEl.innerText = `${formatMoney(calculatedSubtotal)} đ`;

    const discountEl = document.getElementById('detail-discount-display');
    if (discountEl) discountEl.innerText = `-${formatMoney(calculatedDiscountAmount)} đ`;

    const discountBadge = document.getElementById('detail-discount-badge');
    if (discountBadge) {
        if (calculatedDiscountAmount > 0) {
            discountBadge.classList.remove('hidden');
            let label = '';
            if (currentDiscountVoucherCode) {
                label = `Voucher: ${currentDiscountVoucherCode}`;
            } else if (currentDiscountType === 'percent') {
                label = `Giảm ${currentDiscountPercent}%`;
            } else {
                label = `Giảm ${formatMoney(currentDiscountFixedAmount)}đ`;
            }
            discountBadge.innerText = label;
        } else {
            discountBadge.classList.add('hidden');
        }
    }

    const taxSurchargeEl = document.getElementById('detail-tax-surcharge');
    if (taxSurchargeEl) {
        const taxTotal = calculatedServiceCharge + calculatedVatAmount;
        taxSurchargeEl.innerText = `+${formatMoney(taxTotal)} đ`;
    }

    const totalEl = document.getElementById('detail-total-amount');
    if (totalEl) totalEl.innerHTML = `${formatMoney(calculatedFinalTotal)} <span class="text-base">đ</span>`;

    // Đồng bộ lại vào selectedOrder để lưu vào DB khi thanh toán
    selectedOrder.subtotal = calculatedSubtotal;
    selectedOrder.discountAmount = calculatedDiscountAmount;
    selectedOrder.discountPercent = currentDiscountType === 'percent' ? currentDiscountPercent : 0;
    selectedOrder.discountType = currentDiscountType;
    selectedOrder.voucherCode = currentDiscountVoucherCode;
    selectedOrder.discountReason = currentDiscountReason;
    selectedOrder.serviceChargeAmount = calculatedServiceCharge;
    selectedOrder.vatAmount = calculatedVatAmount;
    selectedOrder.totalAmount = calculatedFinalTotal;
};

// Gắn sự kiện cho các nút giảm giá nhanh (0%, 5%, 10%, 20%)
const setupDiscountAndTaxListeners = () => {
    document.querySelectorAll('.btn-discount-quick').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const pct = Number(target.getAttribute('data-discount') || '0');
            currentDiscountType = 'percent';
            currentDiscountPercent = pct;
            currentDiscountFixedAmount = 0;
            currentDiscountVoucherCode = '';
            currentDiscountReason = pct > 0 ? `Giảm nhanh ${pct}%` : '';

            document.querySelectorAll('.btn-discount-quick').forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white');
                b.classList.add('text-slate-400');
            });
            target.classList.remove('text-slate-400');
            target.classList.add('bg-orange-500', 'text-white');

            calculateBillTotals();
        });
    });

    const chkService = document.getElementById('chk-service-charge') as HTMLInputElement;
    if (chkService) {
        chkService.addEventListener('change', () => {
            currentServiceChargeRate = chkService.checked ? 0.05 : 0;
            calculateBillTotals();
        });
    }

    const chkVat = document.getElementById('chk-vat') as HTMLInputElement;
    if (chkVat) {
        chkVat.addEventListener('change', () => {
            currentVatRate = chkVat.checked ? 0.08 : 0;
            calculateBillTotals();
        });
    }
};

// ==========================================
// TÍNH NĂNG 1: KHUYẾN MÃI / VOUCHER MODAL
// ==========================================
const setupDiscountModalEvents = () => {
    const btnOpen = document.getElementById('btn-open-discount-modal');
    const overlay = document.getElementById('overlay-discount');
    const btnClose = document.getElementById('btn-close-discount');
    const btnCancel = document.getElementById('btn-cancel-discount');
    const btnRemove = document.getElementById('btn-remove-discount');
    const btnApplyCustom = document.getElementById('btn-apply-custom-discount');
    const voucherListEl = document.getElementById('discount-voucher-list');
    const currentDescEl = document.getElementById('discount-current-desc');

    const updateDiscountSummary = () => {
        if (!currentDescEl) return;
        if (calculatedDiscountAmount > 0) {
            let desc = '';
            if (currentDiscountVoucherCode) {
                desc = `Voucher [${currentDiscountVoucherCode}] - ${currentDiscountReason} (-${formatMoney(calculatedDiscountAmount)} đ)`;
            } else if (currentDiscountType === 'percent') {
                desc = `Chiết khấu ${currentDiscountPercent}%: ${currentDiscountReason || 'Ưu đãi'} (-${formatMoney(calculatedDiscountAmount)} đ)`;
            } else {
                desc = `Giảm trực tiếp ${formatMoney(currentDiscountFixedAmount)} đ: ${currentDiscountReason || 'Ưu đãi'} (-${formatMoney(calculatedDiscountAmount)} đ)`;
            }
            currentDescEl.innerText = desc;
        } else {
            currentDescEl.innerText = "Chưa áp dụng (0 đ)";
        }
    };

    const renderVouchers = () => {
        if (!voucherListEl) return;
        const subtotal = calculatedSubtotal;

        let html = '';
        AVAILABLE_VOUCHERS.forEach(v => {
            const isEligible = subtotal >= v.minOrder;
            const isApplied = currentDiscountVoucherCode === v.code;
            const valDisplay = v.type === 'percent' ? `Giảm ${v.value}%` : `Giảm ${formatMoney(v.value)} đ`;

            html += `
                <div class="voucher-card p-3 rounded-2xl border transition-all cursor-pointer relative ${
                    isApplied 
                        ? 'border-orange-500 bg-orange-500/10 shadow-md shadow-orange-500/10' 
                        : isEligible 
                            ? 'border-slate-700 bg-[#0f172a] hover:border-orange-500/50 hover:bg-slate-800/60' 
                            : 'border-slate-800 bg-[#0f172a]/40 opacity-50 cursor-not-allowed'
                }" data-voucher-code="${v.code}">
                    <div class="flex justify-between items-start mb-1">
                        <div>
                            <span class="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                isApplied ? 'bg-orange-500 text-white' : 'bg-slate-800 text-orange-400 border border-orange-500/30'
                            }">${v.code}</span>
                            <h5 class="text-xs font-bold text-white mt-1">${v.name}</h5>
                        </div>
                        <span class="text-xs font-black text-emerald-400">${valDisplay}</span>
                    </div>
                    <p class="text-[11px] text-slate-400">${v.desc}</p>
                    ${v.minOrder > 0 ? `<p class="text-[10px] text-slate-500 mt-1 italic">Đơn tối thiểu: ${formatMoney(v.minOrder)} đ</p>` : ''}
                    ${isApplied ? '<div class="absolute top-2 right-2 text-orange-400 text-xs"><i class="fa-solid fa-circle-check"></i> Đang dùng</div>' : ''}
                </div>
            `;
        });
        voucherListEl.innerHTML = html;

        voucherListEl.querySelectorAll('.voucher-card').forEach(card => {
            card.addEventListener('click', () => {
                const code = card.getAttribute('data-voucher-code');
                const v = AVAILABLE_VOUCHERS.find(item => item.code === code);
                if (!v) return;

                if (calculatedSubtotal < v.minOrder) {
                    showWarningToast(`Hóa đơn cần tối thiểu ${formatMoney(v.minOrder)} đ để dùng voucher này!`);
                    return;
                }

                currentDiscountType = 'voucher';
                currentDiscountVoucherCode = v.code;
                currentDiscountReason = v.name;
                if (v.type === 'percent') {
                    currentDiscountPercent = v.value;
                    currentDiscountFixedAmount = 0;
                } else {
                    currentDiscountFixedAmount = v.value;
                    currentDiscountPercent = 0;
                }

                // Reset quick buttons
                document.querySelectorAll('.btn-discount-quick').forEach(b => {
                    b.classList.remove('bg-orange-500', 'text-white');
                    b.classList.add('text-slate-400');
                });

                calculateBillTotals();
                updateDiscountSummary();
                showSuccessToast(`Đã áp dụng voucher ${v.code}!`);
                closeModal();
            });
        });
    };

    const openModal = () => {
        if (!selectedOrder) {
            showWarningToast("Vui lòng chọn bàn có đơn hàng trước!");
            return;
        }
        updateDiscountSummary();
        renderVouchers();
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');
    };

    const closeModal = () => {
        overlay?.classList.add('hidden');
        overlay?.classList.remove('flex');
    };

    btnOpen?.addEventListener('click', openModal);
    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);

    btnRemove?.addEventListener('click', () => {
        currentDiscountType = 'percent';
        currentDiscountPercent = 0;
        currentDiscountFixedAmount = 0;
        currentDiscountVoucherCode = '';
        currentDiscountReason = '';

        document.querySelectorAll('.btn-discount-quick').forEach(b => {
            b.classList.remove('bg-orange-500', 'text-white');
            b.classList.add('text-slate-400');
        });
        const zeroBtn = document.querySelector('.btn-discount-quick[data-discount="0"]');
        if (zeroBtn) {
            zeroBtn.classList.remove('text-slate-400');
            zeroBtn.classList.add('bg-orange-500', 'text-white');
        }

        calculateBillTotals();
        updateDiscountSummary();
        renderVouchers();
        showSuccessToast("Đã xóa giảm giá!");
    });

    btnApplyCustom?.addEventListener('click', () => {
        const pctInput = document.getElementById('input-custom-discount-pct') as HTMLInputElement;
        const amtInput = document.getElementById('input-custom-discount-amount') as HTMLInputElement;
        const reasonInput = document.getElementById('input-custom-discount-reason') as HTMLInputElement;

        const pct = Number(pctInput?.value || 0);
        const amt = Number(amtInput?.value || 0);
        const reason = reasonInput?.value.trim() || 'Chiết khấu tùy chỉnh';

        if (pct <= 0 && amt <= 0) {
            showWarningToast("Vui lòng nhập phần trăm (%) hoặc số tiền giảm hợp lệ!");
            return;
        }

        if (pct > 0) {
            if (pct > 50) {
                showWarningToast("Phần trăm giảm giá không được vượt quá 50% theo quy định!");
                return;
            }
            currentDiscountType = 'percent';
            currentDiscountPercent = pct;
            currentDiscountFixedAmount = 0;
        } else {
            if (calculatedSubtotal > 0 && amt > calculatedSubtotal * 0.5) {
                showWarningToast(`Số tiền giảm không được vượt quá 50% tổng bill (tối đa ${(calculatedSubtotal * 0.5).toLocaleString('vi-VN')} đ)!`);
                return;
            }
            currentDiscountType = 'amount';
            currentDiscountFixedAmount = amt;
            currentDiscountPercent = 0;
        }

        currentDiscountVoucherCode = '';
        currentDiscountReason = reason;

        // Reset quick buttons
        document.querySelectorAll('.btn-discount-quick').forEach(b => {
            b.classList.remove('bg-orange-500', 'text-white');
            b.classList.add('text-slate-400');
        });

        calculateBillTotals();
        showSuccessToast("Đã áp dụng giảm giá tùy chỉnh!");
        if (pctInput) pctInput.value = '';
        if (amtInput) amtInput.value = '';
        if (reasonInput) reasonInput.value = '';
        closeModal();
    });
};

// ==========================================
// TÍNH NĂNG 2: CHUYỂN BÀN / ĐỔI BÀN (TRANSFER TABLE)
// ==========================================
const setupTransferTableEvents = () => {
    const btnOpen = document.getElementById('btn-transfer-table');
    const overlay = document.getElementById('overlay-transfer-table');
    const btnClose = document.getElementById('btn-close-transfer');
    const btnCancel = document.getElementById('btn-cancel-transfer');
    const btnConfirm = document.getElementById('btn-confirm-transfer') as HTMLButtonElement;
    const sourceNameEl = document.getElementById('transfer-source-name');
    const sourceDetailsEl = document.getElementById('transfer-source-details');
    const targetGridEl = document.getElementById('transfer-target-grid');
    const noTablesMsgEl = document.getElementById('transfer-no-tables-msg');
    const reasonInput = document.getElementById('input-transfer-reason') as HTMLInputElement;

    const closeModal = () => {
        overlay?.classList.add('hidden');
        overlay?.classList.remove('flex');
        selectedTransferTargetTableId = null;
    };

    btnOpen?.addEventListener('click', async () => {
        if (!selectedOrder) {
            showWarningToast("Vui lòng chọn bàn đang phục vụ để đổi bàn!");
            return;
        }

        selectedTransferTargetTableId = null;
        if (btnConfirm) btnConfirm.disabled = true;

        const currentNum = getCashierOrderTableNumber(selectedOrder, cachedAllTables) || getCashierOrderTableId(selectedOrder);
        if (sourceNameEl) sourceNameEl.innerText = `Bàn ${currentNum}`;
        if (sourceDetailsEl) {
            const itemCount = activeOrderDetails.filter(d => d.status !== 'Cancelled' && d.status !== 'cancelled').length;
            sourceDetailsEl.innerText = `Đang có ${itemCount} món - Tổng: ${formatMoney(calculatedFinalTotal)} đ`;
        }
        if (reasonInput) reasonInput.value = '';

        // Load tables and find empty ones
        const allTables = await layDanhSachBan();
        const unpaids = await layDanhSachHoaDonChuaThanhToan();

        let tableList = allTables && allTables.length > 0 
            ? allTables 
            : TABLES.map(t => ({ id: t, tableNumber: 'Bàn ' + parseInt(t.replace('T', ''), 10), status: 'Available' }));

        const availableTables = tableList.filter((t: any) => 
            !isOrderForTable(selectedOrder, t) && 
            t.status === 'Available' && 
            !unpaids.find((o: any) => isOrderForTable(o, t))
        );

        if (availableTables.length === 0) {
            noTablesMsgEl?.classList.remove('hidden');
            if (targetGridEl) targetGridEl.innerHTML = '';
        } else {
            noTablesMsgEl?.classList.add('hidden');
            if (targetGridEl) {
                let html = '';
                availableTables.forEach((t: any) => {
                    const num = t.tableNumber || (isNaN(parseInt(t.id.replace('T', ''), 10)) ? t.id : parseInt(t.id.replace('T', ''), 10));
                    html += `
                        <button type="button" class="btn-select-transfer-target p-3 rounded-xl border border-slate-700 bg-[#0f172a] hover:border-cyan-500 hover:bg-cyan-500/10 text-center transition-all cursor-pointer group" data-table-id="${t.id}">
                            <div class="text-cyan-400 group-hover:scale-110 transition-transform mb-1 text-sm"><i class="fa-solid fa-chair"></i></div>
                            <span class="text-xs font-black text-white block">Bàn ${num}</span>
                            <span class="text-[9px] text-emerald-400 font-bold block">Trống</span>
                        </button>
                    `;
                });
                targetGridEl.innerHTML = html;

                targetGridEl.querySelectorAll('.btn-select-transfer-target').forEach(btn => {
                    btn.addEventListener('click', () => {
                        targetGridEl.querySelectorAll('.btn-select-transfer-target').forEach(b => {
                            b.classList.remove('border-cyan-500', 'bg-cyan-500/20', 'ring-2', 'ring-cyan-500/50');
                            b.classList.add('border-slate-700', 'bg-[#0f172a]');
                        });
                        btn.classList.remove('border-slate-700', 'bg-[#0f172a]');
                        btn.classList.add('border-cyan-500', 'bg-cyan-500/20', 'ring-2', 'ring-cyan-500/50');
                        selectedTransferTargetTableId = btn.getAttribute('data-table-id');
                        if (btnConfirm) btnConfirm.disabled = false;
                    });
                });
            }
        }

        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');
    });

    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);

    // Quick reasons
    document.querySelectorAll('.btn-transfer-quick-reason').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const r = target.getAttribute('data-reason') || '';
            if (reasonInput) reasonInput.value = r;
        });
    });

    btnConfirm?.addEventListener('click', async () => {
        if (!selectedOrder || !selectedTransferTargetTableId) {
            showWarningToast("Vui lòng chọn bàn đích để chuyển!");
            return;
        }

        const reason = reasonInput?.value.trim() || 'Chuyển bàn theo yêu cầu của khách';
        const oldTableId = getCashierOrderTableId(selectedOrder);
        const newTableId = selectedTransferTargetTableId;
        const orderId = selectedOrder.id;

        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang chuyển...';

        try {
            await chuyenBanDonHang(orderId, oldTableId, newTableId, reason);

            kdsChannel.postMessage({
                type: 'TABLE_MOVED',
                from: oldTableId,
                to: newTableId,
                orderId: orderId,
                reason: reason,
                time: new Date().toLocaleTimeString('vi-VN')
            });

            showSuccessToast(`Đã chuyển đơn từ ${oldTableId} sang ${newTableId} thành công!`);
            closeModal();

            // Refresh tables and update selected order table_id
            selectedOrder.table_id = newTableId;
            const newNum = isNaN(parseInt(newTableId.replace('T', ''), 10)) ? newTableId : parseInt(newTableId.replace('T', ''), 10);
            const title = document.getElementById('detail-table-name');
            if (title) title.innerHTML = `Bàn ${newNum}`;

            await renderTableMap();
            await renderOrdersList();
        } catch (err: any) {
            console.error("Lỗi khi chuyển bàn:", err);
            showWarningToast(err?.message || "Không thể chuyển bàn, vui lòng thử lại!");
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = 'Xác nhận chuyển bàn';
        }
    });
};

// ==========================================
// TÍNH NĂNG 3: THU CHI TIỀN KÉT & DÒNG TIỀN TRONG CA
// ==========================================
const CASH_IN_PRESETS = [
    "Nạp thêm tiền lẻ thối",
    "Thu hồi tạm ứng",
    "Chủ rót thêm vốn két",
    "Thu tiền khác"
];

const CASH_OUT_PRESETS = [
    "Mua đá lạnh khẩn cấp",
    "Mua thêm rau / chanh / ớt",
    "Chi tiền ship giao hàng",
    "Mua túi nilon / hộp mang về",
    "Sửa chữa điện nước đột xuất",
    "Chi khác"
];

const setupCashTransactionEvents = () => {
    const overlay = document.getElementById('overlay-cash-transaction');
    const btnClose = document.getElementById('btn-close-cash-trans');
    const btnCancel = document.getElementById('btn-cancel-cash-trans');
    const btnSubmit = document.getElementById('btn-submit-cash-trans');
    const btnTypeIn = document.getElementById('btn-type-cash-in');
    const btnTypeOut = document.getElementById('btn-type-cash-out');
    const headerIcon = document.getElementById('cash-trans-header-icon');
    const amountInput = document.getElementById('input-cash-trans-amount') as HTMLInputElement;
    const reasonInput = document.getElementById('input-cash-trans-reason') as HTMLTextAreaElement;
    const presetReasonsEl = document.getElementById('cash-preset-reasons');

    const setCashType = (type: 'in' | 'out') => {
        currentCashTransType = type;
        if (type === 'in') {
            btnTypeIn?.classList.add('bg-emerald-500', 'text-white', 'shadow-md');
            btnTypeIn?.classList.remove('text-slate-400');
            btnTypeOut?.classList.remove('bg-rose-500', 'text-white', 'shadow-md');
            btnTypeOut?.classList.add('text-slate-400');
            if (headerIcon) {
                headerIcon.className = "w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold";
                headerIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            }
        } else {
            btnTypeOut?.classList.add('bg-rose-500', 'text-white', 'shadow-md');
            btnTypeOut?.classList.remove('text-slate-400');
            btnTypeIn?.classList.remove('bg-emerald-500', 'text-white', 'shadow-md');
            btnTypeIn?.classList.add('text-slate-400');
            if (headerIcon) {
                headerIcon.className = "w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold";
                headerIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            }
        }
        renderPresetReasons();
    };

    const renderPresetReasons = () => {
        if (!presetReasonsEl) return;
        const presets = currentCashTransType === 'in' ? CASH_IN_PRESETS : CASH_OUT_PRESETS;
        let html = '';
        presets.forEach(p => {
            html += `<button type="button" class="btn-cash-preset-reason px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-colors cursor-pointer" data-reason="${p}">${p}</button>`;
        });
        presetReasonsEl.innerHTML = html;

        presetReasonsEl.querySelectorAll('.btn-cash-preset-reason').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                if (reasonInput) reasonInput.value = target.getAttribute('data-reason') || '';
            });
        });
    };

    const openModal = () => {
        if (amountInput) amountInput.value = '';
        if (reasonInput) reasonInput.value = '';
        setCashType('in');
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');
    };

    const closeModal = () => {
        overlay?.classList.add('hidden');
        overlay?.classList.remove('flex');
    };

    document.getElementById('btn-open-cash-trans')?.addEventListener('click', openModal);
    document.getElementById('btn-quick-cash-trans')?.addEventListener('click', openModal);
    document.getElementById('btn-overview-cash-trans')?.addEventListener('click', openModal);

    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);

    btnTypeIn?.addEventListener('click', () => setCashType('in'));
    btnTypeOut?.addEventListener('click', () => setCashType('out'));

    // Quick add amount buttons (+50k, +100k, +200k, +500k)
    document.querySelectorAll('.btn-cash-quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const amt = Number(target.getAttribute('data-amt') || 0);
            if (amountInput) {
                const cur = Number(amountInput.value || 0);
                amountInput.value = (cur + amt).toString();
            }
        });
    });

    btnSubmit?.addEventListener('click', async () => {
        const amount = Number(amountInput?.value || 0);
        if (isNaN(amount) || amount <= 0) {
            showWarningToast("Vui lòng nhập số tiền lớn hơn 0!");
            return;
        }

        const reason = reasonInput?.value.trim() || (currentCashTransType === 'in' ? 'Thu thêm vào két' : 'Chi từ két');
        const currentUser = getCurrentUser();

        const payload = {
            id: 'CT_' + Date.now(),
            shift_id: currentShiftId || 'SHIFT_UNKNOWN',
            type: currentCashTransType,
            amount: amount,
            reason: reason,
            createdBy: currentUser?.fullname || currentUser?.username || 'Thu ngân',
            createdAt: new Date().toISOString()
        };

        try {
            await taoCashTransaction(payload);
            showSuccessToast(`Đã lưu phiếu ${currentCashTransType === 'in' ? 'THU' : 'CHI'} ${formatMoney(amount)} đ!`);
            closeModal();
            await renderCashFlowOverview();
        } catch (err: any) {
            console.error("Lỗi tạo phiếu thu/chi:", err);
            showWarningToast("Không thể tạo phiếu thu/chi, vui lòng thử lại!");
        }
    });
};

const renderCashFlowOverview = async () => {
    // 1. Shift starting cash
    let startingCash = 0;
    if (currentShiftId) {
        const shiftData = await layThongTinCaLamViec(currentShiftId);
        if (shiftData) {
            startingCash = Number(shiftData.startingCash || 0);
        }
    }

    // 2. Paid orders in shift (Cash sales)
    const allOrders = await layTatCaDonHang();
    const paidCashOrders = allOrders.filter((o: any) => 
        (o.paymentStatus === 'Paid' || o.status === 'Completed') && 
        (o.paymentMethod === 'cash' || !o.paymentMethod)
    );
    const cashSales = paidCashOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

    // 3. Cash Transactions
    const transactions = await layDanhSachCashTransactions(currentShiftId || undefined);
    
    let totalCashIn = 0;
    let totalCashOut = 0;

    transactions.forEach((t: any) => {
        const amt = Number(t.amount || 0);
        if (t.type === 'in') totalCashIn += amt;
        else if (t.type === 'out') totalCashOut += amt;
    });

    const expectedCash = startingCash + cashSales + totalCashIn - totalCashOut;

    // Update KPI cards in Overview
    const elStarting = document.getElementById('cashflow-starting');
    const elSales = document.getElementById('cashflow-sales');
    const elIn = document.getElementById('cashflow-in');
    const elOut = document.getElementById('cashflow-out');
    const elExpected = document.getElementById('cashflow-expected');
    const elCount = document.getElementById('cashflow-trans-count');

    if (elStarting) elStarting.innerText = `${formatMoney(startingCash)} đ`;
    if (elSales) elSales.innerText = `+${formatMoney(cashSales)} đ`;
    if (elIn) elIn.innerText = `+${formatMoney(totalCashIn)} đ`;
    if (elOut) elOut.innerText = `-${formatMoney(totalCashOut)} đ`;
    if (elExpected) elExpected.innerText = `${formatMoney(expectedCash)} đ`;
    if (elCount) elCount.innerText = `${transactions.length} phiếu`;

    // Update transactions table
    const tbody = document.getElementById('cashflow-trans-tbody');
    if (tbody) {
        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">Chưa có giao dịch thu/chi nào trong ca này</td></tr>`;
        } else {
            const sorted = transactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            let html = '';
            sorted.forEach((t: any) => {
                const isThu = t.type === 'in';
                const d = new Date(t.createdAt);
                const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                const badge = isThu 
                    ? '<span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30">+ THU TIỀN</span>'
                    : '<span class="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500/30">- CHI TIỀN</span>';
                const amtClass = isThu ? 'text-emerald-400 font-black' : 'text-rose-400 font-black';
                const prefix = isThu ? '+' : '-';

                html += `
                    <tr class="hover:bg-slate-700/20 transition-colors border-b border-slate-800/50">
                        <td class="py-2.5 px-3 text-slate-400 whitespace-nowrap">${timeStr}</td>
                        <td class="py-2.5 px-3 whitespace-nowrap">${badge}</td>
                        <td class="py-2.5 px-3 ${amtClass} whitespace-nowrap">${prefix}${formatMoney(t.amount)} đ</td>
                        <td class="py-2.5 px-3 text-slate-200 whitespace-nowrap">${t.reason || '---'}</td>
                        <td class="py-2.5 px-3 text-slate-400 whitespace-nowrap">${t.createdBy || 'Thu ngân'}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
    }
};

// ==========================================
// BÁO CÁO Z-REPORT (BIÊN BẢN CHỐT CA K80)
// ==========================================
const showZReport = (reportData: any) => {
    const area = document.getElementById('zreport-print-area');
    const overlay = document.getElementById('overlay-zreport');
    if (!area || !overlay) return;

    const diff = reportData.diff;
    let diffStatus = 'KHỚP TIỀN';
    let diffColor = 'text-gray-700';
    if (diff > 0) {
        diffStatus = `THỪA +${formatMoney(diff)} đ`;
        diffColor = 'text-emerald-600 font-bold';
    } else if (diff < 0) {
        diffStatus = `THIẾU ${formatMoney(diff)} đ`;
        diffColor = 'text-rose-600 font-bold';
    }

    const nowStr = new Date().toLocaleString('vi-VN');
    const currentUser = getCurrentUser();

    area.innerHTML = `
        <div class="text-center pb-3 border-b-2 border-dashed border-gray-300">
            <h2 class="text-base font-black uppercase tracking-wider text-black">FOODHUB RESTAURANT</h2>
            <p class="text-[11px] text-gray-600">BIÊN BẢN KẾT CA / BÁO CÁO Z-REPORT</p>
            <p class="text-[10px] text-gray-400">Thời gian in: ${nowStr}</p>
        </div>

        <div class="py-3 border-b border-gray-200 space-y-1 text-[11px]">
            <div class="flex justify-between"><span>Mã ca:</span><span class="font-bold">#${reportData.shiftId}</span></div>
            <div class="flex justify-between"><span>Thu ngân:</span><span class="font-bold">${currentUser?.fullname || currentUser?.username || 'Thu ngân'}</span></div>
            <div class="flex justify-between"><span>Trạng thái:</span><span class="font-bold text-gray-800">ĐÃ ĐÓNG CA</span></div>
        </div>

        <div class="py-3 border-b border-gray-200 text-[11px]">
            <p class="font-bold uppercase text-[10px] text-gray-600 mb-1.5">DOANH SỐ BÁN HÀNG</p>
            <div class="flex justify-between py-0.5"><span>Doanh thu Tiền mặt:</span><span class="font-bold">${formatMoney(reportData.cashSales)} đ</span></div>
            <div class="flex justify-between py-0.5"><span>Doanh thu Chuyển khoản:</span><span class="font-bold">${formatMoney(reportData.transferSales)} đ</span></div>
            <div class="flex justify-between py-0.5 border-t border-gray-200 mt-1 pt-1 font-bold">
                <span>TỔNG DOANH THU:</span>
                <span class="text-xs">${formatMoney(reportData.totalSales)} đ</span>
            </div>
        </div>

        <div class="py-3 border-b-2 border-dashed border-gray-300 text-[11px] space-y-1">
            <p class="font-bold uppercase text-[10px] text-gray-600 mb-1.5">ĐỐI SOÁT TIỀN KÉT (CASH DRAWER)</p>
            <div class="flex justify-between"><span>Tiền đầu ca (Vốn):</span><span>${formatMoney(reportData.startingCash)} đ</span></div>
            <div class="flex justify-between text-emerald-700"><span>+ Thu tiền mặt:</span><span>+${formatMoney(reportData.cashSales)} đ</span></div>
            <div class="flex justify-between text-blue-700"><span>+ Thu thêm vào két:</span><span>+${formatMoney(reportData.totalCashIn)} đ</span></div>
            <div class="flex justify-between text-rose-700"><span>- Chi từ két:</span><span>-${formatMoney(reportData.totalCashOut)} đ</span></div>
            <div class="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-800">
                <span>= Tiền két lý thuyết:</span>
                <span>${formatMoney(reportData.expectedCash)} đ</span>
            </div>
            <div class="flex justify-between font-black text-xs text-gray-900 pt-1">
                <span>TIỀN KIỂM ĐẾM THỰC TẾ:</span>
                <span>${formatMoney(reportData.endingCash)} đ</span>
            </div>
            <div class="flex justify-between pt-1 text-[11px] border-t border-gray-200 ${diffColor}">
                <span>CHÊNH LỆCH:</span>
                <span>${diffStatus}</span>
            </div>
        </div>

        <div class="pt-6 pb-2 grid grid-cols-2 text-center text-[10px] text-gray-500">
            <div>
                <p class="font-bold text-gray-700">THU NGÂN</p>
                <p class="mt-8 italic">(Ký & ghi rõ họ tên)</p>
            </div>
            <div>
                <p class="font-bold text-gray-700">QUẢN LÝ</p>
                <p class="mt-8 italic">(Ký xác nhận)</p>
            </div>
        </div>
    `;

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
};

document.getElementById('btn-close-zreport')?.addEventListener('click', () => {
    document.getElementById('overlay-zreport')?.classList.add('hidden');
    document.getElementById('overlay-zreport')?.classList.remove('flex');
});

document.getElementById('btn-do-print-zreport')?.addEventListener('click', () => {
    const printArea = document.getElementById('zreport-print-area');
    if (!printArea) return;
    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Z-Report Print</title>
                    <style>
                        body { font-family: monospace; font-size: 11px; margin: 10px; color: #000; }
                        .text-center { text-align: center; }
                        .flex { display: flex; justify-content: space-between; }
                        .font-bold { font-weight: bold; }
                        .font-black { font-weight: 900; }
                        .border-b { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 4px; }
                        .border-b-2 { border-bottom: 2px dashed #999; padding-bottom: 8px; margin-bottom: 8px; }
                        .border-t { border-top: 1px solid #ccc; padding-top: 4px; margin-top: 4px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; }
                    </style>
                </head>
                <body>
                    ${printArea.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }
});

// ==========================================
// TABS TOGGLE (BÀN ĂN / CHI TIẾT ĐƠN)
// ==========================================
document.getElementById('tab-order-btn')?.addEventListener('click', () => {
    document.getElementById('tab-order-content')?.classList.remove('hidden');
    document.getElementById('tab-detail-content')?.classList.add('hidden');

    document.getElementById('tab-order-btn')?.classList.replace('text-slate-500', 'text-white');
    document.getElementById('tab-order-btn')?.classList.add('bg-[#1e293b]', 'rounded-t-xl', 'border-t', 'border-x', 'border-slate-700');

    document.getElementById('tab-detail-btn')?.classList.replace('text-white', 'text-slate-500');
    document.getElementById('tab-detail-btn')?.classList.remove('bg-[#1e293b]', 'rounded-t-xl', 'border-t', 'border-x', 'border-slate-700');
});

document.getElementById('tab-detail-btn')?.addEventListener('click', () => {
    document.getElementById('tab-detail-content')?.classList.remove('hidden');
    document.getElementById('tab-order-content')?.classList.add('hidden');

    document.getElementById('tab-detail-btn')?.classList.replace('text-slate-500', 'text-white');
    document.getElementById('tab-detail-btn')?.classList.add('bg-[#1e293b]', 'rounded-t-xl', 'border-t', 'border-x', 'border-slate-700');

    document.getElementById('tab-order-btn')?.classList.replace('text-white', 'text-slate-500');
    document.getElementById('tab-order-btn')?.classList.remove('bg-[#1e293b]', 'rounded-t-xl', 'border-t', 'border-x', 'border-slate-700');
});

let currentTableFilter = 'all';
let currentZoneFilter = 'all';
let cachedAllTables: any[] = [];

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
        renderTableMap();
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
        renderTableMap();
    });
});

const loadDashboard = async () => {
    if (menuItems.length === 0) menuItems = await layDanhSachMonAn();
    setupDiscountAndTaxListeners();
    setupDiscountModalEvents();
    setupTransferTableEvents();
    setupCashTransactionEvents();
    setupSplitBillEvents();
    setupMergeBillEvents();
    setupQuickCashAndNumpad();
    await renderTableMap();
    await renderCashFlowOverview();
};

const matchesCashierZone = (table: any, filter: string): boolean => {
    if (!filter || filter === 'all') return true;
    const z = (table.zone || '').toLowerCase();
    const num = (table.tableNumber || table.id || '').toLowerCase();
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

const renderTableMap = async () => {
    const grid = document.getElementById('table-grid');
    if (!grid) return;
    unpaidOrders = await layDanhSachHoaDonChuaThanhToan();
    const allTables = await layDanhSachBan();
    cachedAllTables = allTables || [];
    let html = '';

    let tablesToRender = allTables && allTables.length > 0 
        ? allTables 
        : TABLES.map(t => ({ id: t, tableNumber: 'Bàn ' + parseInt(t.replace('T', ''), 10), status: 'Available' }));

    if (currentTableFilter === 'empty') {
        tablesToRender = tablesToRender.filter((t: any) => t.status === 'Available' && !unpaidOrders.find((o: any) => isOrderForTable(o, t)));
    } else if (currentTableFilter === 'occupied') {
        tablesToRender = tablesToRender.filter((t: any) => t.status !== 'Available' || unpaidOrders.find((o: any) => isOrderForTable(o, t)));
    } else if (currentTableFilter === 'waiting_payment') {
        tablesToRender = tablesToRender.filter((t: any) => {
            const activeOrder = unpaidOrders.find((o: any) => isOrderForTable(o, t));
            const hasRequestedBill = tablesRequestedBill.has(String(t.id)) || tablesRequestedBill.has(String(t._id)) || tablesRequestedBill.has(String(t.tableNumber));
            return hasRequestedBill || t.status === 'Waiting_Payment' || (activeOrder && (activeOrder.status === 'Waiting_Payment' || activeOrder.paymentStatus === 'Pending'));
        });
    }

    if (currentZoneFilter !== 'all') {
        tablesToRender = tablesToRender.filter((t: any) => matchesCashierZone(t, currentZoneFilter));
    }

    if (tablesToRender.length === 0) {
        html = '<div class="col-span-full text-center text-slate-500 py-16 font-medium"><i class="fa-solid fa-filter text-2xl mb-2 block opacity-40"></i>Không có bàn nào phù hợp với bộ lọc</div>';
        grid.innerHTML = html;
        return;
    }

    tablesToRender.forEach((table: any) => {
        const tableName = table.id;
        const activeOrder = unpaidOrders.find((o: any) => isOrderForTable(o, table));
        const isVip = (table.zone || '').toLowerCase().includes('vip') || (table.tableNumber || '').toLowerCase().includes('vip');

        let zoneLabel = '';
        if (isVip) zoneLabel = 'Phòng VIP';
        else if ((table.zone || '').toLowerCase().includes('2') || (table.zone || '').toLowerCase().includes('sân vườn')) zoneLabel = 'Tầng 2';
        else zoneLabel = 'Tầng 1';

        const vipBadge = isVip 
            ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 text-[8px] sm:text-[9px] font-black border border-amber-300 shadow-xs uppercase tracking-tighter leading-none select-none"><i class="fa-solid fa-crown text-[7px] sm:text-[8px]"></i>VIP</span>` 
            : `<span class="w-2.5"></span>`;

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
                statusText = 'Chờ bill';
            } else {
                bgColor = 'bg-orange-500 text-white border-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:brightness-110 transform scale-105 z-10';
                statusText = 'Có khách';
            }
        }

        const hasRequestedBill = tablesRequestedBill.has(String(tableName)) || tablesRequestedBill.has(String(table.id)) || tablesRequestedBill.has(String(table.tableNumber));
        let rightIndicator = `<span class="w-2.5"></span>`;
        if (hasRequestedBill) {
            bgColor = 'bg-amber-500 text-white border-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse hover:brightness-110 transform scale-105 z-20';
            statusText = 'Yêu cầu Bill!';
            rightIndicator = `<span class="inline-flex items-center gap-0.5 bg-amber-400 text-slate-900 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full shadow border border-white animate-bounce leading-none select-none"><i class="fa-solid fa-receipt text-[7px]"></i>Bill</span>`;
        } else if (table.status === 'Waiting_Payment' || (activeOrder && (activeOrder.status === 'Waiting_Payment' || activeOrder.paymentStatus === 'Pending'))) {
            rightIndicator = `<span class="w-2 h-2 rounded-full bg-amber-300 border border-white shadow-xs animate-bounce"></span>`;
        } else if (activeOrder || table.status === 'Occupied') {
            rightIndicator = `<span class="w-2 h-2 rounded-full bg-orange-400 border border-white shadow-xs animate-pulse"></span>`;
        }

        // Highlight bàn đang chọn
        if (selectedOrder && isOrderForTable(selectedOrder, table)) {
            bgColor += ' ring-4 ring-white ring-offset-2 ring-offset-[#0f172a]';
        }

        let displayNum = table.tableNumber || (isNaN(parseInt(tableName.replace('T', ''), 10)) ? tableName : parseInt(tableName.replace('T', ''), 10));
        const isLongName = String(displayNum).length > 3;
        const numFontSize = isLongName ? 'text-xs sm:text-sm font-black' : 'text-base sm:text-lg lg:text-xl font-black';

        html += `
            <div data-table="${tableName}" class="table-card relative ${cursor} flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border transition-all ${bgColor} aspect-square text-center select-none overflow-hidden min-h-0 min-w-0">
                <div class="w-full flex items-center justify-between h-4 sm:h-5 shrink-0 pointer-events-none">
                    ${vipBadge}
                    ${rightIndicator}
                </div>
                <div class="flex-1 flex flex-col items-center justify-center my-auto px-0.5 min-h-0 pointer-events-none">
                    <span class="${numFontSize} font-black tracking-tight leading-none whitespace-nowrap mb-1">${displayNum}</span>
                    <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-90 whitespace-nowrap leading-none">${statusText}</span>
                </div>
                <div class="w-full h-3.5 sm:h-4 shrink-0 flex items-center justify-center pointer-events-none">
                    <span class="text-[8px] sm:text-[9px] font-semibold opacity-75 whitespace-nowrap truncate leading-none">${zoneLabel}</span>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;

    document.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const t = (e.currentTarget as HTMLDivElement).getAttribute('data-table');
            const tb = tablesToRender.find((tbl: any) => tbl.id === t || tbl._id === t);
            if (tb && tb.status === 'Locked') return;
            const ord = unpaidOrders.find((o: any) => isOrderForTable(o, tb || t));
            if (ord) hienThiChiTietHoaDon(ord);
            else hienThiManHinhTrong();
        });
    });
};

const hienThiManHinhTrong = () => {
    selectedOrder = null;
    activeOrderDetails = [];
    currentDiscountType = 'percent';
    currentDiscountPercent = 0;
    currentDiscountFixedAmount = 0;
    currentDiscountVoucherCode = '';
    currentDiscountReason = '';
    document.getElementById('empty-order-view')?.classList.remove('hidden');
    document.getElementById('active-order-view')?.classList.add('hidden');
    const discountBadge = document.getElementById('detail-discount-badge');
    if (discountBadge) discountBadge.classList.add('hidden');
};

const hienThiChiTietHoaDon = async (order: any) => {
    selectedOrder = order;
    document.getElementById('empty-order-view')?.classList.add('hidden');
    document.getElementById('active-order-view')?.classList.remove('hidden');

    const matchingTable = cachedAllTables.find((t: any) => isOrderForTable(order, t));
    const isVip = matchingTable && ((matchingTable.zone || '').toLowerCase().includes('vip') || (matchingTable.tableNumber || '').toLowerCase().includes('vip'));
    const tableNum = matchingTable ? matchingTable.tableNumber : getCashierOrderTableNumber(order, cachedAllTables);
    const displayNum = tableNum ? (String(tableNum).startsWith('Bàn ') ? tableNum : `Bàn ${tableNum}`) : 'Bàn';
    const title = document.getElementById('detail-table-name');
    if (title) {
        if (isVip) {
            title.innerHTML = `<span class="flex items-center gap-1.5"><i class="fa-solid fa-crown text-amber-400 text-lg"></i> ${displayNum}</span>`;
        } else {
            title.innerHTML = displayNum;
        }
    }

    const itemsEl = document.getElementById('detail-items');
    if (itemsEl) {
        itemsEl.innerHTML = '<div class="text-center p-4 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải món...</div>';
        const details = await layChiTietCuaDon(order.id);
        activeOrderDetails = details;

        let h = '';
        const groupedMap = new Map();
        details.forEach((item: any) => {
            if (item.status === 'Cancelled' || item.status === 'cancelled') return;
            const mid = getDetailMenuItemId(item);
            const key = `${mid}_${item.status?.toLowerCase()}_${item.notes || ''}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, { ...item });
            } else {
                groupedMap.get(key).quantity += item.quantity;
            }
        });

        const groupedDetails = Array.from(groupedMap.values());

        if (groupedDetails.length === 0) {
            h = '<div class="text-center text-slate-500 py-6 text-xs">Đơn hàng chưa có món nào</div>';
        }

        groupedDetails.forEach((d: any) => {
            const mon = getDetailMenuItem(d, menuItems);
            const monName = mon ? mon.name : (d.name || `Món ăn #${getDetailMenuItemId(d).slice(-4)}`);
            const itemPrice = d.priceAtOrder || (mon ? mon.base_price : 0);
            const lineTotal = itemPrice * d.quantity;

            let variantText = '';
            let actualNotes = d.notes || '';
            const match = actualNotes.match(/^\[(.*?)\]\s*(.*)$/);
            if (match) {
                variantText = match[1];
                actualNotes = match[2];
            }

            let variantHtml = '';
            if (variantText) {
                variantHtml = `<span class="inline-block mt-0.5 text-[10px] text-slate-400 font-bold bg-[#0f172a]/60 px-1.5 py-0.5 rounded border border-slate-700">${variantText}</span>`;
            }
            let notesHtml = '';
            if (actualNotes) {
                notesHtml = `<span class="block mt-0.5 text-[10px] text-orange-400 italic">${actualNotes}</span>`;
            }

            h += `
                <div class="flex items-center py-2.5 border-b border-slate-800/80 px-1">
                    <div class="flex-1 pr-2">
                        <p class="text-white font-bold text-xs leading-tight">${monName}</p>
                        <p class="text-[11px] text-slate-400 mt-0.5">${formatMoney(itemPrice)} đ</p>
                        ${variantHtml}
                        ${notesHtml}
                    </div>
                    <div class="w-12 text-center text-white font-bold text-xs bg-slate-800/80 py-1 rounded-md border border-slate-700">${d.quantity}</div>
                    <div class="w-24 text-right font-black text-orange-400 text-xs">${formatMoney(lineTotal)} đ</div>
                </div>
            `;
        });
        itemsEl.innerHTML = h;

        if (order.discountAmount && order.discountAmount > 0) {
            currentDiscountType = order.discountType || (order.voucherCode ? 'voucher' : (order.discountPercent ? 'percent' : 'amount'));
            currentDiscountPercent = order.discountPercent || 0;
            currentDiscountFixedAmount = order.discountAmount || 0;
            currentDiscountVoucherCode = order.voucherCode || '';
            currentDiscountReason = order.discountReason || '';
        } else {
            currentDiscountType = 'percent';
            currentDiscountPercent = 0;
            currentDiscountFixedAmount = 0;
            currentDiscountVoucherCode = '';
            currentDiscountReason = '';
            document.querySelectorAll('.btn-discount-quick').forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white');
                b.classList.add('text-slate-400');
            });
            const zeroBtn = document.querySelector('.btn-discount-quick[data-discount="0"]');
            if (zeroBtn) {
                zeroBtn.classList.remove('text-slate-400');
                zeroBtn.classList.add('bg-orange-500', 'text-white');
            }
        }
        calculateBillTotals();

        // Cập nhật thông tin chi tiết đơn hàng
        const timeEl = document.getElementById('detail-info-time');
        const durationEl = document.getElementById('detail-info-duration');

        if (timeEl) {
            const created = new Date(order.createdAt || new Date());
            timeEl.innerText = created.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + created.toLocaleDateString('vi-VN');

            if (durationEl) {
                const diffMs = new Date().getTime() - created.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                durationEl.innerText = diffMins > 0 ? `${diffMins} phút` : 'Vừa xong';
            }
        }

        const noteEl = document.getElementById('detail-info-note') as HTMLTextAreaElement;
        if (noteEl) {
            noteEl.value = order.note || '';
            noteEl.onchange = async () => {
                if (noteEl.value !== order.note) {
                    await capNhatDonHang(order.id, { note: noteEl.value });
                    order.note = noteEl.value;
                }
            };
        }

        const customerEl = document.getElementById('detail-info-customer');
        if (customerEl) customerEl.innerText = order.customerInfo || 'Khách lẻ';

        const idEl = document.getElementById('detail-info-id');
        if (idEl) idEl.innerText = order.id ? `#${String(order.id).toUpperCase()}` : '---';

        const tabOrderBtn = document.getElementById('tab-order-btn');
        if (tabOrderBtn) tabOrderBtn.click();
    }
};

// ==========================================
// TÍNH NĂNG 1: TÁCH HÓA ĐƠN (SPLIT BILL)
// ==========================================
const setupSplitBillEvents = () => {
    const btnOpenSplit = document.getElementById('btn-split-bill');
    const overlaySplit = document.getElementById('overlay-split-bill');
    const btnCloseSplit = document.getElementById('btn-close-split');
    const btnCancelSplit = document.getElementById('btn-cancel-split');
    const btnModeItems = document.getElementById('btn-split-mode-items');
    const btnModeEqual = document.getElementById('btn-split-mode-equal');

    btnOpenSplit?.addEventListener('click', async () => {
        if (!selectedOrder) {
            showWarningToast("Vui lòng chọn một bàn đang có đơn để tách bill!");
            return;
        }

        const details = await layChiTietCuaDon(selectedOrder.id);
        const validDetails = details.filter((d: any) => d.status !== 'Cancelled' && d.status !== 'cancelled');
        if (validDetails.length === 0) {
            showWarningToast("Hóa đơn này không có món nào để tách!");
            return;
        }

        // Khởi tạo danh sách Bill A và Bill B
        splitBillAItems = validDetails.map((d: any) => ({ ...d }));
        splitBillBItems = [];
        splitMode = 'items';
        equalPaidShares = [];

        const tableNameEl = document.getElementById('split-table-name');
        if (tableNameEl) {
            const num = getCashierOrderTableNumber(selectedOrder, cachedAllTables) || getCashierOrderTableId(selectedOrder);
            tableNameEl.innerText = `Bàn ${num}`;
        }

        switchSplitMode('items');
        renderSplitBillLists();

        overlaySplit?.classList.remove('hidden');
        overlaySplit?.classList.add('flex');
    });

    const closeSplit = () => {
        overlaySplit?.classList.add('hidden');
        overlaySplit?.classList.remove('flex');
    };

    btnCloseSplit?.addEventListener('click', closeSplit);
    btnCancelSplit?.addEventListener('click', closeSplit);

    btnModeItems?.addEventListener('click', () => switchSplitMode('items'));
    btnModeEqual?.addEventListener('click', () => switchSplitMode('equal'));

    // Chuyển chế độ tách
    const switchSplitMode = (mode: 'items' | 'equal') => {
        splitMode = mode;
        const viewItems = document.getElementById('split-mode-items-view');
        const viewEqual = document.getElementById('split-mode-equal-view');
        const actions = document.getElementById('split-items-actions');

        if (mode === 'items') {
            viewItems?.classList.remove('hidden');
            viewEqual?.classList.add('hidden');
            actions?.classList.remove('hidden');

            btnModeItems?.classList.add('bg-amber-500', 'text-white');
            btnModeItems?.classList.remove('text-slate-400');
            btnModeEqual?.classList.remove('bg-amber-500', 'text-white');
            btnModeEqual?.classList.add('text-slate-400');
        } else {
            viewItems?.classList.add('hidden');
            viewEqual?.classList.remove('hidden');
            viewEqual?.classList.add('flex');
            actions?.classList.add('hidden');

            btnModeEqual?.classList.add('bg-amber-500', 'text-white');
            btnModeEqual?.classList.remove('text-slate-400');
            btnModeItems?.classList.remove('bg-amber-500', 'text-white');
            btnModeItems?.classList.add('text-slate-400');

            renderEqualSplitCards();
        }
    };

    // Mode 2: Equal Split count buttons
    document.getElementById('btn-split-count-dec')?.addEventListener('click', () => {
        if (equalShareCount > 2) {
            equalShareCount--;
            const countEl = document.getElementById('split-equal-count');
            if (countEl) countEl.innerText = equalShareCount.toString();
            renderEqualSplitCards();
        }
    });

    document.getElementById('btn-split-count-inc')?.addEventListener('click', () => {
        if (equalShareCount < 10) {
            equalShareCount++;
            const countEl = document.getElementById('split-equal-count');
            if (countEl) countEl.innerText = equalShareCount.toString();
            renderEqualSplitCards();
        }
    });

    // Xác nhận tách đơn (Chỉ tách tạo đơn mới)
    document.getElementById('btn-confirm-split-only')?.addEventListener('click', async () => {
        await executeItemizedSplit(false);
    });

    // Tách & Thanh toán ngay Bill B
    document.getElementById('btn-confirm-split-pay')?.addEventListener('click', async () => {
        await executeItemizedSplit(true);
    });
};

const renderSplitBillLists = () => {
    const listAEl = document.getElementById('split-bill-a-list');
    const listBEl = document.getElementById('split-bill-b-list');
    const totalAEl = document.getElementById('split-bill-a-total');
    const totalBEl = document.getElementById('split-bill-b-total');
    const countAEl = document.getElementById('split-bill-a-item-count');
    const countBEl = document.getElementById('split-bill-b-item-count');

    let totalA = 0;
    let countA = 0;
    let htmlA = '';

    splitBillAItems.forEach((item, index) => {
        const mon = getDetailMenuItem(item, menuItems);
        const name = mon ? mon.name : 'Món ' + getDetailMenuItemId(item);
        const price = item.priceAtOrder || (mon ? mon.base_price : 0);
        const lineTotal = price * item.quantity;
        totalA += lineTotal;
        countA += item.quantity;

        htmlA += `
            <div class="flex items-center justify-between p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
                <div class="flex-1 min-w-0 pr-2">
                    <p class="font-bold text-white text-xs truncate">${name}</p>
                    <p class="text-[11px] text-slate-400">${formatMoney(price)} đ x <span class="text-orange-400 font-bold">${item.quantity}</span></p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-emerald-400">${formatMoney(lineTotal)} đ</span>
                    <button type="button" class="btn-move-to-b w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white flex items-center justify-center font-bold text-xs transition-colors" data-index="${index}" title="Chuyển sang Bill B">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    });

    let totalB = 0;
    let countB = 0;
    let htmlB = '';

    splitBillBItems.forEach((item, index) => {
        const mon = getDetailMenuItem(item, menuItems);
        const name = mon ? mon.name : 'Món ' + getDetailMenuItemId(item);
        const price = item.priceAtOrder || (mon ? mon.base_price : 0);
        const lineTotal = price * item.quantity;
        totalB += lineTotal;
        countB += item.quantity;

        htmlB += `
            <div class="flex items-center justify-between p-2.5 bg-slate-800/80 rounded-xl border border-amber-500/30">
                <button type="button" class="btn-move-to-a w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-emerald-500 hover:text-white flex items-center justify-center font-bold text-xs transition-colors mr-2" data-index="${index}" title="Trả lại Bill A">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div class="flex-1 min-w-0 pr-2">
                    <p class="font-bold text-white text-xs truncate">${name}</p>
                    <p class="text-[11px] text-slate-400">${formatMoney(price)} đ x <span class="text-amber-400 font-bold">${item.quantity}</span></p>
                </div>
                <span class="text-xs font-black text-amber-400">${formatMoney(lineTotal)} đ</span>
            </div>
        `;
    });

    if (splitBillAItems.length === 0) htmlA = '<div class="text-center text-slate-500 py-10 text-xs font-medium">Đã chuyển hết món sang Bill B</div>';
    if (splitBillBItems.length === 0) htmlB = '<div class="text-center text-slate-500 py-10 text-xs font-medium">Chưa chọn món nào sang Bill B</div>';

    if (listAEl) listAEl.innerHTML = htmlA;
    if (listBEl) listBEl.innerHTML = htmlB;
    if (totalAEl) totalAEl.innerText = `${formatMoney(totalA)} đ`;
    if (totalBEl) totalBEl.innerText = `${formatMoney(totalB)} đ`;
    if (countAEl) countAEl.innerText = `${countA} món`;
    if (countBEl) countBEl.innerText = `${countB} món`;

    // Gắn sự kiện chuyển món
    document.querySelectorAll('.btn-move-to-b').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
            const item = splitBillAItems[idx];
            if (!item) return;

            // Chuyển 1 số lượng sang B
            if (item.quantity > 1) {
                item.quantity--;
                const existingB = splitBillBItems.find(b => b.id === item.id);
                if (existingB) {
                    existingB.quantity++;
                } else {
                    splitBillBItems.push({ ...item, quantity: 1 });
                }
            } else {
                splitBillAItems.splice(idx, 1);
                const existingB = splitBillBItems.find(b => b.id === item.id);
                if (existingB) {
                    existingB.quantity++;
                } else {
                    splitBillBItems.push({ ...item, quantity: 1 });
                }
            }
            renderSplitBillLists();
        });
    });

    document.querySelectorAll('.btn-move-to-a').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
            const item = splitBillBItems[idx];
            if (!item) return;

            if (item.quantity > 1) {
                item.quantity--;
                const existingA = splitBillAItems.find(a => a.id === item.id);
                if (existingA) {
                    existingA.quantity++;
                } else {
                    splitBillAItems.push({ ...item, quantity: 1 });
                }
            } else {
                splitBillBItems.splice(idx, 1);
                const existingA = splitBillAItems.find(a => a.id === item.id);
                if (existingA) {
                    existingA.quantity++;
                } else {
                    splitBillAItems.push({ ...item, quantity: 1 });
                }
            }
            renderSplitBillLists();
        });
    });
};

const executeItemizedSplit = async (payImmediately: boolean) => {
    if (splitBillBItems.length === 0) {
        showWarningToast("Bạn chưa chuyển món nào sang Hóa đơn B!");
        return;
    }
    if (splitBillAItems.length === 0) {
        showWarningToast("Hóa đơn A không thể để trống hoàn toàn!");
        return;
    }

    const confirmed = await showConfirmModal(
        "Xác nhận tách hóa đơn", 
        `Bạn có chắc chắn muốn tách ${splitBillBItems.length} loại món sang hóa đơn mới?`
    );
    if (!confirmed) return;

    try {
        // 1. Cập nhật các món của Bill A trên DB
        const originalDetails = await layChiTietCuaDon(selectedOrder.id);
        for (const orig of originalDetails) {
            const matchA = splitBillAItems.find(a => a.id === orig.id);
            if (matchA) {
                if (matchA.quantity !== orig.quantity) {
                    await capNhatChiTietDonHang(orig.id, { quantity: matchA.quantity });
                }
            } else {
                // Đã chuyển toàn bộ sang B -> xóa khỏi A
                await xoaChiTietDonHang(orig.id);
            }
        }

        // Tính lại tổng Bill A
        const totalA = splitBillAItems.reduce((sum, item) => {
            const mon = getDetailMenuItem(item, menuItems);
            const p = item.priceAtOrder || (mon ? mon.base_price : 0);
            return sum + (p * item.quantity);
        }, 0);
        await capNhatDonHang(selectedOrder.id, { totalAmount: totalA });

        // 2. Tạo Bill B mới
        const totalB = splitBillBItems.reduce((sum, item) => {
            const mon = getDetailMenuItem(item, menuItems);
            const p = item.priceAtOrder || (mon ? mon.base_price : 0);
            return sum + (p * item.quantity);
        }, 0);

        const newOrderB = await taoDonHang({
            table_id: getCashierOrderTableId(selectedOrder),
            customerInfo: `Tách từ #${selectedOrder.id}`,
            totalAmount: totalB,
            status: "In_Progress",
            paymentStatus: "Unpaid",
            createdAt: new Date().toISOString()
        });

        // Tạo chi tiết cho Bill B
        for (const item of splitBillBItems) {
            const mon = getDetailMenuItem(item, menuItems);
            const p = item.priceAtOrder || (mon ? mon.base_price : 0);
            await taoChiTietDonHang({
                order_id: newOrderB.id,
                menuItem_id: getDetailMenuItemId(item),
                variant_id: item.variant_id,
                quantity: item.quantity,
                priceAtOrder: p,
                notes: item.notes || '',
                status: item.status || 'Served',
                incidentNote: item.incidentNote || '',
                createdAt: new Date().toISOString()
            });
        }

        showSuccessToast("Đã tách hóa đơn thành công!");
        document.getElementById('overlay-split-bill')?.classList.add('hidden');
        document.getElementById('overlay-split-bill')?.classList.remove('flex');

        if (payImmediately) {
            // Thanh toán ngay cho Bill B
            newOrderB.table_id = selectedOrder.table_id;
            selectedOrder = newOrderB;
            activeOrderDetails = splitBillBItems;
            calculateBillTotals();
            document.getElementById('btn-pay')?.click();
        } else {
            // Tải lại hóa đơn hiện tại
            await renderTableMap();
            hienThiChiTietHoaDon(selectedOrder);
        }

    } catch (e) {
        console.error("Lỗi khi tách đơn:", e);
        showWarningToast("Có lỗi xảy ra trong quá trình tách đơn!");
    }
};

// Mode 2: Equal Split
const renderEqualSplitCards = () => {
    const totalEl = document.getElementById('split-equal-total-display');
    const perPersonEl = document.getElementById('split-equal-per-person');
    const container = document.getElementById('split-equal-cards-container');
    if (!container) return;

    const grandTotal = calculatedFinalTotal || (selectedOrder ? selectedOrder.totalAmount : 0);
    if (totalEl) totalEl.innerText = `${formatMoney(grandTotal)} đ`;

    const shareAmount = Math.round(grandTotal / equalShareCount);
    if (perPersonEl) perPersonEl.innerText = `${formatMoney(shareAmount)} đ`;

    let html = '';
    for (let i = 1; i <= equalShareCount; i++) {
        const isPaid = equalPaidShares.includes(i);
        const cardBg = isPaid ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-800/80 border-slate-700/80';
        const statusBadge = isPaid 
            ? '<span class="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded-full text-[11px] border border-emerald-500/30">Đã thanh toán</span>'
            : '<span class="px-2.5 py-1 bg-slate-700 text-slate-300 font-bold rounded-full text-[11px]">Chờ thanh toán</span>';

        const actionBtn = isPaid
            ? `<button disabled class="w-full py-2 bg-slate-700 text-slate-500 rounded-xl font-bold text-xs cursor-not-allowed">Đã thu tiền</button>`
            : `<button class="btn-pay-share w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition-colors shadow-md" data-share="${i}" data-amount="${shareAmount}">Thanh toán phần ${i}</button>`;

        html += `
            <div class="${cardBg} rounded-2xl p-4 border flex flex-col justify-between">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-bold text-white text-sm">Phần ${i} / ${equalShareCount}</span>
                    ${statusBadge}
                </div>
                <p class="text-xl font-black text-amber-400 mb-4">${formatMoney(shareAmount)} đ</p>
                ${actionBtn}
            </div>
        `;
    }
    container.innerHTML = html;

    // Gắn sự kiện thanh toán từng phần
    document.querySelectorAll('.btn-pay-share').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const shareIdx = Number((e.currentTarget as HTMLElement).getAttribute('data-share'));
            const amount = Number((e.currentTarget as HTMLElement).getAttribute('data-amount'));

            const ok = await showConfirmModal(
                `Thanh toán phần ${shareIdx}`, 
                `Xác nhận đã nhận ${formatMoney(amount)} đ của phần ${shareIdx}?`
            );
            if (ok) {
                equalPaidShares.push(shareIdx);
                showSuccessToast(`Đã ghi nhận thanh toán phần ${shareIdx}!`);
                renderEqualSplitCards();

                // Nếu tất cả đã trả xong
                if (equalPaidShares.length === equalShareCount) {
                    const targetTableId = getCashierOrderTableId(selectedOrder);
                    await capNhatDonHang(selectedOrder.id, { status: "Completed", paymentStatus: "Paid" });
                    await capNhatTrangThaiBan(targetTableId, "Available");
                    await deductInventoryForOrder(selectedOrder.id);
                    showSuccessToast("Tất cả các phần đã thanh toán xong! Bàn đã được giải phóng.");
                    document.getElementById('overlay-split-bill')?.classList.add('hidden');
                    hienThiManHinhTrong();
                    renderTableMap();
                }
            }
        });
    });
};

// ==========================================
// TÍNH NĂNG 2: GỘP HÓA ĐƠN (MERGE BILL)
// ==========================================
const setupMergeBillEvents = () => {
    const btnOpenMerge = document.getElementById('btn-merge-bill');
    const overlayMerge = document.getElementById('overlay-merge-bill');
    const btnCloseMerge = document.getElementById('btn-close-merge');
    const btnCancelMerge = document.getElementById('btn-cancel-merge');
    const btnConfirmMerge = document.getElementById('btn-confirm-merge');

    btnOpenMerge?.addEventListener('click', async () => {
        if (!selectedOrder) {
            showWarningToast("Vui lòng chọn một bàn để làm bàn chính gộp đơn!");
            return;
        }

        selectedMergeOrderIds = [];
        const num = getCashierOrderTableNumber(selectedOrder, cachedAllTables) || getCashierOrderTableId(selectedOrder);
        const selTableId = getCashierOrderTableId(selectedOrder);
        
        const targetNameEl = document.getElementById('merge-target-table-name');
        if (targetNameEl) targetNameEl.innerText = `Bàn ${num}`;

        const targetInfoEl = document.getElementById('merge-target-info');
        if (targetInfoEl) targetInfoEl.innerText = `Bàn ${num} (Đơn #${selectedOrder.id})`;

        const targetTotalEl = document.getElementById('merge-target-current-total');
        if (targetTotalEl) targetTotalEl.innerText = `${formatMoney(selectedOrder.totalAmount)} đ`;

        // Lấy danh sách các bàn khác đang có đơn chưa thanh toán
        const allUnpaid = await layDanhSachHoaDonChuaThanhToan();
        mergeCandidateOrders = allUnpaid.filter((o: any) => o.id !== selectedOrder.id && getCashierOrderTableId(o) !== selTableId);

        renderMergeCandidatesList();
        updateMergePreview();

        overlayMerge?.classList.remove('hidden');
        overlayMerge?.classList.add('flex');
    });

    const closeMerge = () => {
        overlayMerge?.classList.add('hidden');
        overlayMerge?.classList.remove('flex');
    };

    btnCloseMerge?.addEventListener('click', closeMerge);
    btnCancelMerge?.addEventListener('click', closeMerge);

    btnConfirmMerge?.addEventListener('click', async () => {
        if (selectedMergeOrderIds.length === 0) {
            showWarningToast("Vui lòng chọn ít nhất 1 bàn để gộp vào!");
            return;
        }

        const ok = await showConfirmModal(
            "Xác nhận gộp hóa đơn", 
            `Bạn có chắc chắn muốn gộp ${selectedMergeOrderIds.length} bàn vào Bàn hiện tại? Sau khi gộp, các bàn được chọn sẽ được giải phóng.`
        );
        if (!ok) return;

        try {
            let addedTotal = 0;
            for (const orderId of selectedMergeOrderIds) {
                const order = mergeCandidateOrders.find(o => o.id === orderId);
                if (!order) continue;

                // 1. Chuyển tất cả món của order phụ sang order chính
                const details = await layChiTietCuaDon(orderId);
                for (const d of details) {
                    await capNhatChiTietDonHang(d.id, { order_id: selectedOrder.id });
                }

                // 2. Cập nhật order phụ thành Merged
                await capNhatDonHang(orderId, { 
                    status: "Completed", 
                    paymentStatus: "Paid", 
                    note: `Đã gộp vào hóa đơn #${selectedOrder.id}` 
                });

                // 3. Giải phóng bàn phụ
                const subTableId = getCashierOrderTableId(order);
                await capNhatTrangThaiBan(subTableId, "Available");

                addedTotal += (order.totalAmount || 0);
            }

            // 4. Cập nhật tổng tiền đơn chính
            const newTotal = (selectedOrder.totalAmount || 0) + addedTotal;
            await capNhatDonHang(selectedOrder.id, { totalAmount: newTotal });
            selectedOrder.totalAmount = newTotal;

            showSuccessToast("Gộp hóa đơn thành công!");
            closeMerge();

            await renderTableMap();
            hienThiChiTietHoaDon(selectedOrder);

        } catch (e) {
            console.error("Lỗi khi gộp đơn:", e);
            showWarningToast("Có lỗi xảy ra trong quá trình gộp đơn!");
        }
    });
};

const renderMergeCandidatesList = () => {
    const listEl = document.getElementById('merge-candidates-list');
    if (!listEl) return;

    if (mergeCandidateOrders.length === 0) {
        listEl.innerHTML = '<div class="text-center text-slate-500 py-6 text-xs">Không có bàn nào khác đang có đơn chưa thanh toán.</div>';
        return;
    }

    let html = '';
    mergeCandidateOrders.forEach(order => {
        const num = getCashierOrderTableNumber(order, cachedAllTables) || getCashierOrderTableId(order);
        const isChecked = selectedMergeOrderIds.includes(order.id) ? 'checked' : '';

        html += `
            <label class="flex items-center justify-between p-3 bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 cursor-pointer transition-colors">
                <div class="flex items-center gap-3">
                    <input type="checkbox" value="${order.id}" ${isChecked} class="chk-merge-order w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer">
                    <div>
                        <span class="font-bold text-white text-sm">Bàn ${num}</span>
                        <span class="text-xs text-slate-400 ml-2">#${order.id}</span>
                    </div>
                </div>
                <span class="font-black text-emerald-400 text-sm">${formatMoney(order.totalAmount)} đ</span>
            </label>
        `;
    });
    listEl.innerHTML = html;

    document.querySelectorAll('.chk-merge-order').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            if (input.checked) {
                if (!selectedMergeOrderIds.includes(input.value)) selectedMergeOrderIds.push(input.value);
            } else {
                selectedMergeOrderIds = selectedMergeOrderIds.filter(id => id !== input.value);
            }
            updateMergePreview();
        });
    });
};

const updateMergePreview = () => {
    const summaryDesc = document.getElementById('merge-summary-desc');
    const previewTotal = document.getElementById('merge-preview-total');
    if (!summaryDesc || !previewTotal) return;

    let combinedAmount = selectedOrder ? (selectedOrder.totalAmount || 0) : 0;
    let selectedTableNames: string[] = [];

    selectedMergeOrderIds.forEach(id => {
        const order = mergeCandidateOrders.find(o => o.id === id);
        if (order) {
            combinedAmount += (order.totalAmount || 0);
            const num = getCashierOrderTableNumber(order, cachedAllTables) || getCashierOrderTableId(order);
            selectedTableNames.push(`Bàn ${num}`);
        }
    });

    if (selectedTableNames.length > 0) {
        summaryDesc.innerText = `Gộp cùng: ${selectedTableNames.join(', ')}`;
    } else {
        summaryDesc.innerText = 'Chưa chọn bàn nào để gộp';
    }

    previewTotal.innerText = `${formatMoney(combinedAmount)} đ`;
};

// ==========================================
// TÍNH NĂNG 3: QUICK CASH & TOUCH NUMPAD
// ==========================================
const setupQuickCashAndNumpad = () => {
    const cashInput = document.getElementById('input-customer-cash') as HTMLInputElement;
    const changeAmountEl = document.getElementById('pay-change-amount');
    const changeContainer = document.getElementById('pay-change-container');
    const changeLabel = document.getElementById('pay-change-label');
    const btnConfirmPay = document.getElementById('btn-confirm-pay') as HTMLButtonElement;

    const updateChangeCalculation = () => {
        if (!selectedOrder) return;
        const currentTotal = calculatedFinalTotal || selectedOrder.totalAmount || 0;
        const rawVal = cashInput.value.replace(/[^0-9]/g, '');
        const customerCash = parseInt(rawVal, 10);

        if (isNaN(customerCash) || customerCash === 0) {
            if (changeAmountEl) changeAmountEl.innerText = '0 đ';
            if (changeContainer) {
                changeContainer.className = 'p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex justify-between items-center';
            }
            if (changeLabel) changeLabel.innerText = 'Tiền thối lại:';
            if (btnConfirmPay) btnConfirmPay.disabled = false;
            return;
        }

        const change = customerCash - currentTotal;
        if (change >= 0) {
            // Đủ tiền -> Hiện tiền thối màu xanh
            if (changeAmountEl) {
                changeAmountEl.innerText = `${formatMoney(change)} đ`;
                changeAmountEl.className = 'text-2xl font-black text-emerald-400';
            }
            if (changeLabel) changeLabel.innerText = 'Tiền thối lại:';
            if (changeContainer) {
                changeContainer.className = 'p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex justify-between items-center';
            }
            if (btnConfirmPay) {
                btnConfirmPay.disabled = false;
                btnConfirmPay.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        } else {
            // Còn thiếu -> Hiện cảnh báo màu đỏ
            const missing = Math.abs(change);
            if (changeAmountEl) {
                changeAmountEl.innerText = `Thiếu ${formatMoney(missing)} đ`;
                changeAmountEl.className = 'text-2xl font-black text-rose-400';
            }
            if (changeLabel) changeLabel.innerText = 'Chưa đủ tiền:';
            if (changeContainer) {
                changeContainer.className = 'p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex justify-between items-center';
            }
        }
    };

    if (cashInput) {
        cashInput.addEventListener('input', () => {
            const num = parseInt(cashInput.value.replace(/[^0-9]/g, ''), 10);
            cashInput.value = isNaN(num) ? '' : formatMoney(num);
            updateChangeCalculation();
        });
    }

    // Quick cash presets
    document.querySelectorAll('.btn-quick-cash').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const amountAttr = (e.currentTarget as HTMLElement).getAttribute('data-amount');
            const currentTotal = calculatedFinalTotal || (selectedOrder ? selectedOrder.totalAmount : 0);

            if (amountAttr === 'exact') {
                cashInput.value = formatMoney(currentTotal);
            } else if (amountAttr?.startsWith('+')) {
                const add = parseInt(amountAttr.replace('+', ''), 10);
                const cur = parseInt(cashInput.value.replace(/[^0-9]/g, ''), 10) || 0;
                cashInput.value = formatMoney(cur + add);
            } else {
                const val = parseInt(amountAttr || '0', 10);
                cashInput.value = formatMoney(val);
            }

            updateChangeCalculation();
        });
    });

    // Touch Numpad
    document.querySelectorAll('.btn-numpad').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = (e.currentTarget as HTMLElement).getAttribute('data-key');
            let cur = cashInput.value.replace(/[^0-9]/g, '');

            if (key === 'clear') {
                cur = '';
            } else if (key === 'back') {
                cur = cur.slice(0, -1);
            } else if (key === '000') {
                if (cur && cur !== '0') cur += '000';
            } else {
                if (cur === '0') cur = key || '';
                else cur += (key || '');
            }

            const num = parseInt(cur, 10);
            cashInput.value = isNaN(num) ? '' : formatMoney(num);
            updateChangeCalculation();
        });
    });
};

// ==========================================
// TÍNH NĂNG 4: MODAL THANH TOÁN (PAYMENT)
// ==========================================
document.getElementById('btn-pay')?.addEventListener('click', () => {
    if (!selectedOrder) return;
    const overlay = document.getElementById('overlay-payment');
    if (!overlay) return;

    calculateBillTotals();

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    // Cập nhật Left breakdown
    const totalEl = document.getElementById('pay-total-amount');
    if (totalEl) totalEl.innerText = `${formatMoney(calculatedFinalTotal)} đ`;

    const subtotalEl = document.getElementById('pay-subtotal');
    if (subtotalEl) subtotalEl.innerText = `${formatMoney(calculatedSubtotal)} đ`;

    const discountEl = document.getElementById('pay-discount');
    if (discountEl) discountEl.innerText = `-${formatMoney(calculatedDiscountAmount)} đ`;

    const serviceEl = document.getElementById('pay-service');
    if (serviceEl) serviceEl.innerText = `+${formatMoney(calculatedServiceCharge)} đ`;

    const vatEl = document.getElementById('pay-vat');
    if (vatEl) vatEl.innerText = `+${formatMoney(calculatedVatAmount)} đ`;

    // Cập nhật VietQR Code động
    const numTable = getCashierOrderTableNumber(selectedOrder, cachedAllTables) || getCashierOrderTableId(selectedOrder);
    const qrUrl = `https://img.vietqr.io/image/MB-0901234567-compact2.png?amount=${calculatedFinalTotal}&addInfo=Ban%20${numTable}%20Don%20${selectedOrder.id}&accountName=FOODHUB%20RESTAURANT`;
    const qrImg = document.getElementById('pay-qr-img') as HTMLImageElement;
    if (qrImg) qrImg.src = qrUrl;

    const qrDesc = document.getElementById('pay-qr-desc');
    if (qrDesc) qrDesc.innerText = `Ban ${numTable} Don #${selectedOrder.id}`;

    // Reset Cash input
    const cashInput = document.getElementById('input-customer-cash') as HTMLInputElement;
    const changeAmount = document.getElementById('pay-change-amount');
    const viewCash = document.getElementById('pay-view-cash');
    const viewTransfer = document.getElementById('pay-view-transfer');

    if (cashInput) cashInput.value = '';
    if (changeAmount) changeAmount.innerText = '0 đ';
    if (viewCash) viewCash.classList.remove('hidden');
    if (viewTransfer) viewTransfer.classList.add('hidden');

    const defaultRadio = document.querySelector('input[name="payment_method"][value="cash"]') as HTMLInputElement;
    if (defaultRadio) defaultRadio.checked = true;
});

// Chuyển phương thức thanh toán
document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const val = (e.target as HTMLInputElement).value;
        const viewCash = document.getElementById('pay-view-cash');
        const viewTransfer = document.getElementById('pay-view-transfer');

        if (val === 'cash') {
            viewCash?.classList.remove('hidden');
            viewTransfer?.classList.add('hidden');
        } else {
            viewCash?.classList.add('hidden');
            viewTransfer?.classList.remove('hidden');
        }
    });
});

document.getElementById('btn-close-payment')?.addEventListener('click', () => {
    document.getElementById('overlay-payment')?.classList.add('hidden');
    document.getElementById('overlay-payment')?.classList.remove('flex');
});

// Xác nhận hoàn tất thanh toán
document.getElementById('btn-confirm-pay')?.addEventListener('click', async () => {
    if (!selectedOrder) return;
    try {
        const paymentMethodEl = document.querySelector('input[name="payment_method"]:checked') as HTMLInputElement;
        const selectedMethod = paymentMethodEl?.value || 'cash';

        const updateData: any = { 
            status: "Completed", 
            paymentStatus: "Paid",
            paymentMethod: selectedMethod,
            subtotal: calculatedSubtotal,
            discountAmount: calculatedDiscountAmount,
            discountPercent: currentDiscountPercent,
            discountType: currentDiscountType,
            voucherCode: currentDiscountVoucherCode,
            discountReason: currentDiscountReason,
            serviceChargeAmount: calculatedServiceCharge,
            vatAmount: calculatedVatAmount,
            totalAmount: calculatedFinalTotal,
            paidAt: new Date().toISOString()
        };

        const targetTableId = getCashierOrderTableId(selectedOrder);
        const tableNum = getCashierOrderTableNumber(selectedOrder, cachedAllTables) || targetTableId;

        await capNhatDonHang(selectedOrder.id, updateData);
        await capNhatTrangThaiBan(targetTableId, "Available");

        // Trừ kho nguyên liệu tự động theo định lượng
        await deductInventoryForOrder(selectedOrder.id);

        // Xóa yêu cầu bill
        tablesRequestedBill.delete(String(targetTableId));
        tablesRequestedBill.delete(String(tableNum));

        // Cập nhật dòng tiền két
        await renderCashFlowOverview();

        // Broadcast ORDER_PAID tới Phục vụ & Khách hàng
        kdsChannel.postMessage({
            type: 'ORDER_PAID',
            tableId: targetTableId,
            tableName: `Bàn ${tableNum}`,
            orderId: selectedOrder.id,
            message: `Bàn ${tableNum} đã thanh toán thành công!`
        });

        showSuccessToast("Thanh toán thành công! Bàn đã được giải phóng.");
        document.getElementById('overlay-payment')?.classList.add('hidden');
        document.getElementById('overlay-payment')?.classList.remove('flex');

        hienThiManHinhTrong();
        renderTableMap();
    } catch (e) {
        console.error("Lỗi khi thanh toán:", e);
        showWarningToast("Lỗi khi cập nhật thanh toán!");
    }
});

// ==========================================
// TÍNH NĂNG 5: IN BILL VÀ IN TẠM TÍNH (K80)
// ==========================================
const showInvoice = async (orderId: string, isTemp: boolean) => {
    let order = selectedOrder;
    if (!order || String(order.id) !== String(orderId)) {
        const allOrders = await layTatCaDonHang();
        order = allOrders.find((o: any) => String(o.id) === String(orderId));
    }
    if (!order) {
        showWarningToast(`Không tìm thấy đơn hàng #${orderId} để xem mẫu in`);
        return;
    }

    if (menuItems.length === 0) {
        menuItems = await layDanhSachMonAn();
    }

    let details = await layChiTietCuaDon(String(order.id || order._id));
    if (!details || details.length === 0) {
        const allD = await layTatCaChiTietDon();
        const ordId = String(order.id || order._id);
        details = allD.filter((d: any) => getDetailOrderId(d) === ordId);
    }

    const allTables = cachedAllTables.length > 0 ? cachedAllTables : await layDanhSachBan().catch(() => []);
    const tableDisplay = getOrderTableDisplay(order, allTables);
    const user = getCurrentUser();

    // DOM Elements
    const titleEl = document.getElementById('invoice-title');
    if (titleEl) titleEl.innerText = isTemp ? 'PHIẾU TẠM TÍNH' : 'HÓA ĐƠN THANH TOÁN';
    const tableEl = document.getElementById('inv-table');
    if (tableEl) tableEl.innerText = tableDisplay;
    const orderEl = document.getElementById('inv-order');
    if (orderEl) orderEl.innerText = '#' + order.id;
    const timeEl = document.getElementById('inv-time');
    if (timeEl) timeEl.innerText = new Date().toLocaleString('vi-VN');
    
    const cashierEl = document.getElementById('inv-cashier');
    if (cashierEl) cashierEl.innerText = user ? user.fullname : 'Thu ngân FoodHub';

    let itemsHtml = '';
    let subtotal = 0;

    details.forEach((d: any) => {
        if (d.status === 'Cancelled' || d.status === 'cancelled') return;
        const m = getDetailMenuItem(d, menuItems);
        const name = m ? m.name : (d.name || 'Món #' + getDetailMenuItemId(d).slice(-4));
        const price = Number(d.priceAtOrder) || (m ? m.base_price : 0);
        const qty = Number(d.quantity) || 1;
        const tt = price * qty;
        subtotal += tt;

        itemsHtml += `
            <tr class="border-b border-dashed border-gray-300">
                <td class="py-1 font-medium">${name}${d.notes ? `<span class="block text-[9px] text-gray-500">${d.notes}</span>` : ''}</td>
                <td class="text-center py-1 font-bold">${qty}</td>
                <td class="text-right py-1">${formatMoney(price)}</td>
                <td class="text-right py-1 font-bold">${formatMoney(tt)}</td>
            </tr>
        `;
    });

    const itemsContainer = document.getElementById('inv-items');
    if (itemsContainer) itemsContainer.innerHTML = itemsHtml;

    // Chiết khấu, phí DV, VAT
    const discount = order.discountAmount !== undefined ? Number(order.discountAmount) : calculatedDiscountAmount;
    const service = order.serviceChargeAmount !== undefined ? Number(order.serviceChargeAmount) : calculatedServiceCharge;
    const vat = order.vatAmount !== undefined ? Number(order.vatAmount) : calculatedVatAmount;
    const grandTotal = Number(order.totalAmount) || Math.max(0, subtotal - discount + service + vat);

    const subtotalEl = document.getElementById('inv-subtotal');
    if (subtotalEl) subtotalEl.innerText = `${formatMoney(subtotal)} đ`;
    
    const rowDisc = document.getElementById('inv-row-discount');
    const discEl = document.getElementById('inv-discount');
    if (discount > 0 && rowDisc && discEl) {
        rowDisc.classList.remove('hidden');
        discEl.innerText = `-${formatMoney(discount)} đ`;
    } else if (rowDisc) {
        rowDisc.classList.add('hidden');
    }

    const rowServ = document.getElementById('inv-row-service');
    const servEl = document.getElementById('inv-service');
    if (service > 0 && rowServ && servEl) {
        rowServ.classList.remove('hidden');
        servEl.innerText = `+${formatMoney(service)} đ`;
    } else if (rowServ) {
        rowServ.classList.add('hidden');
    }

    const rowVat = document.getElementById('inv-row-vat');
    const vatEl = document.getElementById('inv-vat');
    if (vat > 0 && rowVat && vatEl) {
        rowVat.classList.remove('hidden');
        vatEl.innerText = `+${formatMoney(vat)} đ`;
    } else if (rowVat) {
        rowVat.classList.add('hidden');
    }

    const totalEl = document.getElementById('inv-total');
    if (totalEl) totalEl.innerText = `${formatMoney(grandTotal)} đ`;

    // Tiền khách đưa & tiền thối (nếu in bill hoàn tất)
    const cashInput = document.getElementById('input-customer-cash') as HTMLInputElement;
    const customerCash = cashInput ? parseInt(cashInput.value.replace(/[^0-9]/g, ''), 10) : 0;
    const rowCash = document.getElementById('inv-row-cash');
    const rowChange = document.getElementById('inv-row-change');

    if (!isTemp && customerCash >= grandTotal && rowCash && rowChange) {
        rowCash.classList.remove('hidden');
        rowChange.classList.remove('hidden');
        document.getElementById('inv-cash-given')!.innerText = `${formatMoney(customerCash)} đ`;
        document.getElementById('inv-change')!.innerText = `${formatMoney(customerCash - grandTotal)} đ`;
    } else {
        rowCash?.classList.add('hidden');
        rowChange?.classList.add('hidden');
    }

    // Cập nhật mã VietQR động trên Bill in ra
    const invQrImg = document.getElementById('inv-qr-img') as HTMLImageElement;
    if (invQrImg) {
        const numTable = getCashierOrderTableNumber(order, allTables) || getCashierOrderTableId(order);
        invQrImg.src = `https://img.vietqr.io/image/MB-0901234567-compact2.png?amount=${grandTotal}&addInfo=Ban%20${numTable}%20Don%20${order.id}&accountName=FOODHUB%20RESTAURANT`;
    }

    const overlay = document.getElementById('overlay-invoice');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }
};

document.getElementById('btn-close-invoice')?.addEventListener('click', () => {
    document.getElementById('overlay-invoice')?.classList.add('hidden');
    document.getElementById('overlay-invoice')?.classList.remove('flex');
});

document.getElementById('btn-do-print')?.addEventListener('click', () => {
    window.print();
});

document.getElementById('btn-print-temp')?.addEventListener('click', async () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === 'In_Progress') {
        const targetTableId = getCashierOrderTableId(selectedOrder);
        await capNhatDonHang(selectedOrder.id, { status: 'Waiting_Payment' });
        await capNhatTrangThaiBan(targetTableId, "Waiting_Payment");
        await renderTableMap();
    }
    showInvoice(selectedOrder.id, true);
});

document.getElementById('btn-print-detail')?.addEventListener('click', () => {
    if (!selectedOrder) return;
    showInvoice(selectedOrder.id, false);
});

// ==========================================
// TÍNH NĂNG 6: DANH SÁCH ĐƠN HÀNG (PAGE ORDERS)
// ==========================================
let currentOrderFilter = 'all';
let searchCashierOrdersKeyword = '';
let isCashierOrdersEventsBound = false;

const initCashierOrdersEvents = () => {
    if (isCashierOrdersEventsBound) return;
    isCashierOrdersEventsBound = true;

    document.querySelectorAll('.filter-order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            currentOrderFilter = target.getAttribute('data-filter') || 'all';

            document.querySelectorAll('.filter-order-btn').forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white', 'border-transparent', 'shadow-sm');
                b.classList.add('bg-[#1e293b]', 'text-slate-400', 'border-slate-700');
            });
            target.classList.remove('bg-[#1e293b]', 'text-slate-400', 'border-slate-700');
            target.classList.add('bg-orange-500', 'text-white', 'border-transparent', 'shadow-sm');

            renderOrdersList();
        });
    });

    const searchInput = document.getElementById('search-cashier-orders') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchCashierOrdersKeyword = searchInput.value.trim().toLowerCase();
            renderOrdersList();
        });
    }

    const btnRefresh = document.getElementById('btn-refresh-cashier-orders');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            await renderOrdersList();
            showSuccessToast('Đã làm mới danh sách đơn hàng!');
        });
    }
};

export const renderOrdersList = async () => {
    initCashierOrdersEvents();

    const tbody = document.getElementById('cashier-orders-tbody');
    if (!tbody) return;

    let [allOrders, allDetails, allTables] = await Promise.all([
        layTatCaDonHang(),
        layTatCaChiTietDon().catch(() => []),
        cachedAllTables.length > 0 ? cachedAllTables : layDanhSachBan().catch(() => [])
    ]);

    allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (currentOrderFilter === 'in_progress') allOrders = allOrders.filter((o: any) => o.status !== 'Completed' && o.status !== 'Cancelled');
    if (currentOrderFilter === 'completed') allOrders = allOrders.filter((o: any) => o.status === 'Completed' || o.paymentStatus === 'Paid');
    if (currentOrderFilter === 'cancelled') allOrders = allOrders.filter((o: any) => o.status === 'Cancelled');

    if (searchCashierOrdersKeyword) {
        allOrders = allOrders.filter((o: any) => {
            const idStr = String(o.id || o._id).toLowerCase();
            const tblStr = getOrderTableDisplay(o, allTables).toLowerCase();
            const custStr = (o.customerInfo || '').toLowerCase();
            return idStr.includes(searchCashierOrdersKeyword) || tblStr.includes(searchCashierOrdersKeyword) || custStr.includes(searchCashierOrdersKeyword);
        });
    }

    const countEl = document.getElementById('cashier-orders-total-count');
    if (countEl) countEl.innerText = allOrders.length.toString();

    if (allOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-500 font-bold"><i class="fa-solid fa-receipt text-3xl mb-2 block opacity-40"></i>Không có đơn hàng nào phù hợp với bộ lọc</td></tr>`;
        return;
    }

    let html = '';
    allOrders.forEach((order: any) => {
        let badge = '';
        if (order.status === 'Cancelled') {
            badge = '<span class="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 whitespace-nowrap">Đã hủy</span>';
        } else if (order.status === 'Completed' || order.paymentStatus === 'Paid') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 whitespace-nowrap">Đã thanh toán</span>';
        } else {
            badge = '<span class="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30 whitespace-nowrap">Đang phục vụ</span>';
        }

        const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        const numTable = getOrderTableDisplay(order, allTables);
        const ordId = String(order.id || order._id);
        const orderDetails = allDetails.filter((d: any) => getDetailOrderId(d) === ordId);
        const itemCount = orderDetails.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 1), 0);
        const shortId = ordId.slice(-8).toUpperCase();

        html += `
            <tr class="hover:bg-slate-700/20 transition-colors border-b border-slate-800/60">
                <td class="px-6 py-4 font-bold text-orange-400 whitespace-nowrap" title="#${ordId}">#${shortId}</td>
                <td class="px-6 py-4 font-bold text-white whitespace-nowrap">${numTable}</td>
                <td class="px-6 py-4 text-slate-400 whitespace-nowrap">${timeStr}</td>
                <td class="px-6 py-4 text-slate-300 font-bold whitespace-nowrap">${itemCount} món</td>
                <td class="px-6 py-4 text-right font-black text-white whitespace-nowrap">${formatMoney(order.totalAmount || 0)} đ</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">${badge}</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <button onclick="viewOrderDetails('${ordId}')" class="w-8 h-8 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Xem chi tiết đơn hàng #${shortId}"><i class="fa-solid fa-eye text-xs"></i></button>
                        <button onclick="printOrder('${ordId}')" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-orange-500 hover:text-white text-slate-300 border border-slate-700 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Xem mẫu in hóa đơn #${shortId}"><i class="fa-solid fa-print text-xs"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

(window as any).printOrder = (id: string) => {
    showInvoice(String(id), false);
};

// Xem chi tiết đơn hàng dạng Modal trực tiếp trên trang Đơn hàng
(window as any).viewOrderDetails = async (orderId: string) => {
    try {
        const [allOrders, allDetails, allTables] = await Promise.all([
            layTatCaDonHang(),
            layTatCaChiTietDon(),
            cachedAllTables.length > 0 ? cachedAllTables : layDanhSachBan()
        ]);

        if (menuItems.length === 0) {
            menuItems = await layDanhSachMonAn();
        }

        const ord = allOrders.find((o: any) => String(o.id || o._id) === String(orderId));
        if (!ord) {
            showWarningToast(`Không tìm thấy đơn hàng #${orderId}`);
            return;
        }

        const details = allDetails.filter((d: any) => getDetailOrderId(d) === String(ord.id || ord._id));
        const tableName = getOrderTableDisplay(ord, allTables);

        const timeStr = ord.createdAt ? new Date(ord.createdAt).toLocaleString('vi-VN', { 
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
        }) : 'N/A';

        // 1. Điền Header Modal
        const shortId = String(ord.id || ord._id).slice(-8).toUpperCase();
        const idEl = document.getElementById('ov-order-id');
        if (idEl) idEl.innerText = `Đơn hàng #${shortId}`;

        const badgeEl = document.getElementById('ov-status-badge');
        if (badgeEl) {
            if (ord.status === 'Cancelled') {
                badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30';
                badgeEl.innerText = 'Đã hủy';
            } else if (ord.status === 'Completed' || ord.paymentStatus === 'Paid') {
                badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                badgeEl.innerText = 'Đã thanh toán';
            } else {
                badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30';
                badgeEl.innerText = 'Đang phục vụ';
            }
        }

        const metaEl = document.getElementById('ov-order-meta');
        if (metaEl) metaEl.innerText = `${tableName} • Giờ vào: ${timeStr}`;

        // 2. Điền Bảng món ăn
        let itemsHtml = '';
        let subtotal = 0;

        if (details.length === 0) {
            itemsHtml = `<tr><td colspan="5" class="text-center py-6 text-slate-500 font-bold">Không có món ăn nào trong đơn hàng này</td></tr>`;
        } else {
            details.forEach((d: any) => {
                const mId = (d.menuItem_id && typeof d.menuItem_id === 'object') ? String(d.menuItem_id._id || d.menuItem_id.id) : String(d.menuItem_id);
                const mon = menuItems.find(m => String(m.id || (m as any)._id) === mId);
                const name = (d.menuItem_id && typeof d.menuItem_id === 'object' && d.menuItem_id.name) ? d.menuItem_id.name : (mon ? mon.name : (d.name || `Món #${mId.slice(-6)}`));
                const price = Number(d.priceAtOrder) || (mon ? mon.base_price : 0);
                const qty = Number(d.quantity) || 1;
                const tt = price * qty;
                if (d.status !== 'Cancelled') subtotal += tt;

                let itemStatusBadge = '';
                if (d.status === 'Pending') {
                    itemStatusBadge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">Chờ nấu</span>';
                } else if (d.status === 'Cooking') {
                    itemStatusBadge = '<span class="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold">Đang nấu</span>';
                } else if (d.status === 'Ready' || d.status === 'Served') {
                    itemStatusBadge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Đã phục vụ</span>';
                } else if (d.status === 'Cancelled') {
                    itemStatusBadge = '<span class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">Đã hủy</span>';
                } else {
                    itemStatusBadge = `<span class="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-bold">${d.status || 'N/A'}</span>`;
                }

                const notesHtml = d.notes ? `<div class="text-[10px] text-yellow-400 font-semibold italic mt-0.5">${d.notes}</div>` : '';

                itemsHtml += `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="p-3 font-bold text-white">
                            <div>${name}</div>
                            ${notesHtml}
                        </td>
                        <td class="text-center p-3 font-bold text-orange-400 text-sm">x${qty}</td>
                        <td class="text-right p-3 text-slate-300">${formatMoney(price)} đ</td>
                        <td class="text-right p-3 font-black text-white">${formatMoney(tt)} đ</td>
                        <td class="text-center p-3">${itemStatusBadge}</td>
                    </tr>
                `;
            });
        }

        const tbodyEl = document.getElementById('ov-items-tbody');
        if (tbodyEl) tbodyEl.innerHTML = itemsHtml;

        // 3. Điền Tóm tắt tiền
        const discount = Number(ord.discountAmount) || 0;
        const service = Number(ord.serviceChargeAmount) || 0;
        const vat = Number(ord.vatAmount) || 0;
        const grandTotal = Number(ord.totalAmount) || Math.max(0, subtotal - discount + service + vat);

        const subtotalEl = document.getElementById('ov-subtotal');
        if (subtotalEl) subtotalEl.innerText = `${formatMoney(subtotal)} đ`;

        const rowDisc = document.getElementById('ov-row-discount');
        const discEl = document.getElementById('ov-discount');
        if (rowDisc && discEl) {
            if (discount > 0) {
                rowDisc.classList.remove('hidden');
                discEl.innerText = `-${formatMoney(discount)} đ`;
            } else {
                rowDisc.classList.add('hidden');
            }
        }

        const rowServ = document.getElementById('ov-row-service');
        const servEl = document.getElementById('ov-service');
        if (rowServ && servEl) {
            if (service > 0) {
                rowServ.classList.remove('hidden');
                servEl.innerText = `+${formatMoney(service)} đ`;
            } else {
                rowServ.classList.add('hidden');
            }
        }

        const rowVat = document.getElementById('ov-row-vat');
        const vatEl = document.getElementById('ov-vat');
        if (rowVat && vatEl) {
            if (vat > 0) {
                rowVat.classList.remove('hidden');
                vatEl.innerText = `+${formatMoney(vat)} đ`;
            } else {
                rowVat.classList.add('hidden');
            }
        }

        const totalEl = document.getElementById('ov-total');
        if (totalEl) totalEl.innerText = `${formatMoney(grandTotal)} đ`;

        // 4. Gắn sự kiện các nút trong modal
        const btnPrint = document.getElementById('btn-ov-print');
        if (btnPrint) {
            btnPrint.onclick = () => {
                closeOrderDetailModal();
                showInvoice(String(ord.id), false);
            };
        }

        const btnGotoTable = document.getElementById('btn-ov-goto-table');
        if (btnGotoTable) {
            btnGotoTable.onclick = () => {
                closeOrderDetailModal();
                if (typeof (window as any).switchPage === 'function') {
                    (window as any).switchPage('tables');
                }
                if (ord.status !== 'Completed' && ord.status !== 'Cancelled') {
                    hienThiChiTietHoaDon(ord);
                }
            };
        }

        // Hiện modal
        const modal = document.getElementById('modal-order-view-detail');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    } catch (e) {
        console.error("Lỗi xem chi tiết đơn:", e);
        showWarningToast("Không thể tải chi tiết đơn hàng");
    }
};

const closeOrderDetailModal = () => {
    const modal = document.getElementById('modal-order-view-detail');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

document.getElementById('btn-close-order-detail')?.addEventListener('click', closeOrderDetailModal);
document.getElementById('btn-ov-close')?.addEventListener('click', closeOrderDetailModal);
document.getElementById('modal-order-view-detail')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-order-view-detail')) {
        closeOrderDetailModal();
    }
});

// ==========================================
// TÍNH NĂNG 7: TỔNG QUAN, BÁO CÁO & BIỂU ĐỒ
// ==========================================
export const updateOverviewTab = async () => {
    const allOrders = await layTatCaDonHang();
    const allTables = await layDanhSachBan();

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
    if (revEl) revEl.innerText = formatMoney(revenue) + ' đ';

    const ordEl = document.getElementById('overview-orders-count');
    if (ordEl) ordEl.innerText = ordersCount.toString();

    const activeTables = allTables.filter((t: any) => t.status === 'Occupied' || t.status === 'Waiting_Payment').length;
    const tabEl = document.getElementById('overview-active-tables');
    if (tabEl) tabEl.innerText = `${activeTables} / ${allTables.length}`;

    const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    const avgEl = document.getElementById('overview-avg-order');
    if (avgEl) avgEl.innerText = formatMoney(avg) + ' đ';
};

// ==========================================
// TÍNH NĂNG 7: THỰC ĐƠN THU NGÂN (BỘ LỌC & TÌM KIẾM)
// ==========================================
let currentCashierMenuCategory = 'all';
let currentCashierMenuStatus = 'all';
let currentCashierMenuSearch = '';
let cachedCashierMenuItems: any[] = [];
let cachedCashierCategories: any[] = [];
let isCashierMenuEventsBound = false;

export const initCashierMenuEvents = () => {
    if (isCashierMenuEventsBound) return;
    isCashierMenuEventsBound = true;

    // Search input
    const searchInput = document.getElementById('search-cashier-menu') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentCashierMenuSearch = searchInput.value.trim().toLowerCase();
            renderMenuGrid();
        });
    }

    // Status filter buttons
    document.querySelectorAll('.cashier-menu-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            currentCashierMenuStatus = target.getAttribute('data-status') || 'all';

            document.querySelectorAll('.cashier-menu-status-btn').forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white', 'shadow-sm');
                b.classList.add('text-slate-400');
            });
            target.classList.remove('text-slate-400');
            target.classList.add('bg-orange-500', 'text-white', 'shadow-sm');

            renderMenuGrid();
        });
    });

    // Refresh button
    const btnRefresh = document.getElementById('btn-refresh-cashier-menu');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            await renderMenuTab(true);
            showSuccessToast('Đã làm mới thực đơn món ăn!');
        });
    }
};

export const renderCashierCategoryPills = () => {
    const container = document.getElementById('cashier-category-pills');
    if (!container) return;

    let html = `
        <button type="button" class="cashier-cat-pill px-3 py-1.5 rounded-xl ${currentCashierMenuCategory === 'all' ? 'bg-orange-500 text-white shadow-sm' : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-700/60'} font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer" data-cat="all">
            <i class="fa-solid fa-border-all text-xs"></i> Tất cả danh mục
        </button>
    `;

    cachedCashierCategories.forEach((cat: any) => {
        const catId = String(cat.id || cat._id);
        const isActive = currentCashierMenuCategory === catId;
        const iconClass = cat.icon ? (cat.icon.startsWith('fa-') ? cat.icon : `fa-${cat.icon}`) : 'fa-utensils';
        html += `
            <button type="button" class="cashier-cat-pill px-3 py-1.5 rounded-xl ${isActive ? 'bg-orange-500 text-white shadow-sm' : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-700/60'} font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer" data-cat="${catId}">
                <i class="fa-solid ${iconClass} text-xs ${isActive ? 'text-white' : 'text-orange-400'}"></i> ${cat.name}
            </button>
        `;
    });

    // Add extra pill for Combos
    const isComboActive = currentCashierMenuCategory === 'combo';
    html += `
        <button type="button" class="cashier-cat-pill px-3 py-1.5 rounded-xl ${isComboActive ? 'bg-orange-500 text-white shadow-sm' : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-700/60'} font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer" data-cat="combo">
            <i class="fa-solid fa-boxes-stacked text-xs ${isComboActive ? 'text-white' : 'text-amber-400'}"></i> Combo Tiệc
        </button>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.cashier-cat-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            currentCashierMenuCategory = target.getAttribute('data-cat') || 'all';
            renderCashierCategoryPills();
            renderMenuGrid();
        });
    });
};

export const renderMenuGrid = () => {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;

    let items = [...cachedCashierMenuItems];

    // Filter by category
    if (currentCashierMenuCategory !== 'all') {
        if (currentCashierMenuCategory === 'combo') {
            items = items.filter((item: any) => item.is_combo === true || (item.combo_items && item.combo_items.length > 0));
        } else {
            items = items.filter((item: any) => {
                const itemCatId = (item.category_id && typeof item.category_id === 'object') 
                    ? String(item.category_id._id || item.category_id.id) 
                    : String(item.category_id || '');
                return itemCatId === currentCashierMenuCategory;
            });
        }
    }

    // Filter by status
    if (currentCashierMenuStatus === 'available') {
        items = items.filter((item: any) => item.status === 'Available' || item.status === 'Active');
    } else if (currentCashierMenuStatus === 'out_of_stock') {
        items = items.filter((item: any) => item.status !== 'Available' && item.status !== 'Active');
    }

    // Filter by search keyword
    if (currentCashierMenuSearch) {
        items = items.filter((item: any) => {
            const nameMatch = (item.name || '').toLowerCase().includes(currentCashierMenuSearch);
            const priceMatch = String(item.base_price || '').includes(currentCashierMenuSearch);
            const descMatch = (item.description || '').toLowerCase().includes(currentCashierMenuSearch);
            return nameMatch || priceMatch || descMatch;
        });
    }

    const countEl = document.getElementById('cashier-menu-stats-count');
    if (countEl) {
        countEl.innerText = `${items.length} / ${cachedCashierMenuItems.length} món`;
    }

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center text-slate-500 py-16 font-medium">
                <i class="fa-solid fa-magnifying-glass text-3xl mb-3 block opacity-40"></i>
                Không tìm thấy món ăn nào phù hợp với bộ lọc tìm kiếm
            </div>
        `;
        return;
    }

    let html = '';
    items.forEach((item: any) => {
        const isAvailable = item.status === 'Available' || item.status === 'Active';
        const isCombo = item.is_combo === true || (item.combo_items && item.combo_items.length > 0);
        
        let catName = '';
        if (isCombo) {
            catName = 'Combo Tiệc';
        } else {
            const itemCatId = (item.category_id && typeof item.category_id === 'object') 
                ? String(item.category_id._id || item.category_id.id) 
                : String(item.category_id || '');
            const foundCat = cachedCashierCategories.find((c: any) => String(c.id || c._id) === itemCatId);
            catName = foundCat ? foundCat.name : (item.category_id?.name || 'Món Âu');
        }

        html += `
            <div class="bg-[#1e293b] rounded-2xl p-4 border border-slate-700/50 shadow-md hover:border-orange-500/40 transition-all flex flex-col justify-between group">
                <div>
                    <div class="relative overflow-hidden rounded-xl mb-3">
                        <img src="${item.image}" 
                            loading="lazy" decoding="async"
                            onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'" 
                            class="w-full h-36 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300 ${!isAvailable ? 'grayscale opacity-60' : ''}">
                        
                        <div class="absolute top-2 left-2 flex flex-col gap-1 items-start">
                            <span class="bg-[#0f172a]/85 backdrop-blur-sm text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-700/80">
                                ${catName}
                            </span>
                            ${isCombo ? '<span class="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm"><i class="fa-solid fa-crown text-[9px]"></i> COMBO</span>' : ''}
                        </div>

                        <span class="absolute top-2 right-2 ${isAvailable ? 'bg-emerald-500/90 text-white border border-emerald-400/50' : 'bg-red-500/90 text-white border border-red-400/50'} text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                            ${isAvailable ? 'Còn hàng' : 'Hết hàng'}
                        </span>
                    </div>

                    <h4 class="font-bold text-white text-sm mb-1.5 line-clamp-2 leading-snug" title="${item.name}">${item.name}</h4>
                    ${item.description ? `<p class="text-[11px] text-slate-400 line-clamp-2 mb-2 leading-relaxed">${item.description}</p>` : ''}
                </div>

                <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between mt-1">
                    <span class="text-orange-400 font-black text-base">${formatMoney(item.base_price)} đ</span>
                    <span class="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">${item.station === 'bar' ? 'Quầy Bar' : (item.station === 'cold' ? 'Bếp Nguội' : 'Bếp Nóng')}</span>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
};

export const renderMenuTab = async (forceRefresh: boolean = false) => {
    initCashierMenuEvents();

    if (forceRefresh || cachedCashierMenuItems.length === 0 || cachedCashierCategories.length === 0) {
        const [items, categories] = await Promise.all([
            layDanhSachMonAn(),
            layDanhSachDanhMuc()
        ]);
        cachedCashierMenuItems = items || [];
        cachedCashierCategories = categories || [];
        renderCashierCategoryPills();
    }

    renderMenuGrid();
};

export const updateReportsTab = async () => {
    const allOrders = await layTatCaDonHang();
    const allDetails = await layTatCaChiTietDon();
    const menuList = await layDanhSachMonAn();

    const today = new Date().toDateString();
    let revenue = 0;
    let ordersCount = 0;
    let cancelledCount = 0;

    const hourlyRevenue = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyRevenue.set(i, 0);

    const itemSales = new Map<string, number>();

    allOrders.forEach((o: any) => {
        const d = new Date(o.createdAt);
        if (d.toDateString() === today) {
            if (o.paymentStatus === 'Paid') {
                revenue += o.totalAmount;
                const hour = d.getHours();
                hourlyRevenue.set(hour, (hourlyRevenue.get(hour) || 0) + o.totalAmount);
                ordersCount++;

                const ordId = String(o.id || o._id);
                const details = allDetails.filter((det: any) => getDetailOrderId(det) === ordId);
                details.forEach((det: any) => {
                    const mId = (det.menuItem_id && typeof det.menuItem_id === 'object') ? String(det.menuItem_id._id || det.menuItem_id.id) : String(det.menuItem_id);
                    itemSales.set(mId, (itemSales.get(mId) || 0) + (Number(det.quantity) || 1));
                });
            } else if (o.status === 'Cancelled') {
                cancelledCount++;
            }
        }
    });

    const revEl = document.getElementById('reports-summary-revenue');
    if (revEl) revEl.innerText = formatMoney(revenue) + ' đ';

    const ordEl = document.getElementById('reports-summary-orders');
    if (ordEl) ordEl.innerText = ordersCount.toString();

    const avgEl = document.getElementById('reports-summary-avg');
    const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    if (avgEl) avgEl.innerText = formatMoney(avg) + ' đ';

    const cancEl = document.getElementById('reports-summary-cancelled');
    if (cancEl) cancEl.innerText = cancelledCount.toString();

    const topSellingEl = document.getElementById('reports-top-selling');
    if (topSellingEl) {
        let topSellingHtml = '';
        const sortedItems = Array.from(itemSales.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const colors = ['bg-orange-500', 'bg-slate-400', 'bg-amber-500'];
        const maxSales = sortedItems.length > 0 ? sortedItems[0][1] : 1;

        sortedItems.forEach(([itemId, qty], index) => {
            const menuItem = menuList.find((m: any) => String(m.id || m._id) === String(itemId));
            const name = menuItem ? menuItem.name : 'Món ' + itemId.slice(-6);
            const color = colors[index] || 'bg-slate-500';
            const pct = Math.round((qty / maxSales) * 100);

            topSellingHtml += `
                <div class="flex items-center gap-4">
                    <div class="w-8 h-8 ${color.replace('400', '600').replace('500', '600')} rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0">
                        ${index + 1}
                    </div>
                    <span class="flex-1 text-white font-bold">${name}</span>
                    <span class="text-slate-400 font-bold text-sm">${qty} phần</span>
                    <div class="w-32 bg-slate-700 rounded-full h-2">
                        <div class="${color} h-2 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>
            `;
        });

        if (sortedItems.length === 0) {
            topSellingHtml = '<div class="text-slate-400 text-center py-4">Chưa có dữ liệu hôm nay</div>';
        }
        topSellingEl.innerHTML = topSellingHtml;
    }

    // Chart cập nhật
    const chartEl = document.getElementById('reports-chart');
    if (chartEl) {
        let maxRev = 0;
        hourlyRevenue.forEach(v => { if (v > maxRev) maxRev = v; });

        const displayHours = [8, 10, 12, 14, 16, 18];
        let html = '';
        displayHours.forEach(h => {
            const rev = hourlyRevenue.get(h) || 0;
            const pct = maxRev > 0 ? Math.max(10, Math.round((rev / maxRev) * 100)) : 10;

            let bgClass = 'bg-orange-500/30 border-orange-500/50';
            if (pct > 70) bgClass = 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
            else if (pct > 40) bgClass = 'bg-orange-500/70 border-orange-500/50';
            else if (pct > 20) bgClass = 'bg-orange-500/50 border-orange-500/50';

            html += `
                <div class="flex-1 flex flex-col items-center gap-2">
                    <div class="${bgClass} border rounded-t-lg w-full transition-all duration-500 relative group" style="height:${pct}%">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            ${formatMoney(rev)} đ
                        </div>
                    </div>
                    <span class="text-xs text-slate-500">${h}h</span>
                </div>
            `;
        });
        chartEl.innerHTML = html;
    }
};

export const updateReportsTransactions = async () => {
    const allOrders = await layTatCaDonHang();
    const tbody = document.getElementById('cashier-reports-tbody');
    if (!tbody) return;

    const recentOrders = allOrders
        .filter((o: any) => o.paymentStatus === 'Paid')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

    let html = '';
    recentOrders.forEach((o: any) => {
        const d = new Date(o.createdAt);
        const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors border-b border-slate-800/50">
                <td class="px-6 py-4 font-bold text-white whitespace-nowrap">#${o.id}</td>
                <td class="px-6 py-4 text-slate-400 whitespace-nowrap">${dateStr}</td>
                <td class="px-6 py-4 text-slate-300 whitespace-nowrap">Thanh toán</td>
                <td class="px-6 py-4 text-right font-black text-emerald-400 whitespace-nowrap">+${formatMoney(o.totalAmount)} đ</td>
                <td class="px-6 py-4 text-center whitespace-nowrap"><span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 whitespace-nowrap">Thành công</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

export const renderOverviewRecentOrders = async () => {
    const tbody = document.getElementById('overview-recent-orders-tbody');
    if (!tbody) return;

    let [allOrders, allDetails, allTables] = await Promise.all([
        layTatCaDonHang(),
        layTatCaChiTietDon().catch(() => []),
        cachedAllTables.length > 0 ? cachedAllTables : layDanhSachBan().catch(() => [])
    ]);

    const recentOrders = allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    let html = '';
    recentOrders.forEach((order: any) => {
        let badge = '';
        if (order.status === 'Completed' || order.paymentStatus === 'Paid') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 whitespace-nowrap">Đã thanh toán</span>';
        } else {
            badge = '<span class="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30 whitespace-nowrap">Đang phục vụ</span>';
        }

        const timeStr = new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const numTable = getOrderTableDisplay(order, allTables);
        const ordId = String(order.id || order._id);
        const orderDetails = allDetails.filter((d: any) => getDetailOrderId(d) === ordId);
        const itemCount = orderDetails.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 1), 0);

        html += `
            <tr class="hover:bg-slate-700/20 transition-colors border-b border-slate-800/50">
                <td class="px-6 py-4 font-bold text-white whitespace-nowrap">${numTable}</td>
                <td class="px-6 py-4 text-slate-400 whitespace-nowrap">${timeStr}</td>
                <td class="px-6 py-4 text-slate-300 whitespace-nowrap">${itemCount} món</td>
                <td class="px-6 py-4 text-right font-black text-white whitespace-nowrap">${formatMoney(order.totalAmount || 0)} đ</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">${badge}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

// ==========================================
// KHỞI CHẠY HỆ THỐNG THU NGÂN
// ==========================================
setupShiftUI();
setInterval(() => { 
    renderTableMap(); 
    renderOrdersList(); 
}, 3000);

setInterval(updateOverviewTab, 5000);
updateOverviewTab();
renderMenuTab();
setInterval(updateReportsTab, 5000);
updateReportsTab();
setInterval(updateReportsTransactions, 5000);
updateReportsTransactions();
setInterval(renderOverviewRecentOrders, 5000);
renderOverviewRecentOrders();
setInterval(renderCashFlowOverview, 5000);
renderCashFlowOverview();

