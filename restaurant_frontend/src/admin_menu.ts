import { layDanhSachMonAn, layDanhSachDanhMuc, suaMonAn } from './api';
import { API_URL, API_VARIANTS_URL } from './config';
import { showSuccessToast, showConfirmModal } from './utils/ui';
import { openVariantRecipeModal } from './admin_variant_recipe';

let allMenuItems: any[] = [];
let allCategories: any[] = [];
let currentMenuItemId: string | null = null;
let currentEditMenuItemId: string | null = null;

export const initAdminMenu = () => {
    setupEventListeners();
    loadMenuItems();
};

const setupEventListeners = () => {
    // Tìm kiếm & Lọc (Menu)
    document.getElementById('search-menu')?.addEventListener('input', applyMenuFilters);
    document.getElementById('filter-menu-category')?.addEventListener('change', applyMenuFilters);
    document.getElementById('filter-menu-status')?.addEventListener('change', applyMenuFilters);

    // Format tiền tệ - CHỈ format khi rời ô (blur), không can thiệp khi đang gõ
    // Cách này tránh hoàn toàn xung đột với bộ gõ Unikey/EVKey
    
    // Khi rời ô: format số thành dạng có dấu cách (VD: 20000 -> 20 000)
    document.addEventListener('blur', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target?.classList?.contains('currency-input')) return;
        const raw = target.value.replace(/\D/g, '');
        if (!raw) { target.value = ''; return; }
        target.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }, true);
    
    // Khi vào ô: xóa dấu cách để người dùng thấy số thô, dễ sửa
    document.addEventListener('focus', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target?.classList?.contains('currency-input')) return;
        target.value = target.value.replace(/\D/g, '');
        // Đưa con trỏ về cuối
        const len = target.value.length;
        setTimeout(() => target.setSelectionRange(len, len), 0);
    }, true);

    // Event delegation trên Table Menu
    const menuTableBody = document.getElementById('menu-table-body');
    if (menuTableBody) {
        menuTableBody.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;

            // Xử lý nút "Ẩn món" / "Mở lại" (Soft Delete)
            const toggleStatusBtn = target.closest('.btn-toggle-menu-status') as HTMLElement;
            if (toggleStatusBtn) {
                const id = toggleStatusBtn.getAttribute('data-id');
                const currentStatus = toggleStatusBtn.getAttribute('data-status');
                if (id && currentStatus) {
                    const newStatus = currentStatus === 'Available' ? 'Archived' : 'Available';
                    await toggleMenuItemStatus(id, newStatus);
                }
                return;
            }

            // Xử lý nút "Cấu hình" (Variants)
            const configBtn = target.closest('.btn-config-variants') as HTMLElement;
            if (configBtn) {
                const id = configBtn.getAttribute('data-id');
                const name = configBtn.getAttribute('data-name');
                if (id && name) {
                    openVariantsModal(id, name);
                }
                return;
            }

            // Xử lý nút "Sửa giá"
            const editPriceBtn = target.closest('.btn-edit-price') as HTMLElement;
            if (editPriceBtn) {
                const id = editPriceBtn.getAttribute('data-id');
                const name = editPriceBtn.getAttribute('data-name') || "Món ăn";
                const oldPrice = Number(editPriceBtn.getAttribute('data-price'));
                if (id && !isNaN(oldPrice)) {
                    openEditPriceModal(id, name, oldPrice);
                }
                return;
            }
        });
    }

    // Đóng Modal Variants
    const btnCloseVariants = document.getElementById('btn-close-variants-modal');
    if (btnCloseVariants) {
        btnCloseVariants.addEventListener('click', closeVariantsModal);
    }
    
    // Modal Edit Price Listeners
    document.getElementById('btn-close-edit-price')?.addEventListener('click', closeEditPriceModal);
    document.getElementById('btn-cancel-edit-price')?.addEventListener('click', closeEditPriceModal);
    const formEditPrice = document.getElementById('form-edit-price') as HTMLFormElement;
    if (formEditPrice) {
        formEditPrice.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!currentEditMenuItemId) return;

            const input = document.getElementById('edit-menu-price') as HTMLInputElement;
            const newPriceStr = input.value.replace(/\D/g, '');
            if(!newPriceStr) {
                showSuccessToast("⚠️ Vui lòng nhập giá hợp lệ!");
                return;
            }
            const newPrice = Number(newPriceStr);

            try {
                const userStr = localStorage.getItem('currentUser') || localStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : { id: 'U001' };
                
                const updatePayload = {
                    base_price: newPrice,
                    updatedBy: user.id,
                    updatedAt: new Date().toISOString()
                };
                
                await suaMonAn(currentEditMenuItemId, updatePayload);
                showSuccessToast("Cập nhật giá thành công!");
                closeEditPriceModal();
                await loadMenuItems();
            } catch(err) {
                showSuccessToast("❌ Lỗi cập nhật giá");
            }
        });
    }

    // Thêm Nhóm Variant mới
    const btnAddVariantGroup = document.getElementById('btn-add-variant-group');
    const newVariantGroupsContainer = document.getElementById('new-variant-groups-container');
    if (btnAddVariantGroup && newVariantGroupsContainer) {
        btnAddVariantGroup.addEventListener('click', () => {
            const groupHtml = `
                <div class="variant-group-block border border-slate-700 bg-slate-800/30 rounded-xl p-3">
                    <div class="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                        <input type="text" placeholder="TÊN NHÓM (VD: KÍCH CỠ)" class="variant-group-input w-1/2 bg-transparent text-white font-black text-sm uppercase tracking-wider focus:outline-none placeholder:text-slate-500">
                        <div class="flex items-center gap-2">
                            <label class="flex items-center gap-1 text-xs text-slate-400 mr-2 cursor-pointer">
                                <input type="checkbox" class="variant-group-multiple-checkbox w-3 h-3 accent-orange-500"> Cho phép chọn nhiều
                            </label>
                            <button type="button" class="btn-add-variant-item text-orange-500 text-xs font-bold hover:text-orange-400 transition">+ Thêm món</button>
                            <span class="text-slate-600">|</span>
                            <button type="button" class="btn-remove-variant-group text-slate-500 hover:text-red-400 transition" title="Xóa nhóm"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                        </div>
                    </div>
                    <div class="variant-items-container space-y-2">
                        <div class="new-variant-row flex items-end gap-3">
                            <div class="flex-1">
                                <input type="text" placeholder="Tên lựa chọn (VD: Size L)" class="variant-name-input w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500">
                            </div>
                            <div class="w-28">
                                <input type="text" placeholder="Giá (+đ)" class="currency-input variant-price-input w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500">
                            </div>
                            <button type="button" class="btn-remove-variant-row text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa dòng">
                                <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            newVariantGroupsContainer.insertAdjacentHTML('beforeend', groupHtml);
        });
        
        // Event delegation trên container của các form thêm mới
        newVariantGroupsContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            // Xóa Nhóm
            const btnRemoveGroup = target.closest('.btn-remove-variant-group');
            if (btnRemoveGroup) {
                if (newVariantGroupsContainer.querySelectorAll('.variant-group-block').length > 1) {
                    btnRemoveGroup.closest('.variant-group-block')?.remove();
                } else {
                    const block = btnRemoveGroup.closest('.variant-group-block');
                    if (block) {
                        const groupInput = block.querySelector('.variant-group-input') as HTMLInputElement;
                        if (groupInput) groupInput.value = '';
                        block.querySelectorAll('.new-variant-row').forEach((row, index) => {
                            if (index === 0) {
                                (row.querySelector('.variant-name-input') as HTMLInputElement).value = '';
                                (row.querySelector('.variant-price-input') as HTMLInputElement).value = '';
                            } else {
                                row.remove();
                            }
                        });
                    }
                }
                return;
            }

            // Xóa 1 dòng lựa chọn
            const btnRemoveRow = target.closest('.btn-remove-variant-row');
            if (btnRemoveRow) {
                const container = btnRemoveRow.closest('.variant-items-container');
                if (container && container.querySelectorAll('.new-variant-row').length > 1) {
                    btnRemoveRow.closest('.new-variant-row')?.remove();
                } else {
                    const row = btnRemoveRow.closest('.new-variant-row');
                    if (row) {
                        (row.querySelector('.variant-name-input') as HTMLInputElement).value = '';
                        (row.querySelector('.variant-price-input') as HTMLInputElement).value = '';
                    }
                }
                return;
            }

            // Thêm lựa chọn mới vào nhóm
            const btnAddItem = target.closest('.btn-add-variant-item');
            if (btnAddItem) {
                const container = btnAddItem.closest('.variant-group-block')?.querySelector('.variant-items-container');
                if (container) {
                    const rowHtml = `
                        <div class="new-variant-row flex items-end gap-3">
                            <div class="flex-1">
                                <input type="text" placeholder="Tên lựa chọn (VD: Size L)" class="variant-name-input w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500">
                            </div>
                            <div class="w-28">
                                <input type="text" placeholder="Giá (+đ)" class="currency-input variant-price-input w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500">
                            </div>
                            <button type="button" class="btn-remove-variant-row text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa dòng">
                                <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', rowHtml);
                }
                return;
            }
        });
    }

    // Form Thêm Variant Mới (Hỗ trợ nhiều dòng, nhiều nhóm)
    const formAddVariant = document.getElementById('form-add-variant') as HTMLFormElement;
    if (formAddVariant) {
        formAddVariant.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentMenuItemId) return;

            const groups = document.querySelectorAll('.variant-group-block');
            const validVariants: any[] = [];
            
            // Validate theo nhóm
            for (let i = 0; i < groups.length; i++) {
                const groupBlock = groups[i];
                const groupInput = groupBlock.querySelector('.variant-group-input') as HTMLInputElement;
                const group = groupInput ? groupInput.value.trim() : '';

                const multipleCheckbox = groupBlock.querySelector('.variant-group-multiple-checkbox') as HTMLInputElement;
                const allowMultiple = multipleCheckbox ? multipleCheckbox.checked : false;

                const rows = groupBlock.querySelectorAll('.new-variant-row');
                for (let j = 0; j < rows.length; j++) {
                    const row = rows[j];
                    const nameInput = row.querySelector('.variant-name-input') as HTMLInputElement;
                    const priceInput = row.querySelector('.variant-price-input') as HTMLInputElement;
                    
                    const name = nameInput ? nameInput.value.trim() : '';
                    const priceStr = priceInput ? priceInput.value.replace(/\D/g, '') : '';
                    
                    if (name === '' && priceStr === '' && group === '') {
                        continue;
                    }
                    
                    if (name === '') {
                        // Bỏ qua dòng trống tên
                        continue;
                    }
                    
                    // Giá không bắt buộc - mặc định 0
                    const price = priceStr ? Number(priceStr) : 0;
                    
                    validVariants.push({
                        group_name: group || 'Khác',
                        name: name,
                        extra_price: isNaN(price) ? 0 : price,
                        allowMultiple: allowMultiple
                    });
                }
            }
            
            if (validVariants.length === 0) {
                showSuccessToast("⚠️ Vui lòng nhập ít nhất 1 tên biến thể!");
                return;
            }

            let addedCount = 0;

            try {
                for (let i = 0; i < validVariants.length; i++) {
                    const variant = validVariants[i];
                    
                    const payload = {
                        id: `V${Date.now()}_${i}`,
                        menuItem_id: currentMenuItemId,
                        group_name: variant.group_name,
                        name: variant.name,
                        extra_price: variant.extra_price,
                        status: 'Available',
                        allowMultiple: variant.allowMultiple
                    };

                    const res = await fetch(API_VARIANTS_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    if (res.ok) addedCount++;
                }
                
                if (addedCount > 0) {
                    showSuccessToast(`Đã thêm thành công ${addedCount} biến thể!`);
                    
                    // Reset form
                    if (newVariantGroupsContainer) {
                        newVariantGroupsContainer.innerHTML = `
                            <div class="variant-group-block border border-slate-700 bg-slate-800/30 rounded-xl p-3">
                                <div class="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                                    <input type="text" placeholder="TÊN NHÓM (VD: KÍCH CỠ)" class="variant-group-input w-1/2 bg-transparent text-white font-black text-sm uppercase tracking-wider focus:outline-none placeholder:text-slate-500">
                                    <div class="flex items-center gap-2">
                                        <label class="flex items-center gap-1 text-xs text-slate-400 mr-2 cursor-pointer">
                                            <input type="checkbox" class="variant-group-multiple-checkbox w-3 h-3 accent-orange-500"> Cho phép chọn nhiều
                                        </label>
                                        <button type="button" class="btn-add-variant-item text-orange-500 text-xs font-bold hover:text-orange-400 transition">+ Thêm món</button>
                                        <span class="text-slate-600">|</span>
                                        <button type="button" class="btn-remove-variant-group text-slate-500 hover:text-red-400 transition" title="Xóa nhóm"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                </div>
                                <div class="variant-items-container space-y-2">
                                    <div class="new-variant-row flex items-end gap-3">
                                        <div class="flex-1">
                                            <input type="text" placeholder="Tên lựa chọn (VD: Size L)" class="variant-name-input w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500">
                                        </div>
                                        <div class="w-28">
                                            <input type="text" placeholder="Giá (+đ)" class="currency-input variant-price-input w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-orange-500">
                                        </div>
                                        <button type="button" class="btn-remove-variant-row text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa dòng">
                                            <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    await loadVariants(currentMenuItemId);
                }
            } catch (err) {
                console.error(err);
                showSuccessToast("❌ Có lỗi xảy ra khi lưu biến thể.");
            }
        });
    }

    // Event delegation cho Danh sách Variant (Xóa/Ẩn)
    const variantsList = document.getElementById('variants-list');
    if (variantsList) {
        variantsList.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            
            // Toggle (Hide/Restore)
            const toggleBtn = target.closest('.btn-toggle-variant') as HTMLElement;
            if (toggleBtn) {
                const id = toggleBtn.getAttribute('data-id');
                const currentStatus = toggleBtn.getAttribute('data-status');
                if (id && currentStatus) {
                    const newStatus = currentStatus === 'Available' ? 'Archived' : 'Available';
                    try {
                        await fetch(`${API_VARIANTS_URL}/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                        });
                        showSuccessToast(`Đã ${newStatus === 'Archived' ? 'ẩn' : 'mở lại'} biến thể`);
                        if (currentMenuItemId) await loadVariants(currentMenuItemId);
                    } catch (err) {
                        showSuccessToast("❌ Lỗi khi cập nhật trạng thái biến thể");
                    }
                }
                return;
            }

            // Open Variant Recipe
            const recipeBtn = target.closest('.btn-variant-recipe') as HTMLElement;
            if (recipeBtn) {
                const id = recipeBtn.getAttribute('data-id');
                const name = recipeBtn.getAttribute('data-name');
                if (id && name) {
                    openVariantRecipeModal(id, name);
                }
                return;
            }

            // Edit variant
            const editBtn = target.closest('.btn-edit-variant') as HTMLElement;
            if (editBtn) {
                const container = editBtn.closest('.variant-item-container');
                if (container) {
                    const viewMode = container.querySelector('.variant-view-mode');
                    const editMode = container.querySelector('.variant-edit-mode');
                    if (viewMode && editMode) {
                        viewMode.classList.add('hidden');
                        editMode.classList.remove('hidden');
                    }
                }
                return;
            }

            // Cancel edit
            const cancelBtn = target.closest('.btn-cancel-edit-variant') as HTMLElement;
            if (cancelBtn) {
                const container = cancelBtn.closest('.variant-item-container');
                if (container) {
                    const viewMode = container.querySelector('.variant-view-mode');
                    const editMode = container.querySelector('.variant-edit-mode');
                    if (viewMode && editMode) {
                        editMode.classList.add('hidden');
                        viewMode.classList.remove('hidden');
                    }
                }
                return;
            }

            // Save variant
            const saveBtn = target.closest('.btn-save-variant') as HTMLElement;
            if (saveBtn) {
                const id = saveBtn.getAttribute('data-id');
                const container = saveBtn.closest('.variant-item-container');
                if (id && container) {
                    const nameInput = container.querySelector('.edit-variant-name') as HTMLInputElement;
                    const priceInput = container.querySelector('.edit-variant-price') as HTMLInputElement;
                    if (nameInput && priceInput) {
                        const newName = nameInput.value.trim();
                        const newPriceStr = priceInput.value.replace(/[^0-9]/g, '');
                        const newPrice = newPriceStr ? Number(newPriceStr) : 0;

                        if (!newName) {
                            showConfirmModal("Cảnh báo", "Vui lòng nhập tên lựa chọn");
                            return;
                        }

                        const originalText = saveBtn.innerHTML;
                        saveBtn.innerHTML = '...';
                        try {
                            const res = await fetch(`${API_VARIANTS_URL}/${id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: newName, extra_price: newPrice })
                            });
                            if (!res.ok) throw new Error("API Error");
                            showSuccessToast("Đã cập nhật biến thể");
                            if (currentMenuItemId) await loadVariants(currentMenuItemId);
                        } catch (err) {
                            saveBtn.innerHTML = originalText;
                            showSuccessToast("❌ Lỗi khi cập nhật biến thể");
                        }
                    }
                }
                return;
            }

            // Toggle allowMultiple for a group
            const toggleMultipleBtn = target.closest('.btn-toggle-group-multiple') as HTMLElement;
            if (toggleMultipleBtn) {
                const idsStr = toggleMultipleBtn.getAttribute('data-ids');
                const isMultiple = toggleMultipleBtn.getAttribute('data-multiple') === 'true';
                if (idsStr) {
                    const newMultipleState = !isMultiple;
                    const ids = idsStr.split(',');
                    
                    const originalText = toggleMultipleBtn.innerHTML;
                    toggleMultipleBtn.innerHTML = '...';
                    try {
                        await Promise.all(ids.map(id => fetch(`${API_VARIANTS_URL}/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ allowMultiple: newMultipleState })
                        })));
                        
                        showSuccessToast(`Đã đổi trạng thái nhóm thành: ${newMultipleState ? 'Chọn nhiều' : 'Chọn 1'}`);
                        if (currentMenuItemId) await loadVariants(currentMenuItemId);
                    } catch (err) {
                        toggleMultipleBtn.innerHTML = originalText;
                        showSuccessToast("❌ Lỗi khi cập nhật trạng thái nhóm");
                    }
                }
                return;
            }

            // Edit group
            const editGroupBtn = target.closest('.btn-edit-group') as HTMLElement;
            if (editGroupBtn) {
                const container = editGroupBtn.closest('.group-header-container');
                if (container) {
                    const viewMode = container.querySelector('.group-view-mode');
                    const editMode = container.querySelector('.group-edit-mode');
                    if (viewMode && editMode) {
                        viewMode.classList.add('hidden');
                        editMode.classList.remove('hidden');
                    }
                }
                return;
            }

            // Cancel edit group
            const cancelEditGroupBtn = target.closest('.btn-cancel-edit-group') as HTMLElement;
            if (cancelEditGroupBtn) {
                const container = cancelEditGroupBtn.closest('.group-header-container');
                if (container) {
                    const viewMode = container.querySelector('.group-view-mode');
                    const editMode = container.querySelector('.group-edit-mode');
                    if (viewMode && editMode) {
                        editMode.classList.add('hidden');
                        viewMode.classList.remove('hidden');
                    }
                }
                return;
            }

            // Save group
            const saveGroupBtn = target.closest('.btn-save-group') as HTMLElement;
            if (saveGroupBtn) {
                const idsStr = saveGroupBtn.getAttribute('data-ids');
                const container = saveGroupBtn.closest('.group-header-container');
                if (idsStr && container) {
                    const nameInput = container.querySelector('.edit-group-name') as HTMLInputElement;
                    if (nameInput) {
                        const newName = nameInput.value.trim();
                        if (!newName) {
                            showConfirmModal("Cảnh báo", "Vui lòng nhập tên nhóm");
                            return;
                        }

                        const ids = idsStr.split(',');
                        const originalText = saveGroupBtn.innerHTML;
                        saveGroupBtn.innerHTML = '...';
                        try {
                            await Promise.all(ids.map(id => fetch(`${API_VARIANTS_URL}/${id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ group_name: newName })
                            })));
                            showSuccessToast("Đã cập nhật tên nhóm");
                            if (currentMenuItemId) await loadVariants(currentMenuItemId);
                        } catch (err) {
                            saveGroupBtn.innerHTML = originalText;
                            showSuccessToast("❌ Lỗi khi cập nhật tên nhóm");
                        }
                    }
                }
                return;
            }

            // Toggle group (Hide/Restore)
            const toggleGroupBtn = target.closest('.btn-toggle-group') as HTMLElement;
            if (toggleGroupBtn) {
                const idsStr = toggleGroupBtn.getAttribute('data-ids');
                const currentStatus = toggleGroupBtn.getAttribute('data-status');
                if (idsStr && currentStatus) {
                    const newStatus = currentStatus === 'Available' ? 'Archived' : 'Available';
                    const ids = idsStr.split(',');
                    const originalText = toggleGroupBtn.innerHTML;
                    toggleGroupBtn.innerHTML = '...';
                    try {
                        await Promise.all(ids.map(id => fetch(`${API_VARIANTS_URL}/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                        })));
                        showSuccessToast(`Đã ${newStatus === 'Archived' ? 'ẩn' : 'mở lại'} nhóm`);
                        if (currentMenuItemId) await loadVariants(currentMenuItemId);
                    } catch (err) {
                        toggleGroupBtn.innerHTML = originalText;
                        showSuccessToast("❌ Lỗi khi cập nhật trạng thái nhóm");
                    }
                }
                return;
            }

            // Show add variant form
            const showAddFormBtn = target.closest('.btn-show-add-variant-to-group') as HTMLElement;
            if (showAddFormBtn) {
                const container = showAddFormBtn.closest('.add-variant-to-group-container');
                const form = container?.nextElementSibling as HTMLElement;
                if (container && form && form.classList.contains('add-variant-to-group-form')) {
                    container.classList.add('hidden');
                    form.classList.remove('hidden');
                    form.classList.add('flex');
                }
                return;
            }

            // Cancel add variant form
            const cancelAddFormBtn = target.closest('.btn-cancel-add-variant-to-group') as HTMLElement;
            if (cancelAddFormBtn) {
                const form = cancelAddFormBtn.closest('.add-variant-to-group-form') as HTMLElement;
                const container = form?.previousElementSibling as HTMLElement;
                if (form && container && container.classList.contains('add-variant-to-group-container')) {
                    form.classList.add('hidden');
                    form.classList.remove('flex');
                    container.classList.remove('hidden');
                }
                return;
            }

            // Save new variant
            const saveNewVariantBtn = target.closest('.btn-save-new-variant-to-group') as HTMLElement;
            if (saveNewVariantBtn) {
                if (!currentMenuItemId) return;
                const groupName = saveNewVariantBtn.getAttribute('data-group');
                const isMultiple = saveNewVariantBtn.getAttribute('data-multiple') === 'true';
                const form = saveNewVariantBtn.closest('.add-variant-to-group-form');
                if (form && groupName) {
                    const nameInput = form.querySelector('.new-variant-name-in-group') as HTMLInputElement;
                    const priceInput = form.querySelector('.new-variant-price-in-group') as HTMLInputElement;
                    
                    const name = nameInput ? nameInput.value.trim() : '';
                    const priceStr = priceInput ? priceInput.value.replace(/[^0-9]/g, '') : '';
                    const price = priceStr ? Number(priceStr) : 0;
                    
                    if (!name) {
                        showConfirmModal("Cảnh báo", "Vui lòng nhập tên lựa chọn");
                        return;
                    }
                    
                    const payload = {
                        id: `V${Date.now()}`,
                        menuItem_id: currentMenuItemId,
                        group_name: groupName,
                        name: name,
                        extra_price: isNaN(price) ? 0 : price,
                        status: 'Available',
                        allowMultiple: isMultiple
                    };

                    const originalText = saveNewVariantBtn.innerHTML;
                    saveNewVariantBtn.innerHTML = '...';
                    try {
                        const res = await fetch(API_VARIANTS_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        if (!res.ok) throw new Error("API Error");
                        showSuccessToast("Đã thêm lựa chọn mới");
                        await loadVariants(currentMenuItemId);
                    } catch (err) {
                        saveNewVariantBtn.innerHTML = originalText;
                        showSuccessToast("❌ Có lỗi xảy ra khi thêm lựa chọn");
                    }
                }
                return;
            }
        });
    }
};

