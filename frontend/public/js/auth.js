export const getCurrentUser = () => {
    const sessionUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (!sessionUser)
        return null;
    try {
        return JSON.parse(sessionUser);
    }
    catch {
        return null;
    }
};
export const requireAuth = (allowedRoles) => {
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
export const logout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.replace('../auth/login.html');
};
window.logout = logout;
export const hasRole = (role) => {
    const user = getCurrentUser();
    if (!user)
        return false;
    return (user.role || '').toLowerCase() === role.toLowerCase();
};
