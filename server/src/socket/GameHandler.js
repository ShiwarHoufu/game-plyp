/**
 * 游戏逻辑：玩家操作、物理循环、回合切换
 */
const { MessageTypes, GameConfig, PhysicsEngine, SkillLogic, PositionCalculator } = require('../../../shared');
const PieceFactory = require('../game/PieceFactory');
const ItemHandler = require('./ItemHandler');
const { getEnergyRegenInterval } = require('../../../shared/utils/ItemLogic');
const db = require('../db/mysql');

/**
 * 记录游戏战绩
 * @param {Object} room - 房间对象
 * @param {number} winnerId - 获胜玩家ID
 */
async function recordGameStats(room, winnerId) {
    try {
        const { players, mode, pieceCount, generateTerrain, turnCount } = room;

        // 获取所有玩家ID
        const playerIds = Object.keys(players).map(id => parseInt(id));

        // 对于每个玩家，记录战绩
        for (const playerId of playerIds) {
            const player = players[playerId];
            if (!player || !player.userId) continue;

            const isWin = playerId === winnerId;
            const result = isWin ? 'win' : 'loss';

            // 获取对手用户名
            const opponentId = playerIds.find(id => id !== playerId);
            let opponentUsername = null;
            if (opponentId && players[opponentId] && players[opponentId].username) {
                opponentUsername = players[opponentId].username;
            }

            // 更新 player_stats 表
            await db.query(
                `INSERT INTO player_stats (user_id, game_mode, wins, losses, total_games)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                    wins = wins + ?,
                    losses = losses + ?,
                    total_games = total_games + 1`,
                [player.userId, mode, isWin ? 1 : 0, isWin ? 0 : 1, isWin ? 1 : 0, isWin ? 0 : 1]
            );

            // 插入 game_history 记录
            await db.query(
                'INSERT INTO game_history (user_id, game_mode, rounds, result, opponent_username, piece_count, generate_terrain) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [player.userId, mode, turnCount || 0, result, opponentUsername, pieceCount, generateTerrain ? 1 : 0]
            );

            // 计算金币奖励（仅网络模式）
            if (mode !== 'local' && mode !== 'skill-local') {
                const coinReward = isWin
                    ? Math.floor(Math.random() * 6) + 5     // 赢家获得5-10金币
                    : Math.floor(Math.random() * 2) + 1;    // 输家获得1-2金币

                await db.query(
                    'UPDATE user_currency SET coins = coins + ? WHERE user_id = ?',
                    [coinReward, player.userId]
                );

                await db.query(
                    'INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)',
                    [player.userId, coinReward, 'win_reward']
                );

                console.log(`[金币奖励] 玩家 ${player.userId} 获得 ${coinReward} 金币（${isWin ? '胜利' : '失败'}）`);
            }
        }

        console.log('[战绩记录] 游戏结束，模式:', mode, '获胜者:', winnerId);
    } catch (error) {
        console.error('[战绩记录错误]:', error);
    }
}

/**
 * 服务器端生成墙壁
 * @param {Object} room - 房间对象
 * @param {Object} options - 生成选项
 * @param {number} options.maxWalls - 最大墙壁数量
 * @param {number} options.canvasWidth - 画布宽度
 * @param {number} options.canvasHeight - 画布高度
 * @param {number} options.minLength - 墙壁最小长度
 * @param {number} options.maxLength - 墙壁最大长度
 * @param {number} options.minDistPiece - 墙壁与棋子最小距离
 * @param {number} options.minDistWall - 墙壁之间最小距离
 * @param {number} options.edgeMargin - 墙壁距画布边缘最小距离
 */
function serverGenerateWall(room, options = {}) {
    const wallConfig = GameConfig.wallGeneration;
    const defaults = {
        maxWalls: wallConfig.maxWalls,
        maxAttempts: wallConfig.maxAttempts,
        canvasWidth: GameConfig.canvasWidth,
        canvasHeight: GameConfig.canvasHeight,
        minLength: wallConfig.minLength,
        maxLength: wallConfig.maxLength,
        minDistPiece: wallConfig.wallMinDistPiece,
        minDistWall: wallConfig.wallMinDistWall,
        edgeMargin: wallConfig.wallEdgeMargin
    };
    const opts = { ...defaults, ...options };
    const {
        maxWalls,
        maxAttempts,
        canvasWidth,
        canvasHeight,
        minLength,
        maxLength,
        minDistPiece,
        minDistWall,
        edgeMargin
    } = opts;

    const walls = room.physicsState.walls;

    // 如果已达到最大数量，先随机删除一面旧墙
    if (walls.length >= maxWalls) {
        const randomIndex = Math.floor(Math.random() * walls.length);
        const removedWall = walls.splice(randomIndex, 1)[0];
        console.log('[服务器生成墙壁] 已达上限，随机删除墙壁:', removedWall, '剩余墙壁数:', walls.length);
    }

    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;

        // 随机生成墙壁长度
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

        // 随机生成墙壁方向（任意角度，0 - 2π）
        const angle = Math.random() * Math.PI * 2;

        // 随机生成墙壁中点位置（确保整个墙壁在画布内）
        const margin = length / 2 + 10;
        const centerX = Math.random() * (canvasWidth - margin * 2) + margin;
        const centerY = Math.random() * (canvasHeight - margin * 2) + margin;

        // 计算墙壁起点和终点
        const halfLength = length / 2;
        const x = centerX - Math.cos(angle) * halfLength;
        const y = centerY - Math.sin(angle) * halfLength;
        const endX = centerX + Math.cos(angle) * halfLength;
        const endY = centerY + Math.sin(angle) * halfLength;

        // 检查墙壁是否与画布边缘太近
        if (x < edgeMargin || x > canvasWidth - edgeMargin ||
            endX < edgeMargin || endX > canvasWidth - edgeMargin ||
            y < edgeMargin || y > canvasHeight - edgeMargin ||
            endY < edgeMargin || endY > canvasHeight - edgeMargin) {
            continue;
        }

        // 检查墙壁是否与棋子太近
        let tooCloseToPiece = false;
        for (const piece of room.physicsState.pieces) {
            if (!piece.isActive) continue;
            const pieceCenterX = (piece.x + (piece.radius || GameConfig.pieceRadius));
            const pieceCenterY = (piece.y + (piece.radius || GameConfig.pieceRadius));
            const midX = (x + endX) / 2;
            const midY = (y + endY) / 2;
            const distToPiece = Math.sqrt((midX - pieceCenterX) ** 2 + (midY - pieceCenterY) ** 2);
            if (distToPiece < minDistPiece) {
                tooCloseToPiece = true;
                break;
            }
        }
        if (tooCloseToPiece) continue;

        // 检查墙壁是否与已有墙壁中点距离过近
        let tooCloseToWall = false;
        for (const wall of walls) {
            const wallMidX = (wall.x + wall.endX) / 2;
            const wallMidY = (wall.y + wall.endY) / 2;
            const midX = (x + endX) / 2;
            const midY = (y + endY) / 2;
            const dist = Math.sqrt((midX - wallMidX) ** 2 + (midY - wallMidY) ** 2);
            if (dist < minDistWall) {
                tooCloseToWall = true;
                break;
            }
        }
        if (tooCloseToWall) continue;

        // 如果通过所有检查，添加墙壁
        walls.push({ x, y, endX, endY, thickness: wallConfig.thickness });
        const turnInfo = room.turnCount !== undefined ? '回合' + room.turnCount : '乱斗模式';
        console.log('[服务器生成墙壁]' + turnInfo + '墙壁位置:', { x, y, endX, endY }, '当前墙壁数:', walls.length);
        return;
    }

    console.log('[服务器生成墙壁] 未能找到合适位置');
}

