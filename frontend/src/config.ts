/**
 * =========================================================================
 * BẢNG CẤU HÌNH ĐƯỜNG DẪN API VÀ ĐẶC TẢ DỮ LIỆU TRẢ VỀ (API DOCUMENTATION)
 * =========================================================================
 * Dự án hỗ trợ 2 chế độ chạy:
 * - Môn 1: JSON-Server (Port 3000) -> Mapping trực tiếp vào database `db.json`
 * - Môn 2: Express Backend NodeJS & MongoDB (Port 4000) -> Mapping qua `/api/...`
 */

export const API_BACKEND_URL = "http://localhost:4000/api";

// 1. MENU & MÓN ĂN
export const API_URL = `${API_BACKEND_URL}/menu`; 

// 2. DANH MỤC MÓN ĂN (CATEGORIES)
export const API_CATEGORY_URL = `${API_BACKEND_URL}/categories`;

// 3. ĐƠN HÀNG (ORDERS)
export const API_ORDERS_URL = `${API_BACKEND_URL}/orders`;

// 4. CHI TIẾT MÓN TRONG ĐƠN (ORDER DETAILS / KDS BẾP)
export const API_ORDER_DETAILS_URL = `${API_BACKEND_URL}/order-details`;

// 5. CA LÀM VIỆC THU NGÂN (SHIFTS)
export const API_SHIFTS_URL = `${API_BACKEND_URL}/shifts`;

// 6. SƠ ĐỒ BÀN ĂN (TABLES)
export const API_TABLES_URL = `${API_BACKEND_URL}/tables`;

// 7. BIẾN THỂ MÓN ĂN (VARIANTS - SIZE, TOPPING, ĐỘ NGỌT)
export const API_VARIANTS_URL = `${API_BACKEND_URL}/variants`;

// 8. TÀI KHOẢN NGƯỜI DÙNG & NHÂN VIÊN (USERS)
export const API_USERS_URL = `${API_BACKEND_URL}/users`;

// 9. CHI NHÁNH NHÀ HÀNG (BRANCHES)
export const API_BRANCHES_URL = `${API_BACKEND_URL}/branches`;

// 10. NGUYÊN LIỆU KHO (INGREDIENTS)
export const API_INGREDIENTS_URL = `${API_BACKEND_URL}/inventory`;

// 11. ĐỊNH LƯỢNG MÓN ĂN (RECIPES)
export const API_RECIPES_URL = `${API_BACKEND_URL}/recipes`;

// 12. GIAO DỊCH TIỀN MẶT / QUỸ THU CHI (CASH TRANSACTIONS)
export const API_CASH_TRANSACTIONS_URL = `${API_BACKEND_URL}/cash-transactions`;

// 13. ĐÁNH GIÁ & PHẢN HỒI KHÁCH HÀNG (FEEDBACKS)
export const API_FEEDBACKS_URL = `${API_BACKEND_URL}/feedbacks`;

// 14. KHUYẾN MÃI & MÃ GIẢM GIÁ (VOUCHERS)
export const API_VOUCHERS_URL = `${API_BACKEND_URL}/vouchers`;

// 15. KHÁCH HÀNG THÂN THIẾT & TÍCH ĐIỂM (CUSTOMERS)
export const API_CUSTOMERS_URL = `${API_BACKEND_URL}/customers`;

// 16. NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT LOGS)
export const API_AUDIT_LOGS_URL = `${API_BACKEND_URL}/audit-logs`;

/**
 * =========================================================================
 * ĐƯỜNG DẪN GỐC BACKEND NODEJS EXPRESS & MONGODB (MÔN 2 - RESTFUL API)
 * =========================================================================
 * Prefix URL: http://localhost:4000/api
 * Các router con:
 * - /auth/login         -> Đăng nhập, cấp phát JWT Access Token & Refresh Token
 * - /auth/register      -> Đăng ký nhân viên mới, mã hóa bcrypt mật khẩu
 */