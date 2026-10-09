
export const updateReportsTab = async () => {
    // @ts-ignore
    const { layTatCaDonHang } = require('./api');
    const allOrders = await layTatCaDonHang();
    
    const today = new Date().toDateString();
    let revenue = 0;
    let ordersCount = 0;
    
    // For chart: map hour -> revenue
    const hourlyRevenue = new Map<number, number>();
    for(let i=0; i<24; i++) hourlyRevenue.set(i, 0);
    
    allOrders.forEach((o: any) => {
        const d = new Date(o.createdAt);
        if (d.toDateString() === today && o.paymentStatus === 'Paid') {
            revenue += o.totalAmount;
            const hour = d.getHours();
            hourlyRevenue.set(hour, (hourlyRevenue.get(hour) || 0) + o.totalAmount);
            ordersCount++;
        }
    });
    
    // @ts-ignore
    const fmtMoney = typeof formatMoney !== 'undefined' ? formatMoney : (val: any) => val;
    
    // Update summary
    const revEl = document.getElementById('reports-summary-revenue');
    if (revEl) revEl.innerText = fmtMoney(revenue) + ' đ';
    
    const ordEl = document.getElementById('reports-summary-orders');
    if (ordEl) ordEl.innerText = ordersCount.toString();
    
    const avgEl = document.getElementById('reports-summary-avg');
    const avg = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    if (avgEl) avgEl.innerText = fmtMoney(avg) + ' đ';
    
    // Update chart
    const chartEl = document.getElementById('reports-chart');
    if (chartEl) {
        // Find max revenue hour to normalize heights
        let maxRev = 0;
        hourlyRevenue.forEach(v => { if (v > maxRev) maxRev = v; });
        
        // Group into 6 blocks: 8h, 10h, 12h, 14h, 16h, 18h (or just evenly space available data)
        const displayHours = [8, 10, 12, 14, 16, 18];
        let html = '';
        displayHours.forEach(h => {
            const rev = hourlyRevenue.get(h) || 0;
            // Height between 10% and 100%
            const pct = maxRev > 0 ? Math.max(10, Math.round((rev / maxRev) * 100)) : 10;
            
            // Choose color based on height
            let bgClass = 'bg-orange-500/30 border-orange-500/50';
            if (pct > 70) bgClass = 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
            else if (pct > 40) bgClass = 'bg-orange-500/70 border-orange-500/50';
            else if (pct > 20) bgClass = 'bg-orange-500/50 border-orange-500/50';
            
            html += `
                <div class="flex-1 flex flex-col items-center gap-2">
                    <div class="${bgClass} border rounded-t-lg w-full transition-all duration-500 relative group" style="height:${pct}%">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            ${fmtMoney(rev)} đ
                        </div>
                    </div>
                    <span class="text-xs text-slate-500">${h}h</span>
                </div>
            `;
        });
        chartEl.innerHTML = html;
    }
};

setInterval(updateReportsTab, 5000);
updateReportsTab();
