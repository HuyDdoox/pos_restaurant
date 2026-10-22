import { API_URL, API_CATEGORY_URL, API_ORDERS_URL, API_ORDER_DETAILS_URL, API_TABLES_URL, API_SHIFTS_URL, API_VARIANTS_URL, API_USERS_URL, API_BRANCHES_URL, API_INGREDIENTS_URL, API_RECIPES_URL, API_CASH_TRANSACTIONS_URL, API_FEEDBACKS_URL, API_VOUCHERS_URL, API_CUSTOMERS_URL, API_AUDIT_LOGS_URL } from './config';
import { MenuItem, Category, Variant } from './interfaces';

// Helper bóc tách payload từ Node.js Express ({ status: 1, data: [...] }) hoặc json-server ([...])
export const unpackData = (res: any) => {
    if (res && res.data !== undefined) return res.data;
    return res;
};

export const layDanhSachMonAn = async (): Promise<MenuItem[]> => {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
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
        const json = await response.json();
        return unpackData(json) || [];
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu danh mục:", error);
        return []; 
    }
};

export const layDanhSachIngredients = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_INGREDIENTS_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu nguyên liệu:", error);
        return []; 
    }
};

export const layDanhSachRecipes = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_RECIPES_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu công thức:", error);
        return []; 
    }
};

export const layDanhSachChiNhanh = async () => {
    try {
        const response = await fetch(API_BRANCHES_URL);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        const json = await response.json();
        return unpackData(json) || [];
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
        const json = await response.json();
        return unpackData(json) || [];
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
    const json = await response.json();
    return unpackData(json);
};

export const taoChiTietDonHang = async (detailData: any) => {
    const response = await fetch(API_ORDER_DETAILS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailData)
    });
    if (!response.ok) throw new Error("Lỗi khi tạo chi tiết đơn hàng");
    const json = await response.json();
    return unpackData(json);
};

export const layDonHangDangMoCuaBan = async (tableId: string) => {
    const response = await fetch(`${API_ORDERS_URL}?table_id=${tableId}&status=In_Progress&status=Waiting_Payment`);
    if (!response.ok) throw new Error("Lỗi kiểm tra đơn hàng");
    return unpackData(await response.json());
};

export const capNhatTrangThaiBan = async (tableId: string, status: string, pax?: number) => {
    const body: any = { status };
    if (pax !== undefined) body.current_pax = pax;
    
    let response = await fetch(`${API_TABLES_URL}/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    // Nếu 404 (ví dụ tableId là T2 thay vì T002), tự động tìm bàn tương ứng
    if (!response.ok && response.status === 404) {
        try {
            const allRes = await fetch(API_TABLES_URL);
            if (allRes.ok) {
                const rawList = await allRes.json();
                const list = unpackData(rawList) || [];
                const clean = tableId.trim().toLowerCase();
                const matched = list.find((t: any) => 
                    String(t.id).toLowerCase() === clean ||
                    String(t.id).replace(/^t0*/i, 't') === clean.replace(/^t0*/i, 't') ||
                    String(t.tableNumber).toLowerCase() === clean ||
                    `bàn ${clean.replace(/\D/g, '')}` === String(t.tableNumber).toLowerCase()
                );
                if (matched) {
                    response = await fetch(`${API_TABLES_URL}/${matched.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                }
            }
        } catch (_) {}
    }
    
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
    return unpackData(await response.json()) || [];
};

export const capNhatTrangThaiMon = async (id: string, status: string, incidentNote?: string) => {
    const payload: any = { status };
    if (incidentNote !== undefined) payload.incidentNote = incidentNote;
    const response = await fetch(API_ORDER_DETAILS_URL + "/" + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật trạng thái");
    return await response.json();
};

export const layDanhSachMonSanSang = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Ready");
    if (!response.ok) throw new Error("Lỗi khi tải danh sách món sẵn sàng");
    return unpackData(await response.json()) || [];
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
    const response = await fetch(API_ORDERS_URL + "?paymentStatus=Unpaid&paymentStatus=unpaid");
    if (!response.ok) throw new Error("Lỗi khi tải hóa đơn");
    return unpackData(await response.json()) || [];
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

export const layCaHienTai = async () => {
    try {
        const response = await fetch(`${API_SHIFTS_URL}/current`);
        if (!response.ok) return null;
        return unpackData(await response.json());
    } catch {
        return null;
    }
};

export const layThongTinCaLamViec = async (id: string) => {
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) return null;
    try {
        const response = await fetch(`${API_SHIFTS_URL}/${id}`);
        if (!response.ok) return null;
        return unpackData(await response.json());
    } catch {
        return null;
    }
};