export const loadMenuItems = async () => {
    try {
        const rawMenuItems = await layDanhSachMonAn();
        allMenuItems = rawMenuItems;
        allCategories = await layDanhSachDanhMuc();
        
        // Populate Category Filter
        const categoryFilter = document.getElementById('filter-menu-category') as HTMLSelectElement;
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="all">Tất cả danh mục</option>' + 
                allCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }
        
        renderMenuItemsTable(allMenuItems);
    } catch (e) {
        console.error(e);
    }
};

const applyMenuFilters = () => {
    const searchInput = (document.getElementById('search-menu') as HTMLInputElement)?.value.toLowerCase() || '';
    const categorySelect = (document.getElementById('filter-menu-category') as HTMLSelectElement)?.value || 'all';
    const statusSelect = (document.getElementById('filter-menu-status') as HTMLSelectElement)?.value || 'all';

    const filtered = allMenuItems.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchInput);
        
        let matchCategory = true;
        if (categorySelect !== 'all') {
            matchCategory = String(item.category_id) === String(categorySelect);
        }

        let matchStatus = true;
        if (statusSelect === 'true') {
            matchStatus = item.status === 'Available';
        } else if (statusSelect === 'false') {
            matchStatus = item.status === 'Archived';
        }

        return matchName && matchCategory && matchStatus;
    });

    renderMenuItemsTable(filtered);
};

