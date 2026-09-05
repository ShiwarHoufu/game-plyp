/**
 * 认证路由
 * POST /api/auth/register - 注册
 * POST /api/auth/login - 登录
 * POST /api/auth/logout - 登出
 * GET /api/auth/check - 检查登录状态
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/mysql');
const { generateToken, verifyToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * 注册新用户
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // 验证必填字段
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '用户名和密码不能为空'
                }
            });
        }

        // 验证用户名长度
        if (username.length < 2 || username.length > 10) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '用户名长度应为 2-10 个字符'
                }
            });
        }

        // 验证密码长度
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '密码长度至少为 6 个字符'
                }
            });
        }

        // 检查用户名是否已存在
        const existing = await db.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'USERNAME_EXISTS',
                    message: '用户名已被注册'
                }
            });
        }

        // 加密密码
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // 插入用户
        const result = await db.query(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            [username, passwordHash, email || null]
        );

        const userId = result.insertId;

        // 初始化各模式的战绩
        const gameModes = ['classic', 'skill', 'chaos', 'chaos4'];
        for (const mode of gameModes) {
            await db.query(
                'INSERT INTO player_stats (user_id, game_mode) VALUES (?, ?)',
                [userId, mode]
            );
        }

        // 初始化用户货币（赠送100金币）
        await db.query(
            'INSERT INTO user_currency (user_id, coins) VALUES (?, ?)',
            [userId, 100]
        );

        // 生成 token
        const token = generateToken({ id: userId, username });

        res.status(201).json({
            success: true,
            userId,
            token
        });

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: '服务器错误'
            }
        });
    }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 验证必填字段
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '用户名和密码不能为空'
                }
            });
        }

        // 查找用户
        const users = await db.query(
            'SELECT id, username, password_hash FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: '用户名或密码错误'
                }
            });
        }

        const user = users[0];

        // 验证密码
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: '用户名或密码错误'
                }
            });
        }

        // 更新最后登录时间
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // 生成 token
        const token = generateToken({ id: user.id, username: user.username });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: '服务器错误'
            }
        });
    }
});

/**
 * POST /api/auth/logout
 * 用户登出（客户端清除 token 即可）
 */
router.post('/logout', (req, res) => {
    res.json({ success: true });
});

/**
 * GET /api/auth/check
 * 检查登录状态
 */
router.get('/check', requireAuth, async (req, res) => {
    try {
        // 获取用户最新信息
        const users = await db.query(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: '用户不存在'
                }
            });
        }

        const user = users[0];

        res.json({
            success: true,
            loggedIn: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('检查登录状态错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: '服务器错误'
            }
        });
    }
});

module.exports = router;
