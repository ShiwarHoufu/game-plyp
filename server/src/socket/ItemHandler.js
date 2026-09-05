/**
 * 道具管理：生成、拾取、效果处理
 */
const { MessageTypes, GameConfig } = require('../../../shared');
const { ItemTypes, DESTINY_EFFECT_APPLY, FREEZE_EFFECT_APPLY, checkItemPickup, activateItem, updateItemEffects, getActiveItemEffects, getEnergyRegenInterval } = require('../../../shared/utils/ItemLogic');

/**
 * 注册道具相关事件处理
 */
function register(socket, context) {
    // 道具相关事件目前主要由GameHandler调用
    // 这里可以注册一些调试或管理用的事件
}

/**
 * 生成随机道具
 * @param {Object} room - 房间对象
 * @returns {Object|null} - 生成的道具对象，如果没有有效位置则返回null
 */
function spawnItem(room) {
    const itemsConfig = GameConfig.items;
    const chaosConfig = room.chaosConfig || GameConfig.chaos4;

    // 根据权重随机选择道具类型
    const weights = itemsConfig.spawnWeights;
    const itemTypes = Object.keys(weights);
    const totalWeight = itemTypes.reduce((sum, type) => sum + weights[type], 0);
    let random = Math.random() * totalWeight;

    let selectedType = itemTypes[0];
    for (const type of itemTypes) {
        random -= weights[type];
        if (random <= 0) {
            selectedType = type;
            break;
        }
    }
    const itemConfig = GameConfig.items[selectedType];

    // 生成随机位置
    const margin = itemsConfig.spawnMargin || 60;
    const itemRadius = itemsConfig.radius || 13;
    // 根据模式选择画布尺寸（chaos4使用780x780，chaos使用1250x660）
    const boundsWidth = room.mode === 'chaos4' ? GameConfig.chaos4CanvasWidth : GameConfig.canvasWidth;
    const boundsHeight = room.mode === 'chaos4' ? GameConfig.chaos4CanvasHeight : GameConfig.canvasHeight;

    // 计算有效范围（考虑道具半径，确保整个道具在边界内）
    const minX = margin + itemRadius;
    const maxX = boundsWidth - margin - itemRadius;
    const minY = margin + itemRadius;
    const maxY = boundsHeight - margin - itemRadius;

    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);

        // 检查是否与棋子重叠
        let overlapsPiece = false;
        for (const piece of room.physicsState.pieces) {
            if (!piece.isActive) continue;
            const dx = piece.x - x;
            const dy = piece.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < piece.radius + itemsConfig.radius + 10) {
                overlapsPiece = true;
                break;
            }
        }
        if (overlapsPiece) continue;

        // 检查是否与墙壁重叠
        let overlapsWall = false;
        for (const wall of room.physicsState.walls) {
            const wallVecX = wall.endX - wall.x;
            const wallVecY = wall.endY - wall.y;
            const wallLength = Math.sqrt(wallVecX * wallVecX + wallVecY * wallVecY);

            const pieceVecX = x - wall.x;
            const pieceVecY = y - wall.y;

            const t = Math.max(0, Math.min(1,
                (pieceVecX * wallVecX + pieceVecY * wallVecY) / (wallLength * wallLength)
            ));

            const closestX = wall.x + t * wallVecX;
            const closestY = wall.y + t * wallVecY;

            const dx = x - closestX;
            const dy = y - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < itemsConfig.radius + (wall.thickness || 5) / 2 + 10) {
                overlapsWall = true;
                break;
            }
        }
        if (overlapsWall) continue;

        // 找到了有效位置
        const item = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: selectedType,  // Use VALUE (e.g., 'quickRecovery')
            x: x,
            y: y,
            radius: itemsConfig.radius,
            isActive: true,
            createdAt: Date.now()
        };

        return item;
    }

    console.log('[ItemHandler] 无法找到有效的道具生成位置');
    return null;
}

/**
 * 在指定位置生成道具
 * @param {Object} room - 房间对象
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {string} type - 道具类型
 * @returns {Object} - 生成的道具对象
 */
function spawnItemAtPosition(room, x, y, type) {
    const itemsConfig = GameConfig.items;
    const item = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type || ItemTypes.QUICK_RECOVERY,
        x: x,
        y: y,
        radius: itemsConfig.radius,
        isActive: true,
        createdAt: Date.now()
    };

    if (!room.physicsState.items) {
        room.physicsState.items = [];
    }
    room.physicsState.items.push(item);

    return item;
}

