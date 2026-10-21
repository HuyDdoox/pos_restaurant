import { API_URL, API_CATEGORY_URL, API_ORDERS_URL, API_ORDER_DETAILS_URL, API_TABLES_URL, API_SHIFTS_URL, API_VARIANTS_URL, API_USERS_URL, API_BRANCHES_URL, API_INGREDIENTS_URL, API_RECIPES_URL, API_CASH_TRANSACTIONS_URL, API_FEEDBACKS_URL, API_VOUCHERS_URL, API_CUSTOMERS_URL, API_AUDIT_LOGS_URL } from './config';
export const unpackData = (res) => {
    if (res && res.data !== undefined)
        return res.data;
    return res;
};
export const layDanhSachMonAn = async () => {
    try {
        const response = await fetch(API_URL);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
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
        const json = await response.json();
        return unpackData(json) || [];
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu danh mục:", error);
        return [];
    }
};
export const layDanhSachIngredients = async () => {
    try {
        const response = await fetch(API_INGREDIENTS_URL);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu nguyên liệu:", error);
        return [];
    }
};
export const layDanhSachRecipes = async () => {
    try {
        const response = await fetch(API_RECIPES_URL);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu công thức:", error);
        return [];
    }
};
export const layDanhSachChiNhanh = async () => {
    try {
        const response = await fetch(API_BRANCHES_URL);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
    }
    catch (error) {
        console.error("Lỗi khi tải dữ liệu chi nhánh:", error);
        return [];
    }
};
export const layDanhSachVariants = async (menuItem_id) => {
    try {
        const url = menuItem_id ? `${API_VARIANTS_URL}?menuItem_id=${menuItem_id}&status=Available` : API_VARIANTS_URL;
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
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
    const response = await fetch(`${API_ORDERS_URL}?table_id=${tableId}&status=In_Progress&status=Waiting_Payment`);
    if (!response.ok)
        throw new Error("Lỗi kiểm tra đơn hàng");
    return unpackData(await response.json());
};
export const capNhatTrangThaiBan = async (tableId, status, pax) => {
    const body = { status };
    if (pax !== undefined)
        body.current_pax = pax;
    let response = await fetch(`${API_TABLES_URL}/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok && response.status === 404) {
        try {
            const allRes = await fetch(API_TABLES_URL);
            if (allRes.ok) {
                const rawList = await allRes.json();
                const list = unpackData(rawList) || [];
                const clean = tableId.trim().toLowerCase();
                const matched = list.find((t) => String(t.id).toLowerCase() === clean ||
                    String(t.id).replace(/^t0*/i, 't') === clean.replace(/^t0*/i, 't') ||
                    String(t.tableNumber).toLowerCase() === clean ||
                    `bàn ${clean.replace(/\D/g, '')}` === String(t.tableNumber).toLowerCase());
                if (matched) {
                    response = await fetch(`${API_TABLES_URL}/${matched.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                }
            }
        }
        catch (_) { }
    }
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
    return unpackData(await response.json()) || [];
};
export const capNhatTrangThaiMon = async (id, status, incidentNote) => {
    const payload = { status };
    if (incidentNote !== undefined)
        payload.incidentNote = incidentNote;
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok)
        throw new Error("Lỗi khi cập nhật trạng thái");
    return await response.json();
};
export const layDanhSachMonSanSang = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Ready");
    if (!response.ok)
        throw new Error("Lỗi khi tải danh sách món sẵn sàng");
    return unpackData(await response.json()) || [];
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
    const response = await fetch(API_ORDERS_URL + "?paymentStatus=Unpaid&paymentStatus=unpaid");
    if (!response.ok)
        throw new Error("Lỗi khi tải hóa đơn");
    return unpackData(await response.json()) || [];
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
export const layCaHienTai = async () => {
    try {
        const response = await fetch(`${API_SHIFTS_URL}/current`);
        if (!response.ok)
            return null;
        return unpackData(await response.json());
    }
    catch {
        return null;
    }
};
export const layThongTinCaLamViec = async (id) => {
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id))
        return null;
    try {
        const response = await fetch(`${API_SHIFTS_URL}/${id}`);
        if (!response.ok)
            return null;
        return unpackData(await response.json());
    }
    catch {
        return null;
    }
};
export const layTatCaCaLamViec = async () => {
    try {
        const response = await fetch(API_SHIFTS_URL);
        if (!response.ok)
            return [];
        return unpackData(await response.json()) || [];
    }
    catch {
        return [];
    }
};
export const layDanhSachMonChoXacNhan = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Pending");
    if (!response.ok)
        throw new Error("Lỗi khi tải danh sách chờ xác nhận");
    return unpackData(await response.json()) || [];
};
export const layDanhSachBan = async () => {
    const response = await fetch(API_TABLES_URL);
    if (!response.ok)
        throw new Error("Lỗi khi tải bàn");
    return unpackData(await response.json()) || [];
};
export const layTatCaDonHang = async (branchId) => {
    const response = await fetch(API_ORDERS_URL);
    if (!response.ok)
        throw new Error("Lỗi khi tải tất cả đơn hàng");
    const rawOrders = await response.json();
    const orders = unpackData(rawOrders) || [];
    if (!Array.isArray(orders))
        return [];
    if (!branchId || branchId === 'all' || branchId === '')
        return orders;
    try {
        const tablesRes = await fetch(API_TABLES_URL);
        if (tablesRes.ok) {
            const rawTables = await tablesRes.json();
            const tables = unpackData(rawTables) || [];
            const branchTableIds = tables.filter((t) => t.branch_id === branchId).map((t) => t.id || t._id);
            return orders.filter((o) => o.branch_id === branchId || branchTableIds.includes(o.table_id?._id || o.table_id?.id || o.table_id));
        }
    }
    catch (e) {
        console.error("Lỗi khi map tables theo branch:", e);
    }
    return orders.filter((o) => o.branch_id === branchId);
};
export const layTatCaChiTietDon = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL);
    if (!response.ok)
        throw new Error("Lỗi khi tải chi tiết");
    return unpackData(await response.json()) || [];
};
export const layChiTietCuaDon = async (orderId) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?order_id=" + orderId);
    if (!response.ok)
        throw new Error("Lỗi khi tải chi tiết");
    return unpackData(await response.json()) || [];
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi sửa món ăn');
    return await response.json();
};
export const xoaMonAn = async (id, deletedBy) => {
    const response = await fetch(API_URL + '/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: "Archived",
            deletedAt: new Date().toISOString(),
            deletedBy: deletedBy
        })
    });
    if (!response.ok)
        throw new Error('Lỗi xóa món ăn (Soft Delete)');
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
    const response = await fetch(API_CATEGORY_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Inactive' })
    });
    if (!response.ok)
        throw new Error('Lỗi ẩn danh mục');
    return await response.json();
};
export const doiTrangThaiDanhMuc = async (id, status) => {
    const response = await fetch(API_CATEGORY_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok)
        throw new Error('Lỗi cập nhật trạng thái danh mục');
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
export const layDanhSachNguoiDung = async (branchId) => {
    const url = branchId && branchId !== 'all' ? `${API_USERS_URL}?branch_id=${branchId}` : API_USERS_URL;
    const response = await fetch(url);
    if (!response.ok)
        throw new Error('Lỗi lấy danh sách người dùng');
    return unpackData(await response.json()) || [];
};
export const taoNguoiDung = async (data) => {
    const response = await fetch(API_USERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi tạo người dùng');
    return await response.json();
};
export const suaNguoiDung = async (id, data) => {
    const response = await fetch(API_USERS_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error('Lỗi sửa người dùng');
    return await response.json();
};
export const capNhatTrangThaiNguoiDung = async (id, status) => {
    const response = await fetch(API_USERS_URL + '/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok)
        throw new Error('Lỗi đổi trạng thái người dùng');
    return await response.json();
};
export const layDanhSachNguyenLieu = async () => {
    const response = await fetch(API_INGREDIENTS_URL);
    if (!response.ok)
        throw new Error("Lỗi mạng");
    return unpackData(await response.json()) || [];
};
export const layTatCaCongThuc = async () => {
    const response = await fetch(API_RECIPES_URL);
    if (!response.ok)
        throw new Error("Lỗi mạng");
    return unpackData(await response.json()) || [];
};
export const layDanhSachCashTransactions = async (shiftId) => {
    try {
        const isValidShift = shiftId && /^[0-9a-fA-F]{24}$/.test(shiftId);
        const url = isValidShift ? `${API_CASH_TRANSACTIONS_URL}?shift_id=${shiftId}` : API_CASH_TRANSACTIONS_URL;
        const response = await fetch(url);
        if (!response.ok)
            return [];
        const json = await response.json();
        const data = Array.isArray(json) ? json : (unpackData(json) || []);
        return Array.isArray(data) ? data : [];
    }
    catch (e) {
        console.error("Lỗi khi tải danh sách phiếu thu/chi:", e);
        return [];
    }
};
export const taoCashTransaction = async (data) => {
    const response = await fetch(API_CASH_TRANSACTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok)
        throw new Error("Lỗi khi tạo phiếu thu/chi");
    return await response.json();
};
export const chuyenBanDonHang = async (orderId, oldTableId, newTableId, reason) => {
    const orderRes = await fetch(`${API_ORDERS_URL}/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            table_id: newTableId,
            transferHistory: {
                fromTable: oldTableId,
                toTable: newTableId,
                transferredAt: new Date().toISOString(),
                reason: reason || 'Chuyển bàn theo yêu cầu của khách'
            }
        })
    });
    if (!orderRes.ok)
        throw new Error("Lỗi khi cập nhật bàn cho hóa đơn");
    await fetch(`${API_TABLES_URL}/${oldTableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Available' })
    });
    await fetch(`${API_TABLES_URL}/${newTableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Occupied' })
    });
    return await orderRes.json();
};
export const taoFeedback = async (data) => {
    try {
        const response = await fetch(API_FEEDBACKS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok)
            throw new Error("Lỗi lưu đánh giá");
        return await response.json();
    }
    catch (e) {
        console.error("Lỗi khi gửi đánh giá:", e);
        return null;
    }
};
export const layDanhSachFeedback = async () => {
    try {
        const response = await fetch(API_FEEDBACKS_URL);
        if (!response.ok)
            return [];
        return unpackData(await response.json()) || [];
    }
    catch {
        return [];
    }
};
export const layDanhSachVouchers = async () => {
    try {
        const response = await fetch(API_VOUCHERS_URL);
        if (response.ok) {
            const data = unpackData(await response.json()) || [];
            localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(data));
            return data;
        }
    }
    catch (e) {
        console.warn("Dùng cache vouchers từ localStorage:", e);
    }
    const cached = localStorage.getItem('foodhub_vouchers_cache');
    return cached ? JSON.parse(cached) : [];
};
export const taoVoucher = async (voucherData) => {
    try {
        const response = await fetch(API_VOUCHERS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(voucherData)
        });
        if (response.ok)
            return await response.json();
    }
    catch (e) {
        console.warn("Lưu voucher vào localStorage do offline:", e);
    }
    const list = await layDanhSachVouchers();
    list.unshift(voucherData);
    localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(list));
    return voucherData;
};
export const suaVoucher = async (id, updateData) => {
    try {
        const response = await fetch(`${API_VOUCHERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (response.ok)
            return await response.json();
    }
    catch (e) {
        console.warn("Cập nhật voucher offline:", e);
    }
    const list = await layDanhSachVouchers();
    const index = list.findIndex(v => String(v.id) === String(id));
    if (index !== -1) {
        list[index] = { ...list[index], ...updateData };
        localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(list));
        return list[index];
    }
    return null;
};
export const xoaVoucher = async (id) => {
    try {
        await fetch(`${API_VOUCHERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Inactive' })
        });
    }
    catch (e) {
        console.warn("Lỗi cập nhật voucher:", e);
    }
    const list = await layDanhSachVouchers();
    const v = list.find(item => String(item.id) === String(id));
    if (v)
        v.status = 'Inactive';
    localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(list));
    return true;
};
export const layDanhSachCustomers = async () => {
    try {
        const response = await fetch(API_CUSTOMERS_URL);
        if (response.ok) {
            const data = unpackData(await response.json()) || [];
            localStorage.setItem('foodhub_customers_cache', JSON.stringify(data));
            return data;
        }
    }
    catch (e) {
        console.warn("Dùng cache customers từ localStorage:", e);
    }
    const cached = localStorage.getItem('foodhub_customers_cache');
    return cached ? JSON.parse(cached) : [];
};
export const taoCustomer = async (custData) => {
    try {
        const response = await fetch(API_CUSTOMERS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(custData)
        });
        if (response.ok)
            return await response.json();
    }
    catch (e) {
        console.warn("Lưu customer offline:", e);
    }
    const list = await layDanhSachCustomers();
    list.unshift(custData);
    localStorage.setItem('foodhub_customers_cache', JSON.stringify(list));
    return custData;
};
export const suaCustomer = async (id, updateData) => {
    try {
        const response = await fetch(`${API_CUSTOMERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (response.ok)
            return await response.json();
    }
    catch (e) {
        console.warn("Cập nhật customer offline:", e);
    }
    const list = await layDanhSachCustomers();
    const idx = list.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...updateData };
        localStorage.setItem('foodhub_customers_cache', JSON.stringify(list));
        return list[idx];
    }
    return null;
};
export const xoaCustomer = async (id) => {
    try {
        await fetch(`${API_CUSTOMERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Inactive' })
        });
    }
    catch (e) {
        console.warn("Lỗi cập nhật customer:", e);
    }
    const list = await layDanhSachCustomers();
    const c = list.find(item => String(item.id) === String(id));
    if (c)
        c.status = 'Inactive';
    localStorage.setItem('foodhub_customers_cache', JSON.stringify(list));
    return true;
};
export const layDanhSachAuditLogs = async () => {
    try {
        const response = await fetch(API_AUDIT_LOGS_URL);
        if (response.ok) {
            const data = unpackData(await response.json()) || [];
            return data;
        }
    }
    catch (e) {
        console.warn("Dùng fallback audit logs:", e);
    }
    const localLogs = JSON.parse(localStorage.getItem('foodhub_audit_logs') || '[]');
    return localLogs;
};
export const ghiAuditLog = async (category, action, detail, actor = 'Quản trị viên (Admin)', severity = 'info') => {
    const logItem = {
        id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        category,
        actor,
        action,
        detail,
        severity
    };
    try {
        await fetch(API_AUDIT_LOGS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logItem)
        });
    }
    catch (e) {
        const current = JSON.parse(localStorage.getItem('foodhub_audit_logs') || '[]');
        current.unshift(logItem);
        if (current.length > 200)
            current.pop();
        localStorage.setItem('foodhub_audit_logs', JSON.stringify(current));
    }
    return logItem;
};
