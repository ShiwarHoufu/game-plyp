/**
 * 道具类型枚举
 */
const GameConfig = require('../constants/GameConfig');

const ItemTypes = {
    QUICK_RECOVERY: 'quickRecovery',
    FREEZE: 'freeze',
    SHARED_PROSPERITY: 'sharedProsperity',
    DESTINY: 'destiny',
    INVISIBILITY: 'invisibility',
    ONE_BODY: 'oneBody'
};

/**
 * 我命由天效果应用标记
 */
const DESTINY_EFFECT_APPLY = 'applyDestiny';

/**
 * 冰冻效果应用标记
 */
const FREEZE_EFFECT_APPLY = 'applyFreeze';

/**
 * 检测棋子是否拾取道具
 * @param {Array} pieces - 所有棋子数组
 * @param {Object} item - 道具对象 {x, y, radius}
 * @returns {Object|null} - 返回拾取者棋子，如果没有则返回null
 */
function checkItemPickup(pieces, item) {
    for (const piece of pieces) {
        if (!piece.isActive) continue;

        const dx = piece.x - item.x;
        const dy = piece.y - item.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const pickupDistance = piece.radius + item.radius;

        if (distance < pickupDistance) {
            return piece;
        }
    }
    return null;
}

/**
 * 激活道具效果
 * @param {Object} piece - 拾取道具的棋子
 * @param {string} itemType - 道具类型
 * @param {Object} room - 房间对象
 */
function activateItem(piece, itemType, room) {
    const config = GameConfig.items[itemType];
    if (!config) return null;

    // 确保 itemEffects 对象存在
    if (!room.itemEffects) {
        room.itemEffects = {};
    }

    switch (itemType) {
        case ItemTypes.QUICK_RECOVERY:
            // 保存原始恢复间隔
            const originalInterval = room.chaosConfig.energyRegenInterval;
            const newInterval = config.energyRegenInterval;
            const playerId = piece.player;
            const now = Date.now();

            // 计算当前能量恢复进度（保留之前的进度）
            if (room.lastEnergyRegenTime && room.lastEnergyRegenTime[playerId]) {
                const elapsed = now - room.lastEnergyRegenTime[playerId];
                const progress = Math.min(elapsed / originalInterval, 1.0);
                // 根据进度调整新的 lastEnergyRegenTime
                // 新的时间 = 现在 - (进度 * 新间隔)
                // 这样能量恢复会从当前进度继续，而不是重置为0
                room.lastEnergyRegenTime[playerId] = now - (progress * newInterval);
            }

            room.itemEffects.quickRecovery = {
                active: true,
                playerId: piece.player,
                endTime: Date.now() + config.duration,
                originalEnergyRegenInterval: originalInterval,
                newEnergyRegenInterval: newInterval
            };
            break;

        case ItemTypes.FREEZE:
            // 冰冻效果由调用者直接应用，这里只返回标记
            return FREEZE_EFFECT_APPLY;

        case ItemTypes.SHARED_PROSPERITY:
            room.itemEffects.sharedProsperity = {
                active: true,
                playerId: piece.player,
                endTime: Date.now() + config.duration
            };
            break;

        case ItemTypes.DESTINY:
            return DESTINY_EFFECT_APPLY;

        case ItemTypes.INVISIBILITY:
            room.itemEffects.invisibility = {
                active: true,
                playerId: piece.player,
                endTime: Date.now() + config.duration
            };
            break;

        case ItemTypes.ONE_BODY:
            room.itemEffects.oneBody = {
                active: true,
                playerId: piece.player,
                endTime: Date.now() + config.duration
            };
            break;
    }

    return null;
}

/**
 * 更新道具效果状态（处理过期等）
 * @param {Object} room - 房间对象
 */
