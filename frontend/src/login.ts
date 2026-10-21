import { API_USERS_URL, API_BRANCHES_URL, API_BACKEND_URL } from './config';

interface User {
    id?: string;
    _id?: string;
    branch_id?: string | any;
    username: string;
    password?: string;
    fullname: string;
    phone?: string;
    email?: string;
    role: string;
    endingCash?: number;
    status: string;
    lock_reason?: string;
}

// Tài khoản mẫu hỗ trợ chấm điểm và kiểm thử nhanh 1 chạm
const DEMO_ACCOUNTS: Record<string, { username: string; pass: string }> = {
    Admin: { username: 'admin_hcm', pass: '123456' },
    Cashier: { username: 'cashier_lan', pass: '123456' },
    Chef: { username: 'chef_wong', pass: '123456' },
    Waiter: { username: 'waiter_nhat', pass: '123456' }
};

document.addEventListener('DOMContentLoaded', () => {
    initAuthPage();
});

const initAuthPage = async () => {
    setupTabSwitching();
    setupDemoButtons();
    setupPasswordToggles();
    setupLoginForm();
    setupRegisterForm();
    await loadBranches();
    checkExistingSession();
};

/**
 * ==========================================
 * 1. QUẢN LÝ CHUYỂN TAB (ĐĂNG NHẬP / ĐĂNG KÝ)
 * ==========================================
 */
const setupTabSwitching = () => {
    const tabBtnLogin = document.getElementById('tab-btn-login');
    const tabBtnRegister = document.getElementById('tab-btn-register');
    const linkGotoRegister = document.getElementById('link-goto-register');
    const linkGotoLogin = document.getElementById('link-goto-login');

    tabBtnLogin?.addEventListener('click', () => switchTab('login'));
    tabBtnRegister?.addEventListener('click', () => switchTab('register'));
    linkGotoRegister?.addEventListener('click', () => switchTab('register'));
    linkGotoLogin?.addEventListener('click', () => switchTab('login'));
};

const switchTab = (tab: 'login' | 'register') => {
    const tabBtnLogin = document.getElementById('tab-btn-login');
    const tabBtnRegister = document.getElementById('tab-btn-register');
    const containerLogin = document.getElementById('container-login');
    const containerRegister = document.getElementById('container-register');

    const activeClasses = ['bg-white', 'text-orange-600', 'shadow-sm', 'border', 'border-slate-200', 'font-black'];
    const inactiveClasses = ['text-slate-600', 'hover:text-slate-900', 'hover:bg-slate-200/50', 'font-bold'];

    if (tab === 'login') {
        containerLogin?.classList.remove('hidden');
        containerRegister?.classList.add('hidden');

        // Update button styles
        tabBtnLogin?.classList.add(...activeClasses);
        tabBtnLogin?.classList.remove(...inactiveClasses);

        tabBtnRegister?.classList.remove(...activeClasses);
        tabBtnRegister?.classList.add(...inactiveClasses);
    } else {
        containerLogin?.classList.add('hidden');
        containerRegister?.classList.remove('hidden');

        // Update button styles
        tabBtnRegister?.classList.add(...activeClasses);
        tabBtnRegister?.classList.remove(...inactiveClasses);

        tabBtnLogin?.classList.remove(...activeClasses);
        tabBtnLogin?.classList.add(...inactiveClasses);
    }
};

/**
 * ==========================================
 * 2. KIỂM TRA PHIÊN LÀM VIỆC CŨ
 * ==========================================
 */
const checkExistingSession = () => {
    const sessionUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (sessionUser) {
        try {
            const user: User = JSON.parse(sessionUser);
            const redirectBanner = document.getElementById('session-banner');
            const sessionName = document.getElementById('session-user-name');
            if (redirectBanner && sessionName) {
                sessionName.innerText = `${user.fullname} (${user.role})`;
                redirectBanner.classList.remove('hidden');
                redirectBanner.classList.add('flex');
            }
        } catch (e) {}
    }
};

(window as any).continueCurrentSession = () => {
    const sessionUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (sessionUser) {
        const user: User = JSON.parse(sessionUser);
        redirectByRole(user.role);
    }
};

(window as any).clearCurrentSession = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    const redirectBanner = document.getElementById('session-banner');
    if (redirectBanner) redirectBanner.classList.add('hidden');
    showToast('Đã xóa phiên làm việc trước đó', 'info');
};

