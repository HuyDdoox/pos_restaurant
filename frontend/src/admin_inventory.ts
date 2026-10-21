import { showConfirmModal, showSuccessToast, showNumberPromptModal } from './utils/ui';
import { syncMenuItemsStockStatus } from './inventory_engine';
import { API_BACKEND_URL } from './config';

// API URL
const JSON_SERVER = API_BACKEND_URL;

// State Management (Cache data)
let inventoryIngredients: any[] = [];
let inventoryMenuItems: any[] = [];
let currentInventoryTab = 'inventory'; // 'inventory' | 'recipe'
let selectedRecipeMenuItemId: string | null = null;

// Initialize on DOM Load or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initInventoryModule();
    });
} else {
    initInventoryModule();
}

// Hook vào sự kiện switchPage từ admin.html nếu có
window.addEventListener('pageChanged', (e: any) => {
    if (e.detail === 'inventory') {
        initInventoryModule();
    }
});

export function initInventoryModule() {
    loadIngredients();
    loadMenuItemsForRecipe();
    syncMenuItemsStockStatus();
    
    // Gắn sự kiện duy nhất vào container (Event Delegation)
    const container = document.getElementById('inventory-container');
    if (!container) return;
    
    // Tránh gắn nhiều lần
    if (container.getAttribute('data-events-bound')) return;
    
    container.addEventListener('click', handleInventoryClick);
    container.addEventListener('dblclick', handleInventoryDblClick);
    container.setAttribute('data-events-bound', 'true');
    
    // Tab buttons event
    const tabBtns = document.querySelectorAll('.inv-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = (e.currentTarget as HTMLElement).getAttribute('data-tab');
            if (tabName) switchInventoryTab(tabName, tabBtns);
        });
    });

    // Close Modals
    document.getElementById('btn-close-ingredient-modal')?.addEventListener('click', closeIngredientModal);
    document.getElementById('btn-cancel-ingredient')?.addEventListener('click', closeIngredientModal);
    
    // Save Ingredient
    document.getElementById('btn-save-ingredient')?.addEventListener('click', saveBatchIngredients);
    
    // Search and Filter (Inventory)
    document.getElementById('search-inventory')?.addEventListener('input', applyInventoryFilters);
    document.getElementById('filter-inventory-status')?.addEventListener('change', applyInventoryFilters);
    
    // Search (Recipe Menu)
    document.getElementById('search-recipe-menu')?.addEventListener('input', applyRecipeMenuFilters);

    // Import Excel
    const btnImportExcel = document.getElementById('btn-import-excel');
    const inputExcel = document.getElementById('input-excel-inventory') as HTMLInputElement;
    if (btnImportExcel && inputExcel) {
        // Prevent multiple bindings
        if (!btnImportExcel.getAttribute('data-events-bound')) {
            btnImportExcel.addEventListener('click', () => {
                inputExcel.click();
            });
            inputExcel.addEventListener('change', handleExcelImport);
            btnImportExcel.setAttribute('data-events-bound', 'true');
        }
    }
}

