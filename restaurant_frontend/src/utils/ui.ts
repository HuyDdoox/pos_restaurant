export const showSuccessToast = (message: string) => {
    // Tạo container nếu chưa có
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    // Tạo thẻ Toast
    const toast = document.createElement('div');
    toast.className = 'bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto';
    toast.innerHTML = `
        <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="font-bold text-sm shadow-sm">${message}</span>
    `;

    container.appendChild(toast);

    // Hiệu ứng trượt vào (Slide in)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
    });

    // Tự động biến mất sau 2.5s
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
};

export const showConfirmModal = (title: string, message: string): Promise<boolean> => {
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

        // Hiệu ứng hiện ra
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
        });

        const close = (result: boolean) => {
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        // Gắn sự kiện
        overlay.querySelector('#btn-confirm-cancel')!.addEventListener('click', () => close(false));
        overlay.querySelector('#btn-confirm-ok')!.addEventListener('click', () => close(true));
        
        // Bấm ra ngoài đen để đóng
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
};

export const showWarningToast = (message: string) => {
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

export const showPromptModal = (title: string, placeholder: string): Promise<{isConfirmed: boolean, reason: string}> => {
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
            const input = document.getElementById('prompt-input') as HTMLTextAreaElement;
            input?.focus();

            // Gắn sự kiện cho các nút chọn nhanh
            modal.querySelectorAll('.quick-reason').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (input) {
                        input.value = (e.currentTarget as HTMLButtonElement).innerText;
                        input.focus();
                    }
                });
            });
        });

        const close = (isConfirmed: boolean) => {
            const reason = (document.getElementById('prompt-input') as HTMLTextAreaElement).value.trim();
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve({ isConfirmed, reason });
            }, 200);
        };

        overlay.querySelector('#btn-prompt-cancel')!.addEventListener('click', () => close(false));
        overlay.querySelector('#btn-prompt-ok')!.addEventListener('click', () => {
            const reason = (document.getElementById('prompt-input') as HTMLTextAreaElement).value.trim();
            if (!reason) {
                showWarningToast("Vui lòng nhập lý do!");
                return;
            }
            close(true);
        });
    });
};
export const showNumberPromptModal = (title: string, placeholder: string = "Nhập số lượng", initialValue: string = ""): Promise<{isConfirmed: boolean, value: number}> => {
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
            const input = document.getElementById('prompt-number-input') as HTMLInputElement;
            input?.focus();
            input?.select();
        });

        const close = (isConfirmed: boolean) => {
            const valStr = (document.getElementById('prompt-number-input') as HTMLInputElement).value;
            const val = parseFloat(valStr);
            overlay.classList.add('opacity-0');
            modal.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve({ isConfirmed, value: val });
            }, 200);
        };

        overlay.querySelector('#btn-num-prompt-cancel')!.addEventListener('click', () => close(false));
        overlay.querySelector('#btn-num-prompt-ok')!.addEventListener('click', () => {
            const valStr = (document.getElementById('prompt-number-input') as HTMLInputElement).value;
            const val = parseFloat(valStr);
            if (isNaN(val) || val <= 0) {
                // assume showWarningToast is available in scope
                alert("Vui lòng nhập số lượng hợp lệ lớn hơn 0!");
                return;
            }
            close(true);
        });
        
        // Enter key to confirm
        document.getElementById('prompt-number-input')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                overlay.querySelector('#btn-num-prompt-ok')?.dispatchEvent(new Event('click'));
            }
        });
    });
};

export const showMoveMergeModal = (sourceName: string, targetName: string): Promise<'move' | 'merge' | null> => {
    return new Promise((resolve) => {
        let container = document.getElementById('move-merge-modal-container');
        if (container) container.remove();

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

        // Animation in
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95', 'opacity-0');
        });

        const close = (result: 'move' | 'merge' | null) => {
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