/**
 * 将棋子随机放置在棋盘安全位置
 * @param {Object} piece - 要放置的棋子
 * @param {Array} pieces - 所有棋子数组，用于检查碰撞
 */
function placePieceRandomly(piece, pieces) {
    const safeRadius = 160;
    const width = GameConfig.canvasWidth;
    const height = GameConfig.canvasHeight;
    let validPosition = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!validPosition && attempts < maxAttempts) {
        attempts++;
        const x = piece.radius + Math.random() * (width - 2 * piece.radius);
        const y = piece.radius + Math.random() * (height - 2 * piece.radius);

        let isPositionValid = true;
        for (const otherPiece of pieces) {
            if (otherPiece.isActive && otherPiece !== piece) {
                const dx = otherPiece.x - x;
                const dy = otherPiece.y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < safeRadius) {
                    isPositionValid = false;
                    break;
                }
            }
        }

        if (isPositionValid) {
            piece.x = x;
            piece.y = y;
            piece.vx = 0;
            piece.vy = 0;
            validPosition = true;
        }
    }

    if (!validPosition) {
        piece.x = width / 2;
        piece.y = height / 2;
        piece.vx = 0;
        piece.vy = 0;
    }
}

/**
 * 注册游戏相关事件处理
 */
function register(socket, context) {
    const { io, rooms, players, leaveRoom } = context;

    // 玩家操作（服务器权威物理）
    socket.on(MessageTypes.PLAYER_ACTION, (data) => {
        console.log('玩家操作:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('玩家未加入房间:', socket.id);
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room) {
            console.log('房间不存在');
            return;
        }

        // 如果已经有动画在运行，忽略新操作（乱斗模式除外）
        const isChaosMode = room.mode === 'chaos' || room.mode === 'chaos4';
        if (!isChaosMode && room.physicsState.isAnimating) {
            console.log('[PLAYER_ACTION] 动画正在运行，忽略新操作');
            return;
        }

        const action = data.action;

        // 检查是否是当前回合玩家（乱斗模式不需要检查）
        const isCurrentPlayerTurn = isChaosMode || player.playerId === room.currentPlayer;

        // 处理闪现移动
        if (action.type === 'blinkMove') {
            const piece = room.physicsState.pieces.find(p => p.id === action.pieceId);
            if (piece) {
                piece.x = action.x;
                piece.y = action.y;
                console.log('[PLAYER_ACTION] 闪现移动:', piece.id, '位置:', action.x, action.y);
                // 立即广播更新后的位置给所有玩家（包括发送者），避免位置被旧数据覆盖
                io.to(player.roomId).emit(MessageTypes.PIECE_POSITIONS, {
                    pieces: room.physicsState.pieces.map(p => serializePiece(p))
                });
            }
            // 广播操作给房间内其他玩家
            socket.to(player.roomId).emit(MessageTypes.PLAYER_ACTION, data);
            return;
        }

        // 处理弹射操作 - 只有当前回合玩家才能执行
        if ((action.type === 'shoot' || action.type === 'doubleStrikeFirst') && isCurrentPlayerTurn) {
            // 乱斗模式检查能量
            if (isChaosMode) {
                const playerEnergy = room.playerEnergy[player.playerId] || 0;
                if (playerEnergy <= 0) {
                    console.log('[PLAYER_ACTION] 玩家能量不足，无法弹射');
                    socket.emit(MessageTypes.ERROR, { message: '能量不足，无法弹射' });
                    return;
                }
                // 消耗能量
                room.playerEnergy[player.playerId]--;
                // 不重置 lastEnergyRegenTime，让进度继续累积
                // 这样能量从1.6消耗到0.6时，进度保持在0.6而不是重置为0
                console.log('[PLAYER_ACTION] 玩家' + player.playerId + '消耗能量，剩余:', room.playerEnergy[player.playerId]);
            }

            // 查找棋子
            const piece = room.physicsState.pieces.find(p => p.id === action.pieceId);
            if (!piece) {
                console.log('[PLAYER_ACTION] 未找到棋子:', action.pieceId);
                return;
            }

            // 计算速度（与客户端一致）
            const dx = action.dragStartX - action.dragEndX;
            const dy = action.dragStartY - action.dragEndY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 1) {
                console.log('[PLAYER_ACTION] 拖拽距离太短');
                return;
            }

            const scale = SkillLogic.calculatePower(piece, distance);

            piece.vx = (dx / distance) * scale;
            piece.vy = (dy / distance) * scale;

            // 处理二连击第一次弹射
            if (action.type === 'doubleStrikeFirst') {
                piece.doubleStrikeCount--;
                piece.isDoubleStrikeFirstShot = true;
                console.log('[PLAYER_ACTION] 二连击第一次弹射，剩余次数:', piece.doubleStrikeCount);
            }

            console.log('[PLAYER_ACTION] 设置速度:', piece.vx, piece.vy, 'distance:', distance);

            // 广播操作给房间内其他玩家
            socket.to(player.roomId).emit(MessageTypes.PLAYER_ACTION, data);

            // 开始物理模拟循环（乱斗模式不需要，因为物理已经连续运行）
            if (!isChaosMode) {
                startPhysicsLoop(room, io);
            }
        } else if (action.type === 'deactivateSkill') {
            // 处理技能失效（闪现、二连击等技能在弹射后立即失效）
            const piece = room.physicsState.pieces.find(p => p.id === action.pieceId);
            if (piece) {
                SkillLogic.deactivateSkill(piece);
                console.log('[PLAYER_ACTION] 技能失效:', piece.id, '技能:', piece.skill ? piece.skill.id : 'unknown');
                // 立即广播更新，让客户端知道技能已失效
                io.to(player.roomId).emit(MessageTypes.PIECE_POSITIONS, {
                    pieces: room.physicsState.pieces.map(p => serializePiece(p))
                });
            }
        } else if (action.type === 'useSkill') {
            // 允许玩家在非自己回合时使用超重和分身技能
            const piece = room.physicsState.pieces.find(p => p.id === action.pieceId);
            // 分身技能：不允许同时存在多个分身
            const hasActiveClone = piece && piece.skill && piece.skill.id === GameConfig.skills.clone.id && piece.clonePlaced;
            if (piece && piece.player === player.playerId && !piece.skillActive && !hasActiveClone) {
                SkillLogic.useSkill(piece, room.turnCount);
                console.log('[PLAYER_ACTION] 技能激活:', piece.id, '技能:', action.skillId);
                // 立即广播更新后的棋子位置（包含radius变化）
                io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
                    pieces: room.physicsState.pieces.map(p => serializePiece(p))
                });
            }
            // 注意：不再发送 PLAYER_ACTION，因为 PIECE_POSITIONS 已经包含所有需要的状态更新
        } else if (action.type === 'useGlobalSkill') {
            // 应用全局技能效果到服务器物理状态
            SkillLogic.applyGlobalSkillEffect(room.physicsState.pieces, action.skillId);
            // 追踪全局技能状态
            room.globalSkillActive = true;
            room.globalSkillTurnsRemaining = GameConfig.globalSkills[action.skillId]?.duration || 2;
            room.globalSkillType = action.skillId;
            console.log('[PLAYER_ACTION] 全局技能激活:', action.skillId, '持续:', room.globalSkillTurnsRemaining, '回合');
            // 广播给所有客户端
            io.to(room.id).emit(MessageTypes.PLAYER_ACTION, data);
            // 立即广播更新后的棋子位置（包含radius变化）
            io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
                pieces: room.physicsState.pieces.map(p => serializePiece(p))
            });
        } else if (action.type === 'clonePlace') {
            // 允许玩家在非自己回合时放置分身
            const originalPiece = room.physicsState.pieces.find(p => p.id === action.pieceId);
            console.log('[clonePlace] 收到 clonePlace 请求:', action, '找到本体:', originalPiece ? originalPiece.id : 'null');
            if (originalPiece && originalPiece.player === player.playerId) {
                // 服务器端验证：检查分身位置是否有效（边界 + 墙壁碰撞）
                const pieceRadius = GameConfig.pieceRadius;
                const cloneX = action.x;
                const cloneY = action.y;

                // 边界检查
                if (cloneX - pieceRadius < 0 || cloneX + pieceRadius > GameConfig.canvasWidth ||
                    cloneY - pieceRadius < 0 || cloneY + pieceRadius > GameConfig.canvasHeight) {
                    console.log('[clonePlace] 分身位置超出边界，拒绝放置');
                    return;
                }

                // 墙壁碰撞检查
                const tempPiece = { x: cloneX, y: cloneY, radius: pieceRadius };
                for (let wall of room.physicsState.walls) {
                    if (PhysicsEngine.checkWallCollision(tempPiece, wall)) {
                        console.log('[clonePlace] 分身位置与墙壁碰撞，拒绝放置');
                        return;
                    }
                }

                const clonePiece = {
                    id: action.cloneId,
                    x: action.x,
                    y: action.y,
                    vx: 0,
                    vy: 0,
                    // 与普通棋子属性一致
                    radius: GameConfig.pieceRadius,
                    mass: 1,
                    friction: GameConfig.pieceFriction,
                    color: originalPiece.color,
                    player: originalPiece.player,
                    isActive: true,
                    isIntangible: false,
                    skillActive: true,
                    skill: GameConfig.skills.clone,
                    skillUsed: true,
                    skillTurnsRemaining: originalPiece.skillTurnsRemaining || GameConfig.skills.clone.duration,
                    isClone: true,
                    originalPiece: originalPiece,
                    clonePiece: null,
                    doubleStrikeCount: 0
                };

                originalPiece.clonePlaced = true;
                originalPiece.clonePiece = clonePiece;
                room.physicsState.pieces.push(clonePiece);

                // 立即广播位置更新，让所有客户端知道分身创建和本体的 clonePlaced 状态
                const serializedPieces = room.physicsState.pieces.map(p => serializePiece(p));
                const cloneData = serializedPieces.find(p => p.id === action.cloneId);
                console.log('[clonePlace] 分身序列化数据:', cloneData);
                io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
                    pieces: serializedPieces
                });

                console.log('[PLAYER_ACTION] 服务器创建分身:', clonePiece.id, '位置:', action.x, action.y, '剩余回合:', clonePiece.skillTurnsRemaining);
            }
            // 注意：不再发送 PLAYER_ACTION，因为 PIECE_POSITIONS 已经包含所有需要的状态更新
        } else {
            // 其他操作（技能等）直接广播
            socket.to(player.roomId).emit(MessageTypes.PLAYER_ACTION, data);
        }
    });

    // 回合切换请求
    socket.on(MessageTypes.TURN_CHANGE_REQUEST, (data) => {
        console.log('收到回合切换请求:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                if (player.playerId === room.currentPlayer) {
                    room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
                    room.turnCount = (room.turnCount || 0) + 1;

                    // 处理技能回合递减和失效
                    handleSkillTurnDecay(room, io);

                    // 每20回合重置所有技能棋子的技能使用次数
                    if (room.turnCount >= 20 && room.turnCount % 20 === 0 && room.mode === 'skill') {
                        resetSkillsForLongGame(room, io);
                    }

                    // 服务器端生成地形（每隔intervalTurns回合）
                    if (room.generateTerrain && room.turnCount % GameConfig.wallGeneration.intervalTurns === 0) {
                        serverGenerateWall(room);
                    }

                    // 广播棋子位置更新
                    io.to(player.roomId).emit(MessageTypes.PIECE_POSITIONS, {
                        pieces: room.physicsState.pieces.map(p => serializePiece(p)),
                        walls: room.physicsState.walls
                    });

                    io.to(player.roomId).emit(MessageTypes.TURN_CHANGE, {
                        currentPlayer: room.currentPlayer,
                        turnCount: room.turnCount,
                        globalSkillActive: room.globalSkillActive,
                        globalSkillTurnsRemaining: room.globalSkillTurnsRemaining,
                        globalSkillType: room.globalSkillType,
                        walls: room.physicsState.walls
                    });

                    console.log('回合切换成功:', room.currentPlayer, '回合数:', room.turnCount);
                } else {
                    console.log('不是当前玩家的回合，请求被忽略:', player.playerId, '当前回合:', room.currentPlayer);
                }
            }
        } else {
            console.log('玩家未加入房间:', socket.id);
        }
    });

    // 状态同步
    socket.on(MessageTypes.STATE_SYNC, (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // 广播状态同步给房间内其他玩家
            socket.to(player.roomId).emit(MessageTypes.STATE_SYNC, data);

            // 更新服务器上的游戏状态
            const room = rooms.get(player.roomId);
            if (room && data.state) {
                room.gameState = data.state;
            }
        }
    });

    // 重新开始相关
    socket.on(MessageTypes.RESTART_REQUEST, (data) => {
        console.log('重新开始请求:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                if (room.players[player.playerId]) {
                    room.players[player.playerId].ready = true;
                }

                socket.to(player.roomId).emit(MessageTypes.RESTART_REQUEST, {
                    roomId: player.roomId,
                    playerId: player.playerId
                });
            }
        }
    });

    socket.on(MessageTypes.RESTART_ACCEPT, (data) => {
        console.log('重新开始接受:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                if (room.players[player.playerId]) {
                    room.players[player.playerId].ready = true;
                }

                const allAccepted = Object.values(room.players).every(p => p.ready);
                if (allAccepted) {
                    resetRoomForRestart(room, io, player.roomId);
                } else {
                    socket.to(player.roomId).emit(MessageTypes.RESTART_ACCEPT, {
                        roomId: player.roomId,
                        playerId: player.playerId
                    });
                }
            }
        }
    });

    socket.on(MessageTypes.RESTART_REJECT, (data) => {
        console.log('重新开始拒绝:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                // 重置所有玩家的ready状态
                Object.values(room.players).forEach(p => {
                    const playerObj = players.get(p.id);
                    if (playerObj) {
                        playerObj.ready = false;
                    }
                });

                if (room.gameEnded) {
                    // 游戏已结束（再来一局场景）：拒绝后双方都返回大厅
                    console.log('[再来一局拒绝] 游戏已结束，双方返回大厅');

                    // 发送给请求者（A）- 告诉他被拒绝了
                    socket.to(player.roomId).emit(MessageTypes.ROOM_LEAVED, {
                        roomId: player.roomId,
                        isRestartRejected: true,
                        message: '对方玩家拒绝了再来一局请求'
                    });

                    // 发送给拒绝者（B）- 让他也返回大厅
                    socket.emit(MessageTypes.ROOM_LEAVED, {
                        roomId: player.roomId,
                        isSelf: true
                    });

                    // 房间销毁（不需要等所有人离开）
                    rooms.delete(player.roomId);

                    // 清理所有玩家的状态
                    Object.keys(room.players).forEach(position => {
                        const playerInfo = room.players[position];
                        const playerObj = players.get(playerInfo.id);
                        if (playerObj) {
                            playerObj.roomId = null;
                            playerObj.playerId = null;
                            playerObj.ready = false;
                        }
                    });

                    const { sendRoomList } = context;
                    sendRoomList();
                } else {
                    // 游戏进行中（重新开始场景）：拒绝后游戏继续
                    console.log('[重新开始拒绝] 游戏进行中，拒绝后继续游戏');
                    socket.to(player.roomId).emit(MessageTypes.RESTART_REJECT, {
                        roomId: player.roomId,
                        playerId: player.playerId
                    });
                }
            }
        }
    });

    // 返回房间
    socket.on(MessageTypes.BACK_TO_ROOM, (data) => {
        console.log('返回房间请求:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                room.currentPlayer = 1;
                room.turnCount = 0;
                room.gameState = null;

                if (room.physicsState) {
                    if (room.physicsState.animationTimer) {
                        clearInterval(room.physicsState.animationTimer);
                    }
                    if (room.physicsState.chaosTimer) {
                        clearInterval(room.physicsState.chaosTimer);
                    }
                    room.physicsState = {
                        pieces: [],
                        walls: [],
                        isAnimating: false,
                        animationTimer: null,
                        chaosTimer: null
                    };
                }

                Object.keys(room.players).forEach(position => {
                    const playerInfo = room.players[position];
                    playerInfo.ready = false;
                    playerInfo.isConfirmed = false;
                    playerInfo.classicSettings = null;

                    const playerObj = players.get(playerInfo.id);
                    if (playerObj) {
                        playerObj.ready = false;
                        playerObj.isConfirmed = false;
                        playerObj.classicSettings = null;
                    }
                });

                Object.keys(room.players).forEach(position => {
                    const playerInfo = room.players[position];
                    const playerObj = players.get(playerInfo.id);
                    if (playerObj) {
                        let opponentId = null;
                        Object.keys(room.players).forEach(otherPosition => {
                            if (otherPosition !== position) {
                                opponentId = parseInt(otherPosition);
                            }
                        });

                        playerObj.socket.emit(MessageTypes.ROOM_LEAVED, {
                            roomId: player.roomId,
                            roomName: room.name,
                            isSelf: false,
                            isBackToRoom: true,
                            message: '玩家返回房间',
                            playerId: parseInt(position),
                            opponentId: opponentId
                        });
                    }
                });
            }
        }
    });

    // 返回大厅
    socket.on(MessageTypes.BACK_TO_LOBBY, (data) => {
        console.log('返回大厅请求:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                const isChaos4Mode = room.mode === 'chaos4';

                // 乱斗4人模式游戏结束后，所有玩家直接返回大厅，不触发房间销毁或通知
                if (isChaos4Mode && room.chaos4GameEnded) {
                    console.log('[乱斗4人模式] 游戏已结束，玩家直接返回大厅，停止计时器');

                    // 停止道具生成计时器
                    ItemHandler.stopItemSpawnTimer(room);

                    // 停止乱斗模式计时器
                    if (room.physicsState && room.physicsState.chaosTimer) {
                        clearInterval(room.physicsState.chaosTimer);
                        room.physicsState.chaosTimer = null;
                    }

                    // 只清理该玩家自己的状态，不通知任何人，不销毁房间
                    player.roomId = null;
                    player.playerId = null;
                    player.ready = false;
                    return;
                }

                if (isChaos4Mode) {
                    // 乱斗4人模式（游戏未结束）：玩家离开但不销毁房间
                    console.log('[乱斗4人模式] 玩家返回大厅，房间继续:', player.roomId);
                    const leavingPlayerId = player.playerId;
                    const leavingUsername = room.players[leavingPlayerId]?.username || `玩家${leavingPlayerId}`;
                    leaveRoom(socket.id, player.roomId, context);
                    socket.to(player.roomId).emit(MessageTypes.PLAYER_LEFT, {
                        playerId: leavingPlayerId,
                        username: leavingUsername,
                        message: '玩家已返回大厅'
                    });
                } else {
                    // 非乱斗模式：任何玩家返回大厅都销毁房间
                    console.log('[非乱斗模式] 玩家返回大厅，销毁房间:', player.roomId);

                    socket.to(player.roomId).emit(MessageTypes.ROOM_LEAVED, {
                        roomId: player.roomId,
                        reason: 'player_back_to_lobby',
                        message: '对方玩家已返回大厅，房间已销毁'
                    });

                    rooms.delete(player.roomId);

                    Object.keys(room.players).forEach(position => {
                        const playerInfo = room.players[position];
                        const playerObj = players.get(playerInfo.id);
                        if (playerObj) {
                            playerObj.roomId = null;
                            playerObj.playerId = null;
                            playerObj.ready = false;
                        }
                    });

                    const { sendRoomList } = context;
                    sendRoomList();
                }
            }
        }
    });

    // 聊天消息处理
    socket.on(MessageTypes.CHAT_MESSAGE, (data) => {
        console.log('收到聊天消息:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('玩家未加入房间，无法发送聊天消息');
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room) {
            console.log('房间不存在');
            return;
        }

        // 广播聊天消息给房间内所有玩家（包括发送者）
        io.to(player.roomId).emit(MessageTypes.CHAT_MESSAGE, {
            playerId: player.playerId,
            message: data.message
        });
    });

    socket.on(MessageTypes.EMOJI, (data) => {
        console.log('收到表情消息:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('玩家未加入房间，无法发送表情');
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room) {
            console.log('房间不存在');
            return;
        }

        // 广播表情消息给房间内所有玩家（包括发送者）
        io.to(player.roomId).emit(MessageTypes.EMOJI, {
            playerId: player.playerId,
            emoji: data.emoji
        });
    });
}