async function handleExcelImport(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
            showToast('Lỗi thư viện Excel. Vui lòng tải lại trang.', 'error');
            return;
        }

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to JSON, header: 1 means array of arrays
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Bỏ qua dòng tiêu đề (index 0)
        const rows = json.slice(1);
        const validIngredients: any[] = [];

        rows.forEach((row: any[]) => {
            const name = row[0]?.toString().trim();
            const stockStr = row[1]?.toString().trim();
            const unit = row[2]?.toString().trim();
            const costStr = row[3]?.toString().trim() || '0';

            if (name && stockStr && unit) {
                const stockNum = parseFloat(stockStr);
                const costNum = parseFloat(costStr);
                if (!isNaN(stockNum)) {
                    const transformed = transformUnitBeforeSave(stockNum, unit);
                    validIngredients.push({
                        name,
                        stock_quantity: transformed.quantity,
                        unit: transformed.unit,
                        cost_per_unit: isNaN(costNum) ? 0 : costNum,
                        status: 'Active'
                    });
                }
            }
        });

        if (validIngredients.length === 0) {
            showToast('Không tìm thấy dữ liệu hợp lệ trong file Excel.', 'error');
            target.value = '';
            return;
        }

        const isConfirmed = await showConfirmModal("Xác nhận", `Tìm thấy ${validIngredients.length} nguyên liệu hợp lệ. Bạn có muốn nhập vào hệ thống?`);
        if (!isConfirmed) {
            target.value = '';
            return;
        }

        // Send to server
        const btnImportExcel = document.getElementById('btn-import-excel') as HTMLButtonElement;
        const originalText = btnImportExcel.innerHTML;
        btnImportExcel.innerHTML = 'Đang xử lý...';
        btnImportExcel.disabled = true;

        await Promise.all(validIngredients.map(ing => 
            fetch(`${JSON_SERVER}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ing)
            })
        ));

        btnImportExcel.innerHTML = originalText;
        btnImportExcel.disabled = false;
        target.value = ''; // Reset input

        loadIngredients();
        await syncMenuItemsStockStatus();
        showToast(`Đã nhập ${validIngredients.length} nguyên liệu từ Excel thành công!`, 'success');

    } catch (err) {
        console.error(err);
        showToast('Có lỗi xảy ra khi đọc file Excel', 'error');
        target.value = '';
        const btnImportExcel = document.getElementById('btn-import-excel') as HTMLButtonElement;
        if(btnImportExcel) {
            btnImportExcel.innerHTML = `<i class="fa-solid fa-magnifying-glass text-sm"></i> Nhập Excel`;
            btnImportExcel.disabled = false;
        }
    }
}

function applyRecipeMenuFilters() {
    const searchInput = (document.getElementById('search-recipe-menu') as HTMLInputElement)?.value.toLowerCase() || '';
    const filtered = inventoryMenuItems.filter(item => String(item.name).toLowerCase().includes(searchInput));
    renderRecipeMenuItems(filtered);
}

function applyInventoryFilters() {
    const searchInput = (document.getElementById('search-inventory') as HTMLInputElement)?.value.toLowerCase() || '';
    const statusSelect = (document.getElementById('filter-inventory-status') as HTMLSelectElement)?.value || 'all';

    const filtered = inventoryIngredients.filter(ing => {
        const matchName = String(ing.name).toLowerCase().includes(searchInput);
        
        let matchStatus = true;
        if (statusSelect === 'in_stock') {
            matchStatus = Number(ing.stock_quantity) > 0;
        } else if (statusSelect === 'out_of_stock') {
            matchStatus = Number(ing.stock_quantity) <= 0;
        }

        return matchName && matchStatus;
    });

    renderIngredientsTable(filtered);
}

// ----------------------------------------------------
// TABS & UI LOGIC
// ----------------------------------------------------
function switchInventoryTab(tabName: string, allBtns: NodeListOf<Element>) {
    currentInventoryTab = tabName;
    
    // Cập nhật UI nút
    allBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('bg-orange-500', 'text-white', 'shadow-md');
            btn.classList.remove('bg-transparent', 'text-slate-400');
        } else {
            btn.classList.remove('bg-orange-500', 'text-white', 'shadow-md');
            btn.classList.add('bg-transparent', 'text-slate-400');
        }
    });

    // Cập nhật nội dung tab
    const tabInv = document.getElementById('tab-inventory');
    const tabRec = document.getElementById('tab-recipe');
    
    if (tabName === 'inventory') {
        tabInv?.classList.remove('hidden');
        tabRec?.classList.add('hidden');
    } else {
        tabInv?.classList.add('hidden');
        tabRec?.classList.remove('hidden');
        loadMenuItemsForRecipe();
    }
}

async function handleInventoryDblClick(e: Event) {
    const target = e.target as HTMLElement;
    
    // --- NGUYÊN LIỆU (TAB 1) ---
    const editableIngCell = target.closest('.editable-ingredient-cell') as HTMLElement;
    if (editableIngCell && !editableIngCell.querySelector('input')) {
        const id = editableIngCell.getAttribute('data-id')!;
        const field = editableIngCell.getAttribute('data-field')!;
        const origValue = editableIngCell.getAttribute('data-value')!;
        
        if (field === 'name') {
            editableIngCell.innerHTML = `
                <div class="flex items-center gap-2">
                    <input type="text" class="edit-ing-input w-full bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500 focus:bg-white" value="${origValue}">
                    <button class="btn-save-ing p-1 text-emerald-600 hover:bg-emerald-50 rounded"><i class="fa-solid fa-circle-info text-sm"></i></button>
                    <button class="btn-cancel-ing p-1 text-slate-400 hover:bg-slate-100 rounded"><i class="fa-solid fa-pen-to-square text-sm"></i></button>
                </div>
            `;
        } else if (field === 'cost_per_unit') {
            editableIngCell.innerHTML = `
                <div class="flex items-center justify-end gap-2">
                    <input type="number" class="edit-ing-input w-24 bg-slate-50 border border-slate-200 text-slate-900 rounded px-2 py-1 text-right text-sm focus:outline-none focus:border-orange-500 focus:bg-white" value="${origValue}">
                    <button class="btn-save-ing p-1 text-emerald-600 hover:bg-emerald-50 rounded"><i class="fa-solid fa-circle-info text-sm"></i></button>
                    <button class="btn-cancel-ing p-1 text-slate-400 hover:bg-slate-100 rounded"><i class="fa-solid fa-pen-to-square text-sm"></i></button>
                </div>
            `;
        }
        
        const input = editableIngCell.querySelector('input') as HTMLInputElement;
        input.focus();
        input.select();
        
        const cancelEdit = () => { renderIngredientsTable(); };
        const saveEdit = async () => {
            let newVal: any = input.value.trim();
            if (field === 'cost_per_unit') {
                newVal = parseFloat(newVal);
                if (isNaN(newVal) || newVal < 0) {
                    showConfirmModal("Lỗi", "Giá trị không hợp lệ");
                    return;
                }
            } else {
                if (!newVal) {
                    showConfirmModal("Lỗi", "Tên không được để trống");
                    return;
                }
            }
            
            if (newVal == origValue) {
                cancelEdit();
                return;
            }
            
            const fieldName = field === 'name' ? 'Tên nguyên liệu' : 'Giá nhập';
            const displayVal = field === 'cost_per_unit' ? newVal.toLocaleString('vi-VN') + ' đ' : newVal;
            const isConfirmed = await showConfirmModal("Xác nhận thay đổi", `Bạn muốn đổi ${fieldName} thành: ${displayVal}?`);
            if (!isConfirmed) {
                cancelEdit();
                return;
            }
            
            try {
                const res = await fetch(`${JSON_SERVER}/inventory/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: newVal })
                });
                if (res.ok) {
                    showSuccessToast(`Đã cập nhật ${fieldName}`);
                    const ing = inventoryIngredients.find(i => i.id === id);
                    if (ing) ing[field] = newVal;
                    renderIngredientsTable();
                    updateRecipeIngredientSelect();
                    if (field === 'cost_per_unit' && currentInventoryTab === 'recipe' && selectedRecipeMenuItemId) {
                        loadRecipeForMenu(selectedRecipeMenuItemId);
                    }
                }
            } catch (e) {
                showConfirmModal("Lỗi", "Không thể lưu dữ liệu");
            }
        };
        
        editableIngCell.querySelector('.btn-cancel-ing')?.addEventListener('click', (e) => { e.stopPropagation(); cancelEdit(); });
        editableIngCell.querySelector('.btn-save-ing')?.addEventListener('click', (e) => { e.stopPropagation(); saveEdit(); });
        input.addEventListener('keyup', (e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') cancelEdit(); });
        return;
    }

    // --- ĐỊNH LƯỢNG (TAB 2) ---
    const editableCell = target.closest('.editable-recipe-cell') as HTMLElement;
    if (!editableCell) return;
    if (editableCell.querySelector('input')) return; // Đang edit

    const recipeId = editableCell.getAttribute('data-id')!;
    const origQty = editableCell.getAttribute('data-qty')!;
    const origUnit = editableCell.getAttribute('data-unit')!;
    const baseUnit = editableCell.getAttribute('data-base-unit')!;
    
    let options = '';
    if (baseUnit === 'g' || baseUnit === 'kg') {
        options = `<option value="g">g</option><option value="kg">kg</option>`;
    } else if (baseUnit === 'ml' || baseUnit === 'lít') {
        options = `<option value="ml">ml</option><option value="lít">lít</option>`;
    } else if (baseUnit === 'pcs' || baseUnit === 'cái/con') {
        options = `<option value="pcs">pcs</option><option value="cái/con">cái/con</option>`;
    } else {
        options = `<option value="${origUnit}">${origUnit}</option>`;
    }

    editableCell.innerHTML = `
        <div class="flex justify-end items-center gap-1">
            <input type="number" step="0.01" class="edit-qty w-16 bg-slate-50 border border-slate-200 text-slate-900 rounded px-1 py-[1px] text-right text-xs focus:outline-none focus:border-orange-500 focus:bg-white" value="${origQty}">
            <select class="edit-unit bg-slate-50 border border-slate-200 text-slate-900 rounded px-0.5 py-[1px] text-xs focus:outline-none focus:border-orange-500 focus:bg-white">
                ${options}
            </select>
            <button class="btn-save-inline text-emerald-600 hover:text-emerald-500 ml-1 p-0.5">
                <i class="fa-solid fa-circle-info text-sm"></i>
            </button>
            <button class="btn-cancel-inline text-slate-400 hover:text-red-500 ml-0.5 p-0.5">
                <i class="fa-solid fa-pen-to-square text-sm"></i>
            </button>
        </div>
    `;

    const sel = editableCell.querySelector('.edit-unit') as HTMLSelectElement;
    sel.value = origUnit;

    const input = editableCell.querySelector('.edit-qty') as HTMLInputElement;
    input.focus();
    input.select();
    
    const cancelEdit = () => {
        if (selectedRecipeMenuItemId) loadRecipeForMenu(selectedRecipeMenuItemId);
    };
    
    const saveEdit = async () => {
        const newQtyStr = input.value;
        const newUnit = sel.value;
        const newQty = parseFloat(newQtyStr);
        
        if (isNaN(newQty) || newQty <= 0) {
            showConfirmModal("Lỗi", "Định lượng không hợp lệ");
            input.focus();
            return;
        }
        
        if (newQtyStr === origQty && newUnit === origUnit) {
            cancelEdit();
            return;
        }
        
        const isConfirmed = await showConfirmModal("Xác nhận thay đổi", "Bạn có chắc muốn lưu định lượng mới?");
        if (!isConfirmed) {
            cancelEdit();
            return;
        }
        
        const finalQty = convertToBaseUnit(newQty, newUnit, baseUnit);
        
        try {
            const res = await fetch(`${JSON_SERVER}/recipes/${recipeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity_required: finalQty,
                    custom_qty: newQty,
                    custom_unit: newUnit
                })
            });
            if (res.ok) {
                showSuccessToast("Đã cập nhật định lượng");
                if (selectedRecipeMenuItemId) loadRecipeForMenu(selectedRecipeMenuItemId);
            }
        } catch (e) {
            console.error(e);
            showConfirmModal("Lỗi", "Lỗi khi lưu!");
        }
    };

    editableCell.querySelector('.btn-cancel-inline')?.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelEdit();
    });
    
    editableCell.querySelector('.btn-save-inline')?.addEventListener('click', (e) => {
        e.stopPropagation();
        saveEdit();
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') cancelEdit();
    });
}

async function handleInventoryClick(e: Event) {
    const target = e.target as HTMLElement;

    // 1. Mở modal thêm nguyên liệu
    if (target.closest('#btn-open-add-ingredient')) {
        openIngredientModal();
        return;
    }

    // 1.1 Thêm dòng nhập liệu (Batch Insert)
    if (target.closest('#btn-add-ing-row')) {
        addIngredientRow();
        return;
    }
    
    // 1.2 Xóa dòng nhập liệu (Batch Insert)
    const btnRemoveRow = target.closest('.btn-remove-ing-row');
    if (btnRemoveRow) {
        // Không cho xóa nếu chỉ còn 1 dòng
        const container = document.getElementById('batch-ingredient-container');
        if (container && container.querySelectorAll('.ingredient-row').length > 1) {
            btnRemoveRow.closest('.ingredient-row')?.remove();
        } else {
            showToast('Phải giữ lại ít nhất 1 dòng', 'error');
        }
        return;
    }

    // 1.5. Chỉnh sửa tồn kho (Nhập / Xuất)
    const btnAdj = target.closest('.btn-adj-stock');
    if (btnAdj) {
        const id = btnAdj.getAttribute('data-id');
        const action = btnAdj.getAttribute('data-action') as 'import';
        if (id && action === 'import') {
            handleStockAdjustment(id, action);
        }
        return;
    }

    // 2. Mở / Ngừng dùng nguyên liệu (Soft Delete)
    const btnToggleIngredient = target.closest('.btn-toggle-ingredient');
    if (btnToggleIngredient) {
        const id = btnToggleIngredient.getAttribute('data-id');
        const currentStatus = btnToggleIngredient.getAttribute('data-status');
        if (id && currentStatus) {
            const newStatus = (currentStatus === 'Inactive' || currentStatus === 'Archived') ? 'Active' : 'Inactive';
            toggleIngredientStatus(id, newStatus);
        }
        return;
    }

    // 3. Chọn Món ăn ở Tab 2
    const menuItemRow = target.closest('.recipe-menu-item');
    if (menuItemRow) {
        const id = menuItemRow.getAttribute('data-id');
        const name = menuItemRow.getAttribute('data-name');
        if (id && name) selectMenuItemForRecipe(id, name);
        return;
    }

    // 4. Thêm công thức (Add Recipe)
    if (target.closest('#btn-submit-recipe')) {
        addRecipe();
        return;
    }

    // 5. Xóa công thức (Delete Recipe)
    const btnDelRecipe = target.closest('.btn-delete-recipe');
    if (btnDelRecipe) {
        const id = btnDelRecipe.getAttribute('data-id');
        if (id) {
            const isConfirmed = await showConfirmModal("Xác nhận", "Bạn có chắc muốn xóa định lượng này?");
            if (isConfirmed) {
                deleteRecipe(id);
            }
        }
        return;
    }
}

// ----------------------------------------------------
// TAB 1: INVENTORY (NGUYÊN LIỆU) LOGIC
// ----------------------------------------------------
async function loadIngredients() {
    try {
        const res = await fetch(`${JSON_SERVER}/inventory`);
        const resJson = await res.json();
        const raw = Array.isArray(resJson) ? resJson : (resJson.data || []);
        inventoryIngredients = raw.map((ing: any) => ({
            ...ing,
            id: ing.id || ing._id,
            cost_per_unit: ing.cost_price !== undefined ? ing.cost_price : (ing.cost_per_unit || 0)
        }));
        renderIngredientsTable();
        updateRecipeIngredientSelect(); // Cập nhật luôn cho Tab 2
    } catch (err) {
        console.error('Lỗi tải nguyên liệu:', err);
    }
}

export function formatQuantityForDisplay(quantity: number, unit: string) {
    if (unit === 'g' && quantity >= 1000) {
        return { displayQty: +(quantity / 1000).toFixed(2), displayUnit: 'kg' };
    }
    if (unit === 'ml' && quantity >= 1000) {
        return { displayQty: +(quantity / 1000).toFixed(2), displayUnit: 'lít' };
    }
    if (unit === 'pcs') {
        return { displayQty: quantity, displayUnit: 'cái/con' };
    }
    return { displayQty: quantity, displayUnit: unit };
}

function renderIngredientsTable(data: any[] = inventoryIngredients) {
    const tbody = document.getElementById('ingredients-table-body');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">Chưa có nguyên liệu nào phù hợp.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(ing => {
        const fmt = formatQuantityForDisplay(ing.stock_quantity, ing.unit);
        return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200">
            <td class="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">#${ing.id}</td>
            <td class="px-6 py-4 font-bold text-slate-900 editable-ingredient-cell cursor-pointer group whitespace-nowrap" data-id="${ing.id}" data-field="name" data-value="${ing.name}" title="Nhấn đúp để sửa tên">
                <span class="border-b border-transparent group-hover:border-slate-400 border-dashed pb-0.5 whitespace-nowrap">${ing.name}</span>
                ${(ing.status === 'Inactive' || ing.status === 'Archived') ? '<span class="ml-2 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold whitespace-nowrap border border-slate-200">Ngừng dùng</span>' : ''}
            </td>
            <td class="px-6 py-4 text-right whitespace-nowrap">
                <span class="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg font-black border border-orange-200 whitespace-nowrap">
                    ${fmt.displayQty}
                </span>
            </td>
            <td class="px-6 py-4 text-slate-600 font-bold whitespace-nowrap ${fmt.displayUnit === 'kg' || fmt.displayUnit === 'lít' ? 'text-orange-600' : ''}">${fmt.displayUnit}</td>
            <td class="px-6 py-4 text-right text-emerald-700 font-bold editable-ingredient-cell cursor-pointer group whitespace-nowrap" data-id="${ing.id}" data-field="cost_per_unit" data-value="${ing.cost_per_unit || 0}" title="Nhấn đúp để sửa giá">
                <span class="border-b border-transparent group-hover:border-emerald-500/50 border-dashed pb-0.5 whitespace-nowrap">${ing.cost_per_unit ? ing.cost_per_unit.toLocaleString('vi-VN') + ' đ' : '0 đ'}</span>
            </td>
            <td class="px-6 py-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button data-id="${ing.id}" data-action="import" class="btn-adj-stock w-8 h-8 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Nhập kho ${ing.name}">
                        <i class="fa-solid fa-boxes-stacked text-xs"></i>
                    </button>
                    ${(ing.status === 'Inactive' || ing.status === 'Archived') 
                        ? `<button data-id="${ing.id}" data-status="${ing.status}" class="btn-toggle-ingredient w-8 h-8 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Mở lại sử dụng ${ing.name}"><i class="fa-solid fa-rotate-left text-xs"></i></button>`
                        : `<button data-id="${ing.id}" data-status="${ing.status}" class="btn-toggle-ingredient w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Ngừng dùng nguyên liệu ${ing.name}"><i class="fa-solid fa-ban text-xs"></i></button>`
                    }
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openIngredientModal() {
    const modal = document.getElementById('modal-ingredient-form');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div')?.classList.remove('scale-95');
        }, 10);
    }
}

function closeIngredientModal() {
    const modal = document.getElementById('modal-ingredient-form');
    if (modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('div')?.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            
            // Reset form to 1 empty row
            const container = document.getElementById('batch-ingredient-container');
            if (container) {
                const rows = container.querySelectorAll('.ingredient-row');
                // Remove all rows except the first one
                for (let i = 1; i < rows.length; i++) {
                    rows[i].remove();
                }
                // Clear the first row inputs
                const firstRowInputs = rows[0].querySelectorAll('input');
                firstRowInputs.forEach(input => input.value = '');
            }
        }, 200);
    }
}

function addIngredientRow() {
    const container = document.getElementById('batch-ingredient-container');
    if (!container) return;
    
    const newRow = document.createElement('div');
    newRow.className = 'ingredient-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200';
    newRow.innerHTML = `
        <div class="col-span-4">
            <input type="text" class="ing-name-input w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500" placeholder="VD: Thịt bò">
        </div>
        <div class="col-span-2">
            <input type="number" min="0" step="0.1" class="ing-stock-input w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500" placeholder="0">
        </div>
        <div class="col-span-2">
            <select class="ing-unit-input w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500">
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="lít">lít</option>
                <option value="ml">ml</option>
                <option value="cái/con">cái/con</option>
            </select>
        </div>
        <div class="col-span-3">
            <input type="text" class="currency-input ing-cost-input w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 text-right" placeholder="VD: 50000">
        </div>
        <div class="col-span-1 flex justify-center">
            <button type="button" class="btn-remove-ing-row text-slate-400 hover:text-red-500 transition-colors" title="Xóa dòng này">
                <i class="fa-solid fa-trash text-sm"></i>
            </button>
        </div>
    `;
    container.appendChild(newRow);
    
    // Scroll to bottom
    const form = document.getElementById('form-ingredient');
    if (form) form.scrollTop = form.scrollHeight;
}

function transformUnitBeforeSave(quantity: number, unit: string) {
    if (unit === 'kg') return { quantity: quantity * 1000, unit: 'g' };
    if (unit === 'lít') return { quantity: quantity * 1000, unit: 'ml' };
    if (unit === 'cái/con') return { quantity, unit: 'pcs' };
    return { quantity, unit };
}

function convertToBaseUnit(qty: number, selectedUnit: string, baseUnit: string): number {
    const s = selectedUnit === 'cái/con' ? 'pcs' : selectedUnit === 'lít' ? 'lít' : selectedUnit;
    const b = baseUnit === 'cái/con' ? 'pcs' : baseUnit === 'lít' ? 'lít' : baseUnit;

    if (s === b) return qty;
    if (s === 'g' && b === 'kg') return qty / 1000;
    if (s === 'kg' && b === 'g') return qty * 1000;
    if (s === 'ml' && b === 'lít') return qty / 1000;
    if (s === 'lít' && b === 'ml') return qty * 1000;
    
    return qty;
}

async function saveBatchIngredients() {
    const container = document.getElementById('batch-ingredient-container');
    if (!container) return;

    const rows = container.querySelectorAll('.ingredient-row');
    const validIngredients: any[] = [];

    rows.forEach(row => {
        const name = (row.querySelector('.ing-name-input') as HTMLInputElement).value.trim();
        const stock = (row.querySelector('.ing-stock-input') as HTMLInputElement).value;
        const unit = (row.querySelector('.ing-unit-input') as HTMLSelectElement).value.trim();
        const costRaw = (row.querySelector('.ing-cost-input') as HTMLInputElement).value.replace(/,/g, '');
        const cost = costRaw ? parseFloat(costRaw) : 0;

        if (name && stock && unit) {
            const transformed = transformUnitBeforeSave(parseFloat(stock), unit);
            validIngredients.push({
                name,
                stock_quantity: transformed.quantity,
                unit: transformed.unit,
                cost_per_unit: cost
            });
        }
    });

    if (validIngredients.length === 0) {
        showConfirmModal("Cảnh báo", "Vui lòng nhập đầy đủ thông tin cho ít nhất 1 nguyên liệu!");
        return;
    }

    try {
        const btnSave = document.getElementById('btn-save-ingredient') as HTMLButtonElement;
        const originalText = btnSave.innerText;
        btnSave.innerText = 'Đang lưu...';
        btnSave.disabled = true;

        // Chạy Promise.all để gửi đồng loạt
        await Promise.all(validIngredients.map(ing => 
            fetch(`${JSON_SERVER}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ing)
            })
        ));
        
        btnSave.innerText = originalText;
        btnSave.disabled = false;

        closeIngredientModal();
        loadIngredients();
        await syncMenuItemsStockStatus();
        showToast('Đã nhập kho hàng loạt thành công!', 'success');
    } catch (err) {
        console.error(err);
        showConfirmModal("Lỗi", "Lỗi khi lưu dữ liệu hàng loạt");
        const btnSave = document.getElementById('btn-save-ingredient') as HTMLButtonElement;
        if(btnSave) {
            btnSave.innerText = 'Lưu tất cả';
            btnSave.disabled = false;
        }
    }
}

