class SkillLocal extends LocalMode {
    constructor(options = {}) {
        super(options);
        this.isSkillMode = true;
        this.player1Skills = [];
        this.player2Skills = [];
        this.player1GlobalSkill = null;
        this.player2GlobalSkill = null;
        this.currentSelectingPlayer = 1;
        this.selectedSkills = { 1: [], 2: [] };
        this.maxSkillsPerPlayer = options.pieceCount || 3;
        this.globalSkillActive = false;
        this.globalSkillTurnsRemaining = 0;
        this.globalSkillType = null;
        this.player1GlobalSkillUsed = false;
        this.player2GlobalSkillUsed = false;
    }
    
    setPieceCount(count) {
        this.pieceCount = count;
        this.maxSkillsPerPlayer = count;
    }
    
    init(engine) {
        const boardWidth = engine.canvas.width;
        const boardHeight = engine.canvas.height;
        
        // 重置全局技能使用计数
        this.player1GlobalSkillUsed = false;
        this.player2GlobalSkillUsed = false;
        this.globalSkillActive = false;
        this.globalSkillTurnsRemaining = 0;
        this.globalSkillType = null;
        
        // 使用PositionCalculator计算棋子位置
        const positions = PositionCalculator.calculatePositions(boardWidth, boardHeight, this.pieceCount, 'skill');
        
        // 清空现有棋子
        engine.pieces = [];
        
        // 创建棋子并分配技能
        for (let i = 0; i < this.pieceCount; i++) {
            // 分配技能
            const skill1 = this.selectedSkills[1][i];
            const skill2 = this.selectedSkills[2][i];
            
            // 使用技能的颜色或默认颜色
            const piece1Color = skill1 && skill1.color ? skill1.color : this.player1Color;
            const piece2Color = skill2 && skill2.color ? skill2.color : this.player2Color;
            
            // 创建棋子
            const piece1 = new Piece(positions.player1[i].x, positions.player1[i].y, piece1Color, 1, `player1_piece_${i}`);
            const piece2 = new Piece(positions.player2[i].x, positions.player2[i].y, piece2Color, 2, `player2_piece_${i}`);
            
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
        
        engine.updateUI();
        document.getElementById('winnerModal').classList.remove('show');
        
        // 显示技能相关元素
        const globalSkillsContainer = document.querySelector('.global-skills-container');
        const useSkillButton = document.getElementById('useSkillButton');
        
        if (globalSkillsContainer) {
            globalSkillsContainer.style.display = 'flex';
        }
    }
    
    getModeName() {
        return '技能模式';
    }
    
    getRules() {
        return '每个棋子携带一个技能，每局只能使用一次，技能效果各异';
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.SkillLocal = SkillLocal;
}
