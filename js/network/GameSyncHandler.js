/**
 * 游戏同步相关网络事件处理
 */
class GameSyncHandler {
    constructor(networkManager) {
        this.networkManager = networkManager;
        this.lastCollisionTime = 0;  // 上次碰撞音效播放时间
        this.collisionCooldown = 150;  // 碰撞音效冷却时间（毫秒）
    }

    /**
     * 注册游戏同步相关事件
     */
    registerEvents() {
        const sc = this.networkManager.socketClient;

        sc.on('gameStart', (data) => {
            this.networkManager.startNetworkGame(data);
        });

        sc.on('gameState', (data) => {
            this.networkManager.gameState = data;
            this.networkManager.updateGameState(data);
        });

        sc.on('stateSync', (data) => {
            if (gameEngine && data && data.state) {
                gameEngine.applyStateSync(data.state);
            }
        });

        sc.on('playerAction', (data) => {
            this.networkManager.handlePlayerAction(data);
        });

        sc.on('turnChange', (data) => {
            this.networkManager.handleTurnChange(data);
        });

        sc.on('skillResetNotify', () => {
            if (gameEngine && !gameEngine.gameOver) {
                // 重置全局技能使用次数，允许再次使用
                if (gameEngine.mode) {
                    gameEngine.mode.player1GlobalSkillUsed = false;
                    gameEngine.mode.player2GlobalSkillUsed = false;
                    gameEngine.updateGlobalSkillButton();
                }
                gameEngine.showTemporaryMessage('技能使用次数已重置！', 2000, '#00ff00');
            }
        });

        sc.on('piece_positions', (data) => {
            this.networkManager.handlePiecePositions(data);
        });

        sc.on('collision', (data) => {
            // 播放碰撞音效（带冷却机制，避免同一碰撞重复播放）
            const now = Date.now();
            if (now - this.lastCollisionTime >= this.collisionCooldown) {
                this.lastCollisionTime = now;
                if (gameEngine && gameEngine.playCollisionSound) {
                    gameEngine.playCollisionSound(data.speed);
                }
            }
            
            // 生成碰撞粒子特效
            if (gameEngine && gameEngine.particleSystem && data.pieceId1 && data.pieceId2) {
                // 查找两个碰撞的棋子
                const p1 = gameEngine.pieces.find(p => p.id === data.pieceId1);
                const p2 = gameEngine.pieces.find(p => p.id === data.pieceId2);
                
                if (p1 && p2) {
                    // 计算碰撞位置（两个棋子的中间点）
                    const collisionX = (p1.x + p2.x) / 2;
                    const collisionY = (p1.y + p2.y) / 2;
                    // 使用两个棋子颜色的混合色
                    const color1 = p1.color || '#ff4757';
                    const color2 = p2.color || '#3742fa';
                    // 简单的颜色混合（取两个颜色的平均值）
                    const color = gameEngine.blendColors(color1, color2);
                    // 生成粒子特效
                    gameEngine.particleSystem.createCollisionParticles(collisionX, collisionY, color, data.speed);
                }
            }
        });

        sc.on('animation_start', (data) => {
            this.networkManager.handleAnimationStart(data);
        });

        sc.on('animation_end', (data) => {
            this.networkManager.handleAnimationEnd(data);
        });

        sc.on('restart_request', (data) => {
            this.networkManager.handleRestartRequest(data);
        });

        sc.on('restart_accept', (data) => {
            this.networkManager.handleRestartAccept(data);
        });

        sc.on('restart_reject', (data) => {
            this.networkManager.handleRestartReject(data);
        });

        sc.on('restart_confirm', (data) => {
            this.networkManager.handleRestartConfirm(data);
        });

        sc.on('game_end', (data) => {
            if (this.networkManager && this.networkManager.handleGameEnd) {
                this.networkManager.handleGameEnd(data);
            }
        });
    }
}
