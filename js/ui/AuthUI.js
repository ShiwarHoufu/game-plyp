/**
 * 认证 UI 管理
 */
class AuthUI {
    constructor() {
        this.authModal = document.getElementById('authModal');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.loginTab = document.getElementById('loginTab');
        this.registerTab = document.getElementById('registerTab');
        this.authError = document.getElementById('authError');
        this.loginBtn = document.getElementById('loginBtn');
        this.userMenu = document.getElementById('userMenu');

        // 登录状态
        this.isLoggedIn = false;
        this.currentUser = null;
        this.token = null;
        this.userMenuVisible = false;
        this.userCoins = 0;

        this.init();
    }

    init() {
        // 从 localStorage 恢复登录状态
        const savedToken = localStorage.getItem('authToken');
        const savedUser = localStorage.getItem('authUser');
        if (savedToken && savedUser) {
            try {
                this.token = savedToken;
                this.currentUser = JSON.parse(savedUser);
                this.isLoggedIn = true;
                this.updateLoginButton();
            } catch (e) {
                this.logout();
            }
        }

        // 绑定表单提交事件
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // 点击其他地方关闭用户菜单
        document.addEventListener('click', (e) => {
            if (this.userMenuVisible && !this.userMenu.contains(e.target) && e.target !== this.loginBtn) {
                this.hideUserMenu();
            }
        });
    }

    /**
     * 显示认证弹窗
     */
    show() {
        if (this.authModal) {
            this.authModal.classList.add('show');
            this.clearError();
        }
    }

    /**
     * 隐藏认证弹窗
     */
    hide() {
        if (this.authModal) {
            this.authModal.classList.remove('show');
            this.clearError();
        }
    }

    /**
     * 切换登录/注册标签
     */
    switchTab(tab) {
        this.clearError();
        if (tab === 'login') {
            this.loginTab.classList.add('active');
            this.registerTab.classList.remove('active');
            this.loginForm.style.display = 'flex';
            this.registerForm.style.display = 'none';
        } else {
            this.loginTab.classList.remove('active');
            this.registerTab.classList.add('active');
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'flex';
        }
    }

    /**
     * 处理登录
     */
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showError('请填写用户名和密码');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.currentUser = data.user;
                this.isLoggedIn = true;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('authUser', JSON.stringify(this.currentUser));
                this.updateLoginButton();
                this.hide();
                this.clearForm();

