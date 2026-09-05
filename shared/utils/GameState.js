/**
 * 游戏状态管理
 * 客户端和服务端共用
 * 管理游戏的核心状态，支持序列化和反序列化
 */

class GameState {
    constructor() {
        this.pieces = [];           // 棋子数组
        this.terrain = [];          // 地形（墙壁）数组
        this.currentPlayer = 1;     // 当前玩家（1或2）
        this.turnCount = 0;         // 回合数
        this.gameOver = false;      // 游戏是否结束
        this.winner = null;         // 获胜者
        
        // 全局技能状态
        this.globalSkillActive = false;
        this.globalSkillTurnsRemaining = 0;
        this.globalSkillType = null;
        
        // 玩家全局技能使用状态
        this.player1GlobalSkillUsed = false;
        this.player2GlobalSkillUsed = false;
    }

    /**
     * 添加棋子
     * @param {Object} piece - 棋子对象
     */
    addPiece(piece) {
        this.pieces.push(piece);
    }

    /**
     * 移除棋子
     * @param {Object} piece - 要移除的棋子
     */
    removePiece(piece) {
        const index = this.pieces.indexOf(piece);
        if (index > -1) {
            this.pieces.splice(index, 1);
        }
    }

    /**
     * 获取指定玩家的活跃棋子
     * @param {number} playerId - 玩家ID
     * @returns {Array} 棋子数组
     */
    getActivePieces(playerId) {
        return this.pieces.filter(p => p.player === playerId && p.isActive);
    }

    /**
     * 检查游戏是否结束
     * @returns {Object|null} 获胜者信息或null
     */
    checkWinner() {
        const player1Active = this.pieces.filter(p => p.player === 1 && p.isActive).length;
        const player2Active = this.pieces.filter(p => p.player === 2 && p.isActive).length;

        if (player1Active === 0) {
            this.gameOver = true;
            this.winner = 2;
            return { winner: 2, player: 'B' };
        }
        if (player2Active === 0) {
            this.gameOver = true;
            this.winner = 1;
            return { winner: 1, player: 'A' };
        }
        return null;
    }

    /**
     * 切换回合
     */
    switchTurn() {
        // 减少所有激活技能的回合数
        for (let piece of this.pieces) {
            if (piece.skillActive && piece.skillTurnsRemaining > 0) {
                piece.skillTurnsRemaining--;
                if (piece.skillTurnsRemaining <= 0) {
                    if (piece.isClone) {
                        piece.isActive = false;
                    } else {
                        this.deactivatePieceSkill(piece);
                    }
                }
            }
            
            // 清除技能使用标志
            if (piece.isUsingSkill) {
                piece.isUsingSkill = false;
            }
            
            // 重置本回合技能使用次数
            piece.skillUsesThisTurn = 0;
        }
        
        // 管理全局技能回合
        if (this.globalSkillActive) {
            this.globalSkillTurnsRemaining--;
            if (this.globalSkillTurnsRemaining <= 0) {
                this.removeGlobalSkillEffect();
            }
        }
        
        // 切换当前玩家
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.turnCount++;
    }

    /**
     * 停用棋子技能
     * @param {Object} piece - 棋子对象
     */
    deactivatePieceSkill(piece) {
        piece.skillActive = false;
        piece.skillTurnsRemaining = 0;
        piece.skillUses = 0;

        if (piece.skill && piece.skill.id === 'heavy') {
            piece.mass = 1;
            piece.friction = GAME_CONFIG.pieceFriction;
            if (piece.originalRadius) {
                piece.radius = piece.originalRadius;
                piece.originalRadius = null;
            }
        }

        if (piece.skill && piece.skill.id === 'intangible') {
            piece.isIntangible = false;
        }
    }

    /**
     * 移除全局技能效果
     */
    removeGlobalSkillEffect() {
        for (let piece of this.pieces) {
            if (piece.isActive) {
                switch (this.globalSkillType) {
                    case 'weakness':
                        delete piece.maxPowerScale;
                        break;
                    case 'shrink':
                        if (piece.originalRadius) {
                            piece.radius = piece.originalRadius;
                            delete piece.originalRadius;
                        }
                        break;
                }
            }
        }
        
        this.globalSkillActive = false;
        this.globalSkillTurnsRemaining = 0;
        this.globalSkillType = null;
    }

