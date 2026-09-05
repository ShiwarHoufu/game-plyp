// 全局变量
let gameEngine;
let menu;
let gameUI;
let winnerModal;
let confirmModal;
let settingsModal;
let skillSelectionUI;
let classicPrepareContainer;
window.generateTerrain = false;  // 全局变量，供 GameEngine 读取
let skillPieceCount = 3; // 技能模式棋子数量临时存储

// 初始化游戏
function initGame() {
    // 初始化游戏引擎
    gameEngine = new GameEngine('gameCanvas');

    // 初始化乱斗4人模式画布尺寸
    const chaos4Canvas = document.getElementById('chaos4Canvas');
    if (chaos4Canvas && GAME_CONFIG.chaos4CanvasWidth && GAME_CONFIG.chaos4CanvasHeight) {
        chaos4Canvas.width = GAME_CONFIG.chaos4CanvasWidth;
        chaos4Canvas.height = GAME_CONFIG.chaos4CanvasHeight;
    }
    
    // 初始化UI组件
    menu = new Menu('menuContainer');
    gameUI = new GameUI();
    window.gameUI = gameUI;  // 确保全局可访问
    winnerModal = new Modal('winnerModal');
    confirmModal = new Modal('confirmModal');
    settingsModal = new Modal('settingsModal');
    skillSelectionUI = new SkillSelectionUI('skillSelectionContainer');
    window.skillSelectionUI = skillSelectionUI;  // 确保全局可访问
    classicPrepareContainer = document.getElementById('classicPrepareContainer');
    
    // 初始化颜色选择事件
    setupColorSelectionEvents();
    
    // 设置菜单事件
    setupMenuEvents();
    
    // 设置技能选择界面事件
    setupSkillSelectionEvents();
    
    // 设置模态框事件
    setupModalEvents();
    
    // 显示菜单
    menu.show();
    gameUI.hide();
}

// 设置菜单事件
function setupMenuEvents() {
    // 处理模式选择
    menu.onModeSelect((mode) => {
        if (mode === 'skill') {
            // 技能模式需要先选择棋子数量
            showSkillPieceCountModal();
        } else if (mode === 'classic') {
            // 经典模式需要先进入准备界面
            menu.hide();
            classicPrepareContainer.style.display = 'flex';
        } else {
            const selectedMode = modeManager.setCurrentMode(mode);
            if (selectedMode) {
                gameEngine.setMode(selectedMode);
                menu.hide();
                gameUI.show();
                gameEngine.start();
            }
        }
    });
    
    // 为菜单按钮添加点击事件
    const classicBtn = document.querySelector('.classic-btn');
    if (classicBtn) {
        classicBtn.addEventListener('click', () => {
            menu.triggerModeSelect('classic');
        });
    }
    
    const skillBtn = document.querySelector('.skill-btn');
    if (skillBtn) {
        skillBtn.addEventListener('click', () => {
            menu.triggerModeSelect('skill');
        });
    }
}

// 设置技能选择界面事件
function setupSkillSelectionEvents() {
    skillSelectionUI.onStartBattle((data) => {
        const selectedMode = modeManager.setCurrentMode('skill', {
            pieceCount: skillPieceCount,
            player1Color: GAME_CONFIG.playerColors.player1,
            player2Color: GAME_CONFIG.playerColors.player2
        });
        if (selectedMode) {
            selectedMode.selectedSkills = {
                1: data.player1Skills,
                2: data.player2Skills
            };
            selectedMode.player1GlobalSkill = data.player1GlobalSkill;
            selectedMode.player2GlobalSkill = data.player2GlobalSkill;
            window.generateTerrain = data.generateTerrain;
            skillSelectionUI.hide();
            // 隐藏乱斗4人容器，确保显示正确的游戏容器
            const chaos4GameContainer = document.getElementById('chaos4GameContainer');
            if (chaos4GameContainer) {
                chaos4GameContainer.style.display = 'none';
                chaos4GameContainer.classList.remove('active');
            }
            // 切换回主画布
            gameEngine.switchCanvas('gameCanvas');
            gameEngine.setMode(selectedMode);
            // 技能模式不更新玩家颜色显示（每个玩家有多种颜色棋子）
            gameUI.show();
            gameEngine.start();
        }
    });
    
    skillSelectionUI.onBackToMenu(() => {
        skillSelectionUI.hide();
        menu.show();
    });
}

// 设置模态框事件
function setupModalEvents() {
    // 处理重新开始
    winnerModal.onRestart(() => {
        winnerModal.hide();
        gameEngine.restart();
    });
    
    // 处理返回菜单
    winnerModal.onBackToMenu(() => {
        winnerModal.hide();
        gameUI.hide();
        menu.show();
        gameEngine.gameStarted = false;
    });
    
    // 为模态框按钮添加点击事件
    const playAgainBtn = document.getElementById('playAgainBtn');
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');
    
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            // 检查是否是联网模式
            if (gameEngine && gameEngine.mode && gameEngine.mode.isNetworkMode) {
                // 联网模式：调用networkManager的playAgain方法
                if (window.networkManager) {
                    window.window.networkManager.playAgain();
                }
            } else {
                // 本地模式：直接重新开始
                winnerModal.hide();
                gameEngine.restart();
            }
        });
    }
    
    if (backToLobbyBtn) {
        backToLobbyBtn.addEventListener('click', () => {
            // 检查是否是联网模式
            if (gameEngine && gameEngine.mode && gameEngine.mode.isNetworkMode) {
                // 联网模式：调用networkManager的backToLobby方法
                if (window.networkManager) {
                    window.window.networkManager.backToLobby();
                }
            } else {
                // 本地模式：返回菜单
                winnerModal.hide();
                gameUI.hide();
                menu.show();
                gameEngine.gameStarted = false;
                // 重置游戏引擎状态，确保所有对局参数被清除
                gameEngine.init();
            }
        });
    }
}