                // 如果有网络管理器，更新其 token
                if (window.networkManager) {
                    window.networkManager.setAuthToken(this.token);
                }
            } else {
                this.showError(data.error?.message || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    /**
     * 处理注册
     */
    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const email = document.getElementById('registerEmail').value.trim();

        if (!username || !password) {
            this.showError('请填写用户名和密码');
            return;
        }

        if (username.length < 2 || username.length > 10) {
            this.showError('用户名长度应为 2-10 个字符');
            return;
        }

        if (password.length < 6) {
            this.showError('密码长度至少为 6 个字符');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email: email || undefined })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.currentUser = { id: data.userId, username };
                this.isLoggedIn = true;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('authUser', JSON.stringify(this.currentUser));
                this.updateLoginButton();
                this.hide();
                this.clearForm();

                // 如果有网络管理器，更新其 token
                if (window.networkManager) {
                    window.networkManager.setAuthToken(this.token);
                }
            } else {
                this.showError(data.error?.message || '注册失败');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    /**
     * 登出
     */
    logout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        this.updateLoginButton();
        this.hideUserMenu();

        // 如果有网络管理器，清除其 token
        if (window.networkManager) {
            window.networkManager.clearAuthToken();
        }
    }

    /**
     * 更新登录按钮显示
     */
    updateLoginButton() {
        if (this.loginBtn) {
            if (this.isLoggedIn && this.currentUser) {
                this.loginBtn.textContent = this.currentUser.username;
                this.loginBtn.classList.add('logged-in');
                this.loginBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleUserMenu();
                };
                this.showUserMenuContent();
                this.fetchUserCoins();
            } else {
                this.loginBtn.textContent = '登录';
                this.loginBtn.classList.remove('logged-in');
                this.loginBtn.onclick = () => this.show();
                this.hideUserMenu();
                this.hideMenuCoins();
            }
        }
    }

    /**
     * 显示菜单金币
     */
    showMenuCoins() {
        const menuCoins = document.getElementById('menuCoinsDisplay');
        if (menuCoins) {
            menuCoins.style.display = 'flex';
        }
    }

    /**
     * 隐藏菜单金币
     */
    hideMenuCoins() {
        const menuCoins = document.getElementById('menuCoinsDisplay');
        if (menuCoins) {
            menuCoins.style.display = 'none';
        }
    }

    /**
     * 获取用户金币数
     */
    async fetchUserCoins() {
        try {
            const token = this.getToken();
            if (!token) return;

            const response = await fetch('/api/shop/items', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.userCoins = data.userCoins;
                this.updateMenuCoinsDisplay();
                this.showMenuCoins();
            }
        } catch (error) {
            console.error('获取金币失败:', error);
        }
    }

    /**
     * 更新菜单金币显示
     */
    updateMenuCoinsDisplay() {
        const display = document.getElementById('menuCoinsValue');
        if (display) {
            display.textContent = this.userCoins;
        }
    }

    /**
     * 显示用户菜单内容
     */
    showUserMenuContent() {
        if (this.userMenu && this.currentUser) {
            const usernameEl = document.getElementById('userMenuUsername');
            if (usernameEl) {
                usernameEl.textContent = this.currentUser.username;
            }
        }
    }

    /**
     * 切换用户菜单显示
     */
    toggleUserMenu() {
        if (this.userMenuVisible) {
            this.hideUserMenu();
        } else {
            this.showUserMenu();
        }
    }

    /**
     * 显示用户菜单
     */
    showUserMenu() {
        if (this.userMenu) {
            this.userMenu.classList.add('show');
            this.userMenuVisible = true;
            this.showUserMenuContent();
            this.fetchUserCoins();
        }
    }

    /**
     * 隐藏用户菜单
     */
    hideUserMenu() {
        if (this.userMenu) {
            this.userMenu.classList.remove('show');
            this.userMenuVisible = false;
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        if (this.authError) {
            this.authError.textContent = message;
            this.authError.classList.add('show');
        }
    }

    /**
     * 清除错误信息
     */
    clearError() {
        if (this.authError) {
            this.authError.textContent = '';
            this.authError.classList.remove('show');
        }
    }

    /**
     * 清空表单
     */
    clearForm() {
        this.loginForm.reset();
        this.registerForm.reset();
        this.clearError();
    }

    /**
     * 获取当前 token
     */
    getToken() {
        return this.token;
    }

    /**
     * 检查是否已登录
     */
    checkAuth() {
        return this.isLoggedIn && this.token;
    }
}

// 导出单例
const authUI = new AuthUI();
if (typeof window !== 'undefined') {
    window.authUI = authUI;
}

// 全局函数，供 HTML 调用
function showAuthModal() {
    authUI.show();
}

function hideAuthModal() {
    authUI.hide();
}

function switchAuthTab(tab) {
    authUI.switchTab(tab);
}

// 退出登录确认相关函数
function showLogoutConfirmModal() {
    const logoutConfirmModal = document.getElementById('logoutConfirmModal');
    if (logoutConfirmModal) {
        logoutConfirmModal.classList.add('show');
    }
}

function confirmLogout() {
    authUI.logout();
    hideLogoutConfirmModal();
}

function cancelLogout() {
    hideLogoutConfirmModal();
}

function hideLogoutConfirmModal() {
    const logoutConfirmModal = document.getElementById('logoutConfirmModal');
    if (logoutConfirmModal) {
        logoutConfirmModal.classList.remove('show');
    }
}

// 个人资料相关函数
function showProfileModal() {
    const profileModal = document.getElementById('profileModal');
    const profileUsername = document.getElementById('profileUsername');
    if (profileModal && profileUsername && authUI.currentUser) {
        profileUsername.value = authUI.currentUser.username;
        profileModal.classList.add('show');
        clearProfileError();
    }
}

function hideProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.classList.remove('show');
        clearProfileError();
    }
}

