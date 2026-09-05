/**
 * 拖尾效果预览类
 * 用于在商店和背包中动态展示拖尾效果
 */
class TrailPreview {
    constructor(container, trailId, trailConfig) {
        this.container = container;
        this.trailId = trailId;
        // 支持两种格式：传入完整配置对象或仅颜色字符串
        this.trailConfig = this._normalizeTrailConfig(trailConfig);
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        // 源头位置：从右上角(80, 20)到左下角(-10, 105)循环移动
        this.sourcePos = { x: 80, y: 20 };
        this.targetPos = { x: -120, y: 240 };
        this.velocity = { x: -5, y: 5 }; // 速度方向（增大让预览更明显）
        this.lastTime = 0;
        this.init();
    }

    init() {
        // 创建 Canvas 元素
        this.canvas = document.createElement('canvas');
        this.canvas.width = 100;
        this.canvas.height = 100;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.borderRadius = '50%';
        this.canvas.style.overflow = 'hidden';
        this.canvas.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);';

        // 清空容器并添加 Canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        // 获取 Canvas 上下文
        this.ctx = this.canvas.getContext('2d');

        // 启动动画
        this.start();
    }

    /**
     * 标准化拖尾配置（统一使用 GAME_CONFIG 的默认值）
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
            return { ...defaultConfig, ...normalizedConfig, ...config };
        }

        // 否则合并默认配置
        return { ...defaultConfig, ...config };
    }

    start() {
        if (this.animationId) return;

        const animate = (timestamp) => {
            if (!this.lastTime) this.lastTime = timestamp;
            const deltaTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            this.update(deltaTime);
            this.draw();

            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update(deltaTime) {
        // 更新源头位置：从右上角到左下角循环移动，穿过后重新从右上角出现
        const moveSpeed = 200; // 移动速度
        const dx = this.targetPos.x - this.sourcePos.x;
        const dy = this.targetPos.y - this.sourcePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 向左下角移动
        this.sourcePos.x += (dx / dist) * moveSpeed * deltaTime;
        this.sourcePos.y += (dy / dist) * moveSpeed * deltaTime;

        // 检测是否穿过左下角
        if (this.sourcePos.x <= this.targetPos.x && this.sourcePos.y >= this.targetPos.y) {
            // 重置到右上角起点
            this.sourcePos.x = 80;
            this.sourcePos.y = 20;
        }

        // 生成拖尾粒子
        this.createTrailParticles();

        // 更新粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            // 更新位置
            particle.x += particle.vx * deltaTime * 60;
            particle.y += particle.vy * deltaTime * 60;

            // 应用摩擦力
            particle.vx *= particle.friction;
            particle.vy *= particle.friction;

            // 减少生命值
            particle.life -= deltaTime;

            // 移除死亡粒子
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    createTrailParticles() {
        const config = this.trailConfig;
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        const minTrailSpeed = 0.5;

        if (speed < minTrailSpeed) return;

        const angle = Math.atan2(this.velocity.y, this.velocity.x);
        const trailOffset = 10;
        const trailX = this.sourcePos.x - Math.cos(angle) * trailOffset;
        const trailY = this.sourcePos.y - Math.sin(angle) * trailOffset;

        for (let i = 0; i < config.particleCount; i++) {
            // 随机偏移
            const randomAngle = angle + Math.PI + (Math.random() - 0.5) * 0.5;
            const randomDistance = Math.random() * 5;
            const px = trailX + Math.cos(randomAngle) * randomDistance;
            const py = trailY + Math.sin(randomAngle) * randomDistance;

            // 粒子速度
            const particleSpeed = speed * (0.1 + Math.random() * 0.2);
            const movementOffset = this._calculateMovementOffset(angle, particleSpeed, config.movement);

            const pvx = -Math.cos(angle) * particleSpeed * 0.5 + movementOffset.x;
            const pvy = -Math.sin(angle) * particleSpeed * 0.5 + movementOffset.y;

            // 获取颜色
            const particleColor = this._getTrailColor(config.colors);

            // 获取形状
            const shape = this._getRandomShape(config.particleShapes);

            // 获取生命值和大小
            const life = config.life.min + Math.random() * (config.life.max - config.life.min);
            const size = config.particleSize.min + Math.random() * (config.particleSize.max - config.particleSize.min);

            // 创建轨迹粒子
            this.particles.push({
                x: px,
                y: py,
                vx: pvx,
                vy: pvy,
                size,
                shape,
                color: particleColor,
                life,
                maxLife: life,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 5,
                friction: config.friction + (Math.random() - 0.5) * 0.02,
                glow: config.glow
            });
        }
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
                    y: -Math.sin(driftAngle) * speed * moveSpeed * variance
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

    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制粒子
        for (const particle of this.particles) {
            const alpha = particle.life / particle.maxLife;
            const fadeAlpha = alpha * alpha;

            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation);

            const colorStr = `rgba(${Math.floor(particle.color.r)}, ${Math.floor(particle.color.g)}, ${Math.floor(particle.color.b)}, ${fadeAlpha})`;

            // 如果有发光效果
            if (particle.glow) {
                this.ctx.shadowColor = particle.glow.color;
                this.ctx.shadowBlur = particle.glow.blur * fadeAlpha;
            }

            this.ctx.fillStyle = colorStr;

            // 根据形状绘制
            switch (particle.shape) {
                case 0: // 圆形
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                case 1: // 方形
                    this.ctx.fillRect(-particle.size, -particle.size, particle.size * 2, particle.size * 2);
                    break;
                case 2: // 菱形
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, -particle.size);
                    this.ctx.lineTo(particle.size, 0);
                    this.ctx.lineTo(0, particle.size);
                    this.ctx.lineTo(-particle.size, 0);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                case 3: // 火花
                    this.ctx.fillRect(-particle.size * 0.3, -particle.size * 2, particle.size * 0.6, particle.size * 4);
                    break;
                case 5: // 星星
                    this._drawSparkle(this.ctx, particle.size);
                    break;
                case 6: // 锯齿
                    this._drawJagged(this.ctx, particle.size);
                    break;
            }

            this.ctx.shadowBlur = 0;
            this.ctx.restore();
        }
    }

    _drawSparkle(ctx, size) {
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

        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawJagged(ctx, size) {
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

    // 工具方法：十六进制颜色转 RGB
    hexToRgb(hex) {
        hex = hex.replace('#', '');
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    // 工具方法：HSL 转 RGB
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
}

// 导出 TrailPreview 类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrailPreview;
} else {
    window.TrailPreview = TrailPreview;
}