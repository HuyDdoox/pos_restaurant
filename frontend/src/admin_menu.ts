import { layDanhSachMonAn, layDanhSachDanhMuc, suaMonAn, taoMonAn, layDanhSachVariants } from './api';
import { API_URL, API_VARIANTS_URL, API_BACKEND_URL } from './config';
import { showSuccessToast, showConfirmModal } from './utils/ui';
import { openVariantRecipeModal } from './admin_variant_recipe';

export interface ComboItemEntry {
    menuItem_id: string;
    name: string;
    variant_id: string | null;
    variant_name: string;
    quantity: number;
    unit_price?: number;
    original_price: number;
}

let allMenuItems: any[] = [];
let allCategories: any[] = [];
let currentMenuItemId: string | null = null;
let currentEditMenuItemId: string | null = null;
let currentEditComboId: string | null = null;
let currentEditImageValue: string = '';
let currentAddImageValue: string = '';
let currentComboImageValue: string = '';
let comboBuilderItems: ComboItemEntry[] = [];
let cachedVariantsForCombo: any[] = [];
let currentMenuCardFilter: 'all' | 'active' | 'combo' | 'hidden' = 'all';
let menuSortCol = 'name';
let menuSortAsc = true;

export const initAdminMenu = () => {
    setupEventListeners();
    loadMenuItems();
};

