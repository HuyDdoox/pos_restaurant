import { 
    layDanhSachMonAn, layDanhSachDanhMuc, taoDonHang, taoChiTietDonHang, 
    layDonHangDangMoCuaBan, capNhatTrangThaiBan, capNhatTongTienDonHang, layDanhSachBan, 
    layDanhSachVariants, layChiTietCuaDon, capNhatSoLuongMon, layDanhSachChiNhanh,
    layDanhSachIngredients, layDanhSachRecipes
} from './api';
import { MenuItem, CartItem, Category, Table, Variant } from './interfaces';
import { showSuccessToast, showConfirmModal } from './utils/ui';

let mangMonAn: MenuItem[] = [];
let mangDanhMuc: Category[] = [];
let mangIngredients: any[] = [];
let mangRecipes: any[] = [];

// --- RENDER DANH MỤC ---
const hienThiDanhMuc = async () => {
    mangDanhMuc = await layDanhSachDanhMuc();
    const container = document.getElementById('category-list') as HTMLDivElement;
    if (!container) return;

    let html = `<button data-id="all" class="btn-filter shrink-0 px-6 py-2.5 rounded-full bg-orange-500 text-white font-bold shadow-md transition-colors">Tất cả</button>`;
    
    mangDanhMuc.forEach(dm => {
        html += `<button data-id="${dm.id}" class="btn-filter shrink-0 px-6 py-2.5 rounded-full bg-white text-slate-600 font-bold border border-slate-200 hover:border-orange-500 hover:text-orange-500 transition-colors">${dm.name}</button>`;
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

            const idDanhMuc = target.getAttribute('data-id') || 'all';
            renderDanhSachMonAn(idDanhMuc);
        });
    });
};