/**
 * ==========================================
 * 3. ẨN / HIỆN MẬT KHẨU
 * ==========================================
 */
const setupPasswordToggles = () => {
    // Cho form Đăng nhập
    const toggleBtnLogin = document.getElementById('btn-toggle-password');
    const passInputLogin = document.getElementById('input-password') as HTMLInputElement;
    const eyeIconLogin = document.getElementById('icon-password-eye');

    if (toggleBtnLogin && passInputLogin && eyeIconLogin) {
        toggleBtnLogin.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passInputLogin.type === 'password';
            passInputLogin.type = isPassword ? 'text' : 'password';
            eyeIconLogin.className = isPassword ? 'fa-solid fa-eye-slash text-slate-400' : 'fa-solid fa-eye text-slate-400';
        });
    }

    // Cho form Đăng ký
    const toggleBtnReg = document.getElementById('btn-toggle-reg-password');
    const passInputReg = document.getElementById('input-reg-password') as HTMLInputElement;
    const eyeIconReg = document.getElementById('icon-reg-password-eye');

    if (toggleBtnReg && passInputReg && eyeIconReg) {
        toggleBtnReg.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passInputReg.type === 'password';
            passInputReg.type = isPassword ? 'text' : 'password';
            eyeIconReg.className = isPassword ? 'fa-solid fa-eye-slash text-slate-400' : 'fa-solid fa-eye text-slate-400';
        });
    }
};

/**
 * ==========================================
 * 4. TÀI KHOẢN MẪU DEMO 1 CHẠM
 * ==========================================
 */
const setupDemoButtons = () => {
    document.querySelectorAll('.btn-quick-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const role = (e.currentTarget as HTMLElement).getAttribute('data-role');
            if (!role || !DEMO_ACCOUNTS[role]) return;

            const demo = DEMO_ACCOUNTS[role];
            const usernameInput = document.getElementById('input-username') as HTMLInputElement;
            const passwordInput = document.getElementById('input-password') as HTMLInputElement;

            if (usernameInput) {
                usernameInput.value = demo.username;
                usernameInput.classList.add('ring-2', 'ring-orange-500/50');
                setTimeout(() => usernameInput.classList.remove('ring-2', 'ring-orange-500/50'), 600);
            }
            if (passwordInput) {
                passwordInput.value = demo.pass;
                passwordInput.classList.add('ring-2', 'ring-orange-500/50');
                setTimeout(() => passwordInput.classList.remove('ring-2', 'ring-orange-500/50'), 600);
            }

            document.querySelectorAll('.btn-quick-role').forEach(b => {
                b.classList.remove('bg-orange-50', 'border-orange-500', 'text-orange-600', 'ring-2', 'ring-orange-500/20');
                b.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700');
            });
            (e.currentTarget as HTMLElement).classList.add('bg-orange-50', 'border-orange-500', 'text-orange-600', 'ring-2', 'ring-orange-500/20');
            (e.currentTarget as HTMLElement).classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700');

            showToast(`Đã chọn tài khoản mẫu [${role}]`, 'info');
        });
    });
};

/**
 * ==========================================
 * 5. TẢI DANH SÁCH CHI NHÁNH
 * ==========================================
 */
const loadBranches = async () => {
    try {
        const selectLogin = document.getElementById('select-branch') as HTMLSelectElement;
        const selectReg = document.getElementById('select-reg-branch') as HTMLSelectElement;

        const res = await fetch(API_BRANCHES_URL);
        if (res.ok) {
            const branches = await res.json();
            if (branches && branches.length > 0) {
                const optionsHtml = branches.map((b: any) => 
                    `<option value="${b.id || b._id}">${b.name}</option>`
                ).join('');
                if (selectLogin) selectLogin.innerHTML = optionsHtml;
                if (selectReg) selectReg.innerHTML = optionsHtml;
            }
        }
    } catch (e) {
        console.warn('Không tải được danh sách chi nhánh từ json-server:', e);
    }
};

/**
 * ==========================================
 * 6. XỬ LÝ ĐĂNG NHẬP (DUAL SUPPORT: EXPRESS & JSON-SERVER)
 * ==========================================
 */
