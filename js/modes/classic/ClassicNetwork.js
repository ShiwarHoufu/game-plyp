class ClassicNetwork extends NetworkMode {
    constructor(options = {}) {
        super(options);
        this.localMode = new ClassicLocal(options);
    }
    
    setupNetworkSync() {
        // 经典模式的网络同步逻辑
        console.log('ClassicNetwork: 设置网络同步');
    }
    
    getModeName() {
        return '联网经典模式';
    }
    
    getRules() {
        return '通过网络与其他玩家进行经典模式对战';
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.ClassicNetwork = ClassicNetwork;
}
