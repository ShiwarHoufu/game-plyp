/**
 * 服务器工具函数
 */
const { MessageTypes } = require('../../../shared');

/**
 * 生成房间ID
 */
function generateRoomId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送房间列表到大厅
 */
function sendRoomList(io, rooms) {
    const roomList = [];
    rooms.forEach((room) => {
        // 隐藏已开始的4人乱斗房间
        if (room.mode === 'chaos4' && room.gameStarted) {
            return;
        }
        const playerCount = Object.keys(room.players).length;
        const maxPlayers = room.maxPlayers || 2;
        // 显示还有空位的房间（2人房显示1人，4人房显示1-3人）
        if (playerCount < maxPlayers) {
            roomList.push({
                id: room.id,
                name: room.name || room.id,
                players: playerCount,
                maxPlayers: maxPlayers,
                mode: room.mode,
                pieceCount: room.pieceCount,
                generateTerrain: room.generateTerrain || false
            });
        }
    });

    io.to('lobby').emit(MessageTypes.ROOM_LIST, {
        rooms: roomList
    });
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
    const friction = Number.isFinite(piece.friction) ? piece.friction : 0.971;
    const minVelocity = Number.isFinite(piece.minVelocity) ? piece.minVelocity : 0.15;

    const result = {
        id: piece.id,
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        radius: radius,
        mass: mass,
        friction: friction,
        minVelocity: minVelocity,
        color: piece.color,
        player: piece.player,
        skinId: piece.skinId || 'default',
        isActive: piece.isActive,
        isIntangible: piece.isIntangible,
        skillActive: piece.skillActive,
        skill: piece.skill,
        skillTurnsRemaining: piece.skillTurnsRemaining,
        isClone: piece.isClone || false
    };

    // 如果是分身，需要包含 originalPiece 的 ID，以便客户端能找到本体
    if (piece.isClone && piece.originalPiece) {
        result.originalPiece = { id: piece.originalPiece.id };
        console.log('[serializePiece] 分身', piece.id, '的 originalPiece.id =', piece.originalPiece.id);
    }

    // 只有非分身的棋子才包含 clonePlaced 字段
    // 分身的 clonePlaced 没有意义（始终为 false）
    if (!piece.isClone) {
        result.clonePlaced = piece.clonePlaced || false;
    }

    return result;
}

module.exports = {
    generateRoomId,
    sendRoomList,
    serializePiece
};
