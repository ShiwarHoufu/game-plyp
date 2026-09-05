/**
 * 网络管理器
 * 负责网络对战的逻辑管理
 */
class NetworkManager {
    constructor() {
        this.socketClient = socketClient;
        this.uiManager = window.uiManager;
        this.currentRoom = null;
        this.roomName = null;
        this.playerId = null;
        this.opponentId = null;
        this.isReady = false;
        this.isConfirmed = false;
        this.classicSettings = null;
        this.roomList = [];
        this.onlinePlayers = 0;
        this.gameState = null;

        // 玩家用户名存储 {playerId: username}
        this.playerUsernames = {};

        // 认证相关
        this.authToken = null;

        // 初始化子处理器
        this.roomHandler = new RoomHandler(this);
        this.gameSyncHandler = new GameSyncHandler(this);
        this.skillSelectionHandler = new SkillSelectionHandler(this);

        // 立即注册事件监听器
        this.initEventListeners();

        // 监听连接事件
        this.socketClient.on('connected', () => {
            console.log('NetworkManager: Socket连接成功，重新注册事件监听器');
            this.initEventListeners();
        });
    }

    /**
     * 设置认证 Token
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * 清除认证 Token
     */
    clearAuthToken() {
        this.authToken = null;
    }

    /**
     * 获取认证 Token
     */
    getAuthToken() {
        return this.authToken;
    }

    /**
     * 初始化事件监听器（委托给子处理器）
     */
    initEventListeners() {
        // 连接相关事件
        this.socketClient.on('connected', () => {
            this.updateConnectionStatus(true);
            this.joinLobby();
        });

        this.socketClient.on('disconnected', () => {
            this.updateConnectionStatus(false);
        });

        this.socketClient.on('serverConnect', (data) => {
            console.log('服务器连接成功:', data);
        });

        // 处理在线人数消息
        this.socketClient.on('online_players', (data) => {
            console.log('收到在线人数消息:', data);
            if (data.count !== undefined) {
                this.onlinePlayers = data.count;
                this.updateOnlinePlayersDisplay();
            }
        });

        // 委托给子处理器
        this.roomHandler.registerEvents();
        this.gameSyncHandler.registerEvents();
        this.skillSelectionHandler.registerEvents();

        // 处理房间加入成功（设置玩家ID）
        this.socketClient.on(MessageTypes.ROOM_JOINED, (data) => {
            if (data && data.playerId) {
                this.playerId = data.playerId;
                console.log(`[NetworkManager] 设置本地玩家ID: ${this.playerId}`);
            }
        });

        // 处理玩家确认成功
        this.socketClient.on('playerReady', (data) => {
            console.log('收到玩家准备消息:', data);
            if (data.playerId === this.playerId && data.ready) {
                this.isConfirmed = true;
                const confirmButton = document.getElementById('networkClassicConfirmBtn');
                if (confirmButton) {
                    confirmButton.textContent = '已确认';
                    confirmButton.classList.add('confirmed');
                    confirmButton.disabled = true;
                }
                this.setColorSelectionEnabled(false);
            }
        });

        // 聊天消息处理
        this.socketClient.on(MessageTypes.CHAT_MESSAGE, (data) => {
            this.handleChatMessage(data);
        });

        this.socketClient.on(MessageTypes.EMOJI, (data) => {
            this.handleEmoji(data);
        });

        // 道具相关消息
        this.socketClient.on(MessageTypes.ITEM_SPAWNED, (data) => {
            this.handleItemSpawned(data);
        });

        this.socketClient.on(MessageTypes.ITEM_PICKED_UP, (data) => {
            this.handleItemPickup(data);
        });

        this.socketClient.on(MessageTypes.ITEM_DESPAWNED, (data) => {
            this.handleItemDespawned(data);
        });

        this.socketClient.on(MessageTypes.PIECE_FROZEN, (data) => {
            this.handlePieceFrozen(data);
        });

        this.socketClient.on(MessageTypes.PIECE_DELETED, (data) => {
            console.log('[NetworkManager] 收到PIECE_DELETED消息:', data);
            this.handlePieceDeleted(data);
        });
    }

    /**
     * 更新在线人数显示
     */
    updateOnlinePlayersDisplay() {
        const onlinePlayersElement = document.getElementById('onlineCount');
        if (onlinePlayersElement) {
            onlinePlayersElement.textContent = this.onlinePlayers;
        }
    }

