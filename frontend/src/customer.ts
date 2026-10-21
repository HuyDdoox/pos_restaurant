import { 
    layDanhSachMonAn, layDanhSachDanhMuc, taoDonHang, taoChiTietDonHang, 
    layDonHangDangMoCuaBan, capNhatTrangThaiBan, capNhatTongTienDonHang, layDanhSachBan, 
    layDanhSachVariants, layChiTietCuaDon, capNhatSoLuongMon, layDanhSachChiNhanh,
    layDanhSachIngredients, layDanhSachRecipes, taoFeedback, capNhatDonHang
} from './api';
import { MenuItem, CartItem, Category, Table, Variant } from './interfaces';
import { showSuccessToast, showConfirmModal, showWarningToast } from './utils/ui';

let mangMonAn: MenuItem[] = [];
let mangDanhMuc: Category[] = [];
let mangIngredients: any[] = [];
let mangRecipes: any[] = [];

let currentCategoryFilter: string = 'all';
let currentTagFilter: string = 'all';
let currentSearchKeyword: string = '';

// Helper chuẩn hóa tiếng Việt không dấu cho tìm kiếm thông minh
const removeVietnameseTones = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
};

// Khởi tạo kênh giao tiếp thời gian thực
const kdsChannel = new BroadcastChannel('foodhub_kds');

// --- RENDER DANH MỤC ---
const hienThiDanhMuc = async () => {
    mangDanhMuc = await layDanhSachDanhMuc();
    const container = document.getElementById('category-list') as HTMLDivElement;
    if (!container) return;

    let html = `<button data-id="all" class="btn-filter shrink-0 px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold shadow-md transition-colors">Tất cả</button>`;
    
    // Chỉ hiển thị các danh mục đang hoạt động (không hiển thị danh mục bị ẩn)
    const activeCategories = mangDanhMuc.filter(dm => dm.status !== 'Inactive' && dm.status !== 'Archived' && dm.status !== 'Hidden');
    activeCategories.forEach(dm => {
        html += `<button data-id="${dm.id}" class="btn-filter shrink-0 px-6 py-2.5 rounded-xl bg-white text-slate-600 font-bold border border-slate-200 hover:border-orange-500 hover:text-orange-500 transition-colors">${dm.name}</button>`;
    });

    container.innerHTML = html;
    ganSuKienLocDanhMuc();
};

const ganSuKienLocDanhMuc = () => {
    const btns = document.querySelectorAll('.btn-filter');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            btns.forEach(b => {
                b.classList.remove('bg-orange-500', 'text-white', 'shadow-md');
                b.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
            });
            const target = e.currentTarget as HTMLButtonElement;
            target.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
            target.classList.add('bg-orange-500', 'text-white', 'shadow-md');

            currentCategoryFilter = target.getAttribute('data-id') || 'all';
            renderDanhSachMonAn(currentCategoryFilter);
        });
    });
};

