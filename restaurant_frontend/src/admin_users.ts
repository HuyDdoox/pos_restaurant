import { showConfirmModal } from './utils/ui';

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

import { API_USERS_URL } from './config';

let allUsers: IUser[] = [];
let filteredUsers: IUser[] = [];
let currentFilterRole = 'All';
let currentSearchTerm = '';
let currentFilterBranch = '';
let currentPage = 1;
const itemsPerPage = 6;
let userToLockId: string | null = null;

// ==========================================
// 1. KHỞI TẠO & LẤY DỮ LIỆU
// ==========================================
export const initAdminUsers = async () => {
    setupEventListeners();
    await fetchAndRenderUsers();
};

const setupEventListeners = () => {
    // Tìm kiếm
    const searchInput = document.getElementById('search-user') as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Lọc theo Role
    const tabRoles = document.getElementById('tab-roles');
    if (tabRoles) {
        tabRoles.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.tab-role-btn') as HTMLElement;
            if (!btn) return;

            // Xóa style nút đang active (đưa về trạng thái inactive)
            tabRoles.querySelectorAll('.tab-role-btn').forEach(el => {
                el.classList.remove('bg-orange-500', 'text-white', 'shadow-md');
                el.classList.add('bg-transparent', 'text-slate-400');
            });
            
            // Set style cho nút được click (trạng thái active)
            btn.classList.remove('bg-transparent', 'text-slate-400');
            btn.classList.add('bg-orange-500', 'text-white', 'shadow-md');
            
            currentFilterRole = btn.getAttribute('data-role') || 'All';
            applyFilters();
        });
    }

    // Lắng nghe sự kiện đổi chi nhánh từ Header (id="branch-selector")
    const branchSelector = document.getElementById('branch-selector') as HTMLSelectElement;
    if (branchSelector) {
        // Đặt giá trị ban đầu nếu có
        currentFilterBranch = branchSelector.value;
        branchSelector.addEventListener('change', () => {
            currentFilterBranch = branchSelector.value;
            applyFilters();
        });
    }

    // Event Delegation trên Tbody cho nút Khóa/Mở Khóa
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
                        // Mở Modal nếu đang Active (muốn Khóa)
                        userToLockId = id;
                        const modal = document.getElementById('lock-user-modal');
                        const reasonSelect = document.getElementById('lock-reason-select') as HTMLSelectElement;
                        const reasonNote = document.getElementById('lock-reason-note') as HTMLTextAreaElement;
                        if (modal && reasonSelect && reasonNote) {
                            reasonSelect.value = 'Nghỉ việc'; // Reset
                            reasonNote.value = ''; // Reset
                            modal.classList.remove('hidden');
                            setTimeout(() => {
                                modal.classList.remove('opacity-0');
                                const content = modal.querySelector('div');
                                if (content) content.classList.remove('scale-95');
                            }, 10);
                        }
                    } else {
                        // Nếu đang Locked (muốn Mở Khóa) thì gọi API ngay
                        await toggleUserStatus(id, currentStatus, '');
                    }
                }
            }
        });
    }

    // Logic xử lý Modal Khóa Tài Khoản
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
            
            // Gọi API Khóa
            await toggleUserStatus(userToLockId, 'Active', reason);
            closeLockModal();
        });
    }
};

const fetchAndRenderUsers = async () => {
    try {
        const response = await fetch(API_USERS_URL);
        if (!response.ok) throw new Error("Lỗi khi tải dữ liệu người dùng");
        allUsers = await response.json();
        
        // Gọi applyFilters sẽ tự động xử lý lọc và gọi updateDashboardCards
        applyFilters();
    } catch (error) {
        console.error("Lỗi fetch users:", error);
    }
};