const setupLoginForm = () => {
    const form = document.getElementById('login-form') as HTMLFormElement;
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById('input-username') as HTMLInputElement;
        const passwordInput = document.getElementById('input-password') as HTMLInputElement;
        const branchSelect = document.getElementById('select-branch') as HTMLSelectElement;
        const btnSubmit = document.getElementById('btn-submit-login') as HTMLButtonElement;
        const btnSpinner = document.getElementById('login-spinner');
        const btnText = document.getElementById('login-btn-text');

        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';
        const branchId = branchSelect ? branchSelect.value : 'BR001';

        if (!username) {
            triggerInputError(usernameInput, 'Vui lòng nhập tên đăng nhập!');
            return;
        }

        if (!password) {
            triggerInputError(passwordInput, 'Vui lòng nhập mật khẩu!');
            return;
        }

        // Bật trạng thái loading
        if (btnSubmit) btnSubmit.disabled = true;
        if (btnSpinner) btnSpinner.classList.remove('hidden');
        if (btnText) btnText.innerText = 'Đang xác thực...';

        try {
            // CÁCH 1: Thử đăng nhập qua Express Backend API (nếu server Node.js đang chạy)
            let loggedInUser: User | null = null;
            let jwtToken: string | null = null;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1800);

                const backendRes = await fetch(`${API_BACKEND_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (backendRes.ok) {
                    const result = await backendRes.json();
                    loggedInUser = result.user || result.data?.user;
                    jwtToken = result.access_token || result.accessToken || result.data?.accessToken;
                    if (result.refresh_token) {
                        localStorage.setItem('refresh_token', result.refresh_token);
                    }
                } else if (backendRes.status === 400 || backendRes.status === 401 || backendRes.status === 403) {
                    const errResult = await backendRes.json();
                    showToast(errResult.message || errResult.error || 'Sai thông tin đăng nhập!', 'error');
                    resetSubmitButton(btnSubmit, btnSpinner, btnText);
                    return;
                }
            } catch (backendErr) {
                // Express backend offline hoặc không phản hồi -> Chuyển sang CÁCH 2: JSON-Server
            }

            // CÁCH 2: Fallback qua JSON-Server (chạy cho môn 1 / db.json)
            if (!loggedInUser) {
                const res = await fetch(API_USERS_URL);
                if (!res.ok) throw new Error('Không thể kết nối đến máy chủ xác thực.');

                const users: User[] = await res.json();

                const matchedUser = users.find(u =>
                    (u.username.toLowerCase() === username.toLowerCase() ||
                     (u.email && u.email.toLowerCase() === username.toLowerCase()) ||
                     u.phone === username)
                );

                if (!matchedUser) {
                    triggerInputError(usernameInput, 'Tài khoản không tồn tại trong hệ thống!');
                    resetSubmitButton(btnSubmit, btnSpinner, btnText);
                    return;
                }

                if (matchedUser.password !== password) {
                    triggerInputError(passwordInput, 'Mật khẩu không chính xác. Vui lòng thử lại!');
                    resetSubmitButton(btnSubmit, btnSpinner, btnText);
                    return;
                }

                if (matchedUser.status === 'Locked' || matchedUser.status === 'Inactive') {
                    const reason = matchedUser.lock_reason ? ` Lý do: ${matchedUser.lock_reason}` : '';
                    showToast(`Tài khoản đã bị tạm khóa!${reason}`, 'error');
                    resetSubmitButton(btnSubmit, btnSpinner, btnText);
                    return;
                }

                loggedInUser = matchedUser;
            }

            // Gán chi nhánh làm việc
            if (branchId && loggedInUser) {
                loggedInUser.branch_id = branchId;
            }

            // Lưu session vào localStorage
            const userToStore = { ...loggedInUser };
            delete userToStore.password;

            localStorage.setItem('currentUser', JSON.stringify(userToStore));
            localStorage.setItem('user', JSON.stringify(userToStore));
            if (jwtToken) {
                localStorage.setItem('token', jwtToken);
                localStorage.setItem('access_token', jwtToken);
            }

            showToast(`Đăng nhập thành công! Xin chào ${loggedInUser.fullname}`, 'success');

            setTimeout(() => {
                redirectByRole(loggedInUser!.role);
            }, 800);

        } catch (err: any) {
            console.error('Lỗi đăng nhập:', err);
            showToast('Không thể kết nối máy chủ xác thực (json-server hoặc Node.js). Vui lòng thử lại!', 'error');
            resetSubmitButton(btnSubmit, btnSpinner, btnText);
        }
    });
};

const resetSubmitButton = (btn: HTMLButtonElement | null, spinner: HTMLElement | null, text: HTMLElement | null) => {
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (text) text.innerText = 'Đăng nhập hệ thống';
};

/**
 * ==========================================
 * 7. XỬ LÝ ĐĂNG KÝ (DUAL SUPPORT: EXPRESS & JSON-SERVER)
 * ==========================================
 */
const setupRegisterForm = () => {
    const form = document.getElementById('register-form') as HTMLFormElement;
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullnameInput = document.getElementById('input-reg-fullname') as HTMLInputElement;
        const usernameInput = document.getElementById('input-reg-username') as HTMLInputElement;
        const roleSelect = document.getElementById('select-reg-role') as HTMLSelectElement;
        const branchSelect = document.getElementById('select-reg-branch') as HTMLSelectElement;
        const phoneInput = document.getElementById('input-reg-phone') as HTMLInputElement;
        const emailInput = document.getElementById('input-reg-email') as HTMLInputElement;
        const passwordInput = document.getElementById('input-reg-password') as HTMLInputElement;
        const confirmPasswordInput = document.getElementById('input-reg-confirm-password') as HTMLInputElement;
        const agreeCheckbox = document.getElementById('check-reg-agree') as HTMLInputElement;

        const btnSubmit = document.getElementById('btn-submit-register') as HTMLButtonElement;
        const btnSpinner = document.getElementById('reg-spinner');
        const btnText = document.getElementById('reg-btn-text');

        const fullname = fullnameInput ? fullnameInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
        const role = roleSelect ? roleSelect.value : 'Waiter';
        const branchId = branchSelect ? branchSelect.value : 'BR001';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';

        // 1. Kiểm tra validation form chi tiết
        if (!fullname || fullname.length < 2) {
            triggerInputError(fullnameInput, 'Họ và tên phải có ít nhất 2 ký tự!');
            return;
        }

        if (!username || username.length < 3) {
            triggerInputError(usernameInput, 'Tên đăng nhập phải có ít nhất 3 ký tự!');
            return;
        }

        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            triggerInputError(usernameInput, 'Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới!');
            return;
        }

        if (!password || password.length < 6) {
            triggerInputError(passwordInput, 'Mật khẩu phải có tối thiểu 6 ký tự!');
            return;
        }

        if (password !== confirmPassword) {
            triggerInputError(confirmPasswordInput, 'Xác nhận mật khẩu không trùng khớp!');
            return;
        }

        if (phone && !/^[0-9]{9,11}$/.test(phone)) {
            triggerInputError(phoneInput, 'Số điện thoại không hợp lệ (cần 9-11 chữ số)!');
            return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            triggerInputError(emailInput, 'Địa chỉ email không đúng định dạng!');
            return;
        }

        if (agreeCheckbox && !agreeCheckbox.checked) {
            triggerInputError(agreeCheckbox, 'Vui lòng đồng ý với quy chế nhà hàng để tiếp tục!');
            return;
        }

        // Bật loading state
        if (btnSubmit) btnSubmit.disabled = true;
        if (btnSpinner) btnSpinner.classList.remove('hidden');
        if (btnText) btnText.innerText = 'Đang khởi tạo tài khoản...';

        try {
            let registrationSuccess = false;

            // CÁCH 1: Gửi yêu cầu đăng ký lên Express Backend (nếu online)
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1800);

                const backendRes = await fetch(`${API_BACKEND_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        confirm_password: confirmPassword,
                        fullname,
                        name: fullname,
                        role,
                        branch_id: branchId,
                        phone: phone || undefined,
                        email: email || undefined,
                        age: 22
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (backendRes.ok) {
                    registrationSuccess = true;
                } else if (backendRes.status === 400 || backendRes.status === 414) {
                    const errData = await backendRes.json();
                    showToast(errData.message || errData.error || 'Tên đăng nhập hoặc email đã tồn tại!', 'error');
                    resetRegisterButton(btnSubmit, btnSpinner, btnText);
                    return;
                }
            } catch (backendErr) {
                // Express backend offline -> Chuyển sang CÁCH 2: JSON-Server
            }

            // CÁCH 2: Fallback ghi trực tiếp vào JSON-Server db.json
            if (!registrationSuccess) {
                // Kiểm tra xem username đã tồn tại trong db.json chưa
                const checkRes = await fetch(API_USERS_URL);
                if (!checkRes.ok) throw new Error('Không thể kiểm tra dữ liệu người dùng.');

                const usersJson = await checkRes.json();
                const existingUsers: User[] = Array.isArray(usersJson) ? usersJson : (usersJson.data || usersJson.users || []);
                const isDuplicate = existingUsers.some(u => 
                    u.username.toLowerCase() === username ||
                    (email && u.email && u.email.toLowerCase() === email.toLowerCase()) ||
                    (phone && u.phone && u.phone === phone)
                );

                if (isDuplicate) {
                    showToast('Tên đăng nhập, email hoặc SĐT đã tồn tại trên hệ thống!', 'error');
                    resetRegisterButton(btnSubmit, btnSpinner, btnText);
                    return;
                }

                // Tạo đối tượng nhân viên mới
                const newUserId = `U${Date.now().toString().slice(-4)}`;
                const newUser: User = {
                    id: newUserId,
                    username,
                    password,
                    fullname,
                    role,
                    branch_id: branchId,
                    phone: phone || undefined,
                    email: email || undefined,
                    status: 'Active'
                };

                const postRes = await fetch(API_USERS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newUser)
                });

                if (!postRes.ok) throw new Error('Không thể thêm tài khoản vào cơ sở dữ liệu.');
                registrationSuccess = true;
            }

            if (registrationSuccess) {
                showToast(`Đăng ký thành công tài khoản [${username}]! Đang chuyển sang đăng nhập...`, 'success');

                // Tự động điền tài khoản vừa đăng ký vào form đăng nhập
                const loginUserInput = document.getElementById('input-username') as HTMLInputElement;
                const loginPassInput = document.getElementById('input-password') as HTMLInputElement;
                if (loginUserInput) loginUserInput.value = username;
                if (loginPassInput) loginPassInput.value = password;

                // Reset form đăng ký
                form.reset();

                // Chuyển sang tab Đăng nhập sau 700ms
                setTimeout(() => {
                    switchTab('login');
                    loginPassInput?.focus();
                }, 700);
            }

        } catch (err: any) {
            console.error('Lỗi đăng ký tài khoản:', err);
            showToast('Không thể hoàn tất đăng ký. Vui lòng kiểm tra kết nối json-server!', 'error');
        } finally {
            resetRegisterButton(btnSubmit, btnSpinner, btnText);
        }
    });
};

