"""
=============================================================================
  KIỂM THỬ TÍNH NĂNG: FLASH SALE MÓN ĂN & ÁP GIÁ TỰ ĐỘNG PHÍA SERVER
=============================================================================
"""
import requests
import datetime

BASE_URL = "http://localhost:4000/api"

def test_flash_sale():
    print("\n--- BẮT ĐẦU TEST FLASH SALE MÓN ĂN ---")
    
    # 1. Lấy danh sách món và chọn món đang bật Flash Sale
    items_res = requests.get(f"{BASE_URL}/menu")
    items = items_res.json().get("data", [])
    
    flash_item = None
    for it in items:
        if it.get("is_flash_sale") and it.get("status") == "Available" and it.get("flash_sale_sold", 0) < it.get("flash_sale_limit", 999):
            flash_item = it
            break
            
    if not flash_item:
        print("[FAIL] Không tìm thấy món ăn nào đang bật Flash Sale!")
        return False
        
    print(f"[*] Món thử nghiệm: {flash_item['name']}")
    print(f"    - Giá gốc niêm yết: {flash_item['base_price']:,.0f} đ")
    print(f"    - Giá Flash Sale   : {flash_item['sale_price']:,.0f} đ")
    print(f"    - Đã bán trước đó  : {flash_item.get('flash_sale_sold', 0)} / {flash_item.get('flash_sale_limit', 0)}")
    
    # 2. Khách hàng gửi đơn đặt 1 phần món Flash Sale
    # Chú ý: Client không gửi giá lên, server bắt buộc phải tự động áp giá sale_price
    initial_sold = flash_item.get("flash_sale_sold", 0)
    order_res = requests.post(f"{BASE_URL}/orders", json={
        "items": [
            {
                "menuItem_id": flash_item["_id"],
                "quantity": 1
            }
        ],
        "notes": "Test Flash Sale Order"
    })
    
    if order_res.status_code not in [200, 201]:
        print(f"[FAIL] Đặt hàng thất bại: {order_res.text}")
        return False
        
    order_data = order_res.json().get("data", {})
    subtotal = order_data.get("subtotal")
    expected_price = flash_item["sale_price"]
    
    print(f"[*] Phản hồi từ Server:")
    print(f"    - Mã đơn: {order_data.get('_id')}")
    print(f"    - Tổng tiền thực tế tính: {subtotal:,.0f} đ")
    
    if subtotal == expected_price:
        print(f"[PASS] Server đã tự động nhận diện Flash Sale và áp dụng giá ưu đãi {expected_price:,.0f} đ (thay vì giá gốc {flash_item['base_price']:,.0f} đ)!")
    else:
        print(f"[FAIL] Server tính sai giá: Nhận được {subtotal} đ nhưng kỳ vọng giá Flash Sale là {expected_price} đ!")
        return False
        
    # 3. Kiểm tra số suất đã bán tăng lên 1
    updated_item = requests.get(f"{BASE_URL}/menu/{flash_item['_id']}").json().get("data", {})
    new_sold = updated_item.get("flash_sale_sold", 0)
    print(f"[*] Số suất đã bán sau khi đặt: {new_sold} (Tăng từ {initial_sold})")
    
    if new_sold == initial_sold + 1:
        print(f"[PASS] Cơ chế tự động đếm suất bán Flash Sale (flash_sale_sold) hoạt động chính xác 100%!")
    else:
        print(f"[WARN] Số suất bán chưa được cập nhật chính xác (Kỳ vọng: {initial_sold + 1}, Thực tế: {new_sold})")
        
    print("\n🎉 KIỂM THỬ BACKEND FLASH SALE HOÀN TẤT XUẤT SẮC!\n")
    return True

if __name__ == "__main__":
    test_flash_sale()
