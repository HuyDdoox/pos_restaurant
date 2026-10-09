import { API_INGREDIENTS_URL } from './config';
import { showSuccessToast, showConfirmModal, showWarningToast } from './utils/ui';

let allIngredientsCache: any[] = [];
let lossReportsCache: any[] = []; // Cache để render lại khi DOM ready

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

    // Lắng nghe sự kiện chuyển trang — đảm bảo luôn render đúng khi tab được mở
    window.addEventListener('pageChanged', async (e: any) => {
        if (e.detail === 'loss-report') {
            await loadLossData();
        }
    });
}

export async function loadLossData() {
    try {
        const res = await fetch(API_INGREDIENTS_URL);
        allIngredientsCache = await res.json();
    } catch (err) {
        console.error("Lỗi khi tải nguyên liệu:", err);
    }
    
    renderLowStockAlerts();
    await loadLossReports();
}

function renderLowStockAlerts() {
    const lowStock = allIngredientsCache.filter(i => i.stock_quantity < 10);
    const badge = document.getElementById('low-stock-badge');
    if (badge) {
        badge.innerText = lowStock.length.toString();
        if (lowStock.length > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    const tbody = document.getElementById('low-stock-table-body');
    if (tbody) {
        tbody.innerHTML = lowStock.map(ing => `
            <tr class="hover:bg-slate-800/50 transition-colors">
                <td class="px-6 py-4 text-slate-400 font-medium">#${ing.id}</td>
                <td class="px-6 py-4">${ing.name}</td>
                <td class="px-6 py-4 text-right text-xl text-red-400">${ing.stock_quantity}</td>
                <td class="px-6 py-4 text-slate-400">${ing.unit}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold uppercase tracking-wider">Cần nhập gấp</span>
                </td>
            </tr>
        `).join('');
    }
}

async function loadLossReports() {
    try {
        const res = await fetch("http://localhost:3000/LossReports");
        if (!res.ok) return;
        let data = await res.json(); // Lấy data thô
        // Tự sort bằng JS vì json-server đôi khi lỗi trả về mảng rỗng khi dùng _sort
        lossReportsCache = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        renderLossReportsTable(); // Render nếu DOM đã sẵn sàng
    } catch (err) {
        console.error("Lỗi khi tải báo cáo thất thoát:", err);
    }
}

// Tách riêng để có thể gọi lại khi DOM sẵn sàng
export function renderLossReportsTable() {
    const tbody = document.getElementById('loss-table-body');
    if (!tbody) {
        return; // DOM chưa visible, bỏ qua
    }

    const html = lossReportsCache.map((r: any) => `
            <tr class="hover:bg-slate-800/50 transition-colors">
                <td class="px-6 py-4 text-slate-400 font-medium">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</td>
                <td class="px-6 py-4">${r.ingredientName}</td>
                <td class="px-6 py-4 text-right text-slate-400">${r.systemStock} ${r.unit}</td>
                <td class="px-6 py-4 text-right">${r.actualStock} ${r.unit}</td>
                <td class="px-6 py-4 text-right ${r.lossAmount > 0 ? 'text-red-400' : 'text-emerald-400'}">${r.lossAmount > 0 ? '-' : '+'}${Math.abs(r.lossAmount)} ${r.unit}</td>
                <td class="px-6 py-4 text-right text-orange-400 font-bold">${r.lossCost ? r.lossCost.toLocaleString('vi-VN') + ' đ' : '0 đ'}</td>
                <td class="px-6 py-4 text-slate-400 text-xs">
                    ${r.reason}
                </td>
                <td class="px-6 py-4 text-center">
                    ${r.isAbnormal ? '<span class="px-2 py-1 bg-red-500/20 text-red-500 rounded text-[10px] font-black uppercase tracking-wider">Vượt định mức</span>' : '-'}
                </td>
            </tr>
        `).join('');
    tbody.innerHTML = html;
}

function openLossModal() {
    const container = document.getElementById('batch-loss-container');
    if (container) {
        container.innerHTML = allIngredientsCache.map(ing => `
            <div class="batch-loss-row grid grid-cols-12 gap-4 items-center p-3 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors" data-id="${ing.id}" data-name="${ing.name}" data-sys-stock="${ing.stock_quantity}" data-unit="${ing.unit}" data-cost="${ing.cost_per_unit || 0}">
                <div class="col-span-3 font-bold text-white text-sm flex items-center">
                    <div class="w-2 h-2 rounded-full ${ing.stock_quantity > 0 ? 'bg-emerald-500' : 'bg-red-500'} mr-2"></div>
                    ${ing.name}
                </div>
                <div class="col-span-2 text-right font-black text-slate-400 text-sm">
                    ${ing.stock_quantity} <span class="text-xs font-normal">${ing.unit}</span>
                </div>
                <div class="col-span-2 text-right">
                    <input type="number" step="0.01" min="0" class="actual-stock-input w-full bg-[#0f172a] border border-slate-600 rounded px-2 py-1.5 text-white text-right text-sm font-bold focus:outline-none focus:border-red-500" placeholder="${ing.stock_quantity}">
                </div>
                <div class="col-span-2 text-right">
                    <span class="diff-text text-slate-500 text-sm font-bold">0</span>
                </div>
                <div class="col-span-3">
                    <input type="text" class="reason-input w-full bg-[#0f172a] border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-red-500" placeholder="Lý do...">
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
            row.classList.remove('border-slate-700/50');
            row.setAttribute('data-warning', 'true');
            reasonInput.placeholder = "BẮT BUỘC NHẬP LÝ DO (Vượt định mức 5%)";
            reasonInput.classList.add('border-red-500', 'bg-red-500/10');
            reasonInput.classList.remove('border-slate-600', 'bg-[#0f172a]');
        } else {
            row.classList.remove('bg-red-500/10', 'border-red-500/50');
            row.classList.add('border-slate-700/50');
            row.removeAttribute('data-warning');
            reasonInput.placeholder = "Lý do...";
            reasonInput.classList.remove('border-red-500', 'bg-red-500/10');
            reasonInput.classList.add('border-slate-600', 'bg-[#0f172a]');
        }

    } else if (diff < 0) {
        diffEl.innerText = `+${Math.abs(diff)}`;
        diffEl.className = 'diff-text text-emerald-400 text-sm font-black';
        row.setAttribute('data-loss', diff.toString()); // negative diff means surplus
        row.setAttribute('data-loss-cost', '0');
        row.classList.remove('bg-red-500/10', 'border-red-500/50');
        row.classList.add('border-slate-700/50');
        row.removeAttribute('data-warning');
        reasonInput.placeholder = "Lý do...";
        reasonInput.classList.remove('border-red-500', 'bg-red-500/10');
        reasonInput.classList.add('border-slate-600', 'bg-[#0f172a]');
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
                fetch("http://localhost:3000/LossReports", {
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