    /**
     * 连接到服务器
     */
    connect() {
        return this.socketClient.connect();
    }

    /**
     * 加入大厅
     */
    joinLobby() {
        this.socketClient.send(MessageTypes.JOIN_LOBBY, {});
    }

    /**
     * 离开大厅
     */
    leaveLobby() {
        this.socketClient.send(MessageTypes.LEAVE_LOBBY, {});
    }

    /**
     * 创建房间
     */
    createRoom(mode = 'classic', roomName = '', pieceCount = 3, generateTerrain = false) {
        console.log('NetworkManager.createRoom() 被调用', { mode, roomName, pieceCount, generateTerrain });

        if (!this.isConnected()) {
            console.log('Socket未连接，正在尝试连接...');
            this.connect().then(() => {
                this.socketClient.send(MessageTypes.CREATE_ROOM, {
                    mode: mode,
                    pieceCount: pieceCount,
                    roomName: roomName,
                    generateTerrain: generateTerrain
                });
            }).catch(error => {
                console.error('连接失败，无法创建房间:', error);
                showErrorModal('网络连接失败，无法创建房间');
            });
        } else {
            this.socketClient.send(MessageTypes.CREATE_ROOM, {
                mode: mode,
                pieceCount: pieceCount,
                roomName: roomName,
                generateTerrain: generateTerrain
            });
        }
    }

    /**
     * 加入房间
     */
    joinRoom(roomId) {
        console.log('NetworkManager.joinRoom() 被调用');
        if (!this.isConnected()) {
            console.log('Socket未连接，正在尝试连接...');
            this.connect().then(() => {
                this.socketClient.send(MessageTypes.JOIN_ROOM, { roomId: roomId });
            }).catch(error => {
                console.error('连接失败，无法加入房间:', error);
                showErrorModal('网络连接失败，无法加入房间');
            });
        } else {
            this.socketClient.send(MessageTypes.JOIN_ROOM, { roomId: roomId });
        }
    }

