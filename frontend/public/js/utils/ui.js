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
export const showConfirmModal = (title, message, options) => {
    return new Promise((resolve) => {
        const isDark = document.body.classList.contains('bg-[#0f172a]') ||
            document.body.className.includes('#0f172a') ||
            document.body.classList.contains('bg-slate-900') ||
            (window.getComputedStyle(document.body).backgroundColor === 'rgb(15, 23, 42)');
        const okText = options?.okText || 'Đồng ý';
        const cancelText = options?.cancelText || 'Hủy bỏ';
        const type = options?.type || 'danger';
        const btnOkClass = type === 'warning'
            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
            : type === 'info' || type === 'primary'
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                : 'bg-red-500 hover:bg-red-600 shadow-red-500/30';
        const iconHtml = type === 'warning'
            ? `<div class="w-12 h-12 ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-500'} rounded-2xl flex items-center justify-center mb-4 text-xl"><i class="fa-solid fa-triangle-exclamation"></i></div>`
            : type === 'info' || type === 'primary'
                ? `<div class="w-12 h-12 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-500'} rounded-2xl flex items-center justify-center mb-4 text-xl"><i class="fa-solid fa-circle-info"></i></div>`
                : `<div class="w-12 h-12 ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-500'} rounded-2xl flex items-center justify-center mb-4 text-xl"><i class="fa-solid fa-circle-exclamation"></i></div>`;
        const cardBg = isDark
            ? 'bg-[#1e293b] border border-slate-700/80 text-white'
            : 'bg-white text-slate-800';
        const titleColor = isDark ? 'text-white' : 'text-slate-800';
        const msgColor = isDark ? 'text-slate-300' : 'text-slate-500';
        const btnCancelClass = isDark
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600';
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 opacity-0 transition-opacity duration-200';
        const modal = document.createElement('div');
        modal.className = `${cardBg} rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform scale-95 transition-transform duration-200`;
        modal.innerHTML = `
            <div class="p-6">
                ${iconHtml}
                <h3 class="text-xl font-black ${titleColor} mb-2">${title}</h3>
                <p class="${msgColor} text-sm font-medium mb-6 whitespace-pre-line leading-relaxed">${message}</p>
                <div class="flex gap-3">
                    <button id="btn-confirm-cancel" class="flex-1 py-3 ${btnCancelClass} rounded-xl font-bold transition-all text-sm active:scale-95">${cancelText}</button>
                    <button id="btn-confirm-ok" class="flex-1 py-3 ${btnOkClass} text-white rounded-xl font-bold transition-all shadow-lg text-sm active:scale-95">${okText}</button>
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
            <p class="text-slate-400 text-sm mb-3">Vui lòng nhập lý do cụ thể để Bếp nắm thông tin.</p>
            
            <div class="flex gap-2 mb-3 overflow-x-auto pb-2 hide-scrollbar">
                <button class="quick-reason shrink-0 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Khách làm đổ</button>
                <button class="quick-reason shrink-0 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Món nguội</button>
                <button class="quick-reason shrink-0 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Dị ứng</button>
                <button class="quick-reason shrink-0 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Có dị vật</button>
                <button class="quick-reason shrink-0 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Lỗi chế biến</button>
            </div>

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
            const input = document.getElementById('prompt-input');
            input?.focus();
            modal.querySelectorAll('.quick-reason').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (input) {
                        input.value = e.currentTarget.innerText;
                        input.focus();
                    }
                });
            });
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
export const showNumberPromptModal = (title, placeholder = "Nhập số lượng", initialValue = "") => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 opacity-0 transition-opacity duration-200';
        const modal = document.createElement('div');
        modal.className = 'bg-[#1e293b] border border-slate-700 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl transform scale-95 transition-transform duration-200 p-6';
        modal.innerHTML = `
            <h3 class="text-xl font-black text-white mb-2">${title}</h3>
            <p class="text-slate-400 text-sm mb-4">Vui lòng nhập số lượng (đơn vị cơ sở).</p>
            <input type="number" id="prompt-number-input" class="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-orange-500 placeholder-slate-600 mb-6" placeholder="${placeholder}" value="${initialValue}" min="0" step="any" />
            <div class="flex gap-3">
                <button id="btn-num-prompt-cancel" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors border border-slate-700">Hủy bỏ</button>
                <button id="btn-num-prompt-ok" class="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-orange-500/30">Xác nhận</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
            const input = document.getElementById('prompt-number-input');
            input?.focus();
            input?.select();
        });
        const close = (isConfirmed) => {
            const valStr = document.getElementById('prompt-number-input').value;
            const val = parseFloat(valStr);
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve({ isConfirmed, value: val });
            }, 200);
        };
        overlay.querySelector('#btn-num-prompt-cancel').addEventListener('click', () => close(false));
        overlay.querySelector('#btn-num-prompt-ok').addEventListener('click', () => {
            const valStr = document.getElementById('prompt-number-input').value;
            const val = parseFloat(valStr);
            if (isNaN(val) || val <= 0) {
                alert("Vui lòng nhập số lượng hợp lệ lớn hơn 0!");
                return;
            }
            close(true);
        });
        document.getElementById('prompt-number-input')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                overlay.querySelector('#btn-num-prompt-ok')?.dispatchEvent(new Event('click'));
            }
        });
    });
};
export const showMoveMergeModal = (sourceName, targetName) => {
    return new Promise((resolve) => {
        let container = document.getElementById('move-merge-modal-container');
        if (container)
            container.remove();
        container = document.createElement('div');
        container.id = 'move-merge-modal-container';
        container.className = 'fixed inset-0 z-[150] flex items-center justify-center';
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity opacity-0';
        const modal = document.createElement('div');
        modal.className = 'bg-[#0f172a] border border-slate-700/50 rounded-2xl p-6 shadow-2xl w-[450px] relative z-10 transform transition-all scale-95 opacity-0';
        modal.innerHTML = `
            <h3 class="text-xl font-black text-white mb-2">Thao tác bàn</h3>
            <p class="text-slate-400 text-sm mb-6">Bạn muốn thực hiện hành động gì với <span class="text-orange-400 font-bold">${sourceName}</span> và <span class="text-emerald-400 font-bold">${targetName}</span>?</p>
            
            <div class="flex flex-col gap-3">
                <button id="btn-modal-move" class="bg-[#1e293b] hover:bg-slate-700 border border-slate-600 text-white rounded-xl p-4 text-left transition-colors flex flex-col gap-1 group">
                    <span class="font-bold text-orange-500 text-base group-hover:text-white transition-colors">Đổi bàn</span>
                    <span class="text-xs text-slate-400">Chuyển toàn bộ khách từ ${sourceName} sang ${targetName}</span>
                </button>
                <button id="btn-modal-merge" class="bg-[#1e293b] hover:bg-slate-700 border border-slate-600 text-white rounded-xl p-4 text-left transition-colors flex flex-col gap-1 group">
                    <span class="font-bold text-emerald-500 text-base group-hover:text-white transition-colors">Ghép bàn</span>
                    <span class="text-xs text-slate-400">Gộp chung hóa đơn của ${sourceName} và ${targetName} lại với nhau</span>
                </button>
                <button id="btn-modal-cancel" class="mt-2 bg-transparent text-slate-500 hover:text-white font-bold py-2 rounded-xl transition-colors text-sm">Hủy bỏ thao tác</button>
            </div>
        `;
        container.appendChild(overlay);
        container.appendChild(modal);
        document.body.appendChild(container);
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95', 'opacity-0');
        });
        const close = (result) => {
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                container?.remove();
                resolve(result);
            }, 200);
        };
        modal.querySelector('#btn-modal-move')?.addEventListener('click', () => close('move'));
        modal.querySelector('#btn-modal-merge')?.addEventListener('click', () => close('merge'));
        modal.querySelector('#btn-modal-cancel')?.addEventListener('click', () => close(null));
        overlay.addEventListener('click', () => close(null));
    });
};
