/**
 * 技能选择流程处理：经典模式颜色选择、技能模式技能选择、乱斗模式颜色选择
 */
const { MessageTypes, GameConfig, PositionCalculator } = require('../../../shared');
const PieceFactory = require('../game/PieceFactory');
const GameHandler = require('./GameHandler');

/**
 * 注册技能选择相关事件处理
 */
function register(socket, context) {
    const { io, rooms, players } = context;

    // 联网经典模式确认设置
    socket.on(MessageTypes.NETWORK_CLASSIC_CONFIRM, (data) => {
        console.log('联网经典模式设置确认:', socket.id, data);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // 检查玩家是否已经确认过，确认后不能再取消
            if (player.classicSettings && data.confirmed === false) {
                console.log('玩家已确认，无法取消:', socket.id);
                socket.emit(MessageTypes.ERROR, {
                    message: '已经确认选择，无法取消'
                });
                return;
            }

            const room = rooms.get(player.roomId);
            if (room) {
                // 检查冲突
                let hasConflict = false;
                let conflictPlayerId = null;
                const currentPlayerSkinId = data.playerSkinId || 'default';
                Object.values(room.players).forEach(p => {
                    if (p.id !== socket.id) {
                        const otherPlayer = players.get(p.id);
                        if (otherPlayer && otherPlayer.classicSettings) {
                            const otherSkinId = otherPlayer.classicSettings.playerSkinId || 'default';
                            // 情况1：双方都使用默认皮肤 → 检查颜色冲突
                            // 情况2：双方使用相同的特殊皮肤 → 冲突
                            if (currentPlayerSkinId === 'default' && otherSkinId === 'default') {
                                if (otherPlayer.classicSettings.playerColor === data.playerColor) {
                                    hasConflict = true;
                                    conflictPlayerId = otherPlayer.playerId;
                                }
                            } else if (currentPlayerSkinId === otherSkinId && currentPlayerSkinId !== 'default') {
                                hasConflict = true;
                                conflictPlayerId = otherPlayer.playerId;
                            }
                        }
                    }
                });

                if (hasConflict) {
                    console.log('选择冲突:', socket.id, 'skin:', currentPlayerSkinId, 'color:', data.playerColor);
                    socket.emit(MessageTypes.ERROR, {
                        message: '选择与对手重复！请重新选择'
                    });
                    return;
                }

                // 更新玩家设置
                player.classicSettings = {
                    playerColor: data.playerColor,
                    playerSkinId: data.playerSkinId || 'default',
                    trailEffect: data.trailEffect || 'trail_white'
                };

                // 广播玩家颜色选择（用于4人乱斗模式显示）
                io.to(player.roomId).emit(MessageTypes.PLAYER_READY, {
                    playerId: player.playerId,
                    ready: true,
                    playerColor: data.playerColor,
                    playerSkinId: data.playerSkinId || 'default',
                    trailEffect: data.trailEffect || 'trail_white'
                });

                // 检查是否所有玩家都已确认
                const allConfirmed = Object.values(room.players).every(p => {
                    const playerObj = players.get(p.id);
                    return playerObj && playerObj.classicSettings;
                });

                if (allConfirmed) {
                    console.log('所有玩家都已确认经典模式设置，开始游戏:', room.id);

                    // 收集所有玩家的设置
                    const playerSettings = {};
                    Object.values(room.players).forEach(p => {
                        const playerObj = players.get(p.id);
                        if (playerObj) {
                            playerSettings[playerObj.playerId] = {
                                pieceCount: room.pieceCount,
                                playerColor: playerObj.classicSettings.playerColor,
                                playerSkinId: playerObj.classicSettings.playerSkinId || 'default',
                                trailEffect: playerObj.classicSettings.trailEffect || 'trail_white'
                            };
                        }
                    });

                    // 4人乱斗模式使用不同的位置计算
                    const isChaos4 = room.mode === 'chaos4';
                    let positions;
                    if (isChaos4) {
                        const boardSize = GameConfig.chaos4CanvasWidth;
                        positions = PositionCalculator.calculateChaos4Positions(boardSize, room.pieceCount);
                    } else {
                        positions = PositionCalculator.calculatePositions(
                            GameConfig.canvasWidth,
                            GameConfig.canvasHeight,
                            room.pieceCount,
                            room.mode
                        );
                    }

                    room.physicsState.pieces = PieceFactory.createPieces(
                        room.mode,
                        positions,
                        null, // 经典模式没有技能
                        null,
                        playerSettings,
                        room.pieceCount,
                        room,
                        isChaos4
                    );

                    console.log('[NETWORK_CLASSIC_START] 服务器棋子初始化完成，共', room.physicsState.pieces.length, '颗棋子');

                    io.to(room.id).emit(MessageTypes.NETWORK_CLASSIC_START, {
                        roomId: room.id,
                        mode: room.mode,
                        pieceCount: room.pieceCount,
                        generateTerrain: room.generateTerrain,
                        playerSettings: playerSettings,
                        currentPlayer: room.currentPlayer,
                        turnCount: room.turnCount,
                        initialPieces: room.physicsState.pieces.map(p => serializePiece(p)),
                        walls: room.physicsState.walls
                    });

                    // 乱斗模式：立即启动连续物理循环
                    if (room.mode === 'chaos' || room.mode === 'chaos4') {
                        room.gameStarted = true; // 标记游戏已开始，隐藏房间列表
                        GameHandler.startChaosPhysicsLoop(room, io, context);
                    }

                    // 重置玩家的经典模式确认状态，为下一局做准备
                    Object.values(room.players).forEach(p => {
                        const playerObj = players.get(p.id);
                        if (playerObj) {
                            playerObj.classicSettings = null;
                            playerObj.isConfirmed = false;
                        }
                    });
                }
            }
        }
    });

    // 联网技能模式 - 技能选择
    socket.on(MessageTypes.NETWORK_SKILL_SELECT, (data) => {
        console.log('技能选择收到:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('玩家未找到或未在房间中');
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room || !room.skillSelection) {
            console.log('房间或技能选择状态未找到');
            return;
        }

        const sel = room.skillSelection;
        const playerId = player.playerId;

        // 验证是否是当前选择玩家
        if (sel.currentSelectingPlayer !== playerId) {
            console.log('不是该玩家的选择回合，拒绝选择');
            socket.emit(MessageTypes.ERROR, { message: '不是您的回合' });
            return;
        }

        // 验证是否在技能选择阶段
        if (sel.currentPhase !== 'skill') {
            console.log('当前不是技能选择阶段:', sel.currentPhase);
            return;
        }

        // 验证是否已选过该技能
        const playerSkills = playerId === 1 ? sel.player1Skills : sel.player2Skills;
        if (playerSkills.includes(data.skillId)) {
            console.log('该技能已选择:', data.skillId);
            return;
        }

        // 添加技能到对应玩家
        if (playerId === 1) {
            sel.player1Skills.push(data.skillId);
        } else {
            sel.player2Skills.push(data.skillId);
        }
        console.log('技能添加成功，当前状态 - P1:', sel.player1Skills, 'P2:', sel.player2Skills);

        // 检查是否全部选择完成（双方都选了pieceCount个）
        if (sel.player1Skills.length >= sel.pieceCount &&
            sel.player2Skills.length >= sel.pieceCount) {
            sel.currentPhase = 'global';
            sel.currentSelectingPlayer = 1;
            console.log('进入全局技能选择阶段');

            io.to(room.id).emit(MessageTypes.NETWORK_SKILL_TURN, {
                roomId: room.id,
                phase: 'global',
                currentSelectingPlayer: 1,
                player1Skills: sel.player1Skills,
                player2Skills: sel.player2Skills
            });
        } else {
            sel.currentSelectingPlayer = playerId === 1 ? 2 : 1;
            console.log('切换到玩家:', sel.currentSelectingPlayer);

            io.to(room.id).emit(MessageTypes.NETWORK_SKILL_SELECTED, {
                roomId: room.id,
                playerId: playerId,
                skillId: data.skillId,
                currentSelectingPlayer: sel.currentSelectingPlayer,
                player1Skills: sel.player1Skills,
                player2Skills: sel.player2Skills
            });
        }
    });

    // 联网技能模式 - 全局技能选择
    socket.on(MessageTypes.NETWORK_SKILL_GLOBAL_SELECT, (data) => {
        console.log('全局技能选择:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room || !room.skillSelection) return;

        const sel = room.skillSelection;
        const playerId = player.playerId;

        if (sel.currentSelectingPlayer !== playerId) {
            console.log('不是该玩家的选择回合:', playerId, sel.currentSelectingPlayer);
            return;
        }

        if (sel.currentPhase !== 'global') {
            console.log('当前不是全局技能选择阶段:', sel.currentPhase);
            return;
        }

        if (playerId === 1 && sel.player1GlobalSkill) {
            console.log('玩家1已选择过全局技能');
            return;
        }
        if (playerId === 2 && sel.player2GlobalSkill) {
            console.log('玩家2已选择过全局技能');
            return;
        }

        if (playerId === 1) {
            sel.player1GlobalSkill = data.globalSkillId;
        } else {
            sel.player2GlobalSkill = data.globalSkillId;
        }

        console.log('玩家', playerId, '选择了全局技能', data.globalSkillId);

        // 检查是否全部选择完成
        if (sel.player1GlobalSkill && sel.player2GlobalSkill) {
            console.log('双方都选择了全局技能，广播结果后开始游戏');

            io.to(room.id).emit(MessageTypes.NETWORK_SKILL_GLOBAL_SELECTED, {
                roomId: room.id,
                playerId: playerId,
                globalSkillId: data.globalSkillId,
                player1GlobalSkill: sel.player1GlobalSkill,
                player2GlobalSkill: sel.player2GlobalSkill,
                currentSelectingPlayer: 0
            });

            // 收集技能设置
            const player1Skills = sel.player1Skills.map(skillId => getSkillById(skillId));
            const player2Skills = sel.player2Skills.map(skillId => getSkillById(skillId));
            const player1GlobalSkill = getSkillById(sel.player1GlobalSkill);
            const player2GlobalSkill = getSkillById(sel.player2GlobalSkill);

            // 使用 PieceFactory 创建棋子
            const positions = PositionCalculator.calculatePositions(
                GameConfig.canvasWidth,
                GameConfig.canvasHeight,
                room.pieceCount,
                room.mode
            );

            const playerSettings = {
                1: { playerColor: '#ff6b6b' },
                2: { playerColor: '#4ecdc4' }
            };

            room.physicsState.pieces = PieceFactory.createPieces(
                room.mode,
                positions,
                player1Skills,
                player2Skills,
                playerSettings,
                room.pieceCount,
                room
            );

            console.log('[NETWORK_SKILL_START] 服务器棋子初始化完成，共', room.physicsState.pieces.length, '颗棋子');

            setTimeout(() => {
                io.to(room.id).emit(MessageTypes.NETWORK_SKILL_START, {
                    roomId: room.id,
                    mode: room.mode,
                    pieceCount: room.pieceCount,
                    generateTerrain: room.generateTerrain,
                    player1Skills: player1Skills,
                    player2Skills: player2Skills,
                    player1GlobalSkill: player1GlobalSkill,
                    player2GlobalSkill: player2GlobalSkill,
                    currentPlayer: room.currentPlayer,
                    turnCount: room.turnCount,
                    initialPieces: room.physicsState.pieces.map(p => serializePiece(p)),
                    walls: room.physicsState.walls
                });

                room.skillSelection = null;
            }, 500);
        } else {
            sel.currentSelectingPlayer = playerId === 1 ? 2 : 1;

            io.to(room.id).emit(MessageTypes.NETWORK_SKILL_GLOBAL_SELECTED, {
                roomId: room.id,
                playerId: playerId,
                globalSkillId: data.globalSkillId,
                player1GlobalSkill: sel.player1GlobalSkill,
                player2GlobalSkill: sel.player2GlobalSkill,
                currentSelectingPlayer: sel.currentSelectingPlayer
            });
        }
    });

    // 联网技能模式 - 确认选择
    socket.on(MessageTypes.NETWORK_SKILL_CONFIRM, (data) => {
        console.log('技能选择确认:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room || !room.skillSelection) return;

        const sel = room.skillSelection;
        const playerId = player.playerId;

        if (sel.currentPhase !== 'confirm') {
            console.log('当前不是确认阶段:', sel.currentPhase);
            return;
        }

        if (playerId === 1) {
            sel.player1Confirmed = true;
        } else {
            sel.player2Confirmed = true;
        }

        io.to(room.id).emit(MessageTypes.NETWORK_SKILL_TURN, {
            roomId: room.id,
            phase: 'confirm',
            playerId: playerId,
            confirmed: true,
            player1Confirmed: sel.player1Confirmed,
            player2Confirmed: sel.player2Confirmed
        });

        // 检查是否所有玩家都已确认
        if (sel.player1Confirmed && sel.player2Confirmed) {
            console.log('所有玩家都已确认，开始游戏:', room.id);

            const player1Skills = sel.player1Skills.map(skillId => getSkillById(skillId));
            const player2Skills = sel.player2Skills.map(skillId => getSkillById(skillId));
            const player1GlobalSkill = getSkillById(sel.player1GlobalSkill);
            const player2GlobalSkill = getSkillById(sel.player2GlobalSkill);

            const positions = PositionCalculator.calculatePositions(
                GameConfig.canvasWidth,
                GameConfig.canvasHeight,
                room.pieceCount,
                room.mode
            );

            const playerSettings = {
                1: { playerColor: '#ff6b6b' },
                2: { playerColor: '#4ecdc4' }
            };

            room.physicsState.pieces = PieceFactory.createPieces(
                room.mode,
                positions,
                player1Skills,
                player2Skills,
                playerSettings,
                room.pieceCount,
                room
            );

            console.log('[NETWORK_SKILL_START] 服务器棋子初始化完成，共', room.physicsState.pieces.length, '颗棋子');

            io.to(room.id).emit(MessageTypes.NETWORK_SKILL_START, {
                roomId: room.id,
                mode: room.mode,
                pieceCount: room.pieceCount,
                generateTerrain: room.generateTerrain,
                player1Skills: player1Skills,
                player2Skills: player2Skills,
                player1GlobalSkill: player1GlobalSkill,
                player2GlobalSkill: player2GlobalSkill,
                currentPlayer: room.currentPlayer,
                turnCount: room.turnCount,
                initialPieces: room.physicsState.pieces.map(p => serializePiece(p)),
                walls: room.physicsState.walls
            });

            room.skillSelection = null;
        }
    });
}

/**
 * 获取技能信息辅助函数
 */
function getSkillById(skillId) {
    const allSkills = {
        ...GameConfig.skills,
        ...GameConfig.globalSkills
    };
    return allSkills[skillId] || { id: skillId, name: skillId, color: '#ffffff' };
}

/**
 * 序列化棋子数据（用于网络传输）
 */
function serializePiece(piece) {
    return {
        id: piece.id,
        x: piece.x,
        y: piece.y,
        vx: piece.vx,
        vy: piece.vy,
        radius: piece.radius,
        mass: piece.mass,
        friction: piece.friction,
        minVelocity: piece.minVelocity,
        maxPowerScale: piece.maxPowerScale,
        color: piece.color,
        player: piece.player,
        skinId: piece.skinId || 'default',
        isActive: piece.isActive,
        isIntangible: piece.isIntangible,
        skillActive: piece.skillActive,
        skill: piece.skill
    };
}

module.exports = { register };
