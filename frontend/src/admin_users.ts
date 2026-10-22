import { showConfirmModal } from './utils/ui';
import { API_USERS_URL } from './config';

export interface IUser {
    id: string;
    fullname?: string;
    name?: string;     
    username?: string;
    email?: string;
    role: string;
    status: string;
    branch_id?: string;
    lock_reason?: string;
}

let allUsers: IUser[] = [];
let filteredUsers: IUser[] = [];
let currentFilterRole = 'All';
let currentSearchTerm = '';
let currentFilterBranch = '';
let currentQuickFilter: 'total' | 'online' | 'admin' | 'locked' = 'total';
let currentFilterStatus: 'All' | 'Active' | 'Locked' = 'All';
const USERS_PAGE_SIZE = 8;
let currentRenderedUsersCount = 0;
let userSentinelObserver: IntersectionObserver | null = null;
let userToLockId: string | null = null;

// ==========================================
// 1. KHỞI TẠO & LẤY DỮ LIỆU
// ==========================================
export const initAdminUsers = async () => {
    setupEventListeners();
    await fetchAndRenderUsers();
};

const setupEventListeners = () => {
    // 1. Lắng nghe click trên 4 Stat Cards
    const statCardsContainer = document.getElementById('user-stat-cards');
    if (statCardsContainer) {
        statCardsContainer.addEventListener('click', (e) => {
            const card = (e.target as HTMLElement).closest('.user-stat-card') as HTMLElement;
            if (!card) return;
            
            const filterType = card.getAttribute('data-filter') as 'total' | 'online' | 'admin' | 'locked';
            if (!filterType) return;
            
            handleQuickFilterClick(filterType);
        });

        // Hỗ trợ bàn phím (Accessibility)
        statCardsContainer.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = (e.target as HTMLElement).closest('.user-stat-card') as HTMLElement;
                if (card) {
                    e.preventDefault();
                    card.click();
                }
            }
        });
    }

    // 1b. Lắng nghe sự kiện cuộn trang để tự động Lazy Load người dùng
    const mainEl = document.querySelector('main');
    const scrollTarget = mainEl || window;
    scrollTarget.addEventListener('scroll', () => {
        const sentinel = document.getElementById('users-lazy-sentinel');
        if (!sentinel) return;
        const rect = sentinel.getBoundingClientRect();
        if (rect.top <= window.innerHeight + 250) {
            renderNextUsersBatch();
        }
    }, { passive: true });

    // 2. Tìm kiếm
    const searchInput = document.getElementById('search-user') as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
            applyFilters();
        });
    }

    // 3. Lọc theo Role Tabs
    const tabRoles = document.getElementById('tab-roles');
    if (tabRoles) {
        tabRoles.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.tab-role-btn') as HTMLElement;
            if (!btn) return;

            const selectedRole = btn.getAttribute('data-role') || 'All';
            syncRoleTabsUI(selectedRole);
            
            currentFilterRole = selectedRole;
            // Nếu đang chọn card Admin mà người dùng click tab role khác
            if (currentQuickFilter === 'admin' && selectedRole !== 'Admin') {
                currentQuickFilter = 'total';
            } else if (selectedRole === 'Admin' && currentQuickFilter === 'total') {
                currentQuickFilter = 'admin';
            }
            
            updateCardStyles();
            applyFilters();
        });
    }

    // 4. Lắng nghe sự kiện đổi chi nhánh từ Header (id="branch-selector")
    const branchSelector = document.getElementById('branch-selector') as HTMLSelectElement;
    if (branchSelector) {
        currentFilterBranch = branchSelector.value;
        branchSelector.addEventListener('change', () => {
            currentFilterBranch = branchSelector.value;
            applyFilters();
        });
    }

    // 5. Event Delegation trên Tbody cho nút Khóa/Mở Khóa
    const tableBody = document.getElementById('users-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const toggleBtn = target.closest('.btn-toggle-status') as HTMLElement;
            
            if (toggleBtn) {
                const id = toggleBtn.getAttribute('data-id');
                const currentStatus = toggleBtn.getAttribute('data-status');
                if (id && currentStatus) {
                    if (currentStatus === 'Active') {
                        userToLockId = id;
                        const modal = document.getElementById('lock-user-modal');
                        const reasonSelect = document.getElementById('lock-reason-select') as HTMLSelectElement;
                        const reasonNote = document.getElementById('lock-reason-note') as HTMLTextAreaElement;
                        if (modal && reasonSelect && reasonNote) {
                            reasonSelect.value = 'Nghỉ việc';
                            reasonNote.value = '';
                            modal.classList.remove('hidden');
                            setTimeout(() => {
                                modal.classList.remove('opacity-0');
                                const content = modal.querySelector('div');
                                if (content) content.classList.remove('scale-95');
                            }, 10);
                        }
                    } else {
                        await toggleUserStatus(id, currentStatus, '');
                    }
                }
            }
        });
    }

    // 6. Logic xử lý Modal Khóa Tài Khoản
    const lockModal = document.getElementById('lock-user-modal');
    const btnCancelLock = document.getElementById('btn-cancel-lock');
    const btnConfirmLock = document.getElementById('btn-confirm-lock');
    const reasonSelect = document.getElementById('lock-reason-select') as HTMLSelectElement;
    const reasonNote = document.getElementById('lock-reason-note') as HTMLTextAreaElement;

    const closeLockModal = () => {
        if (!lockModal) return;
        lockModal.classList.add('opacity-0');
        const content = lockModal.querySelector('div');
        if (content) content.classList.add('scale-95');
        setTimeout(() => lockModal.classList.add('hidden'), 200);
        userToLockId = null;
    };

    if (btnCancelLock) {
        btnCancelLock.addEventListener('click', closeLockModal);
    }

    if (btnConfirmLock) {
        btnConfirmLock.addEventListener('click', async () => {
            if (!userToLockId) return;
            const selectValue = reasonSelect.value;
            const note = reasonNote.value.trim();
            const reason = note ? `${selectValue} - ${note}` : selectValue;
            
            await toggleUserStatus(userToLockId, 'Active', reason);
            closeLockModal();
        });
    }
};

