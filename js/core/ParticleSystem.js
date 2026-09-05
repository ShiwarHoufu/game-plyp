/**
 * 粒子系统
 * 用于处理碰撞特效等粒子效果
 */

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 500; // 最大粒子数上限
    }

    /**
     * 生成碰撞粒子特效
     * @param {number} x - 碰撞位置X坐标
     * @param {number} y - 碰撞位置Y坐标
     * @param {string} color - 粒子颜色
     * @param {number} speed - 碰撞速度，用于调整特效强度
     */
    createCollisionParticles(x, y, color, speed) {
        // 最小速度阈值，低于此值不触发特效
        const minSpeedThreshold = 5;
        if (speed < minSpeedThreshold) return;

        // 粒子数量上限检查
        if (this.particles.length >= this.maxParticles) return;

        // 根据速度调整粒子数量和强度
        const particleCount = Math.min(Math.max(Math.floor(speed * 2), 20), 60);
        const baseSpeed = Math.min(speed * 2, 40);
        const lifeTime = Math.min(Math.max(speed / 6, 0.3), 1.0);

        // 火花颜色范围（橙红黄）
        const sparkColors = [
            { r: 255, g: 200, b: 50 },  // 亮黄
            { r: 255, g: 150, b: 20 },   // 橙黄
            { r: 255, g: 100, b: 10 },  // 橙色
            { r: 255, g: 60, b: 0 },    // 橙红
            { r: 255, g: 30, b: 0 },    // 深红
        ];

        for (let i = 0; i < particleCount; i++) {
            // 爆炸角度 - 全方向
            const angle = Math.random() * Math.PI * 2;
            // 爆炸速度 - 较高的速度让火花飞得更远
            const speedVariation = 0.5 + Math.random() * 0.8;
            const particleSpeed = baseSpeed * speedVariation;
            // 粒子大小 - 较小的火花颗粒
            const size = 1.5 + Math.random() * 3;
            // 粒子形状 - 3:火花形状（细长条）
            const shape = 3;
            // 随机选择一个火花颜色
            const sparkColor = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            // 火花发光效果
            const glow = { color: `rgb(${sparkColor.r}, ${sparkColor.g}, ${sparkColor.b})`, blur: 8 };

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * particleSpeed,
                vy: Math.sin(angle) * particleSpeed,
                size: size,
                shape: shape,
                color: sparkColor,
                life: lifeTime,
                maxLife: lifeTime,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 5,
                friction: 0.94 + Math.random() * 0.04,
                glow: glow
            });
        }
    }

    /**
     * 生成轨迹粒子 - 配置化版本
     * @param {number} x - 棋子位置X坐标
     * @param {number} y - 棋子位置Y坐标
     * @param {number} vx - 棋子速度X分量
     * @param {number} vy - 棋子速度Y分量
     * @param {string} color - 棋子颜色
     * @param {number} radius - 棋子半径
     * @param {string|Object} trailConfig - 拖尾效果配置（颜色字符串或配置对象）
     */
    createTrailParticles(x, y, vx, vy, color, radius, trailConfig) {
        // 计算速度
        const speed = Math.sqrt(vx * vx + vy * vy);
        const minTrailSpeed = 7; // 最小速度阈值

        if (speed < minTrailSpeed) return;

        // 粒子数量上限检查
        if (this.particles.length >= this.maxParticles) return;

        // 计算速度方向
        const angle = Math.atan2(vy, vx);

        // 在棋子尾部生成粒子
        // 尾部位置 = 当前位置 - 速度方向的反方向偏移
        const trailOffset = radius * 0.8;
        const trailX = x - Math.cos(angle) * trailOffset;
        const trailY = y - Math.sin(angle) * trailOffset;

        // 标准化拖尾配置
        const config = this._normalizeTrailConfig(trailConfig);

        for (let i = 0; i < config.particleCount; i++) {
            const particle = this._createTrailParticle(trailX, trailY, angle, speed, radius, config);
            this.particles.push(particle);
        }
    }

    /**
     * 标准化拖尾配置（统一使用 GAME_CONFIG 的默认值）
     * @param {string|Object} config - 拖尾效果配置或颜色字符串
     * @returns {Object} 标准化后的配置对象
     */
    _normalizeTrailConfig(config) {
        // 获取默认配置（使用 trail_white 作为基础）
        const defaultConfig = GAME_CONFIG.trailEffects.trail_white;

        // 如果是 undefined 或 null，使用默认配置
        if (!config) {
            return { ...defaultConfig };
        }

        // 如果是字符串（旧格式：纯颜色），从 GAME_CONFIG 中查找对应的拖尾效果并合并默认配置
        if (typeof config === 'string') {
            const trailId = 'trail_' + config;
            const matchedConfig = GAME_CONFIG.trailEffects[trailId] || defaultConfig;
            // 确保 color 被转换为 colors 数组
            const normalizedConfig = { ...matchedConfig };
            if (normalizedConfig.color && !normalizedConfig.colors) {
                normalizedConfig.colors = [normalizedConfig.color];
            }
            return { ...defaultConfig, ...normalizedConfig };
        }

        // 如果是对象但有 id，从 GAME_CONFIG 查找完整配置并合并
        if (config.id && GAME_CONFIG.trailEffects[config.id]) {
            const fullConfig = GAME_CONFIG.trailEffects[config.id];
            // 确保 color 被转换为 colors 数组
            const normalizedConfig = { ...fullConfig };
            if (normalizedConfig.color && !normalizedConfig.colors) {
                normalizedConfig.colors = [normalizedConfig.color];
            }
            const result = { ...defaultConfig, ...normalizedConfig, ...config };
            // 如果显式传入了 color 参数，用它覆盖 colors
            if (config.color) {
                result.colors = [config.color];
            }
            return result;
        }

        // 否则合并默认配置
        return { ...defaultConfig, ...config };
    }

    /**
     * 创建单个轨迹粒子
     */
    _createTrailParticle(trailX, trailY, angle, speed, radius, trailConfig) {
        const { colors, particleSize, particleShapes, life, friction, glow, movement } = trailConfig;

        // 随机偏移
        const randomAngle = angle + Math.PI + (Math.random() - 0.5) * 0.5;
        const randomDistance = Math.random() * radius * 1.0;
        const px = trailX + Math.cos(randomAngle) * randomDistance;
        const py = trailY + Math.sin(randomAngle) * randomDistance;

        // 计算粒子速度
        const particleSpeed = speed * (0.1 + Math.random() * 0.2);
        const movementOffset = this._calculateMovementOffset(angle, particleSpeed, movement);

        const pvx = -Math.cos(angle) * particleSpeed * 0.5 + movementOffset.x;
        const pvy = -Math.sin(angle) * particleSpeed * 0.5 + movementOffset.y;

        // 获取颜色
        const particleColor = this._getTrailColor(colors);

        // 获取形状
        const shape = this._getRandomShape(particleShapes);

        // 获取生命值
        const particleLife = life.min + Math.random() * (life.max - life.min);

        // 获取大小
        const size = particleSize.min + Math.random() * (particleSize.max - particleSize.min);

        return {
            x: px,
            y: py,
            vx: pvx,
            vy: pvy,
            size,
            shape,
            color: particleColor,
            life: particleLife,
            maxLife: particleLife,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 5,
            friction: friction + (Math.random() - 0.5) * 0.02,
            isTrail: true,
            glow,
            movement
        };
    }

    /**
     * 根据移动模式计算偏移量
     */
    _calculateMovementOffset(angle, speed, movement) {
        const { type, speed: moveSpeed, variance, ...typeParams } = movement;

        switch (type) {
            case 'spiral': {
                const radius = typeParams.spiralRadius || 3;
                const spiralAngle = angle + Math.PI * 0.5 + (Math.random() - 0.5);
                return {
                    x: Math.cos(spiralAngle) * radius * moveSpeed,
                    y: Math.sin(spiralAngle) * radius * moveSpeed
                };
            }
            case 'zigzag': {
                const zigzagAngle = (typeParams.zigzagAngle || 30) * Math.PI / 180;
                const direction = Math.random() > 0.5 ? 1 : -1;
                return {
                    x: Math.cos(angle + direction * zigzagAngle) * speed * moveSpeed * variance,
                    y: Math.sin(angle + direction * zigzagAngle) * speed * moveSpeed * variance
                };
            }
            case 'drift': {
                const driftAngle = (typeParams.driftAngle || 45) * Math.PI / 180;
                return {
                    x: Math.cos(driftAngle) * speed * moveSpeed * variance,
                    y: -Math.sin(driftAngle) * speed * moveSpeed * variance // 向上飘动
                };
            }
            case 'twinkle': {
                const twinkleSpeed = typeParams.twinkleSpeed || 8;
                return {
                    x: Math.sin(Date.now() * twinkleSpeed / 1000) * speed * moveSpeed * variance,
                    y: Math.cos(Date.now() * twinkleSpeed / 1000) * speed * moveSpeed * variance
                };
            }
            default: // 'straight'
                return {
                    x: (Math.random() - 0.5) * 2 * variance,
                    y: (Math.random() - 0.5) * 2 * variance
                };
        }
    }

    /**
     * 获取轨迹颜色
     */
    _getTrailColor(colors) {
        // 检查是否是彩虹效果（可能是字符串 'rainbow' 或数组 ['rainbow']）
        const isRainbow = colors === 'rainbow' || (Array.isArray(colors) && colors.includes('rainbow'));
        if (isRainbow) {
            const hue = Math.random() * 360;
            return this.hslToRgb(hue, 100, 50);
        }
        if (Array.isArray(colors)) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            return this.hexToRgb(color);
        }
        return this.hexToRgb(colors);
    }

    /**
     * 获取随机粒子形状
     */
    _getRandomShape(shapes) {
        const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
        const shapeMap = {
            'circle': 0,
            'square': 1,
            'diamond': 2,
            'spark': 3,
            'bubble': 4,
            'sparkle': 5,
            'jagged': 6
        };
        return shapeMap[shapeName] ?? 0;
    }

    /**
     * 将十六进制颜色转换为RGB对象
     */
    hexToRgb(hex) {
        hex = hex.replace('#', '');
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    /**
     * 将HSL转换为RGB对象
     */
    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;

        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }


    /**
     * 生成泡泡粒子特效（道具拾取时）
     * @param {number} x - 拾取位置X坐标
     * @param {number} y - 拾取位置Y坐标
     * @param {string} itemType - 道具类型
     */
    createBubbleParticles(x, y, itemType) {
        // 粒子数量上限检查
        if (this.particles.length >= this.maxParticles) return;

        // 根据道具类型确定颜色
        const itemColors = {
            quickRecovery: { r: 100, g: 255, b: 100 },   // 绿色
            freeze: { r: 100, g: 180, b: 255 },          // 蓝色
            sharedProsperity: { r: 255, g: 220, b: 80 }, // 黄色
            destiny: { r: 255, g: 80, b: 80 },            // 红色
            invisibility: { r: 180, g: 180, b: 180 },    // 灰色
            oneBody: { r: 155, g: 89, b: 182 }           // 紫色
        };

        const baseColor = itemColors[itemType] || { r: 200, g: 200, b: 200 };
        const particleCount = 15;
        const lifetime = 0.6;

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 40; // 扩散距离
            const targetX = x + Math.cos(angle) * distance;
            const targetY = y + Math.sin(angle) * distance;

            // 泡泡粒子
            this.particles.push({
                x: x,
                y: y,
                targetX: targetX,
                targetY: targetY,
                size: 3 + Math.random() * 5,
                shape: 4, // 泡泡形状（空心圆）
                color: baseColor,
                life: lifetime,
                maxLife: lifetime,
                rotation: 0,
                rotationSpeed: 0,
                friction: 1, // 不减速匀速扩散
                isBubble: true
            });
        }
    }

    /**
     * 颜色变化
     */
    varyColor(rgb, amount) {
        return {
            r: Math.min(255, Math.max(0, rgb.r + (Math.random() - 0.5) * amount)),
            g: Math.min(255, Math.max(0, rgb.g + (Math.random() - 0.5) * amount)),
            b: Math.min(255, Math.max(0, rgb.b + (Math.random() - 0.5) * amount))
        };
    }

    /**
     * 更新粒子
     * @param {number} deltaTime - 时间增量
     */
    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            // 泡泡粒子移动到目标位置
            if (particle.isBubble && particle.targetX !== undefined && particle.targetY !== undefined) {
                const dx = particle.targetX - particle.x;
                const dy = particle.targetY - particle.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 1) {
                    const speed = 120; // 扩散速度
                    particle.x += (dx / dist) * speed * deltaTime;
                    particle.y += (dy / dist) * speed * deltaTime;
                }

                // 泡泡逐渐变大
                const progress = 1 - (particle.life / particle.maxLife);
                particle.size = (3 + Math.random() * 2) * (1 + progress * 0.5);
            } else {
                // 更新位置
                particle.x += particle.vx * deltaTime;
                particle.y += particle.vy * deltaTime;

                // 应用摩擦力（减速）
                particle.vx *= particle.friction;
                particle.vy *= particle.friction;
            }

            // 旋转
            particle.rotation += particle.rotationSpeed * deltaTime;

            // 减少生命值
            particle.life -= deltaTime;

            // 移除死亡粒子
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * 绘制粒子
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    draw(ctx) {
        for (const particle of this.particles) {
            // 计算透明度
            const alpha = particle.life / particle.maxLife;
            const fadeAlpha = alpha * alpha; // 平方让淡出更自然

            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);

            const colorStr = `rgba(${Math.floor(particle.color.r)}, ${Math.floor(particle.color.g)}, ${Math.floor(particle.color.b)}, ${fadeAlpha})`;

            // 如果有发光效果，先绘制发光
            if (particle.glow) {
                ctx.shadowColor = particle.glow.color;
                ctx.shadowBlur = particle.glow.blur * fadeAlpha;
            }

            ctx.fillStyle = colorStr;

            // 根据形状绘制
            switch (particle.shape) {
                case 0: // 圆形颗粒
                    ctx.beginPath();
                    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 1: // 方形颗粒
                    ctx.fillRect(-particle.size, -particle.size, particle.size * 2, particle.size * 2);
                    break;

                case 2: // 菱形颗粒
                    ctx.beginPath();
                    ctx.moveTo(0, -particle.size);
                    ctx.lineTo(particle.size, 0);
                    ctx.lineTo(0, particle.size);
                    ctx.lineTo(-particle.size, 0);
                    ctx.closePath();
                    ctx.fill();
                    break;

                case 3: // 火花（细长条）
                    ctx.fillRect(-particle.size * 0.3, -particle.size * 2, particle.size * 0.6, particle.size * 4);
                    break;

                case 4: // 泡泡（空心圆）
                    ctx.beginPath();
                    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                    ctx.strokeStyle = colorStr;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    break;

                case 5: // 星星/闪烁
                    this._drawSparkle(ctx, particle.size, fadeAlpha);
                    break;

                case 6: // 锯齿/闪电
                    this._drawJagged(ctx, particle.size, fadeAlpha);
                    break;
            }

            // 重置发光效果
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    /**
     * 绘制星星形状
     */
    _drawSparkle(ctx, size, alpha) {
        const points = 4;
        const outerRadius = size * 2;
        const innerRadius = size * 0.5;

        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();

        // 添加中心亮点
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 绘制锯齿形状
     */
    _drawJagged(ctx, size, alpha) {
        const spikes = 3;
        ctx.beginPath();
        for (let i = 0; i < spikes; i++) {
            const angle1 = (i * Math.PI * 2) / spikes - Math.PI / 2;
            const angle2 = ((i + 0.5) * Math.PI * 2) / spikes - Math.PI / 2;

            ctx.lineTo(Math.cos(angle1) * size * 2, Math.sin(angle1) * size * 2);
            ctx.lineTo(Math.cos(angle2) * size * 0.5, Math.sin(angle2) * size * 0.5);
        }
        ctx.closePath();
        ctx.fill();
    }

    /**
     * 清空所有粒子
     */
    clear() {
        this.particles = [];
    }
}

// 导出粒子系统实例
const particleSystem = new ParticleSystem();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = particleSystem;
} else {
    window.particleSystem = particleSystem;
}
