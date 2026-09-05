class ChaosNetwork extends NetworkMode {
    constructor(options = {}) {
        super(options);
        this.localMode = new ClassicLocal(options);
        this.isChaosMode = true;
    }

    setupNetworkSync() {
        // 乱斗模式的网络同步逻辑
        console.log('ChaosNetwork: 设置网络同步');
    }

    getModeName() {
        return '乱斗（2人）';
    }

    getRules() {
        return '通过网络与其他玩家进行乱斗模式对战，任意时刻都可发射棋子';
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.ChaosNetwork = ChaosNetwork;
}