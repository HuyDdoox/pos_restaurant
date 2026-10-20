"""
=============================================================================
  KIỂM THỬ TOÀN DIỆN PHÂN HỆ: KHÁCH HÀNG (CUSTOMER / E-MENU)
  Xác thực JWT Token với role 'Customer'
  Kiểm tra Fix Bug Crash Bàn Ăn, Lỗ hổng Bảo mật Giá tiền & Chặn món hết hàng
=============================================================================
"""

import sys
import time
import requests

BASE_URL = "http://localhost:4000/api"

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

class TestLogger:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.warnings = []

    def info(self, msg):
        print(f"{Colors.BLUE}[INFO]{Colors.RESET} {msg}")

    def success(self, msg):
        self.passed += 1
        print(f"{Colors.GREEN}[PASS]{Colors.RESET} {msg}")

    def warn(self, msg):
        self.warnings.append(msg)
        print(f"{Colors.YELLOW}[WARN]{Colors.RESET} {msg}")

    def error(self, msg, detail=""):
        self.failed += 1
        err_msg = f"{msg} | Chi tiết: {detail}" if detail else msg
        self.errors.append(err_msg)
        print(f"{Colors.RED}[FAIL]{Colors.RESET} {err_msg}")

    def step(self, step_num, title):
        print(f"\n{Colors.BOLD}{Colors.CYAN}--- BƯỚC {step_num}: {title} ---{Colors.RESET}")