function updateItemEffects(room) {
    if (!room.itemEffects) return;

    const now = Date.now();

    // 快速恢复效果
    if (room.itemEffects.quickRecovery && room.itemEffects.quickRecovery.active) {
        if (now > room.itemEffects.quickRecovery.endTime) {
            room.itemEffects.quickRecovery.active = false;
            // 不需要调整 lastEnergyRegenTime - 它已经记录了上次能量恢复的时间
            // 正常恢复逻辑会从这里继续，自动从当前进度开始
        }
    }

    // 富贵同享效果
    if (room.itemEffects.sharedProsperity && room.itemEffects.sharedProsperity.active) {
        if (now > room.itemEffects.sharedProsperity.endTime) {
            room.itemEffects.sharedProsperity.active = false;
        }
    }

    // 隐身效果
    if (room.itemEffects.invisibility && room.itemEffects.invisibility.active) {
        if (now > room.itemEffects.invisibility.endTime) {
            room.itemEffects.invisibility.active = false;
        }
    }

    // 浑然一体效果
    if (room.itemEffects.oneBody && room.itemEffects.oneBody.active) {
        if (now > room.itemEffects.oneBody.endTime) {
            room.itemEffects.oneBody.active = false;
        }
    }
}

/**
 * 获取当前活跃的道具效果
 * @param {Object} room - 房间对象
 * @returns {Object} - 活跃效果信息
 */
function getActiveItemEffects(room) {
    if (!room.itemEffects) {
        return {
            quickRecovery: { active: false },
            sharedProsperity: { active: false },
            invisibility: { active: false },
            oneBody: { active: false }
        };
    }

    const now = Date.now();
    return {
        quickRecovery: {
            active: room.itemEffects.quickRecovery ? room.itemEffects.quickRecovery.active : false,
            playerId: room.itemEffects.quickRecovery ? room.itemEffects.quickRecovery.playerId : null,
            endTime: room.itemEffects.quickRecovery ? room.itemEffects.quickRecovery.endTime : 0,
            remaining: room.itemEffects.quickRecovery && room.itemEffects.quickRecovery.active
                ? Math.max(0, room.itemEffects.quickRecovery.endTime - now) : 0
        },
        sharedProsperity: {
            active: room.itemEffects.sharedProsperity ? room.itemEffects.sharedProsperity.active : false,
            playerId: room.itemEffects.sharedProsperity ? room.itemEffects.sharedProsperity.playerId : null,
            endTime: room.itemEffects.sharedProsperity ? room.itemEffects.sharedProsperity.endTime : 0,
            remaining: room.itemEffects.sharedProsperity && room.itemEffects.sharedProsperity.active
                ? Math.max(0, room.itemEffects.sharedProsperity.endTime - now) : 0
        },
        invisibility: {
            active: room.itemEffects.invisibility ? room.itemEffects.invisibility.active : false,
            playerId: room.itemEffects.invisibility ? room.itemEffects.invisibility.playerId : null,
            endTime: room.itemEffects.invisibility ? room.itemEffects.invisibility.endTime : 0,
            remaining: room.itemEffects.invisibility && room.itemEffects.invisibility.active
                ? Math.max(0, room.itemEffects.invisibility.endTime - now) : 0
        },
        oneBody: {
            active: room.itemEffects.oneBody ? room.itemEffects.oneBody.active : false,
            playerId: room.itemEffects.oneBody ? room.itemEffects.oneBody.playerId : null,
            endTime: room.itemEffects.oneBody ? room.itemEffects.oneBody.endTime : 0,
            remaining: room.itemEffects.oneBody && room.itemEffects.oneBody.active
                ? Math.max(0, room.itemEffects.oneBody.endTime - now) : 0
        }
    };
}

/**
 * 获取道具效果的当前能量恢复间隔
 * @param {Object} room - 房间对象
 * @param {number} playerId - 玩家ID
 * @returns {number} - 能量恢复间隔（毫秒）
 */
function getEnergyRegenInterval(room, playerId) {
    if (room.itemEffects && room.itemEffects.quickRecovery &&
        room.itemEffects.quickRecovery.active &&
        room.itemEffects.quickRecovery.playerId === playerId) {
        return room.itemEffects.quickRecovery.newEnergyRegenInterval;
    }
    const defaultInterval = room.chaosConfig ? room.chaosConfig.energyRegenInterval : 3300;
    return defaultInterval;
}

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ItemTypes,
        DESTINY_EFFECT_APPLY,
        FREEZE_EFFECT_APPLY,
        checkItemPickup,
        activateItem,
        updateItemEffects,
        getActiveItemEffects,
        getEnergyRegenInterval
    };
}
