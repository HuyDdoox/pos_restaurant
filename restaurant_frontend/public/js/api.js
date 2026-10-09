import { API_URL, API_CATEGORY_URL, API_ORDERS_URL, API_ORDER_DETAILS_URL, API_TABLES_URL, API_SHIFTS_URL, API_VARIANTS_URL } from './config';
export const layDanhSachMonAn = async () => {
    try {
        const response = await fetch(API_URL);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu món ăn:", error);
        return [];
    }
};
export const layDanhSachDanhMuc = async () => {
    try {
        const response = await fetch(API_CATEGORY_URL);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu danh mục:", error);
        return [];
    }
};
export const layDanhSachVariants = async (menuItem_id) => {
    try {
        const url = menuItem_id ? `${API_VARIANTS_URL}?menuItem_id=${menuItem_id}&status=Available` : API_VARIANTS_URL;
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        return await response.json();
    }
    catch (error) {
        console.error("Lỗi khi tải biến thể:", error);
        return [];
    }
};
export const taoDonHang = async (orderData) => {
    const response = await fetch(API_ORDERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    });
    if (!response.ok)
        throw new Error("Lỗi khi tạo đơn hàng");
    return await response.json();
};
export const taoChiTietDonHang = async (detailData) => {
    const response = await fetch(API_ORDER_DETAILS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailData)
    });
    if (!response.ok)
        throw new Error("Lỗi khi tạo chi tiết đơn hàng");
    return await response.json();
};
export const layDonHangDangMoCuaBan = async (tableId) => {
    const response = await fetch(`${API_ORDERS_URL}?table_id=${tableId}&status=In_Progress`);
    if (!response.ok)
        throw new Error("Lỗi kiểm tra đơn hàng");
    return await response.json();
};
export const capNhatTrangThaiBan = async (tableId, status, pax) => {
    const body = { status };
    if (pax !== undefined)
        body.current_pax = pax;
    const response = await fetch(`${API_TABLES_URL}/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok)
        throw new Error("Lỗi cập nhật trạng thái bàn");
    return await response.json();
};
export const capNhatSoLuongMon = async (detailId, newQuantity) => {
    const response = await fetch(`${API_ORDER_DETAILS_URL}/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity })
    });
    if (!response.ok)
        throw new Error("Lỗi khi cập nhật số lượng món");
    return await response.json();
};
export const capNhatTongTienDonHang = async (orderId, newTotal) => {
    const response = await fetch(`${API_ORDERS_URL}/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: newTotal })
    });
    if (!response.ok)
        throw new Error("Lỗi cập nhật tổng tiền");
    return await response.json();
};
export const layDanhSachMonChoNau = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Cooking");
    if (!response.ok)
        throw new Error("Lỗi khi tải danh sách món chờ nấu");
    return await response.json();
};
export const capNhatTrangThaiMon = async (id, status) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok)
        throw new Error("Lỗi khi cập nhật trạng thái");
    return await response.json();
};
export const layDanhSachMonSanSang = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Ready");
    if (!response.ok)
        throw new Error("Lỗi khi tải danh sách món sẵn sàng");
    return await response.json();
};
export const capNhatTrangThaiMenu = async (id, status) => {
    const response = await fetch(API_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok)
        throw new Error("Lỗi khi cập nhật trạng thái menu");
    return await response.json();
};
export const layDanhSachHoaDonChuaThanhToan = async () => {
    const response = await fetch(API_ORDERS_URL + "?paymentStatus=Unpaid");
    if (!response.ok)
        throw new Error("Lỗi khi tải hóa đơn");
    return await response.json();
};
export const thanhToanHoaDon = async (id, updateData) => {
    const response = await fetch(API_ORDERS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!response.ok)
        throw new Error("Lỗi khi thanh toán");
    return await response.json();
};
export const taoCaLamViec = async (shiftData) => {
    const response = await fetch(API_SHIFTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
    });
    return await response.json();
};
export const ketThucCaLamViec = async (id, shiftData) => {
    const response = await fetch(API_SHIFTS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
    });
    return await response.json();
};
export const layDanhSachMonChoXacNhan = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Pending");
    if (!response.ok)
        throw new Error("Lỗi khi tải danh sách chờ xác nhận");
    return await response.json();
};
export const layDanhSachBan = async () => {
    const response = await fetch(API_TABLES_URL);
    if (!response.ok)
        throw new Error("Lỗi khi tải bàn");
    return await response.json();
};
export const layTatCaDonHang = async () => {
    const response = await fetch(API_ORDERS_URL);
    if (!response.ok)
        throw new Error("Lỗi khi tải tất cả đơn hàng");
    return await response.json();
};
export const layChiTietCuaDon = async (orderId) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?order_id=" + orderId);
    if (!response.ok)
        throw new Error("Lỗi khi tải chi tiết");
    return await response.json();
};
export const taoMonAn = async (data) => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi tạo món ăn');
    return await response.json();
};
export const suaMonAn = async (id, data) => {
    const response = await fetch(API_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi sửa món ăn');
    return await response.json();
};
export const xoaMonAn = async (id) => {
    const response = await fetch(API_URL + '/' + id, { method: 'DELETE' });
    if (!response.ok)
        throw new Error('Lỗi xóa món ăn');
    return await response.json();
};
export const taoDanhMuc = async (data) => {
    const response = await fetch(API_CATEGORY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi tạo danh mục');
    return await response.json();
};
export const suaDanhMuc = async (id, data) => {
    const response = await fetch(API_CATEGORY_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi sửa danh mục');
    return await response.json();
};
export const xoaDanhMuc = async (id) => {
    const response = await fetch(API_CATEGORY_URL + '/' + id, { method: 'DELETE' });
    if (!response.ok)
        throw new Error('Lỗi xóa danh mục');
    return await response.json();
};
export const capNhatChiTietDonHang = async (id, updateData) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!response.ok)
        throw new Error("Lỗi khi cập nhật chi tiết");
    return await response.json();
};
export const xoaChiTietDonHang = async (id) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, { method: 'DELETE' });
    if (!response.ok)
        throw new Error('Lỗi xóa chi tiết');
    return await response.json();
};
export const capNhatDonHang = async (id, updateData) => {
    const response = await fetch(API_ORDERS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!response.ok)
        throw new Error("Lỗi khi cập nhật đơn hàng");
    return await response.json();
};
