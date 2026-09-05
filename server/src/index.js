/**
 * 游戏服务器入口
 * 提供静态文件服务和WebSocket支持
 */

// 最先加载环境变量（server/.env），必须在其他所有 require 之前，
// 确保后续模块（database.js 等）能读到 DB_* 配置
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 导入共享模块
const { GameConfig, MessageTypes } = require('../../shared');
const { registerSocketHandlers } = require('./socket');
const ItemHandler = require('./socket/ItemHandler');

// CORS 中间件
app.use(cors());

// JSON 解析中间件
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../..')));

// REST API 路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const statsRoutes = require('./routes/stats');
const shopRoutes = require('./routes/shop');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/shop', shopRoutes);

// 游戏房间管理
const rooms = new Map();
const waitQueue = [];
const players = new Map();

// 在线玩家计数器
let onlinePlayerCount = 0;

// 辅助函数
function sendRoomList() {
    const { sendRoomList: helper } = require('./utils/helpers');
    helper(io, rooms);
}

function leaveRoom(playerId, roomId, context) {
    const { io, rooms, players, sendRoomList } = context;
    const { serializePiece } = require('./utils/helpers');
    const { MessageTypes } = require('../../shared');

    const room = rooms.get(roomId);
    if (room) {
        let leavingPlayerId = null;
        let leavingUsername = null;
        Object.keys(room.players).forEach(key => {
            if (room.players[key].id === playerId) {
                leavingPlayerId = parseInt(key);
                leavingUsername = room.players[key].username || `玩家${leavingPlayerId}`;
                delete room.players[key];
            }
        });

        if (leavingPlayerId) {
            io.to(roomId).emit(MessageTypes.PLAYER_LEFT, {
                playerId: leavingPlayerId,
                username: leavingUsername
            });

            Object.keys(room.players).forEach(existingPlayerId => {
                const existingPlayer = room.players[existingPlayerId];
                existingPlayer.ready = false;
                io.to(existingPlayer.id).emit(MessageTypes.PLAYER_READY, {
                    playerId: parseInt(existingPlayerId),
                    ready: false
                });

                const playerObj = players.get(existingPlayer.id);
                if (playerObj) {
                    playerObj.classicSettings = null;
                    playerObj.isConfirmed = false;
                }
            });

            const leavingPlayer = players.get(playerId);
            if (leavingPlayer) {
                leavingPlayer.ready = false;
                leavingPlayer.isConfirmed = false;
                leavingPlayer.classicSettings = null;
            }

            const playerCount = Object.keys(room.players).length;
            if (playerCount === 0) {
                // 停止道具生成计时器
                ItemHandler.stopItemSpawnTimer(room);

                // 停止乱斗模式计时器
                if (room.physicsState && room.physicsState.chaosTimer) {
                    clearInterval(room.physicsState.chaosTimer);
                    room.physicsState.chaosTimer = null;
                }

                rooms.delete(roomId);
            }

            const player = players.get(playerId);
            if (player) {
                player.roomId = null;
                player.playerId = null;
                player.ready = false;
            }

            sendRoomList();
        }
    }
}

// 构建 context 对象传递给 socket handlers
const context = {
    io,
    rooms,
    players,
    waitQueue,
    sendRoomList,
    leaveRoom
};

// 注册 Socket.io 事件处理
io.on('connection', (socket) => {
    // 增加在线玩家计数
    onlinePlayerCount++;
    console.log('玩家连接:', socket.id, '当前在线人数:', onlinePlayerCount);
    
    // 广播在线人数给所有玩家
    io.emit(MessageTypes.ONLINE_PLAYERS, {
        count: onlinePlayerCount
    });
    
    // 注册事件处理器
    registerSocketHandlers(socket, context);
    
    // 监听断开连接事件
    socket.on('disconnect', () => {
        // 减少在线玩家计数
        onlinePlayerCount = Math.max(0, onlinePlayerCount - 1);
        console.log('玩家断开连接:', socket.id, '当前在线人数:', onlinePlayerCount);
        
        // 广播在线人数给所有玩家
        io.emit(MessageTypes.ONLINE_PLAYERS, {
            count: onlinePlayerCount
        });
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`游戏版本: ${GameConfig.network.version}`);
});