export const layTatCaCaLamViec = async () => {
    try {
        const response = await fetch(API_SHIFTS_URL);
        if (!response.ok) return [];
        return unpackData(await response.json()) || [];
    } catch {
        return [];
    }
};

export const layDanhSachMonChoXacNhan = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?status=Pending");
    if (!response.ok) throw new Error("Lỗi khi tải danh sách chờ xác nhận");
    return unpackData(await response.json()) || [];
};

export const layDanhSachBan = async () => {
    const response = await fetch(API_TABLES_URL);
    if (!response.ok) throw new Error("Lỗi khi tải bàn");
    return unpackData(await response.json()) || [];
};

export const layTatCaDonHang = async (branchId?: string) => {
    const response = await fetch(API_ORDERS_URL);
    if (!response.ok) throw new Error("Lỗi khi tải tất cả đơn hàng");
    const rawOrders = await response.json();
    const orders = unpackData(rawOrders) || [];
    if (!Array.isArray(orders)) return [];
    if (!branchId || branchId === 'all' || branchId === '') return orders;
    
    try {
        const tablesRes = await fetch(API_TABLES_URL);
        if (tablesRes.ok) {
            const rawTables = await tablesRes.json();
            const tables = unpackData(rawTables) || [];
            const branchTableIds = tables.filter((t: any) => t.branch_id === branchId).map((t: any) => t.id || t._id);
            return orders.filter((o: any) => o.branch_id === branchId || branchTableIds.includes(o.table_id?._id || o.table_id?.id || o.table_id));
        }
    } catch(e) {
        console.error("Lỗi khi map tables theo branch:", e);
    }
    return orders.filter((o: any) => o.branch_id === branchId);
};

export const layTatCaChiTietDon = async () => {
    const response = await fetch(API_ORDER_DETAILS_URL);
    if (!response.ok) throw new Error("Lỗi khi tải chi tiết");
    return unpackData(await response.json()) || [];
};

export const layChiTietCuaDon = async (orderId: string) => {
    const response = await fetch(API_ORDER_DETAILS_URL + "?order_id=" + orderId);
    if (!response.ok) throw new Error("Lỗi khi tải chi tiết");
    return unpackData(await response.json()) || [];
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
    // Soft Delete: Chỉ đổi trạng thái sang Inactive, không xóa vĩnh viễn
    const response = await fetch(API_CATEGORY_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Inactive' })
    });
    if (!response.ok) throw new Error('Lỗi ẩn danh mục');
    return await response.json();
};

export const doiTrangThaiDanhMuc = async (id: string, status: string) => {
    const response = await fetch(API_CATEGORY_URL + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Lỗi cập nhật trạng thái danh mục');
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
    return unpackData(await response.json()) || [];
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
    return unpackData(await response.json()) || [];
};

export const layTatCaCongThuc = async () => {
    const response = await fetch(API_RECIPES_URL);
    if (!response.ok) throw new Error("Lỗi mạng");
    return unpackData(await response.json()) || [];
};

export const layDanhSachCashTransactions = async (shiftId?: string) => {
    try {
        const isValidShift = shiftId && /^[0-9a-fA-F]{24}$/.test(shiftId);
        const url = isValidShift ? `${API_CASH_TRANSACTIONS_URL}?shift_id=${shiftId}` : API_CASH_TRANSACTIONS_URL;
        const response = await fetch(url);
        if (!response.ok) return [];
        const json = await response.json();
        const data = Array.isArray(json) ? json : (unpackData(json) || []);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Lỗi khi tải danh sách phiếu thu/chi:", e);
        return [];
    }
};

export const taoCashTransaction = async (data: any) => {
    const response = await fetch(API_CASH_TRANSACTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Lỗi khi tạo phiếu thu/chi");
    return await response.json();
};

export const chuyenBanDonHang = async (orderId: string | number, oldTableId: string, newTableId: string, reason?: string) => {
    // 1. Cập nhật Order sang table_id mới
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
    if (!orderRes.ok) throw new Error("Lỗi khi cập nhật bàn cho hóa đơn");

    // 2. Trả bàn cũ về Available
    await fetch(`${API_TABLES_URL}/${oldTableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Available' })
    });

    // 3. Cập nhật bàn mới thành Occupied
    await fetch(`${API_TABLES_URL}/${newTableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Occupied' })
    });

    return await orderRes.json();
};

export const taoFeedback = async (data: any) => {
    try {
        const response = await fetch(API_FEEDBACKS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Lỗi lưu đánh giá");
        return await response.json();
    } catch (e) {
        console.error("Lỗi khi gửi đánh giá:", e);
        return null;
    }
};

export const layDanhSachFeedback = async () => {
    try {
        const response = await fetch(API_FEEDBACKS_URL);
        if (!response.ok) return [];
        return unpackData(await response.json()) || [];
    } catch {
        return [];
    }
};

// ==========================================
// VOUCHERS & PROMOTIONS API (GÓI 2)
// ==========================================
export const layDanhSachVouchers = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_VOUCHERS_URL);
        if (response.ok) {
            const data = unpackData(await response.json()) || [];
            localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(data));
            return data;
        }
    } catch (e) {
        console.warn("Dùng cache vouchers từ localStorage:", e);
    }
    const cached = localStorage.getItem('foodhub_vouchers_cache');
    return cached ? JSON.parse(cached) : [];
};