/**
 * 检查游戏是否结束
 * @param {Object} room - 房间对象
 * @returns {number|null} 获胜玩家ID，或null表示游戏未结束
 */
function checkGameEnd(room) {
    const pieces = room.physicsState.pieces;

    // 4人乱斗模式：只剩1人或0人存活
    if (room.mode === 'chaos4') {
        const activePlayers = [];
        for (let playerId = 1; playerId <= 4; playerId++) {
            const playerPieces = pieces.filter(p => p.player === playerId && p.isActive);
            if (playerPieces.length > 0) {
                activePlayers.push(playerId);
            }
        }
        if (activePlayers.length === 1) {
            return activePlayers[0];
        }
        return null;
    }

    // 2人模式
    const player1Pieces = pieces.filter(p => p.player === 1 && p.isActive);
    const player2Pieces = pieces.filter(p => p.player === 2 && p.isActive);

    if (player1Pieces.length === 0) {
        // 玩家2获胜
        return 2;
    } else if (player2Pieces.length === 0) {
        // 玩家1获胜
        return 1;
    }
    return null;
}

/**
 * 开始物理模拟循环
 */
function startPhysicsLoop(room, io) {
    if (room.physicsState.animationTimer) {
        clearInterval(room.physicsState.animationTimer);
    }

    room.physicsState.isAnimating = true;

    // 广播动画开始
    io.to(room.id).emit(MessageTypes.ANIMATION_START, {});

    room.physicsState.animationTimer = setInterval(() => {
        // 运行一帧物理模拟
        serverPhysicsStep(room, io);

        // 广播位置更新
        io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
            pieces: room.physicsState.pieces.map(p => serializePiece(p))
        });

        // 检查是否全部停止
        if (PhysicsEngine.checkAllStopped(room.physicsState.pieces)) {
            clearInterval(room.physicsState.animationTimer);
            room.physicsState.animationTimer = null;
            room.physicsState.isAnimating = false;

            // 处理待复活棋子的最后一帧（在 interval 停止前）
            // 这样复活消息能在动画结束前被广播
            if (room.physicsState.pendingRespawns) {
                for (const respawnInfo of room.physicsState.pendingRespawns) {
                    const piece = room.physicsState.pieces.find(p => p.id === respawnInfo.pieceId);
                    if (piece) {
                        piece.x = respawnInfo.x;
                        piece.y = respawnInfo.y;
                        piece.vx = 0;
                        piece.vy = 0;
                        piece.isOut = false;
                        if (respawnInfo.isFrenzy) {
                            piece.skillActive = false;
                            piece.skillTurnsRemaining = 0;
                        }
                        io.to(room.id).emit(MessageTypes.PLAYER_ACTION, {
                            action: {
                                type: respawnInfo.isFrenzy ? 'frenzyRespawn' : 'respawn',
                                pieceId: piece.id,
                                x: piece.x,
                                y: piece.y,
                                player: piece.player
                            }
                        });
                    }
                }
                room.physicsState.pendingRespawns = null;
                // 广播复活后的最终位置
                io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
                    pieces: room.physicsState.pieces.map(p => serializePiece(p))
                });
            }

            console.log('[物理模拟] 所有棋子已停止');

            // 检查游戏是否结束
            const gameEndResult = checkGameEnd(room);
            if (gameEndResult) {
                console.log('[游戏结束] 玩家', gameEndResult, '获胜');
                room.gameEnded = true; // 标记游戏已结束
                io.to(room.id).emit(MessageTypes.GAME_END, {
                    winner: gameEndResult
                });
                // 记录战绩
                recordGameStats(room, gameEndResult);
                return;
            }

            // 检查是否有二连击棋子需要继续（第一次弹射后不切换回合）
            const doubleStrikePiece = room.physicsState.pieces.find(p => p.isDoubleStrikeFirstShot && p.isActive);
            if (doubleStrikePiece) {
                doubleStrikePiece.isDoubleStrikeFirstShot = false;
                console.log('[物理模拟] 二连击第一次弹射完成，等待第二次弹射');
            } else {
                // 切换回合
                room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
                room.turnCount = (room.turnCount || 0) + 1;

                // 处理技能回合递减和失效
                handleSkillTurnDecay(room, io);

                // 每20回合重置所有技能棋子的技能使用次数
                if (room.turnCount >= 20 && room.turnCount % 20 === 0 && room.mode === 'skill') {
                    resetSkillsForLongGame(room, io);
                }

                // 服务器端生成地形（每隔intervalTurns回合）
                if (room.generateTerrain && room.turnCount % GameConfig.wallGeneration.intervalTurns === 0) {
                    serverGenerateWall(room);
                }

                io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
                    pieces: room.physicsState.pieces.map(p => serializePiece(p)),
                    walls: room.physicsState.walls
                });

                io.to(room.id).emit(MessageTypes.TURN_CHANGE, {
                    currentPlayer: room.currentPlayer,
                    turnCount: room.turnCount,
                    globalSkillActive: room.globalSkillActive,
                    globalSkillTurnsRemaining: room.globalSkillTurnsRemaining,
                    globalSkillType: room.globalSkillType,
                    walls: room.physicsState.walls
                });

                console.log('[回合切换] 切换到玩家:', room.currentPlayer, '回合数:', room.turnCount);
            }

            // 广播动画结束
            io.to(room.id).emit(MessageTypes.ANIMATION_END, {});
        }
    }, 1000 / 60); // 60 FPS
}