async function toggleIngredientStatus(id: string, newStatus: string) {
    const isConfirmed = await showConfirmModal("Xác nhận", `Bạn có chắc muốn ${newStatus === 'Inactive' ? 'ngừng dùng' : 'mở lại'} nguyên liệu này?`);
    if(!isConfirmed) return;
    try {
        const res = await fetch(`${JSON_SERVER}/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if(!res.ok) throw new Error("API Error");
        await loadIngredients();
        showToast(`Đã ${newStatus === 'Inactive' ? 'ngừng dùng' : 'mở lại'} nguyên liệu`, 'success');
    } catch(e) {
        console.error(e);
        showConfirmModal("Lỗi", "Lỗi khi cập nhật trạng thái");
    }
}

async function handleStockAdjustment(id: string, action: 'import') {
    const ing = inventoryIngredients.find(i => i.id === id);
    if (!ing) return;

    const title = `Nhập kho: ${ing.name}`;
    const result = await showNumberPromptModal(title, `Nhập số lượng (${ing.unit})`);
    
    if (!result.isConfirmed || isNaN(result.value) || result.value <= 0) return;

    let newStock = ing.stock_quantity + result.value;

    try {
        const res = await fetch(`${JSON_SERVER}/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock_quantity: newStock })
        });
        if (res.ok) {
            ing.stock_quantity = newStock; // update RAM
            renderIngredientsTable();
            updateRecipeIngredientSelect();
            if (selectedRecipeMenuItemId) {
                loadRecipeForMenu(selectedRecipeMenuItemId); // Reload UI for warnings
            }
            await syncMenuItemsStockStatus();
            showSuccessToast(`Đã nhập ${result.value} ${ing.unit} thành công!`);
        }
    } catch(e) {
        console.error(e);
        showConfirmModal("Lỗi", "Lỗi khi cập nhật tồn kho");
    }
}

