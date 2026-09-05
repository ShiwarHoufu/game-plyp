/**
 * 技能逻辑处理
 * 客户端和服务端共用
 * 处理技能的激活、效果和停用逻辑
 */

const SkillLogic = {
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
     * 激活狂暴技能
     * @param {Object} piece - 棋子对象
     */
    activateFrenzy(piece) {
        const config = this.getConfig();
        piece.skillTurnsRemaining = config ? config.skills.frenzy.duration : 1;
    },

    /**
     * 激活二连击技能
     * @param {Object} piece - 棋子对象
     */
    activateDoubleStrike(piece) {
        const config = this.getConfig();
        piece.doubleStrikeCount = config ? config.skills.doubleStrike.strikeCount : 2;
        piece.skillTurnsRemaining = 1; // 设置技能持续1回合
    },

    /**
     * 激活闪现技能
     * @param {Object} piece - 棋子对象
     */
    activateBlink(piece) {
        const config = this.getConfig();
        piece.blinkCenterX = piece.x;
        piece.blinkCenterY = piece.y;
        piece.blinkRadius = config ? config.skills.blink.radius : 280;
        piece.skillTurnsRemaining = config ? config.skills.blink.duration : 1;
    },

    /**
     * 激活分身技能
     * @param {Object} piece - 棋子对象
     */
    activateClone(piece) {
        const config = this.getConfig();
        piece.skillTurnsRemaining = config ? config.skills.clone.duration : 6;
        piece.clonePlaced = false;
    },

    /**
     * 激活超重技能
     * @param {Object} piece - 棋子对象
     */
    activateHeavy(piece) {
        const config = this.getConfig();
        if (!config) return;
        piece.mass = config.skills.heavy.massMultiplier;
        piece.friction = config.pieceFriction * config.skills.heavy.frictionMultiplier;
        piece.skillTurnsRemaining = config.skills.heavy.duration;

        // 如果当前有缩小全局技能生效（originalRadius存在且radius已被缩小），
        // 超重技能应该"战胜"缩小，让棋子恢复到1倍大小，缩小失效后再变为2倍
        if (piece.originalRadius !== undefined && piece.radius < piece.originalRadius) {
            // 保存超重激活时的目标值（2倍基准），缩小失效后需要恢复这个值
            piece.preHeavyRadius = piece.originalRadius * config.skills.heavy.radiusMultiplier;
            // 超重让棋子恢复到1倍（正常）大小
            piece.radius = piece.originalRadius;
        } else {
            // 没有缩小生效，正常应用超重效果
            piece.originalRadius = piece.radius;
            piece.radius = piece.radius * config.skills.heavy.radiusMultiplier;
        }
    },

    /**
     * 激活无形技能
     * @param {Object} piece - 棋子对象
     */
    activateIntangible(piece) {
        const config = this.getConfig();
        piece.skillTurnsRemaining = config ? config.skills.intangible.duration : 4;
        piece.isIntangible = true;
    },

    /**
     * 停用技能
     * @param {Object} piece - 棋子对象
     */
    deactivateSkill(piece) {
        const config = this.getConfig();
        piece.skillActive = false;
        piece.skillTurnsRemaining = 0;
        piece.skillUses = 0;
        
        // 清除二连击相关属性
        piece.doubleStrikeCount = 0;
        piece.isDoubleStrikeFirstShot = false;

        // 恢复超重技能的状态
        const heavySkillId = config?.skills.heavy?.id;
        if (piece.skill && piece.skill.id === heavySkillId) {
            piece.mass = 1;
            piece.friction = config ? config.pieceFriction : 0.985;

            // 如果缩小是在超重之后应用的，缩小还在生效，需要应用缩小的效果
            if (piece.shrinkAppliedOnHeavy) {
                // originalRadius 是基准半径（1x），直接应用缩小的效果
                piece.radius = config ? config.globalSkills.shrink.radius : 9;
                piece.shrinkAppliedOnHeavy = undefined;
            } else if (piece.preHeavyRadius !== undefined) {
                // 缩小先于超重激活，恢复到超重激活前的半径
                piece.radius = piece.preHeavyRadius;
                piece.preHeavyRadius = undefined;
            } else if (piece.originalRadius) {
                piece.radius = piece.originalRadius;
                piece.originalRadius = null;
            }
        }

        // 恢复无形技能的状态
        const intangibleSkillId = config?.skills.intangible?.id;
        if (piece.skill && piece.skill.id === intangibleSkillId) {
            piece.isIntangible = false;
        }
    },

    /**
     * 检查是否可以使用技能
     * @param {Object} piece - 棋子对象
     * @param {number} turnCount - 当前回合数
     * @returns {boolean} 是否可以使用技能
     */
    canUseSkill(piece, turnCount) {
        if (!piece.skill) return false;

        const config = this.getConfig();
        const skillUnlockTurn = config ? config.skillUnlockTurn : 4;

        // 技能模式下前N回合不能使用技能
        if (turnCount < skillUnlockTurn) return false;

        // 分身技能特殊处理：不允许同时存在多个分身
        const cloneSkillId = config?.skills.clone?.id;
        if (piece.skill.id === cloneSkillId) {
            const maxUses = config ? config.skills.clone.maxUses : 2;
            // 检查：使用次数未满 且 本回合未使用 且 当前没有活跃分身
            return piece.skillUses < maxUses && piece.skillUsesThisTurn === 0 && !piece.clonePlaced;
        }

        // 其他技能只能使用一次
        return !piece.skillUsed;
    },

    /**
     * 使用技能
     * @param {Object} piece - 棋子对象
     * @param {number} turnCount - 当前回合数
     * @returns {boolean} 是否成功使用技能
     */
    useSkill(piece, turnCount) {
        if (!this.canUseSkill(piece, turnCount)) return false;

        // 获取游戏配置
        const config = this.getConfig();

        // 分身技能特殊处理
        const cloneSkillId = config?.skills.clone?.id;
        if (piece.skill.id === cloneSkillId) {
            piece.skillUses++;
            piece.skillUsesThisTurn = 1;
            const maxUses = config ? config.skills.clone.maxUses : 2;
            if (piece.skillUses >= maxUses) {
                piece.skillUsed = true;
            }
        } else {
            piece.skillUsed = true;
        }

        piece.skillActive = true;

        // 根据技能类型激活对应效果（使用 GameConfig 中的技能 ID）
        const skillId = piece.skill.id;

        // 使用映射表避免硬编码技能 ID
        const activationMap = {
            [config?.skills.frenzy?.id]: () => this.activateFrenzy(piece),
            [config?.skills.doubleStrike?.id]: () => this.activateDoubleStrike(piece),
            [config?.skills.blink?.id]: () => this.activateBlink(piece),
            [config?.skills.clone?.id]: () => this.activateClone(piece),
            [config?.skills.heavy?.id]: () => this.activateHeavy(piece),
            [config?.skills.intangible?.id]: () => this.activateIntangible(piece)
        };

        const activateFn = activationMap[skillId];
        if (activateFn) {
            activateFn();
        }

        return true;
    },

    /**
     * 计算弹射力度
     * @param {Object} piece - 棋子对象
     * @param {number} dragDistance - 拖拽距离
     * @returns {number} 计算后的力度值
     */
    calculatePower(piece, dragDistance) {
        const config = this.getConfig();
        if (!config) return dragDistance;

        const powerRatio = Math.min(Math.pow(dragDistance / config.maxDragDistance, config.powerCurveExponent), 1);
        const maxScale = piece.maxPowerScale || config.maxPowerScale;
        let scale = powerRatio * maxScale;

        // 狂暴技能效果
        const frenzySkillId = config.skills.frenzy.id;
        if (piece.skillActive && piece.skill && piece.skill.id === frenzySkillId) {
            // 如果虚弱全局技能也在生效（maxPowerScale被修改过），则狂暴和虚弱效果相互抵消
            if (piece.maxPowerScale !== undefined && piece.maxPowerScale < config.maxPowerScale) {
                // 虚弱和狂暴互相抵消，使用正常力度
                scale = powerRatio * config.maxPowerScale;
            } else {
                scale *= config.skills.frenzy.maxPowerMultiplier;
            }
        }

        // 超重技能效果 - 使用技能配置中的乘数
        const heavySkillId = config.skills.heavy.id;
        if (piece.skillActive && piece.skill && piece.skill.id === heavySkillId) {
            scale *= config.skills.heavy.powerMultiplier;
        }

        return scale;
    },

    /**
     * 应用全局技能效果
     * @param {Array} pieces - 所有棋子数组
     * @param {string} skillId - 全局技能ID
     */
    applyGlobalSkillEffect(pieces, skillId) {
        const config = this.getConfig();
        const weaknessSkillId = config?.globalSkills.weakness?.id;
        const shrinkSkillId = config?.globalSkills.shrink?.id;
        const heavySkillId = config?.skills.heavy?.id;

        for (let piece of pieces) {
            if (piece.isActive) {
                if (skillId === weaknessSkillId) {
                    piece.maxPowerScale = config ? config.maxPowerScale * 0.5 : 3.5;
                } else if (skillId === shrinkSkillId) {
                    // 如果棋子有超重技能激活，缩小和超重效果互相抵消（都是相对于基准的倍数）
                    if (piece.skillActive && piece.skill && piece.skill.id === heavySkillId) {
                        // 保存超重激活时的目标值（2倍基准），缩小失效时需要恢复为超重的2倍
                        piece.preShrinkHeavyRadius = piece.originalRadius * config.skills.heavy.radiusMultiplier;
                        // 标记 shrink 是在 heavy 之后应用的，失效时需要特殊处理
                        piece.shrinkAppliedOnHeavy = true;
                        // 超重优先，缩小让棋子变为1x（基准大小）
                        piece.radius = piece.originalRadius;
                    } else {
                        piece.originalRadius = piece.radius;
                        piece.radius = config ? config.globalSkills.shrink.radius : 9;
                    }
                }
            }
        }
    },

    /**
     * 移除全局技能效果
     * @param {Array} pieces - 所有棋子数组
     * @param {string} skillId - 全局技能ID
     */
    removeGlobalSkillEffect(pieces, skillId) {
        const config = this.getConfig();
        const weaknessSkillId = config?.globalSkills.weakness?.id;
        const shrinkSkillId = config?.globalSkills.shrink?.id;
        const heavySkillId = config?.skills.heavy?.id;

        for (let piece of pieces) {
            if (piece.isActive) {
                if (skillId === weaknessSkillId) {
                    delete piece.maxPowerScale;
                } else if (skillId === shrinkSkillId) {
                    // 如果棋子有超重技能激活，缩小失效时需要恢复为超重的2倍
                    if (piece.skillActive && piece.skill && piece.skill.id === heavySkillId) {
                        if (piece.preShrinkHeavyRadius !== undefined) {
                            piece.radius = piece.preShrinkHeavyRadius;
                            piece.preShrinkHeavyRadius = undefined;
                        } else if (piece.preHeavyRadius !== undefined) {
                            // 缩小在超重之前激活的情况
                            piece.radius = piece.preHeavyRadius;
                            piece.preHeavyRadius = undefined;
                        }
                    } else if (piece.originalRadius !== undefined) {
                        piece.radius = piece.originalRadius;
                        delete piece.originalRadius;
                    }
                    // 清除缩小在超重之后应用的标记
                    piece.shrinkAppliedOnHeavy = undefined;
                }
            }
        }
    },

    /**
     * 检查棋子是否拥有指定技能
     * @param {Object} piece - 棋子对象
     * @param {string} skillKey - 技能配置键名 (如 'clone', 'heavy')
     * @returns {boolean} 是否拥有该技能
     */
    hasSkill(piece, skillKey) {
        const config = this.getConfig();
        if (!config || !piece || !piece.skill) return false;
        const skillId = config.skills[skillKey]?.id;
        return piece.skill.id === skillId;
    },

    /**
     * 检查是否是分身技能
     */
    isCloneSkill(piece) {
        return this.hasSkill(piece, 'clone');
    },

    /**
     * 检查是否是超重技能
     */
    isHeavySkill(piece) {
        return this.hasSkill(piece, 'heavy');
    },

    /**
     * 检查是否是闪现技能
     */
    isBlinkSkill(piece) {
        return this.hasSkill(piece, 'blink');
    },

    /**
     * 检查是否是二连击技能
     */
    isDoubleStrikeSkill(piece) {
        return this.hasSkill(piece, 'doubleStrike');
    },

    /**
     * 检查是否是狂暴技能
     */
    isFrenzySkill(piece) {
        return this.hasSkill(piece, 'frenzy');
    },

    /**
     * 检查是否是无形技能
     */
    isIntangibleSkill(piece) {
        return this.hasSkill(piece, 'intangible');
    },

    /**
     * 检查是否是虚弱全局技能
     */
    isWeaknessSkill(skillId) {
        const config = this.getConfig();
        return skillId === config?.globalSkills.weakness?.id;
    },

    /**
     * 检查是否是缩小全局技能
     */
    isShrinkSkill(skillId) {
        const config = this.getConfig();
        return skillId === config?.globalSkills.shrink?.id;
    }
};

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkillLogic;
}

// 浏览器环境中设置全局变量
if (typeof window !== 'undefined') {
    window.SkillLogic = SkillLogic;
}
