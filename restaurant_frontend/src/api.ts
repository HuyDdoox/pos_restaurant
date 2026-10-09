import { API_URL, API_CATEGORY_URL, API_ORDERS_URL, API_ORDER_DETAILS_URL, API_TABLES_URL, API_SHIFTS_URL, API_VARIANTS_URL, API_USERS_URL, API_BRANCHES_URL, API_INGREDIENTS_URL, API_RECIPES_URL } from './config';
import { MenuItem, Category, Variant } from './interfaces';

export const layDanhSachMonAn = async (): Promise<MenuItem[]> => {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu món ăn:", error);
        return []; 
    }
};

// THÊM HÀM LẤY DANH MỤC VÀ CHI NHÁNH
export const layDanhSachDanhMuc = async (): Promise<Category[]> => {
    try {
        const response = await fetch(API_CATEGORY_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu danh mục:", error);
        return []; 
    }
};

export const layDanhSachIngredients = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_INGREDIENTS_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu nguyên liệu:", error);
        return []; 
    }
};

export const layDanhSachRecipes = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_RECIPES_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu công thức:", error);
        return []; 
    }
};

export const layDanhSachChiNhanh = async () => {
    try {
        const response = await fetch(API_BRANCHES_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu chi nhánh:", error);
        return []; 
    }
};

export const layDanhSachVariants = async (menuItem_id?: string): Promise<Variant[]> => {
    try {
        const url = menuItem_id ? `${API_VARIANTS_URL}?menuItem_id=${menuItem_id}&status=Available` : API_VARIANTS_URL;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Lỗi khi tải biến thể:", error);
        return [];
    }
};
export const taoDonHang = async (orderData: any) => {
    const response = await fetch(API_ORDERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    });
    if (!response.ok) throw new Error("Lỗi khi tạo đơn hàng");
    return await response.json();
};

export const taoChiTietDonHang = async (detailData: any) => {
    const response = await fetch(API_ORDER_DETAILS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailData)
    });
    if (!response.ok) throw new Error("Lỗi khi tạo chi tiết đơn hàng");
    return await response.json();
};

export const layDonHangDangMoCuaBan = async (tableId: string) => {
    const response = await fetch(`${API_ORDERS_URL}?table_id=${tableId}&status=In_Progress`);
    if (!response.ok) throw new Error("Lỗi kiểm tra đơn hàng");
    return await response.json();
};

export const capNhatTrangThaiBan = async (tableId: string, status: string, pax?: number) => {
    const body: any = { status };
    if (pax !== undefined) body.current_pax = pax;
    
    const response = await fetch(`${API_TABLES_URL}/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("Lỗi cập nhật trạng thái bàn");
    return await response.json();
};

export const capNhatSoLuongMon = async (detailId: string, newQuantity: number) => {
    const response = await fetch(`${API_ORDER_DETAILS_URL}/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity })
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật số lượng món");
    return await response.json();
};

