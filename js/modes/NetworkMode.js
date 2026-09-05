class NetworkMode {
    constructor() {
        this.player1Skills = [];
        this.player2Skills = [];
        this.player1GlobalSkill = null;
        this.player2GlobalSkill = null;
        this.currentSelectingPlayer = 1;
        this.selectedSkills = { 1: [], 2: [] };
        this.maxSkillsPerPlayer = 3;
        this.globalSkillActive = false;
        this.globalSkillTurnsRemaining = 0;
        this.globalSkillType = null;
        this.player1GlobalSkillUsed = false;
        this.player2GlobalSkillUsed = false;
        this.pieceCount = 3; // 默认3颗棋子
        this.isNetworkMode = true;
        this.networkData = null;
    }

    setPieceCount(count) {
        this.pieceCount = count;
        this.maxSkillsPerPlayer = count;
    }

    init(engine) {
        this.engine = engine;
        this.boardWidth = engine.canvas.width;
        this.boardHeight = engine.canvas.height;

        // 重置全局技能使用计数
        this.player1GlobalSkillUsed = false;
        this.player2GlobalSkillUsed = false;
        this.globalSkillActive = false;
        this.globalSkillTurnsRemaining = 0;
        this.globalSkillType = null;

        // 确定游戏模式
        const gameMode = this.networkData && this.networkData.mode ? this.networkData.mode : 'classic';
        console.log('网络模式游戏类型:', gameMode);

        // 获取棋子数量和颜色设置
        let pieceCount = this.pieceCount;
        let color1 = GAME_CONFIG.playerColors.player1;
        let color2 = GAME_CONFIG.playerColors.player2;

        // 从网络数据中获取玩家设置
        if (this.networkData && this.networkData.playerSettings) {
            const settings = this.networkData.playerSettings;
            if (settings[1]) {
                pieceCount = settings[1].pieceCount || pieceCount;
                color1 = settings[1].playerColor || color1;
            }
            if (settings[2]) {
                color2 = settings[2].playerColor || color2;
            }
            console.log('从网络数据获取设置:', { pieceCount, color1, color2 });
        }

        // 更新棋子数量
        this.setPieceCount(pieceCount);

        // 使用PositionCalculator计算棋子位置
        const positions = PositionCalculator.calculatePositions(this.boardWidth, this.boardHeight, pieceCount, gameMode);

        // 清空现有棋子
        engine.pieces = [];

        // 根据游戏模式创建棋子
        for (let i = 0; i < pieceCount; i++) {
            let currentColor1 = color1;
            let currentColor2 = color2;
            
            if (gameMode === 'skill') {
                // 技能模式：使用技能颜色
                const skill1 = this.selectedSkills[1][i];
                const skill2 = this.selectedSkills[2][i];
                currentColor1 = skill1 ? skill1.color : color1;
                currentColor2 = skill2 ? skill2.color : color2;
            }
            
            const piece1 = new Piece(positions.player1[i].x, positions.player1[i].y, currentColor1, 1, `player1_piece_${i}`);
            const piece2 = new Piece(positions.player2[i].x, positions.player2[i].y, currentColor2, 2, `player2_piece_${i}`);
            
            // 只有技能模式才添加技能
            if (gameMode === 'skill') {
                const skill1 = this.selectedSkills[1][i];
                const skill2 = this.selectedSkills[2][i];
                
                if (skill1) {
                    piece1.skill = skill1;
                    piece1.skillUsed = false;
                    piece1.skillActive = false;
                }
                
                if (skill2) {
                    piece2.skill = skill2;
                    piece2.skillUsed = false;
                    piece2.skillActive = false;
                }
            }
            
            engine.pieces.push(piece1);
            engine.pieces.push(piece2);
        }

        // 如果是网络模式，设置网络相关数据
        if (this.networkData) {
            console.log('网络模式初始化:', this.networkData);
            // 可以在这里添加网络模式特有的初始化逻辑
        }

        engine.updateUI();
        document.getElementById('winnerModal').classList.remove('show');
        
        // 根据游戏模式显示或隐藏技能相关元素
        const globalSkillsContainer = document.querySelector('.global-skills-container');
        const useSkillButton = document.getElementById('useSkillButton');
        
        if (gameMode === 'classic') {
            // 经典模式：隐藏技能相关元素
            if (globalSkillsContainer) {
                globalSkillsContainer.style.display = 'none';
                console.log('经典模式：隐藏全局技能按钮');
            }
            if (useSkillButton) {
                useSkillButton.style.display = 'none';
                console.log('经典模式：隐藏使用技能按钮');
            }
        } else {
            // 技能模式：显示技能相关元素
            if (globalSkillsContainer) {
                globalSkillsContainer.style.display = 'flex';
                console.log('技能模式：显示全局技能按钮');
            }
            // useSkillButton会在选中棋子时显示，所以这里不需要设置
        }
    }

    checkWinner(engine) {
        const player1Pieces = engine.pieces.filter(p => p.player === 1 && p.isActive).length;
        const player2Pieces = engine.pieces.filter(p => p.player === 2 && p.isActive).length;

        if (player1Pieces === 0) {
            engine.endGame(2);
            return true;
        }
        if (player2Pieces === 0) {
            engine.endGame(1);
            return true;
        }
        return false;
    }

    getModeName() {
        return '联网对战';
    }

    getRules() {
        return '每个棋子携带一个技能，每局只能使用一次，技能效果各异';
    }
}
