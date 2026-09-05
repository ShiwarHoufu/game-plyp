/**
 * 技能选择相关网络事件处理
 */
class SkillSelectionHandler {
    constructor(networkManager) {
        this.networkManager = networkManager;
    }

    /**
     * 注册技能选择相关事件
     */
    registerEvents() {
        const sc = this.networkManager.socketClient;

        sc.on('network_classic_prepare', (data) => {
            console.log('收到联网经典模式准备消息:', data);
            this.networkManager.handleNetworkClassicPrepare(data);
        });

        sc.on('network_classic_start', (data) => {
            console.log('收到联网经典模式开始消息:', data);
            this.networkManager.handleNetworkClassicStart(data);
        });

        sc.on('network_skill_prepare', (data) => {
            console.log('收到联网技能模式准备消息:', data);
            this.networkManager.handleNetworkSkillPrepare(data);
        });

        sc.on('network_skill_turn', (data) => {
            console.log('收到联网技能模式回合消息:', data);
            this.networkManager.handleNetworkSkillTurn(data);
        });

        sc.on('network_skill_selected', (data) => {
            console.log('收到联网技能模式选择消息:', data);
            this.networkManager.handleNetworkSkillSelected(data);
        });

        sc.on('network_skill_global_selected', (data) => {
            console.log('收到联网技能模式全局技能选择消息:', data);
            this.networkManager.handleNetworkSkillGlobalSelected(data);
        });

        sc.on('network_skill_start', (data) => {
            console.log('收到联网技能模式开始消息:', data);
            this.networkManager.handleNetworkSkillStart(data);
        });

        sc.on('error', (data) => {
            console.log('收到错误消息:', data);
            if (data && data.message) {
                // 能量不足使用临时消息提示，不弹窗
                if (data.message.includes('能量不足')) {
                    if (gameEngine && gameEngine.showTemporaryMessage) {
                        gameEngine.showTemporaryMessage('能量不足，无法弹射！');
                    }
                    return;
                }
                showErrorModal(data.message);
                if (data.message.includes('重复的颜色')) {
                    this.networkManager.isConfirmed = false;
                    const confirmButton = document.getElementById('networkClassicConfirmBtn');
                    if (confirmButton) {
                        confirmButton.textContent = '确认';
                        confirmButton.classList.remove('confirmed');
                        confirmButton.disabled = false;
                    }
                    this.networkManager.setColorSelectionEnabled(true);
                }
            }
        });
    }
}
