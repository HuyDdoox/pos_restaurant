import { 
    layTatCaDonHang, 
    layDanhSachMonAn, 
    layDanhSachDanhMuc,
    taoMonAn,
    layDanhSachChiNhanh,
    xoaMonAn,
    suaMonAn,
    layDanhSachNguoiDung,
    layTatCaChiTietDon,
    unpackData
} from './api';
import { API_VARIANTS_URL, API_ORDER_DETAILS_URL } from './config';
import { initAdminUsers, loadUsers, setUserQuickFilter } from './admin_users';
import { initAdminMenu, loadMenuItems } from './admin_menu';
import { initInventoryModule } from './admin_inventory';
import { initAdminLoss, loadLossData, renderLossReportsTable } from './admin_loss';
import { initVariantRecipe } from './admin_variant_recipe';
import { initAdminReports, loadReportData, setReportPeriod } from './admin_reports';
import { initAdminPnl, updateAdminPnlReport } from './admin_pnl';
import { initAdminPromotions, loadVouchers, loadCustomers } from './admin_promotions';
import { initAdminAuditOps, loadAuditLogs, scanAndRenderLiveOpsAlerts } from './admin_audit_ops';
import { initAdminCategories, loadCategoriesData } from './admin_categories';
import { getCurrentUser, requireAuth, logout } from './auth';

// Kiểm tra bắt buộc đăng nhập với quyền Admin trước khi sử dụng Quản trị
const currentAuthUser = requireAuth(['Admin']);

declare var Chart: any;

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
const getOrderTotal = (order: any, details: any[]): number => {
    if (order.totalAmount && Number(order.totalAmount) > 0) return Number(order.totalAmount);
    const orderId = String(order.id || order._id);
    const items = details.filter(d => {
        const dOrderId = String(d.order_id?._id || d.order_id?.id || d.order_id);
        return dOrderId === orderId && d.status !== 'Cancelled';
    });
    return items.reduce((sum, it) => sum + (Number(it.priceAtOrder) || 0) * (Number(it.quantity) || 1), 0);
};

// Render Biểu đồ Doanh thu 7 ngày gần nhất động 100% từ dữ liệu thực tế MongoDB
const renderOverviewRevenueChart = (orders: any[], details: any[]) => {
    const canvas = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (!canvas || typeof Chart === 'undefined') return;

    const daysLabels: string[] = [];
    const dailyRevenues: number[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dStr = d.toDateString();
        const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        daysLabels.push(label);

        const dayOrders = orders.filter(o => {
            if (!o.createdAt) return false;
            return new Date(o.createdAt).toDateString() === dStr && (o.status === 'Completed' || o.paymentStatus === 'Paid');
        });

        const rev = dayOrders.reduce((sum, o) => sum + getOrderTotal(o, details), 0);
        dailyRevenues.push(rev);
    }

    if ((window as any)._overviewChart) {
        try {
            (window as any)._overviewChart.destroy();
        } catch (_) {}
    }

    (window as any)._overviewChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: daysLabels,
            datasets: [{
                label: 'Doanh thu (VNĐ)',
                data: dailyRevenues,
                backgroundColor: 'rgba(249, 115, 22, 0.7)',
                borderColor: 'rgba(249, 115, 22, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                    ticks: {
                        color: '#64748b',
                        callback: (v: number) => v.toLocaleString('vi-VN') + ' đ'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx: any) => ` Doanh thu: ${Number(ctx.raw || 0).toLocaleString('vi-VN')} đ`
                    }
                }
            }
        }
    });
};

