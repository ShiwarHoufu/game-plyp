class BaseMode {
    constructor(options = {}) {
        this.options = options;
        this.pieceCount = options.pieceCount || 3;
        this.player1Color = options.player1Color || GAME_CONFIG.playerColors.player1;
        this.player2Color = options.player2Color || GAME_CONFIG.playerColors.player2;
    }

    init(engine) {
        throw new Error('Subclass must implement init method');
    }

    checkWinner(engine) {
        throw new Error('Subclass must implement checkWinner method');
    }

    getModeName() {
        throw new Error('Subclass must implement getModeName method');
    }

    getRules() {
        throw new Error('Subclass must implement getRules method');
    }

    setOptions(options) {
        this.pieceCount = options.pieceCount || this.pieceCount;
        this.player1Color = options.player1Color || this.player1Color;
        this.player2Color = options.player2Color || this.player2Color;
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.BaseMode = BaseMode;
}