// ==========================================
// 2. CẬP NHẬT THỐNG KÊ (CARDS)
// ==========================================
const updateDashboardCards = () => {
    // Chỉ thống kê theo chi nhánh được chọn
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

const applyFilters = () => {
    filteredUsers = allUsers.filter(user => {
        const name = (user.name || user.fullname || '').toLowerCase();
        const email = (user.email || user.username || '').toLowerCase();
        const id = (user.id || '').toLowerCase();
        
        const matchesSearch = name.includes(currentSearchTerm) || email.includes(currentSearchTerm) || id.includes(currentSearchTerm);
        const matchesRole = currentFilterRole === 'All' || user.role === currentFilterRole;
        const matchesBranch = currentFilterBranch === '' || user.branch_id === currentFilterBranch;
        
        return matchesSearch && matchesRole && matchesBranch;
    });
    
    // Cập nhật lại số liệu thống kê (phụ thuộc vào currentFilterBranch)
    updateDashboardCards();
    
    currentPage = 1;
    renderTable();
};

// ==========================================
// 3. RENDER BẢNG & BADGES
// ==========================================
const renderTable = () => {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

    pageUsers.forEach(user => {
        const fullName = user.fullname || user.name || 'Không tên';
        const userName = user.username || user.email || 'Không có email';
        const isActive = user.status !== 'Locked';

        const roleBadge = getRoleBadge(user.role);
        const roleInitial = getRoleInitialBadge(user.role, fullName);
        
        // Badges trạng thái
        const statusBadge = isActive 
            ? `<span class="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-black border border-emerald-500/30"><span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>Active</span>`
            : `<span class="inline-flex items-center gap-1.5 bg-slate-700/50 text-slate-400 px-3 py-1 rounded-full text-xs font-black border border-slate-600"><span class="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>Locked</span>`;
            
        // Text cho nút thao tác
        const actionText = isActive ? 'Khóa' : 'Mở khóa';
        const actionColor = isActive ? 'text-slate-400 hover:text-red-400' : 'text-emerald-400 hover:text-emerald-300';
        const opacityClass = isActive ? '' : 'opacity-50 grayscale-[50%]';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-700/20 transition-colors border-b border-slate-800/50 last:border-0 ${opacityClass}">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        ${roleInitial}
                        <div>
                            <p class="font-bold text-white">${fullName}</p>
                            <p class="text-xs text-slate-400">${userName}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 font-bold text-slate-300">${user.id}</td>
                <td class="px-6 py-4">${roleBadge}</td>
                <td class="px-6 py-4 text-slate-400 font-medium">Theo ca</td>
                <td class="px-6 py-4 text-slate-400 font-medium">Vừa xong</td>
                <td class="px-6 py-4 text-center">${statusBadge}</td>
                <td class="px-6 py-4 text-center">
                    <button data-id="${user.id}" data-status="${user.status || 'Active'}" class="btn-toggle-status font-bold text-xs ${actionColor} transition-colors tracking-wide underline underline-offset-2">
                        ${actionText}
                    </button>
                </td>
            </tr>
        `;
    });
};

const getRoleBadge = (role: string) => {
    switch (role) {
        case 'Admin': return `<span class="bg-orange-500/20 text-orange-500 px-3 py-1 rounded-full text-xs font-black border border-orange-500/30">Quản trị viên</span>`;
        case 'Cashier': return `<span class="bg-blue-500/20 text-blue-500 px-3 py-1 rounded-full text-xs font-black border border-blue-500/30">Thu ngân</span>`;
        case 'Waiter': return `<span class="bg-purple-500/20 text-purple-500 px-3 py-1 rounded-full text-xs font-black border border-purple-500/30">Phục vụ</span>`;
        case 'Chef': return `<span class="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-full text-xs font-black border border-emerald-500/30">Đầu bếp</span>`;
        default: return `<span class="bg-slate-700 text-slate-400 px-3 py-1 rounded-full text-xs font-black border border-slate-600">Khác</span>`;
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
    
    // Gọi API PATCH trực tiếp theo yêu cầu
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
        
        // Tự động gọi lại hàm fetch để render lại bảng và thống kê
        await fetchAndRenderUsers();
    } catch (error) {
        console.error(error);
        showConfirmModal("Lỗi", `Có lỗi xảy ra khi ${actionName} tài khoản!`);
    }
};

// ==========================================
// 5. HIỆN TOAST THÔNG BÁO (Tùy chỉnh góc phải dưới)
// ==========================================
const showToast = (message: string) => {
    // Thêm style animation cho keyframes nếu chưa có
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
    toast.className = 'bg-[#1e293b] border-l-4 border-emerald-500 text-white px-5 py-4 rounded-lg font-bold text-sm flex items-center gap-3 shadow-2xl transition-all duration-300';
    toast.style.animation = 'slideInRight 0.3s ease-out forwards';
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <span class="tracking-wide">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Tự động ẩn và gỡ bỏ DOM sau 3 giây
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

export const loadUsers = fetchAndRenderUsers;