export const setUserQuickFilter = (filterType: 'total' | 'online' | 'admin' | 'locked') => {
    currentQuickFilter = filterType;
    if (filterType === 'total') {
        currentFilterStatus = 'All';
        currentFilterRole = 'All';
        syncRoleTabsUI('All');
    } else if (filterType === 'online') {
        currentFilterStatus = 'Active';
    } else if (filterType === 'admin') {
        currentFilterStatus = 'All';
        currentFilterRole = 'Admin';
        syncRoleTabsUI('Admin');
    } else if (filterType === 'locked') {
        currentFilterStatus = 'Locked';
    }
    updateCardStyles();
    applyFilters();
};

const handleQuickFilterClick = (filterType: 'total' | 'online' | 'admin' | 'locked') => {
    // Nếu click lại card đang active (ngoại trừ total) -> toggle về total
    if (currentQuickFilter === filterType && filterType !== 'total') {
        setUserQuickFilter('total');
    } else {
        setUserQuickFilter(filterType);
    }
};

const syncRoleTabsUI = (role: string) => {
    const tabRoles = document.getElementById('tab-roles');
    if (!tabRoles) return;
    tabRoles.querySelectorAll('.tab-role-btn').forEach(el => {
        const r = el.getAttribute('data-role');
        if (r === role) {
            el.classList.remove('bg-transparent', 'text-slate-600', 'text-slate-400');
            el.classList.add('bg-orange-500', 'text-white', 'shadow-md');
        } else {
            el.classList.remove('bg-orange-500', 'text-white', 'shadow-md');
            el.classList.add('bg-transparent', 'text-slate-600');
        }
    });
};