function switchProfileTab(tab) {
    clearProfileError();
    const profileTab = document.getElementById('profileTab');
    const changePasswordTab = document.getElementById('changePasswordTab');
    const profileForm = document.getElementById('profileForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    
    if (tab === 'profile') {
        profileTab.classList.add('active');
        changePasswordTab.classList.remove('active');
        profileForm.style.display = 'flex';
        changePasswordForm.style.display = 'none';
    } else {
        profileTab.classList.remove('active');
        changePasswordTab.classList.add('active');
        profileForm.style.display = 'none';
        changePasswordForm.style.display = 'flex';
    }
}

function showProfileError(message) {
    const profileError = document.getElementById('profileError');
    if (profileError) {
        profileError.textContent = message;
        profileError.classList.add('show');
    }
}

function clearProfileError() {
    const profileError = document.getElementById('profileError');
    if (profileError) {
        profileError.textContent = '';
        profileError.classList.remove('show');
    }
}

// 绑定个人资料表单提交事件
document.addEventListener('DOMContentLoaded', function() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearProfileError();
            
            const username = document.getElementById('profileUsername').value.trim();
            
            if (!username) {
                showProfileError('请输入用户名');
                return;
            }
            
            if (username.length < 2 || username.length > 10) {
                showProfileError('用户名长度应为 2-10 个字符');
                return;
            }
            
            try {
                const token = authUI.getToken();
                const response = await fetch('/api/user/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    authUI.currentUser.username = username;
                    localStorage.setItem('authUser', JSON.stringify(authUI.currentUser));
                    authUI.updateLoginButton();
                    hideProfileModal();
                    // 显示成功提示
                    const tempMessage = document.createElement('div');
                    tempMessage.className = 'temporary-message';
                    tempMessage.textContent = '个人资料修改成功';
                    document.body.appendChild(tempMessage);
                    setTimeout(() => {
                        tempMessage.remove();
                    }, 2000);
                } else {
                    showProfileError(data.error?.message || '修改失败');
                }
            } catch (error) {
                console.error('修改个人资料错误:', error);
                showProfileError('网络错误，请稍后重试');
            }
        });
    }
    
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearProfileError();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                showProfileError('请填写所有密码字段');
                return;
            }
            
            if (newPassword.length < 6) {
                showProfileError('新密码长度至少为 6 个字符');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showProfileError('两次输入的新密码不一致');
                return;
            }
            
            try {
                const token = authUI.getToken();
                const response = await fetch('/api/user/password', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    hideProfileModal();
                    // 显示成功提示
                    const tempMessage = document.createElement('div');
                    tempMessage.className = 'temporary-message';
                    tempMessage.textContent = '密码修改成功';
                    document.body.appendChild(tempMessage);
                    setTimeout(() => {
                        tempMessage.remove();
                    }, 2000);
                } else {
                    showProfileError(data.error?.message || '修改失败');
                }
            } catch (error) {
                console.error('修改密码错误:', error);
                showProfileError('网络错误，请稍后重试');
            }
        });
    }
});

// 战绩相关
async function showStatsModal() {
    authUI.hideUserMenu();
    const statsModal = document.getElementById('statsModal');
    const statsBody = document.getElementById('statsBody');

    if (!statsModal || !statsBody) return;

    statsModal.classList.add('show');
    statsBody.innerHTML = '<div class="stats-loading">加载中...</div>';

    try {
        const token = authUI.getToken();
        const response = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            renderStats(data.stats);
        } else {
            statsBody.innerHTML = '<div class="stats-empty">加载失败</div>';
        }
    } catch (error) {
        console.error('获取战绩错误:', error);
        statsBody.innerHTML = '<div class="stats-empty">网络错误</div>';
    }
}

function hideStatsModal() {
    const statsModal = document.getElementById('statsModal');
    if (statsModal) {
        statsModal.classList.add('modal-animate-out');
        setTimeout(() => {
            statsModal.classList.remove('show', 'modal-animate-out');
        }, 250);
    }
}

