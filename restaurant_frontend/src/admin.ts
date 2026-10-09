import { 
    layTatCaDonHang, 
    layDanhSachMonAn, 
    layDanhSachDanhMuc,
    taoMonAn,
    layDanhSachChiNhanh,
    xoaMonAn,
    suaMonAn,
    layDanhSachNguoiDung
} from './api';
import { API_VARIANTS_URL, API_ORDER_DETAILS_URL } from './config';
import { initAdminUsers, loadUsers } from './admin_users';
import { initAdminMenu, loadMenuItems } from './admin_menu';
import './admin_inventory';
import { initAdminLoss, loadLossData, renderLossReportsTable } from './admin_loss';
import { initVariantRecipe } from './admin_variant_recipe';

// Khai báo kiểu (Type Casting)
let allOrders: any[] = [];
let allOrderDetails: any[] = [];
let allMenuItems: any[] = [];
let allCategories: any[] = [];

// ==========================================
// 0. RBAC (QUẢN LÝ QUYỀN TRUY CẬP)
// ==========================================
const checkPermission = (resource: string, action: string) => {
    const userStr = localStorage.getItem('currentUser') || localStorage.getItem('user');
    // Mặc định lấy U001 Admin để test nếu chưa login
    const user = userStr ? JSON.parse(userStr) : { id: 'U001', role: 'Admin' };
    
    // Admin có toàn quyền
    if (user.role === 'Admin') return true;
    
    // Các quy tắc khác
    if (user.role === 'Cashier' && resource === 'MenuItems' && action === 'read') return true;
    if (user.role === 'Cashier' && resource === 'MenuItems' && action === 'update') return false;
    
    // Mặc định từ chối
    return false;
};

// ==========================================
// 1. DASHBOARD LOGIC (TỔNG QUAN)
// ==========================================
const loadDashboardStats = async (overrideBranchId?: string) => {
    try {
        const branchSelector = document.getElementById('branch-selector') as HTMLSelectElement;
        const branchId = overrideBranchId !== undefined ? overrideBranchId : (branchSelector ? branchSelector.value : '');
        
        // Hiện trạng thái Loading mờ nhẹ
        const revEl = document.getElementById('stat-revenue-amount');
        const ordEl = document.getElementById('stat-orders-count');
        const empEl = document.getElementById('stat-employees-count');
        const lossEl = document.getElementById('stat-loss-amount');
        const lossCountEl = document.getElementById('stat-loss-count');
        
        if (revEl) revEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (ordEl) ordEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (empEl) empEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (lossEl) lossEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        
        // Fetch Orders (Kèm branch_id nếu có)
        allOrders = await layTatCaDonHang(branchId);
        
        // Fetch OrderDetails
        const detailsRes = await fetch(API_ORDER_DETAILS_URL);
        allOrderDetails = await detailsRes.json();
        
        // Fetch Users (Kèm branch_id)
        const users = await layDanhSachNguoiDung(branchId);
        
        // 1. Tính Doanh thu (Completed hoặc Paid)
        const totalRevenue = allOrders
            .filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid')
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            
        // 2. Tổng đơn hàng
        const orderCount = allOrders.length;
        
        // 3. Nhân viên đang hoạt động
        const activeEmployees = users.filter((u: any) => u.status !== 'Locked');
            
        // 4. Tính Thất thoát
        const orderIds = allOrders.map(o => o.id);
        const branchOrderDetails = allOrderDetails.filter(d => orderIds.includes(d.order_id));
        const lossDetails = branchOrderDetails.filter(d => d.status === 'Cancelled' && d.incidentNote);
        let totalLoss = 0;
        lossDetails.forEach(d => {
            const price = d.priceAtOrder || 0; // Giá lúc order, nếu = 0 nghĩa là hàng remake
            if (price > 0) {
                totalLoss += price * d.quantity;
            }
        });
        
        // Cập nhật DOM
        if (revEl) revEl.innerHTML = `${totalRevenue.toLocaleString('vi-VN')} <span class="text-lg font-bold">đ</span>`;
        if (ordEl) ordEl.innerHTML = `${orderCount}`;
        if (empEl) empEl.innerHTML = `${activeEmployees.length}`;
        if (lossEl) lossEl.innerHTML = `${totalLoss.toLocaleString('vi-VN')} <span class="text-lg font-bold">đ</span>`;
        if (lossCountEl) lossCountEl.innerText = `${lossDetails.length} món bị hủy`;
        
    } catch (e) {
        console.error("Lỗi khi load Dashboard:", e);
    }
};