// --- RENDER MÓN ĂN ---
const renderDanhSachMonAn = (idDanhMuc: string = currentCategoryFilter) => {
    currentCategoryFilter = idDanhMuc;
    const container = document.getElementById('menu-list') as HTMLDivElement;
    if (!container) return;

    let danhSachLoc = mangMonAn.filter(mon => {
        if (mon.status === 'Archived' || mon.status === 'Inactive' || mon.status === 'Hidden') return false;
        const parentCat = mangDanhMuc.find(c => String(c.id || (c as any)._id) === String(mon.category_id));
        if (parentCat && (parentCat.status === 'Inactive' || parentCat.status === 'Archived' || parentCat.status === 'Hidden')) return false;
        return true;
    });
    
    // 1. Lọc theo danh mục
    if (currentCategoryFilter !== 'all') {
        danhSachLoc = danhSachLoc.filter(mon => String(mon.category_id) === String(currentCategoryFilter));
    }

    // 2. Lọc theo Tag nhanh (Bestseller, Cay, Chay, Must Try)
    if (currentTagFilter !== 'all') {
        danhSachLoc = danhSachLoc.filter(mon => {
            if (!mon.tags || !Array.isArray(mon.tags)) return false;
            const normalizedTags = mon.tags.map(t => removeVietnameseTones(t).toUpperCase());
            if (currentTagFilter === 'bestseller') {
                return normalizedTags.some(t => t.includes('BESTSELLER') || t.includes('BEST SELLER'));
            } else if (currentTagFilter === 'cay') {
                return normalizedTags.some(t => t.includes('CAY') || t.includes('SPICY'));
            } else if (currentTagFilter === 'chay') {
                return normalizedTags.some(t => t.includes('CHAY') || t.includes('VEGAN') || t.includes('VEGETARIAN'));
            } else if (currentTagFilter === 'musttry') {
                return normalizedTags.some(t => t.includes('MUST TRY') || t.includes('MUST-TRY'));
            }
            return true;
        });
    }

    // 3. Lọc theo thanh tìm kiếm (Tìm không dấu thông minh)
    if (currentSearchKeyword) {
        const cleanKw = removeVietnameseTones(currentSearchKeyword);
        danhSachLoc = danhSachLoc.filter(mon => {
            const nameClean = removeVietnameseTones(mon.name || '');
            const descClean = removeVietnameseTones(mon.description || '');
            return nameClean.includes(cleanKw) || descClean.includes(cleanKw);
        });
    }

    if (danhSachLoc.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-slate-500 font-bold py-12 bg-white rounded-2xl border border-slate-100 shadow-xs">
                <i class="fa-solid fa-magnifying-glass text-3xl text-slate-300 mb-2 block"></i>
                Không tìm thấy món ăn nào phù hợp.
            </div>
        `;
        return;
    }

    const cart: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    let html = '';
    danhSachLoc.forEach((mon: MenuItem) => {
        let availableQuantity = Infinity;
        const monRecipes = mangRecipes.filter(r => r.menuItem_id === mon.id);
        
        if (monRecipes.length > 0) {
            for (let r of monRecipes) {
                const ing = mangIngredients.find(i => i.id === r.ingredient_id);
                if (ing) {
                    const dishesUsingIng = mangRecipes.filter(rec => rec.ingredient_id === ing.id).length;
                    const allocatedStock = ing.stock_quantity / (dishesUsingIng > 0 ? dishesUsingIng : 1);
                    const qty = Math.floor(allocatedStock / r.quantity_required);
                    if (qty < availableQuantity) availableQuantity = qty;
                }
            }
        } else {
            availableQuantity = 999; 
        }

        const isOutOfStock = (mon.status === 'Out_of_stock' || mon.inStock === false || availableQuantity <= 0);
        
        let badgeHtml = '';
        if (isOutOfStock) {
            badgeHtml = `<span class="absolute top-3 right-3 bg-red-100 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm">HẾT HÀNG</span>`;
        } else if (availableQuantity < 999) {
            badgeHtml = `<span class="absolute top-3 right-3 bg-emerald-100 text-emerald-600 text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm">CÒN ${availableQuantity} PHẦN</span>`;
        } else {
            badgeHtml = `<span class="absolute top-3 right-3 bg-emerald-100 text-emerald-600 text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm">CÒN HÀNG</span>`;
        }
        
        // Kiểm tra xem món này đã có trong giỏ hàng (không biến thể) hay chưa để hiển thị bộ đếm nhanh
        const inCartItem = cart.find(i => i.id === mon.id && !i.variant_name);

        let btnHtml = '';
        if (isOutOfStock) {
            btnHtml = `<button disabled class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold cursor-not-allowed"><i class="fa-solid fa-ban text-lg"></i></button>`;
        } else if (inCartItem && inCartItem.so_luong > 0) {
            btnHtml = `
                <div class="flex items-center bg-orange-50 border border-orange-200 rounded-xl p-0.5 gap-1 shadow-xs">
                    <button data-id="${mon.id}" class="btn-card-minus w-7 h-7 flex items-center justify-center rounded-lg bg-white text-orange-600 font-black hover:bg-orange-500 hover:text-white transition-colors shadow-xs active:scale-95" title="Giảm số lượng">-</button>
                    <span class="w-5 text-center text-xs font-black text-orange-600">${inCartItem.so_luong}</span>
                    <button data-id="${mon.id}" class="btn-card-plus w-7 h-7 flex items-center justify-center rounded-lg bg-white text-orange-600 font-black hover:bg-orange-500 hover:text-white transition-colors shadow-xs active:scale-95" title="Thêm số lượng">+</button>
                </div>
            `;
        } else {
            btnHtml = `<button data-id="${mon.id}" class="btn-add-cart w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold hover:bg-orange-500 hover:text-white transition-colors shadow-sm active:scale-95" title="Chọn món"><i class="fa-solid fa-plus text-xl"></i></button>`;
        }

        let tagsHtml = '';
        const comboBadge = mon.is_combo 
            ? `<span class="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)] text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border"><i class="fa-solid fa-fire text-[9px] mr-1"></i>COMBO TIẾT KIỆM</span>` 
            : '';
        const servingBadge = (mon.is_combo && mon.serving_size)
            ? `<span class="bg-indigo-600/90 text-white backdrop-blur-sm text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-indigo-400"><i class="fa-solid fa-user-group text-[8px] mr-1"></i>${mon.serving_size}</span>`
            : '';

        if ((mon.tags && Array.isArray(mon.tags) && mon.tags.length > 0) || comboBadge || servingBadge) {
            const rawTags = (mon.tags && Array.isArray(mon.tags)) ? mon.tags : [];
            tagsHtml = `<div class="flex flex-wrap gap-1 absolute top-3 left-3 z-10 pointer-events-none">` + 
                comboBadge +
                servingBadge +
                rawTags.map((t: string) => {
                    let bg = 'bg-white/90 text-slate-700 border-white/50';
                    const tagUpper = t.toUpperCase();
                    if (tagUpper.includes('BESTSELLER') || tagUpper.includes('BEST SELLER')) {
                        bg = 'bg-amber-400 text-amber-950 border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
                    } else if (tagUpper.includes('MUST TRY')) {
                        bg = 'bg-rose-500 text-white border-rose-600 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
                    } else if (tagUpper.includes('CAY') || tagUpper.includes('SPICY')) {
                        bg = 'bg-red-600 text-white border-red-700 shadow-[0_0_10px_rgba(220,38,38,0.5)]';
                        t = '<i class="fa-solid fa-pepper-hot mr-1"></i>' + t;
                    } else if (tagUpper.includes('CHAY') || tagUpper.includes('VEGAN')) {
                        bg = 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
                        t = '<i class="fa-solid fa-leaf mr-1"></i>' + t;
                    }
                    return `<span class="${bg} backdrop-blur-sm text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border">${t}</span>`;
                }).join('') + 
                `</div>`;
        }

        const comboItemsPreview = (mon.is_combo && mon.combo_items && mon.combo_items.length > 0)
            ? `<div class="mb-2 p-1.5 rounded-lg bg-orange-50/80 border border-orange-200/70 text-[11px] text-orange-950 font-medium">
                 <div class="font-bold text-orange-700 flex items-center gap-1 mb-0.5 text-[10px] uppercase tracking-wider">
                     <i class="fa-solid fa-utensils text-[9px]"></i> Gồm ${mon.combo_items.length} món:
                 </div>
                 <div class="line-clamp-2 text-slate-600 text-[10.5px]">
                     ${mon.combo_items.map((ci: any) => `${ci.quantity || 1}x ${ci.name}${ci.variant_name ? ` (${ci.variant_name})` : ''}`).join(', ')}
                 </div>
               </div>`
            : '';

        html += `
            <div class="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex flex-col hover:shadow-md transition-shadow group">
                ${badgeHtml}
                ${tagsHtml}
                <div class="h-40 overflow-hidden rounded-xl mb-3 bg-slate-100 relative cursor-pointer btn-open-detail" data-id="${mon.id}">
                    <img src="${mon.image}" alt="${mon.name}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : ''}">
                </div>
                <div class="flex flex-col flex-1">
                    <h3 class="text-base font-bold text-slate-800 leading-tight mb-1 line-clamp-2 cursor-pointer btn-open-detail" data-id="${mon.id}">${mon.name}</h3>
                    <p class="text-slate-400 text-xs line-clamp-2 mb-2 flex-1">${mon.description || 'Chưa có mô tả'}</p>
                    ${comboItemsPreview}
                    <div class="flex items-center justify-between mt-auto">
                        <span class="text-lg font-black text-orange-600">${mon.base_price.toLocaleString('vi-VN')} ₫</span>
                        ${btnHtml}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    ganSuKienThemVaoGio();
};

const playFlyToCartAnimation = (startX: number, startY: number, imgUrl: string) => {
    const cartBtn = document.getElementById('btn-view-cart');
    if (!cartBtn) return;
    
    const rect = cartBtn.getBoundingClientRect();
    const endX = rect.left + rect.width / 2 - 40; // 40 is half of flying img size
    const endY = rect.top + rect.height / 2 - 40;

    const img = document.createElement('img');
    img.src = imgUrl;
    img.className = 'flying-img';
    img.style.setProperty('--startX', `${startX}px`);
    img.style.setProperty('--startY', `${startY}px`);
    img.style.setProperty('--endX', `${endX}px`);
    img.style.setProperty('--endY', `${endY}px`);

    document.body.appendChild(img);
    
    setTimeout(() => {
        if (document.body.contains(img)) {
            document.body.removeChild(img);
        }
    }, 600);
};

const ganSuKienThemVaoGio = () => {
    const attachHandler = (selector: string) => {
        const els = document.querySelectorAll(selector);
        els.forEach(el => {
            el.addEventListener('click', async (e) => {
                if (!localStorage.getItem('restaurant_table')) {
                    await showConfirmModal("Chú ý", "Vui lòng chọn bàn trước khi xem và đặt món!");
                    const modal = document.getElementById('modal-table');
                    if (modal) {
                        modal.classList.remove('hidden');
                        modal.classList.add('flex');
                    }
                    return;
                }

                const idMon = (e.currentTarget as HTMLElement).getAttribute('data-id');
                const monDuocChon = mangMonAn.find(m => m.id === idMon);
                if (monDuocChon) {
                    const variants = await layDanhSachVariants(monDuocChon.id);
                    
                    if (!variants || variants.length === 0) {
                        themVaoGioHang(monDuocChon);
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        playFlyToCartAnimation(rect.left, rect.top, monDuocChon.image);
                    } else {
                        hienThiModalFoodDetail(monDuocChon, variants || []);
                    }
                }
            });
        });
    };

    attachHandler('.btn-add-cart');
    attachHandler('.btn-open-detail');

    // Quick Stepper trên thẻ món: Nút Giảm
    document.querySelectorAll('.btn-card-minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idMon = (e.currentTarget as HTMLElement).getAttribute('data-id');
            let cart: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
            const index = cart.findIndex(i => i.id === idMon && !i.variant_name);
            if (index >= 0) {
                cart[index].so_luong -= 1;
                if (cart[index].so_luong <= 0) {
                    cart.splice(index, 1);
                }
                updateCartData(cart);
            }
        });
    });

    // Quick Stepper trên thẻ món: Nút Tăng
    document.querySelectorAll('.btn-card-plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idMon = (e.currentTarget as HTMLElement).getAttribute('data-id');
            let cart: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
            const item = cart.find(i => i.id === idMon && !i.variant_name);
            if (item) {
                item.so_luong += 1;
                updateCartData(cart);
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const monDuocChon = mangMonAn.find(m => m.id === idMon);
                if (monDuocChon) {
                    playFlyToCartAnimation(rect.left, rect.top, monDuocChon.image);
                }
            }
        });
    });
};

const hienThiModalFoodDetail = (mon: MenuItem, variants: Variant[]) => {
    const modal = document.getElementById('modal-food-detail');
    const content = document.getElementById('food-detail-content');
    const img = document.getElementById('food-detail-img') as HTMLImageElement;
    const title = document.getElementById('food-detail-name');
    const desc = document.getElementById('food-detail-desc');
    const tagsContainer = document.getElementById('food-detail-tags');
    const priceDisplay = document.getElementById('food-detail-price');
    const variantSection = document.getElementById('variant-section');
    const variantList = document.getElementById('variant-list');
    const btnClose = document.getElementById('btn-close-food-detail');
    const btnAdd = document.getElementById('btn-add-food-detail');
    
    if (!modal || !content || !img || !title || !desc || !tagsContainer || !priceDisplay || !variantSection || !variantList || !btnClose || !btnAdd) return;
    
    img.src = mon.image;
    title.innerText = mon.name;
    desc.innerText = mon.description || '';
    
    if (mon.tags && Array.isArray(mon.tags) && mon.tags.length > 0) {
        tagsContainer.innerHTML = mon.tags.map((t: string) => `<span class="bg-orange-100 text-orange-600 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">${t}</span>`).join('');
    } else {
        tagsContainer.innerHTML = '';
    }

    if (variants.length > 0) {
        variantSection.classList.remove('hidden');
        
        // Nhóm biến thể theo group_name
        const groups: { [key: string]: Variant[] } = {};
        variants.forEach(v => {
            const g = v.group_name || 'Tùy chọn';
            if (!groups[g]) groups[g] = [];
            groups[g].push(v);
        });

        let html = '';
        Object.entries(groups).forEach(([groupName, groupVariants]) => {
            const isMultiple = groupVariants[0]?.allowMultiple || false;
            
            if (Object.keys(groups).length > 1 || isMultiple) {
                const typeText = isMultiple ? "(Chọn nhiều)" : "(Chọn 1)";
                html += `<p class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 mt-3">${groupName} <span class="normal-case font-normal">${typeText}</span></p>`;
            }
            
            let firstRadio = true;
            html += `<div class="space-y-2 mb-3">`;
            groupVariants.forEach(v => {
                const priceHtml = v.extra_price > 0
                    ? `<span class="text-orange-600 font-black text-xs bg-orange-100/60 px-2.5 py-1 rounded-lg shrink-0">+${v.extra_price.toLocaleString('vi-VN')} ₫</span>`
                    : '';
                    
                const inputType = isMultiple ? "checkbox" : "radio";
                const inputName = isMultiple ? `variant-${groupName}[]` : `variant-${groupName}`;
                // Mặc định chọn option đầu tiên cho nhóm radio (nhất là Size) để không bao giờ bị trống
                const checkedState = (!isMultiple && firstRadio) ? 'checked' : '';
                
                html += `
                    <label class="group relative flex items-center justify-between gap-3 p-3.5 rounded-2xl border-2 border-slate-200/90 bg-white hover:border-orange-300 hover:bg-orange-50/20 cursor-pointer transition-all duration-200 active:scale-[0.98] select-none shadow-sm has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60 has-[:checked]:shadow-md has-[:checked]:shadow-orange-500/10 has-[:checked]:ring-1 has-[:checked]:ring-orange-500/30">
                        <input type="${inputType}" name="${inputName}" value="${v.id}" data-group="${groupName}" ${checkedState} class="variant-choice sr-only">
                        <div class="flex items-center gap-3 min-w-0">
                            ${isMultiple ? `
                                <div class="w-5 h-5 rounded-lg border-2 border-slate-300 bg-slate-50 flex items-center justify-center shrink-0 transition-all duration-200 group-hover:border-orange-400 group-has-[:checked]:border-orange-500 group-has-[:checked]:bg-orange-500 group-has-[:checked]:shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                                    <i class="fa-solid fa-check text-white text-[10px] scale-0 group-has-[:checked]:scale-100 transition-transform duration-200"></i>
                                </div>
                            ` : `
                                <div class="w-5 h-5 rounded-full border-2 border-slate-300 bg-slate-50 flex items-center justify-center shrink-0 transition-all duration-200 group-hover:border-orange-400 group-has-[:checked]:border-orange-500 group-has-[:checked]:bg-orange-500 group-has-[:checked]:shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                                    <div class="w-2 h-2 rounded-full bg-white scale-0 group-has-[:checked]:scale-100 transition-transform duration-200"></div>
                                </div>
                            `}
                            <span class="font-bold text-slate-800 group-hover:text-orange-600 group-has-[:checked]:text-orange-950 transition-colors text-sm truncate">${v.name}</span>
                        </div>
                        ${priceHtml}
                    </label>
                `;
                firstRadio = false;
            });
            html += `</div>`;
        });
        variantList.innerHTML = html;
    } else {
        variantSection.classList.add('hidden');
        variantList.innerHTML = '';
    }

    // Gợi ý món gọi kèm (Upsell & Cross-sell)
    const upsellSection = document.getElementById('upsell-section');
    const upsellList = document.getElementById('upsell-items-list');
    if (upsellSection && upsellList) {
        const suggestions = mangMonAn.filter(m => 
            m.id !== mon.id && 
            m.status !== 'Out_of_stock' && 
            m.inStock !== false
        ).slice(0, 2);

        if (suggestions.length > 0) {
            upsellSection.classList.remove('hidden');
            upsellList.innerHTML = suggestions.map(s => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${s.image}" alt="${s.name}" loading="lazy" decoding="async" class="w-11 h-11 rounded-xl object-cover shrink-0">
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-slate-800 truncate">${s.name}</p>
                            <p class="text-xs font-black text-orange-600">${s.base_price.toLocaleString('vi-VN')} ₫</p>
                        </div>
                    </div>
                    <button type="button" data-upsell-id="${s.id}" class="btn-quick-add-upsell px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-black rounded-lg shrink-0 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
                        <i class="fa-solid fa-plus text-[10px]"></i> Thêm
                    </button>
                </div>
            `).join('');

            upsellList.querySelectorAll('.btn-quick-add-upsell').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const sId = (e.currentTarget as HTMLElement).getAttribute('data-upsell-id');
                    const sItem = mangMonAn.find(m => m.id === sId);
                    if (sItem) {
                        themVaoGioHang(sItem);
                        showSuccessToast(`Đã thêm "${sItem.name}" vào giỏ hàng!`);
                        const targetBtn = e.currentTarget as HTMLButtonElement;
                        targetBtn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i> Đã thêm';
                        targetBtn.classList.replace('bg-orange-500', 'bg-emerald-500');
                        targetBtn.disabled = true;
                    }
                });
            });
        } else {
            upsellSection.classList.add('hidden');
        }
    }
    
    const capNhatGia = () => {
        const selectedInputs = document.querySelectorAll('input.variant-choice:checked') as NodeListOf<HTMLInputElement>;
        let extraTotal = 0;
        selectedInputs.forEach(input => {
            const v = variants.find(v => v.id === input.value);
            if (v) extraTotal += v.extra_price;
        });
        const total = mon.base_price + extraTotal;
        priceDisplay.innerText = total.toLocaleString('vi-VN');
    };
    
    variantList.addEventListener('change', capNhatGia);
    capNhatGia();
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('translate-y-full');
    }, 10);
    
    const onClose = () => {
        content.classList.add('translate-y-full');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
        clearEvents();
    };
    
    const onAdd = (e: Event) => {
        const selectedInputs = document.querySelectorAll('input.variant-choice:checked') as NodeListOf<HTMLInputElement>;
        
        if (selectedInputs.length === 0) {
            themVaoGioHang(mon);
        } else {
            let extraTotal = 0;
            let names: string[] = [];
            let ids: string[] = [];
            
            selectedInputs.forEach(input => {
                const v = variants.find(v => v.id === input.value);
                if (v) {
                    extraTotal += v.extra_price;
                    names.push(v.name);
                    ids.push(v.id);
                }
            });
            
            const pseudoVariant: Variant = {
                id: ids.join('-'),
                menuItem_id: mon.id,
                name: names.join(', '),
                extra_price: extraTotal,
                status: 'Active'
            };
            
            themVaoGioHang(mon, pseudoVariant);
        }
        
        // Chơi hiệu ứng
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        playFlyToCartAnimation(rect.left, rect.top, mon.image);

        onClose();
    };
    
    const clearEvents = () => {
        btnClose.removeEventListener('click', onClose);
        btnAdd.removeEventListener('click', onAdd);
        variantList.removeEventListener('change', capNhatGia);
        modal.removeEventListener('click', onOutsideClick);
    };
    
    const onOutsideClick = (e: MouseEvent) => {
        if (e.target === modal) {
            onClose();
        }
    };

    btnClose.addEventListener('click', onClose);
    btnAdd.addEventListener('click', onAdd);
    modal.addEventListener('click', onOutsideClick);
};

// --- GIỎ HÀNG TRỰC TIẾP (LIVE CART) ---
const updateCartHeader = () => {
    const tableId = localStorage.getItem('restaurant_table');
    const tableName = localStorage.getItem('restaurant_table_name');
    const displayHeader = document.getElementById('lbl-table-id');
    const btnHistory = document.getElementById('btn-order-history');
    
    if (displayHeader) {
        if (tableName) {
            displayHeader.innerText = tableName.toLowerCase().startsWith('bàn') ? tableName : `Bàn ${tableName}`;
        } else if (tableId) {
            displayHeader.innerText = tableId.toLowerCase().startsWith('bàn') ? tableId : `Bàn ${tableId}`;
        } else {
            displayHeader.innerText = 'Chưa chọn bàn';
        }
    }
    
    if (btnHistory) {
        if (tableId) {
            btnHistory.classList.remove('hidden');
        } else {
            btnHistory.classList.add('hidden');
        }
    }
};

const themVaoGioHang = (mon: MenuItem, variant?: Variant) => {
    let cart: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    const cartItemId = variant ? `${mon.id}_${variant.id}` : mon.id;
    
    const index = cart.findIndex(item => item.cart_item_id === cartItemId || (!item.cart_item_id && item.id === mon.id && !variant));
    
    if (index >= 0) {
        cart[index].so_luong += 1; 
    } else {
        cart.push({ 
            ...mon, 
            so_luong: 1, 
            notes: '', 
            variant_name: variant?.name, 
            extra_price: variant?.extra_price || 0,
            cart_item_id: cartItemId
        });
    }
    localStorage.setItem('restaurant_cart', JSON.stringify(cart));
    renderLiveCart(); 
    renderDanhSachMonAn(currentCategoryFilter);
};

const renderLiveCart = () => {
    const cartContainer = document.getElementById('cart-items-list');
    const totalContainer = document.getElementById('cart-total');
    const totalMobileContainer = document.getElementById('cart-total-mobile');
    const countContainer = document.getElementById('cart-count');
    const btnCheckout = document.getElementById('btn-checkout') as HTMLButtonElement;
    if (!cartContainer || !totalContainer || !countContainer) return;

    const cart: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="h-full min-h-[300px] flex flex-col justify-center items-center text-slate-400">
                <i class="fa-solid fa-cart-shopping opacity-20 mb-4"></i>
                <p class="font-bold text-slate-500">Giỏ hàng trống</p>
                <p class="text-xs mt-1">Hãy chọn món ngon từ menu nhé!</p>
            </div>
        `;
        totalContainer.innerText = '0 ₫';
        if (totalMobileContainer) totalMobileContainer.innerText = '0 ₫';
        countContainer.innerText = '0 món';
        if (btnCheckout) btnCheckout.disabled = true;
        return;
    }

    if (btnCheckout) btnCheckout.disabled = false;

    let html = '';
    let total = 0;
    let count = 0;

    cart.forEach(item => {
        const itemPrice = (item.base_price || (item as any).price || 0) + (item.extra_price || 0);
        total += itemPrice * item.so_luong;
        count += item.so_luong;
        
        const variantText = item.variant_name ? `<p class="text-xs text-slate-500 font-bold mb-1">${item.variant_name}</p>` : '';
        const itemId = item.cart_item_id || item.id;
        
        html += `
            <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex gap-3">
                <img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async" class="w-16 h-16 rounded-xl object-cover shrink-0">
                <div class="flex-grow min-w-0 flex flex-col">
                    <h4 class="font-bold text-slate-800 text-sm truncate">${item.name}</h4>
                    ${variantText}
                    <p class="text-orange-600 font-black text-sm">${itemPrice.toLocaleString('vi-VN')} ₫</p>
                    
                    <div class="flex items-center gap-3 mt-2">
                        <div class="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                            <button data-id="${itemId}" class="btn-decrease w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:bg-white rounded-md font-black transition-colors">-</button>
                            <span class="w-6 text-center text-sm font-black text-slate-800">${item.so_luong}</span>
                            <button data-id="${itemId}" class="btn-increase w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:bg-white rounded-md font-black transition-colors">+</button>
                        </div>
                    </div>
                    
                    <div class="mt-2">
                        <input type="text" data-id="${itemId}" value="${item.notes || ''}" class="input-note w-full bg-slate-100 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-orange-300" placeholder="Ghi chú (Ví dụ: ít đá)">
                    </div>
                </div>
                <button data-id="${itemId}" class="btn-remove p-2 h-9 w-9 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 self-start">
                    <i class="fa-solid fa-circle-info text-sm"></i>
                </button>
            </div>
        `;
    });

    cartContainer.innerHTML = html;
    totalContainer.innerText = `${total.toLocaleString('vi-VN')} ₫`;
    if (totalMobileContainer) totalMobileContainer.innerText = `${total.toLocaleString('vi-VN')} ₫`;
    countContainer.innerText = `${count} món`;

    ganSuKienLiveCart();
};

const updateCartData = (cart: CartItem[]) => {
    localStorage.setItem('restaurant_cart', JSON.stringify(cart));
    renderLiveCart();
    renderDanhSachMonAn(currentCategoryFilter);
};

const ganSuKienLiveCart = () => {
    let cart: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');

    document.querySelectorAll('.btn-decrease').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
            const item = cart.find(i => (i.cart_item_id || i.id) === id);
            if (item) {
                item.so_luong -= 1;
                if (item.so_luong <= 0) cart = cart.filter(i => (i.cart_item_id || i.id) !== id);
                updateCartData(cart);
            }
        });
    });

    document.querySelectorAll('.btn-increase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
            const item = cart.find(i => (i.cart_item_id || i.id) === id);
            if (item) {
                item.so_luong += 1;
                updateCartData(cart);
            }
        });
    });

    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
            cart = cart.filter(i => (i.cart_item_id || i.id) !== id);
            updateCartData(cart);
        });
    });

    document.querySelectorAll('.input-note').forEach(input => {
        input.addEventListener('change', (e) => {
            const target = e.currentTarget as HTMLInputElement;
            const id = target.getAttribute('data-id');
            const item = cart.find(i => (i.cart_item_id || i.id) === id);
            if (item) {
                item.notes = target.value;
                localStorage.setItem('restaurant_cart', JSON.stringify(cart));
            }
        });
    });
};

