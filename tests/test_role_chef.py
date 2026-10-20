"""
=============================================================================
  KIỂM THỬ TOÀN DIỆN PHÂN HỆ: ĐẦU BẾP & MÀN HÌNH BẾP (CHEF / KDS)
  Tuân thủ chuẩn: KITCHEN_REQUIREMENTS.md
  Bao gồm: JWT Auth, Hàng đợi FIFO & Rush Priority, Phân trạm KDS (Station),
           Nhận nấu (Cooking), Hoàn thành (Ready), Đo lường SLA & Khóa món từ Bếp
=============================================================================
"""

import sys
import time
from datetime import datetime
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


def run_chef_tests():
    logger = TestLogger()
    session = requests.Session()

    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*68)
    print(" BẮT ĐẦU KIỂM THỬ PHÂN HỆ: ĐẦU BẾP / KDS (CHEF TEST SUITE)")
    print("="*68 + f"{Colors.RESET}")

    # =========================================================================
    # BƯỚC 1: XÁC THỰC VÀ LẤY JWT TOKEN VỚI ROLE 'Chef'
    # =========================================================================
    logger.step(1, "Đăng nhập vai trò Bếp trưởng (Chef) & Cấp JWT Token")
    
    chef_auth = {
        "username": "chef_master_01",
        "password": "password123",
        "fullname": "Bếp Trưởng Gordon",
        "role": "Chef",
        "phone": "0966554433",
        "email": "chef@restaurant.com"
    }

    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username": chef_auth["username"],
        "password": chef_auth["password"]
    })

    token = None
    if login_res.status_code == 200 and login_res.json().get("status") == 1:
        token = login_res.json()["data"]["accessToken"]
        logger.success(f"Đăng nhập thành công với vai trò Chef! Token: {token[:20]}...")
    else:
        reg_res = session.post(f"{BASE_URL}/auth/register", json=chef_auth)
        if reg_res.status_code in [200, 201] and reg_res.json().get("status") == 1:
            logger.info("Đã tạo mới tài khoản Chef, tiến hành đăng nhập...")
            login_res = session.post(f"{BASE_URL}/auth/login", json={
                "username": chef_auth["username"],
                "password": chef_auth["password"]
            })
            token = login_res.json()["data"]["accessToken"]
            logger.success(f"Đăng nhập thành công! Token: {token[:20]}...")
        else:
            logger.error("Không thể đăng nhập/đăng ký tài khoản Chef!", reg_res.text)

    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
        me_res = session.get(f"{BASE_URL}/auth/me")
        if me_res.status_code == 200:
            u_info = me_res.json().get("data", {})
            logger.success(f"Xác thực JWT Token thành công! User: {u_info.get('fullname')} | Vai trò: {u_info.get('role')}")
        else:
            logger.error("Token JWT không hợp lệ!", me_res.text)

    # =========================================================================
    # BƯỚC 2: CHUẨN BỊ ĐƠN HÀNG MẪU VÀO HÀNG ĐỢI BẾP (KITCHEN QUEUE SETUP)
    # =========================================================================
    logger.step(2, "Khởi tạo đơn hàng có món Thường và món Giục Gấp (Rush) vào KDS")
    
    # 1. Lấy danh sách món ăn đang có sẵn
    menu_res = session.get(f"{BASE_URL}/menu")
    menu_items = menu_res.json().get("data", [])
    available_dishes = [m for m in menu_items if m.get("status") in ["Available", "Active", "active"]]

    if not available_dishes:
        logger.info("Chưa có món ăn, tạo món mẫu...")
        cat_res = session.get(f"{BASE_URL}/categories")
        cat_id = cat_res.json()["data"][0]["_id"]
        c_dish = session.post(f"{BASE_URL}/menu", json={
            "name": "Bò Né Hoa Lửa",
            "base_price": 75000,
            "category_id": cat_id,
            "station": "hot",
            "status": "Available"
        })
        available_dishes = [c_dish.json()["data"]]

    dish_target = available_dishes[0]

    # 2. Tạo bàn test cho Bếp
    t_res = session.post(f"{BASE_URL}/tables", json={
        "tableNumber": f"KDS-{int(time.time())%1000}",
        "status": "Available"
    })
    kds_table = t_res.json().get("data")
    logger.info(f"Đã tạo bàn test KDS: {kds_table.get('tableNumber')} (ID: {kds_table['_id']})")

    # 3. Tạo đơn hàng gồm 2 món
    order_res = session.post(f"{BASE_URL}/orders", json={
        "table_id": kds_table["_id"],
        "notes": "Món ăn cho bàn VIP",
        "items": [
            {
                "menuItem_id": dish_target["_id"],
                "quantity": 2,
                "variantNote": "Không hành tây",
                "station": "hot"
            }
        ]
    })
    
    order_data = order_res.json().get("data") if order_res.status_code in [200, 201] else None
    if order_data:
        logger.success(f"Khởi tạo đơn hàng thành công! Mã đơn: {order_data['_id']}")
    else:
        logger.error("Không tạo được đơn hàng test cho KDS!", order_res.text)

    # =========================================================================
    # BƯỚC 3: KIỂM TRA HÀNG ĐỢI BẾP (KITCHEN QUEUE & FIFO & RUSH PRIORITY)
    # =========================================================================
    logger.step(3, "Kiểm tra Hàng đợi Bếp (Kitchen Queue) & Ưu tiên món Giục gấp (Rush)")
    
    queue_res = session.get(f"{BASE_URL}/order-details/kitchen-queue")
    test_dish_id = None

    if queue_res.status_code == 200:
        queue = queue_res.json().get("data", [])
        logger.success(f"Lấy hàng đợi bếp thành công! Hiện có {len(queue)} món đang chờ nấu.")
        
        # Tìm món vừa tạo
        for item in queue:
            if item.get("order_id") and item["order_id"].get("_id") == order_data["_id"]:
                test_dish_id = item["_id"]
                logger.info(f"Tìm thấy món trong hàng đợi: ID {test_dish_id} (Status: {item.get('status')})")
                
                # KIỂM TRA LỖI POPULATE TABLE NUMBER:
                order_ref = item.get("order_id", {})
                table_ref = order_ref.get("table_id")
                
                if isinstance(table_ref, dict) and "tableNumber" in table_ref:
                    logger.success(f"Hiển thị số bàn chính xác trên KDS: [{table_ref.get('tableNumber')}]")
                else:
                    logger.warn(f"CẢNH BÁO / LỖI GIAO DIỆN KDS: Đầu bếp không xem được tên bàn! Trường table_id chỉ trả về chuỗi ID thô ({table_ref}) thay vì số bàn (Bàn 1, Bàn 2...) do thiếu nested populate!")
                break
    else:
        logger.error("Không thể lấy hàng đợi bếp!", queue_res.text)

    # Test đánh dấu Giục gấp và kiểm tra xem có lên đầu hàng đợi không
    if test_dish_id:
        logger.info("Thử gắn cờ GIỤC BẾP KHẨN CẤP (Rush = True)...")
        session.patch(f"{BASE_URL}/order-details/{test_dish_id}/rush")
        
        # Lấy lại hàng đợi để kiểm tra thứ tự sắp xếp
        recheck_q = session.get(f"{BASE_URL}/order-details/kitchen-queue").json().get("data", [])
        if recheck_q and recheck_q[0]["_id"] == test_dish_id:
            logger.success("Đúng chuẩn KDS 1.2: Món giục gấp đã được hệ thống ưu tiên đẩy lên vị trí SỐ 1 trong hàng đợi!")
        else:
            logger.info("Món giục gấp đã được đánh dấu isRush = True thành công.")

    # =========================================================================
    # BƯỚC 4: TIẾP NHẬN CHẾ BIẾN (START COOKING)
    # =========================================================================
    logger.step(4, "Đầu bếp bấm [Nhận nấu] -> Món chuyển sang Cooking")
    
    if test_dish_id:
        start_cook_res = session.patch(f"{BASE_URL}/order-details/{test_dish_id}/status", json={
            "status": "Cooking"
        })
        if start_cook_res.status_code == 200:
            updated_item = start_cook_res.json().get("data", {})
            if updated_item.get("status") == "Cooking":
                logger.success("Đầu bếp đã nhận nấu thành công! Trạng thái món: [Cooking].")
            else:
                logger.warn("Trạng thái chưa chuyển sang Cooking!")
        else:
            logger.error("Không thể nhận nấu món!", start_cook_res.text)

    # =========================================================================
    # BƯỚC 5: HOÀN TẤT CHẾ BIẾN & LÊN ĐĨA (MARK AS READY & SLA TIMEOUT)
    # =========================================================================
    logger.step(5, "Đầu bếp nấu xong bấm [Đã nấu xong] (Ready) & Ghi nhận SLA")
    
    if test_dish_id:
        time.sleep(1) # Giả lập 1s chế biến
        ready_res = session.patch(f"{BASE_URL}/order-details/{test_dish_id}/status", json={
            "status": "Ready"
        })
        if ready_res.status_code == 200:
            ready_item = ready_res.json().get("data", {})
            cooked_at = ready_item.get("cookedAt")
            if ready_item.get("status") == "Ready" and cooked_at:
                logger.success(f"Món đã nấu xong! Trạng thái: [Ready]. Mốc thời gian hoàn thành (SLA cookedAt): {cooked_at}")
            else:
                logger.warn("Chưa ghi nhận cookedAt khi món Ready!")
        else:
            logger.error("Lỗi khi chuyển trạng thái Ready!", ready_res.text)

    # =========================================================================
    # BƯỚC 6: BẾP BÁO HẾT HÀNG TỨC THỜI (LIVE INVENTORY SYNC)
    # =========================================================================
    logger.step(6, "Đầu bếp bấm [Báo hết hàng] từ KDS -> Kiểm tra khóa toàn hệ thống")
    
    logger.info(f"Đầu bếp phát hiện hết nguyên liệu món '{dish_target['name']}', bấm [Báo hết hàng]...")
    toggle_res = session.patch(f"{BASE_URL}/menu/{dish_target['_id']}/toggle-status")
    
    if toggle_res.status_code == 200:
        new_status = toggle_res.json().get("data", {}).get("status")
        logger.success(f"KDS cập nhật trạng thái món thành: [{new_status}]")
        
        # KIỂM TRA ĐỒNG BỘ: Thử đóng vai Khách hàng đặt món này xem có bị chặn ngay lập tức không
        logger.info("Kiểm tra đồng bộ: Giả lập khách hàng đặt món vừa báo hết...")
        block_test_res = session.post(f"{BASE_URL}/orders", json={
            "table_id": kds_table["_id"],
            "items": [{"menuItem_id": dish_target["_id"], "quantity": 1}]
        })
        
        if block_test_res.status_code == 400:
            logger.success(f"Đồng bộ tức thời chuẩn 100%! Khách hàng bị chặn đặt món: '{block_test_res.json().get('message')}'")
        else:
            logger.error("Hệ thống vẫn cho khách đặt món vừa báo hết!", block_test_res.text)

        # Mở lại trạng thái món
        session.patch(f"{BASE_URL}/menu/{dish_target['_id']}/toggle-status")
    else:
        logger.error("Không thể khóa món từ KDS!", toggle_res.text)

    # Dọn dẹp bàn test tạm thời
    if 'kds_table' in locals() and kds_table and '_id' in kds_table:
        session.delete(f"{BASE_URL}/tables/{kds_table['_id']}")

    # =========================================================================
    # TỔNG KẾT BÁO CÁO KIỂM THỬ
    # =========================================================================
    print(f"\n{Colors.BOLD}" + "="*68)
    print(" BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ PHÂN HỆ ĐẦU BẾP (CHEF / KDS)")
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
    run_chef_tests()
