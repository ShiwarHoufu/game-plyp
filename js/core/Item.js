/**
 * 道具类 - 客户端渲染
 */
class Item {
    /**
     * @param {Object} config - 道具配置 {id, type, x, y, radius}
     */
    constructor(config) {
        this.id = config.id;
        this.type = config.type;
        this.x = config.x;
        this.y = config.y;
        this.radius = config.radius || 13;
        this.isActive = true;

        // 加载道具图片
        this.image = this.loadImage();
    }

    /**
     * 根据道具类型加载对应图片
     */
    loadImage() {
        const imagePath = this.getImagePath();
        const img = new Image();
        img.src = `assets/images/${imagePath}`;
        img.onerror = () => {
            console.warn(`[Item] Failed to load image: ${imagePath}`);
        };
        return img;
    }

    /**
     * 获取道具类型对应的图片路径
     */
    getImagePath() {
        const imageConfig = GAME_CONFIG.items.images;
        const imageName = imageConfig[this.type] || 'box_green';
        return `${imageName}.png`;
    }

    /**
     * 绘制道具
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    draw(ctx) {
        if (!this.isActive || !this.image) return;

        ctx.save();

        // 绘制道具图片（圆形裁剪）
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // 绘制图片
        const size = this.radius * 2;
        ctx.drawImage(
            this.image,
            this.x - this.radius,
            this.y - this.radius,
            size,
            size
        );

        ctx.restore();

        // 绘制边框
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /**
     * 更新道具状态
     * @param {number} timestamp - 当前时间戳
     */
    update(timestamp) {
        // 道具不需要主动更新
    }
}

/**
 * 绘制冰冻光圈效果
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {Object} piece - 棋子对象 {x, y, radius}
 */
function drawFreezeGlow(ctx, piece) {
    if (!piece.isFrozen) return;

    const now = Date.now();
    const remaining = piece.frozenUntil - now;
    if (remaining <= 0) return;

    // 呼吸效果
    const progress = 1 - (remaining / 1500);  // 假设冻结1.5秒
    const intensity = 0.5 + 0.5 * Math.cos(progress * Math.PI * 4);

    ctx.save();

    // 蓝色光圈
    const gradient = ctx.createRadialGradient(
        piece.x, piece.y, piece.radius,
        piece.x, piece.y, piece.radius + 10
    );
    gradient.addColorStop(0, `rgba(100, 200, 255, ${intensity * 0.8})`);
    gradient.addColorStop(0.5, `rgba(100, 200, 255, ${intensity * 0.4})`);
    gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);

    ctx.beginPath();
    ctx.arc(piece.x, piece.y, piece.radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 闪烁边框
    ctx.beginPath();
    ctx.arc(piece.x, piece.y, piece.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 220, 255, ${intensity})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
}

/**
 * 绘制删除特效（红色闪烁消失）
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {Object} piece - 棋子对象 {x, y, radius, deleteTime, deleteEffectDuration}
 * @param {string} color - 棋子颜色
 */
function drawDeleteEffect(ctx, piece, color) {
    if (!piece.isDeleted || !piece.deleteTime) return;

    const now = Date.now();
    const elapsed = now - piece.deleteTime;
    const duration = piece.deleteEffectDuration || 1500;

    if (elapsed >= duration) return;

    const progress = elapsed / duration;
    const intensity = 1 - progress;

    ctx.save();

    // 红色闪烁
    const scale = 1 + intensity * 0.5;
    const flashRadius = piece.radius * scale;

    const gradient = ctx.createRadialGradient(
        piece.x, piece.y, piece.radius,
        piece.x, piece.y, flashRadius
    );
    gradient.addColorStop(0, `rgba(255, 50, 50, ${intensity * 0.8})`);
    gradient.addColorStop(0.5, `rgba(255, 100, 100, ${intensity * 0.5})`);
    gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

    ctx.beginPath();
    ctx.arc(piece.x, piece.y, flashRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 闪烁边框
    const flashIntensity = Math.sin(progress * Math.PI * 6) * 0.5 + 0.5;
    ctx.beginPath();
    ctx.arc(piece.x, piece.y, piece.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 0, 0, ${flashIntensity * intensity})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
}

window.Item = Item;
window.drawFreezeGlow = drawFreezeGlow;
window.drawDeleteEffect = drawDeleteEffect;
