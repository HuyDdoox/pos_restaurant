"""
=============================================================================
  KIỂM THỬ TOÀN DIỆN PHÂN HỆ: QUẢN TRỊ VIÊN (ADMIN SYSTEM)
  Tuân thủ chuẩn: ADMIN_REQUIREMENTS.md
  Bao gồm:
    1. JWT Authentication & Xác thực quyền Admin (RBAC)
    2. Quản trị Nhân sự & Vòng đời tài khoản (Tạo, Khóa kèm lý do, Ngăn đăng nhập)
    3. Quản trị Thực đơn, Biến thể & Kiểm tra Xóa mềm (Soft Delete vs Hard Delete)
    4. Quản trị Kho nguyên liệu, Định lượng món (Recipes) & Cảnh báo tồn kho tối thiểu
    5. Kiểm soát Thất thoát & Nhật ký kiểm toán (Loss Reports & Audit Logs)
    6. Đánh giá bảo mật phân quyền RBAC (Role-Based Access Control)
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


def run_admin_tests():
    logger = TestLogger()
    session = requests.Session()

    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*70)
    print(" BẮT ĐẦU KIỂM THỬ PHÂN HỆ: QUẢN TRỊ VIÊN (ADMIN TEST SUITE)")
    print("="*70 + f"{Colors.RESET}")

    # =========================================================================
    # BƯỚC 1: XÁC THỰC VÀ LẤY JWT TOKEN VỚI ROLE 'Admin'
    # =========================================================================
    logger.step(1, "Đăng nhập vai trò Quản trị viên (Admin) & Cấp JWT Token")

    admin_auth = {
        "username": "admin_master_01",
        "password": "password123",
        "fullname": "Tổng Quản Trị Hệ Thống",
        "role": "Admin",
        "phone": "0900000001",
        "email": "admin@restaurant.com"
    }

    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username": admin_auth["username"],
        "password": admin_auth["password"]
    })

    admin_token = None
    if login_res.status_code == 200:
        res_json = login_res.json()
        data = res_json.get("data", {})
        admin_token = data.get("accessToken")
        logger.success(f"Admin đăng nhập thành công. Token được cấp phát: {admin_token[:25]}...")
    else:
        # Nếu chưa có tài khoản admin_master_01, đăng ký mới
        logger.info("Chưa có tài khoản admin_master_01, tiến hành khởi tạo...")
        reg_res = session.post(f"{BASE_URL}/auth/register", json=admin_auth)
        if reg_res.status_code in [200, 201]:
            logger.info("Đăng ký Admin thành công, tiến hành đăng nhập lại...")
            login_again = session.post(f"{BASE_URL}/auth/login", json={
                "username": admin_auth["username"],
                "password": admin_auth["password"]
            })
            if login_again.status_code == 200:
                admin_token = login_again.json().get("data", {}).get("accessToken")
                logger.success(f"Khởi tạo & Đăng nhập Admin thành công. Token: {admin_token[:25]}...")
            else:
                logger.error("Đăng nhập Admin thất bại sau khi đăng ký!", login_again.text)
                return
        else:
            logger.error("Không thể tạo tài khoản Admin!", reg_res.text)
            return

    # Xác thực danh tính qua GET /api/auth/me với Bearer Token
    headers = {"Authorization": f"Bearer {admin_token}"}
    me_res = session.get(f"{BASE_URL}/auth/me", headers=headers)
    if me_res.status_code == 200:
        user_info = me_res.json().get("data", {})
        if user_info.get("role") == "Admin":
            logger.success(f"Xác thực quyền Admin hợp lệ qua Bearer Token: {user_info.get('fullname')} ({user_info.get('username')})")
        else:
            logger.error(f"Vai trò không phải Admin! Role hiện tại: {user_info.get('role')}")
    else:
        logger.error("Xác thực /api/auth/me thất bại với Bearer Token!", me_res.text)

    # =========================================================================
    # BƯỚC 2: QUẢN TRỊ NHÂN SỰ & VÒNG ĐỜI TÀI KHOẢN (RBAC & LOCKING)
    # =========================================================================
    logger.step(2, "Quản trị Nhân sự: Tạo tài khoản, Kiểm tra trùng lặp & Khóa/Mở khóa có lưu vết")

    unique_suffix = int(time.time()) % 10000
    test_staff = {
        "username": f"waiter_test_{unique_suffix}",
        "password": "password123",
        "fullname": f"Nhân Viên Test {unique_suffix}",
        "role": "Waiter",
        "phone": f"0912{unique_suffix:06d}",
        "email": f"waiter_{unique_suffix}@restaurant.com"
    }

    # 2.1 Tạo tài khoản nhân viên mới
    create_res = session.post(f"{BASE_URL}/users", json=test_staff, headers=headers)
    created_user_id = None
    if create_res.status_code == 201:
        created_user = create_res.json().get("data", {})
        created_user_id = created_user.get("_id")
        # Kiểm tra không lộ password băm trong response
        if "password" not in created_user:
            logger.success(f"Tạo nhân sự mới thành công: [{test_staff['username']}] (ID: {created_user_id}), mật khẩu được bảo mật ẩn hoàn toàn.")
        else:
            logger.warn(f"Tạo nhân sự thành công nhưng response trả về mật khẩu băm!")
    else:
        logger.error("Tạo nhân sự mới thất bại!", create_res.text)

    # 2.2 Kiểm tra ràng buộc trùng lặp username (409 Conflict)
    dup_res = session.post(f"{BASE_URL}/users", json=test_staff, headers=headers)
    if dup_res.status_code == 409:
        logger.success(f"Ràng buộc duy nhất username hoạt động chuẩn: Trả về HTTP 409 khi tạo trùng [{test_staff['username']}].")
    else:
        logger.error("Không chặn tạo tài khoản trùng lặp username!", f"HTTP {dup_res.status_code}: {dup_res.text}")

    # 2.3 Kiểm tra Khóa tài khoản BẮT BUỘC có lý do (ADMIN_REQUIREMENTS.md Section 1.3)
    logger.info("Kiểm tra quy định bắt buộc nhập lock_reason khi khóa tài khoản nhân sự...")
    lock_without_reason = session.patch(f"{BASE_URL}/users/{created_user_id}/lock", json={
        "status": "Locked"
        # Cố tình không gửi lock_reason
    }, headers=headers)

    if lock_without_reason.status_code == 400:
        logger.success("Hệ thống chặn thành công việc khóa tài khoản không có lý do (HTTP 400).")
    else:
        logger.warn(f"Hệ thống cho phép khóa tài khoản mà KHÔNG BẮT BUỘC nhập lock_reason! (HTTP {lock_without_reason.status_code}) - Cần bổ sung validation theo BRD 1.3")

    # 2.4 Khóa tài khoản hợp lệ kèm lock_reason
    lock_reason_text = "Nghỉ việc không báo trước và vi phạm nội quy thu ngân"
    lock_res = session.patch(f"{BASE_URL}/users/{created_user_id}/lock", json={
        "status": "Locked",
        "reason": lock_reason_text
    }, headers=headers)

    if lock_res.status_code == 200:
        locked_data = lock_res.json().get("data", {})
        if locked_data.get("status") == "Locked" and locked_data.get("lock_reason") == lock_reason_text:
            logger.success(f"Khóa tài khoản thành công kèm lưu vết lý do: '{lock_reason_text}'.")
        else:
            logger.error("Trạng thái hoặc lý do khóa không được cập nhật chính xác!", str(locked_data))
    else:
        logger.error("Khóa tài khoản thất bại!", lock_res.text)

    # 2.5 Kiểm tra tài khoản bị khóa có bị ngăn chặn đăng nhập không
    logger.info("Thử đăng nhập vào hệ thống bằng tài khoản vừa bị khóa...")
    locked_login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username": test_staff["username"],
        "password": test_staff["password"]
    })

    if locked_login_res.status_code == 403:
        logger.success(f"Bảo vệ đăng nhập hoạt động hoàn hảo: Tài khoản bị khóa bị từ chối truy cập (HTTP 403 Forbidden).")
    else:
        logger.error("LỖ HỔNG: Tài khoản đã bị khóa nhưng vẫn đăng nhập được!", f"HTTP {locked_login_res.status_code}: {locked_login_res.text}")

    # 2.6 Mở khóa tài khoản nhân sự
    unlock_res = session.patch(f"{BASE_URL}/users/{created_user_id}/lock", json={
        "status": "Active"
    }, headers=headers)
    if unlock_res.status_code == 200 and unlock_res.json().get("data", {}).get("status") == "Active":
        logger.success("Mở khóa tài khoản thành công (Trạng thái chuyển về Active).")
        # Kiểm tra đăng nhập lại
        re_login = session.post(f"{BASE_URL}/auth/login", json={
            "username": test_staff["username"],
            "password": test_staff["password"]
        })
        if re_login.status_code == 200:
            logger.success("Tài khoản sau khi mở khóa đăng nhập bình thường.")
        else:
            logger.error("Tài khoản mở khóa không thể đăng nhập!", re_login.text)
    else:
        logger.error("Mở khóa tài khoản thất bại!", unlock_res.text)

    # =========================================================================
    # BƯỚC 3: QUẢN TRỊ THỰC ĐƠN, BIẾN THỂ & KIỂM TRA SOFT DELETE (BRD 1.1)
    # =========================================================================
    logger.step(3, "Quản trị Thực đơn & Biến thể: Thêm mới, Ràng buộc & Kiểm tra Xóa mềm (Soft Delete)")

    # 3.1 Tạo Danh mục thử nghiệm
    cat_payload = {
        "name": f"Trà Trái Cây Độc Quyền {unique_suffix}",
        "description": "Danh mục trà trái cây giải nhiệt mùa hè"
    }
    cat_res = session.post(f"{BASE_URL}/categories", json=cat_payload, headers=headers)
    category_id = None
    if cat_res.status_code in [200, 201]:
        category_id = cat_res.json().get("data", {}).get("_id")
        logger.success(f"Tạo danh mục món ăn thành công: '{cat_payload['name']}' (ID: {category_id})")
    else:
        logger.error("Tạo danh mục thất bại!", cat_res.text)

    # 3.2 Tạo Món ăn mới kèm danh mục
    menu_item_payload = {
        "name": f"Trà Vải Hoa Hồng Đặc Biệt {unique_suffix}",
        "price": 55000,
        "base_price": 55000,
        "category_id": category_id,
        "description": "Trà vải tươi kết hợp siro hoa hồng thanh mát",
        "status": "Available"
    }
    item_res = session.post(f"{BASE_URL}/menu", json=menu_item_payload, headers=headers)
    menu_item_id = None
    if item_res.status_code in [200, 201]:
        menu_item_id = item_res.json().get("data", {}).get("_id")
        logger.success(f"Tạo món ăn mới thành công: '{menu_item_payload['name']}' - Giá: 55.000đ (ID: {menu_item_id})")
    else:
        logger.error("Tạo món ăn thất bại!", item_res.text)

    # 3.3 Tạo Biến thể (Variants) cho món
    variant_payload = {
        "menuItem_id": menu_item_id,
        "name": "Size Lớn (L) - Thêm Thạch",
        "extra_price": 12000
    }
    var_res = session.post(f"{BASE_URL}/variants", json=variant_payload, headers=headers)
    variant_id = None
    if var_res.status_code in [200, 201]:
        variant_id = var_res.json().get("data", {}).get("_id")
        logger.success(f"Tạo biến thể món thành công: '{variant_payload['name']}' (+12.000đ)")
    else:
        logger.error("Tạo biến thể món thất bại!", var_res.text)

    # 3.4 Kiểm tra hành vi Xóa món ăn (SOFT DELETE VS HARD DELETE)
    # BRD 1.1: "Khi một món không còn kinh doanh, Admin KHÔNG xóa vĩnh viễn khỏi CSDL (để bảo toàn lịch sử hóa đơn).
    # Thay vào đó, hệ thống thực hiện Xóa mềm (Ngừng bán) bằng cách thay đổi trạng thái bản ghi thành Archived hoặc Inactive."
    logger.info("Thực hiện lệnh xóa món ăn DELETE /api/menu/:id để kiểm tra Soft Delete...")
    del_res = session.delete(f"{BASE_URL}/menu/{menu_item_id}", headers=headers)

    if del_res.status_code == 200:
        # Kiểm tra lại trong CSDL xem bản ghi còn tồn tại với trạng thái Archived không
        check_item = session.get(f"{BASE_URL}/menu/{menu_item_id}", headers=headers)
        if check_item.status_code == 200:
            item_status = check_item.json().get("data", {}).get("status")
            if item_status in ["Archived", "Inactive"]:
                logger.success(f"Xóa mềm (Soft Delete) hoạt động CHUẨN: Bản ghi được lưu trữ với status = '{item_status}'.")
            else:
                logger.warn(f"Món chưa bị xóa nhưng trạng thái không phải Archived/Inactive: status = '{item_status}'")
        elif check_item.status_code == 404:
            logger.error("LỖI NGHIÊM TRỌNG (VI PHẠM BRD 1.1): Hệ thống đang thực hiện HARD DELETE (Xóa cứng MenuItem.findByIdAndDelete)!",
                         "Món ăn và các biến thể bị xóa vĩnh viễn khỏi database, làm gãy toàn bộ tính toàn vẹn khóa ngoại của lịch sử hóa đơn quá khứ!")
        else:
            logger.warn(f"Phản hồi không xác định khi kiểm tra lại món đã xóa: HTTP {check_item.status_code}")
    else:
        logger.error("Lệnh DELETE /api/menu/:id thất bại!", del_res.text)

    # =========================================================================
    # BƯỚC 4: QUẢN TRỊ KHO & ĐỊNH LƯỢNG MÓN ĂN (RECIPES & INVENTORY)
    # =========================================================================
    logger.step(4, "Quản trị Kho & Định lượng: Thêm nguyên liệu, Chặn trùng tên & Thiết lập Recipe")

    # Tạo lại 1 món ăn dùng cho test Recipe
    recipe_item_res = session.post(f"{BASE_URL}/menu", json={
        "name": f"Trà Ô Long Sen Vàng {unique_suffix}",
        "price": 60000,
        "base_price": 60000,
        "category_id": category_id,
        "status": "Available"
    }, headers=headers)
    recipe_item_id = recipe_item_res.json().get("data", {}).get("_id")

    # 4.1 Thêm nguyên liệu mới vào kho
    ing_payload = {
        "name": f"Hạt Sen Huế Thượng Hạng {unique_suffix}",
        "stock_quantity": 25,
        "unit": "kg",
        "cost_price": 180000,
        "min_threshold": 5
    }
    ing_res = session.post(f"{BASE_URL}/inventory", json=ing_payload, headers=headers)
    ingredient_id = None
    if ing_res.status_code == 201:
        ingredient_id = ing_res.json().get("data", {}).get("_id")
        logger.success(f"Thêm nguyên vật liệu vào kho thành công: '{ing_payload['name']}' (Tồn: 25 kg, Cảnh báo: <=5 kg)")
    else:
        logger.error("Thêm nguyên liệu kho thất bại!", ing_res.text)

    # 4.2 Chặn trùng tên nguyên liệu (409 Conflict)
    dup_ing = session.post(f"{BASE_URL}/inventory", json=ing_payload, headers=headers)
    if dup_ing.status_code == 409:
        logger.success("Chặn trùng tên nguyên liệu kho hoạt động chính xác (HTTP 409 Conflict).")
    else:
        logger.error("Không chặn trùng tên nguyên liệu kho!", f"HTTP {dup_ing.status_code}: {dup_ing.text}")

    # 4.3 Thiết lập định lượng công thức món (Recipe Mapping - BRD 1.2)
    recipe_payload = {
        "menuItem_id": recipe_item_id,
        "ingredient_id": ingredient_id,
        "quantity_required": 0.05,  # 0.05 kg (50g hạt sen cho 1 ly trà)
        "unit": "kg"
    }
    recipe_res = session.post(f"{BASE_URL}/recipes", json=recipe_payload, headers=headers)
    if recipe_res.status_code in [200, 201]:
        logger.success(f"Thiết lập công thức định lượng thành công: 1 phần trà tốn {recipe_payload['quantity_required']}kg {ing_payload['name']}.")
    else:
        logger.error("Lưu công thức định lượng thất bại!", recipe_res.text)

    # 4.4 Kiểm tra truy vấn công thức định lượng kèm Populate
    get_recipe = session.get(f"{BASE_URL}/recipes?menuItem_id={recipe_item_id}", headers=headers)
    if get_recipe.status_code == 200:
        recipe_data = get_recipe.json().get("data", [])
        if len(recipe_data) > 0 and recipe_data[0].get("ingredient_id", {}).get("name"):
            ing_name = recipe_data[0]["ingredient_id"]["name"]
            logger.success(f"Truy vấn công thức định lượng chính xác kèm thông tin nguyên liệu: '{ing_name}'.")
        else:
            logger.warn("Công thức lấy được nhưng thông tin nguyên liệu chưa được populate!")
    else:
        logger.error("Không thể lấy danh sách công thức định lượng!", get_recipe.text)

    # 4.5 Kiểm tra bộ lọc cảnh báo kho cạn (lowStock=true)
    # Thêm 1 nguyên liệu có tồn kho dưới min_threshold
    low_ing_payload = {
        "name": f"Trà Ô Long Ủ Lạnh Cạn Kho {unique_suffix}",
        "stock_quantity": 2,
        "unit": "kg",
        "cost_price": 250000,
        "min_threshold": 5
    }
    session.post(f"{BASE_URL}/inventory", json=low_ing_payload, headers=headers)

    low_stock_res = session.get(f"{BASE_URL}/inventory?lowStock=true", headers=headers)
    if low_stock_res.status_code == 200:
        low_items = low_stock_res.json().get("data", [])
        found_low = any(i.get("name") == low_ing_payload["name"] for i in low_items)
        if found_low:
            logger.success(f"Cơ chế cảnh báo tồn kho tối thiểu hoạt động chuẩn: Phát hiện nguyên liệu '{low_ing_payload['name']}' tồn 2/5 kg.")
        else:
            logger.warn("Không tìm thấy nguyên liệu sắp hết trong danh sách lowStock=true!")
    else:
        logger.error("Lỗi truy vấn cảnh báo tồn kho thấp!", low_stock_res.text)

    # =========================================================================
    # BƯỚC 5: BÁO CÁO THẤT THOÁT & NHẬT KÝ KIỂM TOÁN (LOSS CONTROL & AUDIT)
    # =========================================================================
    logger.step(5, "Kiểm soát Thất thoát & Nhật ký kiểm toán: Tạo báo cáo hỏng/hủy & Đối soát")

    # 5.1 Tạo phiếu kiểm kê báo cáo thất thoát (Loss Report - BRD 1.4)
    loss_payload = {
        "reports": [
            {
                "ingredientId": ingredient_id,
                "systemStock": 25,
                "actualStock": 21,  # Thất thoát 4kg
                "reason": "Hạt sen bị ẩm mốc trong quá trình bảo quản tủ mát"
            }
        ]
    }
    loss_res = session.post(f"{BASE_URL}/loss-reports", json=loss_payload, headers=headers)
    if loss_res.status_code in [200, 201]:
        loss_data = loss_res.json().get("data", [])
        if len(loss_data) > 0:
            loss_cost = loss_data[0].get("lossCost", 0)
            logger.success(f"Tạo báo cáo thất thoát thành công: Hao hụt 4kg, Tổng giá trị thiệt hại: {loss_cost:,.0f}đ.")
        else:
            logger.warn("Báo cáo thất thoát trả về mảng rỗng!")
    else:
        logger.error("Tạo báo cáo thất thoát thất bại!", loss_res.text)

    # 5.2 Kiểm tra đối soát danh sách thất thoát
    get_loss = session.get(f"{BASE_URL}/loss-reports", headers=headers)
    if get_loss.status_code == 200:
        loss_list = get_loss.json().get("data", [])
        if len(loss_list) > 0:
            logger.success(f"Truy vấn danh mục báo cáo thất thoát thành công: Ghi nhận {len(loss_list)} sự cố hao hụt.")
        else:
            logger.warn("Danh sách báo cáo thất thoát rỗng!")
    else:
        logger.error("Không thể lấy danh sách báo cáo thất thoát!", get_loss.text)

    # 5.3 Kiểm tra Nhật ký kiểm toán (Audit Logs)
    get_audit = session.get(f"{BASE_URL}/audit-logs", headers=headers)
    if get_audit.status_code == 200:
        logs = get_audit.json().get("data", [])
        if len(logs) > 0:
            logger.success(f"Hệ thống Nhật ký kiểm toán (Audit Trail) ghi nhận đầy đủ {len(logs)} tác vụ hệ thống.")
            latest = logs[0]
            logger.info(f"-> Thao tác gần nhất: [{latest.get('category')}] {latest.get('action')} - Thực hiện bởi: {latest.get('actor')}")
        else:
            logger.warn("Audit logs hiện chưa ghi nhận log nào!")
    else:
        logger.error("Không thể lấy dữ liệu Audit Logs!", get_audit.text)

    # =========================================================================
    # BƯỚC 6: ĐÁNH GIÁ BẢO MẬT PHÂN QUYỀN RBAC (SECURITY ASSESSMENT)
    # =========================================================================
    logger.step(6, "Đánh giá Bảo mật Phân quyền RBAC: Chặn truy cập trái phép vào tài nguyên Quản trị")

    # Thử gọi API Quản trị mà KHÔNG gửi kèm Authorization Header
    unauth_user_post = requests.post(f"{BASE_URL}/users", json={
        "username": f"hacker_{unique_suffix}",
        "password": "password123",
        "fullname": "Hacker Truy Cập Trái Phép",
        "role": "Admin"
    })

    if unauth_user_post.status_code in [401, 403]:
        logger.success("API /api/users bảo vệ thành công: Chặn truy cập khi không có JWT Token.")
    else:
        logger.error("LỖ HỔNG BẢO MẬT (RBAC): Endpoint /api/users KHÔNG CÓ middleware verifyToken / checkRole!",
                     f"Yêu cầu không có JWT Token nhưng trả về HTTP {unauth_user_post.status_code}!")

    # =========================================================================
    # TỔNG KẾT BÁO CÁO KẾT QUẢ KIỂM THỬ PHÂN HỆ QUẢN TRỊ VIÊN
    # =========================================================================
    print(f"\n{Colors.BOLD}{Colors.YELLOW}" + "="*70)
    print(" KẾT QUẢ KIỂM THỬ TOÀN DIỆN PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN)")
    print("="*70 + f"{Colors.RESET}")
    print(f"Tổng số tiêu chí PASS: {Colors.GREEN}{Colors.BOLD}{logger.passed}{Colors.RESET}")
    print(f"Tổng số cảnh báo WARN: {Colors.YELLOW}{Colors.BOLD}{len(logger.warnings)}{Colors.RESET}")
    print(f"Tổng số lỗi FAILED    : {Colors.RED}{Colors.BOLD}{logger.failed}{Colors.RESET}")

    if logger.warnings:
        print(f"\n{Colors.YELLOW}--- DANH SÁCH CẢNH BÁO / ĐIỂM CẦN HOÀN THIỆN ---{Colors.RESET}")
        for i, w in enumerate(logger.warnings, 1):
            print(f" {i}. {w}")

    if logger.errors:
        print(f"\n{Colors.RED}--- DANH SÁCH LỖI / SAI LỆCH LOGIC & BẢO MẬT ---{Colors.RESET}")
        for i, e in enumerate(logger.errors, 1):
            print(f" {i}. {e}")

    print(f"\n{Colors.BOLD}{Colors.CYAN}" + "="*70 + f"{Colors.RESET}\n")

if __name__ == "__main__":
    run_admin_tests()
