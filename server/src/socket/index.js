/**
 * Socket.io 事件处理入口
 * 负责注册所有 socket 事件处理程序
 */

const ConnectionHandler = require('./ConnectionHandler');
const RoomHandler = require('./RoomHandler');
const GameHandler = require('./GameHandler');
const SkillSelectionHandler = require('./SkillSelectionHandler');

/**
 * 注册所有 socket 事件处理
 * @param {Socket} socket - socket.io 连接
 * @param {Object} context - 包含 io, rooms, players 等共享状态
 */
function registerSocketHandlers(socket, context) {
    const { io, rooms, players, waitQueue } = context;

    // 连接/断开处理
    ConnectionHandler.register(socket, context);

    // 房间管理
    RoomHandler.register(socket, context);

    // 游戏逻辑（玩家操作、物理循环、回合）
    GameHandler.register(socket, context);

    // 技能选择流程（经典/技能模式）
    SkillSelectionHandler.register(socket, context);
}

module.exports = { registerSocketHandlers };