/**
 * 检测所有道具拾取
 * @param {Object} room - 房间对象
 * @param {Object} io - socket.io实例
 */
function checkAllItemPickups(room, io) {
    if (!room.physicsState.items || room.physicsState.items.length === 0) {
        return;
    }

    const pieces = room.physicsState.pieces;
    const itemsToRemove = [];

    for (const item of room.physicsState.items) {
        if (!item.isActive) continue;

        const picker = checkItemPickup(pieces, item);
        if (picker) {
            console.log(`[ItemHandler] 玩家${picker.player}拾取了道具: ${item.type}`);

            // 标记为待移除
            itemsToRemove.push(item.id);

            // 激活道具效果
            const effectMarker = activateItem(picker, item.type, room);

            // 通知所有玩家道具被拾取
            io.to(room.id).emit(MessageTypes.ITEM_PICKED_UP, {
                itemId: item.id,
                itemType: item.type,
                playerId: picker.player,
                pieceId: picker.id
            });

            // 如果是我命由天，执行删除效果
            if (effectMarker === DESTINY_EFFECT_APPLY) {
                console.log(`[ItemHandler] 检测到我命由天道具, 道具类型: ${item.type}, DESTINY_EFFECT_APPLY: ${DESTINY_EFFECT_APPLY}`);
                applyDestinyEffect(room, io, picker.player);
            }

            // 如果是冰冻，拾取者自己被冻住
            if (effectMarker === FREEZE_EFFECT_APPLY) {
                const freezeDuration = GameConfig.items.freeze.duration;
                picker.isFrozen = true;
                picker.frozenUntil = Date.now() + freezeDuration;

                console.log(`[ItemHandler] 棋子 ${picker.id} 被冻住 ${freezeDuration}ms`);

                io.to(room.id).emit(MessageTypes.PIECE_FROZEN, {
                    pieceId: picker.id,
                    playerId: picker.player,
                    duration: freezeDuration
                });
            }
        }
    }

    // 移除被拾取的道具
    if (itemsToRemove.length > 0) {
        room.physicsState.items = room.physicsState.items.filter(
            item => !itemsToRemove.includes(item.id)
        );
    }
}

/**
 * 应用我命由天效果 - 随机删除一个在场棋子
 * @param {Object} room - 房间对象
 * @param {Object} io - socket.io实例
 * @param {number} pickerPlayerId - 拾取道具的玩家ID
 */
function applyDestinyEffect(room, io, pickerPlayerId) {
    const pieces = room.physicsState.pieces.filter(p => p.isActive);

    if (pieces.length === 0) return;

    // 随机选择一个棋子（包括拾取者自己的棋子）
    const targetPiece = pieces[Math.floor(Math.random() * pieces.length)];

    console.log(`[ItemHandler] 我命由天效果: 删除棋子 ${targetPiece.id} (玩家${targetPiece.player})`);

    // 标记棋子为删除状态（用于客户端播放特效）
    targetPiece.isDeleted = true;
    targetPiece.deleteTime = Date.now();
    targetPiece.deleteEffectDuration = 1500;  // 1.5秒特效

    // 通知所有玩家棋子被删除
    console.log(`[ItemHandler] 发送PIECE_DELETED消息, roomId: ${room.id}, pieceId: ${targetPiece.id}`);
    io.to(room.id).emit(MessageTypes.PIECE_DELETED, {
        pieceId: targetPiece.id,
        playerId: targetPiece.player,
        x: targetPiece.x,
        y: targetPiece.y,
        deletedBy: pickerPlayerId,
        effectDuration: 1500
    });

    // 延迟删除棋子实体
    setTimeout(() => {
        const piece = room.physicsState.pieces.find(p => p.id === targetPiece.id);
        if (piece) {
            piece.isActive = false;
            piece.isOut = true;
        }
    }, 1500);
}

/**
 * 更新道具效果（处理冻结超时）
 * @param {Object} room - 房间对象
 * @param {Object} io - socket.io实例
 */
