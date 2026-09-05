/**
 * 战绩路由
 * GET /api/stats - 获取全部战绩
 * GET /api/stats/:mode - 获取指定模式战绩
 */
const express = require('express');
const db = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_MODES = ['classic', 'skill', 'chaos', 'chaos4'];

/**
 * GET /api/stats
 * 获取用户全部战绩
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const stats = await db.query(
            'SELECT game_mode, wins, losses, total_games FROM player_stats WHERE user_id = ?',
            [req.user.userId]
        );

        // 转换为对象格式
        const result = {};
        for (const row of stats) {
            result[row.game_mode] = {
                wins: row.wins,
                losses: row.losses,
                totalGames: row.total_games,
                winRate: row.total_games > 0
                    ? Math.round((row.wins / row.total_games) * 1000) / 10
                    : 0
            };
        }

        res.json({
            success: true,
            stats: result
        });

    } catch (error) {
        console.error('获取战绩错误:', error);
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
 * GET /api/stats/:mode
 * 获取指定模式战绩
 */
router.get('/:mode', requireAuth, async (req, res) => {
    try {
        const { mode } = req.params;

        if (!VALID_MODES.includes(mode)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_MODE',
                    message: '无效的游戏模式'
                }
            });
        }

        const stats = await db.query(
            'SELECT wins, losses, total_games FROM player_stats WHERE user_id = ? AND game_mode = ?',
            [req.user.userId, mode]
        );

        if (stats.length === 0) {
            return res.json({
                success: true,
                stats: {
                    wins: 0,
                    losses: 0,
                    totalGames: 0,
                    winRate: 0
                }
            });
        }

        const row = stats[0];

        res.json({
            success: true,
            stats: {
                wins: row.wins,
                losses: row.losses,
                totalGames: row.total_games,
                winRate: row.total_games > 0
                    ? Math.round((row.wins / row.total_games) * 1000) / 10
                    : 0
            }
        });

    } catch (error) {
        console.error('获取战绩错误:', error);
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
 * POST /api/stats/update
 * 更新战绩（游戏结束时由服务端内部调用）
 * body: { userId, gameMode, result, rounds, opponentUsername?, pieceCount?, generateTerrain? }
 */
router.post('/update', async (req, res) => {
    try {
        const { userId, gameMode, result, rounds, opponentUsername, pieceCount, generateTerrain } = req.body;

        if (!userId || !gameMode || !result || !rounds) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '缺少必要参数'
                }
            });
        }

        if (!VALID_MODES.includes(gameMode)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_MODE',
                    message: '无效的游戏模式'
                }
            });
        }

        if (!['win', 'loss'].includes(result)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_RESULT',
                    message: '无效的比赛结果'
                }
            });
        }

        // 更新 player_stats 表
        const isWin = result === 'win';
        await db.query(
            `INSERT INTO player_stats (user_id, game_mode, wins, losses, total_games)
             VALUES (?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE
                wins = wins + ?,
                losses = losses + ?,
                total_games = total_games + 1`,
            [userId, gameMode, isWin ? 1 : 0, isWin ? 0 : 1, isWin ? 1 : 0, isWin ? 0 : 1]
        );

        // 插入 game_history 记录
        await db.query(
            'INSERT INTO game_history (user_id, game_mode, rounds, result, opponent_username, piece_count, generate_terrain) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, gameMode, rounds, result, opponentUsername || null, pieceCount || null, generateTerrain ? 1 : 0]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('更新战绩错误:', error);
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
 * GET /api/stats/history/:mode
 * 获取指定模式的详细对局历史
 */
router.get('/history/:mode', requireAuth, async (req, res) => {
    try {
        const { mode } = req.params;

        if (!VALID_MODES.includes(mode)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_MODE',
                    message: '无效的游戏模式'
                }
            });
        }

        const history = await db.query(
            `SELECT id, game_mode, rounds, result, opponent_username, piece_count, generate_terrain, played_at
             FROM game_history
             WHERE user_id = ? AND game_mode = ?
             ORDER BY played_at DESC
             LIMIT 50`,
            [req.user.userId, mode]
        );

        res.json({
            success: true,
            history: history.map(row => ({
                id: row.id,
                gameMode: row.game_mode,
                rounds: row.rounds,
                result: row.result,
                opponentUsername: row.opponent_username,
                pieceCount: row.piece_count,
                generateTerrain: !!row.generate_terrain,
                playedAt: row.played_at
            }))
        });

    } catch (error) {
        console.error('获取历史战绩错误:', error);
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