// ==========================================
// GLOBAL INITIALIZATION
// ==========================================
const initBranchSelector = async () => {
    try {
        const branches = await layDanhSachChiNhanh();
        const branchSelectorContainer = document.getElementById('custom-branch-dropdown');
        if(!branchSelectorContainer) return;
        
        const btn = document.getElementById('custom-branch-btn');
        const label = document.getElementById('custom-branch-label');
        const menu = document.getElementById('custom-branch-menu');
        const branchSelectorHidden = document.getElementById('branch-selector') as HTMLSelectElement;
        
        if (!btn || !label || !menu || !branchSelectorHidden) return;
        
        // Cập nhật Hidden Select (dùng cho logic hiện tại của các file khác)
        branchSelectorHidden.innerHTML = '<option value="">Toàn hệ thống</option>' + 
            branches.map((b: any) => `<option value="${b.id}">${b.name}</option>`).join('');
            
        branchSelectorHidden.addEventListener('change', () => {
            const selectedBranchId = branchSelectorHidden.value;
            loadDashboardStats(selectedBranchId);
        });

        // Xây dựng Custom Dropdown HTML
        let optionsHtml = `<button data-value="" class="branch-option w-full text-left px-4 py-3 rounded-lg text-sm font-bold text-orange-500 bg-orange-500/10 hover:bg-slate-700/50 transition-colors flex items-center justify-between mb-1">Toàn hệ thống <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></button>`;
        
        branches.forEach((b: any) => {
            optionsHtml += `<button data-value="${b.id}" class="branch-option w-full text-left px-4 py-3 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors mb-1 last:mb-0">${b.name}</button>`;
        });
        
        menu.innerHTML = optionsHtml;
        
        // Mở / Đóng Menu
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = menu.classList.contains('hidden');
            if (isHidden) {
                menu.classList.remove('hidden');
                setTimeout(() => {
                    menu.classList.remove('opacity-0', 'scale-95');
                    menu.classList.add('opacity-100', 'scale-100');
                }, 10);
            } else {
                menu.classList.remove('opacity-100', 'scale-100');
                menu.classList.add('opacity-0', 'scale-95');
                setTimeout(() => menu.classList.add('hidden'), 200);
            }
        });
        
        // Đóng Menu khi click ra ngoài
        document.addEventListener('click', () => {
            if (!menu.classList.contains('hidden')) {
                menu.classList.remove('opacity-100', 'scale-100');
                menu.classList.add('opacity-0', 'scale-95');
                setTimeout(() => menu.classList.add('hidden'), 200);
            }
        });
        
        // Xử lý khi chọn Option
        menu.addEventListener('click', (e) => {
            const target = (e.target as HTMLElement).closest('.branch-option') as HTMLElement;
            if (!target) return;
            
            const selectedBranchId = target.getAttribute('data-value') || '';
            const selectedText = target.innerText;
            
            // Cập nhật nhãn của button
            label.innerText = selectedText;
            
            // Cập nhật style Option đang chọn
            menu.querySelectorAll('.branch-option').forEach(el => {
                if (el === target) {
                    el.className = 'branch-option w-full text-left px-4 py-3 rounded-lg text-sm font-bold text-orange-500 bg-orange-500/10 hover:bg-slate-700/50 transition-colors flex items-center justify-between mb-1 last:mb-0';
                    if (!el.querySelector('svg')) el.innerHTML += ` <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
                } else {
                    el.className = 'branch-option w-full text-left px-4 py-3 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors mb-1 last:mb-0';
                    const svg = el.querySelector('svg');
                    if(svg) svg.remove();
                }
            });
            
            // Gán giá trị vào Hidden Select và trigger event change
            branchSelectorHidden.value = selectedBranchId;
            branchSelectorHidden.dispatchEvent(new Event('change'));
        });

    } catch (e) {
        console.error("Lỗi khởi tạo chọn chi nhánh:", e);
    }
};

// ==========================================
// THÊM CHỨC NĂNG SORT CHO TẤT CẢ CÁC BẢNG
// ==========================================
const initTableSorting = () => {
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const th = target.tagName === 'TH' ? target : target.closest('th');
        if (!th) return;
        
        const table = th.closest('table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        if (!th.textContent?.trim() || th.textContent?.trim().toLowerCase() === 'thao tác') return;

        const tr = th.parentElement;
        if (!tr) return;
        
        const ArrayOfTh = Array.from(tr.children) as HTMLElement[];
        const index = ArrayOfTh.indexOf(th);
        
        const isAscending = th.dataset.sortDir !== 'asc';
        
        ArrayOfTh.forEach(header => {
            header.dataset.sortDir = '';
            const existingSortIcon = header.querySelector('.sort-icon');
            if (existingSortIcon) existingSortIcon.remove();
        });
        
        th.dataset.sortDir = isAscending ? 'asc' : 'desc';
        const sortSpan = document.createElement('span');
        sortSpan.className = 'sort-icon ml-1 text-orange-500 font-bold';
        sortSpan.innerText = isAscending ? ' ↑' : ' ↓';
        th.appendChild(sortSpan);
        
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
            const cellA = (a.children[index]?.textContent || '').trim();
            const cellB = (b.children[index]?.textContent || '').trim();
            
            const numA = parseFloat(cellA.replace(/[^0-9.-]+/g, ""));
            const numB = parseFloat(cellB.replace(/[^0-9.-]+/g, ""));
            
            const isNumA = !isNaN(numA) && /[0-9]/.test(cellA);
            const isNumB = !isNaN(numB) && /[0-9]/.test(cellB);
            
            if (isNumA && isNumB) {
                return isAscending ? numA - numB : numB - numA;
            }
            
            return isAscending ? cellA.localeCompare(cellB, 'vi', { numeric: true }) : cellB.localeCompare(cellA, 'vi', { numeric: true });
        });
        
        rows.forEach(row => tbody.appendChild(row));
    });
    
    const addPointers = () => {
        document.querySelectorAll('th').forEach(th => {
            if (th.textContent?.trim() && th.textContent?.trim().toLowerCase() !== 'thao tác') {
                th.style.cursor = 'pointer';
                th.title = "Click để sắp xếp";
            }
        });
    };
    addPointers();
    
    const observer = new MutationObserver(addPointers);
    observer.observe(document.body, { childList: true, subtree: true });
};

window.addEventListener('DOMContentLoaded', () => {
    initBranchSelector();
    initAdminUsers(); // Khởi tạo trang quản lý người dùng
    loadDashboardStats();
    initAdminMenu();
    initAdminLoss();
    loadLossData(); // Tải sẵn dữ liệu thất thoát ngay từ đầu
    initVariantRecipe();
    initTableSorting();
});

// Bắt sự kiện chuyển page từ file HTML (nếu window dispatch event)
window.addEventListener('pageChanged', (e: any) => {
    const pageId = e.detail;
    if (pageId === 'overview') loadDashboardStats();
    if (pageId === 'menu') loadMenuItems();
    if (pageId === 'users') loadUsers();
    // loss-report được xử lý trong initAdminLoss()
});
