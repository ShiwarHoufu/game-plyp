// 模式管理器
// 注意：在浏览器环境中，这些类会通过 script 标签引入

class ModeManager {
    constructor() {
        this.modes = {};
        this.currentMode = null;
        this.initialized = false;
        // 不立即初始化，等待所有脚本加载完成
    }

    init() {
        if (this.initialized) return;
        
        // 注册所有模式
        if (typeof window.ClassicLocal !== 'undefined') {
            this.registerMode('classic', window.ClassicLocal);
        }
        if (typeof window.ClassicNetwork !== 'undefined') {
            this.registerMode('classic-network', window.ClassicNetwork);
        }
        if (typeof window.SkillLocal !== 'undefined') {
            this.registerMode('skill', window.SkillLocal);
        }
        if (typeof window.ChaosNetwork !== 'undefined') {
            this.registerMode('chaos-network', window.ChaosNetwork);
        }
        if (typeof window.Chaos4Network !== 'undefined') {
            this.registerMode('chaos4-network', window.Chaos4Network);
        }
        if (typeof window.SkillNetwork !== 'undefined') {
            this.registerMode('skill-network', window.SkillNetwork);
        }

        this.initialized = true;
        console.log('ModeManager initialized with modes:', Object.keys(this.modes));
    }

    registerMode(key, modeClass) {
        this.modes[key] = modeClass;
    }

    createMode(key, options = {}) {
        // 确保已初始化
        if (!this.initialized) {
            this.init();
        }
        
        const ModeClass = this.modes[key];
        if (!ModeClass) throw new Error(`Mode ${key} not found`);
        return new ModeClass(options);
    }

    getMode(key) {
        // 确保已初始化
        if (!this.initialized) {
            this.init();
        }
        return this.modes[key];
    }

    setCurrentMode(key, options = {}) {
        this.currentMode = this.createMode(key, options);
        return this.currentMode;
    }

    getCurrentMode() {
        return this.currentMode;
    }

    getAvailableModes() {
        // 确保已初始化
        if (!this.initialized) {
            this.init();
        }
        return Object.keys(this.modes);
    }
}

// 导出模式管理器实例
const modeManager = new ModeManager();

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.modeManager = modeManager;
    
    // 在 DOMContentLoaded 事件中初始化模式管理器
    // 确保所有脚本都已加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            modeManager.init();
        });
    } else {
        // DOM 已经加载完成，立即初始化
        modeManager.init();
    }
}
