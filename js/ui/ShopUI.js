/**
 * 商店界面UI管理类
 */
class ShopUI {
    constructor() {
        this.modalId = 'shopModal';
        this.currentCategory = 'piece';
        this.items = [];
        this.userCoins = 0;
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
            <div class="shop-modal" id="${this.modalId}">
                <div class="shop-content">
                    <div class="shop-header">
                        <img src="assets/images/shop_title.png" alt="商店" class="shop-title-image">
                        <div class="shop-coins">
                            <span class="coin-icon">🪙</span>
                            <span id="shopCoinsDisplay">0</span>
                        </div>
                        <button class="shop-close-btn" onclick="shopUI.hide()">×</button>
                    </div>

                    <div class="shop-tabs">
                        <button class="shop-tab active" data-category="piece" onclick="shopUI.switchCategory('piece')">
                            棋子
                        </button>
                        <button class="shop-tab" data-category="board" onclick="shopUI.switchCategory('board')">
                            对战桌面
                        </button>
                        <button class="shop-tab" data-category="trail" onclick="shopUI.switchCategory('trail')">
                            拖尾效果
                        </button>
                    </div>

                    <div class="shop-items-grid" id="shopItemsGrid">
                        <div class="shop-loading">加载中...</div>
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
            await this.loadShopData();
        }
    }

    hide() {
        // 清理拖尾效果预览
        this.clearTrailPreviews();

        const modal = document.getElementById(this.modalId);
        if (modal) {
            const content = modal.querySelector('.shop-content');
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

    async loadShopData() {
        try {
            const token = authUI.getToken();
            if (!token) {
                this.showError('请先登录');
                return;
            }

            const response = await fetch('/api/shop/items', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.items = data.items;
                this.userCoins = data.userCoins;
                this.updateCoinsDisplay();
                this.renderItems();
            } else {
                this.showError(data.error?.message || '加载失败');
            }
        } catch (error) {
            console.error('加载商店数据失败:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    updateCoinsDisplay() {
        const display = document.getElementById('shopCoinsDisplay');
        if (display) {
            display.textContent = this.userCoins;
        }
    }

    switchCategory(category) {
        // 切换分类时清除拖尾效果预览
        this.clearTrailPreviews();

        this.currentCategory = category;

        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        // 添加渐隐渐显动画
        const grid = document.getElementById('shopItemsGrid');
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
        const grid = document.getElementById('shopItemsGrid');
        if (!grid) return;

        // 拖尾效果分类特殊处理
        if (this.currentCategory === 'trail') {
            this.renderTrailItems(grid);
            return;
        }

        const filteredItems = this.items.filter(item =>
            item.item_type === `${this.currentCategory}_skin` && item.item_id !== 'default'
        );

        if (filteredItems.length === 0) {
            grid.innerHTML = '<div class="shop-empty">暂无商品</div>';
            return;
        }

        grid.innerHTML = filteredItems.map(item => `
            <div class="shop-item-card ${item.isOwned ? 'owned' : ''} ${!item.isPurchasable ? 'locked' : ''}">
                <div class="shop-item-image">
                    ${item.image_path ?
                        `<img src="${item.image_path}" alt="${item.name}" onerror="this.parentElement.innerHTML='<div class=shop-item-placeholder>${item.name[0]}</div>'">` :
                        `<div class="shop-item-placeholder">${item.name[0]}</div>`
                    }
                </div>
                <div class="shop-item-info">
                    <h4 class="shop-item-name">${item.name}</h4>
                    ${item.isOwned ?
                        '<span class="shop-item-owned">已拥有</span>' :
                        `<span class="shop-item-price">🪙 ${item.price}</span>`
                    }
                </div>
                ${!item.isOwned && item.isPurchasable ?
                    `<button class="shop-item-buy-btn"
                            onclick="shopUI.purchaseItem('${item.item_id}')"
                            ${this.userCoins < item.price ? 'disabled' : ''}>
                        ${this.userCoins < item.price ? '金币不足' : '购买'}
                    </button>` : ''
                }
            </div>
        `).join('');
    }

    renderTrailItems(grid) {
        // 停止并清理之前的拖尾效果预览
        this.clearTrailPreviews();
        
        // 从 GameConfig 获取拖尾效果配置
        const trailConfig = GAME_CONFIG.trailEffects;
        if (!trailConfig) {
            grid.innerHTML = '<div class="shop-empty">暂无商品</div>';
            return;
        }

        // 检查用户已拥有的拖尾效果
        const ownedItemIds = new Set();
        this.items.forEach(item => {
            if (item.item_type === 'trail_effect') {
                if (item.isOwned) {
                    ownedItemIds.add(item.item_id);
                }
            }
        });

        // 构建拖尾效果列表
        const trailItems = Object.values(trailConfig).map(trail => {
            const shopItem = this.items.find(i => i.item_id === trail.id);
            return {
                item_id: trail.id,
                name: shopItem ? shopItem.name : trail.name,
                price: shopItem ? shopItem.price : 0,
                isOwned: trail.isDefault || ownedItemIds.has(trail.id),
                isDefault: trail.isDefault,
                color: trail.color,
                trailConfig: trail // 传递完整配置
            };
        });

        if (trailItems.length === 0) {
            grid.innerHTML = '<div class="shop-empty">暂无商品</div>';
            return;
        }

        grid.innerHTML = trailItems.map(item => {
            return `
                <div class="shop-item-card ${item.isOwned ? 'owned' : ''}">
                    <div class="shop-item-image">
                        <div class="trail-preview-container" id="shop-trail-preview-${item.item_id}"></div>
                    </div>
                    <div class="shop-item-info">
                        <h4 class="shop-item-name">${item.name}</h4>
                        ${item.isOwned ?
                            '<span class="shop-item-owned">已拥有</span>' :
                            item.isDefault ? '<span class="shop-item-owned">默认</span>' :
                            `<span class="shop-item-price">🪙 ${item.price}</span>`
                        }
                    </div>
                    ${!item.isOwned && !item.isDefault ?
                        `<button class="shop-item-buy-btn"
                                onclick="shopUI.purchaseItem('${item.item_id}')"
                                ${this.userCoins < item.price ? 'disabled' : ''}>
                            ${this.userCoins < item.price ? '金币不足' : '购买'}
                        </button>` : ''
                    }
                </div>
            `;
        }).join('');

        // 创建拖尾效果预览
        trailItems.forEach(item => {
            const container = document.getElementById(`shop-trail-preview-${item.item_id}`);
            if (container) {
                const preview = new TrailPreview(container, item.item_id, item.trailConfig);
                this.trailPreviews.set(item.item_id, preview);
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

    async purchaseItem(itemId) {
        try {
            const token = authUI.getToken();
            const response = await fetch('/api/shop/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ itemId })
            });

            const data = await response.json();

            if (data.success) {
                this.userCoins = data.remainingCoins;
                this.updateCoinsDisplay();
                // 更新菜单金币显示
                if (window.authUI) {
                    window.authUI.userCoins = data.remainingCoins;
                    window.authUI.updateMenuCoinsDisplay();
                }
                await this.loadShopData();
                this.showSuccess(`购买成功！获得 ${data.item.name}`);
            } else {
                this.showError(data.error?.message || '购买失败');
            }
        } catch (error) {
            console.error('购买失败:', error);
            this.showError('购买失败，请稍后重试');
        }
    }

    showError(message) {
        const grid = document.getElementById('shopItemsGrid');
        if (grid) {
            grid.innerHTML = `<div class="shop-error">${message}</div>`;
        }
    }

    showSuccess(message) {
        const tempMessage = document.createElement('div');
        tempMessage.className = 'temporary-message success';
        tempMessage.textContent = message;
        document.body.appendChild(tempMessage);
        setTimeout(() => tempMessage.remove(), 2000);
    }
}

const shopUI = new ShopUI();

function showShopModal() {
    shopUI.show();
}

function hideShopModal() {
    shopUI.hide();
}

function switchShopCategory(category) {
    shopUI.switchCategory(category);
}