/**
 * 开始乱斗模式物理模拟循环（连续运行，无回合限制）
 */
function startChaosPhysicsLoop(room, io) {
    if (room.physicsState.chaosTimer) {
        clearInterval(room.physicsState.chaosTimer);
    }

    console.log('[乱斗模式] 启动连续物理模拟循环');

    // 乱斗模式保护机制开始
    room.chaosStartTime = Date.now();
    room.chaosProtectionActive = true;
    room.chaosProtectionEndSent = false;

    const CHAOS_PROTECTION_DURATION = 10000; // 10秒保护

    // 根据模式选择能量配置
    const isChaos4Mode = room.mode === 'chaos4';
    const chaosConfig = isChaos4Mode ? GameConfig.chaos4 : GameConfig.chaos;
    room.chaosConfig = chaosConfig;  // 存储供道具系统使用
    const CHAOS_MAX_ENERGY = chaosConfig.maxEnergy;
    const CHAOS_ENERGY_REGEN_INTERVAL = chaosConfig.energyRegenInterval;

    // 地形生成配置（根据模式从GameConfig读取）
    const wallGenConfig = {
        interval: chaosConfig.wallGenerationInterval,
        maxWalls: chaosConfig.maxWalls,
        minLength: chaosConfig.wallMinLength,
        maxLength: chaosConfig.wallMaxLength,
        canvasWidth: isChaos4Mode ? GameConfig.chaos4CanvasWidth : GameConfig.canvasWidth,
        canvasHeight: isChaos4Mode ? GameConfig.chaos4CanvasHeight : GameConfig.canvasHeight,
        minDistPiece: chaosConfig.wallMinDistPiece,
        minDistWall: chaosConfig.wallMinDistWall,
        edgeMargin: chaosConfig.wallEdgeMargin
    };
    let lastWallGenTime = Date.now();

    // 初始化能量存储
    const playerCount = isChaos4Mode ? 4 : 2;
    room.playerEnergy = {};
    room.lastEnergyRegenTime = {};
    for (let i = 1; i <= playerCount; i++) {
        room.playerEnergy[i] = CHAOS_MAX_ENERGY;
        room.lastEnergyRegenTime[i] = Date.now();
    }

    // 启动道具生成计时器（在乱斗模式启动时）
    if (!room.physicsState.itemSpawnTimerStarted) {
        ItemHandler.startItemSpawnTimer(room, io);
        room.physicsState.itemSpawnTimerStarted = true;
    }

    room.physicsState.chaosTimer = setInterval(() => {
        // 检查房间是否还有玩家，如果没有人了则停止计时器
        const currentPlayerCount = Object.keys(room.players).length;
        if (currentPlayerCount === 0) {
            console.log('[乱斗模式] 房间已无玩家，停止计时器');
            clearInterval(room.physicsState.chaosTimer);
            room.physicsState.chaosTimer = null;
            ItemHandler.stopItemSpawnTimer(room);
            return;
        }

        // 检查保护是否结束
        const elapsed = Date.now() - room.chaosStartTime;
        if (room.chaosProtectionActive && elapsed >= CHAOS_PROTECTION_DURATION) {
            room.chaosProtectionActive = false;
            if (!room.chaosProtectionEndSent) {
                room.chaosProtectionEndSent = true;
                console.log('[乱斗模式] 保护机制结束');
                io.to(room.id).emit(MessageTypes.PLAYER_ACTION, {
                    action: { type: 'chaosProtectionEnd' }
                });
            }
        }

        // 能量恢复逻辑（每3秒恢复1点能量，道具可以改变恢复速度）
        const now = Date.now();
        for (let i = 1; i <= playerCount; i++) {
            const regenInterval = getEnergyRegenInterval(room, i);
            if (room.playerEnergy[i] < CHAOS_MAX_ENERGY) {
                if (now - room.lastEnergyRegenTime[i] >= regenInterval) {
                    room.playerEnergy[i]++;
                    room.lastEnergyRegenTime[i] = now;
                    console.log('[乱斗模式] 玩家' + i + '能量恢复，当前能量:', room.playerEnergy[i]);
                }
            } else {
                // 能量已满时，重置计时器以避免下次消耗后时间计算错误
                room.lastEnergyRegenTime[i] = now;
            }
        }

        // 计算每个玩家的能量填充进度（0.0 ~ 1.0）
        room.playerEnergyProgress = {};
        for (let i = 1; i <= playerCount; i++) {
            const regenInterval = getEnergyRegenInterval(room, i);
            if (room.playerEnergy[i] >= CHAOS_MAX_ENERGY) {
                room.playerEnergyProgress[i] = 1.0; // 满能量
            } else {
                const elapsed = now - room.lastEnergyRegenTime[i];
                room.playerEnergyProgress[i] = Math.min(elapsed / regenInterval, 1.0);
            }
        }

        // 乱斗模式：基于时间的地形生成
        if (room.generateTerrain) {
            if (now - lastWallGenTime >= wallGenConfig.interval) {
                serverGenerateWall(room, wallGenConfig);
                lastWallGenTime = now;
            }
        }

        // 运行一帧物理模拟
        serverPhysicsStep(room, io);

        // 道具系统：检测道具拾取
        ItemHandler.checkAllItemPickups(room, io);

        // 道具系统：更新道具效果（冻结计时等）
        ItemHandler.updateItemEffectsTick(room, io);

        // 获取活跃道具效果状态
        const itemEffectsState = ItemHandler.getItemEffectsState(room);

        // 广播位置更新（包含剩余保护时间和能量）
        io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
            pieces: room.physicsState.pieces.map(p => serializePiece(p)),
            walls: room.physicsState.walls,
            chaosProtectionActive: room.chaosProtectionActive,
            chaosProtectionRemaining: room.chaosProtectionActive ? Math.max(0, CHAOS_PROTECTION_DURATION - elapsed) : 0,
            playerEnergy: room.playerEnergy,
            playerEnergyProgress: room.playerEnergyProgress,
            items: ItemHandler.getActiveItems(room),
            itemEffects: itemEffectsState
        });

        // 检查游戏是否结束
        const gameEndResult = checkGameEnd(room);
        if (gameEndResult) {
            clearInterval(room.physicsState.chaosTimer);
            room.physicsState.chaosTimer = null;
            // 停止道具生成计时器
            ItemHandler.stopItemSpawnTimer(room);
            console.log('[乱斗模式游戏结束] 玩家', gameEndResult, '获胜');

            room.gameEnded = true; // 标记游戏已结束

            // 乱斗4人模式：标记游戏已结束，避免返回大厅时触发房间销毁通知
            if (room.mode === 'chaos4') {
                room.chaos4GameEnded = true;
            }

            io.to(room.id).emit(MessageTypes.GAME_END, {
                winner: gameEndResult
            });
            // 记录战绩
            recordGameStats(room, gameEndResult);
            return;
        }
    }, 1000 / 60); // 60 FPS
}