// Render 2 bảng xem trước (Menu preview và Users preview) động 100% từ MongoDB
const renderOverviewPreviewTables = (menuItems: any[], users: any[]) => {
    // 1. Menu preview
    const menuTbody = document.getElementById('overview-menu-preview-tbody');
    if (menuTbody && menuItems.length > 0) {
        const top4Menu = menuItems.slice(0, 4);
        menuTbody.innerHTML = top4Menu.map(m => `
            <tr>
                <td class="py-3 flex items-center gap-2">
                    <img src="${m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}" loading="lazy" decoding="async" class="w-7 h-7 rounded-lg object-cover shrink-0 border border-slate-200" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'" />
                    <span class="truncate max-w-[120px] sm:max-w-none text-slate-800 font-bold">${m.name}</span>
                </td>
                <td class="py-3 text-slate-600 font-medium whitespace-nowrap">${Number(m.base_price || 0).toLocaleString('vi-VN')} đ</td>
                <td class="py-3 text-right">
                    <span class="${m.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'} px-2 py-0.5 rounded-full text-xs font-bold">
                        ${m.status === 'Available' ? 'Còn hàng' : 'Hết hàng'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // 2. Users preview
    const usersTbody = document.getElementById('overview-users-preview-tbody');
    if (usersTbody && users.length > 0) {
        const top4Users = users.slice(0, 4);
        const roleLabels: Record<string, string> = {
            'Admin': 'Quản trị viên',
            'Cashier': 'Thu ngân',
            'Waiter': 'Phục vụ',
            'Kitchen': 'Đầu bếp'
        };
        const roleColors: Record<string, string> = {
            'Admin': 'bg-orange-500',
            'Cashier': 'bg-blue-500',
            'Waiter': 'bg-purple-500',
            'Kitchen': 'bg-emerald-500'
        };

        usersTbody.innerHTML = top4Users.map(u => {
            const role = u.role || 'Staff';
            const roleName = roleLabels[role] || role;
            const bgClass = roleColors[role] || 'bg-slate-600';
            const displayName = u.fullname || u.username || 'User';
            const initials = displayName.split(' ').map((w: string) => w[0]).slice(-2).join('').toUpperCase() || 'U';
            const isOnline = u.status !== 'Locked';

            return `
                <tr>
                    <td class="py-3 flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full ${bgClass} flex items-center justify-center text-white font-bold text-xs shrink-0">${initials}</div>
                        <span class="truncate max-w-[120px] sm:max-w-none text-slate-800 font-bold">${displayName}</span>
                    </td>
                    <td class="py-3 text-slate-600 text-xs sm:text-sm font-medium whitespace-nowrap">${roleName}</td>
                    <td class="py-3 text-right">
                        <span class="${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'} px-2 py-0.5 rounded-full text-xs font-bold">
                            ${isOnline ? 'Online' : 'Khóa'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }
};

const loadDashboardStats = async (overrideBranchId?: string) => {
    try {
        const branchSelector = document.getElementById('branch-selector') as HTMLSelectElement;
        const branchId = overrideBranchId !== undefined ? overrideBranchId : (branchSelector ? branchSelector.value : '');
        
        // Hiện trạng thái Loading mờ nhẹ
        const revEl = document.getElementById('stat-revenue-amount');
        const weekRevEl = document.getElementById('stat-week-revenue');
        const ordEl = document.getElementById('stat-orders-count');
        const empEl = document.getElementById('stat-employees-count');
        const lossEl = document.getElementById('stat-loss-amount');
        const lossCountEl = document.getElementById('stat-loss-count');
        
        if (revEl) revEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (weekRevEl) weekRevEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (ordEl) ordEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (empEl) empEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        if (lossEl) lossEl.innerHTML = '<span class="opacity-50 animate-pulse">Đang tải...</span>';
        
        // Fetch Orders (Kèm branch_id nếu có)
        const rawOrders = await layTatCaDonHang(branchId);
        allOrders = Array.isArray(rawOrders) ? rawOrders : [];
        
        // Fetch OrderDetails
        const rawDetails = await layTatCaChiTietDon();
        allOrderDetails = Array.isArray(rawDetails) ? rawDetails : [];
        
        // Fetch Users (Kèm branch_id)
        const rawUsers = await layDanhSachNguoiDung(branchId);
        const users = Array.isArray(rawUsers) ? rawUsers : [];

        // Fetch Menu Items
        allMenuItems = await layDanhSachMonAn();
        
        const now = new Date();
        const isToday = (dateStr?: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.toDateString() === now.toDateString();
        };
        const isWithin7Days = (dateStr?: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            const diffDays = Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
        };

        // 1. Doanh thu hôm nay (Completed hoặc Paid)
        const todayOrders = allOrders.filter(o => isToday(o.createdAt));
        const todayCompleted = todayOrders.filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid');
        const todayRevenue = todayCompleted.reduce((sum, o) => sum + getOrderTotal(o, allOrderDetails), 0);

        // 2. Doanh thu tuần (7 ngày gần nhất)
        const weekOrders = allOrders.filter(o => isWithin7Days(o.createdAt));
        const weekCompleted = (weekOrders.length > 0 ? weekOrders : allOrders).filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid');
        const weekRevenue = weekCompleted.reduce((sum, o) => sum + getOrderTotal(o, allOrderDetails), 0);
            
        // 3. Tổng đơn hôm nay
        const orderCount = todayOrders.length > 0 ? todayOrders.length : allOrders.length;
        
        // 4. Nhân viên đang hoạt động
        const activeEmployees = users.filter((u: any) => u.status !== 'Locked');
            
        // 5. Tính Thất thoát
        const orderIds = allOrders.map(o => String(o.id || o._id));
        const branchOrderDetails = allOrderDetails.filter(d => {
            const dOrderId = String(d.order_id?._id || d.order_id?.id || d.order_id);
            return orderIds.includes(dOrderId);
        });
        const lossDetails = branchOrderDetails.filter(d => d.status === 'Cancelled' && d.incidentNote);
        let totalLoss = 0;
        lossDetails.forEach(d => {
            const price = Number(d.priceAtOrder) || 0; // Giá lúc order, nếu = 0 nghĩa là hàng remake
            if (price > 0) {
                totalLoss += price * (Number(d.quantity) || 1);
            }
        });
        
        // Cập nhật DOM
        if (revEl) revEl.innerHTML = `${todayRevenue.toLocaleString('vi-VN')} <span class="text-xs sm:text-sm font-bold text-slate-300 ml-1">đ</span>`;
        if (weekRevEl) weekRevEl.innerHTML = `${weekRevenue.toLocaleString('vi-VN')} <span class="text-xs sm:text-sm font-bold text-slate-300 ml-1">đ</span>`;
        if (ordEl) ordEl.innerHTML = `${orderCount}`;
        if (empEl) empEl.innerHTML = `${activeEmployees.length}`;
        if (lossEl) lossEl.innerHTML = `${totalLoss.toLocaleString('vi-VN')} <span class="text-xs sm:text-sm font-bold text-slate-300 ml-1">đ</span>`;
        if (lossCountEl) lossCountEl.innerText = `${lossDetails.length} món bị hủy`;
        
        // Render dynamic chart & preview tables
        renderOverviewRevenueChart(allOrders, allOrderDetails);
        renderOverviewPreviewTables(allMenuItems, users);

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
            loadReportData(selectedBranchId);
        });

        // Xây dựng Custom Dropdown HTML
        let optionsHtml = `<button data-value="" class="branch-option w-full text-left px-4 py-3 rounded-lg text-sm font-bold text-orange-500 bg-orange-500/10 hover:bg-slate-700/50 transition-colors flex items-center justify-between mb-1">Toàn hệ thống <i class="fa-solid fa-circle-info text-sm"></i></button>`;
        
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
                    if (!el.querySelector('svg')) el.innerHTML += ` <i class="fa-solid fa-circle-info text-sm"></i>`;
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

// ==========================================
// ĐIỀU HƯỚNG & TƯƠNG TÁC CLICK 5 STAT CARDS TỔNG QUAN
// ==========================================
const navigateToPage = (pageId: string) => {
    if (typeof (window as any).switchPage === 'function') {
        (window as any).switchPage(pageId);
    } else {
        window.location.hash = `#${pageId}`;
    }
};

const initOverviewInteractions = () => {
    // 1. Card Doanh thu hôm nay -> Chuyển sang Báo cáo chu kỳ "Hôm nay"
    const cardRevToday = document.getElementById('card-stat-revenue-today');
    if (cardRevToday) {
        const handleClick = () => {
            navigateToPage('reports');
            setReportPeriod('today');
        };
        cardRevToday.addEventListener('click', handleClick);
        cardRevToday.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        });
    }

    // 2. Card Doanh thu tuần -> Chuyển sang Báo cáo chu kỳ "7 ngày qua"
    const cardRevWeek = document.getElementById('card-stat-revenue-week');
    if (cardRevWeek) {
        const handleClick = () => {
            navigateToPage('reports');
            setReportPeriod('7days');
        };
        cardRevWeek.addEventListener('click', handleClick);
        cardRevWeek.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        });
    }

    // 3. Card Tổng đơn hôm nay -> Chuyển sang Báo cáo xem đơn hôm nay
    const cardOrdersToday = document.getElementById('card-stat-orders-today');
    if (cardOrdersToday) {
        const handleClick = () => {
            navigateToPage('reports');
            setReportPeriod('today');
        };
        cardOrdersToday.addEventListener('click', handleClick);
        cardOrdersToday.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        });
    }

    // 4. Card Nhân viên đang làm -> Chuyển sang Người dùng & kích hoạt lọc "Đang online"
    const cardEmployees = document.getElementById('card-stat-employees-active');
    if (cardEmployees) {
        const handleClick = () => {
            navigateToPage('users');
            setTimeout(() => {
                setUserQuickFilter('online');
            }, 60);
        };
        cardEmployees.addEventListener('click', handleClick);
        cardEmployees.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        });
    }

    // 5. Card Thất thoát (Sự cố) -> Chuyển sang Báo cáo sự cố / Thất thoát
    const cardLoss = document.getElementById('card-stat-loss-incident');
    if (cardLoss) {
        const handleClick = () => {
            navigateToPage('loss-report');
        };
        cardLoss.addEventListener('click', handleClick);
        cardLoss.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        });
    }

    // Nút "Xuất báo cáo" trên biểu đồ doanh thu tổng quan
    const btnQuickReport = document.getElementById('btn-quick-export-report');
    if (btnQuickReport) {
        btnQuickReport.addEventListener('click', () => {
            navigateToPage('reports');
            setReportPeriod('7days');
        });
    }
};

