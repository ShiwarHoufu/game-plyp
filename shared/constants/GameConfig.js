/**
 * 游戏配置常量
 * 客户端和服务端共用
 */

// 在浏览器环境中设置 window.GAME_CONFIG
if (typeof window !== 'undefined') {
    window.GAME_CONFIG = window.GameConfig ? window.GameConfig : null;
}

const GameConfig = typeof window !== 'undefined' && window.GameConfig ? window.GameConfig : {
    // 画布尺寸
    canvasWidth: 1250,
    canvasHeight: 660,

    // 乱斗4人模式画布尺寸
    chaos4CanvasWidth: 780,
    chaos4CanvasHeight: 780,
    chaos4CanvasId: 'chaos4Canvas',

    // 棋子配置
    pieceRadius: 16,
    pieceFriction: 0.971,
    pieceMinVelocity: 0.15,
    pieceMass: 1,
    // 拖拽和力度配置
    maxDragDistance: 140,
    maxPowerScale: 13,
    powerCurveExponent: 0.9,

    // 玩家颜色配置
    playerColors: {
        player1: '#ff6b6b',
        player2: '#4ecdc4',
        player3: '#f9ca24',
        player4: '#9b59b6'
    },

    // 双人乱斗模式专属配置
    chaos: {
        // 棋子配置
        pieceRadius: 16,              // 棋子半径
        pieceFriction: 0.971,         // 摩擦系数
        pieceMinVelocity: 0.20,        // 最小速度
        pieceMass: 1,
        // 拖拽和力度配置
        maxDragDistance: 140,         // 最大拖拽距离
        maxPowerScale: 12,            // 最大力度缩放
        powerCurveExponent: 0.9,      // 力度曲线指数
        // 能量条配置
        maxEnergy: 3,                 // 最大能量点数
        energyRegenInterval: 4000,     // 能量恢复间隔（毫秒）
        energyPerShot: 1,             // 每次弹射消耗能量
        // 能量条显示配置
        energyBarWidth: 20,
        energyBarHeight: 30,
        energyBarGap: 5,
        // 地形生成配置（每10秒生成一面墙，最多8面墙）
        wallGenerationInterval: 10000,  // 墙壁生成间隔（毫秒）
        maxWalls: 8,                  // 最大墙壁数量
        wallMinLength: 80,            // 墙壁最小长度
        wallMaxLength: 120,           // 墙壁最大长度
        wallMinDistPiece: 120,        // 墙壁与棋子最小距离
        wallMinDistWall: 180,         // 墙壁之间最小距离
        wallEdgeMargin: 50            // 墙壁距画布边缘最小距离
    },

    // 四人乱斗模式专属配置
    chaos4: {
        // 棋子配置
        pieceRadius: 14,           // 比默认小一些，适合4人模式
        pieceFriction: 0.967,       // 摩擦系数
        pieceMinVelocity: 0.20,     // 最小速度
        pieceMass: 1,
        // 拖拽和力度配置
        maxDragDistance: 140,       // 最大拖拽距离
        maxPowerScale: 10,          // 最大力度缩放
        powerCurveExponent: 0.9,    // 力度曲线指数
        // 能量条配置
        maxEnergy: 3,              // 最大能量点数
        energyRegenInterval: 3500,  // 能量恢复间隔（毫秒）
        energyPerShot: 1,          // 每次弹射消耗能量
        // 能量条显示配置
        energyBarWidth: 20,
        energyBarHeight: 30,
        energyBarGap: 5,
        // 地形生成配置（每6秒生成一面墙，最多8面墙）
        wallGenerationInterval: 6000,  // 墙壁生成间隔（毫秒）
        maxWalls: 8,                // 最大墙壁数量
        wallMinLength: 60,           // 墙壁最小长度
        wallMaxLength: 100,          // 墙壁最大长度
        wallMinDistPiece: 100,      // 墙壁与棋子最小距离（画布较小，减小间距）
        wallMinDistWall: 120,        // 墙壁之间最小距离（画布较小，减小间距）
        wallEdgeMargin: 50           // 墙壁距画布边缘最小距离
    },

    // 碰撞恢复系数
    restitution: {
        wall: 0.8,
        piece: 0.95
    },

    // 技能配置
    skills: {
        frenzy: {
            id: 'frenzy',
            name: '狂暴',
            description: '最大弹射力度翻倍，飞出棋盘可复活',
            color: '#ff4444',
            duration: 1,
            maxPowerMultiplier: 2
        },
        doubleStrike: {
            id: 'doubleStrike',
            name: '二连击',
            description: '可以连续弹射两次',
            color: '#00fff2ff',
            duration: 1,
            strikeCount: 2
        },
        blink: {
            id: 'blink',
            name: '闪现',
            description: '弹射前可在指定范围内移动位置',
            color: '#edff61ff',
            duration: 1,
            minDistance: 110,
            moveSpeed: 9,
            radius: 280
        },
        clone: {
            id: 'clone',
            name: '分身',
            description: '在棋盘任意位置放置一个不能主动弹射的分身，分身存在6回合，可用2次',
            color: '#d115dbff',
            duration: 6,
            maxUses: 2,
            maxUsesPerTurn: 1
        },
        heavy: {
            id: 'heavy',
            name: '超重',
            description: '质量与体积大幅增大，持续6回合',
            color: '#f08811ff',
            duration: 6,
            massMultiplier: 6,
            radiusMultiplier: 2,
            frictionMultiplier: 1.01,
            powerMultiplier: 0.5
        },
        intangible: {
            id: 'intangible',
            name: '无形',
            description: '在对方回合时获得穿透效果，持续4回合；技能结束时被随机放置',
            color: '#d0c8c8f2',
            duration: 4
        }
    },

    // 全局技能配置
    globalSkills: {
        weakness: {
            id: 'weakness',
            name: '虚弱',
            description: '所有在场棋子最大力度减半，持续2回合',
            color: '#c7a931ff',
            duration: 2,
            powerScale: 0.5
        },
        shrink: {
            id: 'shrink',
            name: '缩小',
            description: '所有在场棋子体积缩小，持续2回合',
            color: '#2e51c4ff',
            duration: 2,
            radius: 9
        }
    },

    // 游戏机制配置
    protectionTurns: 2,
    skillUnlockTurn: 4,

    // 位置计算配置
    positions: {
        player1BaseXRatio: 0.13,
        player2BaseXRatio: 0.87,
        columnOffset: 50
    },

    // 墙壁生成配置（经典/技能回合制模式默认配置）
    wallGeneration: {
        enabled: true,              // 是否启用地形生成
        intervalTurns: 3,          // 每隔多少回合生成墙壁
        maxWalls: 8,                // 最大墙壁数量
        maxAttempts: 50,            // 生成墙壁的最大尝试次数
        minLength: 80,              // 墙壁最小长度
        maxLength: 120,             // 墙壁最大长度
        wallMinDistPiece: 140,      // 墙壁与棋子最小距离
        wallMinDistWall: 180,       // 墙壁之间最小距离
        wallEdgeMargin: 50,         // 墙壁距画布边缘最小距离
        thickness: 5                // 墙壁厚度
    },

    // 网络配置
    network: {
        tickRate: 60,
        syncInterval: 100,
        maxPredictionFrames: 10,
        version: '1.0.0'
    },

    // 道具配置
    items: {
        spawnInterval: 8000,        // 生成间隔（毫秒）
        radius: 18,                   // 道具半径
        spawnMargin: 60,              // 道具生成位置距画布边缘最小距离
        despawnTime: 10000,           // 10秒未拾取则消失
        // 生成权重（数值越高出现概率越大）
        spawnWeights: {
            quickRecovery: 20,        // 快速恢复
            freeze: 25,              // 冰冻
            sharedProsperity: 20,     // 富贵同享
            destiny: 15,             // 我命由天
            invisibility: 20,        // 隐身
            oneBody: 25             // 浑然一体
        },
        images: {
            quickRecovery: 'box_green',
            freeze: 'box_blue',
            sharedProsperity: 'box_yellow',
            destiny: 'box_red',
            invisibility: 'box_grey',
            oneBody: 'box_pink'
        },
        quickRecovery: {
            duration: 8000,           // 持续8秒
            energyRegenInterval: 2000  // 2秒恢复1点能量
        },
        freeze: {
            duration: 5000,            // 冻住持续5秒
        },
        sharedProsperity: {
            duration: 8000             // 持续8秒
        },
        destiny: {
            // 即时效果，无持续时间
        },
        invisibility: {
            duration: 5000  // 持续5秒
        },
        oneBody: {
            duration: 6000  // 持续6秒
        }
    },

    // 皮肤配置
    skins: {
        piece: {
            'yellow-box': {
                id: 'yellow-box',
                name: '黄盒',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/yellow-box.png'
            },
            'blue-box': {
                id: 'blue-box',
                name: '蓝盒',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/blue-box.png'
            },
            'red-box': {
                id: 'red-box',
                name: '红盒',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/red-box.png'
            },
            cyber: {
                id: 'cyber',
                name: 'Cyber',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/cyber.png'
            },
            'volleyball': {
                id: 'volleyball',
                name: '排球',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/volleyball.png'
            },
            'basketball': {
                id: 'basketball',
                name: '篮球',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/basketball.png'
            },
            'recycle': {
                id: 'recycle',
                name: '可回收',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/recycle.png'
            },
            'rainbow_ring': {
                id: 'rainbow_ring',
                name: '霓虹流光',
                isDefault: false,
                renderType: 'image',
                imagePath: 'assets/images/piece/rainbow_ring.png'
            }
        }
    },

    // 拖尾效果配置
    trailEffects: {
        // 基础颜色拖尾（向后兼容）
        trail_white: {
            id: 'trail_white',
            name: '白色',
            color: '#ffffff',
            isDefault: true,
            colors: ['#ffffff'],
            particleSize: { min: 1, max: 4 },
            particleShapes: ['circle', 'square'],
            particleCount: 3,
            life: { min: 0.6, max: 1.2 },
            friction: 0.98,
            glow: null,
            movement: { type: 'straight', speed: 1.0, variance: 0.2 }
        },
        trail_red: { id: 'trail_red', name: '红色', color: '#ff4757', description: '默认样式', isDefault: false, price: 30 },
        trail_blue: { id: 'trail_blue', name: '蓝色', color: '#1e90ff', description: '默认样式', isDefault: false, price: 30 },
        trail_green: { id: 'trail_green', name: '绿色', color: '#2ed573', description: '默认样式', isDefault: false, price: 30 },
        trail_gold: { id: 'trail_gold', name: '金色', color: '#ffd700', description: '默认样式', isDefault: false, price: 50 },
        trail_rainbow: { id: 'trail_rainbow', name: '彩虹', color: 'rainbow', description: '默认样式', isDefault: false, price: 100 },

        // 火焰样式
        trail_fire: {
            id: 'trail_fire',
            name: '火花',
            isDefault: false,
            colors: ['#ff4500', '#ff6a00', '#ffa500', '#ffcc00'],
            particleSize: { min: 2, max: 6 },
            particleShapes: ['circle', 'spark'],
            particleCount: 4,
            life: { min: 0.3, max: 0.7 },
            friction: 0.92,
            glow: { color: '#ff4500', blur: 8 },
            movement: { type: 'straight', speed: 1.2, variance: 0.3 }
        },

        // 雪花样式
        trail_snow: {
            id: 'trail_snow',
            name: '白色星星',
            isDefault: false,
            colors: ['#ffffff', '#e8f4ff', '#d0e8ff'],
            particleSize: { min: 2, max: 5 },
            particleShapes: ['sparkle'],
            particleCount: 3,
            life: { min: 0.6, max: 1.2 },
            friction: 0.97,
            glow: { color: '#ffffff', blur: 8 },
            movement: { type: 'drift', speed: 0.4, variance: 0.3, driftAngle: 45 }
        },

        // 星星样式
        trail_stars: {
            id: 'trail_stars',
            name: '黄色星星',
            isDefault: false,
            colors: ['#ffffff', '#fffacd', '#ffd700'],
            particleSize: { min: 2, max: 4 },
            particleShapes: ['sparkle'],
            particleCount: 5,
            life: { min: 0.5, max: 1.0 },
            friction: 0.97,
            glow: { color: '#ffd700', blur: 12 },
            movement: { type: 'straight', speed: 1.0, variance: 0.3 }
        },

        // 烟雾样式
        trail_smoke: {
            id: 'trail_smoke',
            name: '烟雾',
            isDefault: false,
            colors: ['#606060', '#808080', '#a0a0a0'],
            particleSize: { min: 2, max: 8},
            particleShapes: ['circle'],
            particleCount: 3,
            life: { min: 1.0, max: 2.0 },
            friction: 0.96,
            glow: null,
            movement: { type: 'drift', speed: 0.6, variance: 0.2, driftAngle: -45 }
        },

        // 闪电样式
        trail_lightning: {
            id: 'trail_lightning',
            name: '闪电',
            isDefault: false,
            colors: ['#ffffff', '#00bfff', '#1e90ff'],
            particleSize: { min: 1, max: 4 },
            particleShapes: ['spark', 'jagged'],
            particleCount: 5,
            life: { min: 0.1, max: 0.6 },
            friction: 0.92,
            glow: { color: '#00bfff', blur: 15 },
            movement: { type: 'straight', speed: 1.0, variance: 0.3 }
        }
    },

    // 货币和奖励配置
    currency: {
        initialCoins: 100,
        winReward: 20,
        lossReward: 5
    }
};

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameConfig;
}

// 在浏览器环境中设置 window.GAME_CONFIG
if (typeof window !== 'undefined') {
    window.GAME_CONFIG = GameConfig;
}
