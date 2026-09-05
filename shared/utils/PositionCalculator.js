/**
 * 位置计算器
 * 客户端和服务端共用
 * 计算棋子的初始放置位置
 */

class PositionCalculator {
    /**
     * 计算棋子的初始放置位置
     * @param {number} boardWidth - 棋盘宽度
     * @param {number} boardHeight - 棋盘高度
     * @param {number} pieceCount - 棋子数量
     * @param {string} mode - 游戏模式 ('classic' 或 'skill')
     * @returns {Object} 包含玩家1和玩家2棋子位置的对象
     */
    static calculatePositions(boardWidth, boardHeight, pieceCount, mode = 'classic') {
        const positions = {
            player1: [],
            player2: []
        };
        
        const player1BaseX = boardWidth * 0.13;
        const player2BaseX = boardWidth * 0.87;
        const columnOffset = 50; // 列间距
        
        if (mode === 'skill') {
            // 技能模式根据棋子数量调整位置，使用与经典模式相同的排列逻辑
            if (pieceCount <= 3) {
                // 2或3颗棋子：直线放置
                for (let i = 0; i < pieceCount; i++) {
                    const yPosition = boardHeight * (0.25 + (i / (pieceCount - 1)) * 0.5);
                    positions.player1.push({ x: player1BaseX, y: yPosition });
                    positions.player2.push({ x: player2BaseX, y: yPosition });
                }
            } else if (pieceCount === 4) {
                // 4颗棋子：分为两列，每列2个
                const column1YPositions = [boardHeight * 0.35, boardHeight * 0.65];
                const column2YPositions = [boardHeight * 0.35, boardHeight * 0.65];
                
                // 玩家1的棋子
                positions.player1.push({ x: player1BaseX - columnOffset, y: column1YPositions[0] });
                positions.player1.push({ x: player1BaseX - columnOffset, y: column1YPositions[1] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: column2YPositions[0] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: column2YPositions[1] });
                
                // 玩家2的棋子
                positions.player2.push({ x: player2BaseX - columnOffset, y: column1YPositions[0] });
                positions.player2.push({ x: player2BaseX - columnOffset, y: column1YPositions[1] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: column2YPositions[0] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: column2YPositions[1] });
            } else if (pieceCount === 5) {
                // 5颗棋子：分为两列，后方3个，前方2个，呈梯形
                const backColumnYPositions = [boardHeight * 0.25, boardHeight * 0.5, boardHeight * 0.75];
                const frontColumnYPositions = [boardHeight * 0.35, boardHeight * 0.65];
                
                // 玩家1的棋子
                positions.player1.push({ x: player1BaseX - columnOffset, y: backColumnYPositions[0] });
                positions.player1.push({ x: player1BaseX - columnOffset, y: backColumnYPositions[1] });
                positions.player1.push({ x: player1BaseX - columnOffset, y: backColumnYPositions[2] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: frontColumnYPositions[0] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: frontColumnYPositions[1] });
                
                // 玩家2的棋子
                positions.player2.push({ x: player2BaseX - columnOffset, y: backColumnYPositions[0] });
                positions.player2.push({ x: player2BaseX - columnOffset, y: backColumnYPositions[1] });
                positions.player2.push({ x: player2BaseX - columnOffset, y: backColumnYPositions[2] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: frontColumnYPositions[0] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: frontColumnYPositions[1] });
            }
        } else {
            // 经典模式根据棋子数量调整位置
            if (pieceCount <= 3) {
                // 2或3颗棋子：直线放置
                for (let i = 0; i < pieceCount; i++) {
                    const yPosition = boardHeight * (0.25 + (i / (pieceCount - 1)) * 0.5);
                    positions.player1.push({ x: player1BaseX, y: yPosition });
                    positions.player2.push({ x: player2BaseX, y: yPosition });
                }
            } else if (pieceCount === 4) {
                // 4颗棋子：分为两列，每列2个
                const column1YPositions = [boardHeight * 0.35, boardHeight * 0.65];
                const column2YPositions = [boardHeight * 0.35, boardHeight * 0.65];
                
                // 玩家1的棋子
                positions.player1.push({ x: player1BaseX - columnOffset, y: column1YPositions[0] });
                positions.player1.push({ x: player1BaseX - columnOffset, y: column1YPositions[1] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: column2YPositions[0] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: column2YPositions[1] });
                
                // 玩家2的棋子
                positions.player2.push({ x: player2BaseX - columnOffset, y: column1YPositions[0] });
                positions.player2.push({ x: player2BaseX - columnOffset, y: column1YPositions[1] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: column2YPositions[0] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: column2YPositions[1] });
            } else if (pieceCount === 5) {
                // 5颗棋子：分为两列，后方3个，前方2个，呈梯形
                const backColumnYPositions = [boardHeight * 0.25, boardHeight * 0.5, boardHeight * 0.75];
                const frontColumnYPositions = [boardHeight * 0.35, boardHeight * 0.65];
                
                // 玩家1的棋子
                positions.player1.push({ x: player1BaseX - columnOffset, y: backColumnYPositions[0] });
                positions.player1.push({ x: player1BaseX - columnOffset, y: backColumnYPositions[1] });
                positions.player1.push({ x: player1BaseX - columnOffset, y: backColumnYPositions[2] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: frontColumnYPositions[0] });
                positions.player1.push({ x: player1BaseX + columnOffset, y: frontColumnYPositions[1] });
                
                // 玩家2的棋子
                positions.player2.push({ x: player2BaseX - columnOffset, y: backColumnYPositions[0] });
                positions.player2.push({ x: player2BaseX - columnOffset, y: backColumnYPositions[1] });
                positions.player2.push({ x: player2BaseX - columnOffset, y: backColumnYPositions[2] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: frontColumnYPositions[0] });
                positions.player2.push({ x: player2BaseX + columnOffset, y: frontColumnYPositions[1] });
            }
        }
        
        return positions;
    }

