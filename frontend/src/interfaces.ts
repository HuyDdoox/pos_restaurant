// ==========================================
// BỘ TỪ ĐIỂN DỮ LIỆU FRONTEND (12 MODELS)
// ==========================================

// --- 1. HỆ THỐNG & NHÂN SỰ ---
export interface Branch {
    id: string;
    name: string;
    address: string;
    phone: string;
    status: string;
}

export interface User {
    id: string;
    branch_id: string;
    username: string;
    full_name: string;
    role: string;
    status: string;
}

export interface Table {
    id: string;
    branch_id: string;
    tableNumber: string;
    max_capacity: number;
    current_pax: number;
    merged_with_id: string | null;
    assigned_waiter_id: string;
    status: string;
    qr_code?: string;
    zone?: string;
}

// --- 2. THỰC ĐƠN (MENU & CATEGORY) ---
export interface Category {
    id: string;
    name: string;
    description: string;
    icon?: string;
    displayOrder?: number;
    status?: string;
}

export interface MenuItem {
    id: string;
    category_id: string | any;
    name: string;
    description: string;
    base_price: number;
    image: string;
    status: string;
    inStock?: boolean; // Thuộc tính phụ trợ trên UI
    stock_quantity?: number; // Số lượng tồn kho
    tags?: string[];
    is_combo?: boolean;
    serving_size?: string;
    combo_items?: any[];
}

export interface Variant {
    id: string;
    menuItem_id: string;
    group_name?: string;
    name: string;
    extra_price: number;
    status: string;
    allowMultiple?: boolean;
}

// --- 3. KHO & ĐỊNH LƯỢNG (INVENTORY) ---
export interface Ingredient {
    id: string;
    name: string;
    unit: string;
    stock_quantity: number;
    status: string; // VD: 'Active', 'Inactive', 'Archived'
}

export interface Recipe {
    id: string;
    menuItem_id: string;
    ingredient_id: string;
    quantity_required: number;
}

// --- 4. GIAO DỊCH & HÓA ĐƠN ---
export interface Order {
    id: string;
    branch_id: string;
    table_id: string;
    waiter_id: string;
    cashier_id?: string;
    order_status: string;
    total_amount: number;
    order_time: string; // ISO Date String
}

export interface OrderDetail {
    id: string;
    order_id: string;
    menuItem_id: string;
    variant_id?: string;
    quantity: number;
    price_at_time: number;
    notes?: string;
    status: string; // VD: 'Pending', 'Preparing', 'Ready', 'Served'
    is_combo?: boolean;
    combo_items?: any[];
}

export interface Payment {
    id: string;
    order_id: string;
    amount: number;
    payment_method: string;
    payment_status: string;
    payment_time: string; // ISO Date String
}

// --- 5. CA LÀM VIỆC (SHIFT) ---
export interface Shift {
    id: string;
    branch_id: string;
    user_id: string;
    start_time: string; // ISO Date String
    end_time?: string;
    starting_cash: number;
    ending_cash?: number;
    status: string; // VD: 'Open', 'Closed'
}

// ==========================================
// TIỆN ÍCH DÀNH RIÊNG CHO FRONTEND UI
// ==========================================
export interface CartItem extends MenuItem {
    so_luong: number;
    notes?: string;
    variant_name?: string;
    extra_price?: number;
    cart_item_id?: string; // Để phân biệt 2 dòng giống Món nhưng khác Variant
}