function renderStats(stats) {
    const statsBody = document.getElementById('statsBody');
    if (!statsBody) return;

    const modeNames = {
        'classic': '经典模式',
        'skill': '技能模式',
        'chaos': '乱斗(2人)',
        'chaos4': '乱斗(4人)'
    };

    let html = '';

    for (const [mode, data] of Object.entries(stats)) {
        const name = modeNames[mode] || mode;
        html += `
            <div class="stats-mode">
                <div class="stats-mode-title">${name}</div>
                <div class="stats-grid">
                    <div class="stats-item">
                        <div class="stats-item-label">胜利</div>
                        <div class="stats-item-value wins">${data.wins}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">失败</div>
                        <div class="stats-item-value losses">${data.losses}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">总场次</div>
                        <div class="stats-item-value games">${data.totalGames}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">胜率</div>
                        <div class="stats-item-value rate">${data.winRate}%</div>
                    </div>
                </div>
                <button class="stats-detail-btn" onclick="showGameHistoryModal('${mode}')">查看详情</button>
            </div>
        `;
    }

    if (!html) {
        html = '<div class="stats-empty">暂无战绩记录</div>';
    }

    statsBody.innerHTML = html;
}

// 显示游戏历史详情弹窗
async function showGameHistoryModal(mode) {
    const modal = document.getElementById('gameHistoryModal');
    const listEl = document.getElementById('gameHistoryList');
    const titleEl = document.getElementById('gameHistoryTitle');

    if (!modal || !listEl || !titleEl) return;

    const modeNames = {
        'classic': '经典模式',
        'skill': '技能模式',
        'chaos': '乱斗(2人)',
        'chaos4': '乱斗(4人)'
    };

    titleEl.textContent = `${modeNames[mode] || mode} - 对局详情`;
    listEl.innerHTML = '<div class="stats-loading">加载中...</div>';
    modal.classList.add('show');

    try {
        const token = authUI.getToken();
        const response = await fetch(`/api/stats/history/${mode}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            renderGameHistory(data.history);
        } else {
            listEl.innerHTML = '<div class="game-history-empty">加载失败</div>';
        }
    } catch (error) {
        console.error('获取历史战绩错误:', error);
        listEl.innerHTML = '<div class="game-history-empty">网络错误</div>';
    }
}

// 渲染游戏历史列表
function renderGameHistory(history) {
    const listEl = document.getElementById('gameHistoryList');
    if (!listEl) return;

    if (!history || history.length === 0) {
        listEl.innerHTML = '<div class="game-history-empty">暂无对局记录</div>';
        return;
    }

    // 乱斗模式不显示回合数（chaos/chaos4没有回合概念）
    const isChaosMode = (item) => item.gameMode === 'chaos' || item.gameMode === 'chaos4';

    let html = '';

    for (const item of history) {
        const resultClass = item.result === 'win' ? 'win' : 'loss';
        const resultText = item.result === 'win' ? '胜利' : '失败';
        const terrainText = item.generateTerrain ? '开启' : '关闭';
        const opponentText = item.opponentUsername || '未知对手';
        const timeText = formatDateTime(item.playedAt);
        const showRounds = !isChaosMode(item);

        html += `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-item-result ${resultClass}">${resultText}</span>
                    <span class="history-item-time">${timeText}</span>
                </div>
                <div class="history-item-details">
                    ${showRounds ? `
                    <div class="history-detail">
                        <span class="history-detail-label">回合数：</span>
                        <span>${item.rounds}回合</span>
                    </div>
                    ` : ''}
                    <div class="history-detail">
                        <span class="history-detail-label">棋子数：</span>
                        <span>${item.pieceCount || '?'}颗</span>
                    </div>
                    <div class="history-detail">
                        <span class="history-detail-label">地形：</span>
                        <span>${terrainText}</span>
                    </div>
                    <div class="history-opponent history-detail">
                        <span class="history-detail-label">对手：</span>
                        <span>${opponentText}</span>
                    </div>
                </div>
            </div>
        `;
    }

    listEl.innerHTML = html;
}

// 隐藏游戏历史详情弹窗
function hideGameHistoryModal() {
    const modal = document.getElementById('gameHistoryModal');
    if (modal) {
        modal.classList.add('modal-animate-out');
        setTimeout(() => {
            modal.classList.remove('show', 'modal-animate-out');
        }, 250);
    }
}

// 格式化日期时间
function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}
