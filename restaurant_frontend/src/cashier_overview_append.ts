
export const renderOverviewRecentOrders = async () => {
    const tbody = document.getElementById('overview-recent-orders-tbody');
    if (!tbody) return;
    
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    
    // Sort descending and take top 5
    const recentOrders = allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    let html = '';
    recentOrders.forEach((order: any) => {
        let badge = '';
        if (order.status === 'Completed' || order.paymentStatus === 'Paid') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Đã thanh toán</span>';
        } else {
            badge = '<span class="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30">Đang phục vụ</span>';
        }
        
        const timeStr = new Date(order.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        let numTable = 'N/A';
        if (order.table_id) numTable = parseInt(order.table_id.replace('T', ''), 10).toString();
        
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="px-6 py-4 font-bold text-white">Bàn ${numTable}</td>
                <td class="px-6 py-4 text-slate-400">${timeStr}</td>
                <td class="px-6 py-4 text-slate-300">- món</td>
                <td class="px-6 py-4 text-right font-black text-white">${fmtMoney(order.totalAmount || 0)} đ</td>
                <td class="px-6 py-4 text-center">${badge}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

setInterval(renderOverviewRecentOrders, 5000);
renderOverviewRecentOrders();