// ----------------------------------------------------
// TAB 2: RECIPE (THIẾT LẬP CÔNG THỨC) LOGIC
// ----------------------------------------------------
async function loadMenuItemsForRecipe() {
    try {
        const res = await fetch(`${JSON_SERVER}/menu`);
        const resJson = await res.json();
        const raw = Array.isArray(resJson) ? resJson : (resJson.data || []);
        inventoryMenuItems = raw.filter((m: any) => !m.is_combo).map((m: any) => ({
            ...m,
            id: m.id || m._id
        }));
        renderRecipeMenuItems();
        if (!selectedRecipeMenuItemId && inventoryMenuItems.length > 0) {
            selectMenuItemForRecipe(inventoryMenuItems[0].id, inventoryMenuItems[0].name);
        }
    } catch (err) {
        console.error('Lỗi tải MenuItems:', err);
    }
}

function renderRecipeMenuItems(data: any[] = inventoryMenuItems) {
    const container = document.getElementById('recipe-menu-items-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-500 text-sm">Không tìm thấy món ăn nào.</div>`;
        return;
    }

    container.innerHTML = data.map(item => `
        <div data-id="${item.id}" data-name="${item.name}" class="recipe-menu-item p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3">
            <img src="${item.image || 'https://placehold.co/50x50/orange/white?text=Food'}" loading="lazy" decoding="async" class="w-10 h-10 rounded-lg object-cover">
            <div class="flex-1">
                <p class="font-bold text-slate-900 text-sm">${item.name}</p>
                <p class="text-xs text-slate-500 font-medium">${item.category_id ? 'Món chính' : 'Khác'}</p>
            </div>
            <i class="fa-solid fa-circle-info text-slate-400 text-sm"></i>
        </div>
    `).join('');
}

