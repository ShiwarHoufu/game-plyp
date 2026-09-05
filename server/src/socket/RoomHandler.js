/**
 * 房间管理：创建、加入、离开、列表
 */
const { MessageTypes, GameConfig, GameState } = require('../../../shared');
const ItemHandler = require('./ItemHandler');

/**
 * 注册房间相关事件处理
 */
function register(socket, context) {
    const { io, rooms, players, sendRoomList, leaveRoom } = context;

    // 加入大厅
    socket.on(MessageTypes.JOIN_LOBBY, (data) => {
        console.log('玩家加入大厅:', socket.id);
        socket.join('lobby');
        // 发送房间列表
        sendRoomList();
    });

    // 离开大厅
    socket.on(MessageTypes.LEAVE_LOBBY, (data) => {
        console.log('玩家离开大厅:', socket.id);
        socket.leave('lobby');
    });

    // 创建房间
    socket.on(MessageTypes.CREATE_ROOM, (data) => {
        console.log('创建房间请求:', socket.id, data);

        // 4人乱斗模式验证：只支持2-4子
        if (data.mode === 'chaos4' && data.pieceCount > 4) {
            socket.emit(MessageTypes.ERROR, {
                message: '4人乱斗模式不支持5子，请选择2-4颗棋子'
            });
            return;
        }

        // 生成房间ID
        const roomId = generateRoomId();

        // 生成随机房间名称（001~999）
        const randomNum = Math.floor(Math.random() * 999) + 1;
        const randomRoomName = `${String(randomNum).padStart(3, '0')}号房间`;

        // 使用传入的房间名称，如果没有则使用随机房间名称
        const roomName = data.roomName && data.roomName.trim() ? data.roomName.trim() : randomRoomName;

        // 获取玩家信息
        const player = players.get(socket.id);

        // 创建房间
        const room = {
            id: roomId,
            name: roomName,
            players: {
                1: {
                    id: socket.id,
                    socket: socket,
                    ready: false,
                    userId: player ? player.userId : null,
                    username: player ? player.username : null
                }
            },
            gameState: new GameState(),
            createdAt: Date.now(),
            mode: data.mode || 'skill',
            pieceCount: data.pieceCount || 3, // 默认3颗棋子
            generateTerrain: data.generateTerrain || false, // 是否生成地形
            maxPlayers: (data.mode === 'chaos4') ? 4 : 2, // 4人乱斗模式支持4人
            gameStarted: false, // 游戏是否已开始（chaos4模式用于隐藏进行中的房间）
            currentPlayer: 1,
            turnCount: 0,
            // 物理状态（服务器权威物理）
            physicsState: {
                pieces: [],
                walls: [],
                isAnimating: false,
                animationTimer: null
            }
        };

        rooms.set(roomId, room);

        // 更新玩家信息
        if (player) {
            player.roomId = roomId;
            player.playerId = 1;
        }

        // 让玩家加入房间
        socket.join(roomId);

        // 通知玩家房间创建成功
        socket.emit(MessageTypes.ROOM_CREATED, {
            roomId: roomId,
            roomName: roomName,
            playerId: 1,
            mode: room.mode,
            pieceCount: room.pieceCount,
            generateTerrain: room.generateTerrain
        });

        // 更新房间列表
        sendRoomList();
    });

    // 加入房间
    socket.on(MessageTypes.JOIN_ROOM, (data) => {
        console.log('加入房间请求:', socket.id, data.roomId);

        const roomId = data.roomId;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit(MessageTypes.ERROR, {
                message: '房间不存在'
            });
            return;
        }

        // 检查房间是否已满
        const playerCount = Object.keys(room.players).length;
        const maxPlayers = room.maxPlayers || 2;
        if (playerCount >= maxPlayers) {
            socket.emit(MessageTypes.ERROR, {
                message: '房间已满'
            });
            return;
        }

        // 分配玩家ID（找到空的位置，支持1-4）
        let playerId = 1;
        while (room.players[playerId]) {
            playerId++;
        }

        // 添加玩家到房间
        room.players[playerId] = {
            id: socket.id,
            socket: socket,
            ready: false
        };

        // 更新玩家信息
        const player = players.get(socket.id);
        if (player) {
            player.roomId = roomId;
            player.playerId = playerId;
            // 将 userId 存储到房间玩家对象中，以便游戏结束时记录战绩
            room.players[playerId].userId = player.userId;
            room.players[playerId].username = player.username;
        }

        // 让玩家加入房间
        socket.join(roomId);

        // 通知玩家房间加入成功
        socket.emit(MessageTypes.ROOM_JOINED, {
            roomId: roomId,
            playerId: playerId,
            opponentId: Object.values(room.players).find(p => p.id !== socket.id)?.id,
            mode: room.mode,
            pieceCount: room.pieceCount,
            generateTerrain: room.generateTerrain
        });

        // 通知房间内其他玩家有新玩家加入
        socket.to(roomId).emit(MessageTypes.PLAYER_JOINED, {
            playerId: playerId,
            username: player.username
        });

        // 向新玩家发送现有玩家的准备状态
        Object.keys(room.players).forEach(existingPlayerId => {
            const existingPlayer = room.players[existingPlayerId];
            if (existingPlayer.id !== socket.id) {
                const existingPlayerInfo = players.get(existingPlayer.id);
                socket.emit(MessageTypes.PLAYER_READY, {
                    playerId: parseInt(existingPlayerId),
                    ready: existingPlayer.ready,
                    username: existingPlayerInfo ? existingPlayerInfo.username : null
                });
            }
        });

        // 更新房间列表
        sendRoomList();
    });

    // 离开房间
    socket.on(MessageTypes.LEAVE_ROOM, (data) => {
        console.log('离开房间请求:', socket.id);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const roomId = player.roomId;
            const room = rooms.get(roomId);
            const isChaos4Mode = room && room.mode === 'chaos4';
            const gameEnded = room && (room.gameEnded || room.chaos4GameEnded);

            if (isChaos4Mode && !gameEnded) {
                // 乱斗4人模式（游戏未结束）：玩家离开但不销毁房间
                // leaveRoom 会处理玩家清理和 PLAYER_LEFT 通知
                leaveRoom(socket.id, roomId, context);
                // 给离开的玩家发送确认消息
                socket.emit(MessageTypes.ROOM_LEAVED, {
                    roomId: roomId,
                    isSelf: true
                });
            } else if (isChaos4Mode && gameEnded) {
                // 乱斗4人模式（游戏已结束）：玩家离开时销毁房间
                // 停止道具生成计时器
                ItemHandler.stopItemSpawnTimer(room);

                // 停止乱斗模式计时器
                if (room.physicsState && room.physicsState.chaosTimer) {
                    clearInterval(room.physicsState.chaosTimer);
                    room.physicsState.chaosTimer = null;
                }

                socket.to(roomId).emit(MessageTypes.ROOM_LEAVED, {
                    roomId: roomId,
                    reason: 'player_left',
                    message: '对方玩家已离开房间，房间已销毁'
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
                rooms.delete(roomId);
                const { sendRoomList } = context;
                sendRoomList();
                // 给离开的玩家发送确认消息
                socket.emit(MessageTypes.ROOM_LEAVED, {
                    roomId: roomId,
                    isSelf: true
                });
            } else {
                // 非乱斗模式：游戏未开始时玩家离开不销毁房间，游戏开始后离开才销毁
                if (room && room.gameStarted) {
                    // 游戏已开始，销毁房间
                    socket.to(roomId).emit(MessageTypes.ROOM_LEAVED, {
                        roomId: roomId,
                        reason: 'player_left',
                        message: '对方玩家已离开房间，房间已销毁'
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
                    rooms.delete(roomId);
                    const { sendRoomList } = context;
                    sendRoomList();
                    // 给离开的玩家发送确认消息
                    socket.emit(MessageTypes.ROOM_LEAVED, {
                        roomId: roomId,
                        isSelf: true
                    });
                } else {
                    // 游戏未开始，玩家离开但不销毁房间
                    // leaveRoom 会处理玩家清理和 PLAYER_LEFT 通知
                    leaveRoom(socket.id, roomId, context);
                    // 给离开的玩家发送确认消息
                    socket.emit(MessageTypes.ROOM_LEAVED, {
                        roomId: roomId,
                        isSelf: true
                    });
                }
            }
        }
    });

    // 玩家准备
    socket.on(MessageTypes.PLAYER_READY, (data) => {
        console.log('玩家准备:', socket.id, data.ready);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room && room.players[player.playerId]) {
                room.players[player.playerId].ready = data.ready;

                // 通知房间内所有玩家
                io.to(player.roomId).emit(MessageTypes.PLAYER_READY, {
                    playerId: player.playerId,
                    ready: data.ready,
                    username: player.username
                });

                // 检查是否所有玩家都已准备
                checkAllReady(room, io, players);
            }
        }
    });

    // 切换位置
    socket.on('switch_position', (data) => {
        console.log('切换位置请求:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                // 检查房间内玩家数量
                const playerCount = Object.keys(room.players).length;

                // 只有当房间里只有1个玩家时才能切换位置
                if (playerCount === 1) {
                    const targetPosition = data.targetPosition;

                    // 检查目标位置是否有效
                    if (targetPosition === 1 || targetPosition === 2) {
                        // 保存原位置
                        const originalPosition = player.playerId;

                        // 更新玩家位置
                        player.playerId = targetPosition;

                        // 更新房间内的玩家信息
                        delete room.players[originalPosition];
                        room.players[targetPosition] = {
                            id: socket.id,
                            socket: socket,
                            ready: false,
                            userId: player.userId,
                            username: player.username
                        };

                        console.log('玩家位置切换成功:', socket.id, '从位置', originalPosition, '切换到位置', targetPosition);

                        // 通知玩家位置切换成功
                        socket.emit(MessageTypes.ROOM_JOINED, {
                            roomId: room.id,
                            playerId: targetPosition,
                            opponentId: null,
                            mode: room.mode,
                            pieceCount: room.pieceCount,
                            generateTerrain: room.generateTerrain
                        });
                    }
                }
            }
        }
    });

    // 更新房间棋子数量
    socket.on(MessageTypes.UPDATE_ROOM_PIECE_COUNT, (data) => {
        console.log('更新房间棋子数量:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // 任何玩家都可以更新棋子数量
            const room = rooms.get(player.roomId);
            if (room) {
                // 更新房间的棋子数量
                room.pieceCount = data.pieceCount;
                console.log('房间棋子数量已更新:', room.id, room.pieceCount);

                // 通知房间内所有玩家棋子数量已更新
                io.to(room.id).emit(MessageTypes.ROOM_UPDATE, {
                    roomId: room.id,
                    pieceCount: room.pieceCount
                });
            }
        }
    });
}

// 生成房间ID
function generateRoomId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 检查是否所有玩家都已准备
function checkAllReady(room, io, players) {
    const playerCount = Object.keys(room.players).length;
    const requiredPlayers = room.maxPlayers || 2;
    if (playerCount === requiredPlayers) {
        const allReady = Object.values(room.players).every(p => p.ready);
        if (allReady) {
            // 开始游戏
            const { startGame } = require('./GameHandler');
            startGame(room, io, players);
        }
    }
}

module.exports = {
    register,
    generateRoomId
};