/**
 * 处理技能回合递减和失效
 */
function handleSkillTurnDecay(room, io) {
    for (const piece of room.physicsState.pieces) {
        // 重置每回合技能使用次数
        piece.skillUsesThisTurn = 0;

        // 分身棋子：减少回合数
        if (piece.skillActive && piece.isClone && piece.skill.id === GameConfig.skills.clone.id) {
            if (piece.skillTurnsRemaining > 0) {
                piece.skillTurnsRemaining--;
                if (piece.skillTurnsRemaining <= 0) {
                    piece.isActive = false;
                    // 同步更新本体的状态
                    const originalPiece = piece.originalPiece;
                    if (originalPiece) {
                        originalPiece.clonePlaced = false;
                        originalPiece.clonePiece = null;
                        // 本体技能保持激活状态（保留 skillUses）
                        originalPiece.skillActive = false;
                    }
                    console.log('[技能失效] 分身移除:', piece.id, '本体:', originalPiece ? originalPiece.id : 'unknown');
                }
            }
            continue;
        }

        // 本体棋子有分身技能：检查是否需要停用
        if (piece.skillActive && piece.skill.id === GameConfig.skills.clone.id) {
            // 检查是否有活跃的分身
            let hasActiveClone = false;
            for (const p of room.physicsState.pieces) {
                if (p.isClone && p.originalPiece === piece && p.isActive) {
                    hasActiveClone = true;
                    break;
                }
            }
            // 如果没有活跃的分身，则停用技能（但保留 skillUses）
            if (!hasActiveClone) {
                piece.skillActive = false;
                piece.clonePiece = null;
            }
            continue;
        }

        // 非分身技能的回合递减
        if (piece.skillActive && piece.skillTurnsRemaining > 0) {
            piece.skillTurnsRemaining--;
            if (piece.skillTurnsRemaining <= 0) {
                // 无形技能特殊处理
                const intangibleSkillId = GameConfig.skills.intangible.id;
                const wasIntangible = piece.skill && piece.skill.id === intangibleSkillId;

                SkillLogic.deactivateSkill(piece);

                // 无形技能失效后随机放置在棋盘上
                if (wasIntangible) {
                    placePieceRandomly(piece, room.physicsState.pieces);
                    console.log('[无形技能失效] 随机放置棋子:', piece.id, '位置:', piece.x, piece.y);
                    // 发送无形技能失效复活消息，让客户端显示绿色闪烁效果
                    io.to(room.id).emit(MessageTypes.PLAYER_ACTION, {
                        action: {
                            type: 'intangibleRespawn',
                            pieceId: piece.id,
                            x: piece.x,
                            y: piece.y,
                            player: piece.player
                        }
                    });
                }

                console.log('[回合切换] 技能失效:', piece.id, '技能:', piece.skill ? piece.skill.id : 'unknown');
            }
        }
    }

    // 处理全局技能回合递减
    if (room.globalSkillActive && room.globalSkillTurnsRemaining > 0) {
        room.globalSkillTurnsRemaining--;
        console.log('[回合切换] 全局技能衰减:', room.globalSkillType, '剩余:', room.globalSkillTurnsRemaining);
        if (room.globalSkillTurnsRemaining <= 0) {
            SkillLogic.removeGlobalSkillEffect(room.physicsState.pieces, room.globalSkillType);
            room.globalSkillActive = false;
            room.globalSkillType = null;
            console.log('[回合切换] 全局技能失效');
            // 广播棋子位置更新（恢复原始radius）
            io.to(room.id).emit(MessageTypes.PIECE_POSITIONS, {
                pieces: room.physicsState.pieces.map(p => serializePiece(p))
            });
        }
    }
}