function updateItemEffectsTick(room, io) {
    if (!room.physicsState) return;

    const now = Date.now();
    const pieces = room.physicsState.pieces;
    const despawnTime = GameConfig.items.despawnTime;

    // 更新道具效果状态
    updateItemEffects(room);

    // 处理棋子冻结超时
    for (const piece of pieces) {
        if (!piece.isActive) continue;

        if (piece.isFrozen && piece.frozenUntil <= now) {
            piece.isFrozen = false;
            piece.frozenUntil = 0;
            console.log(`[ItemHandler] 棋子 ${piece.id} 解冻`);
        }
    }

    // 处理删除特效超时
    for (const piece of pieces) {
        if (piece.isDeleted && piece.deleteTime) {
            if (now - piece.deleteTime > piece.deleteEffectDuration) {
                piece.isDeleted = false;
                piece.deleteTime = null;
            }
        }
    }

    // 处理道具消失（超过15秒未拾取）
    if (room.physicsState.items && room.physicsState.items.length > 0) {
        const itemsToRemove = [];
        for (const item of room.physicsState.items) {
            if (!item.isActive) continue;
            if (now - item.createdAt > despawnTime) {
                itemsToRemove.push(item.id);
            }
        }

        if (itemsToRemove.length > 0) {
            for (const itemId of itemsToRemove) {
                const item = room.physicsState.items.find(i => i.id === itemId);
                if (item) {
                    console.log(`[ItemHandler] 道具消失: ${item.type} (位置: ${item.x.toFixed(0)}, ${item.y.toFixed(0)})`);
                    io.to(room.id).emit(MessageTypes.ITEM_DESPAWNED, {
                        itemId: item.id,
                        itemType: item.type
                    });
                }
            }
            room.physicsState.items = room.physicsState.items.filter(
                item => !itemsToRemove.includes(item.id)
            );
        }
    }
}

/**
 * 启动道具生成计时器
 * @param {Object} room - 房间对象
 * @param {Object} io - socket.io实例
 */
function startItemSpawnTimer(room, io) {
    // 如果已有计时器，先清除
    if (room.physicsState.itemSpawnTimer) {
        clearInterval(room.physicsState.itemSpawnTimer);
    }

    // 初始化道具数组
    room.physicsState.items = [];

    // 启动定时生成（第一个道具在 interval 后生成，不再立即生成）
    const spawnInterval = GameConfig.items.spawnInterval;
    room.physicsState.itemSpawnTimer = setInterval(() => {
        if (!room.physicsState || !room.gameStarted) {
            // 游戏未开始或房间已销毁，停止生成
            clearInterval(room.physicsState.itemSpawnTimer);
            return;
        }

        // 检查房间是否还有玩家
        const playerCount = Object.keys(room.players).length;
        if (playerCount === 0) {
            // 房间已无玩家，停止生成
            clearInterval(room.physicsState.itemSpawnTimer);
            room.physicsState.itemSpawnTimer = null;
            return;
        }

        // 确保 items 数组存在
        if (!room.physicsState.items) {
            room.physicsState.items = [];
        }

        // 生成新道具
        const item = spawnItem(room);
        if (item) {
            room.physicsState.items.push(item);
            io.to(room.id).emit(MessageTypes.ITEM_SPAWNED, {
                item: item
            });
            console.log(`[ItemHandler] 道具已生成: ${item.type} at (${item.x.toFixed(0)}, ${item.y.toFixed(0)})`);
        }
    }, spawnInterval);
}

/**
 * 停止道具生成计时器
 * @param {Object} room - 房间对象
 */
function stopItemSpawnTimer(room) {
    if (room.physicsState && room.physicsState.itemSpawnTimer) {
        clearInterval(room.physicsState.itemSpawnTimer);
        room.physicsState.itemSpawnTimer = null;
    }
}

/**
 * 获取当前活跃的道具列表
 * @param {Object} room - 房间对象
 * @returns {Array} - 道具数组（直接引用，调用者只读）
 */
function getActiveItems(room) {
    if (!room.physicsState || !room.physicsState.items) {
        return [];
    }
    // 道具在拾取时已从数组移除，直接返回数组引用
    return room.physicsState.items;
}

/**
 * 获取道具效果状态（用于广播）
 * @param {Object} room - 房间对象
 * @returns {Object} - 效果状态
 */
function getItemEffectsState(room) {
    return getActiveItemEffects(room);
}

module.exports = {
    register,
    spawnItem,
    spawnItemAtPosition,
    checkAllItemPickups,
    applyDestinyEffect,
    updateItemEffectsTick,
    startItemSpawnTimer,
    stopItemSpawnTimer,
    getActiveItems,
    getItemEffectsState,
    ItemTypes
};