const renderMenuItemsTable = (data: any[]) => {
    const tbody = document.getElementById('menu-table-body');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">Không tìm thấy món ăn nào.</td></tr>`;
        return;
    }
    
    const canUpdate = true;
    tbody.innerHTML = '';
    data.forEach(item => {
        const cat = allCategories.find(c => String(c.id) === String(item.category_id));
        let statusHtml = '';
        
        if (item.status === 'Available') {
            statusHtml = `<span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-black border border-emerald-500/30">Đang bán</span>`;
        } else if (item.status === 'Out_of_stock') {
            statusHtml = `<span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs font-black border border-orange-500/30">Hết nguyên liệu</span>`;
        } else {
            statusHtml = `<span class="bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full text-xs font-black border border-slate-500/30">Đã ẩn</span>`;
        }
        
        const btnToggleAction = item.status === 'Archived' 
            ? `<button data-id="${item.id}" data-status="${item.status}" class="btn-toggle-menu-status text-slate-400 hover:text-emerald-400 transition font-bold text-xs">Mở lại</button>`
            : `<button data-id="${item.id}" data-status="${item.status}" class="btn-toggle-menu-status text-slate-400 hover:text-red-400 transition font-bold text-xs">Ẩn món</button>`;

        const actionHtml = `
            <div class="flex items-center justify-end gap-2">
                ${canUpdate ? `<button data-id="${item.id}" data-name="${item.name}" data-price="${item.base_price}" class="btn-edit-price text-slate-400 hover:text-orange-400 transition font-bold text-xs">Sửa giá</button>` : ''}
                ${canUpdate ? `<span class="text-slate-700">|</span>${btnToggleAction}` : ''}
            </div>
        `;

        const variantConfigBtn = `<button data-id="${item.id}" data-name="${item.name}" class="btn-config-variants border border-orange-500 text-orange-500 px-3 py-1 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition shadow-[0_0_10px_rgba(249,115,22,0.1)]">Cấu hình</button>`;
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-700/10">
                <td class="px-6 py-4">
                    <img src="${item.image || 'https://placehold.co/150x150/orange/white?text=Food'}" alt="${item.name}" class="w-12 h-12 rounded-xl object-cover border border-slate-700">
                </td>
                <td class="px-6 py-4 font-bold text-white">
                    ${item.name}
                    <p class="text-xs text-slate-400 font-semibold">${cat ? cat.name : ''}</p>
                </td>
                <td class="px-6 py-4 text-orange-400 font-black">${item.base_price.toLocaleString('vi-VN')} đ</td>
                <td class="px-6 py-4">${variantConfigBtn}</td>
                <td class="px-6 py-4">${statusHtml}</td>
                <td class="px-6 py-4 text-right">${actionHtml}</td>
            </tr>
        `;
    });
};

const toggleMenuItemStatus = async (id: string, newStatus: string) => {
    const isConfirmed = await showConfirmModal("Xác nhận", `Bạn có chắc chắn muốn ${newStatus === 'Archived' ? 'Ẩn' : 'Mở lại'} món ăn này?`);
    if(!isConfirmed) return;
    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error("API Error");
        
        showSuccessToast(`Đã ${newStatus === 'Archived' ? 'ẩn' : 'mở lại'} món ăn thành công!`);
        await loadMenuItems();
    } catch(e) {
        showSuccessToast("❌ Lỗi khi cập nhật trạng thái món ăn");
    }
};

const openEditPriceModal = (id: string, name: string, oldPrice: number) => {
    currentEditMenuItemId = id;
    const modal = document.getElementById('modal-edit-price');
    const title = document.getElementById('edit-price-modal-title');
    const input = document.getElementById('edit-menu-price') as HTMLInputElement;
    
    if(title) title.innerText = name;
    if(input) input.value = oldPrice.toLocaleString('vi-VN');
    
    if(modal) {
        modal.classList.remove('hidden');
        // Force reflow
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        modal.querySelector('div')?.classList.remove('scale-95');
        modal.querySelector('div')?.classList.add('scale-100');
    }
};

const closeEditPriceModal = () => {
    const modal = document.getElementById('modal-edit-price');
    if(modal) {
        modal.classList.remove('opacity-100');
        modal.classList.add('opacity-0');
        modal.querySelector('div')?.classList.remove('scale-100');
        modal.querySelector('div')?.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
    currentEditMenuItemId = null;
};

// Modal Variants Logic
const openVariantsModal = async (menuItemId: string, menuItemName: string) => {
    currentMenuItemId = menuItemId;
    const modal = document.getElementById('modal-variants-config');
    const title = document.getElementById('variants-modal-title');
    
    if (title) title.innerText = `Cấu hình cho: ${menuItemName}`;
    
    const variantsList = document.getElementById('variants-list');
    if (variantsList) {
        variantsList.innerHTML = '';
    }
    
    await loadVariants(menuItemId);
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const content = modal.querySelector('div');
            if (content) content.classList.remove('scale-95');
        }, 10);
    }
};

const closeVariantsModal = () => {
    const modal = document.getElementById('modal-variants-config');
    if (!modal) return;
    
    modal.classList.add('opacity-0');
    const content = modal.querySelector('div');
    if (content) content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentMenuItemId = null;
    }, 200);
};

const loadVariants = async (menuItemId: string) => {
    const variantsList = document.getElementById('variants-list');
    if (!variantsList) return;
    
    const currentScrollTop = variantsList.scrollTop;
    
    if (!variantsList.innerHTML.trim()) {
        variantsList.innerHTML = '<p class="text-slate-400 text-xs italic animate-pulse">Đang tải...</p>';
    }
    
    try {
        const res = await fetch(`${API_VARIANTS_URL}?menuItem_id=${menuItemId}`);
        const variants = await res.json();
        
        if (variants.length === 0) {
            variantsList.innerHTML = '<p class="text-slate-500 text-sm italic py-2">Chưa có tùy chọn nào. Hãy thêm mới bên dưới.</p>';
            return;
        }
        
        let allRecipes: any[] = [];
        try {
            const recipeRes = await fetch(`http://localhost:3000/VariantRecipes`);
            if(recipeRes.ok) allRecipes = await recipeRes.json();
        } catch (e) {}

        variantsList.innerHTML = '';
        
        // Group by group_name
        const grouped: { [key: string]: any[] } = {};
        variants.forEach((v: any) => {
            const groupName = v.group_name || 'Lựa chọn khác';
            if (!grouped[groupName]) grouped[groupName] = [];
            grouped[groupName].push(v);
        });
        
        // Render
        for (const group in grouped) {
            const isMultiple = grouped[group][0]?.allowMultiple || false;
            const groupVariantIds = grouped[group].map((v: any) => v.id).join(',');
            const isGroupArchived = grouped[group].every((v: any) => v.status === 'Archived');

            let groupHtml = `<div class="mb-4 last:mb-0">
                <div class="group-header-container border-b border-slate-700/50 pb-2 mb-2">
                    <div class="group-view-mode flex items-center justify-between">
                        <h4 class="text-xs font-black ${isGroupArchived ? 'text-slate-600 line-through' : 'text-slate-500'} uppercase tracking-wider">${group}</h4>
                        <div class="flex items-center gap-1.5">
                            <button data-ids="${groupVariantIds}" data-multiple="${isMultiple}" class="btn-toggle-group-multiple text-[10px] font-bold px-2 py-0.5 rounded ${isMultiple ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' : 'bg-slate-700/30 text-slate-400 border border-slate-700'} hover:opacity-80 transition" title="Nhấn để đổi thiết lập nhóm">
                                ${isMultiple ? '☑ Chọn nhiều' : '☐ Chỉ chọn 1'}
                            </button>
                            ${!isGroupArchived ? `<button class="btn-edit-group text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 transition">Sửa</button>` : ''}
                            <button data-ids="${groupVariantIds}" data-status="${isGroupArchived ? 'Archived' : 'Available'}" class="btn-toggle-group text-[10px] font-bold px-2 py-0.5 rounded border ${isGroupArchived ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10' : 'border-red-500/30 text-red-500 hover:bg-red-500/10'} transition">
                                ${isGroupArchived ? 'Khôi phục' : 'Ẩn'}
                            </button>
                        </div>
                    </div>
                    <div class="group-edit-mode hidden flex items-center justify-between gap-2 mt-2">
                        <input type="text" class="edit-group-name flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-bold" value="${group}" placeholder="Tên nhóm">
                        <div class="flex gap-1 shrink-0">
                            <button data-ids="${groupVariantIds}" class="btn-save-group text-[10px] font-bold px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition">Lưu</button>
                            <button class="btn-cancel-edit-group text-[10px] font-bold px-2 py-1 rounded border border-slate-500/30 text-slate-400 hover:bg-slate-500/10 transition">Hủy</button>
                        </div>
                    </div>
                </div>
                <div class="space-y-2">`;
                
            grouped[group].forEach((v: any) => {
                const isArchived = v.status === 'Archived';
                const hasRecipe = allRecipes.some((r: any) => String(r.variantId) === String(v.id));
                const recipeBadge = hasRecipe 
                    ? `<span class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[9px] font-bold ml-2">📦 Đã cài</span>`
                    : `<span class="px-1.5 py-0.5 bg-slate-700/50 text-slate-400 border border-slate-600 rounded text-[9px] font-bold ml-2">⚠️ Trống</span>`;

                groupHtml += `
                    <div class="variant-item-container flex flex-col p-3 rounded-xl border ${isArchived ? 'border-slate-700 bg-slate-800/30 opacity-50' : 'border-slate-700 bg-[#0f172a]'} transition-all">
                        <div class="variant-view-mode flex items-center justify-between w-full">
                            <div>
                                <p class="text-sm font-bold text-white ${isArchived ? 'line-through text-slate-500' : ''}">${v.name} ${recipeBadge}</p>
                                <p class="text-xs font-black text-orange-400">+ ${Number(v.extra_price).toLocaleString('vi-VN')} đ</p>
                            </div>
                            <div class="flex gap-1.5">
                                ${!isArchived ? `
                                <button data-id="${v.id}" class="btn-edit-variant p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition group" title="Sửa">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                ` : ''}
                                <button data-id="${v.id}" data-name="${v.name}" class="btn-variant-recipe p-2 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition group" title="Định lượng">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                                </button>
                                <button data-id="${v.id}" data-status="${v.status}" class="btn-toggle-variant p-2 rounded-lg ${isArchived ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'} transition group" title="${isArchived ? 'Khôi phục' : 'Ẩn'}">
                                    ${isArchived 
                                        ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`
                                        : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.188-1.583 10.05 10.05 0 019.543 7c-.5 1.13-1.22 2.14-2.07 3m-4.24-4.24a3 3 0 00-4.24-4.24m0 0l4.24 4.24"></path></svg>`
                                    }
                                </button>
                            </div>
                        </div>
                        <div class="variant-edit-mode hidden flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-700 w-full">
                            <div class="flex-1 flex gap-2">
                                <input type="text" class="edit-variant-name w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-bold" value="${v.name}" placeholder="Tên lựa chọn">
                                <input type="text" class="edit-variant-price w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-bold text-right" value="${v.extra_price}" placeholder="Giá (+đ)">
                            </div>
                            <div class="flex gap-2 shrink-0">
                                <button data-id="${v.id}" class="btn-save-variant text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition shadow-[0_0_10px_rgba(59,130,246,0.2)]">Lưu</button>
                                <button class="btn-cancel-edit-variant text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-500/30 text-slate-400 hover:bg-slate-500/10 transition">Hủy</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            groupHtml += `
                    <div class="mt-2 text-right add-variant-to-group-container">
                        <button class="btn-show-add-variant-to-group text-[10px] font-bold px-3 py-1.5 rounded-lg border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 transition">+ Thêm lựa chọn vào nhóm này</button>
                    </div>
                    <div class="add-variant-to-group-form hidden items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/50 w-full">
                        <div class="flex-1 flex gap-2">
                            <input type="text" class="new-variant-name-in-group w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500 font-bold" placeholder="Tên lựa chọn mới">
                            <input type="text" class="new-variant-price-in-group w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500 font-bold text-right" placeholder="Giá (+đ)">
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button data-group="${group}" data-multiple="${isMultiple}" class="btn-save-new-variant-to-group text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition shadow-[0_0_10px_rgba(249,115,22,0.2)]">Thêm</button>
                            <button class="btn-cancel-add-variant-to-group text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-500/30 text-slate-400 hover:bg-slate-500/10 transition">Hủy</button>
                        </div>
                    </div>
                </div></div>`;
            variantsList.innerHTML += groupHtml;
        }
        
        requestAnimationFrame(() => {
            if (variantsList) variantsList.scrollTop = currentScrollTop;
        });
    } catch (err) {
        variantsList.innerHTML = '<p class="text-red-400 text-xs italic">Lỗi khi tải dữ liệu!</p>';
    }
};
