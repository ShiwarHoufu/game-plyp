class UIManager {
    constructor() {
        this.init();
    }
    
    init() {
        // 初始化UI元素引用
        this.elements = {
            statusText: document.getElementById('statusText'),
            roomList: document.getElementById('roomList'),
            playerSlot1: document.getElementById('playerSlot1'),
            playerSlot2: document.getElementById('playerSlot2'),
            player4Slot1: document.getElementById('player4Slot1'),
            player4Slot2: document.getElementById('player4Slot2'),
            player4Slot3: document.getElementById('player4Slot3'),
            player4Slot4: document.getElementById('player4Slot4'),
            readyButton: document.getElementById('readyButton'),
            currentRoomId: document.getElementById('currentRoomId'),
            pieceCountSetting: document.getElementById('pieceCountSetting'),
            roomPieceCount: document.getElementById('roomPieceCount'),
            menuContainer: document.getElementById('menuContainer'),
            networkLobbyContainer: document.getElementById('networkLobbyContainer'),
            networkRoomContainer: document.getElementById('networkRoomContainer'),
            gameContainer: document.getElementById('gameContainer'),
            classicPieceCount: document.getElementById('classicPieceCount'),
            networkModeSelectModal: document.getElementById('networkModeSelectModal'),
            colorSelectModal: document.getElementById('colorSelectModal'),
            winnerModal: document.getElementById('winnerModal'),
            errorModal: document.getElementById('errorModal'),
            errorMessage: document.getElementById('errorMessage'),
            restartRequestModal: document.getElementById('restartRequestModal'),
            restartWaitingModal: document.getElementById('restartWaitingModal'),
            networkClassicConfirmBtn: document.getElementById('networkClassicConfirmBtn'),
            networkPlayerColorGrid: document.getElementById('networkPlayerColorGrid'),
            unifiedSkinGrid: document.getElementById('unifiedSkinGrid'),
            networkClassicPrepareContainer: document.getElementById('networkClassicPrepareContainer')
        };
    }
    
    // 更新连接状态
    updateConnectionStatus(connected) {
        if (this.elements.statusText) {
            if (connected) {
                this.elements.statusText.textContent = '已连接';
                this.elements.statusText.classList.add('connected');
            } else {
                this.elements.statusText.textContent = '未连接';
                this.elements.statusText.classList.remove('connected');
            }
        }
    }
    
    // 更新房间列表
    updateRoomList(rooms) {
        if (this.elements.roomList) {
            if (rooms.length === 0) {
                this.elements.roomList.innerHTML = '<p class="no-rooms">暂无可用房间</p>';
            } else {
                this.elements.roomList.innerHTML = rooms.map(room => {
                    let modeText;
                    if (room.mode === 'classic') {
                        modeText = `经典：${room.pieceCount}子`;
                    } else if (room.mode === 'chaos') {
                        modeText = `乱斗（2人）：${room.pieceCount}子`;
                    } else if (room.mode === 'chaos4') {
                        modeText = `乱斗（4人）：${room.pieceCount}子`;
                    } else {
                        modeText = `技能模式：${room.pieceCount}子`;
                    }
                    const terrainText = room.generateTerrain ? '生成地形：开' : '生成地形：关';
                    return `
                        <div class="room-item">
                            <div class="room-info">
                                <div class="room-name">${room.name || room.id}</div>
                                <div class="room-players">${room.players}/${room.maxPlayers} 人</div>
                                <div class="room-mode">${modeText}</div>
                                <div class="room-terrain">${terrainText}</div>
                            </div>
                            <button class="join-room-item-btn" onclick="networkManager.joinRoom('${room.id}')">加入</button>
                        </div>
                    `;
                }).join('');
            }
        }
    }
    
    // 更新玩家槽位
    updatePlayerSlot(playerId, occupied, ready, currentPlayerId, username) {
        // 根据当前房间模式选择正确的slot元素
        let slot;
        if (this.currentRoomMode === 'chaos4') {
            slot = this.elements[`player4Slot${playerId}`];
        } else {
            slot = this.elements[`playerSlot${playerId}`];
        }

        if (slot) {
            // 显示玩家名称
            const playerLabel = username || `玩家${playerId}`;

            if (occupied) {
                slot.classList.add('occupied');
                if (ready) {
                    slot.classList.add('ready');
                    slot.innerHTML = `<span class="slot-status ready">${playerLabel} - 已准备</span>`;
                } else {
                    slot.classList.remove('ready');
                    slot.innerHTML = `<span class="slot-status occupied">${playerLabel} - 等待中</span>`;
                }
            } else {
                slot.classList.remove('occupied', 'ready');
                slot.innerHTML = `<span class="slot-status">等待中...</span>`;
            }
        }
    }
    
    // 显示大厅UI
    showLobbyUI() {
        // 重置当前房间模式
        this.currentRoomMode = null;

        // 隐藏所有相关容器
        if (this.elements.menuContainer) this.elements.menuContainer.style.display = 'none';
        if (this.elements.networkLobbyContainer) this.elements.networkLobbyContainer.style.display = 'flex';
        if (this.elements.networkRoomContainer) this.elements.networkRoomContainer.style.display = 'none';
        if (this.elements.gameContainer) this.elements.gameContainer.style.display = 'none';
        // 隐藏乱斗4人游戏容器
        const chaos4GameContainer = document.getElementById('chaos4GameContainer');
        if (chaos4GameContainer) {
            chaos4GameContainer.style.display = 'none';
            chaos4GameContainer.classList.remove('active');
        }
        if (this.elements.networkClassicPrepareContainer) this.elements.networkClassicPrepareContainer.style.display = 'none';
        const skillSelectionContainer = document.getElementById('skillSelectionContainer');
        if (skillSelectionContainer) skillSelectionContainer.style.display = 'none';
        
        // 重置玩家槽位状态
        this.updatePlayerSlot(1, false, false);
        this.updatePlayerSlot(2, false, false);
        this.updatePlayerSlot(3, false, false);
        this.updatePlayerSlot(4, false, false);
        
        // 重置经典模式棋子数量选择为默认值
        if (this.elements.classicPieceCount) {
            this.elements.classicPieceCount.value = '3';
        }
        
        // 重置准备按钮状态
        if (this.elements.readyButton) {
            this.elements.readyButton.textContent = '准备';
            this.elements.readyButton.classList.remove('ready');
        }
        
        // 重置网络模式选择模态框
        if (this.elements.networkModeSelectModal) {
            this.elements.networkModeSelectModal.classList.remove('show');
        }
        
        // 重置颜色选择（如果有）
        if (this.elements.colorSelectModal) {
            this.elements.colorSelectModal.classList.remove('show');
        }
    }
    
    // 显示房间UI
    showRoomUI(roomId, roomName, mode) {
        // 记录当前房间模式
        this.currentRoomMode = mode;

        if (this.elements.menuContainer) this.elements.menuContainer.style.display = 'none';
        if (this.elements.networkLobbyContainer) this.elements.networkLobbyContainer.style.display = 'none';
        if (this.elements.networkRoomContainer) this.elements.networkRoomContainer.style.display = 'flex';
        if (this.elements.gameContainer) this.elements.gameContainer.style.display = 'none';

        // 更新房间名称显示
        const currentRoomNameEl = document.getElementById('currentRoomName');
        if (currentRoomNameEl) {
            currentRoomNameEl.textContent = roomName || roomId;
        }
        // 更新房间ID显示
        if (this.elements.currentRoomId) {
            this.elements.currentRoomId.textContent = roomId;
        }

        // 所有玩家都可以设置棋子数量
        if (this.elements.pieceCountSetting) {
            this.elements.pieceCountSetting.style.display = 'block';
            if (this.elements.roomPieceCount) {
                this.elements.roomPieceCount.disabled = false;
            }
        }

        // 乱斗4人模式：显示4人布局，隐藏2人布局
        const playerSlots2P = document.getElementById('playerSlots2P');
        const playerSlots4P = document.getElementById('playerSlots4P');
        if (mode === 'chaos4') {
            if (playerSlots2P) playerSlots2P.style.display = 'none';
            if (playerSlots4P) playerSlots4P.style.display = 'grid';
            // 乱斗模式隐藏先手位/后手位标签（4人模式使用玩家序号）
        } else {
            if (playerSlots2P) playerSlots2P.style.display = 'flex';
            if (playerSlots4P) playerSlots4P.style.display = 'none';
            // 乱斗2人模式隐藏先手位/后手位标签
            const slotLabels = document.querySelectorAll('.slot-label');
            const isChaosMode = mode === 'chaos';
            slotLabels.forEach(label => {
                label.style.display = isChaosMode ? 'none' : 'block';
            });
        }

        // 重置玩家槽位
        this.updatePlayerSlot(1, false, false);
        this.updatePlayerSlot(2, false, false);
        if (mode === 'chaos4') {
            this.updatePlayerSlot(3, false, false);
            this.updatePlayerSlot(4, false, false);
        }

        // 重置准备状态
        if (this.elements.readyButton) {
            this.elements.readyButton.textContent = '准备';
            this.elements.readyButton.classList.remove('ready');
        }
    }
    
    // 设置位置切换功能
    setupPositionSwitching(networkManager) {
        // 为玩家槽位添加点击事件
        if (this.elements.playerSlot1) {
            // 清除所有现有的点击事件监听器
            this.elements.playerSlot1.onclick = null;
            // 添加新的点击事件监听器
            this.elements.playerSlot1.onclick = function() {
                networkManager.switchPosition(1);
            };
        }

        if (this.elements.playerSlot2) {
            // 清除所有现有的点击事件监听器
            this.elements.playerSlot2.onclick = null;
            // 添加新的点击事件监听器
            this.elements.playerSlot2.onclick = function() {
                networkManager.switchPosition(2);
            };
        }
    }
    
    // 显示错误弹窗
    showErrorModal(message) {
        if (this.elements.errorModal && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorModal.classList.add('show');
        }
    }
    
    // 隐藏错误弹窗
    hideErrorModal() {
        if (this.elements.errorModal) {
            this.elements.errorModal.classList.remove('show');
        }
    }
    
    // 显示重新开始请求弹窗
    showRestartRequestModal() {
        if (this.elements.restartRequestModal) {
            this.elements.restartRequestModal.classList.add('show');
        }
    }
    
    // 隐藏重新开始请求弹窗
    hideRestartRequestModal() {
        if (this.elements.restartRequestModal) {
            this.elements.restartRequestModal.classList.remove('show');
        }
    }
    
    // 显示重新开始等待弹窗
    showRestartWaitingModal() {
        if (this.elements.restartWaitingModal) {
            this.elements.restartWaitingModal.classList.add('show');
        }
    }
    
    // 隐藏重新开始等待弹窗
    hideRestartWaitingModal() {
        if (this.elements.restartWaitingModal) {
            this.elements.restartWaitingModal.classList.remove('show');
        }
    }

    // 显示联网经典模式准备界面
    showNetworkClassicPrepare(mode, localPlayerId) {
        if (this.elements.networkClassicPrepareContainer) {
            this.elements.networkClassicPrepareContainer.style.display = 'flex';
        }
        // 隐藏房间界面
        if (this.elements.networkRoomContainer) {
            this.elements.networkRoomContainer.style.display = 'none';
        }

        // 加载并显示皮肤选择
        refreshUnifiedSkinSelection();
    }

    // 更新4人乱斗模式中玩家的颜色选择状态
    updateChaos4PlayerColor(playerId, color, confirmed) {
        // 4人乱斗模式现在也使用统一的皮肤选择界面，此方法暂时保留但不再需要
    }

    // 隐藏联网经典模式准备界面
    hideNetworkClassicPrepare() {
        if (this.elements.networkClassicPrepareContainer) {
            this.elements.networkClassicPrepareContainer.style.display = 'none';
        }
    }

    // 设置颜色选择是否可用
    setColorSelectionEnabled(enabled) {
        if (this.elements.unifiedSkinGrid) {
            const colorOptions = this.elements.unifiedSkinGrid.querySelectorAll('.unified-skin-option');
            colorOptions.forEach(option => {
                if (enabled) {
                    option.style.pointerEvents = 'auto';
                    option.style.opacity = '1';
                } else {
                    option.style.pointerEvents = 'none';
                    // 保持选中项的透明度，其他项降低透明度
                    if (!option.classList.contains('selected')) {
                        option.style.opacity = '0.5';
                    }
                }
            });
        }
    }

    // 更新准备按钮状态
    updateReadyButton(ready) {
        if (this.elements.readyButton) {
            if (ready) {
                this.elements.readyButton.textContent = '取消准备';
                this.elements.readyButton.classList.add('ready');
            } else {
                this.elements.readyButton.textContent = '准备';
                this.elements.readyButton.classList.remove('ready');
            }
        }
    }
    
    // 更新经典模式确认按钮状态
    updateClassicConfirmButton(confirmed) {
        if (this.elements.networkClassicConfirmBtn) {
            if (confirmed) {
                this.elements.networkClassicConfirmBtn.textContent = '已确认';
                this.elements.networkClassicConfirmBtn.classList.add('confirmed');
                this.elements.networkClassicConfirmBtn.disabled = true;
            } else {
                this.elements.networkClassicConfirmBtn.textContent = '确认';
                this.elements.networkClassicConfirmBtn.classList.remove('confirmed');
                this.elements.networkClassicConfirmBtn.disabled = false;
            }
        }
    }
}

// 导出单例实例
const uiManager = new UIManager();

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.uiManager = uiManager;
}