// --- RENDER MÓN ĂN ---
const renderDanhSachMonAn = (idDanhMuc: string = 'all') => {
    const container = document.getElementById('menu-list') as HTMLDivElement;
    if (!container) return;

    let danhSachLoc = mangMonAn;
    if (idDanhMuc !== 'all') {
        danhSachLoc = mangMonAn.filter(mon => mon.category_id === idDanhMuc);
    }

    if (danhSachLoc.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-slate-500 font-bold py-10 bg-white rounded-2xl border border-slate-100">Chưa có món ăn nào trong danh mục này.</div>`;
        return;
    }

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
        
        const btnHtml = isOutOfStock
            ? `<button disabled class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold cursor-not-allowed"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg></button>`
            : `<button data-id="${mon.id}" class="btn-add-cart w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold hover:bg-orange-500 hover:text-white transition-colors shadow-sm active:scale-95"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg></button>`;

        let tagsHtml = '';
        if (mon.tags && Array.isArray(mon.tags)) {
            tagsHtml = `<div class="flex flex-wrap gap-1 absolute top-3 left-3 z-10 pointer-events-none">` + 
                mon.tags.map((t: string) => `<span class="bg-white/90 backdrop-blur-sm text-slate-700 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-white/50">${t}</span>`).join('') + 
                `</div>`;
        }

        html += `
            <div class="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex flex-col hover:shadow-md transition-shadow group">
                ${badgeHtml}
                ${tagsHtml}
                <div class="h-40 overflow-hidden rounded-xl mb-3 bg-slate-100 relative cursor-pointer btn-open-detail" data-id="${mon.id}">
                    <img src="${mon.image}" alt="${mon.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : ''}">
                </div>
                <div class="flex flex-col flex-1">
                    <h3 class="text-base font-bold text-slate-800 leading-tight mb-1 line-clamp-2 cursor-pointer btn-open-detail" data-id="${mon.id}">${mon.name}</h3>
                    <p class="text-slate-400 text-xs line-clamp-2 mb-3 flex-1">${mon.description || 'Chưa có mô tả'}</p>
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
    const attachHandler = (selector: string, isQuickAdd: boolean) => {
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
                    
                    if (isQuickAdd && (!variants || variants.length === 0)) {
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

    attachHandler('.btn-add-cart', true);
    attachHandler('.btn-open-detail', false);
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
            groupVariants.forEach(v => {
                const priceHtml = v.extra_price > 0
                    ? `<span class="text-orange-600 font-black">+${v.extra_price.toLocaleString('vi-VN')} ₫</span>`
                    : '';
                    
                const inputType = isMultiple ? "checkbox" : "radio";
                const inputName = isMultiple ? `variant-${groupName}[]` : `variant-${groupName}`;
                const checkedState = (!isMultiple && firstRadio) ? 'checked' : '';
                
                html += `
                    <label class="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-colors bg-white">
                        <div class="flex items-center gap-3">
                            <input type="${inputType}" name="${inputName}" value="${v.id}" data-group="${groupName}" ${checkedState} class="variant-choice w-5 h-5 text-orange-500 focus:ring-orange-500 border-slate-300 rounded${isMultiple ? '' : '-full'}">
                            <span class="font-bold text-slate-700">${v.name}</span>
                        </div>
                        ${priceHtml}
                    </label>
                `;
                firstRadio = false;
            });
        });
        variantList.innerHTML = html;
    } else {
        variantSection.classList.add('hidden');
        variantList.innerHTML = '';
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
        displayHeader.innerText = tableName ? `Bàn: ${tableName}` : (tableId ? `Bàn: ${tableId}` : 'Chưa chọn bàn');
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
                <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
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
                <img src="${item.image}" class="w-16 h-16 rounded-xl object-cover shrink-0">
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
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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

// --- XÁC NHẬN ĐẶT MÓN (CHECKOUT) ---
document.getElementById('btn-checkout')?.addEventListener('click', async (e) => {
    const btnCheckout = e.currentTarget as HTMLButtonElement;

    // Đọc giỏ hàng TẠI THỜI ĐIỂM BẤM NÚT và sao chép ngay
    const cartSnapshot: CartItem[] = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    if (cartSnapshot.length === 0) return;

    const tableId = localStorage.getItem('restaurant_table');
    if (!tableId) {
        await showConfirmModal("Chú ý", "Bạn chưa chọn bàn! Vui lòng chọn bàn ở góc trên.");
        return;
    }

    const isConfirmed = await showConfirmModal("Xác nhận", `Gửi ${cartSnapshot.length} món vào bếp?`);
    if (!isConfirmed) return;

    // === XÓA GIỎ HÀNG NGAY LẬP TỨC (trước khi gọi API) ===
    // Mục đích: đảm bảo dù Live Server có reload trang thì giỏ cũng đã sạch
    localStorage.removeItem('restaurant_cart');

    // Cập nhật UI ngay lập tức
    const cartContainer = document.getElementById('cart-items-list');
    const totalContainer = document.getElementById('cart-total');
    const countContainer = document.getElementById('cart-count');
    if (cartContainer) {
        cartContainer.innerHTML = `
            <div class="h-full min-h-[300px] flex flex-col justify-center items-center text-slate-400">
                <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                <p class="font-bold text-slate-500">Đang gửi đơn...</p>
            </div>
        `;
    }
    if (totalContainer) totalContainer.innerText = '0 ₫';
    const totalMobileContainer = document.getElementById('cart-total-mobile');
    if (totalMobileContainer) totalMobileContainer.innerText = '0 ₫';
    if (countContainer) countContainer.innerText = '0 món';
    btnCheckout.disabled = true;
    btnCheckout.classList.replace('bg-orange-500', 'bg-slate-400');
    btnCheckout.classList.replace('hover:bg-orange-600', 'hover:bg-slate-400');
    btnCheckout.innerHTML = `Đang gửi... <svg class="w-5 h-5 animate-spin ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`;

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
            await capNhatTrangThaiBan(tableId, "Occupied");
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
                    order_id: orderId,
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

        // 3. Cập nhật tổng tiền
        await capNhatTongTienDonHang(orderId, currentTotal + tongTien);

        // 4. Thông báo thành công
        showSuccessToast(`Đặt ${cartSnapshot.length} món thành công!`);
        if (cartContainer) {
            cartContainer.innerHTML = `
                <div class="h-full min-h-[300px] flex flex-col justify-center items-center text-slate-400">
                    <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    <p class="font-bold text-slate-500">Giỏ hàng trống</p>
                    <p class="text-xs mt-1">Hãy chọn món ngon từ menu nhé!</p>
                </div>
            `;
        }
        btnCheckout.disabled = true;
        btnCheckout.classList.replace('bg-slate-400', 'bg-orange-500');
        btnCheckout.classList.replace('hover:bg-slate-400', 'hover:bg-orange-600');
        btnCheckout.innerHTML = `Xác nhận đặt món <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;

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

    } catch (error) {
        console.error("CHECKOUT ERROR:", error);
        // Nếu gặp lỗi, trả cart về như cũ để khách có thể thử lại
        localStorage.setItem('restaurant_cart', JSON.stringify(cartSnapshot));
        renderLiveCart();
        btnCheckout.disabled = false;
        btnCheckout.classList.replace('bg-slate-400', 'bg-orange-500');
        btnCheckout.classList.replace('hover:bg-slate-400', 'hover:bg-orange-600');
        btnCheckout.innerHTML = `Xác nhận đặt món <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
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
                return;
            }
            
            let html = '';
            details.forEach((item: any) => {
                const monObj = mangMonAn.find(m => m.id === item.menuItem_id);
                const name = monObj ? monObj.name : 'Món không rõ';
                const img = monObj ? monObj.image : '';
                
                let badge = '';
                if (item.status === 'Pending' || item.status === 'pending') badge = '<span class="bg-slate-100 text-slate-500 px-3 py-1 text-xs font-bold rounded-full">Chờ duyệt</span>';
                else if (item.status === 'Cooking' || item.status === 'cooking') badge = '<span class="bg-orange-100 text-orange-600 px-3 py-1 text-xs font-bold rounded-full">Đang nấu</span>';
                else if (item.status === 'Ready' || item.status === 'ready') badge = '<span class="bg-emerald-100 text-emerald-600 px-3 py-1 text-xs font-bold rounded-full">Đã nấu xong</span>';
                else if (item.status === 'Served' || item.status === 'served') badge = '<span class="bg-blue-100 text-blue-600 px-3 py-1 text-xs font-bold rounded-full">Đang dùng</span>';
                else badge = `<span class="bg-slate-100 text-slate-500 px-3 py-1 text-xs font-bold rounded-full">${item.status}</span>`;
                
                let notesText = item.notes ? `<p class="text-xs text-orange-500 mt-1 italic">${item.notes}</p>` : '';
                
                html += `
                    <div class="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                        <div class="flex items-center gap-3">
                            <img src="${img}" class="w-12 h-12 rounded-xl object-cover shrink-0">
                            <div>
                                <h4 class="font-bold text-sm text-slate-800">${name}</h4>
                                <p class="text-xs text-slate-500">Số lượng: <span class="font-black text-slate-700">${item.quantity}</span></p>
                                ${notesText}
                            </div>
                        </div>
                        <div class="shrink-0 text-right">
                            ${badge}
                            <p class="text-xs font-black text-orange-600 mt-2">${(item.priceAtOrder * item.quantity).toLocaleString('vi-VN')} ₫</p>
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

// --- KHỞI CHẠY TRANG ---
const khoiTaoTrang = async () => {
    await initTableSelection();
    initOrderHistory();
    renderLiveCart(); 
    mangIngredients = await layDanhSachIngredients();
    mangRecipes = await layDanhSachRecipes();
    mangMonAn = await layDanhSachMonAn();
    await hienThiDanhMuc();
    renderDanhSachMonAn('all');
};

khoiTaoTrang();

