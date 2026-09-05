class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.pieces = [];
        this.terrain = []; // 存储地形（墙壁）
        this.currentPlayer = 1;
        this.draggedPiece = null;
        this.selectedPiece = null;
        this.isAnimating = false;
        this.gameOver = false;
        this.gameStarted = false;
        this.mode = null;
        this.temporaryMessage = null;
        this.temporaryMessageTime = 0;
        this.turnCount = 0;
        this.generateTerrain = false; // 是否生成地形
        
        // 技能相关配置（从 GameConfig 读取）
        this.blinkMinDistance = GAME_CONFIG.skills.blink.minDistance;
        this.blinkMoveSpeed = GAME_CONFIG.skills.blink.moveSpeed;
        this.blinkRadius = GAME_CONFIG.skills.blink.radius;

        // 闪现移动状态跟踪（用于避免被旧PIECE_POSITIONS覆盖）
        this.blinkMovePending = {};  // { pieceId: timestamp }

        // 聊天相关
        this.chatBubbles = [];
        this.chatBubbleIdCounter = 0;

        // 乱斗模式保护机制
        this.chaosProtectionActive = false;
        this.chaosProtectionRemaining = 0;

        // 乱斗模式能量条
        this.playerEnergy = { 1: 3, 2: 3, 3: 3, 4: 3 };

        // 时间相关变量
        this.lastTime = 0;
        this.accumulator = 0;
        this.timeStep = 1 / 60;
        
        // 音效相关
        this.sounds = {
            collision: null,
            bgm: null,
            bgmVolume: 0.3,
            bgmFadeInterval: null,
            isBgmPlaying: false
        };
        this.loadSounds();
        
        this.setupEventListeners();
        
        // 初始化粒子系统
        this.particleSystem = window.particleSystem;
    }

    setMode(mode) {
        this.mode = mode;
    }

    switchCanvas(canvasId) {
        // 移除旧canvas的事件监听
        if (this.canvas && this.boundMouseDown) {
            this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        }
        if (this.canvas && this.boundTouchStart) {
            this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        }

        // 切换到新canvas
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // 给新canvas添加事件监听
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', this.boundMouseDown);
            this.canvas.addEventListener('touchstart', this.boundTouchStart);
        }
    }

    start() {
        this.gameStarted = true;
        this.playBgm();

        // 从全局变量获取生成地形设置
        if (typeof generateTerrain !== 'undefined') {
            this.generateTerrain = generateTerrain;
        }
        
        // 根据模式类型添加或移除 skill-mode 类
        const gameContainer = document.getElementById('gameContainer');
        if (this.mode && (this.mode.isSkillMode || this.mode.isNetworkMode)) {
            gameContainer.classList.add('skill-mode');
        } else {
            gameContainer.classList.remove('skill-mode');
        }
        
        this.init();
        requestAnimationFrame((t) => this.loop(t));
        
        // 游戏开始时初始化提示
        this.updateGameHint('none');
    }

    init() {
        this.pieces = [];
        this.terrain = []; // 清空地形
        // 重置currentPlayer为1
        this.currentPlayer = 1;
        this.turnCount = 0; // 重置回合数
        this.gameOver = false;
        this.isAnimating = false;
        this.draggedPiece = null;
        this.selectedPiece = null;

        // 重置能量值
        this.playerEnergy = { 1: 3, 2: 3, 3: 3, 4: 3 };
        this.playerEnergyProgress = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // 重置乱斗模式保护状态
        this.chaosProtectionActive = false;
        this.chaosProtectionRemaining = 0;
        this.updateChaosGlow();

        // 重置道具系统
        this.items = [];
        this.frozenPieces = {};
        this.deleteEffects = [];
        this.activeItemEffects = {
            quickRecovery: { active: false },
            freeze: { active: false },
            sharedProsperity: { active: false },
            invisibility: { active: false },
            oneBody: { active: false }
        };

        if (this.mode) {
            this.mode.init(this);
        }
    }

    setupEventListeners() {
        // 保存绑定的事件处理器，以便后续移除
        this.boundMouseDown = (e) => this.handleMouseDown(e);
        this.boundTouchStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        };

        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        this.canvas.addEventListener('touchstart', this.boundTouchStart);

        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.draggedPiece) {
                const touch = e.touches[0];
                this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        });
        
        document.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleMouseUp(e);
        });
    }

    loadSounds() {
        // 预加载音效，创建多个音频对象以避免重叠
        this.sounds = {
            collision: [],
            shoot: [],
            button: null,
            bgm: null,
            loaded: false,
            bgmVolume: 0.3,
            bgmFadeInterval: null,
            isBgmPlaying: false
        };

        // 创建3个音频对象作为音频池
        for (let i = 0; i < 3; i++) {
            // 碰撞音效
            const collisionAudio = new Audio('assets/sounds/collision.mp3');
            collisionAudio.preload = 'auto';
            collisionAudio.load();
            this.sounds.collision.push(collisionAudio);

            // 弹射音效
            const shootAudio = new Audio('assets/sounds/shoot.mp3');
            shootAudio.preload = 'auto';
            shootAudio.load();
            this.sounds.shoot.push(shootAudio);
        }

        // 按钮点击音效
        const buttonAudio = new Audio('assets/sounds/button.mp3');
        buttonAudio.preload = 'auto';
        buttonAudio.volume = 0.5;
        this.sounds.button = buttonAudio;

        // 道具拾取音效
        const getItemAudio = new Audio('assets/sounds/get_item.mp3');
        getItemAudio.preload = 'auto';
        getItemAudio.volume = 0.8;
        this.sounds.getItem = getItemAudio;

        // 背景音乐
        const bgmAudio = new Audio('assets/sounds/bgm.mp3');
        bgmAudio.preload = 'auto';
        bgmAudio.loop = true;
        bgmAudio.volume = 0;
        this.sounds.bgm = bgmAudio;

        // 标记音频加载完成
        this.sounds.loaded = true;

        // 为所有按钮添加点击音效
        this.setupButtonSounds();
    }

    playCollisionSound(speed) {
        if (this.sounds.loaded && this.sounds.collision.length > 0) {
            // 根据速度调整音量，速度越大音量越大
            // 假设最大速度为20，音量范围0.2-1.0
            const maxSpeed = 20;
            const minVolume = 0.2;
            const maxVolume = 1.0;
            
            // 计算音量，限制在0.2-1.0之间
            const volume = Math.min(Math.max((speed / maxSpeed) * (maxVolume - minVolume) + minVolume, minVolume), maxVolume);
            
            // 找到一个未在播放的音频对象
            let availableAudio = null;
            for (const audio of this.sounds.collision) {
                if (audio.paused) {
                    availableAudio = audio;
                    break;
                }
            }
            
            // 如果没有可用的音频对象，使用第一个
            if (!availableAudio) {
                availableAudio = this.sounds.collision[0];
            }
            
            // 播放音效
            availableAudio.volume = volume;
            availableAudio.currentTime = 0;
            availableAudio.play().catch(e => console.log('Audio play error:', e));
        }
    }

    playShootSound(power) {
        if (this.sounds.loaded && this.sounds.shoot.length > 0) {
            // 根据力度调整音量，力度越大音量越大
            // 假设最大力度为20，音量范围0.2-1.0
            const maxPower = 20;
            const minVolume = 0.2;
            const maxVolume = 1.0;
            
            // 计算音量，限制在0.2-1.0之间
            const volume = Math.min(Math.max((power / maxPower) * (maxVolume - minVolume) + minVolume, minVolume), maxVolume);
            
            // 找到一个未在播放的音频对象
            let availableAudio = null;
            for (const audio of this.sounds.shoot) {
                if (audio.paused) {
                    availableAudio = audio;
                    break;
                }
            }
            
            // 如果没有可用的音频对象，使用第一个
            if (!availableAudio) {
                availableAudio = this.sounds.shoot[0];
            }
            
            // 播放音效
            availableAudio.volume = volume;
            availableAudio.currentTime = 0;
            availableAudio.play().catch(e => console.log('Audio play error:', e));
        }
    }

    /**
     * 播放按钮点击音效
     */
    playButtonSound() {
        if (this.sounds.loaded && this.sounds.button) {
            this.sounds.button.currentTime = 0;
            this.sounds.button.play().catch(e => console.log('Button sound error:', e));
        }
    }

    /**
     * 为所有按钮添加点击音效
     */
    setupButtonSounds() {
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                this.playButtonSound();
            }
        });
    }

    /**
     * 淡入背景音乐
     */
    fadeInBgm(duration = 2000) {
        if (!this.sounds.bgm || this.sounds.isBgmPlaying) return;

        this.sounds.bgm.play().catch(e => console.log('BGM play error:', e));
        this.sounds.isBgmPlaying = true;

        const targetVolume = this.sounds.bgmVolume;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;

        if (this.sounds.bgmFadeInterval) {
            clearInterval(this.sounds.bgmFadeInterval);
        }

        this.sounds.bgmFadeInterval = setInterval(() => {
            currentStep++;
            this.sounds.bgm.volume = Math.min(volumeStep * currentStep, targetVolume);
            if (currentStep >= steps) {
                clearInterval(this.sounds.bgmFadeInterval);
                this.sounds.bgmFadeInterval = null;
            }
        }, stepTime);
    }

    /**
     * 淡出背景音乐
     */
    fadeOutBgm(duration = 1500) {
        if (!this.sounds.bgm || !this.sounds.isBgmPlaying) return;

        const startVolume = this.sounds.bgm.volume;
        const steps = 15;
        const stepTime = duration / steps;
        const volumeStep = startVolume / steps;
        let currentStep = 0;

        if (this.sounds.bgmFadeInterval) {
            clearInterval(this.sounds.bgmFadeInterval);
        }

        this.sounds.bgmFadeInterval = setInterval(() => {
            currentStep++;
            this.sounds.bgm.volume = Math.max(startVolume - volumeStep * currentStep, 0);
            if (currentStep >= steps) {
                clearInterval(this.sounds.bgmFadeInterval);
                this.sounds.bgmFadeInterval = null;
                this.sounds.bgm.pause();
                this.sounds.bgm.currentTime = 0;
                this.sounds.isBgmPlaying = false;
            }
        }, stepTime);
    }

    /**
     * 开始播放背景音乐（带淡入）
     */
    playBgm() {
        this.fadeInBgm(2000);
    }

    /**
     * 停止背景音乐（带淡出）
     */
    stopBgm() {
        this.fadeOutBgm(1500);
    }

    updateGlobalSkillButton() {
        const player1GlobalSkillName = document.getElementById('player1GlobalSkillName');
        const player1GlobalSkillButton = document.getElementById('player1GlobalSkillButton');
        const player2GlobalSkillName = document.getElementById('player2GlobalSkillName');
        const player2GlobalSkillButton = document.getElementById('player2GlobalSkillButton');

        if (!player1GlobalSkillName || !player1GlobalSkillButton || !player2GlobalSkillName || !player2GlobalSkillButton) return;

        if (this.mode && (this.mode.isSkillMode || this.mode.isNetworkMode)) {
            // 在网络模式下，获取当前本地玩家ID
            const localPlayerId = this.mode.isNetworkMode && window.networkManager ? window.networkManager.playerId : null;

            // 显示玩家1的全局技能
            if (this.mode.player1GlobalSkill) {
                player1GlobalSkillName.textContent = '';
                // 在网络模式下，只显示属于本地玩家的按钮
                if (this.mode.isNetworkMode && localPlayerId !== 1) {
                    player1GlobalSkillButton.style.display = 'none';
                } else {
                    player1GlobalSkillButton.style.display = 'block';
                    player1GlobalSkillButton.textContent = this.mode.player1GlobalSkill.name;
                    player1GlobalSkillButton.disabled = this.mode.player1GlobalSkillUsed || this.mode.globalSkillActive || this.isAnimating;
                }
            } else {
                player1GlobalSkillName.textContent = '';
                player1GlobalSkillButton.style.display = 'none';
            }

            // 显示玩家2的全局技能
            if (this.mode.player2GlobalSkill) {
                player2GlobalSkillName.textContent = '';
                // 在网络模式下，只显示属于本地玩家的按钮
                if (this.mode.isNetworkMode && localPlayerId !== 2) {
                    player2GlobalSkillButton.style.display = 'none';
                } else {
                    player2GlobalSkillButton.style.display = 'block';
                    player2GlobalSkillButton.textContent = this.mode.player2GlobalSkill.name;
                    player2GlobalSkillButton.disabled = this.mode.player2GlobalSkillUsed || this.mode.globalSkillActive || this.isAnimating;
                }
            } else {
                player2GlobalSkillName.textContent = '';
                player2GlobalSkillButton.style.display = 'none';
            }
        } else {
            player1GlobalSkillName.textContent = '';
            player1GlobalSkillButton.style.display = 'none';
            player2GlobalSkillName.textContent = '';
            player2GlobalSkillButton.style.display = 'none';
        }
    }

    useGlobalSkill(playerId) {
        if (!this.mode || !this.mode.isSkillMode || this.isAnimating) return;

        // 在网络模式下，验证玩家只能使用自己的全局技能
        if (this.mode.isNetworkMode) {
            const networkManager = window.networkManager;
            if (!networkManager || networkManager.playerId !== playerId) {
                console.log('[useGlobalSkill] 拒绝：只有玩家', playerId, '才能使用此全局技能（当前玩家：', networkManager ? networkManager.playerId : 'unknown', '）');
                return;
            }
        }

        const currentPlayerGlobalSkill = playerId === 1 ? this.mode.player1GlobalSkill : this.mode.player2GlobalSkill;
        const globalSkillUsed = playerId === 1 ? this.mode.player1GlobalSkillUsed : this.mode.player2GlobalSkillUsed;

        if (currentPlayerGlobalSkill && !globalSkillUsed && !this.mode.globalSkillActive) {
            // 获取全局技能持续回合数
            const globalSkillDuration = GAME_CONFIG.globalSkills[currentPlayerGlobalSkill.id]?.duration || 2;

            // 标记该玩家的全局技能已使用
            if (playerId === 1) {
                this.mode.player1GlobalSkillUsed = true;
            } else {
                this.mode.player2GlobalSkillUsed = true;
            }

            this.mode.globalSkillActive = true;
            this.mode.globalSkillTurnsRemaining = globalSkillDuration;
            this.mode.globalSkillType = currentPlayerGlobalSkill.id;

            // 应用全局技能效果
            this.applyGlobalSkillEffect(currentPlayerGlobalSkill.id);

            // 在网络模式下发送全局技能使用操作
            if (this.mode && this.mode.isNetworkMode) {
                networkManager.sendPlayerAction({
                    type: 'useGlobalSkill',
                    playerId: playerId,
                    skillId: currentPlayerGlobalSkill.id
                });
            }

            this.showTemporaryMessage(`玩家${playerId === 1 ? 'A' : 'B'}使用了全局技能: ${currentPlayerGlobalSkill.name}`);
            this.updateGlobalSkillButton();
        }
    }

    applyGlobalSkillEffect(skillId) {
        SkillLogic.applyGlobalSkillEffect(this.pieces, skillId);
    }

    removeGlobalSkillEffect() {
        if (this.mode && this.mode.globalSkillType) {
            SkillLogic.removeGlobalSkillEffect(this.pieces, this.mode.globalSkillType);
            this.mode.globalSkillActive = false;
            this.mode.globalSkillType = null;
            this.mode.globalSkillTurnsRemaining = 0;
        }
    }

    /**
     * 更新网络游戏状态
     * @param {object} state - 游戏状态
     */
    updateNetworkGameState(state) {
        if (!state) return;

        // 更新游戏状态
        this.currentPlayer = state.currentPlayer;
        // 注意：turnCount 不在这里同步，避免覆盖 TURN_CHANGE 的更新
        // turnCount 应该只通过 TURN_CHANGE 消息更新
        this.gameOver = state.gameOver;
        
        // 获取网络管理器，用于判断是否是自己的棋子
        const networkManager = window.networkManager;
        
        // 更新棋子状态
        if (state.pieces) {
            this.pieces = state.pieces.map(pieceData => {
                const piece = new Piece(pieceData.x, pieceData.y, pieceData.color, pieceData.player, pieceData.id);
                Object.assign(piece, pieceData);
                return piece;
            });
        }
        
        // 更新地形
        if (state.terrain) {
            this.terrain = state.terrain;
        }
        
        // 更新全局技能状态
        if (this.mode && (this.mode.isSkillMode || this.mode.isNetworkMode)) {
            this.mode.globalSkillActive = state.globalSkillActive;
            this.mode.globalSkillTurnsRemaining = state.globalSkillTurnsRemaining;
            this.mode.globalSkillType = state.globalSkillType;
            this.mode.player1GlobalSkillUsed = state.player1GlobalSkillUsed;
            this.mode.player2GlobalSkillUsed = state.player2GlobalSkillUsed;
            this.updateGlobalSkillButton();
        }
        
        // 更新UI
        this.updateUI();
    }

    /**
     * 处理网络玩家操作
     * @param {object} data - 操作数据
     */
    handleNetworkPlayerAction(data) {
        if (!data || !data.action) return;

        const action = data.action;

        switch (action.type) {
            case 'useSkill':
                // 处理技能使用
                this.handleNetworkSkillUse(action);
                break;
            case 'shoot':
                // 处理棋子弹射
                this.handleNetworkShoot(action);
                break;
            case 'doubleStrikeFirst':
                // 处理二连击第一次弹射（不切换回合）
                this.handleNetworkDoubleStrikeFirst(action);
                break;
            case 'frenzyRespawn':
                // 处理狂暴技能复活
                this.handleNetworkFrenzyRespawn(action);
                break;
            case 'respawn':
                // 处理普通复活
                this.handleNetworkRespawn(action);
                break;
            case 'intangibleRespawn':
                // 处理无形技能失效后的复活
                this.handleNetworkIntangibleRespawn(action);
                break;
            case 'chaosRespawn':
                // 处理乱斗模式保护复活
                this.handleNetworkChaosRespawn(action);
                break;
            case 'sharedProsperityRespawn':
                // 处理富贵同享道具效果复活
                this.handleNetworkSharedProsperityRespawn(action);
                break;
            case 'chaosProtectionEnd':
                // 处理乱斗模式保护结束
                this.handleChaosProtectionEnd();
                break;
            case 'blinkMove':
                // 处理闪现移动
                this.handleNetworkBlinkMove(action);
                break;
            case 'deactivateSkill':
                // 处理技能失效
                this.handleNetworkDeactivateSkill(action);
                break;
            case 'useGlobalSkill':
                // 处理全局技能使用
                this.handleNetworkGlobalSkillUse(action);
                break;
            case 'clonePlace':
                // 处理分身放置（对手的视角）
                this.handleNetworkClonePlace(action);
                break;
        }
    }

    /**
     * 处理网络分身放置
     * @param {object} action - 分身放置操作
     */
    handleNetworkClonePlace(action) {
        const originalPiece = this.pieces.find(p => p.id === action.pieceId);
        if (!originalPiece) return;

        // 检查分身是否已经存在
        if (originalPiece.clonePiece) return;

        // 创建分身
        const clone = new Piece(action.x, action.y, originalPiece.color, originalPiece.player, action.cloneId);
        clone.isClone = true;
        clone.originalPiece = originalPiece;
        // 与普通棋子属性一致
        const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
        clone.radius = isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius;
        clone.mass = isChaos4Mode ? GAME_CONFIG.chaos4.pieceMass : 1;
        clone.friction = isChaos4Mode ? GAME_CONFIG.chaos4.pieceFriction : GAME_CONFIG.pieceFriction;
        clone.vx = 0;
        clone.vy = 0;
        clone.skill = GAME_CONFIG.skills.clone;
        clone.skillUsed = true;
        clone.skillActive = true;
        clone.skillTurnsRemaining = GAME_CONFIG.skills.clone.duration;

        originalPiece.clonePiece = clone;
        originalPiece.clonePlaced = true;
        this.pieces.push(clone);

        // 对手放置了分身
    }

    /**
     * 处理网络技能使用
     * @param {object} action - 技能使用操作
     */
    handleNetworkSkillUse(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece && piece.skill) {
            SkillLogic.useSkill(piece, this.turnCount);
        }
    }

    /**
     * 处理网络二连击第一次弹射
     * @param {object} action - 二连击第一次弹射操作
     */
    handleNetworkDoubleStrikeFirst(action) {
        // 在服务器权威物理模式下，不在这里处理物理
        // 位置更新通过 PIECE_POSITIONS 消息接收
        if (this.mode && this.mode.isNetworkMode) {
            // 服务器权威模式，仅记录操作
            return;
        }

        // 在网络模式下，根据棋子的玩家和位置来查找棋子
        let piece = this.pieces.find(p => p.id === action.pieceId);

        // 如果根据ID找不到，尝试根据玩家和位置来查找
        if (!piece && this.mode && this.mode.isNetworkMode) {
            // 找到与操作棋子同玩家的所有棋子
            const playerPieces = this.pieces.filter(p => p.player === action.player && p.isActive);

            if (playerPieces.length > 0) {
                // 找到位置最接近的棋子
                piece = playerPieces.reduce((closest, current) => {
                    const closestDist = Math.sqrt(Math.pow(closest.x - action.x, 2) + Math.pow(closest.y - action.y, 2));
                    const currentDist = Math.sqrt(Math.pow(current.x - action.x, 2) + Math.pow(current.y - action.y, 2));
                    return currentDist < closestDist ? current : closest;
                });
            }
        }

        if (piece) {
            // 更新二连击状态
            piece.doubleStrikeCount--;
            piece.isDoubleStrikeFirstShot = true;

            piece.vx = action.vx;
            piece.vy = action.vy;
            piece.isSelected = false;
            this.selectedPiece = null;

            // 重置 lastTime，避免后台窗口的 deltaTime 过大导致棋子移动距离异常
            this.lastTime = 0;

            // 开始动画
            this.isAnimating = true;

            // 处理二连击第一次弹射
        }
    }

    /**
     * 处理网络狂暴技能复活
     * @param {object} action - 狂暴复活操作
     */
    handleNetworkFrenzyRespawn(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.x = action.x;
            piece.y = action.y;
            piece.vx = 0;
            piece.vy = 0;
            piece.skillActive = false;
            piece.skillTurnsRemaining = 0;
            piece.isActive = true;
            piece.isOut = false;
            // 激活绿色呼吸闪烁效果
            piece.startRespawnFlash();
            // 处理狂暴技能复活
        }
    }

    /**
     * 处理网络普通复活
     * @param {object} action - 复活操作
     */
    handleNetworkRespawn(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.x = action.x;
            piece.y = action.y;
            piece.vx = 0;
            piece.vy = 0;
            piece.isActive = true;
            piece.isOut = false;
            // 激活绿色闪烁效果，持续1秒
            piece.startRespawnFlash();
            // 显示保护机制复活提示
            this.showTemporaryMessage('第一回合保护机制：棋子复活！', 2000);
            // 处理普通复活
        }
    }

    /**
     * 处理网络无形技能失效后的复活
     * @param {object} action - 复活操作
     */
    handleNetworkIntangibleRespawn(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.x = action.x;
            piece.y = action.y;
            piece.vx = 0;
            piece.vy = 0;
            piece.isActive = true;
            piece.isOut = false;
            // 激活绿色闪烁效果
            piece.startRespawnFlash();

        }
    }

    /**
     * 处理乱斗模式保护复活
     * @param {object} action - 复活操作
     */
    handleNetworkChaosRespawn(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.x = action.x;
            piece.y = action.y;
            piece.vx = 0;
            piece.vy = 0;
            piece.isActive = true;
            piece.isOut = false;
            // 激活绿色闪烁效果
            piece.startRespawnFlash();
            // 显示乱斗模式保护复活提示
            this.showTemporaryMessage('保护机制：棋子复活！', 2000);
        }
    }

    /**
     * 处理富贵同享道具效果复活
     * @param {object} action - 复活操作
     */
    handleNetworkSharedProsperityRespawn(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.x = action.x;
            piece.y = action.y;
            piece.vx = 0;
            piece.vy = 0;
            piece.isActive = true;
            piece.isOut = false;
            // 激活绿色闪烁效果
            piece.startRespawnFlash();
            // 显示富贵同享复活提示
            this.showTemporaryMessage('富贵同享：棋子复活！', 2000);
        }
    }

    /**
     * 处理乱斗模式保护结束
     */
    handleChaosProtectionEnd() {
        this.chaosProtectionActive = false;
        this.updateChaosGlow();
    }

    /**
     * 更新乱斗模式保护光圈效果
     */
    updateChaosGlow() {
        // 清除所有画布上的保护状态类，避免模式切换时的闪烁
        const gameCanvas = document.getElementById('gameCanvas');
        const chaos4Canvas = document.getElementById('chaos4Canvas');
        
        if (gameCanvas) {
            gameCanvas.classList.remove('chaos-protection-glow');
            gameCanvas.classList.remove('chaos-protection-pulse');
        }
        
        if (chaos4Canvas) {
            chaos4Canvas.classList.remove('chaos-protection-glow');
            chaos4Canvas.classList.remove('chaos-protection-pulse');
        }

        if (!this.mode || !this.mode.isChaosMode) return;

        // 确定当前使用的画布
        const currentCanvas = this.mode.isChaos4Mode ? 
            chaos4Canvas : 
            gameCanvas || this.canvas;

        if (!currentCanvas) return;

        const shouldHaveGlow = this.chaosProtectionActive;
        
        // 只在状态实际改变时才更新DOM，避免CSS动画重启造成闪烁
        if (shouldHaveGlow) {
            currentCanvas.classList.add('chaos-protection-glow');
            currentCanvas.classList.add('chaos-protection-pulse');
        }
    }

    /**
     * 处理网络闪现移动
     * @param {object} action - 闪现移动操作
     */
    handleNetworkBlinkMove(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.x = action.x;
            piece.y = action.y;
            // 处理闪现移动
        }
    }

    /**
     * 处理网络棋子弹射
     * @param {object} action - 弹射操作
     */
    handleNetworkShoot(action) {
        // 在服务器权威物理模式下，不在这里处理物理
        // 位置更新通过 PIECE_POSITIONS 消息接收
        if (this.mode && this.mode.isNetworkMode) {
            // 服务器权威模式，仅记录操作，物理由服务器处理
            return;
        }

        // 在网络模式下，根据棋子的玩家和位置来查找棋子
        let piece = this.pieces.find(p => p.id === action.pieceId);

        // 如果根据ID找不到，尝试根据玩家和位置来查找
        if (!piece && this.mode && this.mode.isNetworkMode) {
            // 找到与操作棋子同玩家的所有棋子
            const playerPieces = this.pieces.filter(p => p.player === action.player && p.isActive);

            if (playerPieces.length > 0) {
                // 找到位置最接近的棋子
                piece = playerPieces.reduce((closest, current) => {
                    const closestDist = Math.sqrt(Math.pow(closest.x - action.x, 2) + Math.pow(closest.y - action.y, 2));
                    const currentDist = Math.sqrt(Math.pow(current.x - action.x, 2) + Math.pow(current.y - action.y, 2));
                    return currentDist < closestDist ? current : closest;
                });
            }
        }

        if (piece) {
            piece.vx = action.vx;
            piece.vy = action.vy;
            piece.isSelected = false;
            this.selectedPiece = null;

            // 重置 lastTime，避免后台窗口的 deltaTime 过大导致棋子移动距离异常
            this.lastTime = 0;

            // 开始动画
            this.isAnimating = true;
        }
    }

    /**
     * 处理网络技能失效
     * @param {object} action - 技能失效操作
     */
    handleNetworkDeactivateSkill(action) {
        const piece = this.pieces.find(p => p.id === action.pieceId);
        if (piece) {
            piece.deactivateSkill();
        }
    }

    /**
     * 处理网络全局技能使用
     * @param {object} action - 全局技能使用操作
     */
    handleNetworkGlobalSkillUse(action) {
        if (this.mode && (this.mode.isSkillMode || this.mode.isNetworkMode)) {
            if (action.playerId === 1) {
                this.mode.player1GlobalSkillUsed = true;
            } else {
                this.mode.player2GlobalSkillUsed = true;
            }

            this.mode.globalSkillActive = true;
            this.mode.globalSkillTurnsRemaining = GAME_CONFIG.globalSkills[action.skillId]?.duration || 2;
            this.mode.globalSkillType = action.skillId;

            // 应用全局技能效果
            this.applyGlobalSkillEffect(action.skillId);
            this.updateGlobalSkillButton();
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        // 乱斗模式不检查isAnimating，因为物理连续运行
        const isChaosMode = this.mode && this.mode.isChaosMode;
        if (!isChaosMode && (this.gameOver || this.isAnimating)) return;

        const pos = this.getMousePos(e);

        // 网络模式下的特殊处理
        if (this.mode && this.mode.isNetworkMode) {
            // 获取全局的networkManager
            const networkManager = window.networkManager;

            // 在网络模式下，玩家只能选择自己的棋子
            // 首先检查是否是当前玩家的回合（乱斗模式不需要检查）
            const isCurrentPlayerTurn = isChaosMode || (networkManager && networkManager.playerId === this.currentPlayer);
            
            // 检查是否点击了自己的超重或分身棋子（无论是否是自己的回合）
            for (let piece of this.pieces) {
                // 跳过分身棋子（包括分身的分身）
                if (piece.isClone) {
                    continue;
                }
                // 跳过冻结棋子
                if (piece.isFrozen) {
                    continue;
                }
                // 如果点击的是自己的棋子，且是超重或分身技能
                if (piece.isActive && piece.contains(pos.x, pos.y) && piece.player === networkManager.playerId &&
                    (SkillLogic.isHeavySkill(piece) || SkillLogic.isCloneSkill(piece))) {
                    // 乱斗模式：立即允许拖拽弹射（无需先选中）
                    // 如果是自己的回合且点击的是已选中的棋子，则允许拖拽弹射
                    if ((isChaosMode || isCurrentPlayerTurn) && this.selectedPiece === piece) {
                        if (piece.vx === 0 && piece.vy === 0) {
                            this.draggedPiece = piece;
                            piece.startDrag(pos.x, pos.y);
                            // 更新提示：拖拽棋子时
                            this.updateGameHint('dragging');
                        }
                        return;
                    } else {
                        // 选择该棋子（无论是否是自己的回合）
                        if (this.selectedPiece) {
                            this.selectedPiece.isSelected = false;
                        }
                        this.selectedPiece = piece;
                        piece.isSelected = true;
                        this.updateSkillButton();
                        // 乱斗模式：立即开始拖拽
                        if (isChaosMode && piece.vx === 0 && piece.vy === 0) {
                            this.draggedPiece = piece;
                            piece.startDrag(pos.x, pos.y);
                            this.updateGameHint('dragging');
                        }
                        // 更新提示：选中棋子时
                        this.updateGameHint('selected');
                        return;
                    }
                }
            }
            
            // 检查是否在放置分身（无论是否是自己的回合）
            if (this.selectedPiece && this.selectedPiece.skillActive &&
                SkillLogic.isCloneSkill(this.selectedPiece) &&
                !this.selectedPiece.clonePlaced && this.selectedPiece.player === networkManager.playerId) {
                // 检查放置位置是否会与其他棋子碰撞
                let canPlace = true;
                for (let piece of this.pieces) {
                    if (piece !== this.selectedPiece && piece.isActive) {
                        const dx = pos.x - piece.x;
                        const dy = pos.y - piece.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < this.selectedPiece.radius + piece.radius) {
                            canPlace = false;
                            break;
                        }
                    }
                }

                // 检查放置位置是否会与墙壁碰撞
                if (canPlace) {
                    const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
                    const tempPiece = { x: pos.x, y: pos.y, radius: isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius };
                    for (let wall of this.terrain) {
                        if (PhysicsEngine.checkWallCollision(tempPiece, wall)) {
                            canPlace = false;
                            break;
                        }
                    }
                }

                // 检查是否在画布范围内
                if (canPlace) {
                    const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
                    const margin = isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius;
                    if (pos.x < margin || pos.x > this.canvas.width - margin ||
                        pos.y < margin || pos.y > this.canvas.height - margin) {
                        canPlace = false;
                    }
                }

                if (!canPlace) {
                    // 显示提示信息
                    this.showTemporaryMessage('不能放置在此位置，请重新选择位置');
                    return;
                }
                
                // 放置分身
                this.selectedPiece.clonePiece = new Piece(pos.x, pos.y, this.selectedPiece.color, this.selectedPiece.player, `${this.selectedPiece.id}_clone`);
                this.selectedPiece.clonePiece.isClone = true;
                this.selectedPiece.clonePiece.originalPiece = this.selectedPiece;
                // 与普通棋子属性一致
                const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
                this.selectedPiece.clonePiece.radius = isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius;
                this.selectedPiece.clonePiece.mass = isChaos4Mode ? GAME_CONFIG.chaos4.pieceMass : 1;
                this.selectedPiece.clonePiece.friction = isChaos4Mode ? GAME_CONFIG.chaos4.pieceFriction : GAME_CONFIG.pieceFriction;
                this.selectedPiece.clonePiece.vx = 0;
                this.selectedPiece.clonePiece.vy = 0;
                this.selectedPiece.clonePiece.skill = this.selectedPiece.skill;
                this.selectedPiece.clonePiece.skillUsed = true;
                this.selectedPiece.clonePiece.skillActive = true;
                this.selectedPiece.clonePiece.skillTurnsRemaining = this.selectedPiece.skillTurnsRemaining;
                this.selectedPiece.clonePlaced = true;
                this.pieces.push(this.selectedPiece.clonePiece);

                // 在网络模式下发送分身放置消息给对手
                if (this.mode && this.mode.isNetworkMode) {
                    const clonePlaceData = {
                        type: 'clonePlace',
                        pieceId: this.selectedPiece.id,
                        cloneId: this.selectedPiece.clonePiece.id,
                        x: pos.x,
                        y: pos.y
                    };
                    networkManager.sendPlayerAction(clonePlaceData);
                }
                return;
            }
            
            // 只有在自己的回合才能进行拖拽弹射（乱斗模式除外）
            if (isChaosMode || isCurrentPlayerTurn) {
                for (let piece of this.pieces) {
                    // 跳过分身棋子（包括分身的分身）
                    if (piece.isClone) {
                        continue;
                    }
                    // 跳过冻结棋子
                    if (piece.isFrozen) {
                        continue;
                    }
                    // 如果点击的是自己的棋子
                    if (piece.isActive && piece.contains(pos.x, pos.y) && piece.player === networkManager.playerId) {
                        // 如果点击的是已选中的棋子，则允许拖拽弹射
                        if (this.selectedPiece === piece) {
                            if (piece.vx === 0 && piece.vy === 0) {
                                this.draggedPiece = piece;
                                piece.startDrag(pos.x, pos.y);
                                // 更新提示：拖拽棋子时
                                this.updateGameHint('dragging');
                            }
                        } else {
                            // 选择该棋子
                            if (this.selectedPiece) {
                                this.selectedPiece.isSelected = false;
                            }
                            this.selectedPiece = piece;
                            piece.isSelected = true;
                            this.updateSkillButton();
                            // 更新提示：选中棋子时
                            this.updateGameHint('selected');
                        }
                        return;
                    }
                }
            }
            
            return; // 在网络模式下，不处理其他情况
        }
        
        // 非网络模式下的处理
        for (let piece of this.pieces) {
            // 跳过分身棋子（包括分身的分身）
            if (piece.isClone) {
                continue;
            }
            // 跳过冻结棋子
            if (piece.isFrozen) {
                continue;
            }
            // 如果点击的是超重或克隆技能棋子，允许选择
            if (piece.isActive && piece.contains(pos.x, pos.y) &&
                (SkillLogic.isHeavySkill(piece) || SkillLogic.isCloneSkill(piece))) {
                // 如果点击的是已选中的棋子，且是当前玩家的棋子，则允许拖拽弹射
                if (this.selectedPiece === piece && piece.player === this.currentPlayer) {
                    if (piece.vx === 0 && piece.vy === 0) {
                        this.draggedPiece = piece;
                        piece.startDrag(pos.x, pos.y);
                        // 更新提示：拖拽棋子时
                        this.updateGameHint('dragging');
                    }
                } else {
                    // 选择该棋子
                    if (this.selectedPiece) {
                        this.selectedPiece.isSelected = false;
                    }
                    this.selectedPiece = piece;
                    piece.isSelected = true;
                    this.updateSkillButton();
                    // 更新提示：选中棋子时
                    this.updateGameHint('selected');
                }
                return;
            }
        }
        
        // 检查是否在放置分身
        if (this.selectedPiece && this.selectedPiece.skillActive &&
            SkillLogic.isCloneSkill(this.selectedPiece) &&
            !this.selectedPiece.clonePlaced) {
            // 检查放置位置是否会与其他棋子碰撞
            let canPlace = true;
            for (let piece of this.pieces) {
                if (piece !== this.selectedPiece && piece.isActive) {
                    const dx = pos.x - piece.x;
                    const dy = pos.y - piece.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < this.selectedPiece.radius + piece.radius) {
                        canPlace = false;
                        break;
                    }
                }
            }

            // 检查放置位置是否会与墙壁碰撞
            if (canPlace) {
                const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
                const tempPiece = { x: pos.x, y: pos.y, radius: isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius };
                for (let wall of this.terrain) {
                    if (PhysicsEngine.checkWallCollision(tempPiece, wall)) {
                        canPlace = false;
                        break;
                    }
                }
            }

            // 检查是否在画布范围内
            if (canPlace) {
                const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
                const margin = isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius;
                if (pos.x < margin || pos.x > this.canvas.width - margin ||
                    pos.y < margin || pos.y > this.canvas.height - margin) {
                    canPlace = false;
                }
            }

            if (!canPlace) {
                // 显示提示信息
                this.showTemporaryMessage('不能放置在此位置，请重新选择位置');
                return;
            }
            
            // 放置分身
            this.selectedPiece.clonePiece = new Piece(pos.x, pos.y, this.selectedPiece.color, this.selectedPiece.player, `${this.selectedPiece.id}_clone`);
            this.selectedPiece.clonePiece.isClone = true;
            this.selectedPiece.clonePiece.originalPiece = this.selectedPiece;
            this.selectedPiece.clonePiece.radius = this.selectedPiece.radius;
            this.selectedPiece.clonePiece.mass = this.selectedPiece.mass;
            this.selectedPiece.clonePiece.friction = this.selectedPiece.friction;
            this.selectedPiece.clonePiece.vx = 0;
            this.selectedPiece.clonePiece.vy = 0;
            this.selectedPiece.clonePiece.skill = this.selectedPiece.skill;
            this.selectedPiece.clonePiece.skillUsed = true;
            this.selectedPiece.clonePiece.skillActive = true;
            this.selectedPiece.clonePiece.skillTurnsRemaining = this.selectedPiece.skillTurnsRemaining;
            this.selectedPiece.clonePlaced = true;
            this.pieces.push(this.selectedPiece.clonePiece);
            return;
        }

        for (let piece of this.pieces) {
            // 跳过分身棋子（包括分身的分身）
            if (piece.isClone) {
                continue;
            }
            // 跳过冻结棋子
            if (piece.isFrozen) {
                continue;
            }
            // 允许选择任何玩家的超重和分身技能棋子，即使是在对手的回合
            const canSelectPiece = piece.isActive && piece.contains(pos.x, pos.y) &&
                (piece.player === this.currentPlayer || (SkillLogic.isHeavySkill(piece) || SkillLogic.isCloneSkill(piece)));

            if (canSelectPiece) {
                if (piece.vx === 0 && piece.vy === 0) {
                    if (this.selectedPiece === piece) {
                        // 只有当前玩家的棋子才能拖拽弹射
                        if (piece.player === this.currentPlayer) {
                            this.draggedPiece = piece;
                            piece.startDrag(pos.x, pos.y);
                            // 更新提示：拖拽棋子时
                            this.updateGameHint('dragging');
                        }
                    } else {
                        if (this.selectedPiece) {
                            this.selectedPiece.isSelected = false;
                        }
                        this.selectedPiece = piece;
                        piece.isSelected = true;
                        this.updateSkillButton();
                        // 更新提示：选中棋子时
                        this.updateGameHint('selected');
                    }
                    break;
                }
            }
        }
    }

    handleMouseMove(e) {
        if (!this.draggedPiece) return;
        
        const pos = this.getMousePos(e);
        this.draggedPiece.updateDrag(pos.x, pos.y);
    }

    handleMouseUp(e) {
        if (!this.draggedPiece) return;

        // 乱斗模式标志
        const isChaosMode = this.mode && this.mode.isChaosMode;
        
        this.draggedPiece.endDrag();
        
        // 播放弹射音效，只有当力度达到最大时才播放
        const shootPower = Math.sqrt(this.draggedPiece.vx * this.draggedPiece.vx + this.draggedPiece.vy * this.draggedPiece.vy);
        // 只有当力度接近最大值时才播放音效
        const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
        const maxPowerScale = isChaos4Mode ? GAME_CONFIG.chaos4.maxPowerScale : GAME_CONFIG.maxPowerScale;
        if (shootPower >= maxPowerScale * 0.95) {
            this.playShootSound(shootPower);
        }
        
        // 更新提示：弹射后隐藏提示框
        this.updateGameHint('hidden');
        
        // 隐藏力度条并清除动画和特效
        const player1Bar = document.getElementById('player1PowerBar');
        const player2Bar = document.getElementById('player2PowerBar');
        player1Bar.style.display = 'none';
        player2Bar.style.display = 'none';
        player1Bar.style.animation = '';
        player2Bar.style.animation = '';
        player1Bar.style.boxShadow = '';
        player2Bar.style.boxShadow = '';
        
        // 闪现技能在弹射后立即失效
        if (this.draggedPiece.skillActive && this.draggedPiece.skill && 
            SkillLogic.isBlinkSkill(this.draggedPiece)) {
            this.draggedPiece.deactivateSkill();
            
            // 在网络模式下发送技能失效消息
            if (this.mode && this.mode.isNetworkMode) {
                const networkManager = window.networkManager;
                if (networkManager) {
                    networkManager.sendPlayerAction({
                        type: 'deactivateSkill',
                        pieceId: this.draggedPiece.id,
                        player: this.draggedPiece.player
                    });
                }
            }
        }
        
        // 二连击技能：可以弹射两次
        if (this.draggedPiece.skillActive && this.draggedPiece.skill &&
            SkillLogic.isDoubleStrikeSkill(this.draggedPiece) && this.draggedPiece.doubleStrikeCount > 1) {
            this.draggedPiece.doubleStrikeCount--;
            // 设置标志，表示这是二连击的第一次弹射
            this.draggedPiece.isDoubleStrikeFirstShot = true;
            this.draggedPiece.isSelected = true;
            this.selectedPiece = this.draggedPiece;

            // 在网络模式下发送射击操作（发送拖拽数据，服务器计算速度）
            if (this.mode && this.mode.isNetworkMode) {
                const networkManager = window.networkManager;
                if (networkManager) {
                    networkManager.sendPlayerAction({
                        type: 'doubleStrikeFirst',
                        pieceId: this.draggedPiece.id,
                        player: this.draggedPiece.player,
                        dragStartX: this.draggedPiece.dragStartX,
                        dragStartY: this.draggedPiece.dragStartY,
                        dragEndX: this.draggedPiece.dragCurrentX,
                        dragEndY: this.draggedPiece.dragCurrentY
                    });
                }
            }

            this.draggedPiece = null;
            // 乱斗模式不设置isAnimating，因为物理连续运行
            if (!isChaosMode) {
                this.isAnimating = true;
            }
        } else if (this.draggedPiece.skillActive && this.draggedPiece.skill &&
            SkillLogic.isDoubleStrikeSkill(this.draggedPiece)) {
            // 第二次弹射后，技能失效
            this.draggedPiece.deactivateSkill();
            this.draggedPiece.isSelected = false;
            this.selectedPiece = null;
            // 清除技能使用中的标志
            if (this.draggedPiece.isUsingSkill) {
                this.draggedPiece.isUsingSkill = false;
            }
            
            // 在网络模式下发送技能失效消息
            if (this.mode && this.mode.isNetworkMode) {
                const networkManager = window.networkManager;
                if (networkManager) {
                    networkManager.sendPlayerAction({
                        type: 'deactivateSkill',
                        pieceId: this.draggedPiece.id,
                        player: this.draggedPiece.player
                    });
                }
            }
            
            // 在网络模式下发送射击操作（发送拖拽数据，服务器计算速度）
            if (this.mode && this.mode.isNetworkMode) {
                const networkManager = window.networkManager;
                if (networkManager) {
                    networkManager.sendPlayerAction({
                        type: 'shoot',
                        pieceId: this.draggedPiece.id,
                        player: this.draggedPiece.player,
                        dragStartX: this.draggedPiece.dragStartX,
                        dragStartY: this.draggedPiece.dragStartY,
                        dragEndX: this.draggedPiece.dragCurrentX,
                        dragEndY: this.draggedPiece.dragCurrentY
                    });
                } else {
                    console.error('networkManager不存在');
                }
            }
            
            this.draggedPiece = null;
            // 乱斗模式不设置isAnimating，因为物理连续运行
            if (!isChaosMode) {
                this.isAnimating = true;
            }
        } else {
            // 清除技能使用中的标志
            if (this.draggedPiece.isUsingSkill) {
                this.draggedPiece.isUsingSkill = false;
            }
            
            // 在网络模式下发送射击操作（发送拖拽数据，服务器计算速度）
            if (this.mode && this.mode.isNetworkMode) {
                const networkManager = window.networkManager;
                if (networkManager) {
                    networkManager.sendPlayerAction({
                        type: 'shoot',
                        pieceId: this.draggedPiece.id,
                        player: this.draggedPiece.player,
                        dragStartX: this.draggedPiece.dragStartX,
                        dragStartY: this.draggedPiece.dragStartY,
                        dragEndX: this.draggedPiece.dragCurrentX,
                        dragEndY: this.draggedPiece.dragCurrentY
                    });
                } else {
                    console.error('networkManager不存在');
                }
            }
            
            this.draggedPiece.isSelected = false;
            this.selectedPiece = null;
            this.draggedPiece = null;
            // 乱斗模式不设置isAnimating，因为物理连续运行
            if (!isChaosMode) {
                this.isAnimating = true;
            }
        }

        this.updateSkillButton();
    }

    handleKeyDown(e) {
        if (e.code === 'Space' && this.draggedPiece) {
            e.preventDefault();
            this.draggedPiece.isDragging = false;
            this.draggedPiece.isSelected = true;
            this.selectedPiece = this.draggedPiece;
            this.draggedPiece = null;
            // 更新提示：取消拖拽后恢复为选中状态提示
            this.updateGameHint('selected');
        }

        if (this.selectedPiece && this.selectedPiece.skillActive &&
            SkillLogic.isBlinkSkill(this.selectedPiece)) {
            const moveSpeed = this.blinkMoveSpeed;

            // 在网络模式下，每次移动前检查当前位置是否安全
            // 如果当前位置不安全（被其他棋子压住），先移动到安全位置
            if (this.mode && this.mode.isNetworkMode) {
                let needsReposition = false;
                for (let piece of this.pieces) {
                    if (piece !== this.selectedPiece && piece.isActive) {
                        const pieceDx = this.selectedPiece.x - piece.x;
                        const pieceDy = this.selectedPiece.y - piece.y;
                        const pieceDistance = Math.sqrt(pieceDx * pieceDx + pieceDy * pieceDy);
                        if (pieceDistance < this.blinkMinDistance) {
                            needsReposition = true;
                            break;
                        }
                    }
                }

                if (needsReposition) {
                    this.moveBlinkPieceToSafePosition();

                    // 如果重新定位后仍然不安全，则不允许移动
                    for (let piece of this.pieces) {
                        if (piece !== this.selectedPiece && piece.isActive) {
                            const pieceDx = this.selectedPiece.x - piece.x;
                            const pieceDy = this.selectedPiece.y - piece.y;
                            const pieceDistance = Math.sqrt(pieceDx * pieceDx + pieceDy * pieceDy);
                            if (pieceDistance < this.blinkMinDistance) {
                                e.preventDefault();
                                return;
                            }
                        }
                    }
                }
            }

            let newX = this.selectedPiece.x;
            let newY = this.selectedPiece.y;

            switch (e.code) {
                case 'ArrowUp':
                    newY -= moveSpeed;
                    break;
                case 'ArrowDown':
                    newY += moveSpeed;
                    break;
                case 'ArrowLeft':
                    newX -= moveSpeed;
                    break;
                case 'ArrowRight':
                    newX += moveSpeed;
                    break;
                default:
                    return;
            }

            const dx = newX - this.selectedPiece.blinkCenterX;
            const dy = newY - this.selectedPiece.blinkCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.blinkRadius) {
                // 检查新位置是否会与其他棋子碰撞
                let canMove = true;
                for (let piece of this.pieces) {
                    if (piece !== this.selectedPiece && piece.isActive) {
                        const pieceDx = newX - piece.x;
                        const pieceDy = newY - piece.y;
                        const pieceDistance = Math.sqrt(pieceDx * pieceDx + pieceDy * pieceDy);
                        if (pieceDistance < this.blinkMinDistance) {
                            canMove = false;
                            break;
                        }
                    }
                }

                if (canMove) {
                    // 检查新位置是否会与墙壁碰撞
                    const tempPiece = { x: newX, y: newY, radius: this.selectedPiece.radius };
                    for (let wall of this.terrain) {
                        if (PhysicsEngine.checkWallCollision(tempPiece, wall)) {
                            canMove = false;
                            break;
                        }
                    }
                }

                // 检查圆心是否在画布范围内（仅检查中心点，不考虑棋子半径）
                if (canMove) {
                    if (newX < 0 || newX > this.canvas.width ||
                        newY < 0 || newY > this.canvas.height) {
                        canMove = false;
                    }
                }

                if (canMove) {
                    this.selectedPiece.x = newX;
                    this.selectedPiece.y = newY;

                    // 在网络模式下发送闪现移动同步消息
                    if (this.mode && this.mode.isNetworkMode) {
                        const networkManager = window.networkManager;
                        if (networkManager) {
                            // 使用节流来限制发送频率，避免过于频繁的网络请求
                            if (!this.lastBlinkMoveTime || Date.now() - this.lastBlinkMoveTime > 100) {
                                // 标记待处理的blinkMove，避免被旧PIECE_POSITIONS覆盖
                                this.blinkMovePending[this.selectedPiece.id] = Date.now();
                                networkManager.sendPlayerAction({
                                    type: 'blinkMove',
                                    pieceId: this.selectedPiece.id,
                                    player: this.selectedPiece.player,
                                    x: newX,
                                    y: newY
                                });
                                this.lastBlinkMoveTime = Date.now();
                            }
                        }
                    }
                }
            }

            e.preventDefault();
        }
    }

    useSelectedPieceSkill() {
        // 使用选中棋子技能

        // 技能模式下前N回合不能使用技能
        const isSkillMode = this.mode && this.mode.isSkillMode;
        const skillUnlockTurn = GAME_CONFIG.skillUnlockTurn;
        if (isSkillMode && this.turnCount < skillUnlockTurn) {
            this.showTemporaryMessage(`${skillUnlockTurn - this.turnCount} 回合后可使用技能`);
            return;
        }
        
        // 在动画状态下，不能使用任何技能
        if (this.isAnimating) {
            return;
        }
        
        // 检查是否是网络模式
        const isNetworkMode = this.mode && this.mode.isNetworkMode;
        const networkManager = isNetworkMode ? window.networkManager : null;
        
        // 检查是否是自己的棋子
        const isOwnPiece = !isNetworkMode || (networkManager && this.selectedPiece && this.selectedPiece.player === networkManager.playerId);
        
        // 检查是否是超重或分身技能
        const isHeavyOrCloneSkill = this.selectedPiece && (SkillLogic.isHeavySkill(this.selectedPiece) || SkillLogic.isCloneSkill(this.selectedPiece));

        // 分身技能：不允许同时存在多个分身，必须等当前分身消失后才能再次使用
        const hasActiveClone = this.selectedPiece && SkillLogic.isCloneSkill(this.selectedPiece) && this.selectedPiece.clonePlaced;

        // 对于分身技能，允许使用两次（maxUses），但每回合只能使用一次，且不能同时有多个分身
        const canUseSkill = this.selectedPiece && this.selectedPiece.skill &&
            isOwnPiece &&
            (!hasActiveClone) && // 分身技能：不能已有活跃分身
            (!this.selectedPiece.skillUsed || (SkillLogic.isCloneSkill(this.selectedPiece) && this.selectedPiece.skillUses < GAME_CONFIG.skills.clone.maxUses)) &&
            (!SkillLogic.isCloneSkill(this.selectedPiece) || this.selectedPiece.skillUsesThisTurn === 0);
            
        if (canUseSkill) {
            SkillLogic.useSkill(this.selectedPiece, this.turnCount);

            // 在网络模式下发送技能使用操作
            if (this.mode && this.mode.isNetworkMode) {
                networkManager.sendPlayerAction({
                    type: 'useSkill',
                    pieceId: this.selectedPiece.id,
                    skillId: this.selectedPiece.skill.id
                });
            }
            
            // 对于二连击技能，显示黄色提示
            if (SkillLogic.isDoubleStrikeSkill(this.selectedPiece) && this.selectedPiece.skillActive) {
                // 显示二连击提示，使用黄色
                this.showTemporaryMessage('你可用该棋子进行两次弹射！', 2000, '#ffd700');
            }
            
            // 对于闪现技能，检查当前位置是否与其他棋子距离小于80px
            if (SkillLogic.isBlinkSkill(this.selectedPiece) && this.selectedPiece.skillActive) {
                // 设置闪现技能的最大移动范围
                this.selectedPiece.blinkRadius = this.blinkRadius;
                this.moveBlinkPieceToSafePosition();
            }

            this.updateSkillButton();
        }
    }

    moveBlinkPieceToSafePosition() {
        const blinkPiece = this.selectedPiece;
        let currentX = blinkPiece.x;
        let currentY = blinkPiece.y;
        let isSafe = true;

        // 检查当前位置是否安全（棋子碰撞）
        for (let piece of this.pieces) {
            if (piece !== blinkPiece && piece.isActive) {
                const dx = currentX - piece.x;
                const dy = currentY - piece.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < this.blinkMinDistance) {
                    isSafe = false;
                    break;
                }
            }
        }

        // 检查当前位置是否与墙壁碰撞
        if (isSafe) {
            const tempPiece = { x: currentX, y: currentY, radius: blinkPiece.radius };
            for (let wall of this.terrain) {
                if (PhysicsEngine.checkWallCollision(tempPiece, wall)) {
                    isSafe = false;
                    break;
                }
            }
        }
        
        // 如果不安全，找到安全位置
        if (!isSafe) {
            const radius = this.blinkMinDistance;
            let angle = 0;
            const step = Math.PI / 8; // 45度为一步

            // 尝试不同角度，找到安全位置
            while (angle < Math.PI * 2) {
                const newX = blinkPiece.blinkCenterX + Math.cos(angle) * radius;
                const newY = blinkPiece.blinkCenterY + Math.sin(angle) * radius;

                // 检查新位置是否安全（棋子碰撞）
                let safe = true;
                for (let piece of this.pieces) {
                    if (piece !== blinkPiece && piece.isActive) {
                        const dx = newX - piece.x;
                        const dy = newY - piece.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < this.blinkMinDistance) {
                            safe = false;
                            break;
                        }
                    }
                }

                // 检查新位置是否会与墙壁碰撞
                if (safe) {
                    const tempPiece = { x: newX, y: newY, radius: blinkPiece.radius };
                    for (let wall of this.terrain) {
                        if (PhysicsEngine.checkWallCollision(tempPiece, wall)) {
                            safe = false;
                            break;
                        }
                    }
                }

                // 检查是否在棋盘范围内（考虑棋子半径）
                const margin = blinkPiece.radius;
                if (safe && newX > margin && newX < this.canvas.width - margin &&
                    newY > margin && newY < this.canvas.height - margin) {
                    blinkPiece.x = newX;
                    blinkPiece.y = newY;

                    // 在网络模式下，通知服务器闪现位置已更新
                    if (this.mode && this.mode.isNetworkMode) {
                        const networkManager = window.networkManager;
                        if (networkManager) {
                            // 标记该棋子有待处理的blinkMove，避免被旧PIECE_POSITIONS覆盖
                            this.blinkMovePending[blinkPiece.id] = Date.now();
                            networkManager.sendPlayerAction({
                                type: 'blinkMove',
                                pieceId: blinkPiece.id,
                                player: blinkPiece.player,
                                x: newX,
                                y: newY
                            });
                        }
                    }
                    break;
                }

                angle += step;
            }
        }
    }

    updateSkillButton() {
        const skillButton = document.getElementById('useSkillButton');
        if (!skillButton) return;

        // 技能模式下前N回合不能使用技能
        const isSkillMode = this.mode && this.mode.isSkillMode;
        const skillUnlockTurn = GAME_CONFIG.skillUnlockTurn;
        const canUseSkill = !isSkillMode || this.turnCount >= skillUnlockTurn;

        // 检查是否是网络模式
        const isNetworkMode = this.mode && this.mode.isNetworkMode;
        const networkManager = isNetworkMode ? window.networkManager : null;
        
        // 检查是否是自己的棋子
        const isOwnPiece = !isNetworkMode || (networkManager && this.selectedPiece && this.selectedPiece.player === networkManager.playerId);

        // 分身技能：不允许同时存在多个分身
        const hasActiveClone = this.selectedPiece && SkillLogic.isCloneSkill(this.selectedPiece) && this.selectedPiece.clonePlaced;

        // 对于分身技能，即使skillUsed为false但使用次数已达2次，或本回合已使用过技能，或已有活跃分身，也不显示技能按钮
        const canUseSkillButton = this.selectedPiece && this.selectedPiece.skill &&
            isOwnPiece &&
            (!hasActiveClone) && // 分身技能：不能已有活跃分身
            (!this.selectedPiece.skillUsed || (SkillLogic.isCloneSkill(this.selectedPiece) && this.selectedPiece.skillUses < GAME_CONFIG.skills.clone.maxUses)) &&
            (!SkillLogic.isCloneSkill(this.selectedPiece) || this.selectedPiece.skillUsesThisTurn === 0) &&
            canUseSkill;

        if (canUseSkillButton) {
            skillButton.style.display = 'block';
            skillButton.textContent = `使用技能: ${this.selectedPiece.skill.name}`;
            skillButton.disabled = false;
        } else if (this.selectedPiece && this.selectedPiece.skill &&
                   isOwnPiece &&
                   (!hasActiveClone) &&
                   (!this.selectedPiece.skillUsed || (SkillLogic.isCloneSkill(this.selectedPiece) && this.selectedPiece.skillUses < GAME_CONFIG.skills.clone.maxUses)) &&
                   !canUseSkill) {
            skillButton.style.display = 'block';
            skillButton.textContent = `${skillUnlockTurn - this.turnCount} 回合后可使用技能`;
            skillButton.disabled = true;
        } else {
            skillButton.style.display = 'none';
        }
    }

    checkCollisions() {
        // 检查棋子之间的碰撞
        for (let i = 0; i < this.pieces.length; i++) {
            for (let j = i + 1; j < this.pieces.length; j++) {
                const p1 = this.pieces[i];
                const p2 = this.pieces[j];
                
                if (!p1.isActive || !p2.isActive) continue;
                
                // 判断是否应该跳过碰撞检测
                let skipCollision = false;
                
                // 如果p1是无形状态且不是当前玩家的棋子，则跳过碰撞
                if (p1.isIntangible && p1.player !== this.currentPlayer) {
                    skipCollision = true;
                }
                // 如果p2是无形状态且不是当前玩家的棋子，则跳过碰撞
                if (p2.isIntangible && p2.player !== this.currentPlayer) {
                    skipCollision = true;
                }
                
                if (skipCollision) continue;
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = p1.radius + p2.radius;
                
                if (distance < minDistance) {
                    const angle = Math.atan2(dy, dx);
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);
                    
                    const vx1 = p1.vx * cos + p1.vy * sin;
                    const vy1 = p1.vy * cos - p1.vx * sin;
                    const vx2 = p2.vx * cos + p2.vy * sin;
                    const vy2 = p2.vy * cos - p2.vx * sin;
                    
                    const m1 = p1.mass;
                    const m2 = p2.mass;
                    const totalMass = m1 + m2;
                    
                    const finalVx1 = ((m1 - m2) * vx1 + 2 * m2 * vx2) / totalMass;
                    const finalVx2 = ((m2 - m1) * vx2 + 2 * m1 * vx1) / totalMass;
                    
                    p1.vx = finalVx1 * cos - vy1 * sin;
                    p1.vy = vy1 * cos + finalVx1 * sin;
                    p2.vx = finalVx2 * cos - vy2 * sin;
                    p2.vy = vy2 * cos + finalVx2 * sin;
                    
                    const overlap = minDistance - distance;
                    const separationX = (overlap / 2) * cos;
                    const separationY = (overlap / 2) * sin;
                    
                    p1.x -= separationX;
                    p1.y -= separationY;
                    p2.x += separationX;
                    p2.y += separationY;
                    
                    // 计算碰撞时的相对速度
                    const relativeSpeed = Math.sqrt((p1.vx - p2.vx) ** 2 + (p1.vy - p2.vy) ** 2);
                    // 播放碰撞音效，根据速度调整音量
                    // 当棋子正在使用闪现技能时，不播放碰撞音效
                    // 在网络模式下，只在服务器发送指令时播放音效，避免重复播放
                    if (!(this.mode && this.mode.isNetworkMode) && !(p1.skillActive && SkillLogic.isBlinkSkill(p1)) && !(p2.skillActive && SkillLogic.isBlinkSkill(p2))) {
                        this.playCollisionSound(relativeSpeed);
                    }
                    
                    // 生成碰撞粒子特效
                    if (this.particleSystem) {
                        // 计算碰撞位置（两个棋子的中间点）
                        const collisionX = (p1.x + p2.x) / 2;
                        const collisionY = (p1.y + p2.y) / 2;
                        // 使用两个棋子颜色的混合色
                        const color1 = p1.color || '#ff4757';
                        const color2 = p2.color || '#3742fa';
                        // 简单的颜色混合（取两个颜色的平均值）
                        const color = this.blendColors(color1, color2);
                        // 生成粒子特效
                        this.particleSystem.createCollisionParticles(collisionX, collisionY, color, relativeSpeed);
                    }
                }
            }
        }
        
        // 检查棋子与地形的碰撞
        for (let piece of this.pieces) {
            if (!piece.isActive) continue;
            
            // 只有当无形棋子不是当前玩家棋子时，才跳过与墙壁的碰撞
            if (piece.isIntangible && piece.player !== this.currentPlayer) continue;
            
            for (let wall of this.terrain) {
                this.checkWallCollision(piece, wall);
            }
        }
    }
    
    // 检查棋子与墙壁的碰撞
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
        
        if (distance < collisionDistance) {
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
                piece.vx *= 0.8;
                piece.vy *= 0.8;
                
                // 计算碰撞时的速度
                const collisionSpeed = Math.sqrt((piece.vx + 2 * dot * normalX) ** 2 + (piece.vy + 2 * dot * normalY) ** 2);
                // 播放碰撞音效，根据速度调整音量
                // 当棋子正在使用闪现技能时，不播放碰撞音效
                // 在网络模式下，只在服务器发送指令时播放音效，避免重复播放
                if (!(this.mode && this.mode.isNetworkMode) && !(piece.skillActive && SkillLogic.isBlinkSkill(piece))) {
                    this.playCollisionSound(collisionSpeed);
                }
                
                // 生成碰撞粒子特效
                if (this.particleSystem) {
                    // 使用棋子的颜色
                    const color = piece.color || '#ff4757';
                    // 生成粒子特效
                    this.particleSystem.createCollisionParticles(piece.x, piece.y, color, collisionSpeed);
                }
            }
    }
    
    /**
     * 混合两个颜色
     * @param {string} color1 - 第一个颜色（十六进制格式）
     * @param {string} color2 - 第二个颜色（十六进制格式）
     * @returns {string} 混合后的颜色（十六进制格式）
     */
    blendColors(color1, color2) {
        // 移除#号
        color1 = color1.replace('#', '');
        color2 = color2.replace('#', '');
        
        // 解析RGB值
        const r1 = parseInt(color1.substring(0, 2), 16);
        const g1 = parseInt(color1.substring(2, 4), 16);
        const b1 = parseInt(color1.substring(4, 6), 16);
        
        const r2 = parseInt(color2.substring(0, 2), 16);
        const g2 = parseInt(color2.substring(2, 4), 16);
        const b2 = parseInt(color2.substring(4, 6), 16);
        
        // 计算平均值
        const r = Math.round((r1 + r2) / 2);
        const g = Math.round((g1 + g2) / 2);
        const b = Math.round((b1 + b2) / 2);
        
        // 转换回十六进制格式
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    checkOutOfBounds() {
        for (let piece of this.pieces) {
            if (!piece.isActive) continue;
            
            // 棋子圆心超出边界就判死亡
            if (piece.x < 0 ||
                piece.x > this.canvas.width ||
                piece.y < 0 ||
                piece.y > this.canvas.height) {
                
                if (piece.skillActive && SkillLogic.isFrenzySkill(piece)) {
                    piece.x = piece.initialX;
                    piece.y = piece.initialY;
                    piece.vx = 0;
                    piece.vy = 0;
                    piece.skillActive = false;
                    piece.skillTurnsRemaining = 0;
                    // 激活绿色呼吸闪烁效果
                    piece.startRespawnFlash();
                    
                    // 在网络模式下发送复活同步消息
                    if (this.mode && this.mode.isNetworkMode) {
                        const networkManager = window.networkManager;
                        if (networkManager) {
                            networkManager.sendPlayerAction({
                                type: 'frenzyRespawn',
                                pieceId: piece.id,
                                player: piece.player,
                                x: piece.x,
                                y: piece.y
                            });
                        }
                    }
                } else if ((!this.mode || !this.mode.isNetworkMode) ? this.turnCount < 2 : this.turnCount <= 2) {
                    // 本地模式：前两个回合（turnCount=0,1）保护；联网模式：前三个回合（turnCount=0,1,2）保护（实际效果与本地模式下两个回合一样，这样设计是无奈之举）
                    this.showTemporaryMessage('第一回合保护机制：棋子复活！', 2000);
                    
                    // 标记棋子为飞出状态，避免重复处理
                    piece.isOut = true;
                    
                    // 0.5秒后复活棋子
                    setTimeout(() => {
                        if (piece && this.pieces.includes(piece)) {
                            piece.x = piece.initialX;
                            piece.y = piece.initialY;
                            piece.vx = 0;
                            piece.vy = 0;
                            piece.isOut = false;
                            
                            // 激活绿色闪烁效果，持续1秒
                            piece.startRespawnFlash();
                            
                            // 在网络模式下发送复活同步消息
                            if (this.mode && this.mode.isNetworkMode) {
                                const networkManager = window.networkManager;
                                if (networkManager) {
                                    networkManager.sendPlayerAction({
                                        type: 'respawn',
                                        pieceId: piece.id,
                                        player: piece.player,
                                        x: piece.x,
                                        y: piece.y
                                    });
                                }
                            }
                        }
                    }, 500);
                } else {
                    piece.isActive = false;
                    
                    // 如果本体被击败，其分身也应该消失
                    if (piece.clonePiece && piece.clonePiece.isActive) {
                        piece.clonePiece.isActive = false;
                    }

                    // 如果是二连击第一次弹射飞出棋盘，清除二连击状态并发送回合切换请求
                    if (piece.isDoubleStrikeFirstShot) {
                        piece.isDoubleStrikeFirstShot = false;
                        piece.doubleStrikeCount = 0;
                        if (piece.skillActive && SkillLogic.isDoubleStrikeSkill(piece)) {
                            piece.deactivateSkill();
                        }
                        // 发送回合切换请求（网络模式下 switchTurn 会返回 early）
                        this.switchTurn();
                    }
                }
            }
        }
    }

    checkAllStopped() {
        for (let piece of this.pieces) {
            if (piece.isActive && (piece.vx !== 0 || piece.vy !== 0)) {
                return false;
            }
        }
        return true;
    }

    checkWinner() {
        if (this.mode) {
            return this.mode.checkWinner(this);
        }
        return false;
    }

    endGame(winner) {
        // 检查是否是联网模式且有玩家已经离开
        if (this.mode && this.mode.isNetworkMode && window.networkManager) {
            // 检查当前房间是否存在且有两个玩家
            if (!window.networkManager.currentRoom) {
                return;
            }
        }
        
        this.gameOver = true;
        const playerLabel = winner === 1 ? 'A' : 'B';
        document.getElementById('winnerText').textContent = `玩家${playerLabel}获胜！`;

        // 根据游戏模式更新按钮文本
        const playAgainBtn = document.getElementById('playAgainBtn');
        const backToLobbyBtn = document.getElementById('backToLobbyBtn');
        const isChaos4Mode = this.mode && this.mode.isChaos4Mode;

        if (isChaos4Mode) {
            // 乱斗4人模式：只显示"返回大厅"，隐藏"再来一局"
            if (playAgainBtn) playAgainBtn.style.display = 'none';
            if (backToLobbyBtn) backToLobbyBtn.textContent = '返回大厅';
        } else if (this.mode && this.mode.isNetworkMode) {
            // 联网模式：显示"再来一局"和"返回大厅"
            if (playAgainBtn) {
                playAgainBtn.style.display = '';
                playAgainBtn.textContent = '再来一局';
            }
            if (backToLobbyBtn) backToLobbyBtn.textContent = '返回大厅';
        } else {
            // 本地模式：显示"再来一局"和"返回房间"（或"返回菜单"）
            if (playAgainBtn) {
                playAgainBtn.style.display = '';
                playAgainBtn.textContent = '再来一局';
            }
            if (backToLobbyBtn) backToLobbyBtn.textContent = '返回菜单';
        }

        document.getElementById('winnerModal').classList.add('show');
    }

    switchTurn() {
        // 网络模式下，回合切换由服务器控制
        if (this.mode && this.mode.isNetworkMode) {
            return;
        }
        
        // 减少所有激活技能的回合数
        for (let piece of this.pieces) {
            // 对于分身技能，特殊处理：不减少回合数也不在第一个块中停用
            if (piece.skillActive && !SkillLogic.isCloneSkill(piece) && piece.skillTurnsRemaining > 0) {
                piece.skillTurnsRemaining--;
                if (piece.skillTurnsRemaining <= 0) {
                    piece.deactivateSkill();

                    // 在网络模式下发送技能失效消息
                    const networkManager = window.networkManager;
                    if (networkManager) {
                        networkManager.sendPlayerAction({
                            type: 'deactivateSkill',
                            pieceId: piece.id,
                            player: piece.player
                        });
                    }
                }
            }

            // 对于分身技能（本体和分身）
            if (piece.skillActive && SkillLogic.isCloneSkill(piece)) {
                // 分身棋子：减少回合数
                if (piece.isClone && piece.skillTurnsRemaining > 0) {
                    piece.skillTurnsRemaining--;
                    if (piece.skillTurnsRemaining <= 0) {
                        piece.isActive = false;
                    }
                }
                // 本体棋子：检查是否有活跃的分身
                else if (!piece.isClone) {
                    let hasActiveClone = false;
                    for (let p of this.pieces) {
                        if (p.isClone && p.originalPiece === piece && p.isActive) {
                            hasActiveClone = true;
                            break;
                        }
                    }
                    // 如果没有活跃的分身，则停用技能（但保留 skillUses 记录）
                    if (!hasActiveClone) {
                        piece.skillActive = false;
                        piece.clonePiece = null;
                    }
                }
            }
            // 清除所有棋子的isUsingSkill标志，确保下一回合可以选择其他棋子
            if (piece.isUsingSkill) {
                piece.isUsingSkill = false;
            }
            // 清除所有棋子的选中状态（白色边框）
            if (piece.isSelected) {
                piece.isSelected = false;
            }
            // 重置本回合技能使用次数
            piece.skillUsesThisTurn = 0;
        }
        
        // 管理全局技能回合
        if (this.mode && (this.mode.isSkillMode || this.mode.isNetworkMode) && this.mode.globalSkillActive) {
            this.mode.globalSkillTurnsRemaining--;
            if (this.mode.globalSkillTurnsRemaining <= 0) {
                this.removeGlobalSkillEffect();
            }
        }
        
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.turnCount++;

        // 每20回合重置所有技能棋子的技能使用次数
        if (this.turnCount >= 20 && this.turnCount % 20 === 0 && this.mode && this.mode.isSkillMode) {
            this.resetSkillsForLongGame();
        }

        // 每隔intervalTurns回合生成地形
        const wallConfig = window.GAME_CONFIG ? window.GAME_CONFIG.wallGeneration : null;
        if (this.generateTerrain && wallConfig && this.turnCount % wallConfig.intervalTurns === 0) {
            this.generateWall();
        }
        
        this.updateUI();
        
        // 切换回合后重置提示
        this.selectedPiece = null;
        this.updateGameHint('none');
    }
    
    /**
     * 处理网络回合切换
     * @param {object} data - 回合切换数据
     */
    handleNetworkTurnChange(data) {
        if (!this.mode || !this.mode.isNetworkMode) {
            return;
        }

        // 更新当前玩家和回合计数
        this.currentPlayer = data.currentPlayer;
        this.turnCount = data.turnCount;

        // 注意：技能重置由服务器权威处理，客户端只接收 SKILL_RESET_NOTIFY 消息

        for (let piece of this.pieces) {
            // 清除所有棋子的isUsingSkill标志，确保下一回合可以选择其他棋子
            if (piece.isUsingSkill) {
                piece.isUsingSkill = false;
            }
            // 清除所有棋子的选中状态（白色边框）
            if (piece.isSelected) {
                piece.isSelected = false;
            }
            // 重置本回合技能使用次数
            piece.skillUsesThisTurn = 0;
        }

        // 同步全局技能状态（由服务器权威管理）
        if (data.globalSkillActive !== undefined) {
            this.mode.globalSkillActive = data.globalSkillActive;
            this.mode.globalSkillTurnsRemaining = data.globalSkillTurnsRemaining;
            this.mode.globalSkillType = data.globalSkillType;
            if (!data.globalSkillActive) {
                this.removeGlobalSkillEffect();
            }
        }

        // 同步墙壁（服务器权威地形）
        if (data.walls) {
            this.terrain = data.walls;
        }

        // 更新UI
        this.updateUI();

        // 切换回合后重置提示
        this.selectedPiece = null;
        this.updateGameHint('none');
    }

    /**
     * 处理服务器发送的棋子位置更新（服务器权威物理）
     * @param {Array} pieces - 棋子位置数组
     * @param {Array} walls - 墙壁数组（可选）
     * @param {boolean} chaosProtectionActive - 乱斗保护是否激活
     * @param {number} chaosProtectionRemaining - 乱斗保护剩余时间
     * @param {Object} playerEnergy - 玩家能量
     * @param {Object} playerEnergyProgress - 玩家能量进度
     * @param {Array} items - 道具数组（可选）
     * @param {Object} itemEffects - 道具效果状态（可选）
     */
    handleServerPiecePositions(pieces, walls, chaosProtectionActive, chaosProtectionRemaining, playerEnergy, playerEnergyProgress, items, itemEffects) {
        if (!this.mode || !this.mode.isNetworkMode) return;

        // 更新乱斗模式保护状态
        if (this.mode.isChaosMode) {
            this.chaosProtectionActive = chaosProtectionActive;
            this.chaosProtectionRemaining = chaosProtectionRemaining;
            this.updateChaosGlow();

            // 更新能量
            if (playerEnergy) {
                this.playerEnergy = playerEnergy;
            }
            if (playerEnergyProgress) {
                this.playerEnergyProgress = playerEnergyProgress;
            }

            // 更新道具列表
            if (items) {
                this.items = items.map(itemData => new Item(itemData));
            }

            // 更新道具效果状态
            if (itemEffects) {
                this.activeItemEffects = itemEffects;
            }
        }

        // 使用 Map 快速查找
        const pieceMap = new Map(this.pieces.map(p => [p.id, p]));

        for (let pos of pieces) {
            let piece = pieceMap.get(pos.id);
            if (!piece) {
                // 如果是新的分身棋子，需要创建并添加到 pieces 数组
                if (pos.isClone) {
                    if (pos.originalPieceId) {
                        // 通过 ID 找到本体（非分身的棋子）
                        const originalPiece = pieceMap.get(pos.originalPieceId);
                        if (originalPiece) {
                            piece = new Piece(pos.x, pos.y, originalPiece.color, originalPiece.player, pos.id);
                            piece.isClone = true;
                            piece.originalPiece = originalPiece;
                            const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
                            piece.radius = pos.radius || (isChaos4Mode ? GAME_CONFIG.chaos4.pieceRadius : GAME_CONFIG.pieceRadius);
                            piece.mass = pos.mass || (isChaos4Mode ? GAME_CONFIG.chaos4.pieceMass : 1);
                            piece.friction = pos.friction || (isChaos4Mode ? GAME_CONFIG.chaos4.pieceFriction : GAME_CONFIG.pieceFriction);
                            piece.vx = pos.vx || 0;
                            piece.vy = pos.vy || 0;
                            piece.skill = pos.skill || GAME_CONFIG.skills.clone;
                            piece.skillActive = pos.skillActive !== undefined ? pos.skillActive : true;
                            piece.skillUsed = pos.skillUsed !== undefined ? pos.skillUsed : true;
                            piece.skillTurnsRemaining = pos.skillTurnsRemaining || 0;
                            piece.skillUses = pos.skillUses || 0;
                            piece.isActive = pos.isActive !== undefined ? pos.isActive : true;
                            originalPiece.clonePiece = piece;
                            originalPiece.clonePlaced = true;
                            this.pieces.push(piece);
                            pieceMap.set(piece.id, piece);
                        }
                    }
                }
                continue;
            }

            // 检查是否有待处理的blinkMove（避免被旧PIECE_POSITIONS覆盖）
            const pendingTime = this.blinkMovePending[pos.id];
            if (pendingTime && Date.now() - pendingTime < 500) {
                if (Math.abs(pos.x - piece.x) < 1 && Math.abs(pos.y - piece.y) < 1) {
                    delete this.blinkMovePending[pos.id];
                } else {
                    continue;
                }
            }

            // 直接应用服务器状态（无条件覆盖）
            piece.x = Number.isFinite(pos.x) ? pos.x : piece.x;
            piece.y = Number.isFinite(pos.y) ? pos.y : piece.y;
            piece.vx = Number.isFinite(pos.vx) ? pos.vx : piece.vx;
            piece.vy = Number.isFinite(pos.vy) ? pos.vy : piece.vy;
            piece.radius = Number.isFinite(pos.radius) ? pos.radius : piece.radius;
            piece.mass = Number.isFinite(pos.mass) ? pos.mass : piece.mass;
            piece.friction = Number.isFinite(pos.friction) ? pos.friction : piece.friction;
            piece.minVelocity = Number.isFinite(pos.minVelocity) ? pos.minVelocity : piece.minVelocity;
            piece.isActive = pos.isActive;
            piece.isIntangible = pos.isIntangible !== undefined ? pos.isIntangible : piece.isIntangible;

            // 技能状态 - 直接应用服务器值
            piece.skillActive = pos.skillActive;
            piece.skill = pos.skill || piece.skill;
            piece.skillTurnsRemaining = pos.skillTurnsRemaining || 0;
            piece.skillUses = pos.skillUses || 0;
            piece.skillUsed = pos.skillUsed || false;
            piece.isClone = pos.isClone || false;
            piece.clonePlaced = pos.clonePlaced || false;
            
            // 处理冻结状态
            if (pos.isFrozen) {
                piece.isFrozen = true;
                piece.frozenUntil = Date.now() + 1500; // 假设冻结1.5秒
                this.frozenPieces[pos.id] = {
                    pieceId: pos.id,
                    until: piece.frozenUntil
                };
            } else if (piece.isFrozen) {
                piece.isFrozen = false;
                piece.frozenUntil = 0;
                delete this.frozenPieces[pos.id];
            }

            // 重建 clonePiece 引用
            if (piece.clonePlaced && !piece.clonePiece) {
                const cloneId = piece.id + '_clone';
                piece.clonePiece = this.pieces.find(p => p.id === cloneId);
            }

            // 如果本体被击败，分身也消失
            if (piece.clonePiece && !piece.isActive && piece.clonePiece.isActive) {
                piece.clonePiece.isActive = false;
            }

            // 如果是分身，确保 originalPiece 引用正确
            if (piece.isClone && piece.originalPiece) {
                const originalPiece = pieceMap.get(piece.originalPiece.id);
                if (originalPiece) {
                    originalPiece.clonePiece = piece;
                }
            }
        }

        // 同步墙壁（服务器权威地形）
        if (walls) {
            this.terrain = walls;
        }
    }

    /**
     * 处理服务器发送的动画开始（服务器权威物理）
     * @param {object} data - 动画开始数据
     */
    handleServerAnimationStart(data) {
        if (!this.mode || !this.mode.isNetworkMode) return;
        this.isAnimating = true;
    }

    /**
     * 处理服务器发送的动画结束（服务器权威物理）
     * @param {object} data - 动画结束数据
     */
    handleServerAnimationEnd(data) {
        if (!this.mode || !this.mode.isNetworkMode) return;
        this.isAnimating = false;
    }

    /**
     * 处理道具生成
     * @param {object} item - 道具数据
     */
    handleItemSpawned(item) {
        if (!this.items) {
            this.items = [];
        }

        // 检查是否已存在相同ID的道具
        const existingIndex = this.items.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) {
            this.items[existingIndex] = new Item(item);
        } else {
            this.items.push(new Item(item));
        }
    }

    /**
     * 处理道具拾取
     * @param {object} data - 拾取数据 {itemId, itemType, playerId, pieceId}
     */
    handleItemPickup(data) {
        // 移除被拾取的道具
        if (this.items) {
            this.items = this.items.filter(i => i.id !== data.itemId);
        }

        // 获取拾取者的棋子位置，用于播放泡泡特效
        const piece = this.pieces.find(p => p.id === data.pieceId);
        if (piece && this.particleSystem) {
            this.particleSystem.createBubbleParticles(piece.x, piece.y, data.itemType);
        }

        // 播放道具拾取音效
        if (this.sounds && this.sounds.getItem) {
            this.sounds.getItem.currentTime = 0;
            this.sounds.getItem.play().catch(e => console.log('Get item audio error:', e));
        }

        // 更新活跃道具效果
        this.updateItemEffectState(data.itemType, data.playerId);

        // 显示提示
        const itemNames = {
            quickRecovery: '快速恢复',
            freeze: '冰冻',
            sharedProsperity: '富贵同享',
            destiny: '我命由天',
            invisibility: '隐身',
            oneBody: '浑然一体'
        };
        const itemName = itemNames[data.itemType] || data.itemType;
    }

    /**
     * 处理道具消失（15秒未拾取）
     * @param {object} data - 消失数据 {itemId, itemType}
     */
    handleItemDespawned(data) {
        // 移除消失的道具
        if (this.items) {
            this.items = this.items.filter(i => i.id !== data.itemId);
        }
    }

    /**
     * 更新道具效果状态
     * @param {string} itemType - 道具类型
     * @param {number} playerId - 玩家ID
     */
    updateItemEffectState(itemType, playerId) {
        const config = window.GAME_CONFIG ? window.GAME_CONFIG.items : null;
        if (!config) return;

        switch (itemType) {
            case 'quickRecovery':
                this.activeItemEffects.quickRecovery = {
                    active: true,
                    playerId: playerId,
                    endTime: Date.now() + config.quickRecovery.duration,
                    remaining: config.quickRecovery.duration
                };
                break;
            case 'freeze':
                this.activeItemEffects.freeze = {
                    active: true,
                    playerId: playerId,
                    endTime: Date.now() + config.freeze.duration,
                    remaining: config.freeze.duration
                };
                break;
            case 'sharedProsperity':
                this.activeItemEffects.sharedProsperity = {
                    active: true,
                    playerId: playerId,
                    endTime: Date.now() + config.sharedProsperity.duration,
                    remaining: config.sharedProsperity.duration
                };
                break;
            case 'invisibility':
                this.activeItemEffects.invisibility = {
                    active: true,
                    playerId: playerId,
                    endTime: Date.now() + config.invisibility.duration,
                    remaining: config.invisibility.duration
                };
                break;
            case 'oneBody':
                this.activeItemEffects.oneBody = {
                    active: true,
                    playerId: playerId,
                    endTime: Date.now() + config.oneBody.duration,
                    remaining: config.oneBody.duration
                };
                break;
        }
    }

    /**
     * 处理棋子被冻结
     * @param {object} data - 冻结数据 {pieceId, playerId, duration}
     */
    handlePieceFrozen(data) {
        const piece = this.pieces.find(p => p.id === data.pieceId);
        if (piece) {
            piece.isFrozen = true;
            piece.frozenUntil = Date.now() + data.duration;
            this.frozenPieces[data.pieceId] = {
                pieceId: data.pieceId,
                until: piece.frozenUntil
            };
        }
    }

    /**
     * 处理棋子被删除（我命由天效果）
     * @param {object} data - 删除数据 {pieceId, playerId, x, y, deletedBy, effectDuration}
     */
    handlePieceDeleted(data) {
        console.log('[GameEngine] handlePieceDeleted 被调用:', data);
        const piece = this.pieces.find(p => p.id === data.pieceId);
        const effectDuration = data.effectDuration || 1500;

        if (piece) {
            piece.isDeleted = true;
            piece.deleteTime = Date.now();
            piece.deleteEffectDuration = effectDuration;
            console.log('[GameEngine] 棋子标记为删除状态, pieceId:', data.pieceId);
        } else {
            console.log('[GameEngine] 未找到对应棋子, pieceId:', data.pieceId, '当前pieces:', this.pieces.map(p => p.id));
        }

        // 添加删除特效（无论棋子是否找到都要添加，确保特效能显示）
        this.deleteEffects.push({
            pieceId: data.pieceId,
            x: data.x,
            y: data.y,
            color: piece ? piece.color : '#ff0000',
            radius: piece ? piece.radius : 15,
            startTime: Date.now(),
            duration: effectDuration
        });
        console.log('[GameEngine] deleteEffects数组长度:', this.deleteEffects.length);
    }

    // 生成墙壁
    generateWall() {
        const wallConfig = window.GAME_CONFIG ? window.GAME_CONFIG.wallGeneration : null;
        if (!wallConfig) return;

        const maxWalls = wallConfig.maxWalls || 8;

        // 如果已达到最大数量，先随机删除一面旧墙
        if (this.terrain.length >= maxWalls) {
            const randomIndex = Math.floor(Math.random() * this.terrain.length);
            const removedWall = this.terrain.splice(randomIndex, 1)[0];
            console.log('[客户端生成墙壁] 已达上限，随机删除墙壁，剩余墙壁数:', this.terrain.length);
        }

        let attempts = 0;
        const maxAttempts = wallConfig.maxAttempts || 50;

        while (attempts < maxAttempts) {
            attempts++;

            // 随机生成墙壁长度（使用配置值）
            const minLen = wallConfig.minLength || 80;
            const maxLen = wallConfig.maxLength || 120;
            const length = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;

            // 随机生成墙壁方向（任意角度，0 - 2π）
            const angle = Math.random() * Math.PI * 2;

            // 随机生成墙壁中点位置
            const midX = Math.floor(Math.random() * this.canvas.width);
            const midY = Math.floor(Math.random() * this.canvas.height);

            // 根据中点、长度和角度计算起点和终点
            const halfLength = length / 2;
            const x = midX - Math.cos(angle) * halfLength;
            const y = midY - Math.sin(angle) * halfLength;
            const endX = midX + Math.cos(angle) * halfLength;
            const endY = midY + Math.sin(angle) * halfLength;

            // 检查墙壁是否完全在棋盘内
            const edgeMargin = wallConfig.wallEdgeMargin || 50;
            if (x < edgeMargin || x > this.canvas.width - edgeMargin ||
                y < edgeMargin || y > this.canvas.height - edgeMargin ||
                endX < edgeMargin || endX > this.canvas.width - edgeMargin ||
                endY < edgeMargin || endY > this.canvas.height - edgeMargin) {
                continue;
            }

            // 检查是否与棋子重叠
            let isOverlapping = false;
            for (let piece of this.pieces) {
                if (piece.isActive) {
                    if (this.isPointNearLine(piece.x, piece.y, x, y, endX, endY, piece.radius)) {
                        isOverlapping = true;
                        break;
                    }
                }
            }

            if (isOverlapping) continue;

            // 检查是否与已有墙壁中点距离过近（使用配置值）
            const minDistWall = wallConfig.wallMinDistWall || 180;
            let tooCloseToWall = false;
            for (let wall of this.terrain) {
                const wallMidX = (wall.x + wall.endX) / 2;
                const wallMidY = (wall.y + wall.endY) / 2;

                const dx = midX - wallMidX;
                const dy = midY - wallMidY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistWall) {
                    tooCloseToWall = true;
                    break;
                }
            }

            if (tooCloseToWall) continue;

            // 如果通过所有检查，添加墙壁
            this.terrain.push({ x, y, endX, endY, thickness: wallConfig.thickness || 5 });
            return;
        }
    }
    
    // 检查点是否在线段附近
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

    updateUI() {
        // 检查是否是4人乱斗模式
        const isChaos4Mode = this.mode && this.mode.isChaos4Mode;

        if (isChaos4Mode) {
            // 4人乱斗模式更新
            const networkManager = window.networkManager;
            const localPlayerId = networkManager ? networkManager.playerId : null;
            for (let i = 1; i <= 4; i++) {
                const count = this.pieces.filter(p => p.player === i && p.isActive).length;
                const countEl = document.getElementById(`chaos4Player${i}Count`);
                const nameEl = document.getElementById(`chaos4Player${i}Name`);
                if (countEl) countEl.textContent = count;
                // 更新玩家名字和皮肤信息
                if (nameEl && networkManager) {
                    const playerName = networkManager.playerUsernames[i] || `玩家${i}`;
                    // 获取皮肤名称或颜色
                    let skinInfo = '';
                    if (this.mode && this.mode.networkData && this.mode.networkData.playerSettings) {
                        const skinId = this.mode.networkData.playerSettings[i]?.playerSkinId || 'default';
                        const playerColor = this.mode.networkData.playerSettings[i]?.playerColor || GAME_CONFIG.playerColors[`player${i}`] || '#fff';
                        const skinConfig = GAME_CONFIG.skins.piece[skinId];
                        if (skinConfig && skinId !== 'default') {
                            skinInfo = `(${skinConfig.name})`;
                        } else {
                            // 将十六进制颜色转换为中文颜色名
                            const colorNames = {
                                '#ff4757': '红色',
                                '#d3d6d2': '灰色',
                                '#3742fa': '深蓝',
                                '#ffa502': '橙色',
                                '#8e44ad': '紫色',
                                '#1e90ff': '蓝色',
                                '#2ed573': '绿色',
                                '#ff6b81': '粉色',
                                '#1289a7': '青色',
                                '#f9ca24': '黄色',
                                '#ff6b6b': '红色',
                                '#4ecdc4': '青色',
                                '#9b59b6': '紫色',
                                '#667eea': '蓝色',
                                '#f093fb': '粉色'
                            };
                            skinInfo = `(${colorNames[playerColor] || playerColor})`;
                        }
                    }
                    nameEl.textContent = playerName + skinInfo;
                }
            }
        } else {
            // 2人模式更新
            // 在网络模式下，根据本地玩家ID更新标签显示
            const networkManager = window.networkManager;
            const localPlayerId = this.mode && this.mode.isNetworkMode && networkManager ? networkManager.playerId : null;

            if (localPlayerId) {
                const player1Info = document.getElementById('player1Info');
                const player2Info = document.getElementById('player2Info');
                if (player1Info && player2Info) {
                    const spans1 = player1Info.getElementsByTagName('span');
                    const spans2 = player2Info.getElementsByTagName('span');
                    // 获取玩家名
                    const player1Name = networkManager.playerUsernames[1] || '玩家A';
                    const player2Name = networkManager.playerUsernames[2] || '玩家B';
                    // 技能模式显示(A)和(B)
                    const isSkillMode = this.mode && this.mode.isSkillMode;
                    if (spans1[0]) spans1[0].textContent = player1Name + (isSkillMode ? '(A)' : '');
                    if (spans2[0]) spans2[0].textContent = player2Name + (isSkillMode ? '(B)' : '');
                }
            }

            // 乱斗模式不显示当前回合高亮，因为没有回合制
            const isChaosMode = this.mode && this.mode.isChaosMode;
            if (!isChaosMode) {
                document.getElementById('player1Info').classList.toggle('active', this.currentPlayer === 1);
                document.getElementById('player2Info').classList.toggle('active', this.currentPlayer === 2);
            } else {
                document.getElementById('player1Info').classList.remove('active');
                document.getElementById('player2Info').classList.remove('active');
            }

            const player1Count = this.pieces.filter(p => p.player === 1 && p.isActive).length;
            const player2Count = this.pieces.filter(p => p.player === 2 && p.isActive).length;

            document.getElementById('player1Count').textContent = player1Count;
            document.getElementById('player2Count').textContent = player2Count;
        }

        // 显示/隐藏聊天按钮（仅在网络模式显示）
        const chatBtn = document.getElementById('chatBtn');
        if (chatBtn) {
            const isNetworkMode = this.mode && this.mode.isNetworkMode;
            chatBtn.style.display = isNetworkMode ? 'block' : 'none';
        }

        // 乱斗模式隐藏回合数显示
        const roundInfoElement = document.querySelector('.round-info');
        if (roundInfoElement) {
            const isChaosMode = this.mode && this.mode.isChaosMode;
            roundInfoElement.style.display = isChaosMode ? 'none' : 'block';
        }

        // 更新回合数显示
        const roundCountElement = document.getElementById('roundCount');
        if (roundCountElement && !(this.mode && this.mode.isChaosMode)) {
            roundCountElement.textContent = this.turnCount + 1; // 回合数从1开始显示
        }
    }

    // 更新游戏提示
    updateGameHint(state) {
        const hintElement = document.getElementById('gameHint');
        if (!hintElement) return;
        
        switch (state) {
            case 'none':
                hintElement.textContent = '请单击棋子进行选中！';
                hintElement.classList.remove('dragging');
                hintElement.style.visibility = 'visible';
                break;
            case 'selected':
                hintElement.textContent = '拖拽棋子进行弹射准备！';
                hintElement.classList.remove('dragging');
                hintElement.style.visibility = 'visible';
                break;
            case 'dragging':
                hintElement.textContent = '按空格取消拖拽';
                hintElement.classList.add('dragging');
                hintElement.style.visibility = 'visible';
                break;
            case 'hidden':
                hintElement.style.visibility = 'hidden';
                break;
        }
    }

    update(deltaTime) {
        if (this.gameOver) return;

        // 更新临时消息显示时间
        if (this.temporaryMessage) {
            this.temporaryMessageTime += deltaTime * 60; // 标准化到60fps
            // 60帧/秒，所以将毫秒转换为帧
            const durationInFrames = this.temporaryMessageDuration / 16.67;
            if (this.temporaryMessageTime > durationInFrames) {
                this.temporaryMessage = null;
                this.temporaryMessageTime = 0;
                this.temporaryMessageColor = null;
            }
        }

        // 更新粒子系统（联网和本地模式都需要更新）
        if (this.particleSystem) {
            this.particleSystem.update(deltaTime);
        }

        // 联网模式下，物理由服务器权威处理，跳过本地物理更新
        if (this.mode && this.mode.isNetworkMode) {
            // 联网模式下仍然需要生成轨迹粒子
            // 获取每个玩家装备的拖尾效果配置
            const playerSettings = this.mode.networkData?.playerSettings || {};
            const getPlayerTrailConfig = (playerId) => {
                const trailEffectId = playerSettings[playerId]?.trailEffect || 'trail_white';
                return GAME_CONFIG.trailEffects[trailEffectId] || GAME_CONFIG.trailEffects.trail_white;
            };

            // 距离阈值：移动超过此像素才生成新拖尾粒子
            const minTrailDistance = 5;

            for (let piece of this.pieces) {
                if (piece.isActive && !piece.isDragging && this.particleSystem) {
                    // 检查距离阈值
                    if (piece.lastTrailPos) {
                        const dx = piece.x - piece.lastTrailPos.x;
                        const dy = piece.y - piece.lastTrailPos.y;
                        if (Math.sqrt(dx * dx + dy * dy) < minTrailDistance) continue;
                    }
                    piece.lastTrailPos = { x: piece.x, y: piece.y };

                    // 如果浑然一体效果生效，使用紫色拖尾
                    let trailConfig;
                    const trailColor = this.activeItemEffects?.oneBody?.active
                        ? '#9b59b6'
                        : piece.color;
                    if (this.activeItemEffects?.oneBody?.active) {
                        // 强制使用白色拖尾配置，但颜色用紫色
                        trailConfig = { id: 'trail_white', color: trailColor };
                    } else {
                        trailConfig = getPlayerTrailConfig(piece.player);
                    }
                    this.particleSystem.createTrailParticles(
                        piece.x, piece.y, piece.vx, piece.vy, trailColor, piece.radius, trailConfig
                    );
                }
            }
            this.updateUI();
            return;
        }

        // 距离阈值：移动超过此像素才生成新拖尾粒子
        const minTrailDistance = 5;

        for (let piece of this.pieces) {
            piece.update(deltaTime);
            // 本地模式下生成轨迹粒子（ParticleSystem 内部判断速度阈值）
            if (piece.isActive && !piece.isDragging && this.particleSystem) {
                // 检查距离阈值
                if (piece.lastTrailPos) {
                    const dx = piece.x - piece.lastTrailPos.x;
                    const dy = piece.y - piece.lastTrailPos.y;
                    if (Math.sqrt(dx * dx + dy * dy) < minTrailDistance) continue;
                }
                piece.lastTrailPos = { x: piece.x, y: piece.y };

                // 如果浑然一体效果生效，使用紫色拖尾
                const trailColor = this.activeItemEffects?.oneBody?.active
                    ? '#9b59b6'
                    : piece.color;
                const trailConfig = this.activeItemEffects?.oneBody?.active
                    ? { id: 'trail_white', color: trailColor }
                    : '#ffffff';
                this.particleSystem.createTrailParticles(
                    piece.x, piece.y, piece.vx, piece.vy, trailColor, piece.radius, trailConfig
                );
            }
        }

        this.checkCollisions();
        this.checkOutOfBounds();

        if (this.isAnimating && this.checkAllStopped()) {
            this.isAnimating = false;

            // 检查是否有二连击棋子需要继续（第一次弹射后不切换回合）
            const doubleStrikePiece = this.pieces.find(p => p.isDoubleStrikeFirstShot && p.isActive);
            if (doubleStrikePiece) {
                // 重置二连击状态，让玩家可以进行第二次弹射
                doubleStrikePiece.isDoubleStrikeFirstShot = false;
                doubleStrikePiece.isSelected = true;
                this.selectedPiece = doubleStrikePiece;
                // 重置 lastTime 避免 deltaTime 过大
                this.lastTime = 0;
                return;
            }

            if (!this.checkWinner()) {
                this.switchTurn();
            }
        }

        this.updateUI();
    }

    sendStateSync() {
        if (!this.mode || !this.mode.isNetworkMode || !window.networkManager) return;
        
        const state = {
            pieces: this.pieces.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                vx: p.vx,
                vy: p.vy,
                isActive: p.isActive,
                player: p.player,
                color: p.color
            })),
            currentPlayer: this.currentPlayer,
            turnCount: this.turnCount,
            gameOver: this.gameOver
        };
        
        window.networkManager.socketClient.send('state_sync', {
            roomId: window.networkManager.currentRoom,
            state: state
        });
    }

    applyStateSync(state) {
        if (!state || !state.pieces) return;
        
        // 只同步棋子的位置和活跃状态，避免影响正在进行的动画
        if (!this.isAnimating) {
            for (let statePiece of state.pieces) {
                const localPiece = this.pieces.find(p => p.id === statePiece.id);
                if (localPiece) {
                    localPiece.x = statePiece.x;
                    localPiece.y = statePiece.y;
                    localPiece.vx = statePiece.vx;
                    localPiece.vy = statePiece.vy;
                    localPiece.isActive = statePiece.isActive;
                }
            }
            this.currentPlayer = state.currentPlayer;
            // 注意：turnCount 不在这里同步，避免 state_sync 覆盖 TURN_CHANGE 的更新
            // turnCount 应该只通过 TURN_CHANGE 消息更新
            this.gameOver = state.gameOver;
            this.updateUI();
        }
    }

    draw() {
        this.ctx.fillStyle = '#1f1f1fff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制技能效果的棋盘边缘光影
        if (this.mode && this.mode.isSkillMode && this.mode.globalSkillActive) {
            if (SkillLogic.isWeaknessSkill(this.mode.globalSkillType)) {
                // 虚弱技能：黄色光影
                this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
                this.ctx.lineWidth = 8;
                this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

                // 内部发光效果
                this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)';
                this.ctx.lineWidth = 4;
                this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);
            } else if (SkillLogic.isShrinkSkill(this.mode.globalSkillType)) {
                // 缩小技能：蓝色光影
                this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
                this.ctx.lineWidth = 8;
                this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
                
                // 内部发光效果
                this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.4)';
                this.ctx.lineWidth = 4;
                this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);
            }
        } else {
            // 正常状态：白色边框
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 绘制富贵同享道具效果边框（黄色）
        this.drawSharedProsperityBorder();

        // 绘制隐身效果灰色边框
        this.drawInvisibilityBorder();

        // 绘制浑然一体效果紫色边框
        this.drawOneBodyBorder();

        // 绘制地形
        this.drawTerrain();

        // 绘制道具
        this.drawItems();

        // 绘制力度条
        this.drawPowerBar();

        // 绘制能量条（乱斗模式）
        this.drawEnergyBar();

        // 获取当前玩家ID（网络模式下）
        const currentPlayerId = this.mode && this.mode.isNetworkMode && window.networkManager ? window.networkManager.playerId : this.currentPlayer;

        // 检查隐身效果
        const isInvisibilityActive = this.activeItemEffects &&
                                      this.activeItemEffects.invisibility &&
                                      this.activeItemEffects.invisibility.active;

        for (let piece of this.pieces) {
            // 隐身效果：只显示自己的棋子
            if (isInvisibilityActive && piece.player !== currentPlayerId) {
                continue; // 跳过绘制其他玩家的棋子
            }
            const isCurrentPlayerPiece = piece.player === currentPlayerId;

            // 如果浑然一体效果生效，临时使用紫色（覆盖皮肤）
            const isOneBodyActive = this.activeItemEffects?.oneBody?.active;
            const originalColor = isOneBodyActive ? piece.color : null;
            const originalSkinId = isOneBodyActive ? piece.skinId : null;
            const originalSkinLoaded = isOneBodyActive ? piece.skinImageLoaded : null;
            if (isOneBodyActive) {
                piece.color = '#9b59b6';
                piece.skinId = 'default';
                piece.skinImageLoaded = false;
            }

            piece.draw(this.ctx, this.blinkMinDistance, isCurrentPlayerPiece);

            // 恢复原状态
            if (isOneBodyActive) {
                piece.color = originalColor;
                piece.skinId = originalSkinId;
                piece.skinImageLoaded = originalSkinLoaded;
            }
        }

        // 绘制冰冻效果光圈
        this.drawFreezeEffects();

        // 绘制删除特效（我命由天）
        this.drawDeleteEffects();

        // 绘制粒子系统
        if (this.particleSystem) {
            this.particleSystem.draw(this.ctx);
        }
        
        // 显示临时消息
        if (this.temporaryMessage) {
            // 绘制文字阴影效果
            this.ctx.font = '28px Microsoft YaHei';
            this.ctx.font = 'bold 28px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // 根据消息内容设置不同颜色
            let textColor;
            if (this.temporaryMessageColor) {
                // 使用自定义颜色
                textColor = this.temporaryMessageColor;
                // 发光效果
                this.ctx.shadowColor = this.temporaryMessageColor + '80'; // 添加透明度
            } else if (this.temporaryMessage.includes('保护机制')) {
                textColor = 'rgba(100, 255, 100, 1)';
                // 绿色发光效果
                this.ctx.shadowColor = 'rgba(100, 255, 100, 0.8)';
            } else if (this.temporaryMessage.includes('等待')) {
                textColor = 'rgba(255, 255, 100, 1)';
                // 黄色发光效果
                this.ctx.shadowColor = 'rgba(255, 255, 100, 0.8)';
            } else {
                textColor = 'rgba(255, 100, 100, 1)';
                // 红色发光效果
                this.ctx.shadowColor = 'rgba(255, 100, 100, 0.8)';
            }
            
            this.ctx.shadowBlur = 20;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
            
            this.ctx.fillStyle = textColor;
            this.ctx.fillText(this.temporaryMessage, this.canvas.width / 2, this.canvas.height / 2);
            
            // 清除阴影效果，避免影响其他绘制
            this.ctx.shadowBlur = 0;
        }
    }
    
    // 绘制地形
    drawTerrain() {
        for (let wall of this.terrain) {
            this.ctx.beginPath();
            this.ctx.moveTo(wall.x, wall.y);
            this.ctx.lineTo(wall.endX, wall.endY);
            this.ctx.lineWidth = wall.thickness;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.stroke();
        }
    }

    /**
     * 绘制所有道具
     */
    drawItems() {
        if (!this.items || this.items.length === 0) return;

        for (const item of this.items) {
            if (item.isActive) {
                item.draw(this.ctx);
            }
        }
    }

    /**
     * 绘制富贵同享效果边框（黄色）
     */
    drawSharedProsperityBorder() {
        if (!this.activeItemEffects || !this.activeItemEffects.sharedProsperity || !this.activeItemEffects.sharedProsperity.active) {
            return;
        }

        const remaining = this.activeItemEffects.sharedProsperity.endTime - Date.now();
        if (remaining <= 0) return;

        // 呼吸效果
        const totalDuration = GAME_CONFIG.items.sharedProsperity.duration;
        const progress = 1 - (remaining / totalDuration);
        // 增加呼吸频率，提高发光强度
        const intensity = 0.6 + 0.4 * Math.cos(progress * Math.PI * 12);

        // 黄色边框
        this.ctx.strokeStyle = `rgba(255, 255, 100, ${intensity})`;
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // 外部发光效果
        this.ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = `rgba(255, 255, 150, ${intensity * 0.8})`;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // 内部发光效果
        this.ctx.strokeStyle = `rgba(255, 255, 100, ${intensity * 0.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);

        // 清除阴影
        this.ctx.shadowBlur = 0;
    }

    /**
     * 绘制隐身效果灰色边框
     */
    drawInvisibilityBorder() {
        if (!this.activeItemEffects || !this.activeItemEffects.invisibility || !this.activeItemEffects.invisibility.active) {
            return;
        }

        const remaining = this.activeItemEffects.invisibility.endTime - Date.now();
        if (remaining <= 0) return;

        // 呼吸效果
        const totalDuration = GAME_CONFIG.items.invisibility.duration;
        const progress = 1 - (remaining / totalDuration);
        const intensity = 0.6 + 0.4 * Math.cos(progress * Math.PI * 12);

        // 灰色边框
        this.ctx.strokeStyle = `rgba(180, 180, 180, ${intensity})`;
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // 外部发光效果
        this.ctx.shadowColor = 'rgba(150, 150, 150, 0.8)';
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = `rgba(200, 200, 200, ${intensity * 0.8})`;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // 内部发光效果
        this.ctx.strokeStyle = `rgba(180, 180, 180, ${intensity * 0.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);

        // 清除阴影
        this.ctx.shadowBlur = 0;
    }

    /**
     * 绘制浑然一体效果紫色边框
     */
    drawOneBodyBorder() {
        if (!this.activeItemEffects?.oneBody?.active) {
            return;
        }

        const remaining = this.activeItemEffects.oneBody.endTime - Date.now();
        if (remaining <= 0) return;

        const totalDuration = GAME_CONFIG.items.oneBody.duration;
        const progress = 1 - (remaining / totalDuration);
        const intensity = 0.6 + 0.4 * Math.cos(progress * Math.PI * 12);

        // 紫色边框
        this.ctx.strokeStyle = `rgba(155, 89, 182, ${intensity})`;
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // 外部发光效果
        this.ctx.shadowColor = 'rgba(155, 89, 182, 0.8)';
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = `rgba(185, 115, 218, ${intensity * 0.8})`;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // 内部发光效果
        this.ctx.strokeStyle = `rgba(155, 89, 182, ${intensity * 0.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);

        // 清除阴影
        this.ctx.shadowBlur = 0;
    }

    /**
     * 绘制冰冻效果光圈
     */
    drawFreezeEffects() {
        if (!this.frozenPieces) return;

        const now = Date.now();
        const toRemove = [];

        for (const pieceId in this.frozenPieces) {
            const freezeInfo = this.frozenPieces[pieceId];
            const piece = this.pieces.find(p => p.id === pieceId);

            if (!piece || !piece.isActive) {
                toRemove.push(pieceId);
                continue;
            }

            if (freezeInfo.until <= now) {
                piece.isFrozen = false;
                piece.frozenUntil = 0;
                toRemove.push(pieceId);
                continue;
            }

            // 绘制冰冻光圈
            drawFreezeGlow(this.ctx, piece);
        }

        // 清理已结束的冻结状态
        for (const pieceId of toRemove) {
            delete this.frozenPieces[pieceId];
        }
    }



    /**
     * 绘制删除特效（我命由天）
     */
    drawDeleteEffects() {
        if (!this.deleteEffects || this.deleteEffects.length === 0) return;

        const now = Date.now();
        const toRemove = [];

        for (const effect of this.deleteEffects) {
            const elapsed = now - effect.startTime;
            if (elapsed >= effect.duration) {
                toRemove.push(effect);
                continue;
            }

            // 绘制红色闪烁消失效果
            this.drawSingleDeleteEffect(effect, elapsed);
        }

        // 清理已结束的特效
        for (const effect of toRemove) {
            const index = this.deleteEffects.indexOf(effect);
            if (index >= 0) {
                this.deleteEffects.splice(index, 1);
            }
        }
    }

    /**
     * 绘制单个删除特效
     */
    drawSingleDeleteEffect(effect, elapsed) {
        const progress = elapsed / effect.duration;
        const intensity = 1 - progress;

        this.ctx.save();

        // 红色闪烁
        const scale = 1 + intensity * 0.5;
        const flashRadius = effect.radius * scale;

        const gradient = this.ctx.createRadialGradient(
            effect.x, effect.y, effect.radius,
            effect.x, effect.y, flashRadius
        );
        gradient.addColorStop(0, `rgba(255, 50, 50, ${intensity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 100, ${intensity * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, flashRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // 闪烁边框
        const flashIntensity = Math.sin(progress * Math.PI * 6) * 0.5 + 0.5;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, effect.radius + 5, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255, 0, 0, ${flashIntensity * intensity})`;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * 更新道具效果状态（每帧调用）
     */
    updateItemEffects() {
        if (!this.activeItemEffects) return;

        const now = Date.now();

        // 更新快速恢复效果
        if (this.activeItemEffects.quickRecovery && this.activeItemEffects.quickRecovery.active) {
            const remaining = this.activeItemEffects.quickRecovery.endTime - now;
            this.activeItemEffects.quickRecovery.remaining = Math.max(0, remaining);
            if (remaining <= 0) {
                this.activeItemEffects.quickRecovery.active = false;
            }
        }

        // 更新冰冻效果
        if (this.activeItemEffects.freeze && this.activeItemEffects.freeze.active) {
            const remaining = this.activeItemEffects.freeze.endTime - now;
            this.activeItemEffects.freeze.remaining = Math.max(0, remaining);
            if (remaining <= 0) {
                this.activeItemEffects.freeze.active = false;
            }
        }

        // 更新富贵同享效果
        if (this.activeItemEffects.sharedProsperity && this.activeItemEffects.sharedProsperity.active) {
            const remaining = this.activeItemEffects.sharedProsperity.endTime - now;
            this.activeItemEffects.sharedProsperity.remaining = Math.max(0, remaining);
            if (remaining <= 0) {
                this.activeItemEffects.sharedProsperity.active = false;
            }
        }

        // 更新隐身效果
        if (this.activeItemEffects.invisibility && this.activeItemEffects.invisibility.active) {
            const remaining = this.activeItemEffects.invisibility.endTime - now;
            this.activeItemEffects.invisibility.remaining = Math.max(0, remaining);
            if (remaining <= 0) {
                this.activeItemEffects.invisibility.active = false;
            }
        }

        // 更新浑然一体效果
        if (this.activeItemEffects.oneBody && this.activeItemEffects.oneBody.active) {
            const remaining = this.activeItemEffects.oneBody.endTime - now;
            this.activeItemEffects.oneBody.remaining = Math.max(0, remaining);
            if (remaining <= 0) {
                this.activeItemEffects.oneBody.active = false;
            }
        }
    }

    drawPowerBar() {
        // 显示全局技能按钮
        this.updateGlobalSkillButton();
        
        if (!this.draggedPiece || !this.draggedPiece.isDragging) {
            // 隐藏力度条
            document.getElementById('player1PowerBar').style.display = 'none';
            document.getElementById('player2PowerBar').style.display = 'none';
            return;
        }
        
        // 计算力度值
        const dx = this.draggedPiece.dragStartX - this.draggedPiece.dragCurrentX;
        const dy = this.draggedPiece.dragStartY - this.draggedPiece.dragCurrentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isChaos4Mode = this.mode && this.mode.isChaos4Mode;
        const maxDistance = isChaos4Mode ? GAME_CONFIG.chaos4.maxDragDistance : GAME_CONFIG.maxDragDistance;
        const powerCurveExponent = isChaos4Mode ? GAME_CONFIG.chaos4.powerCurveExponent : GAME_CONFIG.powerCurveExponent;
        // 使用更平缓的曲线让力度划分更多挡位，低力度区更精细
        const normalizedPower = Math.min(Math.pow(distance / maxDistance, powerCurveExponent), 1);
        const percentage = Math.round(normalizedPower * 100);
        
        // 根据力度值设置颜色（从绿色到红色的平滑渐变）
        let fillColor;
        
        // 使用HSL颜色模型实现平滑渐变
        // 从绿色(120度)到黄色(60度)到红色(0度)
        const hue = 120 - (normalizedPower * 120); // 120到0度
        const saturation = 100;
        const lightness = 50;
        
        // 转换HSL到RGB
        const c = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
        const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = lightness / 100 - c / 2;
        
        let r, g, b;
        if (hue >= 0 && hue < 60) {
            r = c; g = x; b = 0;
        } else if (hue >= 60 && hue < 120) {
            r = x; g = c; b = 0;
        } else if (hue >= 120 && hue < 180) {
            r = 0; g = c; b = x;
        } else if (hue >= 180 && hue < 240) {
            r = 0; g = x; b = c;
        } else if (hue >= 240 && hue < 300) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        
        r = Math.floor((r + m) * 255);
        g = Math.floor((g + m) * 255);
        b = Math.floor((b + m) * 255);
        
        // 透明度随力度增加而增加
        const alpha = 0.6 + (normalizedPower * 0.4);
        fillColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        
        // 显示对应玩家的力度条
        const player1Bar = document.getElementById('player1PowerBar');
        const player2Bar = document.getElementById('player2PowerBar');
        
        // 计算颤抖效果（力度超过70%时开始颤抖）
        let shakeEffect = '';
        
        if (normalizedPower > 0.7) {
            // 颤抖程度随力度增加而增加
            const shakeIntensity = Math.min((normalizedPower - 0.7) * 3.33, 1);
            const shakeDuration = 0.25 - (shakeIntensity * 0.15); // 力度越大，颤抖越快，整体速度加快
            shakeEffect = `shake ${shakeDuration}s infinite`;
        }
        
        if (this.draggedPiece.player === 1) {
            // 左侧玩家
            player1Bar.style.display = 'block';
            player2Bar.style.display = 'none';
            
            // 应用颤抖效果
            player1Bar.style.animation = shakeEffect;
            player1Bar.style.boxShadow = '';
            
            // 更新力度条
            let fill = player1Bar.querySelector('.fill');
            let percentageText = player1Bar.querySelector('.percentage');
            
            if (!fill) {
                fill = document.createElement('div');
                fill.className = 'fill';
                player1Bar.appendChild(fill);
            }
            
            if (!percentageText) {
                percentageText = document.createElement('div');
                percentageText.className = 'percentage';
                player1Bar.appendChild(percentageText);
            }
            
            fill.style.height = `${normalizedPower * 100}%`;
            fill.style.backgroundColor = fillColor;
            percentageText.textContent = `${percentage}%`;
        } else {
            // 右侧玩家
            player1Bar.style.display = 'none';
            player2Bar.style.display = 'block';
            
            // 应用颤抖效果
            player2Bar.style.animation = shakeEffect;
            player2Bar.style.boxShadow = '';
            
            // 更新力度条
            let fill = player2Bar.querySelector('.fill');
            let percentageText = player2Bar.querySelector('.percentage');
            
            if (!fill) {
                fill = document.createElement('div');
                fill.className = 'fill';
                player2Bar.appendChild(fill);
            }
            
            if (!percentageText) {
                percentageText = document.createElement('div');
                percentageText.className = 'percentage';
                player2Bar.appendChild(percentageText);
            }
            
            fill.style.height = `${normalizedPower * 100}%`;
            fill.style.backgroundColor = fillColor;
            percentageText.textContent = `${percentage}%`;
        }
    }

    /**
     * 更新能量条显示（乱斗模式）
     * 连续填充样式，能量条从底部/左侧向上积累
     */
    drawEnergyBar() {
        // 只在乱斗模式显示能量条
        if (!this.mode || !this.mode.isChaosMode) {
            this.hideEnergyBar();
            return;
        }

        // 获取当前本地玩家ID
        const localPlayerId = window.networkManager ? networkManager.playerId : this.currentPlayer;
        if (!localPlayerId) {
            this.hideEnergyBar();
            return;
        }

        // 判断是2人乱斗还是4人乱斗
        const isChaos4 = this.mode.isChaos4Mode;

        // 获取能量值和进度
        const energy = this.playerEnergy[localPlayerId] || 0;
        const progress = this.playerEnergyProgress ? this.playerEnergyProgress[localPlayerId] || 0 : 0;
        const maxEnergy = GAME_CONFIG.chaos4.maxEnergy || 3;

        // 计算总填充百分比：(已满能量数 + 当前段进度) / 总能量数
        const fillPercent = ((energy + progress) / maxEnergy) * 100;

        // 获取对应的容器
        const containerId = isChaos4 ? 'chaos4EnergyBarContainer' : 'chaosEnergyBarContainer';
        const fillId = isChaos4 ? 'chaos4EnergyFill' : 'chaosEnergyFill';

        // 隐藏另一个容器
        const otherContainerId = isChaos4 ? 'chaosEnergyBarContainer' : 'chaos4EnergyBarContainer';
        document.getElementById(otherContainerId)?.classList.remove('active');

        // 显示当前容器
        const container = document.getElementById(containerId);
        if (container) {
            container.classList.add('active');

            // 检查快速恢复效果是否激活（只有当前玩家拾取才发光）
            const isQuickRecoveryActive = this.activeItemEffects &&
                this.activeItemEffects.quickRecovery &&
                this.activeItemEffects.quickRecovery.active &&
                this.activeItemEffects.quickRecovery.playerId === localPlayerId;

            if (isQuickRecoveryActive) {
                container.classList.add('quick-recovery-glow');
            } else {
                container.classList.remove('quick-recovery-glow');
            }
        }

        // 更新填充
        const fill = document.getElementById(fillId);
        if (fill) {
            if (isChaos4) {
                // 4人乱斗：垂直方向，从下向上填充
                fill.style.height = `${fillPercent}%`;
                fill.style.width = '100%';
                fill.style.bottom = '0';
                fill.style.left = '0';
            } else {
                // 2人乱斗：水平方向，从左向右填充
                fill.style.width = `${fillPercent}%`;
                fill.style.height = '100%';
                fill.style.top = '0';
                fill.style.left = '0';
            }
        }
    }

    /**
     * 隐藏能量条
     */
    hideEnergyBar() {
        document.getElementById('chaosEnergyBarContainer')?.classList.remove('active');
        document.getElementById('chaos4EnergyBarContainer')?.classList.remove('active');
    }

    loop(timestamp) {
        if (!this.gameStarted) return;
        
        // 初始化或重置时间变量
        if (!this.lastTime || this.lastTime === 0) this.lastTime = timestamp;
        
        // 确保 timestamp 是有效的数字
        if (typeof timestamp !== 'number' || isNaN(timestamp)) {
            requestAnimationFrame((t) => this.loop(t));
            return;
        }
        
        let deltaTime = (timestamp - this.lastTime) / 1000; // 转换为秒
        // 防止切到后台回来时 deltaTime 过大
        if (deltaTime > 0.25) deltaTime = 0.25; 
        
        this.lastTime = timestamp;
        
        this.accumulator += deltaTime;
        
        while (this.accumulator >= this.timeStep) {
            this.update(this.timeStep);
            this.accumulator -= this.timeStep;
        }
        
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    restart() {
        this.turnCount = 0;
        this.init();
        
        // 重置时间相关变量
        this.lastTime = 0;
        this.accumulator = 0;
        
        // 重置临时消息
        this.temporaryMessage = null;
        this.temporaryMessageTime = 0;
        
        // 重置游戏提示
        this.updateGameHint('none');

        // 清除聊天气泡
        this.clearAllChatBubbles();

        // 确保游戏循环正在运行
        if (!this.gameStarted) {
            this.gameStarted = true;
            requestAnimationFrame((t) => this.loop(t));
        }
    }
    
    showTemporaryMessage(message, duration = 1000, color = '#ffffff') {
        this.temporaryMessage = message;
        this.temporaryMessageTime = 0;
        this.temporaryMessageDuration = duration;
        this.temporaryMessageColor = color;
    }

    // ==================== 聊天气泡 ====================

    /**
     * 显示聊天气泡
     * @param {number} playerId - 玩家ID (1 or 2)
     * @param {string} content - 消息内容或emoji
     * @param {boolean} isEmoji - 是否是emoji
     * @param {boolean} isSelf - 是否是自己发送的
     */
    showChatBubble(playerId, content, isEmoji = false, isSelf = false) {
        const playerInfoId = playerId === 1 ? 'player1Info' : 'player2Info';
        const playerInfo = document.getElementById(playerInfoId);
        if (!playerInfo) return;

        // 创建气泡元素
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        if (isEmoji) {
            bubble.classList.add('emoji-bubble');
        }
        bubble.classList.add(isSelf ? 'self' : 'opponent');
        bubble.textContent = content;

        // 根据玩家ID设置水平位置（1在左侧，2在右侧）
        if (playerId === 1) {
            bubble.style.left = '0';
            bubble.style.right = 'auto';
        } else {
            bubble.style.left = 'auto';
            bubble.style.right = '0';
        }

        // 生成唯一ID
        const bubbleId = ++this.chatBubbleIdCounter;
        bubble.dataset.bubbleId = bubbleId;

        // 添加到DOM
        playerInfo.appendChild(bubble);

        // 保存引用
        this.chatBubbles.push({
            id: bubbleId,
            playerId: playerId,
            element: bubble
        });

        // 3秒后移除
        setTimeout(() => {
            this.removeChatBubble(bubbleId);
        }, 3000);
    }

    /**
     * 移除聊天气泡
     * @param {number} bubbleId - 气泡ID
     */
    removeChatBubble(bubbleId) {
        const index = this.chatBubbles.findIndex(b => b.id === bubbleId);
        if (index !== -1) {
            const bubble = this.chatBubbles[index];
            if (bubble.element && bubble.element.parentNode) {
                // 添加淡出动画
                bubble.element.style.animation = 'chatBubbleFadeOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (bubble.element.parentNode) {
                        bubble.element.parentNode.removeChild(bubble.element);
                    }
                }, 300);
            }
            this.chatBubbles.splice(index, 1);
        }
    }

    /**
     * 清除所有聊天气泡
     */
    clearAllChatBubbles() {
        for (const bubble of this.chatBubbles) {
            if (bubble.element && bubble.element.parentNode) {
                bubble.element.parentNode.removeChild(bubble.element);
            }
        }
        this.chatBubbles = [];
    }

    /**
     * 回合数超过20时，重置所有技能棋子的技能使用次数
     * 避免游戏进行到后期因技能耗尽而僵持不下
     */
    resetSkillsForLongGame() {
        // 处理所有在场棋子：停用活跃技能
        for (const piece of this.pieces) {
            if (piece.isActive && piece.skill) {
                // 如果技能正在生效，先停用技能效果
                if (piece.skillActive) {
                    piece.deactivateSkill();
                }
                piece.skillUsed = false;
                piece.skillUses = 0;
                piece.skillTurnsRemaining = 0;
            }
        }

        // 分身技能特殊处理：删除所有活跃的分身棋子
        const clonePieces = this.pieces.filter(p => p.isClone && p.isActive);
        for (const clone of clonePieces) {
            clone.isActive = false;
            const originalPiece = clone.originalPiece;
            if (originalPiece) {
                originalPiece.clonePlaced = false;
                originalPiece.clonePiece = null;
            }
        }

        // 重置全局技能状态，允许再次使用
        if (this.mode && this.mode.globalSkillActive) {
            this.removeGlobalSkillEffect();
            this.mode.globalSkillActive = false;
            this.mode.globalSkillTurnsRemaining = 0;
            this.mode.globalSkillType = null;
        }
        // 重置双方玩家的全局技能使用次数
        if (this.mode) {
            this.mode.player1GlobalSkillUsed = false;
            this.mode.player2GlobalSkillUsed = false;
            this.updateGlobalSkillButton();
        }

        console.log('[技能重置] 回合数超过20，所有技能已重置');
        this.showTemporaryMessage('技能使用次数已重置！', 2000, '#00ff00');
    }

    /**
     * 更新所有棋子的皮肤
     */
    updatePieceSkins(skinId) {
        const skinConfig = GAME_CONFIG.skins.piece[skinId];
        if (!skinConfig) return;

        this.pieces.forEach(piece => {
            piece.skinId = skinId;
            if (skinConfig.renderType === 'image' && skinConfig.imagePath) {
                piece.loadSkinImage(skinConfig.imagePath);
            }
        });

        // 存储当前模式已装备的皮肤
        const modeName = this.mode?.modeName || 'classic';
        this.equippedSkins = this.equippedSkins || {};
        this.equippedSkins[modeName] = skinId;
    }

    /**
     * 获取当前模式已装备的皮肤
     */
    getEquippedSkin() {
        const modeName = this.mode?.modeName || 'classic';
        return this.equippedSkins?.[modeName] || 'default';
    }

    /**
     * 设置当前模式已装备的拖尾效果
     */
    setEquippedTrailEffect(trailId) {
        const modeName = this.mode?.modeName || 'classic';
        this.equippedTrailEffect = this.equippedTrailEffect || {};
        this.equippedTrailEffect[modeName] = trailId;
    }

    /**
     * 获取当前模式已装备的拖尾效果
     */
    getEquippedTrailEffect(modeName) {
        // 如果未指定模式名，使用当前模式
        if (!modeName) {
            modeName = this.mode?.modeName || 'classic';
        }
        // 优先从实例属性获取，否则从 localStorage 获取
        return this.equippedTrailEffect?.[modeName] || localStorage.getItem('equippedTrailEffect') || 'trail_white';
    }
}