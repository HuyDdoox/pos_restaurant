import { API_INGREDIENTS_URL, API_BACKEND_URL } from './config';
import { showSuccessToast, showConfirmModal, showWarningToast } from './utils/ui';

let allIngredientsCache: any[] = [];
let lossReportsCache: any[] = []; // Cache để render lại khi DOM ready
let lossSearchTerm = '';
let lossFilterReason = 'all';
let lossFilterAlert = 'all';
let lossFilterPeriod = 'all';
let lowStockSearchTerm = '';
let lowStockFilterLevel = 'all';

export function initAdminLoss() {
    const tabs = document.querySelectorAll('.loss-tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const tabId = target.getAttribute('data-tab');
            
            // UI Toggle
            document.querySelectorAll('.loss-tab-btn').forEach(b => {
                b.classList.remove('bg-red-500', 'text-white', 'shadow-md');
                b.classList.add('bg-transparent', 'text-slate-400');
            });
            target.classList.remove('bg-transparent', 'text-slate-400');
            target.classList.add('bg-red-500', 'text-white', 'shadow-md');

            // Hide all tabs
            document.getElementById('tab-loss')?.classList.add('hidden');
            document.getElementById('tab-alert')?.classList.add('hidden');
            document.getElementById('tab-loss')?.classList.remove('flex');
            document.getElementById('tab-alert')?.classList.remove('flex');

            // Show selected
            const activeTab = document.getElementById(`tab-${tabId}`);
            if (activeTab) {
                activeTab.classList.remove('hidden');
                activeTab.classList.add('flex');
            }
        });
    });

    document.getElementById('btn-open-add-loss')?.addEventListener('click', openLossModal);
    document.getElementById('btn-close-loss-modal')?.addEventListener('click', closeLossModal);
    document.getElementById('btn-cancel-loss')?.addEventListener('click', closeLossModal);
    document.getElementById('btn-save-loss')?.addEventListener('click', handleBatchLossSubmit);
    
    // Delegate input changes for batch calculation
    document.getElementById('batch-loss-container')?.addEventListener('input', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('actual-stock-input')) {
            calculateBatchDifference(target);
        }
    });

    // Event listeners cho thanh tìm kiếm và bộ lọc Thất thoát
    const searchLossInput = document.getElementById('search-loss-report') as HTMLInputElement;
    if (searchLossInput) {
        searchLossInput.addEventListener('input', (e) => {
            lossSearchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
            renderLossReportsTable();
        });
    }

    const filterReasonSelect = document.getElementById('filter-loss-reason') as HTMLSelectElement;
    if (filterReasonSelect) {
        filterReasonSelect.addEventListener('change', () => {
            lossFilterReason = filterReasonSelect.value;
            renderLossReportsTable();
        });
    }

    const filterAlertSelect = document.getElementById('filter-loss-alert') as HTMLSelectElement;
    if (filterAlertSelect) {
        filterAlertSelect.addEventListener('change', () => {
            lossFilterAlert = filterAlertSelect.value;
            renderLossReportsTable();
        });
    }

    const filterPeriodSelect = document.getElementById('filter-loss-period') as HTMLSelectElement;
    if (filterPeriodSelect) {
        filterPeriodSelect.addEventListener('change', () => {
            lossFilterPeriod = filterPeriodSelect.value;
            renderLossReportsTable();
        });
    }

    const btnResetFilters = document.getElementById('btn-reset-loss-filters');
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', resetLossFilters);
    }

    // Event listeners cho Cảnh báo kho
    const searchLowStockInput = document.getElementById('search-low-stock') as HTMLInputElement;
    if (searchLowStockInput) {
        searchLowStockInput.addEventListener('input', (e) => {
            lowStockSearchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
            renderLowStockAlerts();
        });
    }

    const filterLowStockSelect = document.getElementById('filter-low-stock-level') as HTMLSelectElement;
    if (filterLowStockSelect) {
        filterLowStockSelect.addEventListener('change', () => {
            lowStockFilterLevel = filterLowStockSelect.value;
            renderLowStockAlerts();
        });
    }

    // Lắng nghe sự kiện chuyển trang — đảm bảo luôn render đúng khi tab được mở
    window.addEventListener('pageChanged', async (e: any) => {
        if (e.detail === 'loss-report') {
            await loadLossData();
        }
    });
}

