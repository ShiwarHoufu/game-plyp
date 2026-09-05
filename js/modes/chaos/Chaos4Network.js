class Chaos4Network extends NetworkMode {
    constructor(options = {}) {
        super(options);
        this.localMode = new ClassicLocal(options);
        this.isChaosMode = true;
        this.isChaos4Mode = true;
    }

    setupNetworkSync() {
        console.log('Chaos4Network: 设置网络同步');
    }

    getModeName() {
        return '乱斗（4人）';
    }

    getRules() {
        return '4人自由对战，任意时刻都可发射棋子，最后存活者获胜';
    }
}

if (typeof window !== 'undefined') {
    window.Chaos4Network = Chaos4Network;
}
