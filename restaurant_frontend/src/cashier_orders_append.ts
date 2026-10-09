
export const renderOrdersList = async () => {
    const tbody = document.getElementById('cashier-orders-tbody');
    if (!tbody) return;
    
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    let html = '';
    
    // Sort descending
    allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    allOrders.forEach((order: any) => {
        let badge = '';
        if (order.status === 'Completed' || order.paymentStatus === 'Paid') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Đã thanh toán</span>';
        } else {
            badge = '<span class="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30">Đang phục vụ</span>';
        }
        
        const date = new Date(order.createdAt);
        const timeStr = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        
        let numTable = 'N/A';
        if (order.table_id) {
            numTable = parseInt(order.table_id.replace('T', ''), 10).toString();
        }
        
        // @ts-ignore
        const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
        
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="px-6 py-4 font-bold text-orange-400">#${order.id}</td>
                <td class="px-6 py-4 font-bold text-white">Bàn ${numTable}</td>
                <td class="px-6 py-4 text-slate-400">${timeStr}</td>
                <td class="px-6 py-4 text-slate-300">-</td>
                <td class="px-6 py-4 text-right font-black text-white">${fmtMoney(order.totalAmount || 0)} đ</td>
                <td class="px-6 py-4 text-center">${badge}</td>
                <td class="px-6 py-4 text-center">
                    <button class="text-slate-400 hover:text-white transition-colors" title="In bill"><i class="fas fa-print"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

setInterval(renderOrdersList, 5000);
renderOrdersList();