const updateCardStyles = () => {
    const cardDefs = [
        { id: 'card-filter-total', type: 'total', activeBorder: 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/70 shadow-sm' },
        { id: 'card-filter-online', type: 'online', activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/70 shadow-sm' },
        { id: 'card-filter-admin', type: 'admin', activeBorder: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/70 shadow-sm' },
        { id: 'card-filter-locked', type: 'locked', activeBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/70 shadow-sm' },
    ];

    cardDefs.forEach(c => {
        const el = document.getElementById(c.id);
        if (!el) return;
        const dot = el.querySelector('.card-active-dot') as HTMLElement;
        const isActive = currentQuickFilter === c.type;

        el.className = 'user-stat-card cursor-pointer rounded-2xl p-5 border shadow-sm flex items-center justify-between gap-4 transition-all duration-200 hover:scale-105 active:scale-95 select-none group ' + 
            (isActive ? c.activeBorder : 'bg-white border-slate-200 hover:border-slate-400');
        
        if (dot) {
            if (isActive) dot.classList.remove('hidden');
            else dot.classList.add('hidden');
        }
    });
};

const fetchAndRenderUsers = async () => {
    try {
        const response = await fetch(API_USERS_URL);
        if (!response.ok) throw new Error("Lỗi khi tải dữ liệu người dùng");
        const resJson = await response.json();
        allUsers = Array.isArray(resJson) ? resJson : (resJson.data || []);
        
        updateCardStyles();
        applyFilters();
    } catch (error) {
        console.error("Lỗi fetch users:", error);
    }
};

// ==========================================
// 2. CẬP NHẬT THỐNG KÊ (CARDS)
// ==========================================
const updateDashboardCards = () => {
    // Thống kê theo chi nhánh được chọn (hoặc toàn hệ thống)
    const branchUsers = currentFilterBranch === '' 
        ? allUsers 
        : allUsers.filter(u => u.branch_id === currentFilterBranch);

    const totalUsers = branchUsers.length;
    const onlineUsers = branchUsers.filter(u => u.status !== 'Locked').length;
    const adminUsers = branchUsers.filter(u => u.role === 'Admin').length;
    const lockedUsers = branchUsers.filter(u => u.status === 'Locked').length;

    const elTotal = document.getElementById('stat-total-users');
    const elOnline = document.getElementById('stat-online-users');
    const elAdmin = document.getElementById('stat-admin-users');
    const elLocked = document.getElementById('stat-locked-users');

    if (elTotal) elTotal.innerText = totalUsers.toString();
    if (elOnline) elOnline.innerText = onlineUsers.toString();
    if (elAdmin) elAdmin.innerText = adminUsers.toString();
    if (elLocked) elLocked.innerText = lockedUsers.toString();
};

let userSortCol = '';
let userSortDir: 'asc' | 'desc' = 'asc';

const setupUserSorting = () => {
    document.querySelectorAll('th[data-user-sort]').forEach(th => {
        if (th.getAttribute('data-sort-bound')) return;
        th.setAttribute('data-sort-bound', 'true');
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-user-sort') || '';
            if (userSortCol === col) {
                userSortDir = userSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                userSortCol = col;
                userSortDir = 'asc';
            }

            document.querySelectorAll('th[data-user-sort] i').forEach(icon => {
                icon.className = 'fa-solid fa-sort text-[10px] ml-1 opacity-60';
            });
            const curIcon = th.querySelector('i');
            if (curIcon) {
                curIcon.className = `fa-solid fa-sort-${userSortDir === 'asc' ? 'up text-orange-600' : 'down text-orange-600'} text-[11px] ml-1`;
            }

            applyFilters();
        });
    });
};

const applyFilters = () => {
    filteredUsers = allUsers.filter(user => {
        const name = (user.name || user.fullname || '').toLowerCase();
        const email = (user.email || user.username || '').toLowerCase();
        const id = (user.id || '').toLowerCase();
        
        const matchesSearch = name.includes(currentSearchTerm) || email.includes(currentSearchTerm) || id.includes(currentSearchTerm);
        const matchesRole = currentFilterRole === 'All' || user.role === currentFilterRole;
        const matchesBranch = currentFilterBranch === '' || user.branch_id === currentFilterBranch;
        
        // Lọc trạng thái từ Stat Card đã click
        const isActive = user.status !== 'Locked';
        let matchesStatus = true;
        if (currentFilterStatus === 'Active') {
            matchesStatus = isActive;
        } else if (currentFilterStatus === 'Locked') {
            matchesStatus = !isActive;
        }
        
        return matchesSearch && matchesRole && matchesBranch && matchesStatus;
    });

    if (userSortCol) {
        filteredUsers.sort((a: any, b: any) => {
            let valA = a[userSortCol === 'role' ? 'role' : (userSortCol === 'status' ? 'status' : 'fullname')] || a.name || '';
            let valB = b[userSortCol === 'role' ? 'role' : (userSortCol === 'status' ? 'status' : 'fullname')] || b.name || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return userSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return userSortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    updateDashboardCards();
    renderTable();
};

// ==========================================
// 3. RENDER BẢNG & LAZY LOADING (KHÔNG CHUYỂN TRANG)
// ==========================================
const createUserRowHtml = (user: IUser): string => {
    const fullName = user.fullname || user.name || 'Không tên';
    const userName = user.username || user.email || 'Không có email';
    const isActive = user.status !== 'Locked';

    const roleBadge = getRoleBadge(user.role);
    const roleInitial = getRoleInitialBadge(user.role, fullName);
    
    const statusBadge = isActive 
        ? `<span class="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-black border border-emerald-500/30"><span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>Active</span>`
        : `<span class="inline-flex items-center gap-1.5 bg-slate-700/50 text-slate-400 px-3 py-1 rounded-full text-xs font-black border border-slate-600"><span class="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>Locked</span>`;
        
    const opacityClass = isActive ? '' : 'opacity-50 grayscale-[50%]';

    return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-0 ${opacityClass}">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    ${roleInitial}
                    <div>
                        <p class="font-bold text-slate-900 whitespace-nowrap">${fullName}</p>
                        <p class="text-xs text-slate-500 whitespace-nowrap">${userName} • <span class="font-mono text-slate-400">#${user.id}</span></p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${roleBadge}</td>
            <td class="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">Theo ca</td>
            <td class="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">Vừa xong</td>
            <td class="px-6 py-4 text-center whitespace-nowrap">${statusBadge}</td>
            <td class="px-6 py-4 text-center whitespace-nowrap">
                <button data-id="${user.id}" data-status="${user.status || 'Active'}" 
                    class="btn-toggle-status w-8 h-8 rounded-xl ${isActive ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200'} inline-flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95" 
                    title="${isActive ? 'Khóa tài khoản ' + fullName : 'Mở khóa tài khoản ' + fullName}">
                    <i class="fa-solid ${isActive ? 'fa-lock' : 'fa-lock-open'} text-xs"></i>
                </button>
            </td>
        </tr>
    `;
};

const renderNextUsersBatch = () => {
    const tbody = document.getElementById('users-table-body');
    if (!tbody || currentRenderedUsersCount >= filteredUsers.length) return;

    // Gỡ sentinel cũ
    const oldSentinel = document.getElementById('users-lazy-sentinel');
    if (oldSentinel) oldSentinel.remove();

    const batch = filteredUsers.slice(currentRenderedUsersCount, currentRenderedUsersCount + USERS_PAGE_SIZE);
    currentRenderedUsersCount += batch.length;

    const rowsHtml = batch.map(u => createUserRowHtml(u)).join('');
    tbody.insertAdjacentHTML('beforeend', rowsHtml);

    updatePaginationInfo();

    // Thêm sentinel nếu vẫn còn người dùng chưa render
    if (currentRenderedUsersCount < filteredUsers.length) {
        const sentinel = document.createElement('tr');
        sentinel.id = 'users-lazy-sentinel';
        sentinel.className = 'cursor-pointer hover:bg-slate-50 transition-colors';
        sentinel.innerHTML = `
            <td colspan="7" class="px-6 py-4 text-center text-xs text-slate-500 font-bold bg-slate-50">
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700">
                    <i class="fa-solid fa-spinner fa-spin text-orange-500 text-xs"></i>
                    <span>Đang cuộn tải thêm (${currentRenderedUsersCount}/${filteredUsers.length} tài khoản)...</span>
                </div>
            </td>
        `;
        tbody.appendChild(sentinel);

        sentinel.addEventListener('click', () => {
            renderNextUsersBatch();
        });

        if (!userSentinelObserver) {
            userSentinelObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    renderNextUsersBatch();
                }
            }, { 
                root: null,
                rootMargin: '160px', 
                threshold: 0.05 
            });
        }
        userSentinelObserver.disconnect();
        userSentinelObserver.observe(sentinel);
    } else {
        if (userSentinelObserver) {
            userSentinelObserver.disconnect();
        }
    }
};

const renderTable = () => {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    setupUserSorting();

    if (userSentinelObserver) {
        userSentinelObserver.disconnect();
    }

    tbody.innerHTML = '';
    currentRenderedUsersCount = 0;
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center text-slate-500 font-bold">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i class="fa-solid fa-user-slash text-3xl text-slate-600"></i>
                        <p class="text-slate-400">Không tìm thấy tài khoản nào phù hợp bộ lọc</p>
                        <button type="button" id="btn-reset-user-filters" class="mt-2 text-xs text-orange-400 hover:text-orange-300 underline font-semibold cursor-pointer">
                            Xóa bộ lọc để xem tất cả
                        </button>
                    </div>
                </td>
            </tr>
        `;
        const btnReset = document.getElementById('btn-reset-user-filters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                currentQuickFilter = 'total';
                currentFilterRole = 'All';
                currentFilterStatus = 'All';
                currentSearchTerm = '';
                const searchInput = document.getElementById('search-user') as HTMLInputElement;
                if (searchInput) searchInput.value = '';
                syncRoleTabsUI('All');
                updateCardStyles();
                applyFilters();
            });
        }
        updatePaginationInfo();
        return;
    }

    renderNextUsersBatch();
};

const updatePaginationInfo = () => {
    const infoEl = document.getElementById('users-pagination-info');
    if (!infoEl) return;
    
    const total = filteredUsers.length;
    if (total === 0) {
        infoEl.innerHTML = `Không có tài khoản nào`;
    } else {
        let filterLabel = '';
        if (currentQuickFilter === 'online') filterLabel = ' • <span class="text-emerald-400 font-semibold"><i class="fa-solid fa-circle text-[9px] mr-1"></i>Đang online</span>';
        else if (currentQuickFilter === 'admin') filterLabel = ' • <span class="text-blue-400 font-semibold"><i class="fa-solid fa-shield-halved text-xs mr-1"></i>Quản trị viên</span>';
        else if (currentQuickFilter === 'locked') filterLabel = ' • <span class="text-rose-400 font-semibold"><i class="fa-solid fa-ban text-xs mr-1"></i>Bị khóa</span>';
        
        if (currentFilterRole !== 'All' && currentQuickFilter !== 'admin') {
            filterLabel += ` • <span class="text-orange-400 font-semibold">Vai trò: ${currentFilterRole}</span>`;
        }

        const isComplete = currentRenderedUsersCount >= total;
        infoEl.innerHTML = `Đã tải <span class="text-slate-900 font-bold">${currentRenderedUsersCount}</span> trên tổng số <span class="text-slate-900 font-bold">${total}</span> tài khoản${filterLabel} ${
            isComplete 
                ? '<span class="ml-2 text-xs font-semibold text-emerald-600"><i class="fa-solid fa-circle-check text-[11px] mr-1"></i>Đã tải toàn bộ</span>' 
                : '<span class="ml-2 text-xs font-medium text-slate-500 italic">(Cuộn chuột xuống để tự động tải tiếp)</span>'
        }`;
    }

    // Xóa bỏ hoàn toàn nút chuyển trang (< Trước Trang 1/6 Sau >)
    let controls = document.getElementById('users-pagination-controls');
    if (!controls) {
        const parent = infoEl.parentElement;
        if (parent) {
            controls = document.createElement('div');
            controls.id = 'users-pagination-controls';
            controls.className = 'flex items-center gap-2';
            parent.appendChild(controls);
        }
    }

    if (controls) {
        if (currentRenderedUsersCount < total) {
            controls.innerHTML = `
                <button id="btn-manual-load-more" type="button" class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105 active:scale-95" title="Bấm để tải thêm tài khoản">
                    <i class="fa-solid fa-arrow-down text-[10px]"></i> Tải thêm
                </button>
            `;
            document.getElementById('btn-manual-load-more')?.addEventListener('click', () => {
                renderNextUsersBatch();
            });
        } else {
            controls.innerHTML = `
                <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <i class="fa-solid fa-check text-emerald-600"></i> Hết danh sách
                </span>
            `;
        }
    }
};

const getRoleBadge = (role: string) => {
    switch (role) {
        case 'Admin': return `<span class="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-black border border-orange-200">Quản trị viên</span>`;
        case 'Cashier': return `<span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-black border border-blue-200">Thu ngân</span>`;
        case 'Waiter': return `<span class="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-xs font-black border border-purple-200">Phục vụ</span>`;
        case 'Chef': return `<span class="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">Đầu bếp</span>`;
        default: return `<span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-black border border-slate-300">Khác</span>`;
    }
};

const getRoleInitialBadge = (role: string, name: string) => {
    const init = name.charAt(0).toUpperCase();
    switch (role) {
        case 'Admin': return `<div class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-orange-500/30">AD</div>`;
        case 'Cashier': return `<div class="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-blue-500/30">TN</div>`;
        case 'Waiter': return `<div class="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-purple-500/30">PV</div>`;
        case 'Chef': return `<div class="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-emerald-500/30">BP</div>`;
        default: return `<div class="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">${init}</div>`;
    }
};

// ==========================================
// 4. NGHIỆP VỤ SOFT DELETE (KHÓA/MỞ KHÓA)
// ==========================================
const toggleUserStatus = async (id: string, currentStatus: string, reason: string = '') => {
    const isLocked = currentStatus === 'Locked';
    const newStatus = isLocked ? 'Active' : 'Locked';
    const actionName = isLocked ? "Mở khóa" : "Khóa";
    
    try {
        const response = await fetch(`${API_USERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                lock_reason: reason 
            })
        });

        if (!response.ok) throw new Error(`Lỗi khi ${actionName}`);
        
        showToast(`Đã ${actionName.toLowerCase()} tài khoản thành công!`);
        await fetchAndRenderUsers();
    } catch (error) {
        console.error(error);
        showConfirmModal("Lỗi", `Có lỗi xảy ra khi ${actionName} tài khoản!`);
    }
};

// ==========================================
// 5. HIỆN TOAST THÔNG BÁO
// ==========================================
const showToast = (message: string) => {
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.innerHTML = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-3';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'bg-white border-l-4 border-emerald-500 text-slate-900 border border-slate-200 px-5 py-4 rounded-xl font-bold text-sm flex items-center gap-3 shadow-xl transition-all duration-300';
    toast.style.animation = 'slideInRight 0.3s ease-out forwards';
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <i class="fa-solid fa-circle-info text-sm"></i>
        </div>
        <span class="tracking-wide">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

export const loadUsers = fetchAndRenderUsers;