    /**
     * 计算4人乱斗模式的棋子位置（正方形地图，四角放置）
     * @param {number} boardSize - 正方形地图边长（取宽高中的较小值）
     * @param {number} piecesPerPlayer - 每位玩家的棋子数量
     * @returns {Object} 包含4个玩家棋子位置的对象
     */
    static calculateChaos4Positions(boardSize, piecesPerPlayer) {
        const positions = {
            player1: [],
            player2: [],
            player3: [],
            player4: []
        };

        const margin = boardSize * 0.12;
        const cornerOffset = boardSize * 0.08;
        const spacing = boardSize * 0.12;

        // 四个角落位置（顺时针）
        // Player 1: 左下角, Player 2: 右下角, Player 3: 右上角, Player 4: 左上角
        const corners = [
            { x: margin + cornerOffset, y: boardSize - margin - cornerOffset },      // 左下
            { x: boardSize - margin - cornerOffset, y: boardSize - margin - cornerOffset }, // 右下
            { x: boardSize - margin - cornerOffset, y: margin + cornerOffset },      // 右上
            { x: margin + cornerOffset, y: margin + cornerOffset }                   // 左上
        ];

        for (let player = 1; player <= 4; player++) {
            const basePos = corners[player - 1];

            if (piecesPerPlayer <= 2) {
                // 2颗棋子：垂直排列
                for (let i = 0; i < piecesPerPlayer; i++) {
                    const yOffset = (i === 0) ? -spacing / 2 : spacing / 2;
                    positions[`player${player}`].push({
                        x: basePos.x,
                        y: basePos.y + yOffset
                    });
                }
            } else if (piecesPerPlayer === 3) {
                // 3颗棋子：L形
                positions[`player${player}`].push({ x: basePos.x - spacing / 2, y: basePos.y - spacing / 2 });
                positions[`player${player}`].push({ x: basePos.x + spacing / 2, y: basePos.y });
                positions[`player${player}`].push({ x: basePos.x - spacing / 2, y: basePos.y + spacing / 2 });
            } else if (piecesPerPlayer >= 4) {
                // 4颗棋子：2x2方阵
                for (let row = 0; row < 2; row++) {
                    for (let col = 0; col < 2; col++) {
                        positions[`player${player}`].push({
                            x: basePos.x + (col - 0.5) * spacing,
                            y: basePos.y + (row - 0.5) * spacing
                        });
                    }
                }
            }
        }

        return positions;
    }
}

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PositionCalculator;
}