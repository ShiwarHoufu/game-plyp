/**
 * 房间相关网络事件处理
 */
class RoomHandler {
    constructor(networkManager) {
        this.networkManager = networkManager;
    }

    /**
     * 关闭所有游戏模态框
     */
    closeAllGameModals() {
        const modals = document.querySelectorAll('.winner-modal, .error-modal, .confirm-modal, .restart-modal');
        modals.forEach(modal => modal.classList.remove('show'));
    }

    /**
     * 关闭获胜弹窗
     */
    hideWinnerModal() {
        const winnerModal = document.getElementById('winnerModal');
        if (winnerModal) winnerModal.classList.remove('show');
    }

    /**
     * 注册房间相关事件
     */
    registerEvents() {
        const sc = this.networkManager.socketClient;

        sc.on('roomCreated', (data) => {
            console.log('房间创建成功:', data);
            this.networkManager.currentRoom = data.roomId;
            this.networkManager.roomName = data.roomName || data.roomId;
            this.networkManager.playerId = 1;
            this.networkManager.roomMode = data.mode;
            // 存储本地玩家用户名
            const localUsername = window.authUI && window.authUI.currentUser ? window.authUI.currentUser.username : '玩家1';
            this.networkManager.playerUsernames[1] = localUsername;
            this.networkManager.showRoomUI(data.roomId, this.networkManager.roomName, data.mode);
            // 显示玩家在自己的槽位
            this.networkManager.updatePlayerSlot(1, true, false, this.networkManager.playerId, localUsername);
            if (data.pieceCount) {
                const pieceCountSelect = document.getElementById('roomPieceCount');
                if (pieceCountSelect) {
                    pieceCountSelect.value = data.pieceCount;
                }
            }
        });

        sc.on('roomJoined', (data) => {
            console.log('========== roomJoined 被调用 ==========');
            console.log('收到的数据:', data);
            this.networkManager.currentRoom = data.roomId;
            const roomInfo = this.networkManager.roomList.find(r => r.id === data.roomId);
            this.networkManager.roomName = roomInfo ? roomInfo.name : data.roomId;
            this.networkManager.playerId = data.playerId;
            this.networkManager.opponentId = data.opponentId;
            this.networkManager.roomMode = data.mode;
            // 存储本地玩家用户名
            const localUsername = window.authUI && window.authUI.currentUser ? window.authUI.currentUser.username : '玩家';
            this.networkManager.playerUsernames[data.playerId] = localUsername;
            this.networkManager.showRoomUI(data.roomId, this.networkManager.roomName, data.mode);
            // 显示当前玩家在自己的槽位
            this.networkManager.updatePlayerSlot(data.playerId, true, false, this.networkManager.playerId, localUsername);
            if (data.pieceCount) {
                const pieceCountSelect = document.getElementById('roomPieceCount');
                if (pieceCountSelect) {
                    pieceCountSelect.value = data.pieceCount;
                }
            }
        });

        sc.on('roomLeaved', (data) => {
            console.log('房间离开成功:', data);
            if (data.isSelf) {
                this.hideWinnerModal();
                hideRestartWaitingModal();
                this.closeAllGameModals();
                this.networkManager.currentRoom = null;
                this.networkManager.playerId = null;
                this.networkManager.opponentId = null;
                this.networkManager.isReady = false;
                this.networkManager.playerUsernames = {};
                this.networkManager.showLobbyUI();
            }

            if (!data.isSelf) {
                console.log('对方玩家已离开，房间已销毁:', data.message);
                this.networkManager.disconnectAndReconnectForLobby();
                this.showError(data.message || '对方玩家已离开，房间已销毁');
            }

            if (data.isRestartRejected) {
                console.log('再来一局被拒绝，返回大厅:', data.message);
                hideRestartWaitingModal();
                this.hideWinnerModal();
                this.closeAllGameModals();
                this.showError(data.message || '对方玩家拒绝了再来一局请求');
            }

            if (data.isBackToRoom) {
                console.log('玩家返回房间:', data.message);
                this.hideWinnerModal();
                this.closeAllGameModals();
                if (window.gameEngine) {
                    window.gameEngine.gameOver = false;
                }
                if (data.playerId) this.networkManager.playerId = data.playerId;
                if (data.opponentId) this.networkManager.opponentId = data.opponentId;
                if (data.roomName) this.networkManager.roomName = data.roomName;
                this.networkManager.isReady = false;
                this.networkManager.isConfirmed = false;
                this.networkManager.classicSettings = null;
                this.networkManager.showRoomUI(this.networkManager.currentRoom, this.networkManager.roomName);
            }
        });

        sc.on('hostLeft', (data) => {
            console.log('收到hostLeft事件（仅chaos4模式）:', data);
            // 在chaos4模式中，这表示有玩家返回大厅，房间可能已销毁或继续
            // 统一处理：断开重连回大厅
            this.networkManager.disconnectAndReconnectForLobby();
            this.showError(data.message || '有玩家已返回大厅，房间已销毁');
        });

        // 重新开始请求被拒绝（游戏进行中的情况）
        sc.on('RESTART_REJECT', (data) => {
            console.log('重新开始请求被拒绝:', data);
            // 关闭等待弹窗（全局函数）
            hideRestartWaitingModal();
            // 显示错误信息
            this.showError('对方玩家拒绝了重新开始请求');
        });

        sc.on('roomList', (data) => {
            this.networkManager.roomList = data.rooms;
            this.networkManager.updateRoomList();
        });

        sc.on('roomUpdate', (data) => {
            console.log('房间更新:', data);
            if (data.pieceCount) {
                const pieceCountSelect = document.getElementById('roomPieceCount');
                if (pieceCountSelect) {
                    pieceCountSelect.value = data.pieceCount;
                }
            }
        });

        sc.on('playerJoined', (data) => {
            console.log('玩家加入:', data);
            // 存储对手用户名
            if (data.username) {
                this.networkManager.playerUsernames[data.playerId] = data.username;
            }
            this.networkManager.updatePlayerSlot(data.playerId, true, false, this.networkManager.playerId, data.username);
        });

        sc.on('playerLeft', (data) => {
            console.log('玩家离开:', data);
            // 清除离开玩家的用户名
            delete this.networkManager.playerUsernames[data.playerId];
            this.networkManager.updatePlayerSlot(data.playerId, false, false, this.networkManager.playerId);
            this.hideWinnerModal();

            // 检查是否在游戏中、颜色选择阶段或技能选择阶段
            const gameContainer = document.getElementById('gameContainer');
            const chaos4GameContainer = document.getElementById('chaos4GameContainer');
            const networkClassicPrepareContainer = document.getElementById('networkClassicPrepareContainer');
            const skillSelectionContainer = document.getElementById('skillSelectionContainer');
            const isInGame = (gameContainer && gameContainer.style.display !== 'none') ||
                            (chaos4GameContainer && (chaos4GameContainer.style.display !== 'none' || chaos4GameContainer.classList.contains('active')));
            const isInColorSelection = networkClassicPrepareContainer && networkClassicPrepareContainer.style.display !== 'none';
            const isInSkillSelection = skillSelectionContainer && skillSelectionContainer.style.display !== 'none';
            const isChaos4Mode = this.networkManager.roomMode === 'chaos4';

            if (isInGame || isInColorSelection || isInSkillSelection) {
                if (networkClassicPrepareContainer) {
                    networkClassicPrepareContainer.style.display = 'none';
                }
                if (skillSelectionContainer) {
                    skillSelectionContainer.style.display = 'none';
                }
                // 显示断开连接的玩家名称
                const playerName = data.username || `玩家${data.playerId}`;
                showDisconnectModal(`${playerName}断开连接！`);
            }
        });

        sc.on('playerReady', (data) => {
            console.log('玩家准备:', data);
            // 存储玩家用户名
            if (data.username) {
                this.networkManager.playerUsernames[data.playerId] = data.username;
            }
            this.networkManager.updatePlayerSlot(data.playerId, true, data.ready, this.networkManager.playerId, data.username);
            // 更新4人乱斗模式的颜色选择状态
            if (this.networkManager.roomMode === 'chaos4' && data.playerColor) {
                this.networkManager.uiManager.updateChaos4PlayerColor(data.playerId, data.playerColor, data.ready);
            }
            if (data.playerId === this.networkManager.playerId) {
                this.networkManager.isReady = data.ready;
                this.networkManager.uiManager.updateReadyButton(this.networkManager.isReady);
            }
        });
    }

    showError(message) {
        const errorModal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');
        if (errorModal && errorMessage) {
            errorMessage.textContent = message;
            errorModal.classList.add('show');
        }
    }
}
