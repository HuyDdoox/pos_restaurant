export const showSuccessToast = (message) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto';
    toast.innerHTML = `
        <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="font-bold text-sm shadow-sm">${message}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
    });
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
};
export const showConfirmModal = (title, message) => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 opacity-0 transition-opacity duration-200';
        const modal = document.createElement('div');
        modal.className = 'bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform scale-95 transition-transform duration-200';
        modal.innerHTML = `
            <div class="p-6">
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-black text-slate-800 mb-2">${title}</h3>
                <p class="text-slate-500 text-sm font-medium mb-8">${message}</p>
                <div class="flex gap-3">
                    <button id="btn-confirm-cancel" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors">Hủy bỏ</button>
                    <button id="btn-confirm-ok" class="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/30">Đồng ý</button>
                </div>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
        });
        const close = (result) => {
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };
        overlay.querySelector('#btn-confirm-cancel').addEventListener('click', () => close(false));
        overlay.querySelector('#btn-confirm-ok').addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay)
                close(false);
        });
    });
};
export const showWarningToast = (message) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'bg-yellow-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto';
    toast.innerHTML = `
        <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <span class="font-bold text-sm shadow-sm">${message}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0')));
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
};
export const showPromptModal = (title, placeholder) => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 opacity-0 transition-opacity duration-200';
        const modal = document.createElement('div');
        modal.className = 'bg-[#1e293b] border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl transform scale-95 transition-transform duration-200 p-6';
        modal.innerHTML = `
            <h3 class="text-xl font-black text-white mb-2">${title}</h3>
            <p class="text-slate-400 text-sm mb-4">Vui lòng nhập lý do cụ thể để Bếp nắm thông tin.</p>
            <textarea id="prompt-input" rows="3" class="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-4 text-slate-300 font-medium resize-none focus:outline-none focus:border-red-500 placeholder-slate-600 mb-6" placeholder="${placeholder}"></textarea>
            <div class="flex gap-3">
                <button id="btn-prompt-cancel" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors border border-slate-700">Hủy bỏ</button>
                <button id="btn-prompt-ok" class="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/30">Xác nhận</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
            document.getElementById('prompt-input')?.focus();
        });
        const close = (isConfirmed) => {
            const reason = document.getElementById('prompt-input').value.trim();
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve({ isConfirmed, reason });
            }, 200);
        };
        overlay.querySelector('#btn-prompt-cancel').addEventListener('click', () => close(false));
        overlay.querySelector('#btn-prompt-ok').addEventListener('click', () => {
            const reason = document.getElementById('prompt-input').value.trim();
            if (!reason) {
                showWarningToast("Vui lòng nhập lý do!");
                return;
            }
            close(true);
        });
    });
};