const setupEventListeners = () => {
    setupMenuSorting();
    // Tìm kiếm & Lọc (Menu)
    document.getElementById('search-menu')?.addEventListener('input', applyMenuFilters);
    document.getElementById('filter-menu-category')?.addEventListener('change', applyMenuFilters);
    document.getElementById('filter-menu-status')?.addEventListener('change', () => {
        const val = (document.getElementById('filter-menu-status') as HTMLSelectElement)?.value;
        if (val === 'true') currentMenuCardFilter = 'active';
        else if (val === 'false') currentMenuCardFilter = 'hidden';
        else currentMenuCardFilter = 'all';
        updateMenuCardStyles();
        applyMenuFilters();
    });

    // Tương tác lọc từ 4 thẻ thống kê THỰC ĐƠN
    const menuCards = [
        { id: 'card-menu-total', filter: 'all' },
        { id: 'card-menu-active', filter: 'active' },
        { id: 'card-menu-combo', filter: 'combo' },
        { id: 'card-menu-hidden', filter: 'hidden' },
    ];
    menuCards.forEach(c => {
        document.getElementById(c.id)?.addEventListener('click', () => {
            if (currentMenuCardFilter === c.filter && c.filter !== 'all') {
                currentMenuCardFilter = 'all';
            } else {
                currentMenuCardFilter = c.filter as any;
            }

            const statusSelect = document.getElementById('filter-menu-status') as HTMLSelectElement;
            if (statusSelect) {
                if (currentMenuCardFilter === 'active') statusSelect.value = 'true';
                else if (currentMenuCardFilter === 'hidden') statusSelect.value = 'false';
                else if (currentMenuCardFilter === 'all') statusSelect.value = 'all';
            }

            updateMenuCardStyles();
            applyMenuFilters();
        });
    });

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

            // Xử lý nút "Xem món" / "Món thành phần" (Combo details & edit)
            const viewComboBtn = target.closest('.btn-view-combo-details') as HTMLElement;
            if (viewComboBtn) {
                const id = viewComboBtn.getAttribute('data-id');
                if (id) {
                    openComboBuilderModal(id);
                }
                return;
            }

            // Xử lý nút "Chỉnh sửa món"
            const editPriceBtn = target.closest('.btn-edit-price') as HTMLElement;
            if (editPriceBtn) {
                const id = editPriceBtn.getAttribute('data-id');
                if (id) {
                    const item = allMenuItems.find(m => String(m.id || m._id) === String(id));
                    if (item && item.is_combo) {
                        openComboBuilderModal(id);
                    } else {
                        openEditPriceModal(id);
                    }
                }
                return;
            }
        });
    }

    // Modal Combo Builder Listeners
    document.getElementById('btn-open-create-combo')?.addEventListener('click', () => openComboBuilderModal());
    document.getElementById('btn-close-combo-builder')?.addEventListener('click', closeComboBuilderModal);
    document.getElementById('btn-cancel-combo-builder')?.addEventListener('click', closeComboBuilderModal);
    document.getElementById('combo-select-item')?.addEventListener('change', () => handleComboSelectItemChange());
    document.getElementById('btn-add-combo-item')?.addEventListener('click', handleAddComboItem);
    document.getElementById('combo-price')?.addEventListener('input', updateComboPricingSummary);
    document.getElementById('btn-submit-combo-builder')?.addEventListener('click', handleSaveCombo);

    // Chuyển Tab Ảnh cho Modal Combo Builder
    const tabComboUpload = document.getElementById('tab-combo-img-upload');
    const tabComboUrl = document.getElementById('tab-combo-img-url');
    tabComboUpload?.addEventListener('click', (e) => {
        e.preventDefault();
        switchComboImageTab('upload');
    });
    tabComboUrl?.addEventListener('click', (e) => {
        e.preventDefault();
        switchComboImageTab('url');
    });

    document.getElementById('modal-combo-builder')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('#tab-combo-img-upload')) {
            e.preventDefault();
            switchComboImageTab('upload');
            return;
        }
        if (target.closest('#tab-combo-img-url')) {
            e.preventDefault();
            switchComboImageTab('url');
            return;
        }
    });

    // Upload ảnh Combo từ thiết bị
    const dropzoneCombo = document.getElementById('dropzone-combo-image');
    const fileInputCombo = document.getElementById('combo-menu-file') as HTMLInputElement;

    const handleSelectedComboFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            showSuccessToast("⚠️ Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP)!");
            return;
        }
        try {
            const base64 = await compressImageFile(file);
            updateComboImageDisplay(base64, `📁 Tải lên: ${file.name}`);
            const comboUrlInput = document.getElementById('combo-image-url') as HTMLInputElement;
            if (comboUrlInput) comboUrlInput.value = '';
            showSuccessToast("Đã tải ảnh Combo thành công!");
        } catch (err) {
            showSuccessToast("❌ Lỗi khi đọc file ảnh!");
        }
    };

    if (dropzoneCombo && fileInputCombo) {
        dropzoneCombo.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('#btn-remove-combo-image')) return;
            fileInputCombo.click();
        });

        fileInputCombo.addEventListener('change', () => {
            if (fileInputCombo.files && fileInputCombo.files[0]) {
                handleSelectedComboFile(fileInputCombo.files[0]);
            }
        });

        dropzoneCombo.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzoneCombo.classList.add('border-orange-500', 'bg-orange-500/10');
        });
        dropzoneCombo.addEventListener('dragleave', () => {
            dropzoneCombo.classList.remove('border-orange-500', 'bg-orange-500/10');
        });
        dropzoneCombo.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzoneCombo.classList.remove('border-orange-500', 'bg-orange-500/10');
            if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                handleSelectedComboFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Nhập URL ảnh cho Combo
    const comboUrlInput = document.getElementById('combo-image-url') as HTMLInputElement;
    if (comboUrlInput) {
        comboUrlInput.addEventListener('input', () => {
            const url = comboUrlInput.value.trim();
            updateComboImageDisplay(url, url ? '🔗 Ảnh từ đường dẫn liên kết' : undefined);
        });
    }

    // Nút Xóa ảnh Combo
    document.getElementById('btn-remove-combo-image')?.addEventListener('click', (e) => {
        e.stopPropagation();
        updateComboImageDisplay('');
        if (comboUrlInput) comboUrlInput.value = '';
        if (fileInputCombo) fileInputCombo.value = '';
    });

    // Chuyển nhanh từ modal sửa món sang modal sửa combo
    document.getElementById('btn-open-combo-editor-from-dish-modal')?.addEventListener('click', () => {
        const id = currentEditMenuItemId;
        closeEditPriceModal();
        if (id) {
            openComboBuilderModal(id);
        }
    });

    // Thao tác trên danh sách món thành phần trong Combo (Xóa món & Đổi số lượng)
    document.getElementById('combo-items-list')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        
        // Nút Xóa món
        const removeBtn = target.closest('.btn-remove-combo-item') as HTMLElement;
        if (removeBtn) {
            const idxStr = removeBtn.getAttribute('data-index');
            if (idxStr !== null) {
                const idx = parseInt(idxStr, 10);
                if (!isNaN(idx) && idx >= 0 && idx < comboBuilderItems.length) {
                    const removed = comboBuilderItems.splice(idx, 1)[0];
                    renderComboItemsList();
                    updateComboPricingSummary();
                    showSuccessToast(`Đã xóa món "${removed.name}" khỏi Combo`);
                }
            }
            return;
        }

        // Nút Tăng / Giảm số lượng
        const qtyBtn = target.closest('.btn-qty-combo-item') as HTMLElement;
        if (qtyBtn) {
            const idxStr = qtyBtn.getAttribute('data-index');
            const action = qtyBtn.getAttribute('data-action');
            if (idxStr !== null) {
                const idx = parseInt(idxStr, 10);
                if (!isNaN(idx) && idx >= 0 && idx < comboBuilderItems.length) {
                    const item = comboBuilderItems[idx];
                    const unitP = item.unit_price || (item.original_price && item.quantity ? Math.round(item.original_price / item.quantity) : 0);
                    if (action === 'inc') {
                        item.quantity += 1;
                        item.original_price = unitP * item.quantity;
                    } else if (action === 'dec') {
                        if (item.quantity > 1) {
                            item.quantity -= 1;
                            item.original_price = unitP * item.quantity;
                        } else {
                            const removed = comboBuilderItems.splice(idx, 1)[0];
                            showSuccessToast(`Đã xóa món "${removed.name}" khỏi Combo`);
                        }
                    }
                    renderComboItemsList();
                    updateComboPricingSummary();
                }
            }
            return;
        }
    });

    // Đóng Modal Variants
    const btnCloseVariants = document.getElementById('btn-close-variants-modal');
    if (btnCloseVariants) {
        btnCloseVariants.addEventListener('click', closeVariantsModal);
    }
    
    // Modal Add Dish Listeners
    document.getElementById('btn-open-create-menu')?.addEventListener('click', () => openAddMenuModal());
    document.getElementById('btn-close-menu-modal')?.addEventListener('click', closeAddMenuModal);
    document.getElementById('btn-cancel-menu')?.addEventListener('click', closeAddMenuModal);

    // Chuyển Tab Ảnh cho Modal Add Dish
    const tabAddUpload = document.getElementById('tab-add-img-upload');
    const tabAddUrl = document.getElementById('tab-add-img-url');
    tabAddUpload?.addEventListener('click', (e) => {
        e.preventDefault();
        switchAddImageTab('upload');
    });
    tabAddUrl?.addEventListener('click', (e) => {
        e.preventDefault();
        switchAddImageTab('url');
    });

    document.getElementById('modal-menu-form')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('#tab-add-img-upload')) {
            e.preventDefault();
            switchAddImageTab('upload');
            return;
        }
        if (target.closest('#tab-add-img-url')) {
            e.preventDefault();
            switchAddImageTab('url');
            return;
        }
    });

    // Upload ảnh Add Dish từ thiết bị
    const dropzoneAdd = document.getElementById('dropzone-add-image');
    const fileInputAdd = document.getElementById('add-menu-file') as HTMLInputElement;

    const handleSelectedAddFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            showSuccessToast("⚠️ Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP)!");
            return;
        }
        try {
            const base64 = await compressImageFile(file);
            updateAddImageDisplay(base64, `📁 Tải lên: ${file.name}`);
            const addUrlInput = document.getElementById('add-menu-image-url') as HTMLInputElement;
            if (addUrlInput) addUrlInput.value = '';
            showSuccessToast("Đã tải ảnh lên thành công!");
        } catch (err) {
            showSuccessToast("❌ Lỗi khi đọc file ảnh!");
        }
    };

    if (dropzoneAdd && fileInputAdd) {
        dropzoneAdd.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('#btn-remove-add-image')) return;
            fileInputAdd.click();
        });

        fileInputAdd.addEventListener('change', () => {
            if (fileInputAdd.files && fileInputAdd.files[0]) {
                handleSelectedAddFile(fileInputAdd.files[0]);
            }
        });

        dropzoneAdd.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzoneAdd.classList.add('border-orange-500', 'bg-orange-500/10');
        });
        dropzoneAdd.addEventListener('dragleave', () => {
            dropzoneAdd.classList.remove('border-orange-500', 'bg-orange-500/10');
        });
        dropzoneAdd.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzoneAdd.classList.remove('border-orange-500', 'bg-orange-500/10');
            if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                handleSelectedAddFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Nhập URL ảnh cho Add Dish
    const addUrlInput = document.getElementById('add-menu-image-url') as HTMLInputElement;
    if (addUrlInput) {
        addUrlInput.addEventListener('input', () => {
            const url = addUrlInput.value.trim();
            updateAddImageDisplay(url, url ? '🔗 Ảnh từ đường dẫn liên kết' : undefined);
        });
    }

    // Xóa ảnh Add Dish
    document.getElementById('btn-remove-add-image')?.addEventListener('click', (e) => {
        e.stopPropagation();
        updateAddImageDisplay('');
        if (addUrlInput) addUrlInput.value = '';
        if (fileInputAdd) fileInputAdd.value = '';
    });

    // Thêm biến thể nhanh trong modal Add Dish
    const btnAddVariant = document.getElementById('btn-add-variant');
    const variantsContainer = document.getElementById('variants-container');
    if (btnAddVariant && variantsContainer) {
        btnAddVariant.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 variant-entry-row';
            row.innerHTML = `
                <input type="text" placeholder="Tên biến thể (vd: Size L, Cay...)" class="variant-name-input flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-orange-500">
                <input type="text" placeholder="Giá cộng thêm (đ)" class="currency-input variant-price-input w-28 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-orange-500">
                <button type="button" class="btn-remove-variant-entry text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            `;
            variantsContainer.appendChild(row);
        });

        variantsContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const btnRemove = target.closest('.btn-remove-variant-entry');
            if (btnRemove) {
                btnRemove.closest('.variant-entry-row')?.remove();
            }
        });
    }

    // Submit form thêm món mới
    const formAddMenu = document.getElementById('form-add-menu') as HTMLFormElement;
    if (formAddMenu) {
        formAddMenu.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('menu-name') as HTMLInputElement;
            const priceInput = document.getElementById('menu-price') as HTMLInputElement;
            const catSelect = document.getElementById('menu-category') as HTMLSelectElement;

            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                showSuccessToast("⚠️ Vui lòng nhập tên món ăn!");
                nameInput?.focus();
                return;
            }

            const rawPrice = priceInput ? priceInput.value.replace(/\D/g, '') : '';
            if (!rawPrice) {
                showSuccessToast("⚠️ Vui lòng nhập giá món ăn hợp lệ!");
                priceInput?.focus();
                return;
            }
            const base_price = Number(rawPrice);

            const category_id = catSelect ? catSelect.value : undefined;
            if (!category_id) {
                showSuccessToast("⚠️ Vui lòng chọn danh mục cho món ăn!");
                return;
            }

            let image = currentAddImageValue ? currentAddImageValue.trim() : '';
            if (!image && addUrlInput && addUrlInput.value.trim()) {
                image = addUrlInput.value.trim();
            }
            if (!image) {
                image = 'https://placehold.co/150x150/orange/white?text=Food';
            }

            try {
                const payload: any = {
                    name,
                    base_price,
                    cost_price: Math.round(base_price * 0.45),
                    category_id,
                    image,
                    status: 'Available'
                };

                const createdDish = await taoMonAn(payload);
                const dishId = createdDish?._id || createdDish?.id || createdDish?.data?._id || createdDish?.data?.id;

                // Lưu các biến thể nếu có
                if (dishId && variantsContainer) {
                    const rows = variantsContainer.querySelectorAll('.variant-entry-row');
                    for (let i = 0; i < rows.length; i++) {
                        const r = rows[i];
                        const vName = (r.querySelector('.variant-name-input') as HTMLInputElement)?.value?.trim();
                        const vPriceStr = (r.querySelector('.variant-price-input') as HTMLInputElement)?.value?.replace(/\D/g, '');
                        if (vName) {
                            const vPrice = vPriceStr ? Number(vPriceStr) : 0;
                            try {
                                await fetch(API_VARIANTS_URL, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        id: `V${Date.now()}_${i}`,
                                        menuItem_id: dishId,
                                        group_name: 'Tùy chọn',
                                        name: vName,
                                        extra_price: vPrice,
                                        status: 'Available',
                                        allowMultiple: false
                                    })
                                });
                            } catch (_) {}
                        }
                    }
                }

                try {
                    const kdsChannel = new BroadcastChannel('pos_kitchen_channel');
                    kdsChannel.postMessage({ type: 'MENU_UPDATED', menuItemId: dishId });
                } catch (_) {}

                showSuccessToast(`🎉 Đã thêm món [${name}] vào Thực đơn thành công!`);
                closeAddMenuModal();
                await loadMenuItems();
            } catch (err: any) {
                console.error("Lỗi tạo món ăn:", err);
                showSuccessToast(`❌ Lỗi thêm món: ${err.message || 'Không thành công'}`);
            }
        });
    }

    // Modal Edit Dish Listeners
    document.getElementById('btn-close-edit-price')?.addEventListener('click', closeEditPriceModal);
    document.getElementById('btn-cancel-edit-price')?.addEventListener('click', closeEditPriceModal);

    // Chuyển Tab Ảnh (Upload vs URL) - gắn cả direct listeners & event delegation
    const tabUploadBtn = document.getElementById('tab-edit-img-upload');
    const tabUrlBtn = document.getElementById('tab-edit-img-url');
    tabUploadBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        switchEditImageTab('upload');
    });
    tabUrlBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        switchEditImageTab('url');
    });

    document.getElementById('modal-edit-price')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const btnUpload = target.closest('#tab-edit-img-upload');
        if (btnUpload) {
            e.preventDefault();
            switchEditImageTab('upload');
            return;
        }
        const btnUrl = target.closest('#tab-edit-img-url');
        if (btnUrl) {
            e.preventDefault();
            switchEditImageTab('url');
            return;
        }
    });

    // Upload ảnh từ thiết bị (Kéo thả hoặc click vào khung)
    const dropzone = document.getElementById('dropzone-edit-image');
    const fileInput = document.getElementById('edit-menu-file') as HTMLInputElement;

    const handleSelectedFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            showSuccessToast("⚠️ Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP)!");
            return;
        }
        try {
            const base64 = await compressImageFile(file);
            updateEditImageDisplay(base64, `📁 Tải lên: ${file.name}`);
            const editImgInput = document.getElementById('edit-menu-image') as HTMLInputElement;
            if (editImgInput) editImgInput.value = '';
            showSuccessToast("Đã chọn ảnh thành công!");
        } catch (err) {
            showSuccessToast("❌ Lỗi khi đọc file ảnh!");
        }
    };

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('#btn-remove-edit-image')) return;
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                handleSelectedFile(fileInput.files[0]);
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-orange-500', 'bg-orange-500/10');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-orange-500', 'bg-orange-500/10');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-orange-500', 'bg-orange-500/10');
            if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                handleSelectedFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Nhập link URL ảnh
    const editImgInput = document.getElementById('edit-menu-image') as HTMLInputElement;
    if (editImgInput) {
        editImgInput.addEventListener('input', () => {
            const url = editImgInput.value.trim();
            updateEditImageDisplay(url, url ? '🔗 Ảnh từ đường dẫn liên kết' : undefined);
        });
    }

    // Nút Xóa ảnh
    document.getElementById('btn-remove-edit-image')?.addEventListener('click', (e) => {
        e.stopPropagation();
        updateEditImageDisplay('');
        if (editImgInput) editImgInput.value = '';
        if (fileInput) fileInput.value = '';
    });

    // Quick tags trong modal edit
    document.querySelectorAll('.btn-quick-edit-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const tagsInput = document.getElementById('edit-menu-tags') as HTMLInputElement;
            if (!tag || !tagsInput) return;
            const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
            if (!currentTags.includes(tag)) {
                currentTags.push(tag);
                tagsInput.value = currentTags.join(', ');
            }
        });
    });

    const formEditPrice = document.getElementById('form-edit-price') as HTMLFormElement;
    if (formEditPrice) {
        formEditPrice.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!currentEditMenuItemId) return;

            const nameInput = document.getElementById('edit-menu-name') as HTMLInputElement;
            const catSelect = document.getElementById('edit-menu-category') as HTMLSelectElement;
            const priceInput = document.getElementById('edit-menu-price') as HTMLInputElement;
            const tagsInput = document.getElementById('edit-menu-tags') as HTMLInputElement;

            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                showSuccessToast("⚠️ Vui lòng nhập tên món ăn!");
                return;
            }

            const newPriceStr = priceInput ? priceInput.value.replace(/\D/g, '') : '';
            if(!newPriceStr) {
                showSuccessToast("⚠️ Vui lòng nhập giá hợp lệ!");
                return;
            }
            const newPrice = Number(newPriceStr);

            const category_id = catSelect ? catSelect.value : undefined;
            const editImgInput = document.getElementById('edit-menu-image') as HTMLInputElement;
            let image = currentEditImageValue ? currentEditImageValue.trim() : '';
            if (editImgInput && editImgInput.value.trim() && !image.startsWith('data:')) {
                image = editImgInput.value.trim();
            }
            const newTagsStr = tagsInput ? tagsInput.value.trim() : "";
            const newTags = newTagsStr ? newTagsStr.split(',').map(t => t.trim()).filter(t => t !== "") : [];

            try {
                const userStr = localStorage.getItem('currentUser') || localStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : { id: 'U001' };
                
                const updatePayload: any = {
                    name,
                    base_price: newPrice,
                    category_id,
                    image,
                    tags: newTags,
                    updatedBy: user.id,
                    updatedAt: new Date().toISOString()
                };
                
                await suaMonAn(currentEditMenuItemId, updatePayload);

                // Broadcast đồng bộ realtime đến POS & Bếp
                try {
                    const kdsChannel = new BroadcastChannel('pos_kitchen_channel');
                    kdsChannel.postMessage({ type: 'MENU_UPDATED', menuItemId: currentEditMenuItemId });
                } catch (_) {}

                showSuccessToast("Cập nhật thông tin món ăn thành công!");
                closeEditPriceModal();
                await loadMenuItems();
            } catch(err) {
                showSuccessToast("❌ Lỗi cập nhật món ăn");
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
                            <button type="button" class="btn-remove-variant-group text-slate-500 hover:text-red-400 transition" title="Xóa nhóm"><i class="fa-solid fa-trash text-sm"></i></button>
                        </div>
                    </div>
                    <div class="variant-items-container space-y-2">
                        <div class="new-variant-row flex items-end gap-3">
                            <div class="flex-1">
                                <input type="text" placeholder="Tên lựa chọn (VD: Size L)" class="variant-name-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 focus:bg-white">
                            </div>
                            <div class="w-28">
                                <input type="text" placeholder="Giá (+đ)" class="currency-input variant-price-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 focus:bg-white">
                            </div>
                            <button type="button" class="btn-remove-variant-row text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa dòng">
                                <i class="fa-solid fa-trash text-sm"></i>
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
                                <input type="text" placeholder="Tên lựa chọn (VD: Size L)" class="variant-name-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 focus:bg-white">
                            </div>
                            <div class="w-28">
                                <input type="text" placeholder="Giá (+đ)" class="currency-input variant-price-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 focus:bg-white">
                            </div>
                            <button type="button" class="btn-remove-variant-row text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa dòng">
                                <i class="fa-solid fa-trash text-sm"></i>
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
                                        <button type="button" class="btn-remove-variant-group text-slate-500 hover:text-red-400 transition" title="Xóa nhóm"><i class="fa-solid fa-trash text-sm"></i></button>
                                    </div>
                                </div>
                                <div class="variant-items-container space-y-2">
                                    <div class="new-variant-row flex items-end gap-3">
                                        <div class="flex-1">
                                            <input type="text" placeholder="Tên lựa chọn (VD: Size L)" class="variant-name-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 focus:bg-white">
                                        </div>
                                        <div class="w-28">
                                            <input type="text" placeholder="Giá (+đ)" class="currency-input variant-price-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:border-orange-500 focus:bg-white">
                                        </div>
                                        <button type="button" class="btn-remove-variant-row text-slate-500 hover:text-red-400 p-2 transition shrink-0" title="Xóa dòng">
                                            <i class="fa-solid fa-trash text-sm"></i>
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

export const updateMenuStats = () => {
    const totalEl = document.getElementById('stat-menu-total');
    const activeEl = document.getElementById('stat-menu-active');
    const comboEl = document.getElementById('stat-menu-combo');
    const hiddenEl = document.getElementById('stat-menu-hidden');

    const total = allMenuItems.length;
    const active = allMenuItems.filter(i => (i.status === 'Available' || i.status === true)).length;
    const combo = allMenuItems.filter(i => i.is_combo === true).length;
    const hidden = allMenuItems.filter(i => (i.status === 'Archived' || i.status === 'Out_of_stock' || i.status === false)).length;

    if (totalEl) totalEl.innerText = String(total);
    if (activeEl) activeEl.innerText = String(active);
    if (comboEl) comboEl.innerText = String(combo);
    if (hiddenEl) hiddenEl.innerText = String(hidden);
};

export const updateMenuCardStyles = () => {
    const configs = [
        { id: 'card-menu-total', filter: 'all', activeBorder: 'border-orange-500/80 ring-2 ring-orange-500/20' },
        { id: 'card-menu-active', filter: 'active', activeBorder: 'border-emerald-500/80 ring-2 ring-emerald-500/20' },
        { id: 'card-menu-combo', filter: 'combo', activeBorder: 'border-amber-500/80 ring-2 ring-amber-500/20' },
        { id: 'card-menu-hidden', filter: 'hidden', activeBorder: 'border-rose-500/80 ring-2 ring-rose-500/20' },
    ];

    configs.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        if (!el) return;
        const isSelected = currentMenuCardFilter === cfg.filter;
        const indicator = el.querySelector('.menu-card-indicator');

        if (isSelected) {
            el.className = `menu-stat-card cursor-pointer rounded-2xl p-5 border ${cfg.activeBorder} bg-orange-50/50 shadow-sm transition-all duration-200 scale-[1.02] select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'menu-card-indicator text-[10px] font-bold text-orange-500 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-check text-[9px]"></i> Đang lọc';
            }
        } else {
            el.className = `menu-stat-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-slate-400 active:scale-95 select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'menu-card-indicator text-[10px] font-bold text-slate-400 group-hover:text-slate-600 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-filter text-[9px]"></i> Lọc';
            }
        }
    });
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
        
        updateMenuStats();
        updateMenuCardStyles();
        applyMenuFilters();
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
            const itemCatId = (item.category_id && typeof item.category_id === 'object')
                ? String(item.category_id._id || item.category_id.id || '')
                : String(item.category_id || '');
            matchCategory = itemCatId === String(categorySelect);
        }

        let matchStatus = true;
        if (statusSelect === 'true') {
            matchStatus = item.status === 'Available' || item.status === true;
        } else if (statusSelect === 'false') {
            matchStatus = item.status === 'Archived' || item.status === 'Out_of_stock' || item.status === false;
        }

        let matchCard = true;
        if (currentMenuCardFilter === 'active') {
            matchCard = item.status === 'Available' || item.status === true;
        } else if (currentMenuCardFilter === 'combo') {
            matchCard = item.is_combo === true;
        } else if (currentMenuCardFilter === 'hidden') {
            matchCard = item.status === 'Archived' || item.status === 'Out_of_stock' || item.status === false;
        }

        return matchName && matchCategory && matchStatus && matchCard;
    });

    filtered.sort((a, b) => {
        let res = 0;
        if (menuSortCol === 'name') {
            res = (a.name || '').localeCompare(b.name || '', 'vi');
        } else if (menuSortCol === 'price') {
            res = Number(a.base_price || 0) - Number(b.base_price || 0);
        } else if (menuSortCol === 'category') {
            const catA = typeof a.category_id === 'object' && a.category_id ? (a.category_id.name || '') : '';
            const catB = typeof b.category_id === 'object' && b.category_id ? (b.category_id.name || '') : '';
            res = catA.localeCompare(catB, 'vi');
        } else if (menuSortCol === 'status') {
            res = (a.status || '').localeCompare(b.status || '');
        }
        return menuSortAsc ? res : -res;
    });

    renderMenuItemsTable(filtered);
};

