
export const updateOverviewTab = async () => {
    // @ts-ignore
    const { layTatCaDonHang, layDanhSachBan } = require('./api');
    const allOrders = await layTatCaDonHang();
    const allTables = await layDanhSachBan();
    
    // Revenue today
    const today = new Date().toDateString();
    let revenue = 0;
    let ordersCount = 0;
    
    allOrders.forEach((o: any) => {
        const d = new Date(o.createdAt).toDateString();
        if (d === today && o.paymentStatus === 'Paid') {
            revenue += o.totalAmount;
        }
        if (d === today) {
            ordersCount++;
        }
    });
    
    const revEl = document.getElementById('overview-revenue');
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    if (revEl) revEl.innerText = fmtMoney(revenue) + ' đ';
    
    const ordEl = document.getElementById('overview-orders-count');
    if (ordEl) ordEl.innerText = ordersCount.toString();
    
    const activeTables = allTables.filter((t: any) => t.status === 'Occupied' || t.status === 'Waiting_Payment').length;
    const tabEl = document.getElementById('overview-active-tables');
    if (tabEl) tabEl.innerText = `${activeTables} / ${allTables.length}`;
    
    const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    const avgEl = document.getElementById('overview-avg-order');
    if (avgEl) avgEl.innerText = fmtMoney(avg) + ' đ';
};

export const renderMenuTab = async () => {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;
    
    // @ts-ignore
    const { layDanhSachMonAn } = require('./api');
    const menuItems = await layDanhSachMonAn();
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    let html = '';
    menuItems.forEach((item: any) => {
        html += `
            <div class="bg-[#1e293b] rounded-2xl p-4 border border-slate-700/50 shadow-md hover:border-orange-500/30 transition-colors group">
                <div class="relative">
                    <img src="${item.image_url}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'" class="w-full h-32 object-cover rounded-xl mb-3">
                    <span class="absolute top-2 right-2 ${item.status === 'Available' ? 'bg-emerald-500' : 'bg-red-500'} text-white text-xs font-black px-2 py-0.5 rounded-full">${item.status === 'Available' ? 'Còn hàng' : 'Hết hàng'}</span>
                </div>
                <h4 class="font-bold text-white text-sm mb-1 line-clamp-1">${item.name}</h4>
                <p class="text-orange-400 font-black mb-3">${fmtMoney(item.base_price)} đ</p>
            </div>
        `;
    });
    grid.innerHTML = html;
};

setInterval(updateOverviewTab, 5000);
updateOverviewTab();
renderMenuTab();
