class ClassicLocal extends LocalMode {
    constructor(options = {}) {
        super(options);
    }
    
    getModeName() {
        return '经典模式';
    }
    
    getRules() {
        return '将对方所有棋子撞出棋盘获胜';
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.ClassicLocal = ClassicLocal;
}
