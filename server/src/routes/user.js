/**
 * 用户路由
 * GET /api/user/profile - 获取个人资料
 * PUT /api/user/password - 修改密码
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;

/**
 * GET /api/user/profile
 * 获取用户个人资料
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const users = await db.query(
            'SELECT id, username, email, created_at, last_login FROM users WHERE id = ?',
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
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });

    } catch (error) {
        console.error('获取用户资料错误:', error);
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
 * PUT /api/user/profile
 * 修改个人资料（用户名）
 */
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { username } = req.body;

        // 验证必填字段
        if (!username) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '用户名不能为空'
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

        // 检查用户名是否已存在
        const existingUsers = await db.query(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, req.user.userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'USERNAME_EXISTS',
                    message: '用户名已存在'
                }
            });
        }

        // 更新用户名
        await db.query(
            'UPDATE users SET username = ? WHERE id = ?',
            [username, req.user.userId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('修改个人资料错误:', error);
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
 * PUT /api/user/password
 * 修改密码
 */
router.put('/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // 验证必填字段
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '旧密码和新密码不能为空'
                }
            });
        }

        // 验证新密码长度
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '新密码长度至少为 6 个字符'
                }
            });
        }

        // 获取用户当前密码
        const users = await db.query(
            'SELECT password_hash FROM users WHERE id = ?',
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

        // 验证旧密码
        const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: '旧密码错误'
                }
            });
        }

        // 更新密码
        const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newPasswordHash, req.user.userId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('修改密码错误:', error);
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
