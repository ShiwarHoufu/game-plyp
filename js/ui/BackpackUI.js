/**
 * 背包界面UI管理类
 * 显示玩家已购买的物品
 */
class BackpackUI {
    constructor() {
        this.modalId = 'backpackModal';
        this.inventory = [];
        this.currentCategory = 'piece';
        this.trailPreviews = new Map(); // 存储拖尾效果预览实例
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        if (document.getElementById(this.modalId)) return;

        const modalHTML = `
            <div class="backpack-modal" id="${this.modalId}">
                <div class="backpack-content">
                    <div class="backpack-header">
                        <img src="assets/images/backpack_title.png" alt="背包" class="backpack-title-image">
                        <button class="backpack-close-btn" onclick="backpackUI.hide()">×</button>
                    </div>

                    <div class="backpack-tabs">
                        <button class="backpack-tab active" data-category="piece" onclick="backpackUI.switchCategory('piece')">
                            棋子
                        </button>
                        <button class="backpack-tab" data-category="board" onclick="backpackUI.switchCategory('board')">
                            对战桌面
                        </button>
                        <button class="backpack-tab" data-category="trail" onclick="backpackUI.switchCategory('trail')">
                            拖尾效果
                        </button>
                    </div>

                    <div class="backpack-items-grid" id="backpackItemsGrid">
                        <div class="backpack-loading">加载中...</div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById(this.modalId);
                if (modal && modal.classList.contains('show')) {
                    this.hide();
                }
            }
        });

        document.addEventListener('click', (e) => {
            const modal = document.getElementById(this.modalId);
            if (e.target === modal) {
                this.hide();
            }
        });
    }

    async show() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.classList.add('show');
            await this.loadBackpackData();
        }
    }

    hide() {
        // 清理拖尾效果预览
        this.clearTrailPreviews();

        const modal = document.getElementById(this.modalId);
        if (modal) {
            const content = modal.querySelector('.backpack-content');
            if (content) {
                content.style.animation = 'slideOutToBottom 0.3s ease-out forwards';

                setTimeout(() => {
                    modal.classList.remove('show');
                    content.style.animation = '';
                }, 300);
            } else {
                modal.classList.remove('show');
            }
        }
    }

    async loadBackpackData() {
        try {
            const token = authUI.getToken();
            if (!token) {
                this.showError('请先登录');
                return;
            }

            const response = await fetch('/api/shop/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.inventory = data.inventory;
                this.renderItems();
            } else {
                this.showError(data.error?.message || '加载失败');
            }
        } catch (error) {
            console.error('加载背包数据失败:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    switchCategory(category) {
        // 切换分类时清除拖尾效果预览
        this.clearTrailPreviews();

        this.currentCategory = category;

        document.querySelectorAll('.backpack-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        // 添加渐隐渐显动画
        const grid = document.getElementById('backpackItemsGrid');
        if (grid) {
            grid.classList.add('fade-out');
            
            setTimeout(() => {
                this.renderItems();
                grid.classList.remove('fade-out');
                grid.classList.add('fade-in');
                
                setTimeout(() => {
                    grid.classList.remove('fade-in');
                }, 300);
            }, 300);
        } else {
            this.renderItems();
        }
    }

    renderItems() {
        const grid = document.getElementById('backpackItemsGrid');
        if (!grid) return;

        // 拖尾效果分类特殊处理
        if (this.currentCategory === 'trail') {
            this.renderTrailEffects(grid);
            return;
        }

        const filteredItems = this.inventory.filter(item =>
            item.item_type === `${this.currentCategory}_skin` && item.item_id !== 'default'
        );

        if (filteredItems.length === 0) {
            grid.innerHTML = '<div class="backpack-empty">暂无物品<br><span style="font-size:14px;color:#aaa;">在商店购买后可在此查看</span></div>';
            return;
        }

        grid.innerHTML = filteredItems.map(item => `
            <div class="backpack-item-card owned">
                <div class="backpack-item-image">
                    ${item.image_path ?
                        `<img src="${item.image_path}" alt="${item.name}" onerror="this.parentElement.innerHTML='<div class=backpack-item-placeholder>${item.name[0]}</div>'">` :
                        `<div class="backpack-item-placeholder">${item.name[0]}</div>`
                    }
                </div>
                <div class="backpack-item-info">
                    <h4 class="backpack-item-name">${item.name}</h4>
                </div>
                <div class="backpack-item-status">
                    <span class="owned-badge">已拥有</span>
                </div>
            </div>
        `).join('');
    }

    renderTrailEffects(grid) {
        // 停止并清理之前的拖尾效果预览
        this.clearTrailPreviews();
        
        const trailConfig = GAME_CONFIG.trailEffects;
        if (!trailConfig) {
            grid.innerHTML = '<div class="backpack-empty">暂无可用拖尾效果</div>';
            return;
        }

        // 构建拥有状态的拖尾效果列表（只显示已拥有的）
        const ownedItemIds = new Set(this.inventory.map(item => item.item_id));
        const trailItems = Object.values(trailConfig)
            .filter(trail => trail.isDefault || ownedItemIds.has(trail.id))
            .map(trail => {
                return {
                    ...trail,
                    isOwned: trail.isDefault || ownedItemIds.has(trail.id)
                };
            });

        if (trailItems.length === 0) {
            grid.innerHTML = '<div class="backpack-empty">暂无可用拖尾效果</div>';
            return;
        }

        // 获取当前装备的拖尾效果（从 localStorage 读取）
        const equippedTrail = localStorage.getItem('equippedTrailEffect') || 'trail_white';

        grid.innerHTML = trailItems.map(trail => {
            const isEquipped = trail.id === equippedTrail;

            return `
                <div class="backpack-item-card owned ${isEquipped ? 'equipped' : ''}"
                     data-trail-id="${trail.id}"
                     onclick="backpackUI.handleTrailClick('${trail.id}')">
                    <div class="backpack-item-image">
                        <div class="trail-preview-container" id="trail-preview-${trail.id}"></div>
                    </div>
                    <div class="backpack-item-info">
                        <h4 class="backpack-item-name">${trail.name}</h4>
                    </div>
                    <div class="backpack-item-status">
                        ${isEquipped ? '<span class="equipped-badge">已装备</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        // 创建拖尾效果预览
        trailItems.forEach(trail => {
            const container = document.getElementById(`trail-preview-${trail.id}`);
            if (container) {
                const preview = new TrailPreview(container, trail.id, trail);
                this.trailPreviews.set(trail.id, preview);
            }
        });
    }

    // 清理拖尾效果预览
    clearTrailPreviews() {
        for (const preview of this.trailPreviews.values()) {
            preview.stop();
        }
        this.trailPreviews.clear();
    }

    handleTrailClick(trailId) {
        // 装备该拖尾效果
        const modes = ['classic-network', 'skill-network', 'chaos', 'chaos4'];
        if (window.gameEngine) {
            modes.forEach(mode => {
                window.gameEngine.equippedTrailEffect[mode] = trailId;
            });
        }

        // 持久化到 localStorage
        localStorage.setItem('equippedTrailEffect', trailId);

        // 更新UI - 先清空所有卡片的已装备状态
        document.querySelectorAll('.backpack-item-card').forEach(card => {
            card.classList.remove('equipped');
            const statusEl = card.querySelector('.backpack-item-status');
            if (statusEl) {
                statusEl.innerHTML = '';
            }
        });

        // 设置当前选中项为已装备
        const selectedCard = document.querySelector(`.backpack-item-card[data-trail-id="${trailId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('equipped');
            const statusEl = selectedCard.querySelector('.backpack-item-status');
            if (statusEl) {
                statusEl.innerHTML = '<span class="equipped-badge">已装备</span>';
            }
        }
    }

    showError(message) {
        const grid = document.getElementById('backpackItemsGrid');
        if (grid) {
            grid.innerHTML = `<div class="backpack-error">${message}</div>`;
        }
    }
}

const backpackUI = new BackpackUI();

function showBackpackModal() {
    backpackUI.show();
}

function hideBackpackModal() {
    backpackUI.hide();
}

function switchBackpackCategory(category) {
    backpackUI.switchCategory(category);
}