export const taoVoucher = async (voucherData: any) => {
    try {
        const response = await fetch(API_VOUCHERS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(voucherData)
        });
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn("Lưu voucher vào localStorage do offline:", e);
    }
    const list = await layDanhSachVouchers();
    list.unshift(voucherData);
    localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(list));
    return voucherData;
};

export const suaVoucher = async (id: string, updateData: any) => {
    try {
        const response = await fetch(`${API_VOUCHERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (response.ok) return await response.json();
    } catch (e) {
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

export const xoaVoucher = async (id: string) => {
    // Soft Delete: Chuyển sang Inactive
    try {
        await fetch(`${API_VOUCHERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Inactive' })
        });
    } catch (e) {
        console.warn("Lỗi cập nhật voucher:", e);
    }
    const list = await layDanhSachVouchers();
    const v = list.find(item => String(item.id) === String(id));
    if (v) v.status = 'Inactive';
    localStorage.setItem('foodhub_vouchers_cache', JSON.stringify(list));
    return true;
};

// ==========================================
// CUSTOMERS & VIP LOYALTY API (GÓI 2)
// ==========================================
export const layDanhSachCustomers = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_CUSTOMERS_URL);
        if (response.ok) {
            const data = unpackData(await response.json()) || [];
            localStorage.setItem('foodhub_customers_cache', JSON.stringify(data));
            return data;
        }
    } catch (e) {
        console.warn("Dùng cache customers từ localStorage:", e);
    }
    const cached = localStorage.getItem('foodhub_customers_cache');
    return cached ? JSON.parse(cached) : [];
};

export const taoCustomer = async (custData: any) => {
    try {
        const response = await fetch(API_CUSTOMERS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(custData)
        });
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn("Lưu customer offline:", e);
    }
    const list = await layDanhSachCustomers();
    list.unshift(custData);
    localStorage.setItem('foodhub_customers_cache', JSON.stringify(list));
    return custData;
};

export const suaCustomer = async (id: string, updateData: any) => {
    try {
        const response = await fetch(`${API_CUSTOMERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (response.ok) return await response.json();
    } catch (e) {
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

export const xoaCustomer = async (id: string) => {
    // Soft Delete: Chuyển sang Inactive
    try {
        await fetch(`${API_CUSTOMERS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Inactive' })
        });
    } catch (e) {
        console.warn("Lỗi cập nhật customer:", e);
    }
    const list = await layDanhSachCustomers();
    const c = list.find(item => String(item.id) === String(id));
    if (c) c.status = 'Inactive';
    localStorage.setItem('foodhub_customers_cache', JSON.stringify(list));
    return true;
};

// ==========================================
// AUDIT LOGS API (GÓI 3)
// ==========================================
export const layDanhSachAuditLogs = async (): Promise<any[]> => {
    try {
        const response = await fetch(API_AUDIT_LOGS_URL);
        if (response.ok) {
            const data = unpackData(await response.json()) || [];
            return data;
        }
    } catch (e) {
        console.warn("Dùng fallback audit logs:", e);
    }
    const localLogs = JSON.parse(localStorage.getItem('foodhub_audit_logs') || '[]');
    return localLogs;
};

export const ghiAuditLog = async (
    category: 'financial' | 'order' | 'inventory' | 'security' | 'system',
    action: string,
    detail: string,
    actor: string = 'Quản trị viên (Admin)',
    severity: 'info' | 'warning' | 'danger' = 'info'
) => {
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
    } catch (e) {
        // Fallback local storage
        const current = JSON.parse(localStorage.getItem('foodhub_audit_logs') || '[]');
        current.unshift(logItem);
        if (current.length > 200) current.pop();
        localStorage.setItem('foodhub_audit_logs', JSON.stringify(current));
    }
    return logItem;
};


