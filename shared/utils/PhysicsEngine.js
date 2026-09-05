/**
 * 物理引擎
 * 客户端和服务端共用
 * 处理碰撞检测和物理计算
 */

const PhysicsEngine = {
    /**
     * 更新棋子位置
     * @param {Object} piece - 棋子对象
     */
    updatePiece(piece) {
        if (!piece.isActive || piece.isDragging) return;

        piece.x += piece.vx;
        piece.y += piece.vy;

        piece.vx *= piece.friction;
        piece.vy *= piece.friction;

        if (Math.abs(piece.vx) < piece.minVelocity) piece.vx = 0;
        if (Math.abs(piece.vy) < piece.minVelocity) piece.vy = 0;
    },

    /**
     * 检查两个棋子之间的碰撞
     * @param {Object} p1 - 棋子1
     * @param {Object} p2 - 棋子2
     * @param {number} currentPlayer - 当前回合的玩家ID
     * @returns {boolean} 是否发生碰撞
     */
    checkPieceCollision(p1, p2, currentPlayer = null) {
        if (!p1.isActive || !p2.isActive) return false;

        // 无形状态碰撞检测
        // 只有当无形棋子不属于当前回合的玩家时，才穿透（即不碰撞）
        // 这样在当前回合玩家的行动时，无形棋子仍可碰撞
        if (p1.isIntangible && p1.player !== currentPlayer) return false;
        if (p2.isIntangible && p2.player !== currentPlayer) return false;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = p1.radius + p2.radius;

        return distance < minDistance;
    },

    /**
     * 处理两个棋子之间的碰撞
     * @param {Object} p1 - 棋子1
     * @param {Object} p2 - 棋子2
     */
    resolvePieceCollision(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = p1.radius + p2.radius;

        if (distance >= minDistance) return;

        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // 旋转速度到碰撞坐标系
        const vx1 = p1.vx * cos + p1.vy * sin;
        const vy1 = p1.vy * cos - p1.vx * sin;
        const vx2 = p2.vx * cos + p2.vy * sin;
        const vy2 = p2.vy * cos - p2.vx * sin;

        // 一维弹性碰撞
        const m1 = p1.mass;
        const m2 = p2.mass;
        const totalMass = m1 + m2;

        const pieceRestitution = typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.restitution ? GAME_CONFIG.restitution.piece : 1.0;
        const finalVx1 = pieceRestitution * ((m1 - m2) * vx1 + 2 * m2 * vx2) / totalMass;
        const finalVx2 = pieceRestitution * ((m2 - m1) * vx2 + 2 * m1 * vx1) / totalMass;

        // 旋转回原坐标系
        p1.vx = finalVx1 * cos - vy1 * sin;
        p1.vy = vy1 * cos + finalVx1 * sin;
        p2.vx = finalVx2 * cos - vy2 * sin;
        p2.vy = vy2 * cos + finalVx2 * sin;

        // 分离重叠的棋子
        const overlap = minDistance - distance;
        const separationX = (overlap / 2) * cos;
        const separationY = (overlap / 2) * sin;

        p1.x -= separationX;
        p1.y -= separationY;
        p2.x += separationX;
        p2.y += separationY;

        // 返回相对速度（用于音效等）
        return Math.sqrt((p1.vx - p2.vx) ** 2 + (p1.vy - p2.vy) ** 2);
    },

    /**
     * 检查棋子与墙壁的碰撞
     * @param {Object} piece - 棋子
     * @param {Object} wall - 墙壁 {x, y, endX, endY, thickness}
     * @returns {boolean} 是否发生碰撞
     */
    checkWallCollision(piece, wall) {
        const { x, y, endX, endY, thickness } = wall;

        // 计算线段的向量
        const wallVecX = endX - x;
        const wallVecY = endY - y;
        const wallLength = Math.sqrt(wallVecX * wallVecX + wallVecY * wallVecY);

        // 计算棋子到线段的最近点
        const pieceVecX = piece.x - x;
        const pieceVecY = piece.y - y;

        const dotProduct = pieceVecX * wallVecX + pieceVecY * wallVecY;
        const t = Math.max(0, Math.min(1, dotProduct / (wallLength * wallLength)));

        const closestX = x + t * wallVecX;
        const closestY = y + t * wallVecY;

        // 计算棋子到最近点的距离
        const dx = piece.x - closestX;
        const dy = piece.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 如果距离小于棋子半径加上墙壁厚度的一半，则发生碰撞
        const collisionDistance = piece.radius + thickness / 2;

        return distance < collisionDistance;
    },

    /**
     * 处理棋子与墙壁的碰撞
     * @param {Object} piece - 棋子
     * @param {Object} wall - 墙壁
     */
    resolveWallCollision(piece, wall) {
        const { x, y, endX, endY, thickness } = wall;

        const wallVecX = endX - x;
        const wallVecY = endY - y;
        const wallLength = Math.sqrt(wallVecX * wallVecX + wallVecY * wallVecY);

        const pieceVecX = piece.x - x;
        const pieceVecY = piece.y - y;

        const dotProduct = pieceVecX * wallVecX + pieceVecY * wallVecY;
        const t = Math.max(0, Math.min(1, dotProduct / (wallLength * wallLength)));

        const closestX = x + t * wallVecX;
        const closestY = y + t * wallVecY;

        const dx = piece.x - closestX;
        const dy = piece.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const collisionDistance = piece.radius + thickness / 2;

        if (distance >= collisionDistance) return;

        // 计算碰撞法线
        let normalX = dx / distance;
        let normalY = dy / distance;

        // 计算碰撞深度
        const depth = collisionDistance - distance;

        // 分离棋子
        piece.x += normalX * depth;
        piece.y += normalY * depth;

        // 计算反弹速度
        const dot = piece.vx * normalX + piece.vy * normalY;
        piece.vx -= 2 * dot * normalX;
        piece.vy -= 2 * dot * normalY;

        // 减少速度以模拟能量损失
        const wallRestitution = typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.restitution ? GAME_CONFIG.restitution.wall : 0.8;
        piece.vx *= wallRestitution;
        piece.vy *= wallRestitution;

        // 返回碰撞速度（用于音效等）
        return Math.sqrt((piece.vx + 2 * dot * normalX) ** 2 + (piece.vy + 2 * dot * normalY) ** 2);
    },

    /**
     * 检查棋子是否出界
     * @param {Object} piece - 棋子
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     * @returns {boolean} 是否出界
     */
    checkOutOfBounds(piece, width, height) {
        if (!piece.isActive) return false;

        // 棋子圆心超出边界就判死亡
        return piece.x < 0 ||
               piece.x > width ||
               piece.y < 0 ||
               piece.y > height;
    },

    /**
     * 计算拖拽力度
     * @param {number} dragDistance - 拖拽距离
     * @param {number} maxDragDistance - 最大拖拽距离
     * @param {number} maxPowerScale - 最大力度值
     * @param {number} powerCurveExponent - 力度曲线指数
     * @returns {number} 力度比例（0-1）
     */
    calculateDragPower(dragDistance, maxDragDistance, maxPowerScale, powerCurveExponent) {
        return Math.min(Math.pow(dragDistance / maxDragDistance, powerCurveExponent), 1) * maxPowerScale;
    },

    /**
     * 检查所有棋子是否都停止移动
     * @param {Array} pieces - 棋子数组
     * @returns {boolean} 是否全部停止
     */
    checkAllStopped(pieces) {
        for (let piece of pieces) {
            if (piece.isActive && (Math.abs(piece.vx) > 0.01 || Math.abs(piece.vy) > 0.01)) {
                return false;
            }
        }
        return true;
    },

    /**
     * 生成随机墙壁
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     * @param {Array} pieces - 棋子数组（用于避免重叠）
     * @param {Array} existingWalls - 已有墙壁数组
     * @param {Object} config - 墙壁生成配置
     * @returns {Object|null} 新墙壁对象或null
     */
    generateWall(width, height, pieces, existingWalls, config) {
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            attempts++;

            // 随机生成墙壁长度
            const length = Math.floor(Math.random() * (config.MAX_LENGTH - config.MIN_LENGTH + 1)) + config.MIN_LENGTH;

            // 随机生成墙壁方向
            const angle = Math.random() * Math.PI * 2;

            // 随机生成墙壁中点位置
            const midX = Math.floor(Math.random() * width);
            const midY = Math.floor(Math.random() * height);

            // 根据中点、长度和角度计算起点和终点
            const halfLength = length / 2;
            const x = midX - Math.cos(angle) * halfLength;
            const y = midY - Math.sin(angle) * halfLength;
            const endX = midX + Math.cos(angle) * halfLength;
            const endY = midY + Math.sin(angle) * halfLength;

            // 检查墙壁是否完全在棋盘内
            if (x < 0 || x > width || y < 0 || y > height ||
                endX < 0 || endX > width || endY < 0 || endY > height) {
                continue;
            }

            // 检查是否与棋子重叠
            let isOverlapping = false;
            for (let piece of pieces) {
                if (piece.isActive) {
                    if (this.isPointNearLine(piece.x, piece.y, x, y, endX, endY, piece.radius + config.MIN_DISTANCE_FROM_PIECES)) {
                        isOverlapping = true;
                        break;
                    }
                }
            }

            if (isOverlapping) continue;

            // 检查是否与已有墙壁距离太近
            let tooCloseToWall = false;
            for (let wall of existingWalls) {
                const wallMidX = (wall.x + wall.endX) / 2;
                const wallMidY = (wall.y + wall.endY) / 2;

                const dx = midX - wallMidX;
                const dy = midY - wallMidY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < config.MIN_DISTANCE_FROM_WALLS) {
                    tooCloseToWall = true;
                    break;
                }
            }

            if (tooCloseToWall) continue;

            // 如果通过所有检查，返回墙壁
            return { x, y, endX, endY, thickness: config.THICKNESS };
        }

        return null;
    },

    /**
     * 检查点是否在线段附近
     * @param {number} px - 点x坐标
     * @param {number} py - 点y坐标
     * @param {number} x1 - 线段起点x
     * @param {number} y1 - 线段起点y
     * @param {number} x2 - 线段终点x
     * @param {number} y2 - 线段终点y
     * @param {number} radius - 距离阈值
     * @returns {boolean} 是否在线段附近
     */
    isPointNearLine(px, py, x1, y1, x2, y2, radius) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }
};

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhysicsEngine;
}