const resetRegisterButton = (btn: HTMLButtonElement | null, spinner: HTMLElement | null, text: HTMLElement | null) => {
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (text) text.innerText = 'Đăng ký tài khoản nhân viên';
};

/**
 * ==========================================
 * 8. ĐIỀU HƯỚNG THEO VAI TRÒ (RBAC REDIRECT)
 * ==========================================
 */
const redirectByRole = (role: string) => {
    const roleLower = (role || '').toLowerCase();
    switch (roleLower) {
        case 'admin':
            window.location.href = '../staff/admin.html';
            break;
        case 'cashier':
            window.location.href = '../staff/cashier.html';
            break;
        case 'chef':
        case 'kitchen':
            window.location.href = '../staff/kitchen.html';
            break;
        case 'waiter':
            window.location.href = '../staff/waiter.html';
            break;
        default:
            window.location.href = '../staff/waiter.html';
            break;
    }
};

/**
 * ==========================================
 * 9. TOAST THÔNG BÁO GIAO DIỆN
 * ==========================================
 */
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' 
        ? 'bg-emerald-600 text-white shadow-emerald-600/20' 
        : type === 'error' 
        ? 'bg-rose-600 text-white shadow-rose-600/20' 
        : 'bg-slate-900 text-white shadow-slate-900/20';

    const iconClass = type === 'success' 
        ? 'fa-solid fa-circle-check text-emerald-200' 
        : type === 'error' 
        ? 'fa-solid fa-circle-exclamation text-rose-200' 
        : 'fa-solid fa-circle-info text-orange-400';

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto ${bgClass}`;
    toast.innerHTML = `
        <i class="${iconClass} text-lg shrink-0"></i>
        <span class="text-sm font-bold flex-1">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

/**
 * ==========================================
 * 10. HIGHLIGHT INPUT LỖI VÀ TỰ ĐỘNG FOCUS
 * ==========================================
 */
const triggerInputError = (input: HTMLElement | null, message: string) => {
    showToast(message, 'error');
    if (input) {
        input.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
        input.focus();
        const removeError = () => {
            input.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
            input.removeEventListener('input', removeError);
            input.removeEventListener('change', removeError);
        };
        input.addEventListener('input', removeError);
        input.addEventListener('change', removeError);
    }
};