    /**
     * 离开房间
     */
    leaveRoom() {
        console.log('NetworkManager.leaveRoom() 被调用');
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.LEAVE_ROOM, { roomId: this.currentRoom });
        } else {
            console.warn('Socket未连接或没有当前房间，无法离开房间');
            this.currentRoom = null;
            this.playerId = null;
            this.opponentId = null;
            this.isReady = false;
            this.showLobbyUI();
        }
    }

    /**
     * 切换准备状态
     */
    toggleReady() {
        console.log('NetworkManager.toggleReady() 被调用');
        this.isReady = !this.isReady;
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.PLAYER_READY, {
                roomId: this.currentRoom,
                ready: this.isReady
            });
        } else {
            console.warn('Socket未连接或没有当前房间，无法切换准备状态');
        }
        this.uiManager.updateReadyButton(this.isReady);
    }

    /**
     * 发送玩家操作
     */
    sendPlayerAction(action) {
        this.socketClient.send(MessageTypes.PLAYER_ACTION, {
            roomId: this.currentRoom,
            action: action
        });
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(connected) {
        this.uiManager.updateConnectionStatus(connected);
    }

    /**
     * 更新房间列表
     */
    updateRoomList() {
        this.uiManager.updateRoomList(this.roomList);
    }

    /**
     * 更新玩家槽位
     */
    updatePlayerSlot(playerId, occupied, ready, currentPlayerId, username) {
        this.uiManager.updatePlayerSlot(playerId, occupied, ready, currentPlayerId || this.playerId, username);
    }

    /**
     * 显示大厅UI
     */
    showLobbyUI() {
        this.currentRoom = null;
        this.roomName = null;
        this.playerId = null;
        this.opponentId = null;
        this.isReady = false;
        this.isConfirmed = false;
        this.classicSettings = null;
        this.uiManager.showLobbyUI();
    }

    /**
     * 显示房间UI
     */
    showRoomUI(roomId, roomName, mode) {
        this.uiManager.showRoomUI(roomId, roomName, mode || this.roomMode);
        if (this.playerId) {
            this.updatePlayerSlot(this.playerId, true, false, this.playerId);
        }
        if (this.opponentId) {
            this.updatePlayerSlot(this.opponentId, true, false, this.playerId);
        }
        this.isReady = false;
        this.uiManager.updateReadyButton(false);
        this.setupPositionSwitching();
    }

    /**
     * 设置位置切换功能
     */
    setupPositionSwitching() {
        console.log('设置位置切换功能');
        this.uiManager.setupPositionSwitching(this);
    }

    /**
     * 切换位置
     */
    switchPosition(targetPosition) {
        console.log('切换位置被调用，目标位置:', targetPosition);
        const playerSlot1 = document.getElementById('playerSlot1');
        const playerSlot2 = document.getElementById('playerSlot2');
        if (!playerSlot1 || !playerSlot2) {
            console.log('玩家槽位未找到');
            return;
        }
        const slot1Occupied = playerSlot1.classList.contains('occupied');
        const slot2Occupied = playerSlot2.classList.contains('occupied');
        if ((slot1Occupied && !slot2Occupied) || (!slot1Occupied && slot2Occupied)) {
            if (targetPosition === 1 && !slot1Occupied) {
                this.socketClient.send(MessageTypes.SWITCH_POSITION, {
                    roomId: this.currentRoom,
                    targetPosition: 1
                });
            } else if (targetPosition === 2 && !slot2Occupied) {
                this.socketClient.send(MessageTypes.SWITCH_POSITION, {
                    roomId: this.currentRoom,
                    targetPosition: 2
                });
            }
        }
    }

    /**
     * 开始网络游戏
     */
    startNetworkGame(data) {
        document.getElementById('networkRoomContainer').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        startNetworkGameSession(data);
    }

    /**
     * 更新游戏状态
     */
    updateGameState(state) {
        if (gameEngine) {
            gameEngine.updateNetworkGameState(state);
        }
    }

    /**
     * 处理玩家操作
     */
    handlePlayerAction(data) {
        if (gameEngine) {
            gameEngine.handleNetworkPlayerAction(data);
        }
    }

    /**
     * 处理回合切换
     */
    handleTurnChange(data) {
        if (gameEngine) {
            gameEngine.handleNetworkTurnChange(data);
        }
    }

    /**
     * 处理棋子位置更新
     */
    handlePiecePositions(data) {
        if (gameEngine && data && data.pieces) {
            gameEngine.handleServerPiecePositions(
                data.pieces, data.walls,
                data.chaosProtectionActive, data.chaosProtectionRemaining,
                data.playerEnergy, data.playerEnergyProgress,
                data.items, data.itemEffects
            );
        }
    }

    /**
     * 处理动画开始
     */
    handleAnimationStart(data) {
        if (gameEngine) {
            gameEngine.handleServerAnimationStart(data);
        }
    }

    /**
     * 处理动画结束
     */
    handleAnimationEnd(data) {
        if (gameEngine) {
            gameEngine.handleServerAnimationEnd(data);
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.socketClient.disconnect();
        this.currentRoom = null;
        this.playerId = null;
        this.opponentId = null;
        this.isReady = false;
        this.roomList = [];
        this.onlinePlayers = 0;
        this.gameState = null;
    }

    /**
     * 断开socket并重连，然后显示大厅
     * 用于被动返回大厅时（如房主离开或断开）确保状态完全重置
     */
    disconnectAndReconnectForLobby() {
        // 清除所有网络相关状态
        this.currentRoom = null;
        this.playerId = null;
        this.opponentId = null;
        this.isReady = false;
        this.isConfirmed = false;
        this.classicSettings = null;
        this.roomMode = null;

        // 重置游戏引擎状态
        if (gameEngine) {
            gameEngine.init();
        }

        // 先断开socket连接
        this.disconnect();

        // 重新连接socket，确保状态完全重置
        this.socketClient.connect().then(() => {
            console.log('Socket重连成功，被动返回大厅');
            this.showLobbyUI();
        }).catch((error) => {
            console.error('Socket重连失败:', error);
            this.showLobbyUI();
        });
    }

    /**
     * 检查连接状态
     */
    isConnected() {
        return this.socketClient.getConnected();
    }

    /**
     * 发送重新开始请求
     */
    sendRestartRequest() {
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.RESTART_REQUEST, { roomId: this.currentRoom });
        }
    }

    /**
     * 接受重新开始请求
     */
    acceptRestartRequest() {
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.RESTART_ACCEPT, { roomId: this.currentRoom });
        }
    }

    /**
     * 拒绝重新开始请求
     */
    rejectRestartRequest() {
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.RESTART_REJECT, { roomId: this.currentRoom });
        }
    }

    /**
     * 更新房间棋子数量
     */
    updateRoomPieceCount(pieceCount) {
        if (this.isConnected() && this.currentRoom && this.playerId === 1) {
            this.socketClient.send(MessageTypes.UPDATE_ROOM_PIECE_COUNT, {
                roomId: this.currentRoom,
                pieceCount: pieceCount
            });
        }
    }

    /**
     * 确认联网经典模式设置
     */
    confirmNetworkClassicSettings(playerColor, playerSkinId = 'default', trailEffect = 'trail_white') {
        if (this.isConnected() && this.currentRoom) {
            if (this.isConfirmed) {
                console.log('已经确认过，无法取消');
                return;
            }
            this.playerSkinId = playerSkinId;
            this.playerTrailEffect = trailEffect;
            this.socketClient.send(MessageTypes.NETWORK_CLASSIC_CONFIRM, {
                roomId: this.currentRoom,
                playerColor: playerColor,
                playerSkinId: playerSkinId,
                trailEffect: trailEffect,
                confirmed: true
            });
        }
    }

    /**
     * 设置颜色选择是否可用
     */
    setColorSelectionEnabled(enabled) {
        const colorGrid = document.getElementById('networkPlayerColorGrid');
        if (colorGrid) {
            const colorOptions = colorGrid.querySelectorAll('.color-option');
            colorOptions.forEach(option => {
                if (enabled) {
                    option.style.pointerEvents = 'auto';
                    option.style.opacity = '1';
                } else {
                    option.style.pointerEvents = 'none';
                    if (!option.classList.contains('selected')) {
                        option.style.opacity = '0.5';
                    }
                }
            });
        }
    }

    // ==================== 重新开始处理 ====================

    handleRestartRequest(data) {
        console.log('处理重新开始请求:', data);
        if (this.uiManager.elements.winnerModal) {
            this.uiManager.elements.winnerModal.classList.remove('show');
        }
        this.uiManager.showRestartRequestModal();
    }

    handleRestartAccept(data) {
        this.uiManager.hideRestartWaitingModal();
    }

    handleRestartReject(data) {
        this.uiManager.hideRestartWaitingModal();
        this.uiManager.showErrorModal('对方玩家拒绝了重新开始请求');
    }

    handleRestartConfirm(data) {
        this.uiManager.hideRestartWaitingModal();
        this.uiManager.hideRestartRequestModal();
        if (this.uiManager.elements.winnerModal) {
            this.uiManager.elements.winnerModal.classList.remove('show');
        }
        if (this.uiManager.elements.errorModal) {
            this.uiManager.elements.errorModal.classList.remove('show');
        }
        this.isReady = false;
        this.isConfirmed = false;
        this.gameState = null;
        if (this.uiManager.elements.gameContainer) {
            this.uiManager.elements.gameContainer.style.display = 'none';
        }
    }

    /**
     * 处理游戏结束消息
     */
    handleGameEnd(data) {
        console.log('处理游戏结束消息:', data);
        if (data && data.winner !== undefined) {
            console.log('游戏结束，获胜者:', data.winner);

            const winnerText = document.getElementById('winnerText');
            console.log('winnerText 元素:', winnerText);
            if (winnerText) {
                const isWinner = data.winner === this.playerId;
                winnerText.textContent = isWinner ? '你赢了！' : '你输了！';
                console.log('设置获胜者文本:', isWinner ? '你赢了！' : '你输了！');
            }

            // 根据游戏模式更新按钮
            const playAgainBtn = document.getElementById('playAgainBtn');
            const backToLobbyBtn = document.getElementById('backToLobbyBtn');
            const isChaos4Mode = this.roomMode === 'chaos4';

            if (isChaos4Mode) {
                // 乱斗4人模式：只显示"返回大厅"，隐藏"再来一局"
                if (playAgainBtn) playAgainBtn.style.display = 'none';
                if (backToLobbyBtn) backToLobbyBtn.textContent = '返回大厅';
            } else {
                // 其他联网模式：显示"再来一局"和"返回大厅"
                if (playAgainBtn) {
                    playAgainBtn.style.display = '';
                    playAgainBtn.textContent = '再来一局';
                }
                if (backToLobbyBtn) backToLobbyBtn.textContent = '返回大厅';
            }

            const winnerModal = document.getElementById('winnerModal');
            console.log('winnerModal 元素:', winnerModal);
            if (winnerModal) {
                console.log('显示获胜弹窗');
                winnerModal.classList.add('show');
            } else {
                console.log('winnerModal 元素未找到');
            }
        } else {
            console.log('游戏结束消息数据不完整:', data);
        }
    }

    // ==================== 联网经典模式处理 ====================

    handleNetworkClassicPrepare(data) {
        console.log('处理联网经典模式准备消息:', data);
        this.uiManager.hideRestartWaitingModal();
        this.uiManager.hideRestartRequestModal();
        if (this.uiManager.elements.gameContainer) {
            this.uiManager.elements.gameContainer.style.display = 'none';
        }
        if (gameEngine) {
            gameEngine.gameStarted = false;
            gameEngine.gameOver = false;
            gameEngine.init(); // 完全重置游戏状态，避免残留上一局的数据导致闪烁
        }
        this.isReady = false;
        this.isConfirmed = false;
        this.uiManager.updateClassicConfirmButton(false);
        this.uiManager.setColorSelectionEnabled(true);
        this.uiManager.showNetworkClassicPrepare(data.mode, this.playerId);
    }

    handleNetworkClassicStart(data) {
        console.log('处理联网经典模式开始消息:', data);

        // 设置生成地形
        if (data.generateTerrain !== undefined) {
            window.generateTerrain = data.generateTerrain;
        }

        this.uiManager.hideNetworkClassicPrepare();
        if (gameEngine) {
            const modeKey = data.mode === 'classic' ? 'classic-network' : (data.mode === 'chaos' ? 'chaos-network' : (data.mode === 'chaos4' ? 'chaos4-network' : 'skill-network'));
            const selectedMode = modeManager.setCurrentMode(modeKey, {
                pieceCount: data.pieceCount || 3,
                player1Color: data.playerSettings && data.playerSettings[1] ? data.playerSettings[1].playerColor : GAME_CONFIG.playerColors.player1,
                player2Color: data.playerSettings && data.playerSettings[2] ? data.playerSettings[2].playerColor : GAME_CONFIG.playerColors.player2
            });
            if (selectedMode) {
                selectedMode.setNetworkData(data);
                gameEngine.setMode(selectedMode);

                // 强制重置乱斗模式状态，避免返回大厅后开新房间时残留状态导致闪烁
                gameEngine.chaosProtectionActive = false;
                gameEngine.chaosProtectionRemaining = 0;
                gameEngine.playerEnergy = { 1: 3, 2: 3, 3: 3, 4: 3 };
                gameEngine.playerEnergyProgress = { 1: 0, 2: 0, 3: 0, 4: 0 };
                gameEngine.updateChaosGlow();

                // 乱斗4人模式：先切换到4人画布再启动
                if (data.mode === 'chaos4') {
                    // 隐藏2人游戏容器
                    if (this.uiManager.elements.gameContainer) {
                        this.uiManager.elements.gameContainer.style.display = 'none';
                        this.uiManager.elements.gameContainer.classList.remove('active');
                    }
                    // 隐藏4人容器上的可能冲突样式，先清除
                    const chaos4Container = document.getElementById('chaos4GameContainer');
                    if (chaos4Container) {
                        // 清除可能存在的display:none样式
                        chaos4Container.style.display = '';
                        chaos4Container.classList.add('active');
                    }
                    // 先切换到4人画布
                    gameEngine.switchCanvas(GAME_CONFIG.chaos4CanvasId);
                    // 更新4人玩家颜色显示
                    for (let i = 1; i <= 4; i++) {
                        const color = data.playerSettings && data.playerSettings[i] ? data.playerSettings[i].playerColor : GAME_CONFIG.playerColors[`player${i}`];
                        const colorEl = document.getElementById(`chaos4Player${i}Color`);
                        if (colorEl) colorEl.style.backgroundColor = color;
                        const countEl = document.getElementById(`chaos4Player${i}Count`);
                        if (countEl) countEl.textContent = data.pieceCount || 3;
                        const nameEl = document.getElementById(`chaos4Player${i}Name`);
                        const playerName = this.playerUsernames[i] || `玩家${i}`;
                        if (nameEl) {
                            nameEl.textContent = i === this.playerId ? `${playerName}（你）` : playerName;
                        }
                    }
                    // 隐藏全局技能容器
                    const globalSkillsContainer = document.querySelector('.global-skills-container');
                    if (globalSkillsContainer) globalSkillsContainer.style.display = 'none';
                } else {
                    // 其他模式使用默认布局
                    if (this.uiManager.elements.gameContainer) {
                        this.uiManager.elements.gameContainer.style.display = '';
                        this.uiManager.elements.gameContainer.classList.add('active');
                    }
                    const chaos4Container = document.getElementById('chaos4GameContainer');
                    if (chaos4Container) {
                        chaos4Container.style.display = '';
                        chaos4Container.classList.remove('active');
                    }
                    gameEngine.switchCanvas('gameCanvas');
                    // 更新玩家颜色显示（仅经典和乱斗模式，技能模式每个玩家有多种颜色棋子）
                    if (window.gameUI && (data.mode === 'classic' || data.mode === 'chaos')) {
                        window.gameUI.updatePlayerColors(selectedMode.player1Color, selectedMode.player2Color);
                    }
                    const globalSkillsContainer = document.querySelector('.global-skills-container');
                    const useSkillButton = document.getElementById('useSkillButton');
                    if (data.mode === 'classic') {
                        if (globalSkillsContainer) globalSkillsContainer.style.display = 'none';
                        if (useSkillButton) useSkillButton.style.display = 'none';
                    } else {
                        if (globalSkillsContainer) globalSkillsContainer.style.display = 'flex';
                    }
                }

                // 在正确的画布上启动游戏
                gameEngine.start();

                if (data.currentPlayer !== undefined) {
                    gameEngine.currentPlayer = data.currentPlayer;
                }
                if (data.turnCount !== undefined) {
                    gameEngine.turnCount = data.turnCount;
                }
            }
        }
    }

    // ==================== 联网技能模式处理 ====================

    handleNetworkSkillPrepare(data) {
        console.log('========== handleNetworkSkillPrepare 被调用 ==========');
        this.uiManager.hideRestartWaitingModal();
        this.uiManager.hideRestartRequestModal();
        if (this.uiManager.elements.gameContainer) {
            this.uiManager.elements.gameContainer.style.display = 'none';
        }
        if (gameEngine) {
            gameEngine.gameStarted = false;
            gameEngine.gameOver = false;
        }
        this.isReady = false;
        this.showNetworkSkillPrepare(data.pieceCount, data.currentSelectingPlayer);
    }

    showNetworkSkillPrepare(pieceCount, currentSelectingPlayer) {
        console.log('显示联网技能模式准备界面:', pieceCount, currentSelectingPlayer);
        const networkRoomContainer = document.getElementById('networkRoomContainer');
        if (networkRoomContainer) {
            networkRoomContainer.style.display = 'none';
        }
        const skillSelectionContainer = document.getElementById('skillSelectionContainer');
        if (skillSelectionContainer) {
            skillSelectionContainer.style.display = 'flex';
        }
        if (window.skillSelectionUI) {
            skillSelectionUI.isNetworkMode = true;
            skillSelectionUI.setMaxSkillsPerPlayer(pieceCount);
            skillSelectionUI.resetForNetwork();
            const isMyTurn = (currentSelectingPlayer === this.playerId);
            skillSelectionUI.setSelectionEnabled(isMyTurn);
            skillSelectionUI.setNetworkPhase('skill');
            // 隐藏齿轮按钮（联网模式不需要设置）
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.style.display = 'none';
            }
        }
    }

    handleNetworkSkillTurn(data) {
        try {
            console.log('========== handleNetworkSkillTurn 被调用 ==========');
            if (window.skillSelectionUI) {
                if (data.player1Skills && data.player2Skills) {
                    skillSelectionUI.updateSelectedSkillsFromNetwork(data.player1Skills, data.player2Skills);
                }
                if (data.currentSelectingPlayer) {
                    skillSelectionUI.setCurrentPlayer(data.currentSelectingPlayer);
                }
                const isMyTurn = (data.currentSelectingPlayer === this.playerId);
                skillSelectionUI.setSelectionEnabled(isMyTurn);
                skillSelectionUI.setNetworkPhase(data.phase);
                if (data.phase === 'confirm') {
                    skillSelectionUI.updateConfirmStatus(data.player1Confirmed, data.player2Confirmed);
                }
            }
        } catch (error) {
            console.error('handleNetworkSkillTurn 执行错误:', error);
        }
    }

    handleNetworkSkillSelected(data) {
        console.log('========== handleNetworkSkillSelected 被调用 ==========');
        if (window.skillSelectionUI) {
            skillSelectionUI.updateSelectedSkillsFromNetwork(data.player1Skills, data.player2Skills);
            skillSelectionUI.setCurrentPlayer(data.currentSelectingPlayer);
            const isMyTurn = (data.currentSelectingPlayer === this.playerId);
            skillSelectionUI.setSelectionEnabled(isMyTurn);
        }
    }

    handleNetworkSkillGlobalSelected(data) {
        console.log('处理联网技能模式全局技能选择消息:', data);
        if (window.skillSelectionUI) {
            skillSelectionUI.updateGlobalSkillsFromNetwork(
                data.player1GlobalSkill,
                data.player2GlobalSkill,
                data.currentSelectingPlayer
            );
            if (data.currentSelectingPlayer === 0) {
                skillSelectionUI.setSelectionEnabled(false);
            } else {
                const isMyTurn = (data.currentSelectingPlayer === this.playerId);
                skillSelectionUI.setSelectionEnabled(isMyTurn);
            }
        }
    }

    handleNetworkSkillStart(data) {
        console.log('处理联网技能模式开始消息:', data);

        // 设置生成地形
        if (data.generateTerrain !== undefined) {
            window.generateTerrain = data.generateTerrain;
        }

        const skillSelectionContainer = document.getElementById('skillSelectionContainer');
        if (skillSelectionContainer) {
            skillSelectionContainer.style.display = 'none';
        }
        if (gameEngine) {
            const modeKey = 'skill-network';
            const selectedMode = modeManager.setCurrentMode(modeKey, {
                pieceCount: data.pieceCount || 3,
                player1Color: data.playerSettings && data.playerSettings[1] ? data.playerSettings[1].playerColor : GAME_CONFIG.playerColors.player1,
                player2Color: data.playerSettings && data.playerSettings[2] ? data.playerSettings[2].playerColor : GAME_CONFIG.playerColors.player2
            });
            if (selectedMode) {
                selectedMode.setNetworkData(data);
                gameEngine.setMode(selectedMode);
                gameEngine.start();
                if (data.currentPlayer !== undefined) {
                    gameEngine.currentPlayer = data.currentPlayer;
                }
                if (data.turnCount !== undefined) {
                    gameEngine.turnCount = data.turnCount;
                }
                if (this.uiManager.elements.gameContainer) {
                    this.uiManager.elements.gameContainer.style.display = 'flex';
                }
                // 技能模式不更新玩家颜色显示（每个玩家有多种颜色棋子）
                const globalSkillsContainer = document.querySelector('.global-skills-container');
                if (globalSkillsContainer) {
                    globalSkillsContainer.style.display = 'flex';
                }
            }
        }
    }

    /**
     * 发送技能选择消息
     */
    sendSkillSelect(skillId) {
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.NETWORK_SKILL_SELECT, {
                roomId: this.currentRoom,
                skillId: skillId
            });
        }
    }

    /**
     * 发送全局技能选择消息
     */
    sendGlobalSkillSelect(globalSkillId) {
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.NETWORK_SKILL_GLOBAL_SELECT, {
                roomId: this.currentRoom,
                globalSkillId: globalSkillId
            });
        }
    }

    /**
     * 发送技能选择确认消息
     */
    sendSkillConfirm() {
        if (this.isConnected() && this.currentRoom) {
            this.socketClient.send(MessageTypes.NETWORK_SKILL_CONFIRM, {
                roomId: this.currentRoom
            });
        }
    }

    /**
     * 再来一局
     */
    playAgain() {
        console.log('再来一局按钮被点击');
        if (this.uiManager.elements.winnerModal) {
            this.uiManager.elements.winnerModal.classList.remove('show');
        }
        this.socketClient.send(MessageTypes.RESTART_REQUEST, { roomId: this.currentRoom });
        this.uiManager.showRestartWaitingModal();
    }

    /**
     * 返回房间
     */
    backToRoom() {
        console.log('返回房间按钮被点击');
        if (this.uiManager.elements.winnerModal) {
            this.uiManager.elements.winnerModal.classList.remove('show');
        }
        this.socketClient.send(MessageTypes.BACK_TO_ROOM, { roomId: this.currentRoom });
        this.isReady = false;
        this.isConfirmed = false;
        this.classicSettings = null;
        
        // 重置游戏引擎状态，确保所有对局参数被清除
        if (gameEngine) {
            gameEngine.init();
        }

        this.showRoomUI(this.currentRoom, this.roomName);
    }

    /**
     * 返回大厅
     */
    backToLobby() {
        console.log('返回大厅按钮被点击');
        if (this.uiManager.elements.winnerModal) {
            this.uiManager.elements.winnerModal.classList.remove('show');
        }

        // 乱斗4人模式游戏结束后，玩家直接返回大厅，不发送BACK_TO_LOBBY消息
        // 避免触发"断开连接"或"房间销毁"的弹窗
        // 只有游戏真正结束后才跳过消息，游戏进行中仍需通知其他玩家
        const isChaos4Mode = this.roomMode === 'chaos4';
        const isGameTrulyOver = gameEngine && gameEngine.gameOver;
        const shouldSkipBackToLobby = isChaos4Mode && isGameTrulyOver;

        if (!shouldSkipBackToLobby) {
            this.socketClient.send(MessageTypes.BACK_TO_LOBBY, { roomId: this.currentRoom });
        }

        // 清除所有网络相关状态
        this.currentRoom = null;
        this.playerId = null;
        this.opponentId = null;
        this.isReady = false;
        this.isConfirmed = false;
        this.classicSettings = null;
        this.roomMode = null;

        // 重置游戏引擎状态，确保所有对局参数被清除
        if (gameEngine) {
            gameEngine.init();
        }

        // 先断开socket连接
        this.disconnect();

        // 重新连接socket，确保状态完全重置
        this.socketClient.connect().then(() => {
            console.log('Socket重连成功，返回大厅');
            this.showLobbyUI();
        }).catch((error) => {
            console.error('Socket重连失败:', error);
            this.showLobbyUI();
        });
    }

    /**
     * 发送游戏结果
     */
    sendGameResult(data) {
        console.log('发送游戏结果:', data);
        this.socketClient.send(MessageTypes.GAME_END, {
            roomId: this.currentRoom,
            winner: data.winner
        });
    }

    // ==================== 聊天消息处理 ====================

    /**
     * 发送聊天消息
     */
    sendChatMessage(text) {
        if (this.isConnected() && this.currentRoom && text && text.trim()) {
            this.socketClient.send(MessageTypes.CHAT_MESSAGE, {
                roomId: this.currentRoom,
                message: text.trim()
            });
        }
    }

    /**
     * 发送表情
     */
    sendEmoji(emoji) {
        if (this.isConnected() && this.currentRoom && emoji) {
            this.socketClient.send(MessageTypes.EMOJI, {
                roomId: this.currentRoom,
                emoji: emoji
            });
        }
    }

    /**
     * 处理接收到的聊天消息
     */
    handleChatMessage(data) {
        if (gameEngine && data.playerId !== undefined) {
            const isSelf = data.playerId === this.playerId;
            gameEngine.showChatBubble(data.playerId, data.message, false, isSelf);
        }
    }

    /**
     * 处理接收到的表情消息
     */
    handleEmoji(data) {
        if (gameEngine && data.playerId !== undefined) {
            const isSelf = data.playerId === this.playerId;
            gameEngine.showChatBubble(data.playerId, data.emoji, true, isSelf);
        }
    }

    /**
     * 处理道具生成
     */
    handleItemSpawned(data) {
        if (gameEngine && data.item) {
            gameEngine.handleItemSpawned(data.item);
        }
    }

    /**
     * 处理道具拾取
     */
    handleItemPickup(data) {
        if (gameEngine) {
            gameEngine.handleItemPickup(data);
        }
    }

    /**
     * 处理道具消失（15秒未拾取）
     */
    handleItemDespawned(data) {
        if (gameEngine) {
            gameEngine.handleItemDespawned(data);
        }
    }

    /**
     * 处理棋子被冻结
     */
    handlePieceFrozen(data) {
        if (gameEngine) {
            gameEngine.handlePieceFrozen(data);
        }
    }

    /**
     * 处理棋子被删除（我命由天）
     */
    handlePieceDeleted(data) {
        if (gameEngine) {
            gameEngine.handlePieceDeleted(data);
        }
    }
}

// 导出单例实例
const networkManager = new NetworkManager();

if (typeof window !== 'undefined') {
    window.networkManager = networkManager;
}
