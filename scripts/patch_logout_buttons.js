const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. cashier.html
const cashierPath = path.join(rootDir, 'frontend/public/views/staff/cashier.html');
let cashier = fs.readFileSync(cashierPath, 'utf8');
if (!cashier.includes('onclick="logout()"')) {
    cashier = cashier.replace(
        /class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500\/10 font-bold text-sm transition-colors text-left"/,
        'onclick="logout()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 font-bold text-sm transition-colors text-left cursor-pointer"'
    );
    fs.writeFileSync(cashierPath, cashier, 'utf8');
    console.log('✅ cashier.html: Logout button patched with onclick="logout()"');
} else {
    console.log('ℹ️ cashier.html already has logout button');
}

// 2. admin.html
const adminPath = path.join(rootDir, 'frontend/public/views/staff/admin.html');
let admin = fs.readFileSync(adminPath, 'utf8');
if (!admin.includes('onclick="logout()"')) {
    const newBottom = `<div class="p-4 border-t border-slate-700/50 shrink-0 bg-[#1e293b] flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">AD</div>
                <div class="truncate">
                    <p class="text-sm font-bold text-white truncate">Quản trị viên</p>
                    <p class="text-xs text-slate-400 truncate">admin@foodhub.com</p>
                </div>
            </div>
            <button type="button" onclick="logout()" title="Đăng xuất khỏi hệ thống" class="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
        </div>`;
    admin = admin.replace(/<div class="p-4 border-t border-slate-700\/50 shrink-0 bg\[#1e293b\]">[\s\S]*?<\/aside>/, newBottom + '\n    </aside>');
    fs.writeFileSync(adminPath, admin, 'utf8');
    console.log('✅ admin.html: Logout button added to sidebar');
} else {
    console.log('ℹ️ admin.html already has logout button');
}

// 3. kitchen.html
const kitchenPath = path.join(rootDir, 'frontend/public/views/staff/kitchen.html');
let kitchen = fs.readFileSync(kitchenPath, 'utf8');
if (!kitchen.includes('onclick="logout()"')) {
    kitchen = kitchen.replace(
        /<div class="mt-auto">\s*<img src="https:\/\/ui-avatars\.com\/api\/\?name=Chef&background=10b981&color=fff"[^>]*>\s*<\/div>/,
        `<div class="mt-auto flex flex-col items-center gap-3 pb-2">
            <button type="button" onclick="logout()" title="Đăng xuất khỏi Bếp" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer border border-slate-700/60 shadow-sm">
                <i class="fa-solid fa-arrow-right-from-bracket text-sm"></i>
            </button>
            <img src="https://ui-avatars.com/api/?name=Chef&background=10b981&color=fff" class="w-10 h-10 rounded-full border-2 border-slate-600">
        </div>`
    );
    fs.writeFileSync(kitchenPath, kitchen, 'utf8');
    console.log('✅ kitchen.html: Logout button added to sidebar');
} else {
    console.log('ℹ️ kitchen.html already has logout button');
}

// 4. waiter.html
const waiterPath = path.join(rootDir, 'frontend/public/views/staff/waiter.html');
let waiter = fs.readFileSync(waiterPath, 'utf8');
if (!waiter.includes('id="btn-quick-logout"')) {
    waiter = waiter.replace(
        /<span class="text-sm font-bold text-white hidden sm:block" id="global-user-name">Nguyễn Văn T<\/span>\s*<svg class="w-4 h-4 text-slate-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"><\/path><\/svg>\s*<\/div>/,
        `<span class="text-sm font-bold text-white hidden sm:block" id="global-user-name">Nguyễn Văn T</span>
            </div>
            <button type="button" id="btn-quick-logout" onclick="logout()" title="Đăng xuất" class="px-3 py-1.5 bg-[#1e293b] hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/40 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm">
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
                <span class="hidden md:inline">Đăng xuất</span>
            </button>`
    );
    fs.writeFileSync(waiterPath, waiter, 'utf8');
    console.log('✅ waiter.html: Quick logout button added to header');
} else {
    console.log('ℹ️ waiter.html already has logout button');
}
