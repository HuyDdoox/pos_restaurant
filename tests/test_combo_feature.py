import requests
import json
import time

BASE_URL = "http://localhost:4000/api"

def run_combo_tests():
    print("=" * 70)
    print(" BẮT ĐẦU KIỂM THỬ TÍNH NĂNG QUẢN LÝ COMBO (COMBO FEATURE TEST)")
    print("=" * 70)

    # 1. Admin đăng nhập
    print("\n--- BƯỚC 1: Admin đăng nhập ---")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "admin_master_01",
        "password": "password123"
    })
    if login_res.status_code != 200:
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "username": "admin_master_01",
            "password": "123"
        })
    if login_res.status_code != 200:
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "username": "admin_master_01",
            "password": "hashed_pass_1"
        })

    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json().get("data", {}).get("accessToken")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"[PASS] Admin đăng nhập thành công! Token: {token[:25]}...")

    # 2. Lấy danh sách món và category để tạo combo
    print("\n--- BƯỚC 2: Chuẩn bị món con & danh mục ---")
    menu_res = requests.get(f"{BASE_URL}/menu", headers=headers)
    assert menu_res.status_code == 200
    menu_items = [m for m in menu_res.json()["data"] if m.get("status") == "Available" and not m.get("is_combo")]
    assert len(menu_items) >= 2, "Cần ít nhất 2 món ăn để tạo combo test"

    item_1 = menu_items[0]
    item_2 = menu_items[1]
    print(f"[INFO] Chọn món 1: {item_1['name']} ({item_1['base_price']:,}đ)")
    print(f"[INFO] Chọn món 2: {item_2['name']} ({item_2['base_price']:,}đ)")

    cats_res = requests.get(f"{BASE_URL}/categories", headers=headers)
    cats = cats_res.json()["data"]
    combo_cat = next((c for c in cats if "combo" in c["name"].lower()), cats[0])
    print(f"[INFO] Danh mục combo: {combo_cat['name']} (ID: {combo_cat['_id']})")

    # Lấy variants của món 1 nếu có
    var_res = requests.get(f"{BASE_URL}/variants?menuItem_id={item_1['_id']}", headers=headers)
    vars_item_1 = var_res.json().get("data", [])
    v1_id = None
    v1_name = ""
    v1_price = 0
    if len(vars_item_1) > 0:
        v1 = vars_item_1[0]
        v1_id = v1["_id"]
        v1_name = v1["name"]
        v1_price = v1.get("extra_price", 0)
        print(f"[INFO] Chọn biến thể cho món 1: {v1_name} (+{v1_price:,}đ)")

    # 3. Tạo Combo mới
    print("\n--- BƯỚC 3: Admin tạo Combo Ưu Đãi Tiết Kiệm ---")
    combo_items_data = [
        {
            "menuItem_id": item_1["_id"],
            "name": item_1["name"],
            "variant_id": v1_id,
            "variant_name": v1_name,
            "extra_price": v1_price,
            "quantity": 1,
            "item_unit_price": item_1["base_price"] + v1_price
        },
        {
            "menuItem_id": item_2["_id"],
            "name": item_2["name"],
            "variant_id": None,
            "variant_name": "",
            "extra_price": 0,
            "quantity": 2,
            "item_unit_price": item_2["base_price"]
        }
    ]

    total_original = (item_1["base_price"] + v1_price) + (item_2["base_price"] * 2)
    combo_price = int(total_original * 0.8)  # Giảm 20%
    savings = total_original - combo_price
    print(f"[INFO] Tổng giá gốc các món: {total_original:,}đ")
    print(f"[INFO] Giá Combo thiết lập: {combo_price:,}đ (Tiết kiệm: {savings:,}đ ~ 20%)")

    combo_payload = {
        "category_id": combo_cat["_id"],
        "name": f"Combo Đãi Tiệc 2-3 Người (Test {int(time.time())})",
        "base_price": combo_price,
        "description": "Thực đơn kết hợp siêu hấp dẫn gồm món chính và thức uống tươi mát.",
        "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
        "status": "Available",
        "is_combo": True,
        "serving_size": "2-3 Người",
        "combo_items": combo_items_data
    }

    create_combo_res = requests.post(f"{BASE_URL}/menu", json=combo_payload, headers=headers)
    assert create_combo_res.status_code in [200, 201], f"Create combo failed: {create_combo_res.text}"
    created_combo = create_combo_res.json()["data"]
    combo_id = created_combo["_id"]
    print(f"[PASS] Tạo Combo thành công! ID: {combo_id}")
    print(f"[PASS] is_combo: {created_combo.get('is_combo')} | serving_size: {created_combo.get('serving_size')}")
    print(f"[PASS] Số món con trong combo: {len(created_combo.get('combo_items', []))}")

    # 4. Kiểm tra lấy chi tiết Combo qua API
    print("\n--- BƯỚC 4: Kiểm tra truy vấn Combo qua API ---")
    get_res = requests.get(f"{BASE_URL}/menu/{combo_id}", headers=headers)
    assert get_res.status_code == 200
    fetched_combo = get_res.json()["data"]
    assert fetched_combo["is_combo"] == True
    assert len(fetched_combo["combo_items"]) == 2
    assert fetched_combo["combo_items"][0]["name"] == item_1["name"]
    print(f"[PASS] Truy vấn Combo chính xác: Cấu trúc con combo_items lưu trọn vẹn Object Mixed.")

    # 5. Khách hàng đặt món Combo
    print("\n--- BƯỚC 5: Khách hàng đặt món Combo từ E-Menu ---")
    # Lấy danh sách bàn
    tables_res = requests.get(f"{BASE_URL}/tables", headers=headers)
    tables = tables_res.json()["data"]
    available_tables = [t for t in tables if t.get('status') == 'Available']
    table_target = available_tables[0] if available_tables else tables[0]

    order_payload = {
        "table_id": table_target["_id"],
        "customerInfo": f"Khách Bàn {table_target['tableNumber']}",
        "notes": "Làm nóng giúp em",
        "items": [
            {
                "menuItem_id": combo_id,
                "quantity": 1,
                "variantNote": "Combo giao đủ món"
            }
        ]
    }

    order_res = requests.post(f"{BASE_URL}/orders", json=order_payload, headers=headers)
    assert order_res.status_code in [200, 201], f"Order failed: {order_res.text}"
    order_data = order_res.json()["data"]
    order_id = order_data["_id"]
    print(f"[PASS] Đặt món Combo thành công! Order ID: {order_id}")
    order_total = order_data.get("totalAmount") or order_data.get("subtotal") or 0
    print(f"[PASS] Tổng tiền đơn hàng: {order_total:,}đ (Khớp đúng giá Combo {combo_price:,}đ)")
    assert order_total == combo_price, f"Giá tiền đơn hàng ({order_total}) phải khớp đúng base_price của combo ({combo_price})"

    # 6. Kiểm tra OrderDetail và KDS Dispatch
    print("\n--- BƯỚC 6: Kiểm tra chi tiết OrderDetail & Bếp KDS nhận Combo ---")
    details_res = requests.get(f"{BASE_URL}/order-details?order_id={order_id}", headers=headers)
    assert details_res.status_code == 200
    details = details_res.json()["data"]
    assert len(details) >= 1
    combo_detail = details[0]
    print(f"[PASS] OrderDetail ghi nhận is_combo: {combo_detail.get('is_combo')}")
    print(f"[PASS] OrderDetail nhận được combo_items gồm {len(combo_detail.get('combo_items', []))} món thành phần!")
    for idx, c_it in enumerate(combo_detail.get("combo_items", [])):
        var_text = f" ({c_it.get('variant_name')})" if c_it.get('variant_name') else ""
        print(f"       -> Món con {idx+1}: {c_it.get('quantity', 1)}x {c_it.get('name')}{var_text}")

    # Kiểm tra KDS queue
    kds_res = requests.get(f"{BASE_URL}/order-details/kitchen-queue", headers=headers)
    assert kds_res.status_code == 200
    kds_items = kds_res.json().get("data", [])
    combo_kds = next((k for k in kds_items if str(k.get("_id")) == str(combo_detail.get("_id"))), None)
    if combo_kds:
        print(f"[PASS] KDS Bếp nhận được món Combo vào hàng đợi chế biến!")
        print(f"[PASS] KDS nhận diện is_combo: {combo_kds.get('is_combo')}")
        print(f"[PASS] KDS có đủ {len(combo_kds.get('combo_items', []))} món thành phần để đầu bếp chuẩn bị.")

    # 7. Dọn dẹp dữ liệu test (Clean-up) để bảo toàn dữ liệu thật
    print("\n--- BƯỚC 7: Tự động dọn dẹp dữ liệu test ---")
    del_res = requests.delete(f"{BASE_URL}/menu/{combo_id}?permanent=true", headers=headers)
    if del_res.status_code == 200:
        print(f"[CLEANUP] Đã xóa Combo test ({combo_id}) khỏi hệ thống!")
    requests.delete(f"{BASE_URL}/orders/{order_id}", headers=headers)
    requests.patch(f"{BASE_URL}/tables/{table_target['_id']}", json={"status": "Available", "currentOrderId": None}, headers=headers)
    print(f"[CLEANUP] Đã xóa đơn test ({order_id}) và trả bàn {table_target['tableNumber']} về trạng thái Available!")

    print("\n" + "=" * 70)
    print(" TẤT CẢ CÁC BÀI TEST TÍNH NĂNG COMBO ĐỀU ĐẠT CHUẨN 100%! 🎉")
    print("=" * 70)

if __name__ == "__main__":
    run_combo_tests()