function resetLossFilters() {
    lossSearchTerm = '';
    lossFilterReason = 'all';
    lossFilterAlert = 'all';
    lossFilterPeriod = 'all';

    const searchInput = document.getElementById('search-loss-report') as HTMLInputElement;
    const reasonSelect = document.getElementById('filter-loss-reason') as HTMLSelectElement;
    const alertSelect = document.getElementById('filter-loss-alert') as HTMLSelectElement;
    const periodSelect = document.getElementById('filter-loss-period') as HTMLSelectElement;

    if (searchInput) searchInput.value = '';
    if (reasonSelect) reasonSelect.value = 'all';
    if (alertSelect) alertSelect.value = 'all';
    if (periodSelect) periodSelect.value = 'all';

    renderLossReportsTable();
}

function populateLossReasonOptions() {
    const select = document.getElementById('filter-loss-reason') as HTMLSelectElement;
    if (!select) return;
    const currentVal = select.value;
    
    const uniqueReasons = Array.from(new Set(
        lossReportsCache.map(r => (r.reason || '').trim()).filter(Boolean)
    ));
    
    let html = `<option value="all">Tất cả lý do</option>`;
    uniqueReasons.forEach(reason => {
        html += `<option value="${reason}">${reason}</option>`;
    });
    
    select.innerHTML = html;
    if (currentVal && (currentVal === 'all' || uniqueReasons.includes(currentVal))) {
        select.value = currentVal;
    }
}

export async function loadLossData() {
    try {
        const res = await fetch(API_INGREDIENTS_URL);
        const json = await res.json();
        allIngredientsCache = Array.isArray(json) ? json : (json.data || []);
    } catch (err) {
        console.error("Lỗi khi tải nguyên liệu:", err);
    }
    
    renderLowStockAlerts();
    await loadLossReports();
}