export const capNhatTongTienDonHang = async (orderId: string, newTotal: number) => {
    const response = await fetch(`${API_ORDERS_URL}/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: newTotal })
    });
    if (!response.ok) throw new Error("Lỗi cập nhật tổng tiền");
    return await response.json();
};

export const layDanhSachMonChoNau = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Cooking");
    if (!response.ok) throw new Error("Lỗi khi tải danh sách món chờ nấu");
    return await response.json();
};

export const capNhatTrangThaiMon = async (id: string, status: string) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật trạng thái");
    return await response.json();
};

export const layDanhSachMonSanSang = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Ready");
    if (!response.ok) throw new Error("Lỗi khi tải danh sách món sẵn sàng");
    return await response.json();
};

export const capNhatTrangThaiMenu = async (id: string, status: string) => {
    const response = await fetch(API_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật trạng thái menu");
    return await response.json();
};

export const layDanhSachHoaDonChuaThanhToan = async () => {
    const response = await fetch(API_ORDERS_URL + "?paymentStatus=Unpaid");
    if (!response.ok) throw new Error("Lỗi khi tải hóa đơn");
    return await response.json();
};

export const thanhToanHoaDon = async (id: string, updateData: any) => {
    const response = await fetch(API_ORDERS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error("Lỗi khi thanh toán");
    return await response.json();
};

export const taoCaLamViec = async (shiftData: any) => {
    // Note: We need to import API_SHIFTS_URL in api.ts, wait! I didn't import API_SHIFTS_URL in api.ts!
    const response = await fetch(API_SHIFTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
    });
    return await response.json();
};

export const ketThucCaLamViec = async (id: string, shiftData: any) => {
    const response = await fetch(API_SHIFTS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
    });
    return await response.json();
};

export const layDanhSachMonChoXacNhan = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Pending");
    if (!response.ok) throw new Error("Lỗi khi tải danh sách chờ xác nhận");
    return await response.json();
};

export const layDanhSachBan = async () => {
    const response = await fetch(API_TABLES_URL);
    if (!response.ok) throw new Error("Lỗi khi tải bàn");
    return await response.json();
};

export const layTatCaDonHang = async (branchId?: string) => {
    const url = branchId && branchId !== 'all' ? `${API_ORDERS_URL}?branch_id=${branchId}` : API_ORDERS_URL;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Lỗi khi tải tất cả đơn hàng");
    return await response.json();
};

export const layChiTietCuaDon = async (orderId: string) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?order_id=" + orderId);
    if (!response.ok) throw new Error("Lỗi khi tải chi tiết");
    return await response.json();
};

// --- CRUD MÓN ĂN ---
export const taoMonAn = async (data: any) => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Lỗi tạo món ăn');
    return await response.json();
};

export const suaMonAn = async (id: string, data: any) => {
    const response = await fetch(API_URL + '/' + id, {
        method: 'PATCH', // Dùng PATCH
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Lỗi sửa món ăn');
    return await response.json();
};

export const xoaMonAn = async (id: string, deletedBy: string) => {
    const response = await fetch(API_URL + '/' + id, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: "Archived",
            deletedAt: new Date().toISOString(),
            deletedBy: deletedBy
        })
    });
    if (!response.ok) throw new Error('Lỗi xóa món ăn (Soft Delete)');
    return await response.json();
};

// --- CRUD DANH MỤC ---
export const taoDanhMuc = async (data: any) => {
    const response = await fetch(API_CATEGORY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Lỗi tạo danh mục');
    return await response.json();
};

export const suaDanhMuc = async (id: string, data: any) => {
    const response = await fetch(API_CATEGORY_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Lỗi sửa danh mục');
    return await response.json();
};

export const xoaDanhMuc = async (id: string) => {
    const response = await fetch(API_CATEGORY_URL + '/' + id, { method: 'DELETE' });
    if (!response.ok) throw new Error('Lỗi xóa danh mục');
    return await response.json();
};
export const capNhatChiTietDonHang = async (id: string, updateData: any) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật chi tiết");
    return await response.json();
};

export const xoaChiTietDonHang = async (id: string) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, { method: 'DELETE' });
    if (!response.ok) throw new Error('Lỗi xóa chi tiết');
    return await response.json();
};
export const capNhatDonHang = async (id: string, updateData: any) => {
    const response = await fetch(API_ORDERS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật đơn hàng");
    return await response.json();
};

// --- CRUD USERS ---
export const layDanhSachNguoiDung = async (branchId?: string) => {
    const url = branchId && branchId !== 'all' ? `${API_USERS_URL}?branch_id=${branchId}` : API_USERS_URL;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Lỗi lấy danh sách người dùng');
    return await response.json();
};

export const taoNguoiDung = async (data: any) => {
    const response = await fetch(API_USERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Lỗi tạo người dùng');
    return await response.json();
};

export const suaNguoiDung = async (id: string, data: any) => {
    const response = await fetch(API_USERS_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Lỗi sửa người dùng');
    return await response.json();
};

export const capNhatTrangThaiNguoiDung = async (id: string, status: string) => {
    const response = await fetch(API_USERS_URL + '/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Lỗi đổi trạng thái người dùng');
    return await response.json();
};

export const layDanhSachNguyenLieu = async () => {
    const response = await fetch(API_INGREDIENTS_URL);
    if (!response.ok) throw new Error("Lỗi mạng");
    return await response.json();
};

export const layTatCaCongThuc = async () => {
    const response = await fetch(API_RECIPES_URL);
    if (!response.ok) throw new Error("Lỗi mạng");
    return await response.json();
};