    /**
     * 序列化游戏状态（用于网络传输）
     * @returns {Object} 序列化后的状态对象
     */
    serialize() {
        return {
            pieces: this.pieces.map(p => this.serializePiece(p)),
            terrain: this.terrain,
            currentPlayer: this.currentPlayer,
            turnCount: this.turnCount,
            gameOver: this.gameOver,
            winner: this.winner,
            globalSkillActive: this.globalSkillActive,
            globalSkillTurnsRemaining: this.globalSkillTurnsRemaining,
            globalSkillType: this.globalSkillType,
            player1GlobalSkillUsed: this.player1GlobalSkillUsed,
            player2GlobalSkillUsed: this.player2GlobalSkillUsed
        };
    }

    /**
     * 序列化单个棋子
     * @param {Object} piece - 棋子对象
     * @returns {Object} 序列化后的棋子对象
     */
    serializePiece(piece) {
        return {
            id: piece.id,
            x: piece.x,
            y: piece.y,
            vx: piece.vx,
            vy: piece.vy,
            radius: piece.radius,
            color: piece.color,
            player: piece.player,
            isActive: piece.isActive,
            mass: piece.mass,
            isClone: piece.isClone,
            skill: piece.skill ? {
                id: piece.skill.id,
                name: piece.skill.name
            } : null,
            skillUsed: piece.skillUsed,
            skillActive: piece.skillActive,
            skillUses: piece.skillUses,
            skillTurnsRemaining: piece.skillTurnsRemaining,
            isIntangible: piece.isIntangible,
            doubleStrikeCount: piece.doubleStrikeCount,
            isUsingSkill: piece.isUsingSkill
        };
    }

    /**
     * 反序列化游戏状态
     * @param {Object} data - 序列化的状态数据
     */
    deserialize(data) {
        this.pieces = data.pieces.map(p => this.deserializePiece(p));
        this.terrain = data.terrain || [];
        this.currentPlayer = data.currentPlayer;
        this.turnCount = data.turnCount;
        this.gameOver = data.gameOver;
        this.winner = data.winner;
        this.globalSkillActive = data.globalSkillActive;
        this.globalSkillTurnsRemaining = data.globalSkillTurnsRemaining;
        this.globalSkillType = data.globalSkillType;
        this.player1GlobalSkillUsed = data.player1GlobalSkillUsed;
        this.player2GlobalSkillUsed = data.player2GlobalSkillUsed;
    }

    /**
     * 反序列化单个棋子
     * @param {Object} data - 序列化的棋子数据
     * @returns {Object} 棋子对象
     */
    deserializePiece(data) {
        return {
            id: data.id,
            x: data.x,
            y: data.y,
            initialX: data.x,
            initialY: data.y,
            vx: data.vx,
            vy: data.vy,
            radius: data.radius,
            color: data.color,
            player: data.player,
            isActive: data.isActive,
            mass: data.mass || 1,
            friction: GAME_CONFIG.pieceFriction,
            minVelocity: GAME_CONFIG.pieceMinVelocity,
            isClone: data.isClone || false,
            skill: data.skill,
            skillUsed: data.skillUsed || false,
            skillActive: data.skillActive || false,
            skillUses: data.skillUses || 0,
            skillUsesThisTurn: 0,
            skillTurnsRemaining: data.skillTurnsRemaining || 0,
            isIntangible: data.isIntangible || false,
            doubleStrikeCount: data.doubleStrikeCount || 0,
            isUsingSkill: data.isUsingSkill || false,
            isDragging: false,
            isSelected: false,
            clonePiece: null,
            clonePlaced: false,
            respawnFlash: false,
            respawnFlashStartTime: 0,
            respawnFlashDuration: 2000
        };
    }

    /**
     * 创建游戏状态的深拷贝
     * @returns {GameState} 新的游戏状态实例
     */
    clone() {
        const newState = new GameState();
        newState.deserialize(this.serialize());
        return newState;
    }
}

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