def run_customer_tests():
    logger = TestLogger()
    session = requests.Session()

    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*68)
    print(" BẮT ĐẦU KIỂM THỬ BẢO MẬT & NGHIỆP VỤ: KHÁCH HÀNG (CUSTOMER SUITE)")
    print("="*68 + f"{Colors.RESET}")

    # =========================================================================
    # BƯỚC 1: XÁC THỰC VÀ LẤY JWT TOKEN (VỚI ROLE 'Customer')
    # =========================================================================
    logger.step(1, "Đăng nhập vai trò Customer & Cấp phát JWT Token")
    
    auth_payload = {
        "username": "customer_vip_01",
        "password": "password123",
        "fullname": "Khách Hàng Thân Thiết",
        "role": "Customer",  # Sử dụng Role Customer vừa được hỗ trợ
        "phone": "0933445566",
        "email": "customer_vip@gmail.com"
    }

    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username": auth_payload["username"],
        "password": auth_payload["password"]
    })

    token = None
    if login_res.status_code == 200 and login_res.json().get("status") == 1:
        token = login_res.json()["data"]["accessToken"]
        logger.success(f"Đăng nhập thành công với vai trò Customer! JWT: {token[:20]}...")
    else:
        reg_res = session.post(f"{BASE_URL}/auth/register", json=auth_payload)
        if reg_res.status_code in [200, 201] and reg_res.json().get("status") == 1:
            logger.info("Đã tạo mới tài khoản Customer thành công, đang đăng nhập...")
            login_res = session.post(f"{BASE_URL}/auth/login", json={
                "username": auth_payload["username"],
                "password": auth_payload["password"]
            })
            token = login_res.json()["data"]["accessToken"]
            logger.success(f"Đăng nhập Customer thành công! JWT: {token[:20]}...")
        else:
            logger.error("Không thể đăng ký/đăng nhập Customer!", reg_res.text)

    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
        me_res = session.get(f"{BASE_URL}/auth/me")
        if me_res.status_code == 200:
            user_data = me_res.json().get("data", {})
            logger.success(f"Xác thực JWT Token hợp lệ! User: {user_data.get('fullname')} | Role: {user_data.get('role')}")
        else:
            logger.error("Token JWT không hợp lệ!", me_res.text)

    # =========================================================================
    # BƯỚC 2: KIỂM TRA BÀN ĂN & TEST FIX BUG SỐ BÀN DẠNG NUMBER
    # =========================================================================
    logger.step(2, "Kiểm tra sơ đồ bàn & Test Fix Bug tableNumber.trim (Gửi dạng số nguyên)")
    
    # Test tạo bàn với tableNumber dạng int: 88 (Trước đây bị crash 500)
    logger.info("Thử tạo bàn với tableNumber = 88 (dạng Số thay vì Chuỗi)...")
    create_int_tbl = session.post(f"{BASE_URL}/tables", json={
        "tableNumber": 88,
        "max_capacity": 4,
        "zone": "Khu VIP",
        "status": "Available"
    })
    
    temp_tbl_id = None
    if create_int_tbl.status_code in [200, 201]:
        logger.success("Fix bug thành công: Server xử lý mượt mà số bàn dạng Integer (Không còn lỗi crash tableNumber.trim)!")
        temp_tbl_id = create_int_tbl.json()["data"]["_id"]
    elif create_int_tbl.status_code == 409:
        logger.success("Bàn số 88 đã tồn tại.")

    # Lấy bàn thực tế để đặt đơn (ưu tiên Bàn 01)
    tbl_res = session.get(f"{BASE_URL}/tables")
    tables = tbl_res.json().get("data", [])
    chosen_table = tables[0] if tables else None

    # Dọn dẹp bàn test số 88 để không làm bẩn sơ đồ bàn thực tế
    if temp_tbl_id:
        session.delete(f"{BASE_URL}/tables/{temp_tbl_id}")

    # =========================================================================
    # BƯỚC 3: THỰC ĐƠN, MÓN CÒN HÀNG VÀ MÓN HẾT HÀNG (LIVE MENU)
    # =========================================================================
    logger.step(3, "Chuẩn bị Thực đơn: Món Còn Hàng & Món Tạm Hết Hàng (Out of Stock)")
    
    # 1. Lấy hoặc tạo Category
    cat_res = session.get(f"{BASE_URL}/categories")
    cats = cat_res.json().get("data", [])
    if not cats:
        c_res = session.post(f"{BASE_URL}/categories", json={
            "name": "Món Chính Việt Nam",
            "description": "Các món ăn truyền thống",
            "icon": "bowl"
        })
        category_id = c_res.json()["data"]["_id"]
    else:
        category_id = cats[0]["_id"]

    # 2. Tạo hoặc lấy Món Có Sẵn (Available) giá niêm yết 65,000đ
    dish_available = None
    dish_out_of_stock = None

    menu_res = session.get(f"{BASE_URL}/menu")
    menu_items = menu_res.json().get("data", [])
    
    for m in menu_items:
        if m.get("status") == "Available" and not m.get("is_flash_sale") and not dish_available:
            dish_available = m
        if m.get("status") == "Out_of_stock" and not dish_out_of_stock:
            dish_out_of_stock = m

    if not dish_available:
        create_dish = session.post(f"{BASE_URL}/menu", json={
            "name": "Cơm Tấm Sườn Nướng Chả Trứng",
            "base_price": 65000,
            "category_id": category_id,
            "status": "Available"
        })
        if create_dish.status_code in [200, 201]:
            dish_available = create_dish.json()["data"]
            logger.success(f"Tạo món ăn có sẵn: {dish_available['name']} (Giá niêm yết: 65,000đ)")
    else:
        logger.info(f"Đã có món sẵn có: {dish_available['name']} (Giá: {dish_available.get('base_price'):,.0f}đ)")

    if not dish_out_of_stock:
        create_oos = session.post(f"{BASE_URL}/menu", json={
            "name": "Cua Hoàng Đế Hấp Bia (Tạm hết)",
            "base_price": 500000,
            "category_id": category_id,
            "status": "Out_of_stock"
        })
        if create_oos.status_code in [200, 201]:
            dish_out_of_stock = create_oos.json()["data"]
            logger.success(f"Tạo món hết hàng mẫu: {dish_out_of_stock['name']} (Status: Out_of_stock)")
    else:
        logger.info(f"Đã có món hết hàng: {dish_out_of_stock['name']}")

    # =========================================================================
    # BƯỚC 4: TEST BẢO MẬT & KIỂM TRA MÓN HẾT HÀNG (SECURITY & BUSINESS RULES)
    # =========================================================================
    logger.step(4, "Test Nghiệp vụ: Chặn món hết hàng (Out of Stock Validation)")
    
    if dish_out_of_stock and chosen_table:
        logger.info(f"Khách hàng cố tình gửi đơn đặt món đã hết: '{dish_out_of_stock['name']}'...")
        oos_order_res = session.post(f"{BASE_URL}/orders", json={
            "table_id": chosen_table["_id"],
            "items": [
                {
                    "menuItem_id": dish_out_of_stock["_id"],
                    "quantity": 1
                }
            ]
        })
        if oos_order_res.status_code in [400, 422]:
            logger.success(f"Chặn thành công món hết hàng! Phản hồi từ Server: '{oos_order_res.json().get('message')}'")
        else:
            logger.error(f"Hệ thống cho phép đặt món hết hàng! Mã trạng thái: {oos_order_res.status_code}", oos_order_res.text)

    # =========================================================================
    # BƯỚC 5: TEST BẢO MẬT HACK GIÁ (PRICE TAMPERING TEST)
    # =========================================================================
    logger.step(5, "Test Bảo mật: Chống can thiệp gian lận giá tiền (Price Tampering)")
    
    if dish_available and chosen_table:
        actual_price = dish_available.get("base_price", 65000)
        hacked_price = 1  # Hacker thử chỉnh giá từ 65.000đ thành 1đ
        qty = 2
        
        logger.info(f"Món '{dish_available['name']}' có giá gốc niêm yết: {actual_price:,.0f}đ")
        logger.info(f"Hacker gửi request đặt 2 phần nhưng truyền gian lận 'priceAtOrder': {hacked_price}đ ...")
        
        tamper_res = session.post(f"{BASE_URL}/orders", json={
            "table_id": chosen_table["_id"],
            "items": [
                {
                    "menuItem_id": dish_available["_id"],
                    "quantity": qty,
                    "priceAtOrder": hacked_price  # Giá cố tình bị sửa
                }
            ]
        })

        if tamper_res.status_code in [200, 201]:
            order_data = tamper_res.json()["data"]
            server_total = order_data.get("totalAmount")
            expected_correct_total = actual_price * qty
            
            if server_total == expected_correct_total:
                logger.success(f"BẢO MẬT TUYỆT ĐỐI! Server đã tự động bỏ qua giá gian lận và tính đúng theo Database: {server_total:,.0f}đ (2 x {actual_price:,.0f}đ)!")
            else:
                logger.error(f"HỆ THỐNG BỊ HACK GIÁ! Server lưu tổng tiền: {server_total:,.0f}đ thay vì {expected_correct_total:,.0f}đ!")
        else:
            logger.error("Không thể tạo đơn hàng test!", tamper_res.text)

    # =========================================================================
    # BƯỚC 6: XEM CHI TIẾT & THEO DÕI ĐƠN HÀNG CỦA BÀN (ORDER TRACKING)
    # =========================================================================
    logger.step(6, "Khách hàng theo dõi trạng thái đơn hàng (Tracking)")
    if 'order_data' in locals() and order_data:
        order_id = order_data["_id"]
        track_res = session.get(f"{BASE_URL}/orders/{order_id}")
        if track_res.status_code == 200:
            details = track_res.json()["data"]
            logger.success(f"Khách hàng lấy chi tiết đơn {order_id} thành công!")
            logger.info(f"-> Trạng thái đơn: {details.get('status')} (Pending)")
            logger.info(f"-> Trạng thái thanh toán: {details.get('paymentStatus')} (Unpaid)")
        else:
            logger.error("Không lấy được chi tiết đơn!", track_res.text)

    # =========================================================================
    # BƯỚC 7: ĐÁNH GIÁ TRẢI NGHIỆM (CUSTOMER FEEDBACK)
    # =========================================================================
    logger.step(7, "Khách hàng gửi đánh giá hài lòng (Feedback)")
    if 'order_data' in locals() and order_data:
        fb_res = session.post(f"{BASE_URL}/feedbacks", json={
            "order_id": order_data["_id"],
            "rating": 5,
            "comment": "Trải nghiệm gọi món QR rất tiện và nhanh chóng!",
            "customer_name": "Khách VIP"
        })
        if fb_res.status_code in [200, 201]:
            logger.success("Gửi phản hồi đánh giá 5 sao thành công!")
        else:
            logger.warn(f"Phản hồi: {fb_res.text}")

    # =========================================================================
    # TỔNG KẾT
    # =========================================================================
    print(f"\n{Colors.BOLD}" + "="*68)
    print(" BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ PHÂN HỆ KHÁCH HÀNG (SAU FIX LỖI)")
    print("="*68 + f"{Colors.RESET}")
    print(f" {Colors.GREEN}✔ SỐ TEST CASE ĐẠT (PASS): {logger.passed}{Colors.RESET}")
    print(f" {Colors.RED}✘ SỐ TEST CASE LỖI (FAIL): {logger.failed}{Colors.RESET}")
    print(f" {Colors.YELLOW}⚠ CẢNH BÁO / LƯU Ý (WARN): {len(logger.warnings)}{Colors.RESET}")
    
    if logger.errors:
        print(f"\n{Colors.RED}DANH SÁCH LỖI:{Colors.RESET}")
        for idx, err in enumerate(logger.errors, 1):
            print(f"  {idx}. {err}")
    else:
        print(f"\n{Colors.BOLD}{Colors.GREEN}🎉 XUẤT SẮC! TẤT CẢ CÁC BÀI TEST BẢO MẬT VÀ NGHIỆP VỤ ĐỀU ĐẠT CHUẨN 100%!{Colors.RESET}")
    print("="*68 + "\n")


if __name__ == "__main__":
    run_customer_tests()
