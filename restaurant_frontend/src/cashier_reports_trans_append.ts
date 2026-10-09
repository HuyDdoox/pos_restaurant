
export const updateReportsTransactions = async () => {
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    
    const tbody = document.getElementById('cashier-reports-tbody');
    if (!tbody) return;
    
    // Sort descending
    const recentOrders = allOrders
        .filter((o: any) => o.paymentStatus === 'Paid')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10); // Show top 10
        
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    let html = '';
    recentOrders.forEach((o: any) => {
        const d = new Date(o.createdAt);
        const dateStr = d.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'}) + ' ' + d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
        html += `
            <tr class="hover:bg-slate-700/20 transition-colors">
                <td class="px-6 py-4 font-bold text-white">#${o.id}</td>
                <td class="px-6 py-4 text-slate-400">${dateStr}</td>
                <td class="px-6 py-4 text-slate-300">Thanh toán</td>
                <td class="px-6 py-4 text-right font-black text-emerald-400">+${fmtMoney(o.totalAmount)} đ</td>
                <td class="px-6 py-4 text-center"><span class="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Thành công</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

setInterval(updateReportsTransactions, 5000);
updateReportsTransactions();
