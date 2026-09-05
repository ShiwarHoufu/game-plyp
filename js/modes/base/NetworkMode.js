class NetworkMode extends BaseMode {
    constructor(options = {}) {
        super(options);
        this.isNetworkMode = true;
        this.networkData = null;
        this.localMode = null;
    }

    setNetworkData(data) {
        this.networkData = data;
    }

    setLocalMode(localMode) {
        this.localMode = localMode;
    }

    init(engine) {
        // 检查是否有服务器发送的初始棋子数据
        if (this.networkData && this.networkData.initialPieces) {
            // 使用服务器发送的初始棋子数据
            console.log('[NetworkMode] 使用服务器发送的初始棋子数据, initialPieces:', this.networkData.initialPieces);
            engine.pieces = [];

            for (let pieceData of this.networkData.initialPieces) {
                console.log('[NetworkMode] 创建棋子:', pieceData.id, 'x:', pieceData.x, 'y:', pieceData.y, 'player:', pieceData.player, 'color:', pieceData.color, 'skinId:', pieceData.skinId);
                const piece = new Piece(
                    pieceData.x,
                    pieceData.y,
                    pieceData.color,
                    pieceData.player,
                    pieceData.id,
                    pieceData.skinId || 'default'
                );
                piece.vx = pieceData.vx || 0;
                piece.vy = pieceData.vy || 0;
                piece.radius = pieceData.radius || GAME_CONFIG.pieceRadius;
                piece.isActive = pieceData.isActive !== undefined ? pieceData.isActive : true;
                piece.isIntangible = pieceData.isIntangible || false;
                piece.skillActive = pieceData.skillActive || false;
                piece.skill = pieceData.skill || null;
                piece.mass = pieceData.mass || 1;
                piece.isClone = pieceData.isClone || false;
                piece.clonePlaced = pieceData.clonePlaced || false;

                // 加载皮肤图片
                const skinConfig = GAME_CONFIG.skins.piece[piece.skinId];
                if (skinConfig && skinConfig.renderType === 'image' && skinConfig.imagePath) {
                    piece.loadSkinImage(skinConfig.imagePath);
                }

                engine.pieces.push(piece);
            }

            // 重建 clonePiece 引用
            for (let piece of engine.pieces) {
                if (piece.clonePlaced) {
                    const cloneId = piece.id + '_clone';
                    piece.clonePiece = engine.pieces.find(p => p.id === cloneId);
                }
            }

            // 同步初始墙壁（地形）
            if (this.networkData.walls) {
                engine.terrain = this.networkData.walls;
                console.log('[NetworkMode] 同步初始墙壁, 共', engine.terrain.length, '个');
            }

            console.log('[NetworkMode] 所有棋子创建完成, 共', engine.pieces.length, '颗');
            engine.updateUI();
            document.getElementById('winnerModal').classList.remove('show');
        } else if (this.localMode) {
            // 调用本地模式的初始化（备用）
            console.log('[NetworkMode] 使用本地模式初始化（无服务器数据）');
            this.localMode.init(engine);
        }

        // 网络模式特有的初始化
        this.setupNetworkSync();
    }
    
    checkWinner(engine) {
        if (this.localMode) {
            const result = this.localMode.checkWinner(engine);
            if (result) {
                // 发送获胜信息到服务器
                if (window.networkManager) {
                    window.networkManager.sendGameResult({ winner: engine.currentPlayer });
                }
            }
            return result;
        }
        return false;
    }
    
    setupNetworkSync() {
        // 网络同步逻辑由子类实现
    }
    
    getModeName() {
        return '联网对战';
    }
    
    getRules() {
        return '通过网络与其他玩家对战';
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.NetworkMode = NetworkMode;
}