function renderLowStockAlerts() {
    const allLow = allIngredientsCache.filter(i => Number(i.stock_quantity) < 10);
    const badge = document.getElementById('low-stock-badge');
    if (badge) {
        badge.innerText = allLow.length.toString();
        if (allLow.length > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    const filtered = allLow.filter(i => {
        const matchesSearch = !lowStockSearchTerm || 
            (i.name || '').toLowerCase().includes(lowStockSearchTerm) ||
            (String(i.id) || '').toLowerCase().includes(lowStockSearchTerm);
        
        let matchesLevel = true;
        const qty = Number(i.stock_quantity);
        if (lowStockFilterLevel === 'empty') matchesLevel = qty <= 0;
        else if (lowStockFilterLevel === 'critical') matchesLevel = qty > 0 && qty <= 5;
        else if (lowStockFilterLevel === 'low') matchesLevel = qty > 5 && qty < 10;
        
        return matchesSearch && matchesLevel;
    });

    const tbody = document.getElementById('low-stock-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-500 font-bold">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i class="fa-solid fa-boxes-stacked text-3xl text-slate-600"></i>
                        <p class="text-slate-400">Không có nguyên liệu nào phù hợp bộ lọc cảnh báo</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(ing => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200">
            <td class="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">#${ing.id}</td>
            <td class="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">${ing.name}</td>
            <td class="px-6 py-4 text-right text-xl font-black whitespace-nowrap ${Number(ing.stock_quantity) <= 0 ? 'text-rose-600' : 'text-red-600'}">${ing.stock_quantity}</td>
            <td class="px-6 py-4 text-slate-600 font-bold whitespace-nowrap">${ing.unit}</td>
            <td class="px-6 py-4 text-center whitespace-nowrap">
                <span class="px-3 py-1 ${Number(ing.stock_quantity) <= 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-red-50 text-red-700 border border-red-200'} rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap">
                    ${Number(ing.stock_quantity) <= 0 ? 'Hết hàng' : 'Cần nhập gấp'}
                </span>
            </td>
        </tr>
    `).join('');
}

async function loadLossReports() {
    try {
        const res = await fetch(`${API_BACKEND_URL}/loss-reports`);
        if (!res.ok) return;
        const json = await res.json();
        let data = Array.isArray(json) ? json : (json.data || []);
        lossReportsCache = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        populateLossReasonOptions();
        renderLossReportsTable(); // Render nếu DOM đã sẵn sàng
    } catch (err) {
        console.error("Lỗi khi tải báo cáo thất thoát:", err);
    }
}

function getFilteredLossReports() {
    const now = new Date();
    return lossReportsCache.filter((r: any) => {
        // 1. Tìm kiếm (Tên NL, Lý do, Mã NL, Ngày)
        const name = (r.ingredientName || '').toLowerCase();
        const reason = (r.reason || '').toLowerCase();
        const id = (r.ingredientId || '').toLowerCase();
        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '';
        const matchesSearch = !lossSearchTerm || 
            name.includes(lossSearchTerm) || 
            reason.includes(lossSearchTerm) || 
            id.includes(lossSearchTerm) ||
            dateStr.includes(lossSearchTerm);

        // 2. Lọc theo Lý do
        let matchesReason = true;
        if (lossFilterReason !== 'all') {
            matchesReason = reason.includes(lossFilterReason.toLowerCase());
        }

        // 3. Lọc theo Mức độ cảnh báo
        let matchesAlert = true;
        if (lossFilterAlert === 'abnormal') {
            matchesAlert = r.isAbnormal === true || String(r.isAbnormal) === 'true';
        } else if (lossFilterAlert === 'normal') {
            matchesAlert = !r.isAbnormal || String(r.isAbnormal) === 'false';
        }

        // 4. Lọc theo Thời gian
        let matchesPeriod = true;
        if (lossFilterPeriod !== 'all' && r.createdAt) {
            const reportDate = new Date(r.createdAt);
            if (lossFilterPeriod === 'today') {
                matchesPeriod = reportDate.toDateString() === now.toDateString();
            } else if (lossFilterPeriod === '7days') {
                const diffDays = Math.abs(now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24);
                matchesPeriod = diffDays <= 7;
            } else if (lossFilterPeriod === 'this_month') {
                matchesPeriod = reportDate.getFullYear() === now.getFullYear() && reportDate.getMonth() === now.getMonth();
            }
        }

        return matchesSearch && matchesReason && matchesAlert && matchesPeriod;
    });
}

// Tách riêng để có thể gọi lại khi DOM sẵn sàng
export function renderLossReportsTable() {
    const tbody = document.getElementById('loss-table-body');
    if (!tbody) {
        return; // DOM chưa visible, bỏ qua
    }

    const filtered = getFilteredLossReports();

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center text-slate-500 font-bold">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <svg class="w-8 h-8 text-slate-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <p class="text-slate-400">Không tìm thấy phiếu kiểm kê nào phù hợp bộ lọc</p>
                        <button type="button" id="btn-clear-loss-empty" class="mt-2 text-xs text-red-400 hover:text-red-300 underline font-semibold cursor-pointer">
                            Xóa bộ lọc để xem tất cả
                        </button>
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('btn-clear-loss-empty')?.addEventListener('click', resetLossFilters);
        return;
    }

    const html = filtered.map((r: any) => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200">
                <td class="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</td>
                <td class="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">${r.ingredientName}</td>
                <td class="px-6 py-4 text-right text-slate-600 whitespace-nowrap">${r.systemStock} ${r.unit}</td>
                <td class="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">${r.actualStock} ${r.unit}</td>
                <td class="px-6 py-4 text-right whitespace-nowrap ${r.lossAmount > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}">${r.lossAmount > 0 ? '-' : '+'}${Math.abs(r.lossAmount)} ${r.unit}</td>
                <td class="px-6 py-4 text-right text-orange-600 font-bold whitespace-nowrap">${r.lossCost ? r.lossCost.toLocaleString('vi-VN') + ' đ' : '0 đ'}</td>
                <td class="px-6 py-4 text-slate-600 text-xs whitespace-nowrap">
                    ${r.reason || 'Kiểm kê định kỳ'}
                </td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    ${r.isAbnormal ? '<span class="px-2.5 py-1 bg-rose-50 text-rose-700 rounded text-[10px] font-black uppercase tracking-wider border border-rose-200 whitespace-nowrap">Vượt định mức</span>' : '<span class="text-slate-400 text-xs">-</span>'}
                </td>
            </tr>
        `).join('');
    tbody.innerHTML = html;
}

function openLossModal() {
    const container = document.getElementById('batch-loss-container');
    if (container) {
        container.innerHTML = allIngredientsCache.map(ing => `
            <div class="batch-loss-row grid grid-cols-12 gap-4 items-center p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors" data-id="${ing.id}" data-name="${ing.name}" data-sys-stock="${ing.stock_quantity}" data-unit="${ing.unit}" data-cost="${ing.cost_per_unit || 0}">
                <div class="col-span-3 font-bold text-slate-900 text-sm flex items-center">
                    <div class="w-2 h-2 rounded-full ${ing.stock_quantity > 0 ? 'bg-emerald-500' : 'bg-red-500'} mr-2"></div>
                    ${ing.name}
                </div>
                <div class="col-span-2 text-right font-black text-slate-600 text-sm">
                    ${ing.stock_quantity} <span class="text-xs font-normal">${ing.unit}</span>
                </div>
                <div class="col-span-2 text-right">
                    <input type="number" step="0.01" min="0" class="actual-stock-input w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-900 text-right text-sm font-bold focus:outline-none focus:border-red-500 focus:bg-white" placeholder="${ing.stock_quantity}">
                </div>
                <div class="col-span-2 text-right">
                    <span class="diff-text text-slate-400 text-sm font-bold">0</span>
                </div>
                <div class="col-span-3">
                    <input type="text" class="reason-input w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-red-500 focus:bg-white" placeholder="Lý do...">
                </div>
            </div>
        `).join('');
        
        const costEl = document.getElementById('batch-total-cost');
        if (costEl) costEl.innerText = '0 đ';
    }

    const modal = document.getElementById('modal-loss-form');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }
}

function closeLossModal() {
    const modal = document.getElementById('modal-loss-form');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
}

function calculateBatchDifference(inputEl: HTMLElement) {
    const row = inputEl.closest('.batch-loss-row') as HTMLElement;
    const sysStock = parseFloat(row.getAttribute('data-sys-stock') || '0');
    const inputVal = (inputEl as HTMLInputElement).value;
    
    const diffEl = row.querySelector('.diff-text') as HTMLElement;
    if (inputVal === '') {
        diffEl.innerText = '0';
        diffEl.className = 'diff-text text-slate-500 text-sm font-bold';
        row.removeAttribute('data-loss');
        row.removeAttribute('data-loss-cost');
        calculateTotalBatchCost();
        return;
    }

    const actualStock = parseFloat(inputVal);
    const diff = sysStock - actualStock;
    const costPerUnit = parseFloat(row.getAttribute('data-cost') || '0');
    
    // PA3: Calculate abnormal loss (e.g. > 5%)
    const lossPercent = sysStock > 0 ? (diff / sysStock) * 100 : 0;
    const ALLOWED_LOSS_PERCENT = 5; // Default 5%
    const isAbnormal = lossPercent > ALLOWED_LOSS_PERCENT;
    
    const reasonInput = row.querySelector('.reason-input') as HTMLInputElement;

    if (diff > 0) {
        diffEl.innerText = `-${diff}`;
        diffEl.className = 'diff-text text-red-400 text-sm font-black';
        row.setAttribute('data-loss', diff.toString());
        row.setAttribute('data-loss-cost', (diff * costPerUnit).toString());
        
        if (isAbnormal) {
            row.classList.add('bg-red-500/10', 'border-red-500/50');
            row.classList.remove('border-slate-100');
            row.setAttribute('data-warning', 'true');
            reasonInput.placeholder = "BẮT BUỘC NHẬP LÝ DO (Vượt định mức 5%)";
            reasonInput.classList.add('border-red-500', 'bg-red-500/10');
            reasonInput.classList.remove('border-slate-200', 'bg-slate-50');
        } else {
            row.classList.remove('bg-red-500/10', 'border-red-500/50');
            row.classList.add('border-slate-100');
            row.removeAttribute('data-warning');
            reasonInput.placeholder = "Lý do...";
            reasonInput.classList.remove('border-red-500', 'bg-red-500/10');
            reasonInput.classList.add('border-slate-200', 'bg-slate-50');
        }

    } else if (diff < 0) {
        diffEl.innerText = `+${Math.abs(diff)}`;
        diffEl.className = 'diff-text text-emerald-400 text-sm font-black';
        row.setAttribute('data-loss', diff.toString()); // negative diff means surplus
        row.setAttribute('data-loss-cost', '0');
        row.classList.remove('bg-red-500/10', 'border-red-500/50');
        row.classList.add('border-slate-100');
        row.removeAttribute('data-warning');
        reasonInput.placeholder = "Lý do...";
        reasonInput.classList.remove('border-red-500', 'bg-red-500/10');
        reasonInput.classList.add('border-slate-200', 'bg-slate-50');
    } else {
        diffEl.innerText = '0';
        diffEl.className = 'diff-text text-slate-500 text-sm font-bold';
        row.removeAttribute('data-loss');
        row.removeAttribute('data-loss-cost');
    }

    calculateTotalBatchCost();
}

function calculateTotalBatchCost() {
    let total = 0;
    document.querySelectorAll('.batch-loss-row').forEach(row => {
        const cost = parseFloat(row.getAttribute('data-loss-cost') || '0');
        total += cost;
    });
    
    const costEl = document.getElementById('batch-total-cost');
    if (costEl) {
        costEl.innerText = total.toLocaleString('vi-VN') + ' đ';
    }
}

async function handleBatchLossSubmit(e: Event) {
    e.preventDefault();
    
    const rows = document.querySelectorAll('.batch-loss-row');
    const changedItems: any[] = [];
    
    let hasValidationError = false;
    
    rows.forEach(row => {
        const input = row.querySelector('.actual-stock-input') as HTMLInputElement;
        const reasonInput = row.querySelector('.reason-input') as HTMLInputElement;
        
        if (input.value !== '') {
            const actualStock = parseFloat(input.value);
            const sysStock = parseFloat(row.getAttribute('data-sys-stock') || '0');
            if (actualStock !== sysStock) {
                const isAbnormal = row.getAttribute('data-warning') === 'true';
                const reason = reasonInput.value.trim();
                
                if (isAbnormal && reason.length < 3) {
                    showWarningToast(`Hao hụt vượt định mức! Vui lòng ghi rõ lý do cho: ${row.getAttribute('data-name')}`);
                    reasonInput.focus();
                    hasValidationError = true;
                    return;
                }

                changedItems.push({
                    ingredientId: row.getAttribute('data-id'),
                    ingredientName: row.getAttribute('data-name'),
                    systemStock: sysStock,
                    actualStock: actualStock,
                    lossAmount: sysStock - actualStock,
                    lossCost: parseFloat(row.getAttribute('data-loss-cost') || '0'),
                    unit: row.getAttribute('data-unit'),
                    reason: reason || 'Cân bằng kho định kỳ',
                    isAbnormal: isAbnormal
                });
            }
        }
    });

    if (hasValidationError) return;

    if (changedItems.length === 0) {
        showWarningToast('Không có thay đổi nào để lưu');
        return;
    }

    const isConfirmed = await showConfirmModal("Xác nhận Kiểm Kê", `Bạn đang lưu thay đổi cho ${changedItems.length} nguyên liệu. Tiếp tục?`);
    if (!isConfirmed) return;

    try {
        const btnSave = document.getElementById('btn-save-loss') as HTMLButtonElement;
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = 'Đang lưu...';
        btnSave.disabled = true;

        const promises = [];

        // Batch Update
        for (const item of changedItems) {
            const report = {
                ...item,
                createdAt: new Date().toISOString()
            };
            
            // Save report
            promises.push(
                fetch(`${API_BACKEND_URL}/loss-reports`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(report)
                })
            );

            // Update ingredient stock
            promises.push(
                fetch(`${API_INGREDIENTS_URL}/${item.ingredientId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stock_quantity: item.actualStock })
                })
            );
        }

        await Promise.all(promises);

        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
        
        closeLossModal();
        showSuccessToast(`Đã cập nhật ${changedItems.length} nguyên liệu`);
        loadLossData(); // Reload all data
        
    } catch (err) {
        console.error(err);
        showWarningToast('Có lỗi xảy ra khi lưu');
        const btnSave = document.getElementById('btn-save-loss') as HTMLButtonElement;
        btnSave.innerHTML = 'Lưu Phiếu Kiểm Kê';
        btnSave.disabled = false;
    }
}
