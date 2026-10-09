import { showSuccessToast, showConfirmModal, showWarningToast } from './utils/ui';
import { API_INGREDIENTS_URL } from './config';

const API_VARIANT_RECIPES_URL = 'http://localhost:3000/VariantRecipes';
let currentVariantId: string | null = null;
let allIngredients: any[] = [];

export const initVariantRecipe = () => {
    document.getElementById('btn-close-variant-recipe')?.addEventListener('click', closeVariantRecipeModal);
    document.getElementById('btn-add-variant-recipe')?.addEventListener('click', addVariantRecipeItem);
    
    const select = document.getElementById('variant-recipe-select') as HTMLSelectElement;
    select?.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const unitEl = document.getElementById('variant-recipe-unit') as HTMLSelectElement;
        if (unitEl) {
            if (target.value) {
                const opt = target.options[target.selectedIndex];
                unitEl.value = opt.getAttribute('data-unit') || 'g';
            }
        }
    });

    // Event delegation for deleting recipe item
    document.getElementById('variant-recipe-list')?.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const btnDelete = target.closest('.btn-delete-variant-recipe');
        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            if (id) {
                await deleteVariantRecipeItem(id);
            }
        }
    });
};

export const openVariantRecipeModal = async (variantId: string, variantName: string) => {
    currentVariantId = variantId;
    const title = document.getElementById('variant-recipe-title');
    if (title) title.innerText = variantName;

    const modal = document.getElementById('modal-variant-recipe');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const content = modal.querySelector('div');
            if (content) content.classList.remove('scale-95');
        }, 10);
    }

    await loadIngredients();
    await loadVariantRecipeList(variantId);
};

export const closeVariantRecipeModal = () => {
    const modal = document.getElementById('modal-variant-recipe');
    if (!modal) return;
    
    modal.classList.add('opacity-0');
    const content = modal.querySelector('div');
    if (content) content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentVariantId = null;
    }, 200);
};

const loadIngredients = async () => {
    if (allIngredients.length > 0) return; // Cached
    try {
        const res = await fetch(API_INGREDIENTS_URL);
        allIngredients = await res.json();
        
        const select = document.getElementById('variant-recipe-select') as HTMLSelectElement;
        if (select) {
            select.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>' + 
                allIngredients.map((i: any) => `<option value="${i.id}" data-name="${i.name}" data-unit="${i.unit}">${i.name}</option>`).join('');
        }
    } catch (e) {
        console.error(e);
    }
};

const loadVariantRecipeList = async (variantId: string) => {
    const listEl = document.getElementById('variant-recipe-list');
    const emptyEl = document.getElementById('empty-variant-recipe');
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-slate-400 italic">Đang tải...</td></tr>';
    emptyEl.classList.add('hidden');

    try {
        const res = await fetch(`${API_VARIANT_RECIPES_URL}?variantId=${variantId}`);
        if (!res.ok) {
            // Json-server will return 404 if endpoint doesn't exist initially. Just handle it gracefully.
            listEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            return;
        }
        const recipes = await res.json();

        if (recipes.length === 0) {
            listEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl.classList.add('hidden');
        listEl.innerHTML = recipes.map((r: any) => {
            let displayQty = r.quantity;
            let displayUnit = r.unit;
            if (r.unit === 'g' && r.quantity >= 1000) { displayQty = +(r.quantity/1000).toFixed(2); displayUnit = 'kg'; }
            if (r.unit === 'ml' && r.quantity >= 1000) { displayQty = +(r.quantity/1000).toFixed(2); displayUnit = 'lít'; }
            if (r.unit === 'pcs') { displayUnit = 'cái/con'; }
            
            return `
            <tr>
                <td class="py-3">${r.ingredientName}</td>
                <td class="py-3 text-right text-orange-400 font-bold">${displayQty} <span class="text-slate-400 text-xs ml-1 ${displayUnit === 'kg' || displayUnit === 'lít' ? 'text-orange-400' : ''}">${displayUnit}</span></td>
                <td class="py-3 text-right">
                    <button data-id="${r.id}" class="btn-delete-variant-recipe p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Xóa">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
            `;
        }).join('');

    } catch (e) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
    }
};

const addVariantRecipeItem = async () => {
    if (!currentVariantId) return;

    const select = document.getElementById('variant-recipe-select') as HTMLSelectElement;
    const qtyInput = document.getElementById('variant-recipe-qty') as HTMLInputElement;
    const unitSelect = document.getElementById('variant-recipe-unit') as HTMLSelectElement;

    const ingredientId = select.value;
    const raw_qty = parseFloat(qtyInput.value);
    const selectedUnit = unitSelect.value;

    if (!ingredientId || isNaN(raw_qty) || raw_qty <= 0) {
        showWarningToast('Vui lòng chọn nguyên liệu và nhập số lượng hợp lệ');
        return;
    }

    let quantity = raw_qty;
    let unit = selectedUnit;
    if (selectedUnit === 'kg') { quantity = raw_qty * 1000; unit = 'g'; }
    if (selectedUnit === 'lít') { quantity = raw_qty * 1000; unit = 'ml'; }
    if (selectedUnit === 'cái/con') { unit = 'pcs'; }

    const opt = select.options[select.selectedIndex];
    const ingredientName = opt.getAttribute('data-name');

    const data = {
        variantId: currentVariantId,
        ingredientId,
        ingredientName,
        quantity,
        unit
    };

    const btn = document.getElementById('btn-add-variant-recipe') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = '...';

    try {
        await fetch(API_VARIANT_RECIPES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showSuccessToast('Đã thêm định lượng');
        
        // Reset form
        select.value = '';
        qtyInput.value = '';
        const unitEl = document.getElementById('variant-recipe-unit');
        if(unitEl) unitEl.innerText = '-';

        await loadVariantRecipeList(currentVariantId);
    } catch (e) {
        showWarningToast('Lỗi khi thêm định lượng');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Thêm';
    }
};

const deleteVariantRecipeItem = async (id: string) => {
    const isConfirmed = await showConfirmModal("Xác nhận", "Bạn có chắc muốn xóa định lượng này?");
    if (!isConfirmed) return;

    try {
        await fetch(`${API_VARIANT_RECIPES_URL}/${id}`, {
            method: 'DELETE'
        });
        showSuccessToast('Đã xóa định lượng');
        if (currentVariantId) {
            await loadVariantRecipeList(currentVariantId);
        }
    } catch (e) {
        showWarningToast('Lỗi khi xóa định lượng');
    }
};