function setupMenuSorting() {
    document.querySelectorAll<HTMLElement>('[data-menu-sort]').forEach(th => {
        th.onclick = () => {
            const col = th.getAttribute('data-menu-sort') || 'name';
            if (menuSortCol === col) {
                menuSortAsc = !menuSortAsc;
            } else {
                menuSortCol = col;
                menuSortAsc = (col === 'price' ? false : true);
            }
            document.querySelectorAll<HTMLElement>('[data-menu-sort]').forEach(h => {
                const icon = h.querySelector('i');
                const hCol = h.getAttribute('data-menu-sort');
                if (icon) {
                    if (hCol === menuSortCol) {
                        icon.className = menuSortAsc ? 'fa-solid fa-sort-up text-[10px] ml-1 text-slate-900' : 'fa-solid fa-sort-down text-[10px] ml-1 text-slate-900';
                    } else {
                        icon.className = 'fa-solid fa-sort text-[10px] ml-1 opacity-60';
                    }
                }
            });
            applyMenuFilters();
        };
    });
}

let currentMenuFilteredList: any[] = [];
let currentMenuRenderedCount = 0;
const MENU_ITEMS_PAGE_SIZE = 15;
let menuSentinelObserver: IntersectionObserver | null = null;

const createMenuItemRowHtml = (item: any, canUpdate: boolean = true): string => {
    const catId = typeof item.category_id === 'object' && item.category_id !== null
        ? String(item.category_id._id || item.category_id.id || '')
        : String(item.category_id || '');
    const cat = allCategories.find(c => String(c.id || (c as any)._id) === catId)
        || (typeof item.category_id === 'object' && item.category_id !== null ? item.category_id : null);
    let statusHtml = '';
    
    if (item.status === 'Available') {
        statusHtml = `<span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-black border border-emerald-500/30">Đang bán</span>`;
    } else if (item.status === 'Out_of_stock') {
        statusHtml = `<span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs font-black border border-orange-500/30">Hết nguyên liệu</span>`;
    } else {
        statusHtml = `<span class="bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full text-xs font-black border border-slate-500/30">Đã ẩn</span>`;
    }
    
    const btnToggleAction = item.status === 'Archived' 
        ? `<button data-id="${item.id}" data-status="${item.status}" class="btn-toggle-menu-status w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Mở lại món ${item.name}"><i class="fa-solid fa-eye text-xs"></i></button>`
        : `<button data-id="${item.id}" data-status="${item.status}" class="btn-toggle-menu-status w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Ẩn món ${item.name}"><i class="fa-solid fa-eye-slash text-xs"></i></button>`;

    const actionHtml = `
        <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
            ${canUpdate ? `<button data-id="${item.id}" class="btn-edit-price w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" title="Chỉnh sửa món ${item.name}"><i class="fa-solid fa-pen text-xs"></i></button>` : ''}
            ${canUpdate ? btnToggleAction : ''}
        </div>
    `;

    const variantConfigBtn = item.is_combo 
        ? `<button data-id="${item.id}" class="btn-view-combo-details px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-500 hover:text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap hover:scale-105 active:scale-95" title="Xem và sửa món thành phần trong Combo"><i class="fa-solid fa-boxes-stacked text-xs"></i><span>Món (${item.combo_items ? item.combo_items.length : 0})</span></button>`
        : `<button data-id="${item.id}" data-name="${item.name}" class="btn-config-variants px-3 py-1.5 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-500 hover:text-white transition-all shadow-sm whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95" title="Cấu hình biến thể cho ${item.name}"><i class="fa-solid fa-sliders text-xs mr-1"></i>Cấu hình</button>`;
    
    let tagsHtml = '';
    if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
        tagsHtml = `<div class="flex flex-wrap gap-1 mt-1.5">` + 
            item.tags.map((t: string) => {
                let bg = 'bg-slate-700 text-slate-300 border-slate-600';
                const tagUpper = t.toUpperCase();
                if (tagUpper.includes('BESTSELLER') || tagUpper.includes('BEST SELLER')) {
                    bg = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                } else if (tagUpper.includes('MUST TRY')) {
                    bg = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                } else if (tagUpper.includes('CAY') || tagUpper.includes('SPICY')) {
                    bg = 'bg-red-500/20 text-red-400 border-red-500/30';
                    t = '<i class="fa-solid fa-pepper-hot mr-1"></i>' + t;
                } else if (tagUpper.includes('CHAY') || tagUpper.includes('VEGAN')) {
                    bg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                    t = '<i class="fa-solid fa-leaf mr-1"></i>' + t;
                }
                return `<span class="${bg} border text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap leading-none">${t}</span>`;
            }).join('') + 
            `</div>`;
    }

    const catName = cat ? (cat.name || 'Danh mục') : (item.is_combo ? 'Set Combo' : 'Chưa phân loại');
    const rawIcon = (cat && cat.icon) ? cat.icon : (item.is_combo ? 'fa-boxes-stacked' : 'fa-utensils');
    const cleanIcon = rawIcon.replace(/^fa-(solid|regular|brands)\s+/, '');

    let categoryCellHtml = '';
    if (item.is_combo) {
        categoryCellHtml = `
            <div class="relative group inline-flex items-center justify-center">
                <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center text-sm shadow-sm transition-all duration-200 cursor-pointer group-hover:scale-110 active:scale-95" title="${catName}">
                    <i class="fa-solid fa-boxes-stacked"></i>
                </div>
                <!-- Tooltip hiện tên danh mục khi hover -->
                <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-amber-500/40 text-amber-300 text-xs font-bold whitespace-nowrap shadow-2xl z-30 pointer-events-none transition-all duration-200">
                    <i class="fa-solid fa-boxes-stacked text-amber-400 text-xs"></i>
                    <span>${catName}</span>
                    <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                </div>
            </div>
        `;
    } else {
        categoryCellHtml = `
            <div class="relative group inline-flex items-center justify-center">
                <div class="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 group-hover:bg-orange-500 group-hover:text-white flex items-center justify-center text-sm shadow-sm transition-all duration-200 cursor-pointer group-hover:scale-110 active:scale-95" title="${catName}">
                    <i class="fa-solid ${cleanIcon}"></i>
                </div>
                <!-- Tooltip hiện tên danh mục khi hover -->
                <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 text-white text-xs font-bold whitespace-nowrap shadow-2xl z-30 pointer-events-none transition-all duration-200">
                    <i class="fa-solid ${cleanIcon} text-orange-400 text-xs"></i>
                    <span>${catName}</span>
                    <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                </div>
            </div>
        `;
    }

    return `
        <tr class="hover:bg-slate-50 border-b border-slate-200">
            <td class="px-6 py-4 whitespace-nowrap">
                <img src="${item.image || 'https://placehold.co/150x150/orange/white?text=Food'}" alt="${item.name}" loading="lazy" decoding="async" class="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100">
            </td>
            <td class="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                <div class="flex items-center gap-2">
                    <span class="whitespace-nowrap text-sm text-slate-900 font-bold">${item.name}</span>
                </div>
                <div class="text-xs text-slate-400 font-mono">#${item.id || item._id}</div>
                ${item.serving_size ? `<p class="text-[11px] text-slate-500 font-medium mt-0.5 whitespace-nowrap"><i class="fa-solid fa-users text-[10px] mr-1 text-slate-400"></i>${item.serving_size}</p>` : ''}
                ${tagsHtml}
            </td>
            <td class="px-4 py-4 text-center whitespace-nowrap">
                ${categoryCellHtml}
            </td>
            <td class="px-6 py-4 text-orange-600 font-black whitespace-nowrap">${item.base_price.toLocaleString('vi-VN')} đ</td>
            <td class="px-6 py-4 whitespace-nowrap">${variantConfigBtn}</td>
            <td class="px-6 py-4 whitespace-nowrap">${statusHtml}</td>
            <td class="px-6 py-4 text-right whitespace-nowrap">${actionHtml}</td>
        </tr>
    `;
};

