class SkillMode {
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
        this.isNetworkMode = false;
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

        // 使用PositionCalculator计算棋子位置
        const positions = PositionCalculator.calculatePositions(this.boardWidth, this.boardHeight, this.pieceCount, 'skill');

        // 根据选择的技能创建棋子，使用技能颜色
        for (let i = 0; i < this.pieceCount; i++) {
            const skill1 = this.selectedSkills[1][i];
            const skill2 = this.selectedSkills[2][i];
            
            const color1 = skill1 ? skill1.color : GAME_CONFIG.playerColors.player1;
            const color2 = skill2 ? skill2.color : GAME_CONFIG.playerColors.player2;
            
            const piece1 = new Piece(positions.player1[i].x, positions.player1[i].y, color1, 1, `player1_piece_${i}`);
            const piece2 = new Piece(positions.player2[i].x, positions.player2[i].y, color2, 2, `player2_piece_${i}`);
            
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
            
            engine.pieces.push(piece1);
            engine.pieces.push(piece2);
        }

        // 如果是网络模式，设置网络相关数据
        if (this.isNetworkMode && this.networkData) {
            console.log('网络模式初始化:', this.networkData);
            // 可以在这里添加网络模式特有的初始化逻辑
        }

        engine.updateUI();
        document.getElementById('winnerModal').classList.remove('show');
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
        return '技能模式';
    }

    getRules() {
        return '每个棋子携带一个技能，每局只能使用一次，技能效果各异';
    }
}