function selectMenuItemForRecipe(id: string, name: string) {
    selectedRecipeMenuItemId = id;
    
    // Highlight
    document.querySelectorAll('.recipe-menu-item').forEach(el => {
        if (el.getAttribute('data-id') === id) {
            el.classList.add('bg-orange-50', 'border-orange-300');
            el.classList.remove('bg-white');
        } else {
            el.classList.remove('bg-orange-50', 'border-orange-300');
            el.classList.add('bg-white');
        }
    });

    // Cập nhật UI Cột phải
    document.getElementById('empty-recipe-state')?.classList.add('hidden');
    document.getElementById('recipe-content')?.classList.remove('hidden');
    document.getElementById('add-recipe-form-container')?.classList.remove('hidden');
    
    const titleEl = document.getElementById('selected-recipe-menu-name');
    if (titleEl) titleEl.innerText = name;

    loadRecipeForMenu(id);
}

async function loadRecipeForMenu(menuItemId: string) {
    try {
        const res = await fetch(`${JSON_SERVER}/recipes?menuItem_id=${menuItemId}`);
        const resJson = await res.json();
        const raw = Array.isArray(resJson) ? resJson : (resJson.data || []);
        const recipes = raw.map((r: any) => ({
            ...r,
            id: r.id || r._id,
            ingredient_id: (r.ingredient_id && typeof r.ingredient_id === 'object') ? (r.ingredient_id._id || r.ingredient_id.id) : r.ingredient_id,
            _populatedIng: (r.ingredient_id && typeof r.ingredient_id === 'object') ? r.ingredient_id : null
        }));
        
        const tbody = document.getElementById('recipe-ingredients-list');
        if (!tbody) return;

        // Bật hiển thị summary
        const summary = document.getElementById('recipe-cost-summary');
        if (summary) summary.classList.remove('hidden');
        
        let totalCost = 0;
        const menuItem = inventoryMenuItems.find(m => String(m.id || m._id) === String(menuItemId));
        const sellPrice = menuItem ? menuItem.base_price : 0;

        if (recipes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-500 text-sm">Chưa có công thức cho món này.</td></tr>`;
            document.getElementById('recipe-total-cost')!.innerText = '0 đ';
            document.getElementById('recipe-sell-price')!.innerText = sellPrice.toLocaleString('vi-VN') + ' đ';
            document.getElementById('recipe-profit')!.innerText = sellPrice.toLocaleString('vi-VN') + ' đ';
            return;
        }

        // Map chéo dữ liệu RAM để lấy Tên & Đơn vị & Giá nhập
        tbody.innerHTML = recipes.map((r: any) => {
            const ingId = String(r.ingredient_id || '');
            const ing = inventoryIngredients.find(i => String(i.id || i._id) === ingId);
            const ingName = (r._populatedIng && r._populatedIng.name) ? r._populatedIng.name : (ing ? ing.name : 'Nguyên liệu');
            const ingUnit = (r._populatedIng && r._populatedIng.unit) ? r._populatedIng.unit : (ing ? ing.unit : '?');
            const ingCost = ing ? (ing.cost_per_unit || ing.cost_price || 0) : 0;
            const stockQty = ing ? ing.stock_quantity : (r._populatedIng ? r._populatedIng.stock_quantity : 0);
            
            const isLowStock = stockQty < r.quantity_required;
            const ingNameClass = isLowStock ? 'text-red-500 font-bold' : 'text-slate-900 font-bold';
            const lowStockBadge = isLowStock ? `<span class="text-[9px] text-red-500 bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20 ml-2 animate-pulse" title="Tồn kho hiện tại không đủ để làm 1 phần món này">Thiếu tồn kho</span>` : '';
            
            const costForThis = ingCost * r.quantity_required;
            totalCost += costForThis;
            
            const fmt = formatQuantityForDisplay(r.quantity_required, ingUnit);
            
            let displayQty = fmt.displayQty;
            let displayUnit = fmt.displayUnit;
            if (r.custom_unit && r.custom_qty !== undefined) {
                displayQty = r.custom_qty;
                displayUnit = r.custom_unit;
            }
            
            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-2 flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 text-xs font-black shrink-0 border border-slate-200">
                            ${ingName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="${ingNameClass} flex items-center">${ingName} ${lowStockBadge}</span>
                            <span class="text-[10px] text-slate-500 font-medium">${ingCost.toLocaleString('vi-VN')}đ / ${ingUnit}</span>
                        </div>
                    </td>
                    <td class="py-3 px-2 text-right editable-recipe-cell cursor-pointer relative group" data-id="${r.id}" data-qty="${displayQty}" data-unit="${displayUnit}" data-base-unit="${ingUnit}" title="Double click để sửa">
                        <span class="font-black text-orange-600 group-hover:underline decoration-orange-500/50 underline-offset-2 recipe-qty-display">${displayQty}</span>
                        <span class="text-slate-400 ml-1 font-bold recipe-unit-display ${displayUnit === 'kg' || displayUnit === 'lít' ? 'text-orange-400' : ''}">${displayUnit}</span>
                    </td>
                    <td class="py-3 px-2 text-right whitespace-nowrap">
                        <button data-id="${r.id}" class="btn-delete-recipe w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 inline-flex items-center justify-center transition-colors cursor-pointer" title="Xóa nguyên liệu này khỏi công thức">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        const profit = sellPrice - totalCost;
        const costRatio = sellPrice > 0 ? (totalCost / sellPrice) : 0;
        
        document.getElementById('recipe-sell-price')!.innerText = sellPrice.toLocaleString('vi-VN') + ' đ';
        
        const totalCostEl = document.getElementById('recipe-total-cost')!;
        totalCostEl.innerHTML = totalCost.toLocaleString('vi-VN') + ' đ';
        
        const profitEl = document.getElementById('recipe-profit')!;
        profitEl.innerHTML = profit.toLocaleString('vi-VN') + ' đ';
        
        // Smart Alerts: Lãi mỏng hoặc lỗ
        if (costRatio > 0.35) {
            totalCostEl.className = 'text-lg font-black text-red-500 animate-pulse';
            profitEl.className = 'text-lg font-black text-red-500';
            profitEl.innerHTML += `<div class="text-[10px] text-red-500 font-medium mt-1">⚠️ Lãi mỏng (Cost > 35%)</div>`;
        } else if (profit < 0) {
            totalCostEl.className = 'text-lg font-black text-red-500';
            profitEl.className = 'text-lg font-black text-red-500';
            profitEl.innerHTML += `<div class="text-[10px] text-red-500 font-medium mt-1">⚠️ Lỗ vốn</div>`;
        } else {
            totalCostEl.className = 'text-lg font-black text-orange-400';
            profitEl.className = 'text-lg font-black text-emerald-400';
        }

    } catch (err) {
        console.error(err);
    }
}

function updateRecipeIngredientSelect() {
    const select = document.getElementById('recipe-ingredient-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>' + 
        inventoryIngredients.map(ing => `<option value="${ing.id}" data-unit="${ing.unit}">${ing.name}</option>`).join('');

    // Hiển thị đơn vị tương ứng khi chọn
    select.addEventListener('change', () => {
        const opt = select.options[select.selectedIndex];
        const unit = opt.getAttribute('data-unit') || 'g';
        const display = document.getElementById('recipe-unit-display') as HTMLSelectElement;
        if (display) display.value = unit;
    });
}

async function addRecipe() {
    if (!selectedRecipeMenuItemId) return;

    const select = document.getElementById('recipe-ingredient-select') as HTMLSelectElement;
    const qtyInput = document.getElementById('recipe-quantity-input') as HTMLInputElement;
    const unitSelect = document.getElementById('recipe-unit-display') as HTMLSelectElement;
    
    const ingredient_id = select.value;
    const raw_qty = parseFloat(qtyInput.value);
    const selectedUnit = unitSelect.value;

    if (!ingredient_id || isNaN(raw_qty) || raw_qty <= 0) {
        showConfirmModal("Cảnh báo", "Vui lòng chọn nguyên liệu và nhập số lượng hợp lệ!");
        return;
    }
    
    const baseUnit = select.options[select.selectedIndex].getAttribute('data-unit') || '';
    const quantity_required = convertToBaseUnit(raw_qty, selectedUnit, baseUnit);

    try {
        await fetch(`${JSON_SERVER}/recipes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                menuItem_id: selectedRecipeMenuItemId,
                ingredient_id,
                quantity_required,
                custom_qty: raw_qty,
                custom_unit: selectedUnit
            })
        });

        // Reset form
        select.value = '';
        qtyInput.value = '';
        const display = document.getElementById('recipe-unit-display');
        if (display) display.innerText = '-';

        loadRecipeForMenu(selectedRecipeMenuItemId);
        await syncMenuItemsStockStatus();
        showToast('Đã thêm định lượng!', 'success');
    } catch (err) {
        console.error(err);
    }
}

async function deleteRecipe(id: string) {
    try {
        await fetch(`${JSON_SERVER}/recipes/${id}`, { method: 'DELETE' });
        if (selectedRecipeMenuItemId) {
            loadRecipeForMenu(selectedRecipeMenuItemId);
        }
        await syncMenuItemsStockStatus();
        showToast('Đã xóa định lượng', 'success');
    } catch (err) {
        console.error(err);
    }
}

// ----------------------------------------------------
// UTILS
// ----------------------------------------------------
function showToast(msg: string, type: 'success'|'error') {
    // Nếu trong hệ thống có hàm toast toàn cục thì dùng, không thì alert
    if (typeof (window as any).showGlobalToast === 'function') {
        (window as any).showGlobalToast(msg, type);
    } else {
        showConfirmModal("Thông báo", msg);
    }
}
