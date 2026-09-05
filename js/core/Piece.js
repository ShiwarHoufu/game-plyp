class Piece {
    constructor(x, y, color, player, id = null, skinId = null) {
        this.id = id || ('piece_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
        this.x = x;
        this.y = y;
        this.initialX = x;
        this.initialY = y;
        this.vx = 0;
        this.vy = 0;
        // 检查是否为四人乱斗模式
        const isChaos4Mode = window.gameEngine && window.gameEngine.mode && window.gameEngine.mode.isChaos4Mode;
        this.radius = isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius;
        this.color = color;
        this.player = player;
        this.isDragging = false;
        this.isSelected = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
        this.isActive = true;
        this.friction = isChaos4Mode ? GAME_CONFIG.chaos4.pieceFriction : GAME_CONFIG.pieceFriction;
        this.minVelocity = isChaos4Mode ? GAME_CONFIG.chaos4.pieceMinVelocity : GAME_CONFIG.pieceMinVelocity;
        this.skill = null;
        this.skillUsed = false;
        this.skillActive = false;
        this.skillUses = 0; // 技能使用次数
        this.skillUsesThisTurn = 0; // 本回合技能使用次数
        this.skillTurnsRemaining = 0;
        this.mass = isChaos4Mode ? GAME_CONFIG.chaos4.pieceMass : 1;
        this.isClone = false;
        this.clonePiece = null;
        this.clonePlaced = false;
        this.doubleStrikeCount = 0;
        this.blinkRadius = 250;
        this.blinkCenterX = x;
        this.blinkCenterY = y;
        this.isIntangible = false;
        this.respawnFlash = false;
        this.respawnFlashStartTime = 0;
        this.respawnFlashDuration = 2000;
        this.isDoubleStrikeFirstShot = false;
        this.maxPowerScale = isChaos4Mode ? GAME_CONFIG.chaos4.maxPowerScale : null;
        // 冰冻状态（道具效果）
        this.isFrozen = false;
        this.frozenUntil = 0;
        this.freezeCooldownUntil = 0;
        // 皮肤相关
        this.skinId = skinId || 'default';
        this.skinImage = null;
        this.skinImageLoaded = false;
        // 拖尾粒子生成节流用
        this.lastTrailPos = null;
    }

    /**
     * 加载皮肤图片
     */
    loadSkinImage(imagePath) {
        if (!imagePath || this.skinImageLoaded) return;

        const img = new Image();
        img.onload = () => {
            this.skinImage = img;
            this.skinImageLoaded = true;
        };
        img.onerror = () => {
            console.warn('Failed to load skin image:', imagePath);
            this.skinImageLoaded = false;
        };
        img.src = imagePath;
    }

    update(deltaTime) {
        if (!this.isActive || this.isDragging) return;

        // 如果被冰冻，不更新位置
        if (this.isFrozen) return;

        // 基于时间的位置更新
        this.x += this.vx * deltaTime * 60; // 标准化到60fps
        this.y += this.vy * deltaTime * 60;

        // 基于时间的摩擦力计算
        const frictionFactor = Math.pow(this.friction, deltaTime * 60); // 标准化到60fps
        this.vx *= frictionFactor;
        this.vy *= frictionFactor;

        if (Math.abs(this.vx) < this.minVelocity) this.vx = 0;
        if (Math.abs(this.vy) < this.minVelocity) this.vy = 0;

        this.updateSkillEffects();
        this.updateRespawnFlash();
    }

    updateSkillEffects() {
        // 只在回合切换时减少技能回合数，而不是每帧都减少
        // 这个逻辑应该在 GameEngine 的 switchTurn 中处理
    }

    deactivateSkill() {
        // 调用 SkillLogic 的通用停用逻辑
        if (window.SkillLogic) {
            window.SkillLogic.deactivateSkill(this);
        } else {
            this.skillActive = false;
            this.skillTurnsRemaining = 0;
            this.skillUses = 0;

            if (this.skill && this.skill.id === GAME_CONFIG.skills.heavy.id) {
                this.mass = 1;
                this.friction = GAME_CONFIG.pieceFriction;
                if (this.originalRadius) {
                    this.radius = this.originalRadius;
                    this.originalRadius = null;
                }
            }

            if (this.skill && this.skill.id === GAME_CONFIG.skills.intangible.id) {
                this.isIntangible = false;
            }
        }

        // intangible 技能停用后随机放置在棋盘上
        // 注意：SkillLogic.deactivateSkill 已经处理了 isIntangible = false
        if (this.skill && this.skill.id === GAME_CONFIG.skills.intangible.id && !this.isIntangible) {
            this.randomlyPlaceOnBoard();
        }

        // 不要在这里清除clonePiece，因为可能有多个分身
        // 分身消失的逻辑应该在GameEngine中处理
    }

    randomlyPlaceOnBoard() {
        // 直接使用全局变量gameEngine
        if (!gameEngine) return;

        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        const width = canvas.width;
        const height = canvas.height;
        const safeRadius = 160;
        let validPosition = false;
        let attempts = 0;
        const maxAttempts = 100;

        while (!validPosition && attempts < maxAttempts) {
            attempts++;
            // 随机生成位置，确保棋子在棋盘内
            const x = this.radius + Math.random() * (width - 2 * this.radius);
            const y = this.radius + Math.random() * (height - 2 * this.radius);

            // 检查是否与其他棋子距离足够远
            let isPositionValid = true;
            for (let piece of gameEngine.pieces) {
                if (piece.isActive && piece !== this) {
                    const dx = piece.x - x;
                    const dy = piece.y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < safeRadius) {
                        isPositionValid = false;
                        break;
                    }
                }
            }

            if (isPositionValid) {
                this.x = x;
                this.y = y;
                this.vx = 0;
                this.vy = 0;
                validPosition = true;
                // 激活绿色呼吸闪烁效果
                this.startRespawnFlash();
            }
        }
    }

    startDrag(mouseX, mouseY) {
        this.isDragging = true;
        this.dragStartX = this.x;
        this.dragStartY = this.y;
        this.dragCurrentX = mouseX;
        this.dragCurrentY = mouseY;
    }

    updateDrag(mouseX, mouseY) {
        if (!this.isDragging) return;
        
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isChaos4Mode = window.gameEngine && window.gameEngine.mode && window.gameEngine.mode.isChaos4Mode;
        const maxDistance = isChaos4Mode ? GAME_CONFIG.chaos4.maxDragDistance : GAME_CONFIG.maxDragDistance;
        
        if (distance > maxDistance) {
            const angle = Math.atan2(dy, dx);
            this.dragCurrentX = this.x + Math.cos(angle) * maxDistance;
            this.dragCurrentY = this.y + Math.sin(angle) * maxDistance;
        } else {
            this.dragCurrentX = mouseX;
            this.dragCurrentY = mouseY;
        }
    }

    endDrag() {
        if (!this.isDragging) return;
        
        const dx = this.dragStartX - this.dragCurrentX;
        const dy = this.dragStartY - this.dragCurrentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isChaos4Mode = window.gameEngine && window.gameEngine.mode && window.gameEngine.mode.isChaos4Mode;
        const maxDistance = isChaos4Mode ? GAME_CONFIG.chaos4.maxDragDistance : GAME_CONFIG.maxDragDistance;
        const powerCurveExponent = isChaos4Mode ? GAME_CONFIG.chaos4.powerCurveExponent : GAME_CONFIG.powerCurveExponent;
        // 使用更平缓的曲线让力度划分更多挡位，低力度区更精细
        const powerRatio = Math.min(Math.pow(distance / maxDistance, powerCurveExponent), 1);
        const maxScale = this.maxPowerScale || (isChaos4Mode ? GAME_CONFIG.chaos4.maxPowerScale : GAME_CONFIG.maxPowerScale);
        let scale = powerRatio * maxScale;

        if (this.skillActive && this.skill && this.skill.id === GAME_CONFIG.skills.frenzy.id) {
            scale *= GAME_CONFIG.skills.frenzy.maxPowerMultiplier;
        }

        if (this.skillActive && this.skill && this.skill.id === GAME_CONFIG.skills.heavy.id) {
            scale *= GAME_CONFIG.skills.heavy.powerMultiplier;
        }

        this.vx = (dx / distance) * scale;
        this.vy = (dy / distance) * scale;

        this.isDragging = false;
    }

    draw(ctx, blinkMinDistance, isCurrentPlayerPiece = false) {
        if (!this.isActive) return;

        // Guard against invalid position/radius values
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.radius)) {
            return;
        }

        // 显示技能激活状态的绿色光圈
        // 只有本体显示绿色光圈，分身不显示
        if (this.skillActive && !this.isClone) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        if (this.isSelected || this.isDragging) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 只有当前玩家的闪现棋子才显示黄色和红色圆圈
        if (isCurrentPlayerPiece && this.skillActive && this.skill && this.skill.id === GAME_CONFIG.skills.blink.id) {
            ctx.beginPath();
            ctx.arc(this.blinkCenterX, this.blinkCenterY, this.blinkRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 绘制最小距离限制圆圈（红色虚线）
            ctx.beginPath();
            ctx.arc(this.x, this.y, blinkMinDistance, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (isCurrentPlayerPiece && this.isDragging && this.skillActive && this.skill && this.skill.id === GAME_CONFIG.skills.blink.id) {
            ctx.beginPath();
            ctx.arc(this.blinkCenterX, this.blinkCenterY, this.blinkRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 绘制拖动时的最小距离限制圆圈（亮红色虚线）
            ctx.beginPath();
            ctx.arc(this.x, this.y, blinkMinDistance, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (isCurrentPlayerPiece && this.skillActive && this.skill && this.skill.id === GAME_CONFIG.skills.clone.id && !this.clonePlaced && !this.isClone) {
            // 绘制美化的放置分身提示
            ctx.font = '16px Microsoft YaHei';
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 黄色发光效果
            ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.fillText('在棋盘任意位置放置分身', this.x, this.y - this.radius - 10);
            
            // 清除阴影效果
            ctx.shadowBlur = 0;
        }

        if (this.isDragging) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.dragCurrentX, this.dragCurrentY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.dragCurrentX, this.dragCurrentY, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fill();
        }

        // 检查是否使用皮肤图片渲染
        const skinConfig = GAME_CONFIG.skins.piece[this.skinId];
        if (skinConfig && skinConfig.renderType === 'image' && this.skinImageLoaded) {
            // 图片渲染模式
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const imgWidth = this.skinImage.width;
            const imgHeight = this.skinImage.height;
            const scale = (this.radius * 2) / Math.max(imgWidth, imgHeight);
            const drawWidth = imgWidth * scale;
            const drawHeight = imgHeight * scale;
            const drawX = this.x - drawWidth / 2;
            const drawY = this.y - drawHeight / 2;

            ctx.drawImage(this.skinImage, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();

            // 绘制边框
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // 渐变渲染模式（默认）
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

            const gradient = ctx.createRadialGradient(
                this.x - 5, this.y - 5, 0,
                this.x, this.y, this.radius
            );
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(1, this.darkenColor(this.color, 0.3));

            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.x - 6, this.y - 6, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }

        // 在技能模式下显示玩家标识（A或B）
        if (this.skill) {
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const playerLabel = this.player === 1 ? 'A' : 'B';
            ctx.fillText(playerLabel, this.x, this.y);
        }

        // 绘制删除特效（我命由天）- 红色闪烁覆盖在棋子上
        if (this.isDeleted && this.deleteTime && this.deleteEffectDuration) {
            const elapsed = Date.now() - this.deleteTime;
            const progress = elapsed / this.deleteEffectDuration;
            const intensity = 1 - progress;

            // 红色闪烁效果
            const flashIntensity = Math.sin(elapsed * 0.02) * 0.5 + 0.5; // 闪烁频率
            const redAlpha = intensity * flashIntensity * 0.8;

            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 0, 0, ${redAlpha})`;
            ctx.fill();
            ctx.restore();
        }

        // 绘制复活闪烁效果
        this.drawRespawnFlash(ctx);
    }

    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - factor));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - factor));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - factor));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    contains(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
    
    startRespawnFlash() {
        this.respawnFlash = true;
        this.respawnFlashStartTime = Date.now();
        this.respawnFlashDuration = 2000; // 2秒，固定时间
    }
    
    updateRespawnFlash() {
        if (this.respawnFlash) {
            const elapsed = Date.now() - this.respawnFlashStartTime;
            if (elapsed >= this.respawnFlashDuration) {
                this.respawnFlash = false;
            }
        }
    }
    
    drawRespawnFlash(ctx) {
        if (this.respawnFlash) {
            const elapsed = Date.now() - this.respawnFlashStartTime;
            const progress = Math.min(elapsed / this.respawnFlashDuration, 1);
            // 计算呼吸式闪烁强度（0-1-0），2秒内完成两次闪烁
            const intensity = 0.5 - 0.5 * Math.cos(progress * Math.PI * 4); // 乘以4，2秒内完成两次周期
            
            // 呼吸式缩放效果
            const scale = 1 + intensity * 0.3;
            const flashRadius = this.radius * scale;
            
            // 绘制贴合小球边缘的呼吸式闪烁效果
            ctx.beginPath();
            ctx.arc(this.x, this.y, flashRadius, 0, Math.PI * 2);
            
            // 绿色渐变发光效果
            const gradient = ctx.createRadialGradient(
                this.x, this.y, this.radius,
                this.x, this.y, flashRadius
            );
            gradient.addColorStop(0, `rgba(0, 255, 0, ${intensity * 0.6})`);
            gradient.addColorStop(0.7, `rgba(0, 255, 0, ${intensity * 0.3})`);
            gradient.addColorStop(1, `rgba(0, 255, 0, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // 绘制边缘发光效果
            ctx.beginPath();
            ctx.arc(this.x, this.y, flashRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 0, ${intensity})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}