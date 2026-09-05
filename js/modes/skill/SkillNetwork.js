class SkillNetwork extends NetworkMode {
    constructor(options = {}) {
        super(options);
        this.isSkillMode = true;  // 标记为技能模式，用于前4回合禁用技能检查
        this.localMode = new SkillLocal(options);
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
        if (this.localMode) {
            this.localMode.setPieceCount(count);
        }
    }

    setNetworkData(data) {
        // 调用父类方法设置networkData
        super.setNetworkData(data);

        // 提取技能数据
        if (data.player1Skills) {
            this.selectedSkills[1] = data.player1Skills;
            this.localMode.selectedSkills[1] = data.player1Skills;
        }
        if (data.player2Skills) {
            this.selectedSkills[2] = data.player2Skills;
            this.localMode.selectedSkills[2] = data.player2Skills;
        }
        if (data.player1GlobalSkill) {
            this.player1GlobalSkill = data.player1GlobalSkill;
            this.localMode.player1GlobalSkill = data.player1GlobalSkill;
        }
        if (data.player2GlobalSkill) {
            this.player2GlobalSkill = data.player2GlobalSkill;
            this.localMode.player2GlobalSkill = data.player2GlobalSkill;
        }
    }

    setupNetworkSync() {
        // 技能模式的网络同步逻辑
        console.log('SkillNetwork: 设置网络同步');
    }
    
    getModeName() {
        return '联网技能模式';
    }
    
    getRules() {
        return '通过网络与其他玩家进行技能模式对战';
    }
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.SkillNetwork = SkillNetwork;
}
