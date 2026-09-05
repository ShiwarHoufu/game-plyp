/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const db = require('../db/mysql');

const JWT_SECRET = process.env.JWT_SECRET || 'plgp-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 生成 JWT Token
 * @param {Object} user - 用户对象 {id, username}
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT token
 * @returns {Object|null} 解码后的 payload 或 null
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * 中间件：验证 JWT Token
 * 将用户信息挂载到 req.user
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: '未授权，请先登录'
            }
        });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Token 无效或已过期'
            }
        });
    }

    // 将用户信息挂载到 req 对象
    req.user = {
        userId: decoded.userId,
        username: decoded.username
    };

    next();
}

/**
 * 可选认证中间件：不强制要求登录
 * 如果有 token 则解析并挂载到 req.user
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = {
                userId: decoded.userId,
                username: decoded.username
            };
        }
    }

    next();
}

module.exports = {
    generateToken,
    verifyToken,
    requireAuth,
    optionalAuth,
    JWT_SECRET
};
