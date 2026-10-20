"""
=============================================================================
  KIỂM THỬ TOÀN DIỆN PHÂN HỆ: THU NGÂN (CASHIER SYSTEM)
  Tuân thủ chuẩn: CASHIER_REQUIREMENTS.md
  Bao gồm: JWT Auth, Mở ca (Clock-in), Xem bill & In tạm tính, Áp Voucher,
           Thanh toán tiền mặt/chuyển khoản, Giải phóng bàn & Chốt ca (Clock-out)
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


def run_cashier_tests():
    logger = TestLogger()
    session = requests.Session()

    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*68)
    print(" BẮT ĐẦU KIỂM THỬ PHÂN HỆ: THU NGÂN (CASHIER TEST SUITE)")
    print("="*68 + f"{Colors.RESET}")

    # =========================================================================
    # BƯỚC 1: XÁC THỰC VÀ LẤY JWT TOKEN VỚI ROLE 'Cashier'
    # =========================================================================
    logger.step(1, "Đăng nhập vai trò Thu ngân (Cashier) & Cấp JWT Token")
    
    cashier_auth = {
        "username": "cashier_pro_01",
        "password": "password123",
        "fullname": "Trần Thị Thu Ngân",
        "role": "Cashier",
        "phone": "0988776655",
        "email": "cashier01@restaurant.com"
    }

    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username": cashier_auth["username"],
        "password": cashier_auth["password"]
    })

    token = None
    cashier_id = None

    if login_res.status_code == 200 and login_res.json().get("status") == 1:
        token = login_res.json()["data"]["accessToken"]
        cashier_id = login_res.json()["data"]["user"]["_id"]
        logger.success(f"Đăng nhập thành công với vai trò Cashier! Token: {token[:20]}...")
    else:
        reg_res = session.post(f"{BASE_URL}/auth/register", json=cashier_auth)
        if reg_res.status_code in [200, 201] and reg_res.json().get("status") == 1:
            logger.info("Đã tạo mới tài khoản Cashier, tiến hành đăng nhập...")
            login_res = session.post(f"{BASE_URL}/auth/login", json={
                "username": cashier_auth["username"],
                "password": cashier_auth["password"]
            })
            token = login_res.json()["data"]["accessToken"]
            cashier_id = login_res.json()["data"]["user"]["_id"]
            logger.success(f"Đăng nhập thành công! Token: {token[:20]}...")
        else:
            logger.error("Không thể đăng nhập/đăng ký tài khoản Cashier!", reg_res.text)

    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
        me_res = session.get(f"{BASE_URL}/auth/me")
        if me_res.status_code == 200:
            u_info = me_res.json().get("data", {})
            logger.success(f"Xác thực JWT Token thành công! User: {u_info.get('fullname')} | Vai trò: {u_info.get('role')}")
        else:
            logger.error("Token JWT không hợp lệ!", me_res.text)

    # =========================================================================
    # BƯỚC 2: QUẢN LÝ CA LÀM VIỆC (MỞ CA / CLOCK-IN)
    # =========================================================================
    logger.step(2, "Bắt đầu làm việc: Khai báo tiền đầu ca (Clock-in / Open Shift)")
    
    # Kiểm tra xem có ca nào đang mở chưa, nếu có thì đóng tạm để test mở mới
    curr_shift_res = session.get(f"{BASE_URL}/shifts/current")
    current_shift = curr_shift_res.json().get("data") if curr_shift_res.status_code == 200 else None
    
    if current_shift:
        logger.info(f"Phát hiện ca cũ chưa chốt (ID: {current_shift['_id']}), tiến hành chốt ca cũ...")
        session.post(f"{BASE_URL}/shifts/{current_shift['_id']}/close", json={
            "actualCash": current_shift.get("startingCash", 1000000),
            "notes": "Chốt ca cũ tự động để bắt đầu kịch bản test mới"
        })

    # Mở ca làm việc mới với 1,000,000đ tiền két ban đầu
    start_cash = 1000000
    open_res = session.post(f"{BASE_URL}/shifts/open", json={
        "cashier_id": cashier_id,
        "startingCash": start_cash
    })

    shift_id = None
    if open_res.status_code in [200, 201] and open_res.json().get("status") == 1:
        shift_data = open_res.json()["data"]
        shift_id = shift_data["_id"]
        logger.success(f"Mở ca làm việc thành công! Mã ca: {shift_id} | Tiền đầu ca: {start_cash:,.0f} đ")
    else:
        logger.error("Mở ca làm việc thất bại!", open_res.text)

    # Test kiểm tra tính toàn vẹn: Không cho mở ca thứ 2 khi ca 1 chưa đóng
    dup_shift = session.post(f"{BASE_URL}/shifts/open", json={"startingCash": 500000})
    if dup_shift.status_code == 400:
        logger.success("Đúng chuẩn BRD 1.1: Chặn thành công không cho mở ca trùng lặp khi ca hiện tại chưa chốt sổ!")
    else:
        logger.warn(f"Hệ thống cho phép mở nhiều ca cùng lúc: {dup_shift.status_code}")

    # =========================================================================
    # BƯỚC 3: XỬ LÝ HÓA ĐƠN BÀN CẦN THANH TOÁN (PRE-RECEIPT)
    # =========================================================================
    logger.step(3, "Thu ngân chọn Bàn ăn & Xem chi tiết Hóa đơn tạm tính")
    
    # Tạo 1 bàn và đơn hàng để thanh toán
    t_res = session.post(f"{BASE_URL}/tables", json={
        "tableNumber": f"CASH-{int(time.time())%1000}",
        "status": "Available"
    })
    table_cash = t_res.json().get("data")
    
    # Lấy món ăn có sẵn
    menu_res = session.get(f"{BASE_URL}/menu")
    menu_items = menu_res.json().get("data", [])
    dish = next((m for m in menu_items if m.get("status") in ["Available", "Active", "active"]), None)
    dish_price = dish.get("base_price", 60000)

    # Khách đặt 2 phần món ăn
    order_res = session.post(f"{BASE_URL}/orders", json={
        "table_id": table_cash["_id"],
        "customerInfo": "Khách Bàn VIP",
        "items": [
            {
                "menuItem_id": dish["_id"],
                "quantity": 2
            }
        ]
    })
    
    test_order = order_res.json().get("data")
    order_id = test_order["_id"]
    subtotal = test_order["totalAmount"] # 2 x 60,000 = 120,000đ
    logger.success(f"Khởi tạo đơn hàng tại Bàn {table_cash.get('tableNumber')}! Mã đơn: {order_id} | Tổng tiền: {subtotal:,.0f} đ")

    # Thu ngân lấy chi tiết đơn hàng (Xem Bill tạm tính)
    bill_res = session.get(f"{BASE_URL}/orders/{order_id}")
    if bill_res.status_code == 200:
        bill_data = bill_res.json()["data"]
        logger.success(f"Tải chi tiết hóa đơn tạm tính thành công! Số lượng món: {len(bill_data.get('items', []))}")
        logger.info(f"-> Món: {dish['name']} x 2 phần = {subtotal:,.0f} đ")
    else:
        logger.error("Không thể tải chi tiết hóa đơn!", bill_res.text)

    # =========================================================================
    # BƯỚC 4: TEST ÁP DỤNG VOUCHER / KHUYẾN MÃI (DISCOUNT)
    # =========================================================================
    logger.step(4, "Khách hàng xuất trình mã giảm giá (Voucher / Discount)")
    
    # Tạo mã voucher giảm 20,000đ nếu chưa có
    v_code = f"DISC{int(time.time())%1000}"
    v_create = session.post(f"{BASE_URL}/vouchers", json={
        "code": v_code,
        "name": "Giảm giá đặc biệt 20k",
        "type": "fixed",
        "value": 20000,
        "minOrderValue": 50000,
        "status": "Active"
    })
    
    discount_val = 20000
    final_amount = subtotal - discount_val # 120,000 - 20,000 = 100,000đ
    
    # Cập nhật chiết khấu vào đơn hàng
    update_order = session.put(f"{BASE_URL}/orders/{order_id}", json={
        "discountAmount": discount_val,
        "totalAmount": final_amount,
        "voucherCode": v_code
    })

    if update_order.status_code == 200:
        logger.success(f"Áp dụng Voucher [{v_code}] thành công! Giảm: -{discount_val:,.0f}đ -> Cần thanh toán: {final_amount:,.0f}đ")
    else:
        logger.warn(f"Cập nhật voucher: {update_order.text}")

    # =========================================================================
    # BƯỚC 5: TEST THANH TOÁN TIỀN MẶT, TÍNH TIỀN THỪA & GIẢI PHÓNG BÀN
    # =========================================================================
    logger.step(5, "Thực hiện thanh toán Tiền mặt (Cash), tính tiền thừa & Giải phóng bàn")
    
    customer_gave = int(((final_amount // 100000) + 1) * 100000) if final_amount % 100000 != 0 else int(final_amount + 100000) # Làm tròn mệnh giá tiền mặt khách đưa
    expected_change = customer_gave - final_amount
    
    logger.info(f"Khách thanh toán Tiền mặt. Tiền cần thu: {final_amount:,.0f}đ | Khách đưa: {customer_gave:,.0f}đ")
    
    pay_res = session.post(f"{BASE_URL}/payments", json={
        "order_id": order_id,
        "cashier_id": cashier_id,
        "payment_method": "Cash",
        "amount": final_amount,
        "customerCash": customer_gave,
        "changeAmount": expected_change
    })

    if pay_res.status_code == 200 and pay_res.json().get("status") == 1:
        pay_data = pay_res.json()["data"]["payment"]
        logger.success(f"Thanh toán thành công! Mã giao dịch: {pay_data['_id']}")
        logger.success(f"Tiền khách đưa: {pay_data.get('customerCash'):,.0f}đ -> Tiền thừa thối lại: {pay_data.get('changeAmount'):,.0f}đ")
        
        # KIỂM TRA TRẠNG THÁI ORDER: Phải là Paid & Completed
        check_order = session.get(f"{BASE_URL}/orders/{order_id}").json().get("data", {})
        if check_order.get("paymentStatus") == "Paid" and check_order.get("status") == "Completed":
            logger.success("Đúng chuẩn BRD 1.5: Đơn hàng đã chuyển sang trạng thái Paid & Completed.")
        else:
            logger.warn(f"Trạng thái đơn hàng sau thanh toán: status={check_order.get('status')}, paymentStatus={check_order.get('paymentStatus')}")

        # KIỂM TRA GIẢI PHÓNG BÀN: Bàn phải về Available & currentOrderId = null
        check_table = session.get(f"{BASE_URL}/tables/{table_cash['_id']}").json().get("data", {})
        if check_table.get("status") == "Available" and not check_table.get("currentOrderId"):
            logger.success("Đúng chuẩn BRD 1.5: Bàn ăn lập tức được giải phóng về trạng thái TRỐNG (Available / Màu xanh)!")
        else:
            logger.error("Bàn ăn chưa được giải phóng về Available sau thanh toán!", str(check_table))
    else:
        logger.error("Thanh toán hóa đơn thất bại!", pay_res.text)

    # =========================================================================
    # BƯỚC 6: QUẢN LÝ QUỸ KÉT TRONG CA (CASH TRANSACTIONS)
    # =========================================================================
    logger.step(6, "Quản lý quỹ két: Lập phiếu Thu tiền két (Cash In) và Chi tiền két (Cash Out)")
    
    # 1. Phiếu Thu: Nạp thêm 200,000đ tiền lẻ
    in_res = session.post(f"{BASE_URL}/cash-transactions", json={
        "shift_id": shift_id,
        "type": "in",
        "amount": 200000,
        "reason": "Nạp thêm tiền lẻ thối đầu ca"
    })
    if in_res.status_code in [200, 201]:
        logger.success("Lập phiếu THU TIỀN KÉT (Cash In) thành công: +200,000 đ")
    else:
        logger.error("Lập phiếu thu thất bại!", in_res.text)

    # 2. Phiếu Chi: Rút 50,000đ mua đá lạnh
    out_res = session.post(f"{BASE_URL}/cash-transactions", json={
        "shift_id": shift_id,
        "type": "out",
        "amount": 50000,
        "reason": "Mua đá lạnh khẩn cấp cho quầy bar"
    })
    if out_res.status_code in [200, 201]:
        logger.success("Lập phiếu CHI TIỀN KÉT (Cash Out) thành công: -50,000 đ")
    else:
        logger.error("Lập phiếu chi thất bại!", out_res.text)

    # =========================================================================
    # BƯỚC 7: KẾT THÚC CA & CHỐT SỔ KẾT TOÁN (CLOCK-OUT & Z-REPORT)
    # =========================================================================
    logger.step(7, "Chốt ca làm việc cuối ngày & Kiểm tra công thức đối soát két")
    
    # Tính toán kỳ vọng lý thuyết trong két:
    # Tiền đầu ca (1,000,000) + Tiền bán mặt (100,000) + Thu két (200,000) - Chi két (50,000) = 1,250,000đ
    expected_real_cash = start_cash + final_amount + 200000 - 50000
    
    logger.info(f"Tổng tiền mặt thực tế đếm được trong két: {expected_real_cash:,.0f} đ")
    logger.info("Thu ngân tiến hành bấm [Đóng ca & Chốt két]...")

    close_res = session.post(f"{BASE_URL}/shifts/{shift_id}/close", json={
        "actualCash": expected_real_cash,
        "notes": "Chốt ca thành công, khớp tiền 100%"
    })

    if close_res.status_code == 200 and close_res.json().get("status") == 1:
        closed_data = close_res.json()["data"]
        ending_cash = closed_data.get("endingCash", 0)
        diff = closed_data.get("difference", 0)
        
        logger.success(f"Đóng ca thành công! Trạng thái ca: [{closed_data.get('status')}]")
        logger.info(f"-> Tiền kết ca hệ thống tính: {ending_cash:,.0f} đ")
        logger.info(f"-> Tiền thực tế thu ngân nộp: {expected_real_cash:,.0f} đ")
        logger.info(f"-> Chênh lệch sổ sách: {diff:,.0f} đ")

        # KIỂM TRA LỖI LOGIC TÀI CHÍNH:
        # Nếu endingCash KHÔNG cộng tiền bán hóa đơn mặt (final_amount = 100k), 
        # thì endingCash sẽ là 1,150,000đ và chênh lệch bị báo lệch +100k!
        if ending_cash == expected_real_cash and diff == 0:
            logger.success("Công thức chốt ca chuẩn 100%: Hệ thống đã tính đủ tiền mặt từ các hóa đơn bán trong ca!")
        else:
            logger.warn(f"LỖI TÍNH TOÁN KÉT: Hệ thống bỏ quên tiền mặt bán hàng ({final_amount:,.0f}đ) khi chốt sổ! endingCash = {ending_cash:,.0f}đ, dẫn đến báo lệch sổ sách {diff:,.0f}đ!")
    else:
        logger.error("Đóng ca thất bại!", close_res.text)

    # Dọn dẹp bàn test tạm thời
    if 'table_cash' in locals() and table_cash and '_id' in table_cash:
        session.delete(f"{BASE_URL}/tables/{table_cash['_id']}")

    # =========================================================================
    # TỔNG KẾT BÁO CÁO KIỂM THỬ
    # =========================================================================
    print(f"\n{Colors.BOLD}" + "="*68)
    print(" BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ PHÂN HỆ THU NGÂN (CASHIER)")
    print("="*68 + f"{Colors.RESET}")
    print(f" {Colors.GREEN}✔ SỐ TEST CASE ĐẠT (PASS): {logger.passed}{Colors.RESET}")
    print(f" {Colors.RED}✘ SỐ TEST CASE LỖI (FAIL): {logger.failed}{Colors.RESET}")
    print(f" {Colors.YELLOW}⚠ CẢNH BÁO / LỖI NGHIỆP VỤ (WARN): {len(logger.warnings)}{Colors.RESET}")
    
    if logger.errors:
        print(f"\n{Colors.RED}DANH SÁCH LỖI KỸ THUẬT:{Colors.RESET}")
        for idx, err in enumerate(logger.errors, 1):
            print(f"  {idx}. {err}")

    if logger.warnings:
        print(f"\n{Colors.YELLOW}DANH SÁCH LỖI TÀI CHÍNH / NGHIỆP VỤ PHÁT HIỆN:{Colors.RESET}")
        for idx, w in enumerate(logger.warnings, 1):
            print(f"  {idx}. {w}")
    print("="*68 + "\n")


if __name__ == "__main__":
    run_cashier_tests()