window.addEventListener('DOMContentLoaded', () => {
    initBranchSelector();
    initAdminUsers(); // Khởi tạo trang quản lý người dùng
    loadDashboardStats();
    scanAndRenderLiveOpsAlerts(); // Khởi tạo quét cảnh báo vận hành trực tiếp
    initOverviewInteractions(); // Tương tác click 5 thẻ KPI
    initAdminReports(); // Khởi tạo trang báo cáo
    initAdminPnl(); // Khởi tạo trang Báo cáo Tài chính & Lợi nhuận P&L
    initAdminMenu();
    initAdminCategories();
    initAdminLoss();
    loadLossData(); // Tải sẵn dữ liệu thất thoát ngay từ đầu
    initVariantRecipe();
    initTableSorting();
    initAdminPromotions(); // Khởi tạo Quản lý Khuyến mãi & VIP Loyalty
    initAdminAuditOps(); // Khởi tạo Nhật ký kiểm toán & Live Ops

    // Kích hoạt nạp dữ liệu cho trang hiện tại nếu người dùng truy cập trực tiếp qua Hash URL
    const currentHash = window.location.hash.replace('#', '') || 'overview';
    if (currentHash && currentHash !== 'overview') {
        window.dispatchEvent(new CustomEvent('pageChanged', { detail: currentHash }));
    }
});

// Bắt sự kiện chuyển page từ file HTML (nếu window dispatch event)
window.addEventListener('pageChanged', (e: any) => {
    const pageId = e.detail;
    if (pageId === 'overview') {
        loadDashboardStats();
        scanAndRenderLiveOpsAlerts();
    }
    if (pageId === 'reports') loadReportData();
    if (pageId === 'pnl') updateAdminPnlReport();
    if (pageId === 'menu') loadMenuItems();
    if (pageId === 'categories') loadCategoriesData();
    if (pageId === 'users') loadUsers();
    if (pageId === 'inventory') initInventoryModule();
    if (pageId === 'promotions') {
        loadVouchers();
        loadCustomers();
    }
    if (pageId === 'audit-log') {
        loadAuditLogs();
    }
    // loss-report được xử lý trong initAdminLoss()
});