// 开始游戏
function startGame(mode) {
    menu.triggerModeSelect(mode);
}

// 返回菜单
function backToMenu() {
    // 隐藏匹配大厅和房间界面
    const networkLobbyContainer = document.getElementById('networkLobbyContainer');
    const networkRoomContainer = document.getElementById('networkRoomContainer');
    const gameContainer = document.getElementById('gameContainer');
    const chaos4GameContainer = document.getElementById('chaos4GameContainer');
    if (networkLobbyContainer) {
        networkLobbyContainer.style.display = 'none';
    }
    if (networkRoomContainer) {
        networkRoomContainer.style.display = 'none';
    }
    if (gameContainer) {
        gameContainer.style.display = 'none';
    }
    if (chaos4GameContainer) {
        chaos4GameContainer.style.display = 'none';
        chaos4GameContainer.classList.remove('active');
    }

    // 重置画布到主画布，避免下次进入本地模式时画布错误
    gameEngine.switchCanvas('gameCanvas');

    // 显示菜单
    menu.show();
    
    // 断开网络连接
    if (window.networkManager) {
        window.networkManager.disconnect();
    }
    
    // 重置游戏状态
    if (gameEngine) {
        gameEngine.gameStarted = false;
        gameEngine.turnCount = 0;
    }
}

// 确认返回菜单
function confirmBackToMenu() {
    confirmModal.hide();
    winnerModal.hide();
    gameUI.hide();
    gameEngine.gameStarted = false;
    gameEngine.turnCount = 0;

    // 如果在联网房间中，先发送返回大厅消息
    if (window.networkManager && window.networkManager.currentRoom) {
        window.networkManager.backToLobby();
    } else {
        // 非联网模式或不在房间中，正常返回菜单
        menu.show();
        if (window.networkManager) {
            window.networkManager.disconnect();
        }
        // 重置技能选择UI状态，确保切换到本地模式时状态正确
        if (skillSelectionUI) {
            skillSelectionUI.isNetworkMode = false;
            skillSelectionUI.selectionEnabled = true;
            skillSelectionUI.networkPhase = 'skill';
        }
    }
}

// 从游戏中确认返回菜单
function confirmBackToMenuFromGame() {
    // 显示确认弹窗（所有模式都需要确认）
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        confirmModal.classList.add('show');
    }
}

// 取消返回菜单
function cancelBackToMenu() {
    confirmModal.hide();
}

// 重新开始游戏
function restartGame() {
    // 检查是否是联网模式
    const networkMode = gameEngine && gameEngine.mode && gameEngine.mode.isNetworkMode;
    
    if (networkMode) {
        // 联网模式：发送重新开始请求
        sendRestartRequest();
    } else {
        // 本地模式：直接显示确认弹窗
        document.getElementById('restartModal').style.display = 'flex';
    }
}

// 确认重新开始
function confirmRestart() {
    document.getElementById('restartModal').style.display = 'none';
    gameEngine.restart();
}

// 取消重新开始
function cancelRestart() {
    document.getElementById('restartModal').style.display = 'none';
}

// 发送重新开始请求
function sendRestartRequest() {
    if (window.networkManager) {
        // 显示等待弹窗
        showRestartWaitingModal();
        // 发送重新开始请求
        window.networkManager.sendRestartRequest();
    }
}

