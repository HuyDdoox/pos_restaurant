import { layDanhSachDanhMuc, layDanhSachMonAn, taoDanhMuc, suaDanhMuc } from './api';
import { showSuccessToast, showWarningToast, showConfirmModal } from './utils/ui';
export const PRESET_ICONS = [
    { icon: 'fa-bowl-food', label: 'Khai vị' },
    { icon: 'fa-drumstick-bite', label: 'Món chính' },
    { icon: 'fa-pizza-slice', label: 'Mì & Pizza' },
    { icon: 'fa-shrimp', label: 'Hải sản' },
    { icon: 'fa-ice-cream', label: 'Tráng miệng' },
    { icon: 'fa-wine-glass', label: 'Đồ uống' },
    { icon: 'fa-layer-group', label: 'Combo' },
    { icon: 'fa-burger', label: 'Burger' },
    { icon: 'fa-fish', label: 'Món cá' },
    { icon: 'fa-bread-slice', label: 'Bánh mì' },
    { icon: 'fa-mug-hot', label: 'Cà phê' },
    { icon: 'fa-cake-candles', label: 'Bánh ngọt' },
    { icon: 'fa-pepper-hot', label: 'Món cay' },
    { icon: 'fa-utensils', label: 'Mặc định' }
];
let allCategories = [];
let allMenuItems = [];
let currentCategoryDishes = [];
let currentViewingCategory = null;
let currentSearchCategoryDishText = '';
let currentCategoryCardFilter = 'all';
let currentTopCategoryName = '';
const formatMoney = (amount) => {
    return (amount || 0).toLocaleString('vi-VN') + ' đ';
};
const getDishCategoryId = (dish) => {
    if (!dish)
        return '';
    const raw = dish.category_id;
    if (!raw)
        return '';
    if (typeof raw === 'object')
        return String(raw._id || raw.id || '');
    return String(raw);
};
export const initAdminCategories = () => {
    setupCategoryEventListeners();
    renderPresetIcons();
};
const renderPresetIcons = () => {
    const grid = document.getElementById('preset-icons-grid');
    if (!grid)
        return;
    grid.innerHTML = PRESET_ICONS.map(p => `
        <button type="button" class="btn-preset-icon p-2 rounded-xl bg-[#0f172a] hover:bg-orange-500/20 text-slate-300 hover:text-orange-400 border border-slate-700/80 hover:border-orange-500/50 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group" data-icon="${p.icon}" title="${p.label}">
            <i class="fa-solid ${p.icon} text-base group-hover:scale-110 transition-transform"></i>
            <span class="text-[9px] font-medium text-slate-400 group-hover:text-slate-200 truncate w-full text-center">${p.label}</span>
        </button>
    `).join('');
    grid.querySelectorAll('.btn-preset-icon').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const icon = e.currentTarget.getAttribute('data-icon') || 'fa-utensils';
            const input = document.getElementById('category-icon-input');
            if (input) {
                input.value = icon;
                updateIconPreview(icon);
            }
        });
    });
};
const updateIconPreview = (iconClass) => {
    const preview = document.getElementById('preview-category-icon');
    if (preview) {
        const clean = iconClass.trim().replace(/^fa-(solid|regular|brands)\s+/, '');
        preview.innerHTML = `<i class="fa-solid ${clean || 'fa-utensils'}"></i>`;
    }
};
const setupCategoryEventListeners = () => {
    document.getElementById('search-category')?.addEventListener('input', () => {
        renderCategoriesTable();
    });
    document.getElementById('filter-category-status')?.addEventListener('change', () => {
        const val = document.getElementById('filter-category-status')?.value;
        if (val === 'Active')
            currentCategoryCardFilter = 'active';
        else if (val === 'all')
            currentCategoryCardFilter = 'all';
        else
            currentCategoryCardFilter = 'all';
        updateCategoryCardStyles();
        renderCategoriesTable();
    });
    const catCards = [
        { id: 'card-cat-total', filter: 'all' },
        { id: 'card-cat-active', filter: 'active' },
        { id: 'card-cat-dishes', filter: 'has_dishes' },
        { id: 'card-cat-top', filter: 'top' },
    ];
    catCards.forEach(c => {
        document.getElementById(c.id)?.addEventListener('click', () => {
            if (currentCategoryCardFilter === c.filter && c.filter !== 'all') {
                currentCategoryCardFilter = 'all';
            }
            else {
                currentCategoryCardFilter = c.filter;
            }
            const statusSelect = document.getElementById('filter-category-status');
            if (statusSelect) {
                if (currentCategoryCardFilter === 'active')
                    statusSelect.value = 'Active';
                else if (currentCategoryCardFilter === 'all')
                    statusSelect.value = 'all';
            }
            updateCategoryCardStyles();
            renderCategoriesTable();
        });
    });
    document.getElementById('btn-refresh-categories')?.addEventListener('click', () => {
        currentCategoryCardFilter = 'all';
        updateCategoryCardStyles();
        loadCategoriesData();
        showSuccessToast('Đã làm mới danh mục & thực đơn!');
    });
    document.getElementById('btn-open-create-category')?.addEventListener('click', () => {
        openCategoryFormModal(null);
    });
    document.getElementById('category-icon-input')?.addEventListener('input', (e) => {
        const val = e.target.value;
        updateIconPreview(val);
    });
    document.getElementById('btn-close-category-modal')?.addEventListener('click', closeCategoryFormModal);
    document.getElementById('btn-cancel-category-form')?.addEventListener('click', closeCategoryFormModal);
    const form = document.getElementById('form-category');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleCategoryFormSubmit();
        });
    }
    document.getElementById('btn-close-dishes-modal')?.addEventListener('click', closeCategoryDishesModal);
    document.getElementById('btn-close-dishes-modal-footer')?.addEventListener('click', closeCategoryDishesModal);
    document.getElementById('search-dishes-in-category')?.addEventListener('input', (e) => {
        currentSearchCategoryDishText = (e.target.value || '').trim().toLowerCase();
        renderDishesInModal();
    });
    document.getElementById('btn-add-dish-to-this-cat')?.addEventListener('click', () => {
        if (!currentViewingCategory)
            return;
        const catId = currentViewingCategory.id;
        closeCategoryDishesModal();
        if (typeof window.switchPage === 'function') {
            window.switchPage('menu');
        }
        setTimeout(() => {
            if (typeof window.openAddMenuModal === 'function') {
                window.openAddMenuModal(catId);
            }
            else {
                const addMenuModal = document.getElementById('modal-menu-form');
                if (addMenuModal) {
                    addMenuModal.classList.remove('hidden');
                    addMenuModal.classList.add('flex');
                }
                const catSelect = document.getElementById('menu-category');
                if (catSelect && catId) {
                    catSelect.value = catId;
                }
            }
        }, 150);
    });
    const tableBody = document.getElementById('category-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target;
            const viewDishesBtn = target.closest('.btn-view-category-dishes');
            if (viewDishesBtn) {
                const catId = viewDishesBtn.getAttribute('data-id');
                if (catId) {
                    openCategoryDishesModal(catId);
                }
                return;
            }
            const editBtn = target.closest('.btn-edit-category');
            if (editBtn) {
                const catId = editBtn.getAttribute('data-id');
                if (catId) {
                    const cat = allCategories.find(c => String(c.id) === String(catId));
                    if (cat)
                        openCategoryFormModal(cat);
                }
                return;
            }
            const toggleBtn = target.closest('.btn-toggle-category-status');
            if (toggleBtn) {
                const catId = toggleBtn.getAttribute('data-id');
                const catName = toggleBtn.getAttribute('data-name') || 'Danh mục';
                const status = toggleBtn.getAttribute('data-status') || 'Active';
                if (catId) {
                    await handleToggleCategoryStatus(catId, catName, status);
                }
                return;
            }
            const deleteBtn = target.closest('.btn-delete-category');
            if (deleteBtn) {
                const catId = deleteBtn.getAttribute('data-id');
                const catName = deleteBtn.getAttribute('data-name') || 'Danh mục';
                const status = deleteBtn.getAttribute('data-status') || 'Active';
                if (catId) {
                    await handleToggleCategoryStatus(catId, catName, status);
                }
                return;
            }
        });
    }
};
export const loadCategoriesData = async () => {
    try {
        const [cats, items] = await Promise.all([
            layDanhSachDanhMuc(),
            layDanhSachMonAn()
        ]);
        allCategories = Array.isArray(cats) ? cats : [];
        allMenuItems = Array.isArray(items) ? items : [];
        updateCategoryStats();
        updateCategoryCardStyles();
        renderCategoriesTable();
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu danh mục:", error);
    }
};
const updateCategoryStats = () => {
    const totalEl = document.getElementById('stat-total-categories');
    const activeEl = document.getElementById('stat-active-categories');
    const dishesEl = document.getElementById('stat-total-categorized-dishes');
    const topNameEl = document.getElementById('stat-top-category-name');
    const topCountEl = document.getElementById('stat-top-category-count');
    const totalCats = allCategories.length;
    const activeCats = allCategories.filter(c => (c.status || 'Active') !== 'Inactive').length;
    let totalCategorized = 0;
    let topCatName = '--';
    let topCatCount = 0;
    allCategories.forEach(cat => {
        const cId = String(cat.id);
        const count = allMenuItems.filter(m => getDishCategoryId(m) === cId).length;
        totalCategorized += count;
        if (count > topCatCount) {
            topCatCount = count;
            topCatName = cat.name;
        }
    });
    currentTopCategoryName = topCatName;
    if (totalEl)
        totalEl.innerText = totalCats.toString();
    if (activeEl)
        activeEl.innerText = activeCats.toString();
    if (dishesEl)
        dishesEl.innerText = totalCategorized.toString();
    if (topNameEl)
        topNameEl.innerText = topCatName;
    if (topCountEl)
        topCountEl.innerText = `${topCatCount} món ăn`;
};
export const updateCategoryCardStyles = () => {
    const cardConfigs = [
        { id: 'card-cat-total', filter: 'all', activeBorder: 'border-orange-500/80 ring-2 ring-orange-500/20' },
        { id: 'card-cat-active', filter: 'active', activeBorder: 'border-emerald-500/80 ring-2 ring-emerald-500/20' },
        { id: 'card-cat-dishes', filter: 'has_dishes', activeBorder: 'border-amber-500/80 ring-2 ring-amber-500/20' },
        { id: 'card-cat-top', filter: 'top', activeBorder: 'border-orange-500/80 ring-2 ring-orange-500/20' }
    ];
    cardConfigs.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        if (!el)
            return;
        const isSelected = currentCategoryCardFilter === cfg.filter;
        const indicator = el.querySelector('.cat-card-indicator');
        if (isSelected) {
            el.className = `cat-stat-card cursor-pointer rounded-2xl p-5 border ${cfg.activeBorder} bg-slate-800/90 shadow-lg transition-all duration-200 scale-[1.02] select-none group flex flex-col justify-between`;
            if (indicator) {
                indicator.className = 'cat-card-indicator text-[10px] font-bold text-orange-400 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-check text-[9px]"></i> Đang lọc';
            }
        }
        else {
            el.className = 'cat-stat-card cursor-pointer bg-[#1e293b] rounded-2xl p-5 border border-slate-700/50 shadow-md transition-all duration-200 hover:scale-[1.02] hover:border-slate-500/60 active:scale-95 select-none group flex flex-col justify-between';
            if (indicator) {
                indicator.className = 'cat-card-indicator text-[10px] font-bold text-slate-500 group-hover:text-slate-300 flex items-center gap-1';
                indicator.innerHTML = '<i class="fa-solid fa-filter text-[9px]"></i> Lọc';
            }
        }
    });
};
const renderCategoriesTable = () => {
    const tbody = document.getElementById('category-table-body');
    if (!tbody)
        return;
    const searchInput = document.getElementById('search-category')?.value.trim().toLowerCase() || '';
    const statusFilter = document.getElementById('filter-category-status')?.value || 'all';
    let filtered = allCategories.filter(cat => {
        const catId = String(cat.id);
        const matchName = !searchInput || cat.name.toLowerCase().includes(searchInput) || (cat.description || '').toLowerCase().includes(searchInput);
        const catStatus = cat.status || 'Active';
        const matchStatus = statusFilter === 'all' || catStatus === statusFilter;
        let matchCard = true;
        if (currentCategoryCardFilter === 'active') {
            matchCard = catStatus !== 'Inactive';
        }
        else if (currentCategoryCardFilter === 'has_dishes') {
            const count = allMenuItems.filter(m => getDishCategoryId(m) === catId).length;
            matchCard = count > 0;
        }
        else if (currentCategoryCardFilter === 'top') {
            matchCard = !!currentTopCategoryName && cat.name === currentTopCategoryName;
        }
        return matchName && matchStatus && matchCard;
    });
    if (currentCategoryCardFilter === 'has_dishes') {
        filtered.sort((a, b) => {
            const countA = allMenuItems.filter(m => getDishCategoryId(m) === String(a.id)).length;
            const countB = allMenuItems.filter(m => getDishCategoryId(m) === String(b.id)).length;
            return countB - countA;
        });
    }
    else {
        filtered.sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
    }
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center text-slate-500 font-medium">
                    <i class="fa-solid fa-shapes text-3xl mb-3 block opacity-30"></i>
                    Không tìm thấy danh mục nào phù hợp
                </td>
            </tr>
        `;
        return;
    }
    tbody.innerHTML = filtered.map(cat => {
        const catId = String(cat.id);
        const dishes = allMenuItems.filter(m => getDishCategoryId(m) === catId);
        const dishCount = dishes.length;
        const isActive = (cat.status || 'Active') !== 'Inactive';
        const iconClass = cat.icon || 'fa-utensils';
        return `
            <tr class="hover:bg-slate-800/40 transition-colors border-b border-slate-800/60">
                <!-- Danh mục & Icon -->
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center text-base shrink-0 shadow-sm">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div>
                            <div class="font-black text-white text-sm whitespace-nowrap">${cat.name}</div>
                            <div class="text-[11px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">${iconClass}</div>
                        </div>
                    </div>
                </td>

                <!-- Mô tả -->
                <td class="px-6 py-4 text-slate-300 text-xs max-w-xs truncate font-medium whitespace-nowrap">
                    ${cat.description || '<span class="text-slate-500 italic">Không có mô tả</span>'}
                </td>

                <!-- Thứ tự -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <span class="inline-block px-2.5 py-1 rounded-lg bg-[#0f172a] text-slate-300 font-mono font-bold text-xs border border-slate-700/60">
                        ${cat.displayOrder || 0}
                    </span>
                </td>

                <!-- Số lượng món -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-sm ${dishCount > 0
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-slate-800 text-slate-400 border border-slate-700'}">
                        <i class="fa-solid fa-bowl-food text-[10px]"></i>
                        <span>${dishCount} món</span>
                    </span>
                </td>

                <!-- Trạng thái (Bấm trực tiếp để Ẩn / Hiện) -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <button type="button" 
                        class="btn-toggle-category-status inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xs ${isActive
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'}" data-id="${cat.id}" data-name="${cat.name}" data-status="${cat.status || (isActive ? 'Active' : 'Inactive')}" title="Nhấn để ${isActive ? 'ẩn' : 'hiển thị lại'} danh mục">
                        <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
                        ${isActive ? 'Đang hiển thị' : 'Tạm ẩn'}
                    </button>
                </td>

                <!-- Thao tác: Xem món, sửa, ẩn/hiện (Không xóa dữ liệu, bảo toàn lịch sử F&B) -->
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <!-- NÚT XEM MÓN TRONG DANH MỤC (ICON ONLY) -->
                        <button type="button" 
                            class="btn-view-category-dishes w-8 h-8 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95" 
                            data-id="${cat.id}" 
                            data-name="${cat.name}"
                            title="Xem ${dishCount} món trong danh mục ${cat.name}">
                            <i class="fa-solid fa-layer-group text-xs"></i>
                        </button>

                        <!-- NÚT CHỈNH SỬA (ICON ONLY) -->
                        <button type="button" 
                            class="btn-edit-category w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" 
                            data-id="${cat.id}"
                            title="Chỉnh sửa danh mục ${cat.name}">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>

                        <!-- NÚT ẨN / HIỆN DANH MỤC (THAY THẾ NÚT XÓA: CHỈ ẨN ĐI, KHÔNG XÓA DỮ LIỆU) -->
                        ${isActive ? `
                        <button type="button" 
                            class="btn-toggle-category-status w-8 h-8 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" 
                            data-id="${cat.id}"
                            data-name="${cat.name}"
                            data-status="Active"
                            title="Ẩn danh mục ${cat.name} (Tạm ẩn khỏi menu khách)">
                            <i class="fa-solid fa-eye-slash text-xs"></i>
                        </button>
                        ` : `
                        <button type="button" 
                            class="btn-toggle-category-status w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm" 
                            data-id="${cat.id}"
                            data-name="${cat.name}"
                            data-status="Inactive"
                            title="Hiển thị lại danh mục ${cat.name}">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};
const openCategoryDishesModal = (categoryId) => {
    const cat = allCategories.find(c => String(c.id) === String(categoryId));
    if (!cat)
        return;
    currentViewingCategory = cat;
    currentSearchCategoryDishText = '';
    currentCategoryDishes = allMenuItems.filter(m => getDishCategoryId(m) === String(categoryId));
    const iconBox = document.getElementById('mcd-icon-box');
    const titleEl = document.getElementById('mcd-title');
    const countBadge = document.getElementById('mcd-count-badge');
    const descEl = document.getElementById('mcd-desc');
    const searchInput = document.getElementById('search-dishes-in-category');
    if (iconBox)
        iconBox.innerHTML = `<i class="fa-solid ${cat.icon || 'fa-utensils'}"></i>`;
    if (titleEl)
        titleEl.innerText = `Danh mục: ${cat.name}`;
    if (countBadge)
        countBadge.innerText = `${currentCategoryDishes.length} món ăn`;
    if (descEl)
        descEl.innerText = cat.description ? `Mô tả: ${cat.description}` : 'Danh sách toàn bộ các món ăn thuộc nhóm này';
    if (searchInput)
        searchInput.value = '';
    renderDishesInModal();
    const modal = document.getElementById('modal-category-dishes');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};
const renderDishesInModal = () => {
    const container = document.getElementById('mcd-dishes-container');
    const summaryFooter = document.getElementById('mcd-summary-footer');
    if (!container)
        return;
    let dishes = currentCategoryDishes;
    if (currentSearchCategoryDishText) {
        dishes = dishes.filter(d => d.name.toLowerCase().includes(currentSearchCategoryDishText));
    }
    if (summaryFooter) {
        summaryFooter.innerText = `Hiển thị ${dishes.length} / ${currentCategoryDishes.length} món ăn`;
    }
    if (dishes.length === 0) {
        if (currentCategoryDishes.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 px-4">
                    <div class="w-16 h-16 rounded-3xl bg-slate-800 text-slate-500 flex items-center justify-center text-3xl mx-auto mb-4 border border-slate-700">
                        <i class="fa-solid fa-utensils"></i>
                    </div>
                    <h4 class="text-base font-bold text-white mb-1">Chưa có món ăn nào trong danh mục này</h4>
                    <p class="text-xs text-slate-400 mb-5 max-w-sm mx-auto">Danh mục này hiện chưa có món ăn nào được phân loại. Bạn có thể thêm món ăn mới ngay bây giờ!</p>
                </div>
            `;
        }
        else {
            container.innerHTML = `
                <div class="text-center py-10 text-slate-500 text-xs font-bold">
                    <i class="fa-solid fa-magnifying-glass text-xl mb-2 block opacity-40"></i>
                    Không tìm thấy món ăn nào khớp với từ khóa tìm kiếm
                </div>
            `;
        }
        return;
    }
    container.innerHTML = dishes.map((dish, index) => {
        const isAvailable = dish.status === 'Available' || dish.status === 'Active' || dish.status === 'active';
        const fallbackImg = "https://placehold.co/150x150/orange/white?text=Food";
        const imgSrc = dish.image || fallbackImg;
        return `
            <div class="flex items-center justify-between p-3.5 rounded-2xl bg-[#0f172a] border border-slate-800 hover:border-slate-700 transition-all group">
                <div class="flex items-center gap-3.5 min-w-0">
                    <span class="text-xs font-mono font-bold text-slate-500 w-5 text-center shrink-0">#${index + 1}</span>
                    <img src="${imgSrc}" loading="lazy" decoding="async" class="w-12 h-12 rounded-xl object-cover border border-slate-700/80 shrink-0 bg-slate-800" onerror="this.src='${fallbackImg}'">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-white text-sm truncate">${dish.name}</h4>
                            ${dish.is_combo ? '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 shrink-0">COMBO</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2.5 mt-1 text-xs">
                            <span class="font-black text-orange-400">${formatMoney(dish.base_price)}</span>
                            <span class="text-slate-600">•</span>
                            <span class="text-[11px] font-medium ${isAvailable ? 'text-emerald-400' : 'text-slate-500'}">
                                <i class="fa-solid ${isAvailable ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-slate-500'} text-[10px]"></i>
                                ${isAvailable ? 'Đang bán' : 'Tạm ngưng'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0 ml-3 whitespace-nowrap">
                    <button type="button" 
                        class="btn-go-to-menu-dish w-8 h-8 rounded-xl bg-slate-800 hover:bg-orange-500 hover:text-white text-slate-300 border border-slate-700 transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                        data-id="${dish.id}"
                        title="Quản lý món này trong Thực đơn">
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    container.querySelectorAll('.btn-go-to-menu-dish').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dishId = e.currentTarget.getAttribute('data-id');
            closeCategoryDishesModal();
            if (typeof window.switchPage === 'function') {
                window.switchPage('menu');
            }
            if (dishId) {
                setTimeout(() => {
                    const searchMenu = document.getElementById('search-menu');
                    const dish = allMenuItems.find(d => String(d.id) === String(dishId));
                    if (searchMenu && dish) {
                        searchMenu.value = dish.name;
                        searchMenu.dispatchEvent(new Event('input'));
                    }
                }, 200);
            }
        });
    });
};
const closeCategoryDishesModal = () => {
    const modal = document.getElementById('modal-category-dishes');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentViewingCategory = null;
};
const openCategoryFormModal = (category) => {
    const modal = document.getElementById('modal-category-form');
    const titleEl = document.getElementById('modal-category-title');
    const idInput = document.getElementById('category-id-input');
    const nameInput = document.getElementById('category-name-input');
    const descInput = document.getElementById('category-desc-input');
    const iconInput = document.getElementById('category-icon-input');
    const orderInput = document.getElementById('category-order-input');
    const statusInput = document.getElementById('category-status-input');
    if (!modal)
        return;
    if (category) {
        if (titleEl)
            titleEl.innerText = `Chỉnh sửa: ${category.name}`;
        if (idInput)
            idInput.value = category.id || '';
        if (nameInput)
            nameInput.value = category.name || '';
        if (descInput)
            descInput.value = category.description || '';
        const iconVal = category.icon || 'fa-utensils';
        if (iconInput)
            iconInput.value = iconVal;
        updateIconPreview(iconVal);
        if (orderInput)
            orderInput.value = (category.displayOrder || 0).toString();
        if (statusInput)
            statusInput.value = category.status || 'Active';
    }
    else {
        if (titleEl)
            titleEl.innerText = 'Thêm danh mục mới';
        if (idInput)
            idInput.value = '';
        if (nameInput)
            nameInput.value = '';
        if (descInput)
            descInput.value = '';
        if (iconInput)
            iconInput.value = 'fa-bowl-food';
        updateIconPreview('fa-bowl-food');
        if (orderInput)
            orderInput.value = (allCategories.length + 1).toString();
        if (statusInput)
            statusInput.value = 'Active';
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => nameInput?.focus(), 100);
};
const closeCategoryFormModal = () => {
    const modal = document.getElementById('modal-category-form');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};
const handleCategoryFormSubmit = async () => {
    const idInput = document.getElementById('category-id-input');
    const nameInput = document.getElementById('category-name-input');
    const descInput = document.getElementById('category-desc-input');
    const iconInput = document.getElementById('category-icon-input');
    const orderInput = document.getElementById('category-order-input');
    const statusInput = document.getElementById('category-status-input');
    const name = nameInput.value.trim();
    if (!name) {
        showWarningToast('Tên danh mục không được để trống!');
        nameInput.focus();
        return;
    }
    const payload = {
        name,
        description: descInput.value.trim(),
        icon: iconInput.value.trim() || 'fa-utensils',
        displayOrder: parseInt(orderInput.value, 10) || 0,
        status: statusInput.value || 'Active'
    };
    const isEdit = Boolean(idInput.value);
    try {
        if (isEdit) {
            await suaDanhMuc(idInput.value, payload);
            showSuccessToast(`Đã cập nhật danh mục "${name}" thành công!`);
        }
        else {
            await taoDanhMuc(payload);
            showSuccessToast(`Đã tạo mới danh mục "${name}" thành công!`);
        }
        closeCategoryFormModal();
        await loadCategoriesData();
        const catSelect = document.getElementById('filter-menu-category');
        if (catSelect) {
            catSelect.innerHTML = `<option value="all">Tất cả danh mục</option>` + allCategories.map(c => `
                <option value="${c.id}">${c.name}</option>
            `).join('');
        }
    }
    catch (error) {
        console.error("Lỗi khi lưu danh mục:", error);
        showWarningToast(error.message || 'Lỗi khi lưu danh mục!');
    }
};
const handleToggleCategoryStatus = async (catId, catName, currentStatus) => {
    const isCurrentlyActive = currentStatus !== 'Inactive' && currentStatus !== 'Archived';
    const newStatus = isCurrentlyActive ? 'Inactive' : 'Active';
    const confirmed = await showConfirmModal(isCurrentlyActive ? 'Xác nhận ẩn danh mục' : 'Xác nhận hiển thị lại danh mục', isCurrentlyActive
        ? `Bạn có chắc chắn muốn ẩn danh mục "${catName}" không?\n\nDanh mục và các món thuộc nhóm này sẽ tạm thời không xuất hiện trên thực đơn khách gọi món, nhưng dữ liệu lịch sử và món ăn vẫn được bảo toàn nguyên vẹn.`
        : `Bạn có chắc muốn kích hoạt hiển thị lại danh mục "${catName}" trên thực đơn nhà hàng không?`, {
        okText: isCurrentlyActive ? 'Ẩn danh mục' : 'Hiển thị lại',
        cancelText: 'Hủy bỏ',
        type: isCurrentlyActive ? 'warning' : 'info'
    });
    if (!confirmed)
        return;
    try {
        await suaDanhMuc(catId, { status: newStatus });
        showSuccessToast(`Đã ${isCurrentlyActive ? 'ẩn' : 'kích hoạt hiển thị lại'} danh mục "${catName}" thành công!`);
        await loadCategoriesData();
        const catSelect = document.getElementById('filter-menu-category');
        if (catSelect) {
            catSelect.innerHTML = `<option value="all">Tất cả danh mục</option>` + allCategories.map(c => `
                <option value="${c.id}">${c.name}</option>
            `).join('');
        }
    }
    catch (error) {
        console.error("Lỗi khi đổi trạng thái danh mục:", error);
        showWarningToast(error.message || 'Lỗi khi đổi trạng thái danh mục!');
    }
};
const handleDeleteCategory = async (catId, catName, dishCount) => {
    await handleToggleCategoryStatus(catId, catName, 'Active');
};
