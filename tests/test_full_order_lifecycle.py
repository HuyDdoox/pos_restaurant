"""
=============================================================================
  KIỂM THỬ TOÀN TRÌNH VÒNG ĐỜI GỌI MÓN (END-TO-END ORDER LIFECYCLE TEST)
  Quy trình kiểm thử:
  1. Khách mở bàn & đặt món (Khách -> OrderDetail)
  2. Nhân viên phục vụ (Waiter) thêm món mới vào đơn
  3. Nhân viên xác nhận duyệt món gửi xuống bếp
  4. Bếp (KDS) nhận nấu (Pending -> Cooking)
  5. Bếp nấu xong, yêu cầu nhân viên bưng lên (Cooking -> Ready)
  6. Nhân viên bưng lên bàn thành công (Ready -> Served)
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

    def info(self, msg):
        print(f"{Colors.BLUE}[INFO]{Colors.RESET} {msg}")

    def success(self, msg):
        self.passed += 1
        print(f"{Colors.GREEN}[PASS]{Colors.RESET} {msg}")

    def error(self, msg, detail=""):
        self.failed += 1
        err_msg = f"{msg} | Chi tiết: {detail}" if detail else msg
        self.errors.append(err_msg)
        print(f"{Colors.RED}[FAIL]{Colors.RESET} {err_msg}")

    def step(self, step_num, title):
        print(f"\n{Colors.BOLD}{Colors.CYAN}--- BƯỚC {step_num}: {title} ---{Colors.RESET}")


def run_full_lifecycle_test():
    logger = TestLogger()
    session = requests.Session()

    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*70)
    print(" BẮT ĐẦU KIỂM THỬ TOÀN TRÌNH: TỪ KHÁCH ĐẶT ĐẾN BẾP NẤU VÀ PHỤC VỤ BƯNG")
    print("="*70 + f"{Colors.RESET}")

    # =========================================================================
    # BƯỚC 0: CHUẨN BỊ DỮ LIỆU BÀN ĂN & MÓN ĂN
    # =========================================================================
    logger.step(0, "Chuẩn bị Bàn ăn thực tế và Danh sách món từ Menu")
    
    # 1. Lấy danh sách bàn
    tables_res = session.get(f"{BASE_URL}/tables")
    if tables_res.status_code != 200:
        logger.error("Không lấy được danh sách bàn!", tables_res.text)
        return
    tables = tables_res.json().get("data", [])
    target_table = next((t for t in tables if t.get("tableNumber") == "01"), tables[0] if tables else None)
    if not target_table:
        logger.error("Không tìm thấy bàn nào trong hệ thống!")
        return
    table_id = target_table["_id"]
    logger.info(f"-> Chọn Bàn: [{target_table.get('tableNumber')}] (ID: {table_id})")

    # 2. Lấy danh sách món ăn
    menu_res = session.get(f"{BASE_URL}/menu")
    if menu_res.status_code != 200:
        logger.error("Không lấy được danh sách thực đơn!", menu_res.text)
        return
    menu_items = menu_res.json().get("data", [])
    available_dishes = [m for m in menu_items if m.get("status") in ["Available", "Active", "active"] and not m.get("is_combo")]
    if len(available_dishes) < 3:
        logger.error("Không đủ ít nhất 3 món ăn để thực hiện test!")
        return

    dish1 = available_dishes[0]
    dish2 = available_dishes[1]
    dish_waiter = available_dishes[2]
    logger.info(f"-> Món khách chọn 1: {dish1['name']} ({dish1.get('base_price', 0):,}đ)")
    logger.info(f"-> Món khách chọn 2: {dish2['name']} ({dish2.get('base_price', 0):,}đ)")
    logger.info(f"-> Món nhân viên sẽ thêm sau: {dish_waiter['name']} ({dish_waiter.get('base_price', 0):,}đ)")

    # =========================================================================
    # BƯỚC 1: KHÁCH MỞ BÀN & ORDER MÓN TRÊN E-MENU
    # =========================================================================
    logger.step(1, "Khách hàng mở bàn và đặt món qua E-Menu")
    
    # Khách mở bàn tạo Order
    order_create_res = session.post(f"{BASE_URL}/orders", json={
        "table_id": table_id,
        "customerInfo": f"Khách quét QR Bàn {target_table.get('tableNumber')}",
        "totalAmount": 0,
        "status": "In_Progress",
        "paymentStatus": "Unpaid"
    })

    if order_create_res.status_code not in [200, 201]:
        logger.error("Khách không thể mở bàn / tạo đơn!", order_create_res.text)
        return
    order_data = order_create_res.json().get("data", {})
    order_id = order_data.get("_id")
    logger.success(f"Khách mở bàn thành công! Mã Order: {order_id}")

    # Kiểm tra trạng thái bàn đã đổi sang Occupied chưa
    check_table = session.get(f"{BASE_URL}/tables/{table_id}").json().get("data", {})
    if check_table.get("status") == "Occupied":
        logger.success(f"Bàn [{target_table.get('tableNumber')}] đã tự động đổi sang trạng thái [Occupied]!")
    else:
        logger.error("Trạng thái bàn chưa đổi sang Occupied!", f"Status hiện tại: {check_table.get('status')}")

    # Khách đặt 2 món vào đơn
    detail1_res = session.post(f"{BASE_URL}/order-details", json={
        "order_id": order_id,
        "menuItem_id": dish1["_id"],
        "quantity": 1,
        "priceAtOrder": dish1.get("base_price", 0),
        "notes": "Ít cay, không ngò",
        "status": "Unconfirmed"
    })
    detail2_res = session.post(f"{BASE_URL}/order-details", json={
        "order_id": order_id,
        "menuItem_id": dish2["_id"],
        "quantity": 2,
        "priceAtOrder": dish2.get("base_price", 0),
        "notes": "Chín vừa",
        "status": "Unconfirmed"
    })

    if detail1_res.status_code == 201 and detail2_res.status_code == 201:
        d1 = detail1_res.json().get("data")
        d2 = detail2_res.json().get("data")
        logger.success(f"Khách đặt món 1 thành công: 1x {dish1['name']} (ID: {d1.get('_id')})")
        logger.success(f"Khách đặt món 2 thành công: 2x {dish2['name']} (ID: {d2.get('_id')})")
    else:
        logger.error("Lỗi khi khách gọi món!", f"D1: {detail1_res.text} | D2: {detail2_res.text}")
        return

    # =========================================================================
    # BƯỚC 2: NHÂN VIÊN PHỤC VỤ (WAITER) THÊM MÓN MỚI VÀO ĐƠN
    # =========================================================================
    logger.step(2, "Nhân viên phục vụ (Waiter) mở bàn và thêm món vào đơn")

    detail3_res = session.post(f"{BASE_URL}/order-details", json={
        "order_id": order_id,
        "menuItem_id": dish_waiter["_id"],
        "quantity": 1,
        "priceAtOrder": dish_waiter.get("base_price", 0),
        "notes": "Thêm đá riêng",
        "status": "Unconfirmed"
    })

    if detail3_res.status_code == 201:
        d3 = detail3_res.json().get("data")
        logger.success(f"Nhân viên đã thêm món vào đơn: 1x {dish_waiter['name']} (ID: {d3.get('_id')})")
    else:
        logger.error("Nhân viên không thể thêm món vào đơn!", detail3_res.text)
        return

    # Kiểm tra danh sách món hiện có trong đơn
    order_items_res = session.get(f"{BASE_URL}/order-details?order_id={order_id}")
    current_items = order_items_res.json().get("data", [])
    logger.info(f"-> Tổng số dòng món ăn hiện có trong đơn: {len(current_items)}")
    if len(current_items) == 3:
        logger.success("Đơn hàng ghi nhận đủ 3 món ăn chuẩn xác 100%!")
    else:
        logger.error(f"Số lượng món không khớp! Kỳ vọng: 3, Thực tế: {len(current_items)}")

    # =========================================================================
    # BƯỚC 3: NHÂN VIÊN XÁC NHẬN VÀ DUYỆT GỬI BẾP
    # =========================================================================
    logger.step(3, "Nhân viên bấm xác nhận và gửi món xuống Bếp (Pending)")

    confirmed_count = 0
    for it in current_items:
        patch_res = session.patch(f"{BASE_URL}/order-details/{it['_id']}", json={
            "status": "Pending"
        })
        if patch_res.status_code == 200:
            confirmed_count += 1

    if confirmed_count == 3:
        logger.success(f"Nhân viên đã duyệt toàn bộ {confirmed_count} món thành công! Trạng thái: [Pending]")
    else:
        logger.error(f"Chỉ duyệt được {confirmed_count}/3 món!")

    # =========================================================================
    # BƯỚC 4: BẾP (KDS) NHẬN NẤU MÓN (PENDING -> COOKING)
    # =========================================================================
    logger.step(4, "Đầu bếp xem màn hình KDS và bấm 'Nhận nấu' (Cooking)")

    # Bếp lấy danh sách món cần nấu
    kds_pending_res = session.get(f"{BASE_URL}/order-details?status=Pending")
    pending_list = kds_pending_res.json().get("data", [])
    table_pending = [p for p in pending_list if str(p.get("order_id", {}).get("_id") or p.get("order_id")) == str(order_id)]
    logger.info(f"-> Màn hình Bếp phát hiện {len(table_pending)} món của Bàn {target_table.get('tableNumber')} đang chờ nấu.")

    # Bếp bấm nhận nấu từng món
    cooked_start_count = 0
    for p in table_pending:
        cook_res = session.patch(f"{BASE_URL}/order-details/{p['_id']}", json={
            "status": "Cooking"
        })
        if cook_res.status_code == 200 and cook_res.json().get("data", {}).get("status") == "Cooking":
            cooked_start_count += 1

    if cooked_start_count == 3:
        logger.success(f"Đầu bếp đã nhận nấu thành công cả {cooked_start_count} món! Trạng thái: [Cooking]")
    else:
        logger.error(f"Lỗi nhận nấu! Chỉ nhận được {cooked_start_count}/3 món!")

    # =========================================================================
    # BƯỚC 5: BẾP NẤU XONG VÀ YÊU CẦU NHÂN VIÊN BƯNG LÊN (COOKING -> READY)
    # =========================================================================
    logger.step(5, "Đầu bếp nấu xong bấm 'Nấu xong' (Ready) -> Báo phục vụ bưng món")

    ready_count = 0
    for p in table_pending:
        ready_res = session.patch(f"{BASE_URL}/order-details/{p['_id']}", json={
            "status": "Ready"
        })
        if ready_res.status_code == 200:
            item_data = ready_res.json().get("data", {})
            if item_data.get("status") == "Ready" and item_data.get("cookedAt"):
                ready_count += 1

    if ready_count == 3:
        logger.success(f"Đầu bếp đã nấu xong cả {ready_count} món! Trạng thái: [Ready], Ghi nhận mốc SLA cookedAt chuẩn xác!")
    else:
        logger.error(f"Lỗi cập nhật nấu xong! Chỉ xong {ready_count}/3 món!")

    # Kiểm tra khay món sẵn sàng chờ bưng
    ready_tray_res = session.get(f"{BASE_URL}/order-details?status=Ready")
    tray_items = ready_tray_res.json().get("data", [])
    logger.info(f"-> Màn hình khay món phục vụ đang có {len(tray_items)} món sẵn sàng mang ra bàn.")
    if len(tray_items) >= 3:
        logger.success("Món đã hiển thị đầy đủ trên khay chờ bưng của Nhân viên Phục vụ!")
    else:
        logger.error(f"Khay phục vụ chưa nhận đủ món Ready! Hiện có: {len(tray_items)}")

    # =========================================================================
    # BƯỚC 6: NHÂN VIÊN BƯNG MÓN LÊN BÀN & ĐỔI TRẠNG THÁI (READY -> SERVED)
    # =========================================================================
    logger.step(6, "Nhân viên bưng món lên bàn và xác nhận hoàn tất (Served)")

    served_count = 0
    for p in table_pending:
        served_res = session.patch(f"{BASE_URL}/order-details/{p['_id']}", json={
            "status": "Served"
        })
        if served_res.status_code == 200:
            item_data = served_res.json().get("data", {})
            if item_data.get("status") == "Served" and item_data.get("servedAt"):
                served_count += 1

    if served_count == 3:
        logger.success(f"Nhân viên đã bưng lên bàn thành công cả {served_count} món! Trạng thái món: [Served], Ghi nhận servedAt chuẩn!")
    else:
        logger.error(f"Lỗi khi nhân viên trả món! Chỉ bưng được {served_count}/3 món!")

    # =========================================================================
    # BƯỚC 7: KIỂM TRA TỔNG KẾT HÓA ĐƠN VÀ TRẠNG THÁI SAU KHI PHỤC VỤ XONG
    # =========================================================================
    logger.step(7, "Kiểm tra hóa đơn và tổng tiền chính xác sau khi phục vụ toàn bộ món")

    expected_total = (dish1.get("base_price", 0) * 1) + (dish2.get("base_price", 0) * 2) + (dish_waiter.get("base_price", 0) * 1)
    final_order_res = session.get(f"{BASE_URL}/orders/{order_id}")
    final_order = final_order_res.json().get("data", {})
    actual_total = final_order.get("totalAmount", 0)

    logger.info(f"-> Tổng tiền tính toán: {expected_total:,} đ")
    logger.info(f"-> Tổng tiền trên hệ thống: {actual_total:,} đ")

    if actual_total == expected_total:
        logger.success(f"Tổng tiền hóa đơn khớp chính xác 100%: {actual_total:,} đ")
    else:
        logger.error(f"Tổng tiền bị lệch! Kỳ vọng: {expected_total:,}đ, Thực tế: {actual_total:,}đ")

    # =========================================================================
    # BẢNG TỔNG KẾT
    # =========================================================================
    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*70)
    print(" BẢNG TỔNG KẾT TOÀN BỘ QUY TRÌNH GỌI MÓN - NẤU BẾP - PHỤC VỤ BƯNG")
    print("="*70 + f"{Colors.RESET}")
    print(f" {Colors.GREEN}✔ SỐ TEST CASE ĐẠT (PASS): {logger.passed}{Colors.RESET}")
    print(f" {Colors.RED}✘ SỐ TEST CASE LỖI (FAIL): {logger.failed}{Colors.RESET}")
    if logger.errors:
        print(f"\n{Colors.RED}Chi tiết các lỗi:{Colors.RESET}")
        for err in logger.errors:
            print(f" - {err}")
    print("="*70 + "\n")

    return logger.failed == 0

if __name__ == "__main__":
    success = run_full_lifecycle_test()
    sys.exit(0 if success else 1)