// 显示重新开始请求弹窗
function showRestartRequestModal() {
    const modal = document.getElementById('restartRequestModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 隐藏重新开始请求弹窗
function hideRestartRequestModal() {
    const modal = document.getElementById('restartRequestModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 显示重新开始等待弹窗
function showRestartWaitingModal() {
    const modal = document.getElementById('restartWaitingModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 隐藏重新开始等待弹窗
function hideRestartWaitingModal() {
    const modal = document.getElementById('restartWaitingModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 接受重新开始请求
function acceptRestartRequest() {
    hideRestartRequestModal();
    if (window.networkManager) {
        window.networkManager.acceptRestartRequest();
    }
}

// 拒绝重新开始请求
function rejectRestartRequest() {
    hideRestartRequestModal();
    if (window.networkManager) {
        window.networkManager.rejectRestartRequest();
    }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    // 从canvas读取尺寸并设置CSS变量
    updateBoardSizeFromCanvas();
    initGame();
    // 初始化联网经典模式颜色选择
    initNetworkClassicColorSelection();

    // 启动画面点击后开始BGM
    const startupScreen = document.getElementById('startupScreen');
    if (startupScreen) {
        const hideStartupAndPlayBgm = () => {
            startupScreen.style.opacity = '0';
            startupScreen.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                startupScreen.style.display = 'none';
            }, 500);
            if (gameEngine) {
                gameEngine.playBgm();
            }
        };
        startupScreen.addEventListener('click', hideStartupAndPlayBgm);
        startupScreen.addEventListener('touchstart', hideStartupAndPlayBgm);
    }
});

// 从canvas读取尺寸并更新CSS变量
function updateBoardSizeFromCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        const width = canvas.getAttribute('width') || canvas.width;
        const height = canvas.getAttribute('height') || canvas.height;
        document.documentElement.style.setProperty('--board-width', width + 'px');
        document.documentElement.style.setProperty('--board-height', height + 'px');
    }
}

// 保存设置
function saveSettings() {
    const terrainToggle = document.getElementById('terrainToggle');
    skillSelectionUI.generateTerrain = terrainToggle.checked;
    const settingsModal = document.getElementById('settingsModal');
    settingsModal.classList.remove('show');
}

// 取消设置
function cancelSettings() {
    const settingsModal = document.getElementById('settingsModal');
    settingsModal.classList.remove('show');
}

// 开始经典游戏
function startClassicGame() {
    // 获取用户选择的棋子数量和颜色
    const pieceCount = parseInt(document.getElementById('pieceCount').value);
    const player1Color = document.getElementById('player1Color').value;
    const player2Color = document.getElementById('player2Color').value;
    
    // 检查两个玩家的颜色是否相同
    if (player1Color === player2Color) {
        // 显示错误提示
        showErrorModal('选择了重复的颜色！请重新选择');
        return;
    }
    
    // 设置当前模式
    const selectedMode = modeManager.setCurrentMode('classic', {
        pieceCount: pieceCount,
        player1Color: player1Color,
        player2Color: player2Color
    });
    if (selectedMode) {
        gameEngine.setMode(selectedMode);
        // 隐藏乱斗4人容器，确保显示正确的游戏容器
        const chaos4GameContainer = document.getElementById('chaos4GameContainer');
        if (chaos4GameContainer) {
            chaos4GameContainer.style.display = 'none';
            chaos4GameContainer.classList.remove('active');
        }
        // 切换回主画布
        gameEngine.switchCanvas('gameCanvas');
        // 隐藏准备界面，显示游戏界面
        classicPrepareContainer.style.display = 'none';
        // 更新玩家颜色显示
        gameUI.updatePlayerColors(selectedMode.player1Color, selectedMode.player2Color);
        gameUI.show();
        gameEngine.start();
    }
}

// 返回经典模式菜单
function backToClassicMenu() {
    classicPrepareContainer.style.display = 'none';
    menu.show();
}

// 设置颜色选择事件
function setupColorSelectionEvents() {
    // 获取颜色选择网格
    const player1ColorGrid = document.getElementById('player1ColorGrid');
    const player2ColorGrid = document.getElementById('player2ColorGrid');
    
    if (player1ColorGrid && player2ColorGrid) {
        // 玩家1颜色选择
        player1ColorGrid.addEventListener('click', function(e) {
            if (e.target.classList.contains('color-option')) {
                const selectedColor = e.target.dataset.color;
                
                // 移除所有选项的选中状态
                const options = player1ColorGrid.querySelectorAll('.color-option');
                options.forEach(option => {
                    option.classList.remove('selected');
                });
                
                // 添加当前选项的选中状态
                e.target.classList.add('selected');
                
                // 更新隐藏输入框的值
                document.getElementById('player1Color').value = selectedColor;
                
                // 禁用玩家2的相同颜色选项
                updateColorOptionsAvailability();
            }
        });
        
        // 玩家2颜色选择
        player2ColorGrid.addEventListener('click', function(e) {
            if (e.target.classList.contains('color-option')) {
                const selectedColor = e.target.dataset.color;
                
                // 移除所有选项的选中状态
                const options = player2ColorGrid.querySelectorAll('.color-option');
                options.forEach(option => {
                    option.classList.remove('selected');
                });
                
                // 添加当前选项的选中状态
                e.target.classList.add('selected');
                
                // 更新隐藏输入框的值
                document.getElementById('player2Color').value = selectedColor;
                
                // 禁用玩家1的相同颜色选项
                updateColorOptionsAvailability();
            }
        });
    }
}

// 更新颜色选项的可用性
function updateColorOptionsAvailability() {
    const player1Color = document.getElementById('player1Color').value;
    const player2Color = document.getElementById('player2Color').value;
    
    // 禁用玩家2的相同颜色选项
    const player2Options = document.getElementById('player2ColorGrid').querySelectorAll('.color-option');
    player2Options.forEach(option => {
        if (option.dataset.color === player1Color) {
            option.style.opacity = '0.5';
            option.style.cursor = 'not-allowed';
        } else {
            option.style.opacity = '1';
            option.style.cursor = 'pointer';
        }
    });
    
    // 禁用玩家1的相同颜色选项
    const player1Options = document.getElementById('player1ColorGrid').querySelectorAll('.color-option');
    player1Options.forEach(option => {
        if (option.dataset.color === player2Color) {
            option.style.opacity = '0.5';
            option.style.cursor = 'not-allowed';
        } else {
            option.style.opacity = '1';
            option.style.cursor = 'pointer';
        }
    });
}

// 显示错误弹窗
function showErrorModal(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    if (errorModal && errorMessage) {
        errorMessage.textContent = message;
        errorModal.classList.add('show');
    }
}

// 隐藏错误弹窗
function hideErrorModal() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.classList.remove('show');
    }
}

// 显示玩家断开连接弹窗
function showDisconnectModal(message) {
    // 关闭游戏结束弹窗
    const winnerModal = document.getElementById('winnerModal');
    if (winnerModal) {
        winnerModal.classList.remove('show');
    }

    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    if (errorModal && errorMessage) {
        errorMessage.textContent = message;
        errorModal.classList.add('show');

        // 移除原有的确认按钮事件
        const errorConfirmBtn = document.querySelector('.error-confirm-btn');
        if (errorConfirmBtn) {
            // 先移除所有现有的事件监听器
            const newBtn = errorConfirmBtn.cloneNode(true);
            errorConfirmBtn.parentNode.replaceChild(newBtn, errorConfirmBtn);

            // 添加新的事件监听器
            newBtn.addEventListener('click', function() {
                hideErrorModal();
                // 再次确保游戏结束弹窗被关闭
                if (winnerModal) {
                    winnerModal.classList.remove('show');
                }
                // 检查是否是乱斗4人模式且游戏已正式开始
                const isChaos4Game = window.networkManager && window.networkManager.roomMode === 'chaos4' &&
                                    gameEngine && gameEngine.gameStarted &&
                                    document.getElementById('chaos4GameContainer').classList.contains('active');
                // 根据玩家身份决定跳转到哪个界面
                if (window.networkManager) {
                    if (isChaos4Game) {
                        // 乱斗4人模式游戏中，玩家留在游戏界面
                        return;
                    }
                    if (window.networkManager.playerId === 1 && window.networkManager.currentRoom) {
                        // 玩家跳转到自己所在的房间界面
                        window.networkManager.showRoomUI(window.networkManager.currentRoom, window.networkManager.roomName);
                    } else {
                        // 其他玩家跳转到大厅界面
                        window.networkManager.showLobbyUI();
                    }
                }
            });
        }
    }
}

// 显示技能模式棋子数量选择弹窗
function showSkillPieceCountModal() {
    const modal = document.getElementById('skillPieceCountModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 隐藏技能模式棋子数量选择弹窗
function hideSkillPieceCountModal() {
    const modal = document.getElementById('skillPieceCountModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 显示联网经典模式准备界面
function showNetworkClassicPrepare() {
    const container = document.getElementById('networkClassicPrepareContainer');
    if (container) {
        container.style.display = 'flex';
    }
    // 隐藏房间界面
    const roomContainer = document.getElementById('networkRoomContainer');
    if (roomContainer) {
        roomContainer.style.display = 'none';
    }
}

// 隐藏联网经典模式准备界面
function hideNetworkClassicPrepare() {
    const container = document.getElementById('networkClassicPrepareContainer');
    if (container) {
        container.style.display = 'none';
    }
}

// 返回网络房间
function backToNetworkRoom() {
    hideNetworkClassicPrepare();
    const roomContainer = document.getElementById('networkRoomContainer');
    if (roomContainer) {
        roomContainer.style.display = 'flex';
    }
}

// 更新房间棋子数量
function updateRoomPieceCount() {
    const pieceCount = parseInt(document.getElementById('roomPieceCount').value);

    // 发送棋子数量更新消息给服务器
    if (window.networkManager) {
        window.networkManager.updateRoomPieceCount(pieceCount);
    }
}

// 确认联网经典模式设置
function confirmNetworkClassicSettings() {
    const playerColor = document.getElementById('networkPlayerColor').value;
    const playerSkinId = document.getElementById('networkPlayerSkinId')?.value || 'default';

    // 从 localStorage 加载已装备的拖尾效果并设置到 gameEngine
    const equippedTrail = localStorage.getItem('equippedTrailEffect') || 'trail_white';
    if (window.gameEngine) {
        window.gameEngine.setEquippedTrailEffect(equippedTrail);
    }

    // 发送确认消息给服务器（包含拖尾效果）
    if (window.networkManager) {
        window.networkManager.confirmNetworkClassicSettings(playerColor, playerSkinId, equippedTrail);
    }
}

// 加载玩家拥有的皮肤
async function loadOwnedSkins() {
    try {
        const token = authUI.getToken();
        if (!token) return [];

        const response = await fetch('/api/shop/owned-skins', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.skins.length > 0) {
            return data.skins;
        }
    } catch (error) {
        console.error('加载拥有皮肤失败:', error);
    }
    return [];
}

// 刷新皮肤选择（显示已拥有的皮肤）
async function refreshSkinSelection() {
    const skinSelectionArea = document.getElementById('skinSelectionArea');
    const skinGrid = document.getElementById('networkPlayerSkinGrid');
    if (!skinSelectionArea || !skinGrid) return;

    const ownedSkins = await loadOwnedSkins();

    if (ownedSkins.length > 0) {
        skinSelectionArea.style.display = 'block';

        // 重置选中状态到默认
        document.getElementById('networkPlayerSkinId').value = 'default';

        // 构建默认皮肤选项
        let skinHtml = `
            <div class="skin-option selected" data-skin-id="default">
                <div class="skin-option-placeholder">默</div>
            </div>
        `;

        // 添加拥有的皮肤
        for (const skin of ownedSkins) {
            skinHtml += `
                <div class="skin-option" data-skin-id="${skin.item_id}">
                    ${skin.image_path ?
                        `<img src="${skin.image_path}" alt="${skin.name}" onerror="this.parentElement.innerHTML='<div class=skin-option-placeholder>${skin.name[0]}</div>'">` :
                        `<div class="skin-option-placeholder">${skin.name[0]}</div>`
                    }
                </div>
            `;
        }

        skinGrid.innerHTML = skinHtml;

        // 绑定皮肤选择事件
        skinGrid.onclick = function(e) {
            const skinOption = e.target.closest('.skin-option');
            if (skinOption) {
                const selectedSkinId = skinOption.dataset.skinId;

                // 更新选中状态
                const options = skinGrid.querySelectorAll('.skin-option');
                options.forEach(option => {
                    option.classList.remove('selected');
                });
                skinOption.classList.add('selected');

                // 更新隐藏输入框的值
                document.getElementById('networkPlayerSkinId').value = selectedSkinId;
            }
        };
    } else {
        skinSelectionArea.style.display = 'none';
    }
}

// 刷新统一的皮肤选择界面
async function refreshUnifiedSkinSelection() {
    const unifiedGrid = document.getElementById('unifiedSkinGrid');
    if (!unifiedGrid) return;

    // 默认颜色选项
    const defaultColors = [
        { color: '#ff4757', name: '红' },
        { color: '#a5b0a3', name: '灰' },
        { color: '#3742fa', name: '蓝' },
        { color: '#ffa502', name: '橙' },
        { color: '#8e44ad', name: '紫' },
        { color: '#1e90ff', name: '天蓝' },
        { color: '#2ed573', name: '绿' },
        { color: '#ff6b81', name: '粉' },
        { color: '#1289a7', name: '青' },
        { color: '#f9ca24', name: '黄' }
    ];

    // 加载拥有的皮肤
    const ownedSkins = await loadOwnedSkins();

    // 构建统一的皮肤选项HTML
    let html = '';

    // 添加默认颜色选项（使用圆形渐变背景显示）
    for (const colorOpt of defaultColors) {
        html += `
            <div class="unified-skin-option" data-skin-id="default" data-color="${colorOpt.color}" title="默认-${colorOpt.name}">
                <div style="width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle at 30% 30%, ${colorOpt.color}, ${adjustColor(colorOpt.color, -30)});"></div>
            </div>
        `;
    }

    // 添加已购买的皮肤选项
    for (const skin of ownedSkins) {
        if (skin.item_id !== 'default') {
            html += `
                <div class="unified-skin-option" data-skin-id="${skin.item_id}" data-color="#ffffff" title="${skin.name}">
                    ${skin.image_path ?
                        `<img src="${skin.image_path}" alt="${skin.name}" onerror="this.parentElement.innerHTML='<div class=unified-skin-option-placeholder>${skin.name[0]}</div>'">` :
                        `<div class="unified-skin-option-placeholder">${skin.name[0]}</div>`
                    }
                </div>
            `;
        }
    }

    unifiedGrid.innerHTML = html;

    // 选中第一个默认颜色
    const firstOption = unifiedGrid.querySelector('.unified-skin-option');
    if (firstOption) {
        firstOption.classList.add('selected');
        document.getElementById('networkPlayerColor').value = firstOption.dataset.color || '#ff4757';
        document.getElementById('networkPlayerSkinId').value = firstOption.dataset.skinId || 'default';
    }

    // 绑定选择事件
    unifiedGrid.onclick = function(e) {
        const option = e.target.closest('.unified-skin-option');
        if (option) {
            // 更新选中状态
            const options = unifiedGrid.querySelectorAll('.unified-skin-option');
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // 更新隐藏输入框的值
            const selectedSkinId = option.dataset.skinId;
            const selectedColor = option.dataset.color;
            document.getElementById('networkPlayerSkinId').value = selectedSkinId;
            document.getElementById('networkPlayerColor').value = selectedColor;
        }
    };
}

// 调整颜色亮度
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// 初始化联网经典模式颜色和皮肤选择
function initNetworkClassicColorSelection() {
    // 不再需要初始化颜色网格，现在使用统一的皮肤选择
}

// 选择技能模式棋子数量
function selectSkillPieceCount(count) {
    // 存储棋子数量到临时变量，等待模式实例创建时使用
    skillPieceCount = count;

    // 确保从网络模式完全切换到本地模式，清理所有可能残留的网络状态
    if (skillSelectionUI) {
        skillSelectionUI.isNetworkMode = false;
        skillSelectionUI.selectionEnabled = true;
        skillSelectionUI.setMaxSkillsPerPlayer(count);
    }

    // 隐藏弹窗并进入技能选择界面
    hideSkillPieceCountModal();
    menu.hide();
    skillSelectionUI.show();
}

// 开始联网对战
function startNetworkGame() {
    // 检查是否登录
    if (!window.authUI || !window.authUI.isLoggedIn) {
        showAuthModal();
        return;
    }

    menu.hide();

    // 显示匹配大厅
    const networkLobbyContainer = document.getElementById('networkLobbyContainer');
    networkLobbyContainer.style.display = 'flex';

    // 连接到服务器
    if (window.networkManager) {
        // 传递 auth token
        window.window.networkManager.setAuthToken(window.authUI.getToken());
        window.window.networkManager.connect().then(() => {
            // 连接成功
        }).catch(error => {
            showErrorModal('网络连接失败，请检查服务器是否运行');
        });
    }
}

// 返回大厅
function backToLobby() {
    const networkRoomContainer = document.getElementById('networkRoomContainer');
    const networkLobbyContainer = document.getElementById('networkLobbyContainer');
    
    networkRoomContainer.style.display = 'none';
    networkLobbyContainer.style.display = 'flex';
    
    if (window.networkManager) {
        window.networkManager.leaveRoom();
    }
}

// 显示网络模式选择弹窗
function showNetworkModeSelectModal() {
    const modal = document.getElementById('networkModeSelectModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 隐藏网络模式选择弹窗
function hideNetworkModeSelectModal() {
    const modal = document.getElementById('networkModeSelectModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 选择网络模式
function selectNetworkMode(mode) {
    // 隐藏弹窗
    hideNetworkModeSelectModal();

    // 获取房间名称
    const roomNameInput = document.getElementById('roomNameInput');
    const roomName = roomNameInput ? roomNameInput.value.trim() : '';

    // 清空房间名称输入框
    if (roomNameInput) {
        roomNameInput.value = '';
    }

    // 获取棋子数量
    let pieceCount = 3;
    const createRoomPieceCount = document.getElementById('createRoomPieceCount');
    if (createRoomPieceCount) {
        pieceCount = parseInt(createRoomPieceCount.value);
    }

    // 获取地形生成设置
    const terrainToggle = document.getElementById('createRoomTerrainToggle');
    const generateTerrain = terrainToggle ? terrainToggle.checked : false;
    console.log('创建房间参数:', { mode, roomName, pieceCount, generateTerrain });

    // 4人乱斗模式验证：只支持2-4子
    if (mode === 'chaos4' && pieceCount > 4) {
        showErrorModal('4人乱斗模式不支持5子，请选择2-4颗棋子');
        return;
    }

    // 创建房间并传递选择的模式、房间名称、棋子数量和地形设置
    if (window.networkManager) {
        window.networkManager.createRoom(mode, roomName, pieceCount, generateTerrain);
    } else {
        console.error('networkManager 不存在');
    }
}

// 创建房间
function createNetworkRoom() {
    // 显示游戏模式选择弹窗
    showNetworkModeSelectModal();
}

// 显示创建房间设置弹窗
function showCreateRoomSettings() {
    const modal = document.getElementById('createRoomSettingsModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 隐藏创建房间设置弹窗
function hideCreateRoomSettings() {
    const modal = document.getElementById('createRoomSettingsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 加入房间
function joinNetworkRoom() {
    const roomIdInput = document.getElementById('roomIdInput');
    const roomId = roomIdInput.value.trim();

    if (!roomId) {
        showErrorModal('请输入房间号');
        return;
    }

    if (window.networkManager) {
        window.networkManager.joinRoom(roomId);
    }
}

// 离开房间
function leaveNetworkRoom() {
    if (window.networkManager) {
        window.networkManager.leaveRoom();
    }
}

// 切换准备状态
function toggleReady() {
    if (window.networkManager) {
        window.networkManager.toggleReady();
    }
}

// 开始网络游戏会话
function startNetworkGameSession(data) {
    // 根据游戏模式选择对应的网络模式
    const modeKey = data.mode === 'classic' ? 'classic-network' : (data.mode === 'chaos' ? 'chaos-network' : (data.mode === 'chaos4' ? 'chaos4-network' : 'skill-network'));

    // 设置生成地形（从服务器接收）
    if (data.generateTerrain !== undefined) {
        window.generateTerrain = data.generateTerrain;
    }

    // 设置当前模式
    const selectedMode = modeManager.setCurrentMode(modeKey, {
        pieceCount: data.pieceCount || 3,
        player1Color: data.playerSettings && data.playerSettings[1] ? data.playerSettings[1].playerColor : GAME_CONFIG.playerColors.player1,
        player2Color: data.playerSettings && data.playerSettings[2] ? data.playerSettings[2].playerColor : GAME_CONFIG.playerColors.player2
    });

    if (selectedMode) {
        // 设置网络数据
        selectedMode.setNetworkData(data);

        gameEngine.setMode(selectedMode);
        // 从游戏开始数据中获取当前玩家和回合计数
        if (data.currentPlayer) {
            gameEngine.currentPlayer = data.currentPlayer;
        }
        if (data.turnCount !== undefined) {
            gameEngine.turnCount = data.turnCount;
        }

        // 乱斗4人模式：切换到4人布局
        if (data.mode === 'chaos4') {
            document.getElementById('gameContainer').style.display = 'none';
            document.getElementById('chaos4GameContainer').style.display = 'flex';
            document.getElementById('chaos4GameContainer').classList.add('active');
            gameEngine.switchCanvas(GAME_CONFIG.chaos4CanvasId);

            // 更新4人玩家颜色显示
            for (let i = 1; i <= 4; i++) {
                const color = data.playerSettings && data.playerSettings[i] ? data.playerSettings[i].playerColor : GAME_CONFIG.playerColors[`player${i}`];
                const colorEl = document.getElementById(`chaos4Player${i}Color`);
                if (colorEl) colorEl.style.backgroundColor = color;
            }
        } else {
            document.getElementById('chaos4GameContainer').style.display = 'none';
            document.getElementById('chaos4GameContainer').classList.remove('active');
            document.getElementById('gameContainer').style.display = 'block';
            gameEngine.switchCanvas('gameCanvas');
            // 更新玩家颜色显示（仅经典和乱斗模式，技能模式每个玩家有多种颜色棋子）
            if (data.mode === 'classic' || data.mode === 'chaos') {
                gameUI.updatePlayerColors(selectedMode.player1Color, selectedMode.player2Color);
            }
        }

        gameUI.show();
        gameEngine.start();

        // 根据游戏模式显示或隐藏技能相关元素
        const globalSkillsContainer = document.querySelector('.global-skills-container');
        const useSkillButton = document.getElementById('useSkillButton');

        if (data.mode === 'classic') {
            // 经典模式：隐藏技能相关元素
            if (globalSkillsContainer) {
                globalSkillsContainer.style.display = 'none';
            }
            if (useSkillButton) {
                useSkillButton.style.display = 'none';
            }
        } else {
            // 技能模式：显示技能相关元素
            if (globalSkillsContainer) {
                globalSkillsContainer.style.display = 'flex';
            }
            // useSkillButton会在选中棋子时显示，所以这里不需要设置
        }
    }
}

// 页面加载完成后初始化游戏
// 注意：这里需要在原有的DOMContentLoaded事件之后添加网络模块的初始化
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // 初始化网络模块
    });
} else if (typeof document !== 'undefined' && document.readyState === 'interactive') {
    // 页面已经加载完成，直接初始化
}
// ==================== 聊天功能 ====================

let chatCurrentTab = 'emoji';
const EMOJI_LIST = ['😀', '😎', '😅', '😂', '😍', '🤔', '👍', '👎', '🎉', '💪', '🏆', '❤️'];
const CHAT_PRESETS = [
    '行不行啊？',
    '好球！',
    '运气真好！',
    '能不能快点啊？',
    '失误了',
    '再来一局',
    '不收徒',
    '再沉淀沉淀',
    '精彩！',
    '何意味'
];

function toggleChatPanel() {
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
        const isHidden = chatPanel.style.display === 'none';
        chatPanel.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            initChatEmojis();
        }
    }
}

function initChatEmojis() {
    const emojiGrid = document.getElementById('chatEmojiGrid');
    if (!emojiGrid || emojiGrid.children.length > 0) return;

    EMOJI_LIST.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'chat-emoji-item';
        item.textContent = emoji;
        item.onclick = () => sendChatEmoji(emoji);
        emojiGrid.appendChild(item);
    });
}

function switchChatTab(tab) {
    chatCurrentTab = tab;
    const emojiGrid = document.getElementById('chatEmojiGrid');
    const textInput = document.getElementById('chatTextInput');
    const emojiTab = document.getElementById('chatTabEmoji');
    const textTab = document.getElementById('chatTabText');

    if (tab === 'emoji') {
        emojiGrid.style.display = 'grid';
        textInput.style.display = 'none';
        emojiTab.classList.add('active');
        textTab.classList.remove('active');
    } else {
        emojiGrid.style.display = 'none';
        textInput.style.display = 'flex';
        emojiTab.classList.remove('active');
        textTab.classList.add('active');
        initChatPresets();
        const chatInput = document.getElementById('chatMessageInput');
        if (chatInput) chatInput.focus();
    }
}

function initChatPresets() {
    const presetsContainer = document.getElementById('chatPresets');
    if (!presetsContainer || presetsContainer.children.length > 0) return;

    CHAT_PRESETS.forEach(preset => {
        const button = document.createElement('button');
        button.className = 'chat-preset-btn';
        button.textContent = preset;
        button.onclick = () => sendPresetMessage(preset);
        presetsContainer.appendChild(button);
    });
}

function sendPresetMessage(message) {
    if (window.networkManager) {
        window.window.networkManager.sendChatMessage(message);
    }
    toggleChatPanel();
}

function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    if (input && input.value.trim()) {
        if (window.networkManager) {
            window.window.networkManager.sendChatMessage(input.value.trim());
        }
        input.value = '';
        toggleChatPanel();
    }
}

function sendChatEmoji(emoji) {
    if (window.networkManager) {
        window.window.networkManager.sendEmoji(emoji);
    }
    toggleChatPanel();
}

// Enter key for chat input
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatMessageInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
});

// 显示更新日志
function showChangelog() {
  const changelogModal = document.getElementById('changelogModal');
  const changelogSidebar = document.getElementById('changelogSidebar');
  const changelogDetails = document.getElementById('changelogDetails');
  
  changelogSidebar.innerHTML = '<p>加载中...</p>';
  changelogDetails.innerHTML = '<div class="changelog-details-empty">请选择一个更新日志</div>';
  
  // 加载更新日志索引
  fetch('changelogs/index.json')
    .then(response => response.json())
    .then(data => {
      changelogSidebar.innerHTML = '';
      
      // 加载每个更新日志
      const promises = data.logs.map(log => {
        return fetch(`changelogs/${log.file}`)
          .then(response => response.json())
          .then(logData => {
            const sidebarItem = document.createElement('div');
            sidebarItem.className = 'changelog-sidebar-item';
            sidebarItem.dataset.id = log.id;
            
            sidebarItem.innerHTML = `
              <h3>${logData.title}</h3>
              <div class="date">${logData.date}</div>
            `;
            
            sidebarItem.addEventListener('click', () => {
              // 移除所有active类
              document.querySelectorAll('.changelog-sidebar-item').forEach(item => {
                item.classList.remove('active');
              });
              // 添加active类到当前项
              sidebarItem.classList.add('active');
              // 显示详细内容
              displayChangelogDetails(logData);
            });
            
            changelogSidebar.appendChild(sidebarItem);
          });
      });
      
      Promise.all(promises)
        .then(() => {
          // 自动选中第一个日志
          const firstItem = changelogSidebar.querySelector('.changelog-sidebar-item');
          if (firstItem) {
            firstItem.click();
          }
        })
        .catch(error => {
          changelogSidebar.innerHTML = '<p>加载更新日志失败</p>';
          console.error('加载更新日志失败:', error);
        });
    })
    .catch(error => {
      changelogSidebar.innerHTML = '<p>加载更新日志失败</p>';
      console.error('加载更新日志索引失败:', error);
    });
  
  changelogModal.style.display = 'flex';
  // 触发动画
  requestAnimationFrame(() => {
    changelogModal.classList.add('modal-animate-in');
  });
}

// 显示更新日志详细内容
function displayChangelogDetails(logData) {
  const changelogDetails = document.getElementById('changelogDetails');
  
  let changesHtml = '';
  logData.changes.forEach(change => {
    changesHtml += `<li>${change}</li>`;
  });
  
  changelogDetails.innerHTML = `
    <div class="changelog-details-content">
      <h3>${logData.title}</h3>
      <div class="date">${logData.date}</div>
      <ul>${changesHtml}</ul>
    </div>
  `;
}

// 隐藏更新日志
function hideChangelog() {
  const changelogModal = document.getElementById('changelogModal');
  changelogModal.classList.remove('modal-animate-in');
  changelogModal.classList.add('modal-animate-out');
  // 等待动画完成后隐藏
  setTimeout(() => {
    changelogModal.style.display = 'none';
    changelogModal.classList.remove('modal-animate-out');
  }, 280);
}

// 显示新手帮助
function showHelp() {
  const helpModal = document.getElementById('helpModal');
  const helpSidebar = document.getElementById('helpSidebar');
  const helpDetails = document.getElementById('helpDetails');

  // 渲染侧边栏
  helpSidebar.innerHTML = '';
  HelpData.forEach((item) => {
    const sidebarItem = document.createElement('div');
    sidebarItem.className = 'help-sidebar-item';
    sidebarItem.dataset.id = item.id;
    sidebarItem.innerHTML = `
      <h3>${item.title}</h3>
      <div class="desc">${item.desc}</div>
    `;

    sidebarItem.addEventListener('click', () => {
      // 移除所有active类
      document.querySelectorAll('.help-sidebar-item').forEach(i => {
        i.classList.remove('active');
      });
      // 添加active类到当前项
      sidebarItem.classList.add('active');
      // 显示详细内容
      helpDetails.innerHTML = `<div class="help-details-content">${item.content}</div>`;
    });

    helpSidebar.appendChild(sidebarItem);
  });

  // 默认选中第一项
  if (HelpData.length > 0) {
    helpDetails.innerHTML = `<div class="help-details-content">${HelpData[0].content}</div>`;
    const firstItem = helpSidebar.querySelector('.help-sidebar-item');
    if (firstItem) firstItem.classList.add('active');
  }

  helpModal.style.display = 'flex';
  // 触发动画
  requestAnimationFrame(() => {
    helpModal.classList.add('modal-animate-in');
  });
}

// 隐藏新手帮助
function hideHelp() {
  const helpModal = document.getElementById('helpModal');
  helpModal.classList.remove('modal-animate-in');
  helpModal.classList.add('modal-animate-out');
  // 等待动画完成后隐藏
  setTimeout(() => {
    helpModal.style.display = 'none';
    helpModal.classList.remove('modal-animate-out');
  }, 280);
}