/**
 * 回合数超过20时，重置所有技能棋子的技能使用次数
 * 避免游戏进行到后期因技能耗尽而僵持不下
 */
function resetSkillsForLongGame(room, io) {
    // 无形技能重置后需要随机放置，所以先收集需要处理的棋子
    const intangiblePieces = [];

    // 重置所有在场棋子的技能使用状态
    for (const piece of room.physicsState.pieces) {
        if (piece.isActive && piece.skill) {
            // 如果技能正在生效，先停用技能效果
            if (piece.skillActive) {
                const wasIntangible = piece.skill.id === GameConfig.skills.intangible.id;
                SkillLogic.deactivateSkill(piece);
                // 无形技能停用后需要随机放置
                if (wasIntangible) {
                    intangiblePieces.push(piece);
                }
            }
            piece.skillUsed = false;
            piece.skillUses = 0;
            piece.skillTurnsRemaining = 0;
        }
    }

    // 处理无形技能棋子随机放置
    for (const piece of intangiblePieces) {
        placePieceRandomly(piece, room.physicsState.pieces);
        // 发送无形技能失效复活消息，让客户端显示绿色闪烁效果
        io.to(room.id).emit(MessageTypes.PLAYER_ACTION, {
            action: {
                type: 'intangibleRespawn',
                pieceId: piece.id,
                x: piece.x,
                y: piece.y,
                player: piece.player
            }
        });
    }

    // 分身技能特殊处理：删除所有活跃的分身棋子
    const clonePieces = room.physicsState.pieces.filter(p => p.isClone && p.isActive);
    for (const clone of clonePieces) {
        clone.isActive = false;
        const originalPiece = clone.originalPiece;
        if (originalPiece) {
            originalPiece.clonePlaced = false;
            originalPiece.clonePiece = null;
        }
    }

    // 重置全局技能状态
    if (room.globalSkillActive) {
        SkillLogic.removeGlobalSkillEffect(room.physicsState.pieces, room.globalSkillType);
        room.globalSkillActive = false;
        room.globalSkillTurnsRemaining = 0;
        room.globalSkillType = null;
    }

    // 通知客户端显示技能重置提示
    io.to(room.id).emit(MessageTypes.SKILL_RESET_NOTIFY);
}