const renderNextMenuItemsBatch = () => {
    const tbody = document.getElementById('menu-table-body');
    if (!tbody || currentMenuRenderedCount >= currentMenuFilteredList.length) return;
    
    const oldSentinel = document.getElementById('menu-lazy-sentinel');
    if (oldSentinel) oldSentinel.remove();

    const batch = currentMenuFilteredList.slice(currentMenuRenderedCount, currentMenuRenderedCount + MENU_ITEMS_PAGE_SIZE);
    currentMenuRenderedCount += batch.length;
    
    const rowsHtml = batch.map(it => createMenuItemRowHtml(it, true)).join('');
    tbody.insertAdjacentHTML('beforeend', rowsHtml);

    if (currentMenuRenderedCount < currentMenuFilteredList.length) {
        const sentinel = document.createElement('tr');
        sentinel.id = 'menu-lazy-sentinel';
        sentinel.innerHTML = `<td colspan="7" class="px-6 py-4 text-center text-xs text-slate-500 font-bold"><i class="fa-solid fa-spinner fa-spin mr-2 text-orange-500"></i>Đang cuộn tải thêm (${currentMenuRenderedCount}/${currentMenuFilteredList.length} món)...</td>`;
        tbody.appendChild(sentinel);

        if (!menuSentinelObserver) {
            menuSentinelObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    renderNextMenuItemsBatch();
                }
            }, { root: document.querySelector('main'), threshold: 0.1 });
        }
        menuSentinelObserver.disconnect();
        menuSentinelObserver.observe(sentinel);
    }
};

