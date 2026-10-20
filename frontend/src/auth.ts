/**
 * AUTHENTICATION GUARD & SESSION HELPER
 * Hệ thống kiểm soát phiên đăng nhập và phân quyền (RBAC) cho FoodHub POS
 */

export interface SessionUser {
    id: string;
    branch_id: string;
    username: string;
    fullname: string;
    name?: string;
    role: string;
    status: string;
    email?: string;
    phone?: string;
    endingCash?: number;
}

/**
 * Lấy thông tin tài khoản hiện tại từ LocalStorage
 */
export const getCurrentUser = (): SessionUser | null => {
    const sessionUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (!sessionUser) return null;
    try {
        return JSON.parse(sessionUser) as SessionUser;
    } catch {
        return null;
    }
};

/**
 * Kiểm tra quyền đăng nhập và phân quyền truy cập trang
 * Bắt buộc phải đăng nhập (có user + token) mới được sử dụng hệ thống
 * @param allowedRoles Mảng các vai trò được phép truy cập (vd: ['Admin', 'Cashier'])
 */
export const requireAuth = (allowedRoles?: string[]): SessionUser | null => {
    const user = getCurrentUser();
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');

    if (!user || !token) {
        window.location.replace('../auth/login.html');
        return null;
    }

    if (user.status === 'Locked' || user.status === 'Inactive') {
        alert('Tài khoản của bạn đã bị khóa! Vui lòng liên hệ Quản trị viên.');
        logout();
        return null;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const userRole = (user.role || '').toLowerCase();
        // Admin luôn có toàn quyền truy cập tất cả phân hệ
        if (userRole !== 'admin') {
            const hasPermission = allowedRoles.some(r => r.toLowerCase() === userRole);
            if (!hasPermission) {
                alert(`Bạn không có quyền truy cập trang này (Vai trò hiện tại: ${user.role})!`);
                window.location.replace('../auth/login.html');
                return null;
            }
        }
    }

    return user;
};

/**
 * Đăng xuất khỏi hệ thống: Xóa toàn bộ token & session và chuyển về màn hình đăng nhập
 */
export const logout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.replace('../auth/login.html');
};

// Gắn hàm logout vào window để các nút button gọi trực tiếp
(window as any).logout = logout;

/**
 * Kiểm tra user có role chỉ định hay không
 */
export const hasRole = (role: string): boolean => {
    const user = getCurrentUser();
    if (!user) return false;
    return (user.role || '').toLowerCase() === role.toLowerCase();
};
