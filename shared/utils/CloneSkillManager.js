/**
 * 分身技能管理器
 * 客户端和服务端共用
 * 集中管理分身技能的所有逻辑
 */

const CloneSkillManager = {
    /**
     * 获取游戏配置
     */
    getConfig() {
        if (typeof window !== 'undefined' && window.GAME_CONFIG) {
            return window.GAME_CONFIG;
        }
        try {
            return require('../constants/GameConfig.js');
        } catch (e) {
            return null;
        }
    },

    /**
     * 获取分身技能ID
     */
    getCloneSkillId() {
        const config = this.getConfig();
        return config?.skills?.clone?.id;
    },

    /**
     * 检查是否可以使用分身技能
     * @param {Object} piece - 棋子对象
     * @returns {boolean} 是否可以使用
     */
    canUse(piece) {
        if (!piece.skill) return false;
        const config = this.getConfig();
        if (piece.skill.id !== config?.skills?.clone?.id) return false;
        return piece.skillUses < config.skills.clone.maxUses && piece.skillUsesThisTurn === 0;
    },

    /**
     * 检查是否可以放置分身
     * @param {Object} piece - 棋子对象
     * @returns {boolean} 是否可以放置
     */
    canPlace(piece) {
        return piece.skillActive &&
               piece.skill &&
               piece.skill.id === this.getCloneSkillId() &&
               !piece.clonePlaced &&
               piece.skillUses > 0;
    },

    /**
     * 激活分身技能（每次使用技能时调用）
     * @param {Object} piece - 棋子对象
     */
    activate(piece) {
        const config = this.getConfig();
        piece.skillTurnsRemaining = config ? config.skills.clone.duration : 6;
        piece.clonePlaced = false;
    },

    /**
     * 放置分身
     * @param {Object} originalPiece - 本体棋子
     * @param {number} x - 分身位置x
     * @param {number} y - 分身位置y
     * @param {string} cloneId - 分身ID
     * @returns {Object} 创建的分身棋子
     */
    placeClone(originalPiece, x, y, cloneId) {
        const config = this.getConfig();
        originalPiece.clonePlaced = true;

        // 创建分身
        const clone = {
            id: cloneId,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            radius: config ? config.pieceRadius : 15,
            mass: 1,
            friction: config ? config.pieceFriction : 0.985,
            color: originalPiece.color,
            player: originalPiece.player,
            isActive: true,
            isIntangible: false,
            skillActive: true,
            skill: originalPiece.skill,
            skillUsed: true,
            skillTurnsRemaining: originalPiece.skillTurnsRemaining,
            isClone: true,
            originalPiece: originalPiece,
            clonePiece: null,
            doubleStrikeCount: 0,
            skillUses: 0,
            skillUsesThisTurn: 0
        };

        originalPiece.clonePiece = clone;
        return clone;
    },

    /**
     * 处理回合衰减
     * @param {Object} piece - 棋子对象（可以是本体或分身）
     * @param {Array} allPieces - 所有棋子数组（用于清理引用）
     * @returns {boolean} 是否需要后续处理（如广播更新）
     */
    handleTurnDecay(piece, allPieces) {
        if (!piece.skillActive || piece.skillTurnsRemaining <= 0) return false;

        piece.skillTurnsRemaining--;

        if (piece.skillTurnsRemaining <= 0) {
            if (piece.isClone) {
                // 分身到期，标记为非活跃
                piece.isActive = false;
                // 清理本体的分身引用
                if (piece.originalPiece) {
                    piece.originalPiece.clonePlaced = false;
                    piece.originalPiece.clonePiece = null;
                }
                return true;
            } else {
                // 本体技能到期 - 无论是否用完次数都停用技能
                // skillUses 保持不变，用于标记玩家已使用的次数
                piece.skillActive = false;
                piece.clonePlaced = false;
            }
        }
        return false;
    },

    /**
     * 检查本体死亡时，关联的分身是否也应该死亡
     * @param {Object} piece - 可能死亡的棋子
     * @param {Array} allPieces - 所有棋子
     */
    handleOriginalPieceDeath(piece, allPieces) {
        if (piece.isClone) return;

        // 找到该本体的所有活跃分身并标记死亡
        for (const p of allPieces) {
            if (p.isClone && p.originalPiece === piece && p.isActive) {
                p.isActive = false;
            }
        }
        // 清理本体的分身引用
        piece.clonePlaced = false;
        piece.clonePiece = null;
    },

    /**
     * 检查分身是否可以参与碰撞
     * @param {Object} piece - 棋子
     * @returns {boolean}
     */
    canCollide(piece) {
        return piece.isClone;
    },

    /**
     * 检查分身是否可以被选中/拖拽
     * @param {Object} piece - 棋子
     * @returns {boolean}
     */
    canSelect(piece) {
        return !piece.isClone;
    },

    /**
     * 检查分身是否可以被弹射
     * @param {Object} piece - 棋子
     * @returns {boolean}
     */
    canCatapult(piece) {
        return !piece.isClone;
    },

    /**
     * 获取绿色光圈是否应该显示
     * @param {Object} piece - 棋子
     * @returns {boolean}
     */
    shouldShowGreenAura(piece) {
        if (piece.isClone || !piece.skillActive) return false;
        const config = this.getConfig();
        if (piece.skill?.id !== config?.skills?.clone?.id) return false;
        return !piece.clonePlaced && piece.skillUses < config.skills.clone.maxUses;
    }
};

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloneSkillManager;
}

// 浏览器环境中设置全局变量
if (typeof window !== 'undefined') {
    window.CloneSkillManager = CloneSkillManager;
}
