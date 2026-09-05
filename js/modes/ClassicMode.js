class ClassicMode {
    constructor() {
        this.pieceCount = 3; // 默认3颗棋子
        this.player1Color = GAME_CONFIG.playerColors.player1;
        this.player2Color = GAME_CONFIG.playerColors.player2;
    }

    setOptions(options) {
        this.pieceCount = options.pieceCount || 3;
        this.player1Color = options.player1Color || GAME_CONFIG.playerColors.player1;
        this.player2Color = options.player2Color || GAME_CONFIG.playerColors.player2;
    }

    init(engine) {
        const boardWidth = engine.canvas.width;
        const boardHeight = engine.canvas.height;

        // 使用PositionCalculator计算棋子位置
        const positions = PositionCalculator.calculatePositions(boardWidth, boardHeight, this.pieceCount, 'classic');

        // 创建玩家1的棋子
        for (let i = 0; i < positions.player1.length; i++) {
            const pos = positions.player1[i];
            engine.pieces.push(new Piece(pos.x, pos.y, this.player1Color, 1, `player1_piece_${i}`));
        }

        // 创建玩家2的棋子
        for (let i = 0; i < positions.player2.length; i++) {
            const pos = positions.player2[i];
            engine.pieces.push(new Piece(pos.x, pos.y, this.player2Color, 2, `player2_piece_${i}`));
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
        return '经典模式';
    }

    getRules() {
        return '将对方所有棋子撞出棋盘获胜';
    }
}