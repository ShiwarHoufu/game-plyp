/**
 * 连接/断开连接处理
 */
const { MessageTypes, GameConfig } = require('../../../shared');
const { verifyToken } = require('../middleware/auth');
const ItemHandler = require('./ItemHandler');

/**
 * 注册连接相关事件处理
 */
function register(socket, context) {
    const { io, rooms, players, waitQueue, sendRoomList } = context;

    console.log('玩家连接:', socket.id);

    // 验证 JWT token（如果提供）
    const token = socket.handshake.auth?.token;
    let userId = null;
    let username = null;

    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            userId = decoded.userId;
            username = decoded.username;
            console.log(`[认证] 用户 ${username} (ID: ${userId}) 通过验证`);
        } else {
            console.log('[认证] Token 无效或已过期');
        }
    } else {
        console.log('[认证] 未提供 Token（游客模式）');
    }

    // 存储玩家信息
    players.set(socket.id, {
        id: socket.id,
        socket: socket,
        roomId: null,
        playerId: null,
        ready: false,
        userId: userId,
        username: username
    });

    // 发送游戏配置给客户端
    socket.emit(MessageTypes.CONNECT, {
        version: GameConfig.network.version,
        config: GameConfig,
        userId: userId,
        username: username
    });

    // 断开连接处理
    socket.on('disconnect', () => {
        console.log('玩家断开连接:', socket.id);
        const player = players.get(socket.id);

        // 从等待列表中移除
        const waitingIndex = waitQueue.findIndex(p => p.id === socket.id);
        if (waitingIndex > -1) {
            waitQueue.splice(waitingIndex, 1);
        }

        // 从房间中移除
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                const isChaos4Mode = room.mode === 'chaos4';
                const gameEnded = room.gameEnded || room.chaos4GameEnded;

                if (isChaos4Mode && !gameEnded) {
                    // 乱斗4人模式（游戏未结束）：玩家断开但不销毁房间，只通知其他人
                    console.log('[乱斗4人模式] 玩家断开连接，房间继续:', player.roomId);
                    const leavingPlayerId = player.playerId;
                    const leavingUsername = room.players[leavingPlayerId]?.username || `玩家${leavingPlayerId}`;
                    context.leaveRoom(socket.id, player.roomId, context);
                    socket.to(player.roomId).emit(MessageTypes.PLAYER_LEFT, {
                        playerId: leavingPlayerId,
                        username: leavingUsername,
                        message: '玩家已断开连接'
                    });
                } else if (isChaos4Mode && gameEnded) {
                    // 乱斗4人模式（游戏已结束）：玩家断开时销毁房间
                    console.log('[乱斗4人模式] 游戏已结束，玩家断开连接，销毁房间:', player.roomId);

                    // 停止道具生成计时器
                    ItemHandler.stopItemSpawnTimer(room);

                    // 停止乱斗模式计时器
                    if (room.physicsState && room.physicsState.chaosTimer) {
                        clearInterval(room.physicsState.chaosTimer);
                        room.physicsState.chaosTimer = null;
                    }

                    socket.to(player.roomId).emit(MessageTypes.ROOM_LEAVED, {
                        roomId: player.roomId,
                        reason: 'player_disconnected',
                        message: '对方玩家已断开连接，房间已销毁'
                    });
                    // 清理房间内所有玩家的状态
                    Object.keys(room.players).forEach(position => {
                        const playerInfo = room.players[position];
                        const playerObj = players.get(playerInfo.id);
                        if (playerObj) {
                            playerObj.roomId = null;
                            playerObj.playerId = null;
                            playerObj.ready = false;
                        }
                    });
                    rooms.delete(player.roomId);
                    sendRoomList();
                } else {
                    // 非乱斗模式：任何玩家断开都销毁房间，通知其他人
                    console.log('[非乱斗模式] 玩家断开连接，销毁房间:', player.roomId);

                    // 停止道具生成计时器
                    ItemHandler.stopItemSpawnTimer(room);

                    // 停止乱斗模式计时器
                    if (room.physicsState && room.physicsState.chaosTimer) {
                        clearInterval(room.physicsState.chaosTimer);
                        room.physicsState.chaosTimer = null;
                    }

                    socket.to(player.roomId).emit(MessageTypes.ROOM_LEAVED, {
                        roomId: player.roomId,
                        reason: 'player_disconnected',
                        message: '对方玩家已断开连接，房间已销毁'
                    });
                    // 清理房间内所有玩家的状态
                    Object.keys(room.players).forEach(position => {
                        const playerInfo = room.players[position];
                        const playerObj = players.get(playerInfo.id);
                        if (playerObj) {
                            playerObj.roomId = null;
                            playerObj.playerId = null;
                            playerObj.ready = false;
                        }
                    });
                    rooms.delete(player.roomId);
                    sendRoomList();
                }
            }
        }

        // 从玩家列表中移除
        players.delete(socket.id);
    });
}

module.exports = { register };