const renderMenuItemsTable = (data: any[]) => {
    const tbody = document.getElementById('menu-table-body');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-slate-500">Không tìm thấy món ăn nào.</td></tr>`;
        return;
    }
    
    currentMenuFilteredList = data;
    currentMenuRenderedCount = 0;
    tbody.innerHTML = '';
    renderNextMenuItemsBatch();
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

const compressImageFile = (file: File, maxDimension: number = 800, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(e.target?.result as string);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(e.target?.result as string);
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const updateEditImageDisplay = (val: string, customBadge?: string) => {
    currentEditImageValue = val || '';
    const imgPreview = document.getElementById('edit-menu-image-preview') as HTMLImageElement;
    const imgPlaceholder = document.getElementById('edit-menu-image-placeholder') as HTMLElement;
    const statusBadge = document.getElementById('edit-image-status-badge');
    const removeBtn = document.getElementById('btn-remove-edit-image');
    const infoText = document.getElementById('edit-image-info-text');

    if (currentEditImageValue) {
        if (imgPreview) {
            imgPreview.src = currentEditImageValue;
            imgPreview.classList.remove('hidden');
        }
        if (imgPlaceholder) imgPlaceholder.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');

        if (statusBadge) {
            if (customBadge) {
                statusBadge.innerText = customBadge;
            } else if (currentEditImageValue.startsWith('data:')) {
                statusBadge.innerText = '📁 Ảnh tải lên từ thiết bị';
            } else if (currentEditImageValue.startsWith('http')) {
                statusBadge.innerText = '🔗 Ảnh từ đường dẫn liên kết';
            } else {
                statusBadge.innerText = 'Đã chọn ảnh';
            }
        }
        if (infoText) infoText.innerText = 'Sẵn sàng lưu & hiển thị trên Menu';
    } else {
        if (imgPreview) {
            imgPreview.src = '';
            imgPreview.classList.add('hidden');
        }
        if (imgPlaceholder) imgPlaceholder.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
        if (statusBadge) statusBadge.innerText = 'Chưa có ảnh';
        if (infoText) infoText.innerText = 'Hiển thị trực tiếp trên Menu khách & POS';
    }
};

const switchEditImageTab = (tab: 'upload' | 'url') => {
    const tabUpload = document.getElementById('tab-edit-img-upload');
    const tabUrl = document.getElementById('tab-edit-img-url');
    const paneUpload = document.getElementById('pane-edit-img-upload');
    const paneUrl = document.getElementById('pane-edit-img-url');

    if (tab === 'upload') {
        if (tabUpload) {
            tabUpload.className = "px-3.5 py-1.5 rounded-lg text-white bg-orange-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-bold";
        }
        if (tabUrl) {
            tabUrl.className = "px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold";
        }
        paneUpload?.classList.remove('hidden');
        paneUrl?.classList.add('hidden');
    } else {
        if (tabUrl) {
            tabUrl.className = "px-3.5 py-1.5 rounded-lg text-white bg-orange-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-bold";
        }
        if (tabUpload) {
            tabUpload.className = "px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold";
        }
        paneUrl?.classList.remove('hidden');
        paneUpload?.classList.add('hidden');

        setTimeout(() => {
            const urlInput = document.getElementById('edit-menu-image') as HTMLInputElement;
            urlInput?.focus();
        }, 50);
    }
};

// Expose to window so inline onclick can also trigger it directly
(window as any).switchEditImageTab = switchEditImageTab;

const updateAddImageDisplay = (val: string, customBadge?: string) => {
    currentAddImageValue = val || '';
    const imgPreview = document.getElementById('add-menu-image-preview') as HTMLImageElement;
    const imgPlaceholder = document.getElementById('add-menu-image-placeholder') as HTMLElement;
    const statusBadge = document.getElementById('add-image-status-badge');
    const removeBtn = document.getElementById('btn-remove-add-image');
    const infoText = document.getElementById('add-image-info-text');
    const hiddenInput = document.getElementById('menu-image') as HTMLInputElement;

    if (hiddenInput) hiddenInput.value = currentAddImageValue;

    if (currentAddImageValue) {
        if (imgPreview) {
            imgPreview.src = currentAddImageValue;
            imgPreview.classList.remove('hidden');
        }
        if (imgPlaceholder) imgPlaceholder.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');

        if (statusBadge) {
            if (customBadge) {
                statusBadge.innerText = customBadge;
            } else if (currentAddImageValue.startsWith('data:')) {
                statusBadge.innerText = '📁 Ảnh tải lên từ thiết bị';
            } else if (currentAddImageValue.startsWith('http')) {
                statusBadge.innerText = '🔗 Ảnh từ đường dẫn liên kết';
            } else {
                statusBadge.innerText = 'Đã chọn ảnh';
            }
        }
        if (infoText) infoText.innerText = 'Sẵn sàng lưu & hiển thị trên Menu';
    } else {
        if (imgPreview) {
            imgPreview.src = '';
            imgPreview.classList.add('hidden');
        }
        if (imgPlaceholder) imgPlaceholder.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
        if (statusBadge) statusBadge.innerText = 'Chưa có ảnh';
        if (infoText) infoText.innerText = 'Hiển thị trực tiếp trên Menu khách & POS';
    }
};

const switchAddImageTab = (tab: 'upload' | 'url') => {
    const tabUpload = document.getElementById('tab-add-img-upload');
    const tabUrl = document.getElementById('tab-add-img-url');
    const paneUpload = document.getElementById('pane-add-img-upload');
    const paneUrl = document.getElementById('pane-add-img-url');

    if (tab === 'upload') {
        if (tabUpload) {
            tabUpload.className = "px-3 py-1 rounded-lg text-white bg-orange-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        if (tabUrl) {
            tabUrl.className = "px-3 py-1 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        paneUpload?.classList.remove('hidden');
        paneUrl?.classList.add('hidden');
    } else {
        if (tabUrl) {
            tabUrl.className = "px-3 py-1 rounded-lg text-white bg-orange-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        if (tabUpload) {
            tabUpload.className = "px-3 py-1 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        paneUrl?.classList.remove('hidden');
        paneUpload?.classList.add('hidden');

        setTimeout(() => {
            const urlInput = document.getElementById('add-menu-image-url') as HTMLInputElement;
            urlInput?.focus();
        }, 50);
    }
};

(window as any).switchAddImageTab = switchAddImageTab;

const openAddMenuModal = (preselectCategoryId?: string) => {
    const modal = document.getElementById('modal-menu-form');
    if (!modal) return;

    const nameInput = document.getElementById('menu-name') as HTMLInputElement;
    const priceInput = document.getElementById('menu-price') as HTMLInputElement;
    const catSelect = document.getElementById('menu-category') as HTMLSelectElement;
    const fileInput = document.getElementById('add-menu-file') as HTMLInputElement;
    const urlInput = document.getElementById('add-menu-image-url') as HTMLInputElement;
    const variantsContainer = document.getElementById('variants-container');

    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (variantsContainer) variantsContainer.innerHTML = '';

    if (catSelect && allCategories.length > 0) {
        catSelect.innerHTML = allCategories.map(c => `
            <option value="${c.id || c._id}" ${preselectCategoryId && String(c.id || c._id) === String(preselectCategoryId) ? 'selected' : ''}>${c.name}</option>
        `).join('');
    }

    switchAddImageTab('upload');
    updateAddImageDisplay('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

const closeAddMenuModal = () => {
    const modal = document.getElementById('modal-menu-form');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

(window as any).openAddMenuModal = openAddMenuModal;
(window as any).closeAddMenuModal = closeAddMenuModal;

const updateComboImageDisplay = (val: string, customBadge?: string) => {
    currentComboImageValue = val || '';
    const imgPreview = document.getElementById('combo-image-preview') as HTMLImageElement;
    const imgPlaceholder = document.getElementById('combo-image-placeholder') as HTMLElement;
    const statusBadge = document.getElementById('combo-image-status-badge');
    const removeBtn = document.getElementById('btn-remove-combo-image');
    const infoText = document.getElementById('combo-image-info-text');
    const hiddenInput = document.getElementById('combo-image') as HTMLInputElement;

    if (hiddenInput) hiddenInput.value = currentComboImageValue;

    if (currentComboImageValue) {
        if (imgPreview) {
            imgPreview.src = currentComboImageValue;
            imgPreview.classList.remove('hidden');
        }
        if (imgPlaceholder) imgPlaceholder.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');

        if (statusBadge) {
            if (customBadge) {
                statusBadge.innerText = customBadge;
            } else if (currentComboImageValue.startsWith('data:')) {
                statusBadge.innerText = '📁 Ảnh tải lên từ thiết bị';
            } else if (currentComboImageValue.startsWith('http')) {
                statusBadge.innerText = '🔗 Ảnh từ đường dẫn liên kết';
            } else {
                statusBadge.innerText = 'Đã chọn ảnh';
            }
        }
        if (infoText) infoText.innerText = 'Sẵn sàng lưu & hiển thị trên Menu';
    } else {
        if (imgPreview) {
            imgPreview.src = '';
            imgPreview.classList.add('hidden');
        }
        if (imgPlaceholder) imgPlaceholder.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
        if (statusBadge) statusBadge.innerText = 'Chưa có ảnh';
        if (infoText) infoText.innerText = 'Hiển thị trực tiếp trên Menu khách & POS';
    }
};

const switchComboImageTab = (tab: 'upload' | 'url') => {
    const tabUpload = document.getElementById('tab-combo-img-upload');
    const tabUrl = document.getElementById('tab-combo-img-url');
    const paneUpload = document.getElementById('pane-combo-img-upload');
    const paneUrl = document.getElementById('pane-combo-img-url');

    if (tab === 'upload') {
        if (tabUpload) {
            tabUpload.className = "px-3.5 py-1.5 rounded-lg text-white bg-orange-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        if (tabUrl) {
            tabUrl.className = "px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        paneUpload?.classList.remove('hidden');
        paneUrl?.classList.add('hidden');
    } else {
        if (tabUrl) {
            tabUrl.className = "px-3.5 py-1.5 rounded-lg text-white bg-orange-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        if (tabUpload) {
            tabUpload.className = "px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs";
        }
        paneUrl?.classList.remove('hidden');
        paneUpload?.classList.add('hidden');

        setTimeout(() => {
            const urlInput = document.getElementById('combo-image-url') as HTMLInputElement;
            urlInput?.focus();
        }, 50);
    }
};

(window as any).switchComboImageTab = switchComboImageTab;

const openEditPriceModal = (id: string) => {
    currentEditMenuItemId = id;
    const item = allMenuItems.find(m => String(m.id) === String(id));
    if (!item) return;

    const modal = document.getElementById('modal-edit-price');
    const title = document.getElementById('edit-price-modal-title');
    const nameInput = document.getElementById('edit-menu-name') as HTMLInputElement;
    const catSelect = document.getElementById('edit-menu-category') as HTMLSelectElement;
    const priceInput = document.getElementById('edit-menu-price') as HTMLInputElement;
    const tagsInput = document.getElementById('edit-menu-tags') as HTMLInputElement;
    const imgUrlInput = document.getElementById('edit-menu-image') as HTMLInputElement;
    const fileInput = document.getElementById('edit-menu-file') as HTMLInputElement;
    
    if (title) title.innerText = `Chỉnh sửa: ${item.name}`;
    if (nameInput) nameInput.value = item.name || '';
    
    // Fill categories dropdown
    if (catSelect) {
        catSelect.innerHTML = allCategories.map(c => 
            `<option value="${c.id}" ${String(c.id) === String(item.category_id) ? 'selected' : ''}>${c.name}</option>`
        ).join('');
    }

    if (priceInput) priceInput.value = Number(item.base_price || 0).toLocaleString('vi-VN');

    // Cài đặt hình ảnh & Tab tương ứng
    currentEditImageValue = item.image || '';
    if (fileInput) fileInput.value = '';

    if (currentEditImageValue.startsWith('http')) {
        if (imgUrlInput) imgUrlInput.value = currentEditImageValue;
        switchEditImageTab('url');
        updateEditImageDisplay(currentEditImageValue, '🔗 Ảnh từ đường dẫn liên kết');
    } else if (currentEditImageValue.startsWith('data:')) {
        if (imgUrlInput) imgUrlInput.value = '';
        switchEditImageTab('upload');
        updateEditImageDisplay(currentEditImageValue, '📁 Ảnh tải lên từ thiết bị');
    } else if (currentEditImageValue) {
        if (imgUrlInput) imgUrlInput.value = currentEditImageValue;
        switchEditImageTab('url');
        updateEditImageDisplay(currentEditImageValue);
    } else {
        if (imgUrlInput) imgUrlInput.value = '';
        switchEditImageTab('upload');
        updateEditImageDisplay('');
    }

    if (tagsInput) {
        tagsInput.value = Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '');
    }

    // Hiển thị banner chuyển sang sửa món combo nếu món đang sửa là Combo
    const comboBanner = document.getElementById('edit-combo-notice-banner');
    const comboCountEl = document.getElementById('edit-combo-banner-count');
    if (item.is_combo) {
        if (comboBanner) comboBanner.classList.remove('hidden');
        if (comboCountEl) comboCountEl.innerText = String(Array.isArray(item.combo_items) ? item.combo_items.length : 0);
    } else {
        if (comboBanner) comboBanner.classList.add('hidden');
    }
    
    if (modal) {
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
            const recipeRes = await fetch(`${API_BACKEND_URL}/variant-recipes`);
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
                    <div class="variant-item-container flex flex-col p-3 rounded-xl border ${isArchived ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white shadow-sm'} transition-all">
                        <div class="variant-view-mode flex items-center justify-between w-full">
                            <div>
                                <p class="text-sm font-bold text-slate-900 ${isArchived ? 'line-through text-slate-400' : ''}">${v.name} ${recipeBadge}</p>
                                <p class="text-xs font-black text-orange-500">+ ${Number(v.extra_price).toLocaleString('vi-VN')} đ</p>
                            </div>
                            <div class="flex gap-1.5">
                                ${!isArchived ? `
                                <button data-id="${v.id}" class="btn-edit-variant p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition group" title="Sửa">
                                    <i class="fa-solid fa-pen-to-square text-sm"></i>
                                </button>
                                ` : ''}
                                <button data-id="${v.id}" data-name="${v.name}" class="btn-variant-recipe p-2 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition group" title="Định lượng">
                                    <i class="fa-solid fa-boxes-stacked text-sm"></i>
                                </button>
                                <button data-id="${v.id}" data-status="${v.status}" class="btn-toggle-variant p-2 rounded-lg ${isArchived ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'} transition group" title="${isArchived ? 'Khôi phục' : 'Ẩn'}">
                                    ${isArchived 
                                        ? `<i class="fa-solid fa-circle-info text-sm"></i>`
                                        : `<i class="fa-solid fa-circle-info text-sm"></i>`
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

// ==========================================
// QUẢN LÝ COMBO ƯU ĐÃI (COMBO BUILDER ENGINE)
// ==========================================

const openComboBuilderModal = async (editComboId?: string) => {
    const modal = document.getElementById('modal-combo-builder');
    if (!modal) return;

    currentEditComboId = editComboId || null;

    const modalTitle = document.getElementById('combo-builder-modal-title');
    const modalSubtitle = document.getElementById('combo-builder-modal-subtitle');
    const submitBtn = document.getElementById('btn-submit-combo-builder');

    const nameInput = document.getElementById('combo-name') as HTMLInputElement;
    const sizeSelect = document.getElementById('combo-serving-size') as HTMLSelectElement;
    const catSelect = document.getElementById('combo-category') as HTMLSelectElement;
    const imgInput = document.getElementById('combo-image') as HTMLInputElement;
    const descInput = document.getElementById('combo-desc') as HTMLTextAreaElement;
    const priceInput = document.getElementById('combo-price') as HTMLInputElement;
    const qtyInput = document.getElementById('combo-item-qty') as HTMLInputElement;

    // Populate categories
    if (catSelect && allCategories.length > 0) {
        catSelect.innerHTML = allCategories.map(c => `
            <option value="${c.id || c._id}">${c.name}</option>
        `).join('');
    }

    // Populate non-combo items into select
    const itemSelect = document.getElementById('combo-select-item') as HTMLSelectElement;
    if (itemSelect) {
        const singleItems = allMenuItems.filter(m => !m.is_combo && m.status !== 'Archived');
        itemSelect.innerHTML = singleItems.map(m => `
            <option value="${m.id || m._id}" data-price="${m.base_price}">${m.name} (${Number(m.base_price || 0).toLocaleString('vi-VN')} đ)</option>
        `).join('');

        if (singleItems.length > 0) {
            await handleComboSelectItemChange(singleItems[0].id || singleItems[0]._id);
        }
    }

    if (qtyInput) qtyInput.value = '1';

    if (currentEditComboId) {
        // --- CHẾ ĐỘ CHỈNH SỬA COMBO ĐÃ CÓ ---
        const comboItem = allMenuItems.find(m => String(m.id || m._id) === String(currentEditComboId));
        if (!comboItem) {
            showSuccessToast("❌ Không tìm thấy thông tin Combo");
            return;
        }

        if (modalTitle) modalTitle.innerText = `Chỉnh Sửa Combo: ${comboItem.name}`;
        if (modalSubtitle) modalSubtitle.innerText = 'Thêm/xóa món thành phần, chọn biến thể & điều chỉnh giá ưu đãi';
        if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Cập nhật Combo`;

        if (nameInput) nameInput.value = comboItem.name || '';
        if (sizeSelect) sizeSelect.value = comboItem.serving_size || '2 người';
        if (catSelect) {
            const catId = comboItem.category_id?._id || comboItem.category_id || '';
            if (catId) catSelect.value = String(catId);
        }
        
        const comboImg = comboItem.image || '';
        const comboUrlInput = document.getElementById('combo-image-url') as HTMLInputElement;
        const comboFileInput = document.getElementById('combo-menu-file') as HTMLInputElement;
        if (comboFileInput) comboFileInput.value = '';

        if (comboImg.startsWith('http')) {
            if (comboUrlInput) comboUrlInput.value = comboImg;
            switchComboImageTab('url');
            updateComboImageDisplay(comboImg, '🔗 Ảnh từ đường dẫn liên kết');
        } else if (comboImg.startsWith('data:')) {
            if (comboUrlInput) comboUrlInput.value = '';
            switchComboImageTab('upload');
            updateComboImageDisplay(comboImg, '📁 Ảnh tải lên từ thiết bị');
        } else if (comboImg) {
            if (comboUrlInput) comboUrlInput.value = comboImg;
            switchComboImageTab('url');
            updateComboImageDisplay(comboImg);
        } else {
            if (comboUrlInput) comboUrlInput.value = '';
            switchComboImageTab('upload');
            updateComboImageDisplay('');
        }

        if (descInput) descInput.value = comboItem.description || '';
        if (priceInput) priceInput.value = Number(comboItem.base_price || 0).toLocaleString('vi-VN');

        // Phân tích danh sách món thành phần hiện có trong Combo
        comboBuilderItems = [];
        const rawItems = Array.isArray(comboItem.combo_items) ? comboItem.combo_items : [];
        for (const it of rawItems) {
            if (typeof it === 'string') {
                const match = it.match(/^(\d+)x\s*(.*)$/);
                const qty = match ? parseInt(match[1], 10) : 1;
                const rawName = match ? match[2].trim() : it.trim();
                const matchedDish = allMenuItems.find(m => 
                    !m.is_combo && (
                        m.name.toLowerCase() === rawName.toLowerCase() ||
                        rawName.toLowerCase().includes(m.name.toLowerCase()) ||
                        m.name.toLowerCase().includes(rawName.toLowerCase())
                    )
                );
                const unitP = matchedDish ? Number(matchedDish.base_price || 0) : 0;
                comboBuilderItems.push({
                    menuItem_id: matchedDish ? String(matchedDish.id || matchedDish._id) : `custom_${Date.now()}_${Math.random()}`,
                    name: matchedDish ? matchedDish.name : rawName,
                    variant_id: null,
                    variant_name: '',
                    quantity: qty,
                    unit_price: unitP,
                    original_price: unitP * qty
                });
            } else if (typeof it === 'object' && it !== null) {
                const dishId = it.menuItem_id || it.id || it._id || '';
                const matchedDish = allMenuItems.find(m => String(m.id || m._id) === String(dishId));
                const matchedName = it.name || (matchedDish ? matchedDish.name : 'Món ăn');
                const qty = Number(it.quantity) || 1;
                let unitP = Number(it.item_unit_price || it.unit_price || 0);
                if (!unitP && matchedDish) {
                    unitP = Number(matchedDish.base_price || 0) + Number(it.extra_price || 0);
                }
                let origP = Number(it.original_price || 0);
                if (!origP) {
                    origP = unitP * qty;
                }
                if (!unitP && origP && qty) {
                    unitP = Math.round(origP / qty);
                }
                comboBuilderItems.push({
                    menuItem_id: dishId || (matchedDish ? String(matchedDish.id || matchedDish._id) : ''),
                    name: matchedName,
                    variant_id: it.variant_id || null,
                    variant_name: it.variant_name || '',
                    quantity: qty,
                    unit_price: unitP,
                    original_price: origP
                });
            }
        }
    } else {
        // --- CHẾ ĐỘ TẠO MỚI COMBO ---
        if (modalTitle) modalTitle.innerText = 'Tạo Combo Ưu Đãi Mới';
        if (modalSubtitle) modalSubtitle.innerText = 'Gom các món lẻ & biến thể thành set Combo với giá ưu đãi';
        if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Lưu Combo`;

        if (nameInput) nameInput.value = '';
        if (sizeSelect) sizeSelect.value = '2 người';
        
        const comboUrlInput = document.getElementById('combo-image-url') as HTMLInputElement;
        const comboFileInput = document.getElementById('combo-menu-file') as HTMLInputElement;
        if (comboFileInput) comboFileInput.value = '';
        const defaultSampleImg = 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500';
        if (comboUrlInput) comboUrlInput.value = defaultSampleImg;
        switchComboImageTab('url');
        updateComboImageDisplay(defaultSampleImg, '🔗 Ảnh mẫu mặc định');

        if (descInput) descInput.value = '';
        if (priceInput) priceInput.value = '';

        const comboCat = allCategories.find(c => c.name.toLowerCase().includes('combo'));
        if (comboCat && catSelect) catSelect.value = comboCat.id || comboCat._id;

        comboBuilderItems = [];
    }

    renderComboItemsList();
    updateComboPricingSummary();
    modal.classList.remove('hidden');
};

const closeComboBuilderModal = () => {
    const modal = document.getElementById('modal-combo-builder');
    if (modal) modal.classList.add('hidden');
    currentEditComboId = null;
};

const handleComboSelectItemChange = async (itemId?: string) => {
    const itemSelect = document.getElementById('combo-select-item') as HTMLSelectElement;
    const selectedId = itemId || (itemSelect ? itemSelect.value : '');
    const variantSelect = document.getElementById('combo-select-variant') as HTMLSelectElement;
    if (!variantSelect) return;

    if (!selectedId) {
        variantSelect.innerHTML = '<option value="">(Mặc định - Giá chuẩn)</option>';
        return;
    }

    const selectedDish = allMenuItems.find(m => String(m.id || m._id) === String(selectedId));
    const basePrice = selectedDish ? Number(selectedDish.base_price || 0) : 0;

    variantSelect.innerHTML = `<option value="" data-name="" data-price="${basePrice}">(Mặc định) - ${basePrice.toLocaleString('vi-VN')} đ</option>`;

    try {
        const variants = await layDanhSachVariants(selectedId);
        cachedVariantsForCombo = Array.isArray(variants) ? variants : [];
        if (cachedVariantsForCombo.length > 0) {
            cachedVariantsForCombo.forEach(v => {
                const adj = Number(v.extra_price || v.price_adjustment || 0);
                const finalP = basePrice + adj;
                variantSelect.innerHTML += `<option value="${v.id || v._id}" data-name="${v.name}" data-price="${finalP}">${v.name} (+${adj.toLocaleString('vi-VN')} đ) - ${finalP.toLocaleString('vi-VN')} đ</option>`;
            });
        }
    } catch (_) {}
};

const handleAddComboItem = () => {
    const itemSelect = document.getElementById('combo-select-item') as HTMLSelectElement;
    const variantSelect = document.getElementById('combo-select-variant') as HTMLSelectElement;
    const qtyInput = document.getElementById('combo-item-qty') as HTMLInputElement;

    const selectedItemId = itemSelect ? itemSelect.value : '';
    if (!selectedItemId) {
        showSuccessToast("⚠️ Vui lòng chọn món ăn!");
        return;
    }

    const selectedDish = allMenuItems.find(m => String(m.id || m._id) === String(selectedItemId));
    if (!selectedDish) return;

    const selectedOption = variantSelect ? variantSelect.options[variantSelect.selectedIndex] : null;
    const variantId = variantSelect ? variantSelect.value : '';
    const variantName = selectedOption ? (selectedOption.getAttribute('data-name') || '') : '';
    const unitPrice = selectedOption ? Number(selectedOption.getAttribute('data-price') || selectedDish.base_price || 0) : Number(selectedDish.base_price || 0);
    const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1') || 1);

    // Kiểm tra xem món đó (và đúng biến thể đó) đã có trong danh sách chưa
    const existingIndex = comboBuilderItems.findIndex(it => 
        String(it.menuItem_id) === String(selectedItemId) && 
        String(it.variant_id || '') === String(variantId || '')
    );

    if (existingIndex !== -1) {
        // Tăng số lượng nếu đã có món đó
        comboBuilderItems[existingIndex].quantity += qty;
        comboBuilderItems[existingIndex].original_price = unitPrice * comboBuilderItems[existingIndex].quantity;
        showSuccessToast(`Đã tăng số lượng món "${selectedDish.name}" lên ${comboBuilderItems[existingIndex].quantity}`);
    } else {
        // Thêm mới vào danh sách
        comboBuilderItems.push({
            menuItem_id: selectedItemId,
            name: selectedDish.name,
            variant_id: variantId || null,
            variant_name: variantName,
            quantity: qty,
            unit_price: unitPrice,
            original_price: unitPrice * qty
        });
        showSuccessToast(`Đã thêm món "${selectedDish.name}" vào Combo`);
    }

    renderComboItemsList();
    updateComboPricingSummary();
};

const renderComboItemsList = () => {
    const container = document.getElementById('combo-items-list');
    const countEl = document.getElementById('combo-items-count');
    if (!container) return;

    if (countEl) countEl.innerText = String(comboBuilderItems.length);

    if (comboBuilderItems.length === 0) {
        container.innerHTML = `<div class="p-4 rounded-xl bg-slate-900/40 border border-dashed border-slate-700 text-center">
            <p class="text-xs text-slate-500 italic" id="combo-items-empty">Chưa có món nào trong Combo. Vui lòng chọn món ở trên và bấm "+ Thêm".</p>
        </div>`;
        return;
    }

    container.innerHTML = comboBuilderItems.map((it, idx) => {
        const unitP = it.unit_price || (it.original_price && it.quantity ? Math.round(it.original_price / it.quantity) : 0);
        return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white shadow-sm hover:border-slate-600 transition">
            <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-black text-xs flex items-center justify-center shrink-0 border border-orange-500/30">${idx + 1}</span>
                <div class="truncate">
                    <p class="font-bold text-white truncate text-xs">${it.name}</p>
                    <div class="flex items-center gap-1.5 text-[11px] text-slate-400">
                        ${it.variant_name ? `<span class="text-amber-400 font-semibold">(${it.variant_name})</span> • ` : ''}
                        <span>${unitP.toLocaleString('vi-VN')} đ/phần</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3 shrink-0 ml-2">
                <!-- Nút Tăng / Giảm số lượng -->
                <div class="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <button type="button" data-index="${idx}" data-action="dec" class="btn-qty-combo-item px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition font-bold" title="Giảm số lượng">-</button>
                    <span class="px-2 font-black text-amber-600 text-xs min-w-[20px] text-center">${it.quantity}</span>
                    <button type="button" data-index="${idx}" data-action="inc" class="btn-qty-combo-item px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition font-bold" title="Tăng số lượng">+</button>
                </div>
                <span class="font-black text-slate-900 text-right min-w-[75px]">${it.original_price.toLocaleString('vi-VN')} đ</span>
                <button type="button" data-index="${idx}" class="btn-remove-combo-item text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition cursor-pointer" title="Xóa món này khỏi Combo">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
};

const updateComboPricingSummary = () => {
    const origTotalEl = document.getElementById('combo-original-total');
    const priceInput = document.getElementById('combo-price') as HTMLInputElement;
    const savingsBadge = document.getElementById('combo-savings-badge');
    const warningBox = document.getElementById('combo-savings-warning');
    const warningText = document.getElementById('combo-savings-warning-text');

    const originalTotal = comboBuilderItems.reduce((s, it) => s + (Number(it.original_price) || 0), 0);
    if (origTotalEl) origTotalEl.innerText = `${originalTotal.toLocaleString('vi-VN')} đ`;

    const comboPrice = priceInput ? (parseFloat(priceInput.value.replace(/\D/g, '')) || 0) : 0;
    const diff = originalTotal - comboPrice;
    const pct = (originalTotal > 0 && diff > 0) ? Math.round((diff / originalTotal) * 100) : 0;
    const minAllowedPrice = Math.ceil(originalTotal * 0.5);

    if (savingsBadge) {
        if (comboPrice > 0 && diff > 0) {
            if (pct > 50) {
                // CẢNH BÁO: MỨC GIẢM GIÁ QUÁ 50%
                savingsBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black border border-rose-500/40 shadow-sm shadow-rose-500/20 animate-pulse';
                savingsBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400"></i> Tiết kiệm ${diff.toLocaleString('vi-VN')} đ (${pct}%) - Quá 50%!`;

                if (warningBox && warningText) {
                    warningBox.classList.remove('hidden');
                    warningBox.classList.add('flex');
                    warningText.innerHTML = `⚠️ Cảnh báo: Mức giảm giá (<span class="underline font-black">${pct}%</span>) vượt quá quy định 50%! Giá bán tối thiểu của combo phải từ <span class="text-amber-300 font-black">${minAllowedPrice.toLocaleString('vi-VN')} đ</span>`;
                }

                if (priceInput) {
                    priceInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30', 'text-rose-200');
                    priceInput.classList.remove('border-amber-500/50');
                }
            } else {
                // HỢP LỆ (0% < pct <= 50%)
                savingsBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/30';
                savingsBadge.innerHTML = `<i class="fa-solid fa-arrow-down"></i> Tiết kiệm ${diff.toLocaleString('vi-VN')} đ (${pct}%)`;

                if (warningBox) {
                    warningBox.classList.add('hidden');
                    warningBox.classList.remove('flex');
                }

                if (priceInput) {
                    priceInput.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30', 'text-rose-200');
                    priceInput.classList.add('border-amber-500/50');
                }
            }
        } else if (comboPrice > 0 && diff <= 0) {
            savingsBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-400 text-xs font-bold';
            savingsBadge.innerText = comboPrice === originalTotal ? 'Bằng giá mua lẻ (0%)' : 'Không giảm giá (Giá cao hơn giá lẻ)';

            if (warningBox) {
                warningBox.classList.add('hidden');
                warningBox.classList.remove('flex');
            }

            if (priceInput) {
                priceInput.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30', 'text-rose-200');
                priceInput.classList.add('border-amber-500/50');
            }
        } else {
            savingsBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-400 text-xs font-bold';
            savingsBadge.innerText = '0 đ (0%)';

            if (warningBox) {
                warningBox.classList.add('hidden');
                warningBox.classList.remove('flex');
            }

            if (priceInput) {
                priceInput.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30', 'text-rose-200');
                priceInput.classList.add('border-amber-500/50');
            }
        }
    }
};

const handleSaveCombo = async () => {
    const nameInput = document.getElementById('combo-name') as HTMLInputElement;
    const sizeSelect = document.getElementById('combo-serving-size') as HTMLSelectElement;
    const catSelect = document.getElementById('combo-category') as HTMLSelectElement;
    const imgInput = document.getElementById('combo-image') as HTMLInputElement;
    const descInput = document.getElementById('combo-desc') as HTMLTextAreaElement;
    const priceInput = document.getElementById('combo-price') as HTMLInputElement;

    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
        showSuccessToast("⚠️ Vui lòng nhập Tên Combo!");
        nameInput?.focus();
        return;
    }

    if (comboBuilderItems.length < 2) {
        showSuccessToast("⚠️ Combo phải có ít nhất 2 món thành phần!");
        return;
    }

    const price = priceInput ? (parseFloat(priceInput.value.replace(/\D/g, '')) || 0) : 0;
    if (price <= 0) {
        showSuccessToast("⚠️ Vui lòng nhập Giá bán Combo hợp lệ!");
        priceInput?.focus();
        return;
    }

    // Kiểm tra quy định: Mức giảm giá không được vượt quá 50%
    const originalTotal = comboBuilderItems.reduce((s, it) => s + (Number(it.original_price) || 0), 0);
    if (originalTotal > 0) {
        const diff = originalTotal - price;
        const pct = diff > 0 ? Math.round((diff / originalTotal) * 100) : 0;
        if (pct > 50) {
            const minAllowed = Math.ceil(originalTotal * 0.5);
            showSuccessToast(`⚠️ Mức giảm giá combo (${pct}%) vượt quá quy định 50%! Giá bán tối thiểu từ ${minAllowed.toLocaleString('vi-VN')} đ`);
            priceInput?.focus();
            return;
        }
    }

    const category_id = catSelect ? catSelect.value : undefined;
    if (!category_id) {
        showSuccessToast("⚠️ Vui lòng chọn Danh mục cho Combo!");
        return;
    }

    // Định dạng danh sách món thành phần lưu trữ
    const formattedComboItems = comboBuilderItems.map(it => ({
        menuItem_id: it.menuItem_id,
        name: it.name,
        variant_id: it.variant_id || null,
        variant_name: it.variant_name || '',
        quantity: it.quantity,
        item_unit_price: it.unit_price || Math.round(it.original_price / it.quantity),
        original_price: it.original_price
    }));

    const comboUrlInput = document.getElementById('combo-image-url') as HTMLInputElement;
    let finalComboImage = currentComboImageValue ? currentComboImageValue.trim() : '';
    if (!finalComboImage && comboUrlInput && comboUrlInput.value.trim()) {
        finalComboImage = comboUrlInput.value.trim();
    }
    if (!finalComboImage) {
        finalComboImage = 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500';
    }

    if (currentEditComboId) {
        // --- CẬP NHẬT COMBO ĐÃ CÓ ---
        const payload: any = {
            name,
            category_id,
            base_price: price,
            cost_price: Math.round(price * 0.45),
            image: finalComboImage,
            description: descInput ? descInput.value.trim() : '',
            is_combo: true,
            serving_size: sizeSelect ? sizeSelect.value : '2 người',
            combo_items: formattedComboItems,
            updatedAt: new Date().toISOString()
        };

        try {
            await suaMonAn(currentEditComboId, payload);
            try {
                const kdsChannel = new BroadcastChannel('pos_kitchen_channel');
                kdsChannel.postMessage({ type: 'MENU_UPDATED', menuItemId: currentEditComboId });
            } catch (_) {}

            showSuccessToast(`🎉 Đã cập nhật Combo [${name}] thành công!`);
            closeComboBuilderModal();
            await loadMenuItems();
        } catch (err: any) {
            console.error("Lỗi cập nhật combo:", err);
            showSuccessToast(`❌ Lỗi cập nhật Combo: ${err.message || 'Không thành công'}`);
        }
    } else {
        // --- TẠO MỚI COMBO ---
        const payload: any = {
            name,
            category_id,
            base_price: price,
            cost_price: Math.round(price * 0.45),
            image: finalComboImage,
            description: descInput ? descInput.value.trim() : '',
            is_combo: true,
            serving_size: sizeSelect ? sizeSelect.value : '2 người',
            combo_items: formattedComboItems,
            status: 'Available'
        };

        try {
            await taoMonAn(payload);
            try {
                const kdsChannel = new BroadcastChannel('pos_kitchen_channel');
                kdsChannel.postMessage({ type: 'MENU_UPDATED' });
            } catch (_) {}

            showSuccessToast(`🎉 Đã tạo Combo [${name}] thành công!`);
            closeComboBuilderModal();
            await loadMenuItems();
        } catch (err: any) {
            console.error("Lỗi tạo combo:", err);
            showSuccessToast(`❌ Lỗi tạo Combo: ${err.message || 'Không thành công'}`);
        }
    }
};

const viewComboDetails = async (comboId: string) => {
    openComboBuilderModal(comboId);
};