/**
 * 查找随机复活位置（用于富贵同享道具效果）
 * @param {Object} room - 房间对象
 * @param {number} boundsWidth - 画布宽度
 * @param {number} boundsHeight - 画布高度
 * @param {Object} piece - 待复活的棋子
 * @returns {Object|null} - {x, y} 位置或null（未找到有效位置）
 */
function findRandomRespawnPosition(room, boundsWidth, boundsHeight, piece) {
    const margin = 60;  // 距边界最小距离
    const pieceRadius = piece.radius || 13;
    const minDist = pieceRadius * 3;  // 与其他棋子的最小距离

    // 计算有效范围
    const minX = margin + pieceRadius;
    const maxX = boundsWidth - margin - pieceRadius;
    const minY = margin + pieceRadius;
    const maxY = boundsHeight - margin - pieceRadius;

    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);

        // 检查是否与棋子重叠
        let overlapsPiece = false;
        for (const otherPiece of room.physicsState.pieces) {
            if (!otherPiece.isActive || otherPiece.id === piece.id) continue;
            const dx = otherPiece.x - x;
            const dy = otherPiece.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
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

            if (dist < pieceRadius + (wall.thickness || 5) / 2 + 10) {
                overlapsWall = true;
                break;
            }
        }
        if (overlapsWall) continue;

        // 找到了有效位置
        return { x, y };
    }

    // 未找到有效位置，返回null
    return null;
}

/**
 * 运行一帧物理模拟
 */
function serverPhysicsStep(room, io) {
    const pieces = room.physicsState.pieces;
    const walls = room.physicsState.walls;

    // 处理延迟复活（上一帧标记的待复活棋子）
    if (room.physicsState.pendingRespawns) {
        for (const respawnInfo of room.physicsState.pendingRespawns) {
            const piece = pieces.find(p => p.id === respawnInfo.pieceId);
            if (piece) {
                piece.x = respawnInfo.x;
                piece.y = respawnInfo.y;
                piece.vx = 0;
                piece.vy = 0;
                piece.isOut = false;
                if (respawnInfo.isFrenzy) {
                    piece.skillActive = false;
                    piece.skillTurnsRemaining = 0;
                }
                // 确定复活类型
                let respawnType = 'respawn';
                if (respawnInfo.isFrenzy) {
                    respawnType = 'frenzyRespawn';
                } else if (respawnInfo.isChaosProtection) {
                    respawnType = 'chaosRespawn';
                } else if (respawnInfo.isSharedProsperity) {
                    respawnType = 'sharedProsperityRespawn';
                }
                // 广播复活消息，让客户端显示提示和绿色闪烁效果
                io.to(room.id).emit(MessageTypes.PLAYER_ACTION, {
                    action: {
                        type: respawnType,
                        pieceId: piece.id,
                        x: piece.x,
                        y: piece.y,
                        player: piece.player
                    }
                });
            }
        }
        room.physicsState.pendingRespawns = null;
    }

    // 更新每个棋子位置
    for (let piece of pieces) {
        PhysicsEngine.updatePiece(piece);
    }

    // 棋子间碰撞检测
    const currentPlayer = room.currentPlayer;
    // 初始化碰撞状态 Map（如果不存在）
    if (!room.physicsState.collisionStates) {
        room.physicsState.collisionStates = new Map();
    }
    for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
            const collisionKey = `${pieces[i].id}_${pieces[j].id}`;
            const wasColliding = room.physicsState.collisionStates.get(collisionKey) || false;
            const isColliding = PhysicsEngine.checkPieceCollision(pieces[i], pieces[j], currentPlayer);

            if (isColliding) {
                PhysicsEngine.resolvePieceCollision(pieces[i], pieces[j]);
            }

            // 只有当碰撞从"未碰撞"变成"碰撞"时才发送音效消息
            if (isColliding && !wasColliding) {
                const relativeSpeed = Math.sqrt(
                    Math.pow(pieces[i].vx - pieces[j].vx, 2) +
                    Math.pow(pieces[i].vy - pieces[j].vy, 2)
                );
                console.log('[Collision] 服务端发送碰撞消息:', pieces[i].id, '<->', pieces[j].id, 'speed:', relativeSpeed);
                io.to(room.id).emit(MessageTypes.COLLISION, {
                    pieceId1: pieces[i].id,
                    pieceId2: pieces[j].id,
                    speed: relativeSpeed
                });
            }

            // 更新碰撞状态
            room.physicsState.collisionStates.set(collisionKey, isColliding);
        }
    }

    // 墙壁碰撞
    for (let piece of pieces) {
        for (let wall of walls) {
            PhysicsEngine.resolveWallCollision(piece, wall);
        }
    }

    // 出界检测 - 标记待复活棋子（延迟一帧处理，避免 checkAllStopped 立即通过）
    const pendingRespawns = [];
    // 使用正确的画布尺寸（chaos4模式使用不同尺寸）
    const boundsWidth = room.mode === 'chaos4' ? GameConfig.chaos4CanvasWidth : GameConfig.canvasWidth;
    const boundsHeight = room.mode === 'chaos4' ? GameConfig.chaos4CanvasHeight : GameConfig.canvasHeight;
    for (let piece of pieces) {
        // 跳过已标记为出界的棋子（等待复活的）
        if (piece.isOut) continue;
        if (PhysicsEngine.checkOutOfBounds(piece, boundsWidth, boundsHeight)) {
            const isFrenzy = piece.skillActive && SkillLogic.isFrenzySkill(piece);
            // 乱斗模式不应用第一回合保护机制，但有10秒保护
            const isChaosProtection = (room.mode === 'chaos' || room.mode === 'chaos4') && room.chaosProtectionActive;
            const isProtected = room.mode !== 'chaos' && room.mode !== 'chaos4' && room.turnCount < 2;
            // 富贵同享道具效果：出界复活
            const isSharedProsperity = room.itemEffects && room.itemEffects.sharedProsperity && room.itemEffects.sharedProsperity.active;
            if (isFrenzy || isProtected || isChaosProtection || isSharedProsperity) {
                // 富贵同享道具效果：随机位置复活（不与棋子、墙壁重叠）
                let respawnX = piece.initialX;
                let respawnY = piece.initialY;
                if (isSharedProsperity) {
                    const respawnPos = findRandomRespawnPosition(room, boundsWidth, boundsHeight, piece);
                    if (respawnPos) {
                        respawnX = respawnPos.x;
                        respawnY = respawnPos.y;
                    }
                }
                // 标记为待复活，延迟到下一帧处理
                pendingRespawns.push({
                    pieceId: piece.id,
                    x: respawnX,
                    y: respawnY,
                    isFrenzy,
                    isChaosProtection,
                    isSharedProsperity,
                    player: piece.player
                });
                // 标记为出界状态，避免重复检测，并将位置移出棋盘
                piece.isOut = true;
                piece.x = -9999;
                piece.y = -9999;
                piece.vx = 0;
                piece.vy = 0;
                let protectionType = '保护机制';
                if (isChaosProtection) protectionType = '乱斗保护';
                else if (isFrenzy) protectionType = 'Frenzy';
                else if (isSharedProsperity) protectionType = '富贵同享';
                console.log('[出界处理] 标记待复活:', piece.id, protectionType);
            } else {
                piece.isActive = false;
                console.log('[出界处理] 棋子出界死亡:', piece.id);
                // 如果本体死亡，其分身也应该消失
                if (piece.clonePiece) {
                    piece.clonePiece.isActive = false;
                    console.log('[出界处理] 分身随本体消失:', piece.clonePiece.id);
                }
            }
        }
    }
    if (pendingRespawns.length > 0) {
        room.physicsState.pendingRespawns = pendingRespawns;
    }
}

