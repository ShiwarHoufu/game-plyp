/**
 * 棋子创建工厂
 * 消除重复的棋子创建代码
 */
const { GameConfig } = require('../../../shared');

/**
 * 创建棋子数组
 * @param {string} mode - 游戏模式 ('classic', 'skill', 'chaos', 'chaos4')
 * @param {Object} positions - PositionCalculator 计算的位置 { player1: [...], player2: [...] } 或 chaos4 { player1: [...], player2: [...], player3: [...], player4: [...] }
 * @param {Array} player1Skills - 玩家1的技能数组
 * @param {Array} player2Skills - 玩家2的技能数组
 * @param {Object} playerSettings - 玩家设置 { 1: { playerColor }, 2: { playerColor }, 3: {...}, 4: {...} }
 * @param {number} pieceCount - 每位玩家的棋子数量
 * @param {Object} room - 房间对象（用于生成 piece id）
 * @param {boolean} isChaos4 - 是否为4人乱斗模式
 * @returns {Array} 棋子数组
 */
function createPieces(mode, positions, player1Skills, player2Skills, playerSettings, pieceCount, room, isChaos4 = false) {
    const pieces = [];
    let pieceIdCounter = 1;

    if (isChaos4 && positions.player3 && positions.player4) {
        // 4人乱斗模式
        for (let player = 1; player <= 4; player++) {
            const skills = player === 1 ? player1Skills : (player === 2 ? player2Skills : null);
            const playerPosKey = `player${player}`;
            const color = playerSettings[player]?.playerColor || GameConfig.playerColors[`player${player}`] || '#ffffff';
            const skinId = playerSettings[player]?.playerSkinId || 'default';

            for (let i = 0; i < pieceCount; i++) {
                const skill = (mode === 'skill' && skills && skills[i]) ? skills[i] : null;
                pieces.push(createPiece(
                    room ? `piece_${room.id}_${pieceIdCounter++}` : `piece_${pieceIdCounter++}`,
                    positions[playerPosKey][i].x,
                    positions[playerPosKey][i].y,
                    skill,
                    player,
                    skill && skill.color ? skill.color : color,
                    mode,
                    skinId
                ));
            }
        }
    } else {
        // 创建玩家1的棋子
        const player1SkinId = playerSettings[1]?.playerSkinId || 'default';
        for (let i = 0; i < pieceCount; i++) {
            const skill = (mode === 'skill' && player1Skills && player1Skills[i]) ? player1Skills[i] : null;
            pieces.push(createPiece(
                room ? `piece_${room.id}_${pieceIdCounter++}` : `piece_${pieceIdCounter++}`,
                positions.player1[i].x,
                positions.player1[i].y,
                skill,
                1,
                skill && skill.color ? skill.color : playerSettings[1].playerColor,
                mode,
                player1SkinId
            ));
        }

        // 创建玩家2的棋子
        const player2SkinId = playerSettings[2]?.playerSkinId || 'default';
        for (let i = 0; i < pieceCount; i++) {
            const skill = (mode === 'skill' && player2Skills && player2Skills[i]) ? player2Skills[i] : null;
            pieces.push(createPiece(
                room ? `piece_${room.id}_${pieceIdCounter++}` : `piece_${pieceIdCounter++}`,
                positions.player2[i].x,
                positions.player2[i].y,
                skill,
                2,
                skill && skill.color ? skill.color : playerSettings[2].playerColor,
                mode,
                player2SkinId
            ));
        }
    }

    return pieces;
}

/**
 * 创建单个棋子
 */
function createPiece(id, x, y, skill, player, color, mode, skinId = 'default') {
    // 乱斗模式使用专属配置
    const config = mode === 'chaos4' ? GameConfig.chaos4 : (mode === 'chaos' ? GameConfig.chaos : GameConfig);
    return {
        id,
        x,
        y,
        initialX: x,
        initialY: y,
        vx: 0,
        vy: 0,
        radius: config.pieceRadius,
        mass: config.pieceMass,
        friction: config.pieceFriction,
        minVelocity: config.pieceMinVelocity,
        maxPowerScale: config.maxPowerScale,
        color,
        player,
        skinId,
        isActive: true,
        isIntangible: false,
        skillActive: false,
        skill: skill,
        skillUsed: false,
        skillUses: 0,
        skillUsesThisTurn: 0,
        skillTurnsRemaining: 0,
        isClone: false,
        clonePiece: null,
        clonePlaced: false,
        doubleStrikeCount: 0,
        originalPiece: null
    };
}

module.exports = { createPieces, createPiece };
