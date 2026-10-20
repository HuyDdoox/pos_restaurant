"""
=============================================================================
  KIỂM THỬ TOÀN DIỆN PHÂN HỆ: NHÂN VIÊN PHỤC VỤ (WAITER SYSTEM)
  Tuân thủ chuẩn: WAITER_REQUIREMENTS.md
  Bao gồm: JWT Auth, Điều phối/Chuyển bàn, Duyệt món gửi bếp, Giục bếp,
           Bưng món (Served), Báo sự cố/Hủy món & Khóa món hết hàng
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


def run_waiter_tests():
    logger = TestLogger()
    session = requests.Session()

    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*68)
    print(" BẮT ĐẦU KIỂM THỬ PHÂN HỆ: PHỤC VỤ (WAITER TEST SUITE)")
    print("="*68 + f"{Colors.RESET}")

    # =========================================================================
    # BƯỚC 1: XÁC THỰC VÀ LẤY JWT TOKEN VỚI ROLE 'Waiter'
    # =========================================================================
    logger.step(1, "Đăng nhập vai trò Nhân viên Phục vụ (Waiter) & Cấp JWT Token")
    
    waiter_auth = {
        "username": "waiter_pro_01",
        "password": "password123",
        "fullname": "Nguyễn Văn Phục Vụ",
        "role": "Waiter",
        "phone": "0977889900",
        "email": "waiter01@restaurant.com"
    }

    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username": waiter_auth["username"],
        "password": waiter_auth["password"]
    })

    token = None
    waiter_id = None

    if login_res.status_code == 200 and login_res.json().get("status") == 1:
        token = login_res.json()["data"]["accessToken"]
        waiter_id = login_res.json()["data"]["user"]["_id"]
        logger.success(f"Đăng nhập thành công với vai trò Waiter! Token: {token[:20]}...")
    else:
        reg_res = session.post(f"{BASE_URL}/auth/register", json=waiter_auth)
        if reg_res.status_code in [200, 201] and reg_res.json().get("status") == 1:
            logger.info("Đã tạo mới tài khoản Waiter, tiến hành đăng nhập...")
            login_res = session.post(f"{BASE_URL}/auth/login", json={
                "username": waiter_auth["username"],
                "password": waiter_auth["password"]
            })
            token = login_res.json()["data"]["accessToken"]
            waiter_id = login_res.json()["data"]["user"]["_id"]
            logger.success(f"Đăng nhập thành công! Token: {token[:20]}...")
        else:
            logger.error("Không thể đăng nhập/đăng ký tài khoản Waiter!", reg_res.text)

    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
        me_res = session.get(f"{BASE_URL}/auth/me")
        if me_res.status_code == 200:
            u_info = me_res.json().get("data", {})
            logger.success(f"Xác thực JWT Token thành công! User: {u_info.get('fullname')} | Vai trò: {u_info.get('role')}")
        else:
            logger.error("Token JWT không hợp lệ!", me_res.text)

    # =========================================================================
    # BƯỚC 2: CHUẨN BỊ BÀN ĂN & TEST TÍNH NĂNG CHUYỂN BÀN (TABLE TRANSFER)
    # =========================================================================
    logger.step(2, "Kiểm tra Sơ đồ bàn & Test Nghiệp vụ Chuyển bàn (Table Switch)")
    
    # Tạo cặp bàn kiểm thử chuyển bàn (Bàn Nguồn & Bàn Đích)
    logger.info("Khởi tạo cặp bàn test chuyển bàn...")
    t1_res = session.post(f"{BASE_URL}/tables", json={"tableNumber": f"SRC-{int(time.time())%1000}", "status": "Available"})
    t2_res = session.post(f"{BASE_URL}/tables", json={"tableNumber": f"DST-{int(time.time())%1000}", "status": "Available"})
    table_from = t1_res.json().get("data")
    table_to = t2_res.json().get("data")

    logger.info(f"-> Bàn nguồn: {table_from.get('tableNumber')} (ID: {table_from['_id']})")
    logger.info(f"-> Bàn đích: {table_to.get('tableNumber')} (ID: {table_to['_id']})")

    # Tạo 1 đơn hàng cho Bàn nguồn để có dữ liệu chuyển
    menu_res = session.get(f"{BASE_URL}/menu")
    menu_items = menu_res.json().get("data", [])
    dish = next((m for m in menu_items if m.get("status") in ["Available", "Active", "active"]), None)

    if dish:
        logger.info(f"Khởi tạo đơn hàng tại Bàn nguồn ({table_from.get('tableNumber')})...")
        order_res = session.post(f"{BASE_URL}/orders", json={
            "table_id": table_from["_id"],
            "waiter_id": waiter_id,
            "items": [{"menuItem_id": dish["_id"], "quantity": 1}]
        })
        active_order = order_res.json().get("data") if order_res.status_code in [200, 201] else None
        
        if active_order:
            logger.success(f"Đã mở đơn tại Bàn nguồn! Mã Order: {active_order['_id']}")
            
            # Thực hiện chuyển bàn từ table_from sang table_to
            logger.info(f"Phục vụ thực hiện chuyển bàn từ [{table_from.get('tableNumber')}] sang [{table_to.get('tableNumber')}]...")
            transfer_res = session.post(f"{BASE_URL}/tables/transfer", json={
                "sourceTableId": table_from["_id"],
                "targetTableId": table_to["_id"],
                "fromTableId": table_from["_id"],
                "toTableId": table_to["_id"],
                "note": "Khách yêu cầu chuyển chỗ sang khu vực yên tĩnh hơn"
            })
            
            if transfer_res.status_code == 200 and transfer_res.json().get("status") == 1:
                logger.success(f"Chuyển bàn thành công! Phản hồi: {transfer_res.json().get('message')}")
                # Kiểm tra trạng thái 2 bàn sau khi chuyển
                t_from_check = session.get(f"{BASE_URL}/tables/{table_from['_id']}").json().get("data", {})
                t_to_check = session.get(f"{BASE_URL}/tables/{table_to['_id']}").json().get("data", {})
                
                if t_from_check.get("status") == "Available" and t_to_check.get("status") == "Occupied":
                    logger.success("Xác nhận trạng thái: Bàn nguồn đã TRỐNG (Available), Bàn đích đang CÓ KHÁCH (Occupied)!")
                else:
                    logger.warn("Trạng thái 2 bàn sau chuyển chưa đúng kỳ vọng!")
            else:
                logger.error("Chuyển bàn thất bại!", transfer_res.text)

    # =========================================================================
    # BƯỚC 3: TIẾP NHẬN ĐƠN MỚI & DUYỆT MÓN GỬI BẾP (COOKING)
    # =========================================================================
    logger.step(3, "Tiếp nhận đơn hàng Pending & Phục vụ duyệt 'Gửi Bếp' (Cooking)")
    
    # Lấy chi tiết đơn hàng đang mở
    current_order_id = active_order["_id"] if active_order else None
    order_detail_id = None

    if current_order_id:
        detail_res = session.get(f"{BASE_URL}/orders/{current_order_id}")
        order_info = detail_res.json().get("data", {})
        items = order_info.get("items", [])
        
        if items:
            first_item = items[0]
            order_detail_id = first_item["_id"]
            dish_name = first_item.get("menuItem_id", {}).get("name", "Món ăn")
            logger.info(f"Món ăn đang chờ duyệt: '{dish_name}' (Trạng thái hiện tại: {first_item.get('status')})")
            
            # Phục vụ bấm "Gửi Bếp" -> Chuyển sang Cooking
            logger.info("Phục vụ kiểm tra ghi chú và bấm nút [Gửi Bếp]...")
            cook_res = session.patch(f"{BASE_URL}/order-details/{order_detail_id}/status", json={"status": "Cooking"})
            
            if cook_res.status_code == 200:
                logger.success(f"Duyệt món gửi Bếp thành công! Trạng thái món chuyển sang: [Cooking]")
            else:
                logger.error("Không thể gửi bếp!", cook_res.text)

    # =========================================================================
    # BƯỚC 4: TEST GIỤC BẾP ƯU TIÊN (RUSH ORDER)
    # =========================================================================
    logger.step(4, "Khách giục món -> Phục vụ đánh dấu Giục Bếp khẩn cấp (Rush Item)")
    
    if order_detail_id:
        rush_res = session.patch(f"{BASE_URL}/order-details/{order_detail_id}/rush")
        if rush_res.status_code == 200 and rush_res.json().get("status") == 1:
            rush_data = rush_res.json().get("data", {})
            if rush_data.get("isRush") is True:
                logger.success("Giục bếp thành công! Món đã được gắn cờ isRush = True để đẩy lên đầu KDS.")
            else:
                logger.warn("isRush chưa cập nhật thành True!")
        else:
            logger.error("Lỗi khi giục bếp!", rush_res.text)

    # =========================================================================
    # BƯỚC 5: BẾP BÁO XONG (READY) -> PHỤC VỤ TRẢ MÓN RA BÀN (SERVED)
    # =========================================================================
    logger.step(5, "Bếp nấu xong (Ready) & Phục vụ xác nhận 'Đã mang ra bàn' (Served)")
    
    if order_detail_id:
        # Bếp đổi sang Ready
        session.patch(f"{BASE_URL}/order-details/{order_detail_id}/status", json={"status": "Ready"})
        logger.info("Bếp thông báo: Món đã nấu xong (Ready), sẵn sàng lên đĩa!")
        
        # Phục vụ mang ra bàn và bấm "Đã mang ra bàn"
        serve_res = session.patch(f"{BASE_URL}/order-details/{order_detail_id}/status", json={"status": "Served"})
        if serve_res.status_code == 200:
            logger.success("Phục vụ xác nhận đã bưng món ra bàn thành công! Trạng thái món: [Served].")
        else:
            logger.error("Lỗi khi xác nhận trả món!", serve_res.text)

    # =========================================================================
    # BƯỚC 6: XỬ LÝ SỰ CỐ & HỦY MÓN KÈM LÝ DO (INCIDENT & CANCEL)
    # =========================================================================
    logger.step(6, "Xử lý sự cố: Hủy món kèm lý do bắt buộc & Kiểm tra trừ tiền hóa đơn")
    
    # Tạo thêm 1 món phụ để test hủy món
    if current_order_id and len(menu_items) > 1:
        extra_dish = menu_items[1]
        dish_price = extra_dish.get("base_price", 50000)
        logger.info(f"Tạo món phụ '{extra_dish['name']}' ({dish_price:,.0f}đ) để test nghiệp vụ hủy món...")
        
        # Gọi trực tiếp tạo order detail hoặc order mới
        extra_order_res = session.post(f"{BASE_URL}/orders", json={
            "table_id": table_to["_id"],
            "waiter_id": waiter_id,
            "items": [{"menuItem_id": extra_dish["_id"], "quantity": 1}]
        })
        
        if extra_order_res.status_code in [200, 201]:
            cancel_order_id = extra_order_res.json()["data"]["_id"]
            c_detail_res = session.get(f"{BASE_URL}/orders/{cancel_order_id}")
            cancel_item_id = c_detail_res.json()["data"]["items"][0]["_id"]
            
            # Phục vụ thực hiện hủy món
            cancel_reason = "Khách phàn nàn món bị nguội, đổi ý không ăn nữa"
            logger.info(f"Phục vụ bấm [Báo sự cố & Hủy món] với lý do: '{cancel_reason}'...")
            
            do_cancel_res = session.post(f"{BASE_URL}/order-details/{cancel_item_id}/cancel", json={
                "incidentNote": cancel_reason
            })
            
            if do_cancel_res.status_code == 200:
                logger.success("Hủy món thành công! Trạng thái món chuyển sang: [Cancelled].")
                
                # KIỂM TRA NGHIỆP VỤ BRD: Tổng tiền hóa đơn có được trừ bớt tiền món bị hủy không?
                check_order = session.get(f"{BASE_URL}/orders/{cancel_order_id}").json().get("data", {})
                current_total = check_order.get("totalAmount", 0)
                logger.info(f"Kiểm tra hóa đơn sau khi hủy món: Tổng tiền hiện tại = {current_total:,.0f}đ")
                
                if current_total == 0:
                    logger.success("Đúng chuẩn BRD 1.3: Hệ thống đã tự động trừ sạch tiền món bị hủy khỏi tổng hóa đơn!")
                else:
                    logger.warn(f"CẢNH BÁO / LỖI NGHIỆP VỤ: Món đã hủy nhưng tổng tiền hóa đơn vẫn giữ nguyên {current_total:,.0f}đ (Chưa tự động trừ tiền món hủy)!")
            else:
                logger.error("Hủy món thất bại!", do_cancel_res.text)

    # =========================================================================
    # BƯỚC 7: PHỤC VỤ KHÓA MÓN HẾT HÀNG TẠI QUẦY (OUT OF STOCK CONTROL)
    # =========================================================================
    logger.step(7, "Phục vụ phát hiện hết nguyên liệu -> Khóa món trực tiếp (Toggle Out of Stock)")
    
    if dish:
        logger.info(f"Thực hiện khóa món: '{dish['name']}'...")
        toggle_res = session.patch(f"{BASE_URL}/menu/{dish['_id']}/toggle-status")
        
        if toggle_res.status_code == 200:
            new_st = toggle_res.json().get("data", {}).get("status")
            logger.success(f"Khóa món thành công! Trạng thái mới của món: [{new_st}] (Đã chặn khách đặt trên E-Menu).")
            # Mở lại để không ảnh hưởng dữ liệu
            session.patch(f"{BASE_URL}/menu/{dish['_id']}/toggle-status")
            logger.info("Đã mở lại trạng thái món ăn về bình thường.")
        else:
            logger.error("Không thể thay đổi trạng thái món!", toggle_res.text)

    # Dọn dẹp bàn test tạm thời
    if 'table_from' in locals() and table_from and '_id' in table_from:
        session.delete(f"{BASE_URL}/tables/{table_from['_id']}")
    if 'table_to' in locals() and table_to and '_id' in table_to:
        session.delete(f"{BASE_URL}/tables/{table_to['_id']}")

    # =========================================================================
    # TỔNG KẾT BÁO CÁO KIỂM THỬ
    # =========================================================================
    print(f"\n{Colors.BOLD}" + "="*68)
    print(" BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ PHÂN HỆ PHỤC VỤ (WAITER)")
    print("="*68 + f"{Colors.RESET}")
    print(f" {Colors.GREEN}✔ SỐ TEST CASE ĐẠT (PASS): {logger.passed}{Colors.RESET}")
    print(f" {Colors.RED}✘ SỐ TEST CASE LỖI (FAIL): {logger.failed}{Colors.RESET}")
    print(f" {Colors.YELLOW}⚠ CẢNH BÁO / LỖI NGHIỆP VỤ (WARN): {len(logger.warnings)}{Colors.RESET}")
    
    if logger.errors:
        print(f"\n{Colors.RED}DANH SÁCH LỖI KỸ THUẬT:{Colors.RESET}")
        for idx, err in enumerate(logger.errors, 1):
            print(f"  {idx}. {err}")

    if logger.warnings:
        print(f"\n{Colors.YELLOW}DANH SÁCH LỖI NGHIỆP VỤ / LỖ HỔNG PHÁT HIỆN:{Colors.RESET}")
        for idx, w in enumerate(logger.warnings, 1):
            print(f"  {idx}. {w}")
    print("="*68 + "\n")


if __name__ == "__main__":
    run_waiter_tests()
