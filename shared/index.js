/**
 * 共享模块入口
 * 客户端和服务端共用
 */

// 常量
const GameConfig = require('./constants/GameConfig');
const MessageTypes = require('./constants/MessageTypes');

// 工具类
const PositionCalculator = require('./utils/PositionCalculator');
const SkillLogic = require('./utils/SkillLogic');
const GameState = require('./utils/GameState');
const PhysicsEngine = require('./utils/PhysicsEngine');

module.exports = {
    GameConfig,
    MessageTypes,
    PositionCalculator,
    SkillLogic,
    GameState,
    PhysicsEngine
};