/**
 * 序列化棋子数据（用于网络传输）
 */
function serializePiece(piece) {
    const x = Number.isFinite(piece.x) ? piece.x : 0;
    const y = Number.isFinite(piece.y) ? piece.y : 0;
    const vx = Number.isFinite(piece.vx) ? piece.vx : 0;
    const vy = Number.isFinite(piece.vy) ? piece.vy : 0;
    const radius = Number.isFinite(piece.radius) ? piece.radius : 15;
    const mass = Number.isFinite(piece.mass) ? piece.mass : 1;
    const friction = Number.isFinite(piece.friction) ? piece.friction : GameConfig.pieceFriction;

    return {
        id: piece.id,
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        radius: radius,
        mass: mass,
        friction: friction,
        color: piece.color,
        player: piece.player,
        skinId: piece.skinId || 'default',
        isActive: piece.isActive,
        isIntangible: piece.isIntangible,
        isFrozen: piece.isFrozen || false,
        skillActive: piece.skillActive,
        skill: piece.skill,
        skillTurnsRemaining: piece.skillTurnsRemaining || 0,
        skillUses: piece.skillUses || 0,
        skillUsed: piece.skillUsed || false,
        isClone: piece.isClone || false,
        clonePlaced: piece.clonePlaced || false,
        originalPieceId: piece.originalPiece ? piece.originalPiece.id : null
    };
}

/**
 * 重置房间准备重新开始
 */
function resetRoomForRestart(room, io, roomId) {
    Object.values(room.players).forEach(p => {
        p.ready = false;
    });

    room.gameState = new (require('../../../shared').GameState)();
    room.currentPlayer = 1;
    room.turnCount = 0;

    // 重置乱斗模式保护状态
    room.chaosProtectionActive = false;
    room.chaosProtectionEndSent = false;
    if (room.chaosStartTime) {
        delete room.chaosStartTime;
    }

    // 重置乱斗4人模式游戏结束标志
    if (room.chaos4GameEnded) {
        room.chaos4GameEnded = false;
    }

    // 重置游戏结束标志
    room.gameEnded = false;

    // 重置乱斗模式能量状态
    if (room.playerEnergy) {
        delete room.playerEnergy;
    }
    if (room.lastEnergyRegenTime) {
        delete room.lastEnergyRegenTime;
    }
    if (room.playerEnergyProgress) {
        delete room.playerEnergyProgress;
    }

    if (room.physicsState.animationTimer) {
        clearInterval(room.physicsState.animationTimer);
    }
    if (room.physicsState.chaosTimer) {
        clearInterval(room.physicsState.chaosTimer);
        room.physicsState.chaosTimer = null;
    }
    if (room.physicsState.itemSpawnTimer) {
        clearInterval(room.physicsState.itemSpawnTimer);
        room.physicsState.itemSpawnTimer = null;
    }
    room.physicsState = {
        pieces: [],
        walls: [],
        isAnimating: false,
        animationTimer: null,
        chaosTimer: null,
        itemSpawnTimer: null
    };

    if (room.mode === 'classic' || room.mode === 'chaos' || room.mode === 'chaos4') {
        io.to(roomId).emit(MessageTypes.NETWORK_CLASSIC_PREPARE, {
            roomId: roomId,
            mode: room.mode,
            pieceCount: room.pieceCount
        });
    } else {
        // 技能模式重新开始，进入技能选择界面
        // 初始化技能选择状态
        room.skillSelection = {
            currentSelectingPlayer: 1,
            currentPhase: 'skill',
            player1Skills: [],
            player2Skills: [],
            player1GlobalSkill: null,
            player2GlobalSkill: null,
            player1Confirmed: false,
            player2Confirmed: false,
            pieceCount: room.pieceCount
        };
        
        io.to(roomId).emit(MessageTypes.NETWORK_SKILL_PREPARE, {
            roomId: roomId,
            mode: room.mode,
            pieceCount: room.pieceCount,
            currentSelectingPlayer: 1
        });
    }
}

/**
 * 开始游戏
 */
function startGame(room, io, players) {
    console.log('开始游戏:', room.id);

    room.gameState = new (require('../../../shared').GameState)();
    room.currentPlayer = 1;
    room.turnCount = 0;

    if (room.mode === 'classic' || room.mode === 'chaos' || room.mode === 'chaos4') {
        console.log(room.mode === 'chaos' ? '乱斗模式准备开始:' : room.mode === 'chaos4' ? '乱斗4人模式准备开始:' : '经典模式准备开始:', room.id);
        io.to(room.id).emit(MessageTypes.NETWORK_CLASSIC_PREPARE, {
            roomId: room.id,
            mode: room.mode,
            pieceCount: room.pieceCount
        });
    } else if (room.mode === 'skill') {
        console.log('技能模式准备开始:', room.id);

        room.skillSelection = {
            currentSelectingPlayer: 1,
            currentPhase: 'skill',
            player1Skills: [],
            player2Skills: [],
            player1GlobalSkill: null,
            player2GlobalSkill: null,
            player1Confirmed: false,
            player2Confirmed: false,
            pieceCount: room.pieceCount
        };

        io.to(room.id).emit(MessageTypes.NETWORK_SKILL_PREPARE, {
            roomId: room.id,
            mode: room.mode,
            pieceCount: room.pieceCount,
            currentSelectingPlayer: 1
        });
    }
}

module.exports = {
    register,
    startPhysicsLoop,
    startChaosPhysicsLoop,
    serializePiece,
    startGame
};