// --- HELPER: CHUẨN HÓA MÃ BÀN (T001, T002...) ---
const resolveCanonicalTableId = async (inputTableId: string): Promise<string> => {
    if (!inputTableId) return '';
    try {
        const tables = await layDanhSachBan() as Table[];
        const clean = inputTableId.trim().toLowerCase();
        const found = tables.find(t => 
            String(t.id).toLowerCase() === clean ||
            String(t.id).replace(/^t0*/i, 't') === clean.replace(/^t0*/i, 't') ||
            String(t.tableNumber).toLowerCase() === clean ||
            `bàn ${clean.replace(/\D/g, '')}` === String(t.tableNumber).toLowerCase()
        );
        if (found) {
            localStorage.setItem('restaurant_table', String(found.id));
            localStorage.setItem('restaurant_table_name', found.tableNumber);
            return String(found.id);
        }
    } catch (_) {}
    return inputTableId;
};

// --- XỬ LÝ CHỌN BÀN ---
const initTableSelection = async () => {
    const modal = document.getElementById('modal-table');
    const btnClose = document.getElementById('btn-close-modal');
    const btnChange = document.getElementById('btn-change-table');
    const tableGrid = document.getElementById('table-grid');
    
    // Load tables from API
    if (tableGrid) {
        try {
            const [tables, branches] = await Promise.all([
                layDanhSachBan() as Promise<Table[]>,
                layDanhSachChiNhanh() as Promise<any[]>
            ]);
            let tableHtml = '';
            
            branches.forEach(branch => {
                const branchTables = tables.filter(t => t.branch_id === branch.id);
                if (branchTables.length > 0) {
                    tableHtml += `<div class="col-span-3 mt-4 mb-2"><h3 class="font-bold text-lg text-slate-700 border-b pb-2">${branch.name}</h3></div>`;
                    
                    branchTables.forEach(table => {
                        let btnClass = "btn-select-table font-black py-4 rounded-xl transition-colors border ";
                        let isDisabled = false;
                        
                        if (table.status === 'Available') {
                            btnClass += "bg-white hover:bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-400";
                        } else {
                            btnClass += "bg-slate-100 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed";
                            isDisabled = true;
                        }
                        
                        tableHtml += `<button ${isDisabled ? 'disabled' : ''} class="${btnClass}" data-table="${table.id}" data-name="${table.tableNumber}">${table.tableNumber}</button>`;
                    });
                }
            });
            tableGrid.innerHTML = tableHtml;
        } catch (error) {
            console.error("Lỗi khi tải danh sách bàn:", error);
            tableGrid.innerHTML = '<p class="col-span-3 text-center text-red-500">Không thể tải danh sách bàn</p>';
        }
    }

    // Đọc query string xem có table_id không
    const urlParams = new URLSearchParams(window.location.search);
    const tableIdFromUrl = urlParams.get('table_id');
    const tableNameFromUrl = urlParams.get('table_name');
    if (tableIdFromUrl) {
        localStorage.setItem('restaurant_table', tableIdFromUrl);
        if (tableNameFromUrl) {
            localStorage.setItem('restaurant_table_name', tableNameFromUrl);
        }
        await resolveCanonicalTableId(tableIdFromUrl);
    } else {
        const curTable = localStorage.getItem('restaurant_table');
        if (curTable) {
            await resolveCanonicalTableId(curTable);
        }
    }

    updateCartHeader();
    
    const currentTable = localStorage.getItem('restaurant_table');
    if (!currentTable && modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    document.querySelectorAll('.btn-select-table').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tableId = (e.currentTarget as HTMLButtonElement).getAttribute('data-table');
            const tableName = (e.currentTarget as HTMLButtonElement).getAttribute('data-name');
            if (tableId) {
                localStorage.setItem('restaurant_table', tableId);
                if (tableName) {
                    localStorage.setItem('restaurant_table_name', tableName);
                }
                updateCartHeader();
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            }
        });
    });
    
    if (btnChange) {
        btnChange.addEventListener('click', () => {
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', async () => {
            if (!localStorage.getItem('restaurant_table')) {
                await showConfirmModal("Chú ý", "Bắt buộc phải chọn bàn để đặt món!");
                return;
            }
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    }
};

// Đồng bộ render lại giỏ hàng mỗi khi khách mở xem giỏ
document.getElementById('btn-view-cart')?.addEventListener('click', () => {
    renderLiveCart();
});

// --- XÁC NHẬN ĐẶT MÓN (CHECKOUT) ---
document.getElementById('btn-checkout')?.addEventListener('click', async (e) => {
    const btnCheckout = e.currentTarget as HTMLButtonElement;

    // Đọc giỏ hàng TẠI THỜI ĐIỂM BẤM NÚT và sao chép ngay
    const cartSnapshot: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    if (cartSnapshot.length === 0) return;

    let tableId = localStorage.getItem('restaurant_table');
    if (!tableId) {
        await showConfirmModal("Chú ý", "Bạn chưa chọn bàn! Vui lòng chọn bàn ở góc trên.");
        return;
    }

    const isConfirmed = await showConfirmModal("Xác nhận", `Gửi ${cartSnapshot.length} món vào bếp?`);
    if (!isConfirmed) return;

    // Chuẩn hóa tableId canonical (ví dụ T2 -> T002)
    tableId = await resolveCanonicalTableId(tableId);

    // === XÓA GIỎ HÀNG NGAY LẬP TỨC KHỎI STORAGE & CẬP NHẬT GIAO DIỆN ===
    localStorage.removeItem('restaurant_cart');
    renderLiveCart();

    btnCheckout.disabled = true;
    btnCheckout.classList.replace('bg-orange-500', 'bg-slate-400');
    btnCheckout.classList.replace('hover:bg-orange-600', 'hover:bg-slate-400');
    btnCheckout.innerHTML = `Đang gửi đơn... <i class="fa-solid fa-spinner fa-spin text-sm ml-2"></i>`;

    const tongTien = cartSnapshot.reduce((acc, item) =>
        acc + (((item.base_price || (item as any).price || 0) + (item.extra_price || 0)) * item.so_luong), 0
    );

    try {
        // 1. Kiểm tra / tạo đơn hàng
        const activeOrders = await layDonHangDangMoCuaBan(tableId);
        let orderId: string;
        let currentTotal = 0;

        if (activeOrders.length > 0) {
            orderId = String(activeOrders[0].id);
            currentTotal = activeOrders[0].totalAmount || 0;
        } else {
            const newOrder = await taoDonHang({
                table_id: tableId,
                customerInfo: "Khách quét mã QR",
                totalAmount: 0,
                status: "In_Progress",
                paymentStatus: "Unpaid",
                createdAt: new Date().toISOString()
            });
            orderId = String(newOrder.id);
            try {
                await capNhatTrangThaiBan(tableId, "Occupied");
            } catch (errTable) {
                console.warn("Lưu ý cập nhật trạng thái bàn:", errTable);
            }
        }

        // 2. Lấy danh sách món đã có trong đơn để kiểm tra merge
        const existingDetails: any[] = await layChiTietCuaDon(orderId);

        // 3. Gửi TỪNG MÓN LẦN LƯỢT - nếu trùng thì PATCH tăng số lượng, không tạo mới
        for (const item of cartSnapshot) {
            const finalPrice = (item.base_price || (item as any).price || 0) + (item.extra_price || 0);
            let notes = item.notes || "";
            if (item.variant_name) notes = `[${item.variant_name}] ${notes}`;
            const normalizedNotes = notes.trim();

            // Tìm món trùng: cùng menuItem_id VÀ cùng notes (variant)
            const duplicate = existingDetails.find(
                d => d.menuItem_id === item.id && (d.notes || "") === normalizedNotes
            );

            if (duplicate) {
                // Đã có → cộng dồn số lượng
                await capNhatSoLuongMon(String(duplicate.id), duplicate.quantity + item.so_luong);
            } else {
                // Chưa có → tạo mới
                await taoChiTietDonHang({
                    order_id: Number(orderId) || orderId,
                    menuItem_id: item.id,
                    quantity: item.so_luong,
                    priceAtOrder: finalPrice,
                    notes: normalizedNotes,
                    status: "Unconfirmed",
                    incidentNote: "",
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 4. Cập nhật tổng tiền (safe)
        try {
            await capNhatTongTienDonHang(orderId, currentTotal + tongTien);
        } catch (errTotal) {
            console.warn("Lưu ý cập nhật tổng tiền đơn hàng:", errTotal);
        }

        // Broadcast tới Bếp & Phục vụ (Real-time Push Notification)
        kdsChannel.postMessage({
            type: 'CUSTOMER_ORDERED',
            tableId: tableId,
            tableName: localStorage.getItem('restaurant_table_name') || `Bàn #${tableId}`,
            orderId: orderId,
            itemCount: cartSnapshot.length,
            message: `${localStorage.getItem('restaurant_table_name') || `Bàn #${tableId}`} vừa đặt ${cartSnapshot.length} món!`
        });

        // 5. Đảm bảo xóa sạch giỏ hàng hoàn toàn
        localStorage.removeItem('restaurant_cart');
        renderLiveCart();

        // Đóng modal cart trên mobile
        const modalCartSheet = document.getElementById('modal-cart-sheet');
        const cartSheetContent = document.getElementById('cart-sheet-content');
        if (cartSheetContent) cartSheetContent.classList.add('translate-y-full');
        if (modalCartSheet) {
            setTimeout(() => {
                modalCartSheet.classList.add('hidden');
                modalCartSheet.classList.remove('flex');
            }, 300);
        }

        // 6. Thông báo thành công và cập nhật nút Đã gọi
        showSuccessToast(`Đặt ${cartSnapshot.length} món thành công! Bếp đang chuẩn bị.`);
        updateCartHeader();

    } catch (error) {
        console.error("CHECKOUT ERROR:", error);
        // Nếu gặp lỗi kết nối server, trả cart về như cũ để khách có thể thử lại
        localStorage.setItem('restaurant_cart', JSON.stringify(cartSnapshot));
        renderLiveCart();
        btnCheckout.disabled = false;
        btnCheckout.classList.replace('bg-slate-400', 'bg-orange-500');
        btnCheckout.classList.replace('hover:bg-slate-400', 'hover:bg-orange-600');
        btnCheckout.innerHTML = `Xác nhận đặt món <svg class="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
        await showConfirmModal("Lỗi đặt món", (error as Error).message || "Không thể kết nối server. Vui lòng thử lại.");
    }
});

// --- XEM MÓN ĐÃ ĐẶT (ORDER HISTORY) ---
const initOrderHistory = () => {
    const btnHistory = document.getElementById('btn-order-history');
    const modalHistory = document.getElementById('modal-order-history');
    const btnClose = document.getElementById('btn-close-history');
    const listContainer = document.getElementById('history-items-list');
    
    if (!btnHistory || !modalHistory || !btnClose || !listContainer) return;
    
    let currentHistoryHash = "";
    let isHistoryOpen = false;

    const hienThiLichSu = async (isBackground = false) => {
        const tableId = localStorage.getItem('restaurant_table');
        if (!tableId) return;
        
        if (!isBackground) {
            listContainer.innerHTML = '<div class="text-center text-slate-500 py-10 font-bold">Đang tải dữ liệu...</div>';
            modalHistory.classList.remove('hidden');
            modalHistory.classList.add('flex');
            isHistoryOpen = true;
        }
        
        try {
            // Bước 1: Lấy order hiện tại
            const orders = await layDonHangDangMoCuaBan(tableId);
            if (orders.length === 0) {
                if (!isBackground) listContainer.innerHTML = '<div class="text-center text-slate-500 py-10 font-bold">Bàn chưa gọi món nào!</div>';
                return;
            }
            
            const currentOrderId = orders[0].id;
            // Bước 2: Lấy chi tiết order
            const details = await layChiTietCuaDon(currentOrderId);
            
            // HASH COMPARE
            const newDataHash = JSON.stringify(details);
            if (isBackground && newDataHash === currentHistoryHash) return;
            currentHistoryHash = newDataHash;
            
            if (details.length === 0) {
                listContainer.innerHTML = '<div class="text-center text-slate-500 py-10 font-bold">Đơn hàng trống!</div>';
                const progressSummaryEl = document.getElementById('history-progress-summary');
                if (progressSummaryEl) progressSummaryEl.innerText = '0 món';
                return;
            }

            const totalDishes = details.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
            const servedCount = details.filter((i: any) => (i.status || '').toLowerCase() === 'served').reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

            const progressSummaryEl = document.getElementById('history-progress-summary');
            const subtitleEl = document.getElementById('history-table-subtitle');
            const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${tableId}`;

            if (subtitleEl) subtitleEl.innerText = tableName;
            if (progressSummaryEl) {
                if (totalDishes === 0) {
                    progressSummaryEl.innerText = 'Chưa có món nào';
                } else if (servedCount === totalDishes) {
                    progressSummaryEl.innerText = `Đã phục vụ xong (${servedCount}/${totalDishes}) 🎉`;
                } else {
                    progressSummaryEl.innerText = `Đã phục vụ ${servedCount}/${totalDishes} món (${Math.round((servedCount / totalDishes) * 100)}%)`;
                }
            }
            
            let html = '';
            details.forEach((item: any) => {
                const mId = (item.menuItem_id && typeof item.menuItem_id === 'object') ? String(item.menuItem_id.id || item.menuItem_id._id) : String(item.menuItem_id || '');
                const monObj = mangMonAn.find(m => String(m.id || (m as any)._id) === mId);
                const name = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.name) ? item.menuItem_id.name : (monObj ? monObj.name : (item.name || 'Món không rõ'));
                const img = (item.menuItem_id && typeof item.menuItem_id === 'object' && item.menuItem_id.image) ? item.menuItem_id.image : (monObj ? monObj.image : '');
                const st = (item.status || 'Pending').toLowerCase();
                
                let step = 1;
                let badge = '<span class="bg-amber-100 text-amber-700 px-2.5 py-1 text-[11px] font-bold rounded-lg"><i class="fa-solid fa-clock text-[10px] mr-1"></i>Chờ bếp</span>';
                if (st === 'cooking') {
                    step = 2;
                    badge = '<span class="bg-orange-100 text-orange-600 px-2.5 py-1 text-[11px] font-bold rounded-lg"><i class="fa-solid fa-fire-burner text-[10px] mr-1"></i>Đang nấu</span>';
                } else if (st === 'ready') {
                    step = 2;
                    badge = '<span class="bg-blue-100 text-blue-600 px-2.5 py-1 text-[11px] font-bold rounded-lg"><i class="fa-solid fa-bell-concierge text-[10px] mr-1"></i>Đã nấu xong</span>';
                } else if (st === 'served') {
                    step = 3;
                    badge = '<span class="bg-emerald-100 text-emerald-600 px-2.5 py-1 text-[11px] font-bold rounded-lg"><i class="fa-solid fa-check text-[10px] mr-1"></i>Đã lên bàn</span>';
                }

                const step1Class = step >= 1 ? 'text-orange-600 font-black' : 'text-slate-400 font-medium';
                const step2Class = step >= 2 ? 'text-orange-600 font-black' : 'text-slate-400 font-medium';
                const step3Class = step >= 3 ? 'text-emerald-600 font-black' : 'text-slate-400 font-medium';
                const progressBarWidth = step === 1 ? 'w-1/3 bg-orange-400' : (step === 2 ? 'w-2/3 bg-orange-500' : 'w-full bg-emerald-500');
                
                let notesText = item.notes ? `<p class="text-xs text-orange-500 mt-0.5 italic">${item.notes}</p>` : '';
                
                html += `
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs space-y-2.5">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3 min-w-0">
                                <img src="${img}" alt="${name}" loading="lazy" decoding="async" class="w-12 h-12 rounded-xl object-cover shrink-0">
                                <div class="min-w-0">
                                    <h4 class="font-bold text-sm text-slate-800 truncate">${name}</h4>
                                    <p class="text-xs text-slate-500">Số lượng: <span class="font-black text-slate-700">${item.quantity}</span></p>
                                    ${notesText}
                                </div>
                            </div>
                            <div class="shrink-0 text-right">
                                ${badge}
                                <p class="text-xs font-black text-orange-600 mt-1.5">${(item.priceAtOrder * item.quantity).toLocaleString('vi-VN')} ₫</p>
                            </div>
                        </div>
                        <div class="pt-2 border-t border-slate-100">
                            <div class="flex items-center justify-between text-[10px] mb-1.5">
                                <span class="${step1Class}"><i class="fa-solid fa-check mr-0.5"></i> 1. Đã nhận</span>
                                <span class="${step2Class}"><i class="fa-solid fa-${step >= 2 ? 'fire' : 'circle-notch'} mr-0.5"></i> 2. Đang nấu</span>
                                <span class="${step3Class}"><i class="fa-solid fa-${step >= 3 ? 'circle-check' : 'utensils'} mr-0.5"></i> 3. Đã lên bàn</span>
                            </div>
                            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-500 ${progressBarWidth}"></div>
                            </div>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
            
        } catch (error) {
            console.error(error);
            if (!isBackground) listContainer.innerHTML = '<div class="text-center text-red-500 py-10 font-bold">Lỗi tải dữ liệu</div>';
        }
    };
    
    // Gắn vào window để gọi từ chỗ khác nếu cần
    (window as any).loadOrderHistory = () => hienThiLichSu(false);
    
    btnHistory.addEventListener('click', () => hienThiLichSu(false));
    
    btnClose.addEventListener('click', () => {
        modalHistory.classList.add('hidden');
        modalHistory.classList.remove('flex');
        isHistoryOpen = false;
    });
    
    // Polling 3 giây 1 lần chỉ khi modal đang mở
    setInterval(() => {
        if (isHistoryOpen) {
            hienThiLichSu(true);
        }
    }, 3000);
};

// --- XỬ LÝ GỌI PHỤC VỤ & YÊU CẦU TÍNH TIỀN ---
const initCustomerServiceCalls = () => {
    const btnCall = document.getElementById('btn-call-waiter');
    const modalCall = document.getElementById('modal-call-waiter');
    const btnCloseCall = document.getElementById('btn-close-call-waiter');
    const btnSubmitCall = document.getElementById('btn-submit-call-waiter');
    const tableLblCall = document.getElementById('call-waiter-table-lbl');
    const customNoteInput = document.getElementById('call-waiter-custom-note') as HTMLInputElement | null;

    const btnRequestBill = document.getElementById('btn-request-bill');
    const modalBill = document.getElementById('modal-request-bill');
    const btnCloseBill = document.getElementById('btn-close-request-bill');
    const btnSubmitBill = document.getElementById('btn-submit-request-bill');
    const tableLblBill = document.getElementById('request-bill-table-lbl');
    const subtotalLblBill = document.getElementById('request-bill-subtotal');
    const statusTextEl = document.getElementById('service-status-text');

    let selectedReason = 'Thêm đá / Khăn lạnh';
    let selectedPayMethod = 'Chuyển khoản QR';

    // 1. Chọn nhanh lý do gọi
    document.querySelectorAll('.btn-reason').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-reason').forEach(b => {
                b.classList.remove('border-orange-500', 'text-orange-600', 'bg-orange-50');
                b.classList.add('border-slate-200', 'text-slate-700');
            });
            const target = e.currentTarget as HTMLButtonElement;
            target.classList.remove('border-slate-200', 'text-slate-700');
            target.classList.add('border-orange-500', 'text-orange-600', 'bg-orange-50');
            selectedReason = target.getAttribute('data-reason') || 'Cần phục vụ';
        });
    });

    // 2. Mở modal Gọi phục vụ
    btnCall?.addEventListener('click', async () => {
        let tableId = localStorage.getItem('restaurant_table');
        if (!tableId) {
            showSuccessToast('Vui lòng chọn bàn trước khi gọi phục vụ!');
            const modalTable = document.getElementById('modal-table');
            modalTable?.classList.remove('hidden');
            modalTable?.classList.add('flex');
            return;
        }
        tableId = await resolveCanonicalTableId(tableId);
        const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${tableId || '?'}`;
        if (tableLblCall) tableLblCall.innerText = tableName;
        modalCall?.classList.remove('hidden');
        modalCall?.classList.add('flex');
    });

    btnCloseCall?.addEventListener('click', () => {
        modalCall?.classList.add('hidden');
        modalCall?.classList.remove('flex');
    });

    modalCall?.addEventListener('click', (e) => {
        if (e.target === modalCall) {
            modalCall.classList.add('hidden');
            modalCall.classList.remove('flex');
        }
    });

    btnSubmitCall?.addEventListener('click', async () => {
        let tableId = localStorage.getItem('restaurant_table') || '';
        tableId = await resolveCanonicalTableId(tableId);
        const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${tableId}`;
        const customNote = customNoteInput ? customNoteInput.value.trim() : '';
        const finalReason = customNote ? `${selectedReason} (${customNote})` : selectedReason;

        kdsChannel.postMessage({
            type: 'CALL_WAITER',
            tableId,
            tableName,
            reason: finalReason,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });

        modalCall?.classList.add('hidden');
        modalCall?.classList.remove('flex');
        if (customNoteInput) customNoteInput.value = '';

        showSuccessToast('Đã gửi yêu cầu gọi phục vụ! Nhân viên sẽ đến ngay.');
        if (statusTextEl) {
            statusTextEl.innerText = `Đã gọi: ${selectedReason}`;
            setTimeout(() => {
                if (statusTextEl) statusTextEl.innerText = 'Đang phục vụ tại bàn';
            }, 15000);
        }
    });

    // 3. Chọn phương thức thanh toán
    const qrContainer = document.getElementById('request-bill-qr-container');
    document.querySelectorAll('.btn-pay-method').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-pay-method').forEach(b => {
                b.classList.remove('border-orange-500', 'bg-orange-50/40');
                b.classList.add('border-slate-200');
            });
            const target = e.currentTarget as HTMLButtonElement;
            target.classList.remove('border-slate-200');
            target.classList.add('border-orange-500', 'bg-orange-50/40');
            selectedPayMethod = target.getAttribute('data-method') || 'Chuyển khoản QR';

            if (qrContainer) {
                if (selectedPayMethod === 'Chuyển khoản QR') {
                    qrContainer.classList.remove('hidden');
                } else {
                    qrContainer.classList.add('hidden');
                }
            }
        });
    });

    // 4. Mở modal Yêu cầu tính tiền
    btnRequestBill?.addEventListener('click', async () => {
        let tableId = localStorage.getItem('restaurant_table');
        if (!tableId) {
            showSuccessToast('Vui lòng chọn bàn trước khi yêu cầu tính tiền!');
            const modalTable = document.getElementById('modal-table');
            modalTable?.classList.remove('hidden');
            modalTable?.classList.add('flex');
            return;
        }

        tableId = await resolveCanonicalTableId(tableId);
        const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${tableId || '?'}`;

        if (tableLblBill) tableLblBill.innerText = tableName;
        if (subtotalLblBill) subtotalLblBill.innerText = 'Đang tính...';

        modalBill?.classList.remove('hidden');
        modalBill?.classList.add('flex');

        let total = 0;
        try {
            const orders = await layDonHangDangMoCuaBan(tableId);
            if (orders.length > 0) {
                total = orders[0].totalAmount || 0;
                if (!total) {
                    try {
                        const details = await layChiTietCuaDon(String(orders[0].id));
                        total = details.reduce((sum: number, d: any) => sum + ((d.priceAtOrder || 0) * (d.quantity || 1)), 0);
                    } catch (_) {}
                }
                if (subtotalLblBill) subtotalLblBill.innerText = total.toLocaleString('vi-VN') + ' ₫';
            } else {
                if (subtotalLblBill) subtotalLblBill.innerText = '0 ₫';
            }
        } catch (err) {
            if (subtotalLblBill) subtotalLblBill.innerText = '0 ₫';
        }

        // Cập nhật Dynamic VietQR & Thông tin thanh toán
        const cleanTableNum = (tableName || 'BAN').replace(/[^\w\d]/g, '').toUpperCase();
        const bankMemo = `TT ${cleanTableNum}`;
        const qrImg = document.getElementById('request-bill-qr-img') as HTMLImageElement | null;
        const qrMemoEl = document.getElementById('qr-bank-memo');
        const btnCopyMemo = document.getElementById('btn-copy-memo');

        if (qrMemoEl) qrMemoEl.innerText = bankMemo;
        if (btnCopyMemo) btnCopyMemo.setAttribute('data-copy', bankMemo);

        if (qrImg) {
            qrImg.src = `https://api.vietqr.io/image/970422-0901234567-compact2.png?amount=${total}&addInfo=${encodeURIComponent(bankMemo)}&accountName=FOODHUB%20RESTAURANT`;
        }
    });

    // Xử lý sao chép thông tin tài khoản / nội dung CK
    document.querySelectorAll('.btn-copy-info').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const copyText = (e.currentTarget as HTMLElement).getAttribute('data-copy');
            if (copyText) {
                navigator.clipboard.writeText(copyText).then(() => {
                    showSuccessToast(`Đã sao chép: ${copyText}`);
                }).catch(() => {
                    showSuccessToast(`Đã sao chép: ${copyText}`);
                });
            }
        });
    });

    btnCloseBill?.addEventListener('click', () => {
        modalBill?.classList.add('hidden');
        modalBill?.classList.remove('flex');
    });

    modalBill?.addEventListener('click', (e) => {
        if (e.target === modalBill) {
            modalBill.classList.add('hidden');
            modalBill.classList.remove('flex');
        }
    });

    btnSubmitBill?.addEventListener('click', async () => {
        let tableId = localStorage.getItem('restaurant_table') || '';
        tableId = await resolveCanonicalTableId(tableId);
        const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${tableId}`;

        // Gửi tín hiệu thời gian thực cho Thu ngân và Phục vụ
        kdsChannel.postMessage({
            type: 'REQUEST_CHECKOUT',
            tableId,
            tableName,
            method: selectedPayMethod,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });

        // Cập nhật trạng thái bàn sang Waiting_Payment
        try {
            await capNhatTrangThaiBan(tableId, "Waiting_Payment");
        } catch (errWait) {
            console.warn("Lưu ý cập nhật trạng thái bàn sang Waiting_Payment:", errWait);
        }

        modalBill?.classList.add('hidden');
        modalBill?.classList.remove('flex');

        showSuccessToast(`Đã gửi yêu cầu tính tiền (${selectedPayMethod}) tới Thu ngân!`);
        if (statusTextEl) {
            statusTextEl.innerText = `Đang chờ tính tiền (${selectedPayMethod})...`;
        }
    });

    // 5. Lắng nghe phản hồi từ Phục vụ & Thu ngân qua BroadcastChannel
    kdsChannel.onmessage = (event) => {
        const currentTableId = localStorage.getItem('restaurant_table');

        if (event.data.type === 'WAITER_ACKNOWLEDGED') {
            if (String(event.data.tableId) === String(currentTableId)) {
                showSuccessToast('Nhân viên đã tiếp nhận yêu cầu và đang đến bàn của bạn!');
                if (statusTextEl) statusTextEl.innerText = 'Nhân viên đang tới bàn...';
                setTimeout(() => {
                    if (statusTextEl) statusTextEl.innerText = 'Đang phục vụ tại bàn';
                }, 10000);
            }
        } else if (event.data.type === 'ORDER_PAID') {
            if (String(event.data.tableId) === String(currentTableId)) {
                showSuccessToast('Hóa đơn của bạn đã được thanh toán hoàn tất! Cảm ơn quý khách!');
                if (statusTextEl) statusTextEl.innerText = 'Đã thanh toán hoàn tất';
                setTimeout(() => {
                    if (statusTextEl) statusTextEl.innerText = 'Đang phục vụ tại bàn';
                }, 15000);

                // Tự động mở Modal Đánh giá dịch vụ 5 sao sau bữa ăn
                const modalFeedback = document.getElementById('modal-feedback');
                if (modalFeedback) {
                    setTimeout(() => {
                        modalFeedback.classList.remove('hidden');
                        modalFeedback.classList.add('flex');
                    }, 1200);
                }
            }
        } else if (event.data.type === 'TABLE_MOVED') {
            // Khi Thu ngân hoặc Phục vụ đổi bàn cho khách
            if (String(event.data.from) === String(currentTableId)) {
                localStorage.setItem('restaurant_table', String(event.data.to));
                if (event.data.toName) {
                    localStorage.setItem('restaurant_table_name', event.data.toName);
                } else {
                    localStorage.setItem('restaurant_table_name', `Bàn ${event.data.to}`);
                }
                updateCartHeader();
                showWarningToast(`Bàn của bạn đã được chuyển từ Bàn ${event.data.from} sang Bàn ${event.data.to}!`);
                if ((window as any).loadOrderHistory) {
                    (window as any).loadOrderHistory();
                }
            }
        } else if (event.data.type === 'DISH_COMPLETED' || event.data.type === 'ITEM_READY') {
            // Khi bếp hoàn tất món
            if (String(event.data.tableId) === String(currentTableId)) {
                showSuccessToast(`Món "${event.data.itemName || 'Món ăn'}" đã được chế biến xong và đang mang tới bàn!`);
                if ((window as any).loadOrderHistory) {
                    (window as any).loadOrderHistory();
                }
            }
        } else if (event.data.type === 'OUT_OF_STOCK' || event.data.type === 'MENU_UPDATED') {
            try {
                layDanhSachMonAn().then(monAns => {
                    mangMonAn = monAns;
                    renderDanhSachMonAn(currentCategoryFilter);
                    if (event.data.message) {
                        showWarningToast(event.data.message);
                    }
                });
            } catch (err) {
                console.error('Lỗi cập nhật menu khách hàng:', err);
            }
        }
    };
};

// --- TÌM KIẾM & BỘ LỌC TAG NHANH ---
const initSearchAndFilters = () => {
    const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    const btnClearSearch = document.getElementById('btn-clear-search');
    const tagFilterList = document.getElementById('tag-filter-list');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentSearchKeyword = searchInput.value.trim();
            if (btnClearSearch) {
                if (currentSearchKeyword.length > 0) {
                    btnClearSearch.classList.remove('hidden');
                    btnClearSearch.classList.add('flex');
                } else {
                    btnClearSearch.classList.add('hidden');
                    btnClearSearch.classList.remove('flex');
                }
            }
            renderDanhSachMonAn(currentCategoryFilter);
        });
    }

    if (btnClearSearch && searchInput) {
        btnClearSearch.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchKeyword = '';
            btnClearSearch.classList.add('hidden');
            btnClearSearch.classList.remove('flex');
            searchInput.focus();
            renderDanhSachMonAn(currentCategoryFilter);
        });
    }

    if (tagFilterList) {
        const tagBtns = tagFilterList.querySelectorAll('.btn-tag-filter');
        tagBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                tagBtns.forEach(b => {
                    b.classList.remove('bg-orange-500', 'text-white', 'shadow-xs');
                    b.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
                });
                target.classList.remove('bg-white', 'text-slate-600', 'border', 'border-slate-200');
                target.classList.add('bg-orange-500', 'text-white', 'shadow-xs');

                currentTagFilter = target.getAttribute('data-tag') || 'all';
                renderDanhSachMonAn(currentCategoryFilter);
            });
        });
    }
};

// --- TIỆN ÍCH BÀN ĂN (WI-FI, HÓA ĐƠN VAT, HOTLINE) ---
const initTableUtilities = () => {
    const btnOpenUtil = document.getElementById('btn-table-utilities');
    const modalUtil = document.getElementById('modal-table-utilities');
    const btnCloseUtil = document.getElementById('btn-close-utilities');
    const utilTableLbl = document.getElementById('util-table-lbl');

    const tabBtnWifi = document.getElementById('tab-btn-wifi');
    const tabBtnVat = document.getElementById('tab-btn-vat');
    const tabBtnContact = document.getElementById('tab-btn-contact');

    const tabContentWifi = document.getElementById('tab-content-wifi');
    const tabContentVat = document.getElementById('tab-content-vat');
    const tabContentContact = document.getElementById('tab-content-contact');

    const btnCopyWifi = document.getElementById('btn-copy-wifi');
    const btnSaveVat = document.getElementById('btn-save-vat-info');

    btnOpenUtil?.addEventListener('click', () => {
        const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${localStorage.getItem('restaurant_table') || '?'}`;
        if (utilTableLbl) utilTableLbl.innerText = tableName;
        modalUtil?.classList.remove('hidden');
        modalUtil?.classList.add('flex');
    });

    btnCloseUtil?.addEventListener('click', () => {
        modalUtil?.classList.add('hidden');
        modalUtil?.classList.remove('flex');
    });

    modalUtil?.addEventListener('click', (e) => {
        if (e.target === modalUtil) {
            modalUtil.classList.add('hidden');
            modalUtil.classList.remove('flex');
        }
    });

    const switchTab = (tab: 'wifi' | 'vat' | 'contact') => {
        [tabBtnWifi, tabBtnVat, tabBtnContact].forEach(b => {
            b?.classList.remove('border-orange-500', 'text-orange-600');
            b?.classList.add('border-transparent', 'text-slate-400');
        });
        [tabContentWifi, tabContentVat, tabContentContact].forEach(c => c?.classList.add('hidden'));

        if (tab === 'wifi') {
            tabBtnWifi?.classList.remove('border-transparent', 'text-slate-400');
            tabBtnWifi?.classList.add('border-orange-500', 'text-orange-600');
            tabContentWifi?.classList.remove('hidden');
        } else if (tab === 'vat') {
            tabBtnVat?.classList.remove('border-transparent', 'text-slate-400');
            tabBtnVat?.classList.add('border-orange-500', 'text-orange-600');
            tabContentVat?.classList.remove('hidden');
        } else if (tab === 'contact') {
            tabBtnContact?.classList.remove('border-transparent', 'text-slate-400');
            tabBtnContact?.classList.add('border-orange-500', 'text-orange-600');
            tabContentContact?.classList.remove('hidden');
        }
    };

    tabBtnWifi?.addEventListener('click', () => switchTab('wifi'));
    tabBtnVat?.addEventListener('click', () => switchTab('vat'));
    tabBtnContact?.addEventListener('click', () => switchTab('contact'));

    btnCopyWifi?.addEventListener('click', () => {
        const pass = document.getElementById('wifi-password-val')?.innerText || 'foodhub@2026';
        navigator.clipboard.writeText(pass).then(() => {
            showSuccessToast('Đã sao chép mật khẩu Wi-Fi: ' + pass);
        }).catch(() => {
            showSuccessToast('Đã sao chép mật khẩu Wi-Fi: ' + pass);
        });
    });

    btnSaveVat?.addEventListener('click', async () => {
        const companyName = (document.getElementById('vat-company-name') as HTMLInputElement)?.value.trim();
        const taxCode = (document.getElementById('vat-tax-code') as HTMLInputElement)?.value.trim();
        const email = (document.getElementById('vat-email') as HTMLInputElement)?.value.trim();

        if (!companyName || !taxCode || !email) {
            await showConfirmModal('Thiếu thông tin', 'Vui lòng điền đầy đủ Tên công ty, Mã số thuế và Email nhận hóa đơn!');
            return;
        }

        const tableId = localStorage.getItem('restaurant_table');
        if (!tableId) {
            await showConfirmModal('Chú ý', 'Vui lòng chọn bàn trước khi lưu thông tin hóa đơn!');
            return;
        }

        try {
            const orders = await layDonHangDangMoCuaBan(tableId);
            if (orders.length > 0) {
                const currentOrder = orders[0];
                await capNhatDonHang(String(currentOrder.id), {
                    vatInvoice: {
                        companyName,
                        taxCode,
                        email,
                        requestedAt: new Date().toISOString()
                    }
                });
                showSuccessToast('Đã lưu thông tin xuất hóa đơn VAT! Thu ngân sẽ hỗ trợ xuất hóa đơn khi thanh toán.');
                modalUtil?.classList.add('hidden');
                modalUtil?.classList.remove('flex');
            } else {
                showSuccessToast('Đã lưu thông tin hóa đơn tạm thời. Vui lòng đặt món trước khi tính tiền!');
                modalUtil?.classList.add('hidden');
                modalUtil?.classList.remove('flex');
            }
        } catch (err) {
            console.error('Lỗi lưu thông tin VAT:', err);
            showSuccessToast('Đã tiếp nhận thông tin hóa đơn VAT!');
            modalUtil?.classList.add('hidden');
            modalUtil?.classList.remove('flex');
        }
    });
};

// --- ĐÁNH GIÁ DỊCH VỤ & MÓN ĂN SAU BỮA ĂN (5 SAO) ---
const initCustomerFeedback = () => {
    const modalFeedback = document.getElementById('modal-feedback');
    const btnSkip = document.getElementById('btn-skip-feedback');
    const btnSubmit = document.getElementById('btn-submit-feedback');
    const starContainer = document.getElementById('star-rating-container');
    const starLabel = document.getElementById('star-rating-label');
    const commentInput = document.getElementById('feedback-comment') as HTMLTextAreaElement | null;
    const tagBtns = document.querySelectorAll('.btn-feedback-tag');

    let currentRating = 5;
    const ratingLabels: { [key: number]: string } = {
        1: '1 sao - Rất tệ 😞',
        2: '2 sao - Cần cải thiện 😐',
        3: '3 sao - Bình thường 🙂',
        4: '4 sao - Rất hài lòng 😊',
        5: '5 sao - Tuyệt vời xuất sắc! 🤩'
    };

    const updateStarUI = (rating: number) => {
        currentRating = rating;
        if (starLabel) starLabel.innerText = ratingLabels[rating] || `${rating} sao`;
        const stars = starContainer?.querySelectorAll('.star-item');
        stars?.forEach(star => {
            const r = Number(star.getAttribute('data-rating') || 0);
            if (r <= rating) {
                star.classList.add('text-amber-400');
                star.classList.remove('text-slate-200');
            } else {
                star.classList.remove('text-amber-400');
                star.classList.add('text-slate-200');
            }
        });
    };

    // Mặc định chọn 5 sao
    updateStarUI(5);

    starContainer?.querySelectorAll('.star-item').forEach(star => {
        star.addEventListener('click', (e) => {
            const r = Number((e.currentTarget as HTMLElement).getAttribute('data-rating') || 5);
            updateStarUI(r);
        });
    });

    // Tag chip toggle
    tagBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.classList.toggle('bg-orange-500');
            target.classList.toggle('text-white');
            target.classList.toggle('border-orange-500');
        });
    });

    btnSkip?.addEventListener('click', () => {
        modalFeedback?.classList.add('hidden');
        modalFeedback?.classList.remove('flex');
    });

    btnSubmit?.addEventListener('click', async () => {
        const tableId = localStorage.getItem('restaurant_table') || 'unknown';
        const tableName = localStorage.getItem('restaurant_table_name') || `Bàn #${tableId}`;
        const selectedTags: string[] = [];
        document.querySelectorAll('.btn-feedback-tag.bg-orange-500').forEach(b => {
            const tag = b.getAttribute('data-tag');
            if (tag) selectedTags.push(tag);
        });
        const comment = commentInput?.value.trim() || '';

        const feedbackData = {
            tableId,
            tableName,
            rating: currentRating,
            tags: selectedTags,
            comment,
            createdAt: new Date().toISOString()
        };

        try {
            await taoFeedback(feedbackData);
            showSuccessToast('Cảm ơn quý khách đã gửi đánh giá quý báu! Chúc quý khách một ngày tuyệt vời!');
        } catch (err) {
            console.error('Lỗi gửi feedback:', err);
            showSuccessToast('Cảm ơn quý khách đã gửi đánh giá!');
        }

        modalFeedback?.classList.add('hidden');
        modalFeedback?.classList.remove('flex');
        if (commentInput) commentInput.value = '';
    });
};

// --- KHỞI CHẠY TRANG ---
const khoiTaoTrang = async () => {
    await initTableSelection();
    initSearchAndFilters();
    initTableUtilities();
    initCustomerFeedback();
    initOrderHistory();
    initCustomerServiceCalls();
    renderLiveCart(); 
    const [monAns, danhMucs] = await Promise.all([
        layDanhSachMonAn(),
        layDanhSachDanhMuc()
    ]);
    mangMonAn = monAns;
    mangDanhMuc = danhMucs;
    await hienThiDanhMuc();
    renderDanhSachMonAn('all');
};

khoiTaoTrang();


